import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { decide, summariseAnswer, engineStatus, configuredEngine } from './lib/decision.js';
import { generate, generationAvailable, textModel, codeModel } from './lib/generate.js';
import { buildApp, planApp, MAX_PROMPT_CHARS } from './lib/builder.js';
import { CAPABILITIES, TABS, capabilityIds } from './lib/schemas.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');

// ── Security headers ────────────────────────────────────────────────────────
// Registered BEFORE static so every response — including index.html and any
// asset served from /public — carries them.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  // The main app never needs to run scripts from elsewhere; generated apps are
  // confined to their own sandboxed iframe with a separate injected CSP.
  // frame-src blob: is required for the srcdoc preview frame.
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'"
  );
  next();
});

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Rate limiting ───────────────────────────────────────────────────────────
// The builder endpoint spends real money (LLM generation), so it is limited
// harder than the cheap decision endpoints. In-memory per instance: on
// serverless this is per-container best-effort, not a global guarantee — pair
// it with platform-level limits for production abuse control.

const BUCKETS = new Map();

function rateLimit({ windowMs, max, prefix }) {
  return (req, res, next) => {
    const now = Date.now();
    const key = prefix + ':' + clientIp(req);
    const bucket = BUCKETS.get(key);

    if (!bucket || bucket.reset <= now) {
      BUCKETS.set(key, { count: 1, reset: now + windowMs });
      return next();
    }
    bucket.count++;
    if (bucket.count > max) {
      const retry = Math.ceil((bucket.reset - now) / 1000);
      res.setHeader('Retry-After', String(retry));
      return res.status(429).json({
        error: `Rate limit exceeded for ${prefix}. Try again in ${retry}s.`,
      });
    }
    next();
  };
}

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

// Periodically drop stale buckets so the map cannot grow without bound.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of BUCKETS) if (v.reset <= now) BUCKETS.delete(k);
}, 60_000).unref?.();

const limitDecide = rateLimit({ windowMs: 60_000, max: 60, prefix: 'decide' });
const limitGenerate = rateLimit({ windowMs: 60_000, max: 20, prefix: 'generate' });
const limitBuild = rateLimit({ windowMs: 60_000, max: 6, prefix: 'build' });

// Reject cross-origin form/JS callers. Same-origin UI fetches are unaffected.
app.use((req, res, next) => {
  if (req.method === 'POST' || req.method === 'PUT') {
    const origin = req.headers.origin;
    if (origin) {
      const host = req.headers.host;
      let sameOrigin = false;
      try {
        sameOrigin = new URL(origin).host === host;
      } catch {
        sameOrigin = false;
      }
      if (!sameOrigin) return res.status(403).json({ error: 'Cross-origin request rejected' });
    }
  }
  next();
});

const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
  console.error(`[error] ${req.method} ${req.path}:`, err.message);
  if (!res.headersSent) res.status(500).json({ error: err.message || 'Internal error' });
});

/**
 * Own-property lookup only. A plain `CAPABILITIES[id]` would resolve
 * `__proto__`, `constructor`, `toString`, etc. to inherited Object members
 * (all truthy), so an attacker-controlled id could slip past a `!cap` check.
 */
function getCapability(id) {
  if (typeof id !== 'string') return null;
  return Object.hasOwn(CAPABILITIES, id) ? CAPABILITIES[id] : null;
}

// ── Metadata ────────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({ status: 'ok', engine: configuredEngine() });
});

app.get('/api/status', (req, res) => {
  const st = engineStatus();
  res.json({
    ...st,
    generationModel: generationAvailable() ? textModel() : null,
    codeModel: generationAvailable() ? codeModel() : null,
    capabilities: capabilityIds(),
    tabs: TABS,
  });
});

app.get('/api/capabilities', (req, res) => {
  res.json(
    Object.entries(CAPABILITIES).map(([id, c]) => ({
      id,
      label: c.label,
      icon: c.icon,
      tab: c.tab,
      engine: c.engine,
      blurb: c.blurb,
      example: c.example,
    }))
  );
});

// ── Decision capabilities (Clef / Jev) ──────────────────────────────────────

app.post(
  '/api/decide',
  limitDecide,
  wrap(async (req, res) => {
    const { capability, text, engine } = req.body || {};
    const cap = getCapability(capability);
    if (!cap) return res.status(400).json({ error: `Unknown capability: ${capability}` });
    if (cap.engine !== 'decision') {
      return res.status(400).json({ error: `${capability} is a generation capability; use /api/generate` });
    }
    if (!text || !String(text).trim()) return res.status(400).json({ error: 'text is required' });

    const input = String(text).slice(0, 8000);
    const { state, questions } = cap.schema(input);
    const result = await decide({ state, questions }, { engine, signal: req.signal });

    // Shape answers for the UI: label, confidence, and the full distribution.
    const shaped = {};
    for (const [id, answer] of Object.entries(result.answers)) {
      const s = summariseAnswer(answer, questions[id]);
      shaped[id] = {
        ...answer,
        question: typeof questions[id].instructions === 'string' ? questions[id].instructions : id,
        type: questions[id].type,
        label: s.label,
        confidence: s.confidence,
        ...(s.index !== undefined ? { index: s.index, levels: s.levels } : {}),
      };
    }

    res.json({
      capability,
      label: cap.label,
      engine: result.engine,
      model: result.model,
      simulated: result.simulated,
      latencyMs: result.latencyMs,
      usage: result.usage,
      answers: shaped,
    });
  })
);

// ── Generation capabilities (summarisation, extraction) ─────────────────────

app.post(
  '/api/generate',
  limitGenerate,
  wrap(async (req, res) => {
    const { capability, text } = req.body || {};
    const cap = getCapability(capability);
    if (!cap) return res.status(400).json({ error: `Unknown capability: ${capability}` });
    if (cap.engine !== 'generation') {
      return res.status(400).json({ error: `${capability} is a decision capability; use /api/decide` });
    }
    if (!text || !String(text).trim()) return res.status(400).json({ error: 'text is required' });

    const started = Date.now();
    const result = await generate({
      prompt: cap.prompt(String(text).slice(0, 8000)),
      json: Boolean(cap.json),
      maxTokens: cap.json ? 800 : 1200,
      signal: req.signal,
    });

    res.json({
      capability,
      label: cap.label,
      model: result.model,
      simulated: Boolean(result.simulated),
      latencyMs: Date.now() - started,
      usage: result.usage,
      text: result.text,
      ...(cap.json ? { json: safeParse(result.text) } : {}),
    });
  })
);

// ── App Builder ─────────────────────────────────────────────────────────────

// Step 1: plan only (fast, decision-model call). Lets the UI show the plan
// before committing to a full generation.
app.post(
  '/api/builder/plan',
  limitDecide,
  wrap(async (req, res) => {
    const { description } = req.body || {};
    if (!description || !String(description).trim()) {
      return res.status(400).json({ error: 'description is required' });
    }
    const plan = await planApp(String(description).slice(0, MAX_PROMPT_CHARS), { signal: req.signal });
    res.json({ plan });
  })
);

// Step 2: stream the build as SSE — plan event, then code chunks, then done.
app.post('/api/builder/build', limitBuild, async (req, res) => {
  const { description } = req.body || {};
  if (!description || !String(description).trim()) {
    return res.status(400).json({ error: 'description is required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const send = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  let finalHtml = null;
  try {
    for await (const ev of buildApp(String(description).slice(0, MAX_PROMPT_CHARS), { signal: req.signal })) {
      if (ev.type === 'done') {
        finalHtml = ev.html;
        send('done', { bytes: ev.bytes, plan: ev.plan });
      } else if (ev.type === 'plan') {
        send('plan', { plan: ev.plan });
      } else if (ev.type === 'blocked') {
        send('blocked', { message: ev.message });
      } else if (ev.type === 'error') {
        send('error', { message: ev.message });
      } else {
        send('chunk', { text: ev.text });
      }
    }
  } catch (err) {
    send('error', { message: err.message || String(err) });
  }

  // Send the sanitised source to the client. The preview renders it via
  // srcdoc and the download builds a Blob locally — no server-side state, so
  // this works on serverless where requests hit different instances.
  if (finalHtml) {
    send('app', { html: finalHtml, bytes: Buffer.byteLength(finalHtml) });
  }
  res.end();
});

// Legacy preview route kept so existing links 410 clearly instead of 404ing.
app.get('/preview/:id', (req, res) => {
  res.status(410).json({
    error: 'Server-side previews were removed for serverless compatibility. The app is rendered client-side via a sandboxed iframe srcdoc.',
  });
});

app.get('/api/builder/download/:id', (req, res) => {
  res.status(410).json({
    error: 'Downloads are generated client-side from the build stream. Use the Download button in the UI.',
  });
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Legacy endpoint kept alive so old bookmarks/links do not 404.
app.post('/api/jev', (req, res) => {
  res.status(410).json({
    error: 'This endpoint was replaced. Use /api/decide for decision tasks and /api/generate for text tasks.',
    docs: '/api/capabilities',
  });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.listen(PORT, () => {
  const st = engineStatus();
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║   Epic Jev — Decision Engine + App Builder       ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`\n  http://localhost:${PORT}`);
  console.log(`\n  Decision engine : ${st.engine}${st.engine === 'demo' ? '  (simulated — no credentials)' : ''}`);
  console.log(`  Cloudflare creds: ${st.cloudflare ? 'yes (Clef available)' : 'no'}`);
  console.log(`  Gateway key     : ${st.gateway ? `yes (${textModel()})` : 'no (generation simulated)'}`);
  console.log(`  Capabilities    : ${capabilityIds().length}`);
  console.log(`\n  Set CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_AUTH_TOKEN for Clef,`);
  console.log(`  or AI_GATEWAY_API_KEY for Jev + generation.\n`);
});
