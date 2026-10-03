// App Builder — Clef decides the shape of the app, an LLM writes the code.
//
// SECURITY MODEL (read before changing):
//   * Generated code is NEVER executed server-side. No eval, no vm, no spawn.
//   * It is returned as text and rendered by the browser inside an iframe with
//     sandbox="allow-scripts" and deliberately WITHOUT allow-same-origin, so
//     the frame gets an opaque origin: it cannot read the app's cookies,
//     localStorage, or make credentialed same-origin requests.
//   * Output is size-capped and stripped of anything that tries to escape the
//     frame (top-level navigation, window.open, form targets).
//   * The preview route sends a strict CSP and nosniff/frame-deny headers.

import { decide } from './decision.js';
import { generateStream, generate } from './generate.js';

export const MAX_APP_BYTES = 200 * 1024; // 200 KiB hard cap on generated apps
export const MAX_PROMPT_CHARS = 4000;

// Model-independent abuse guard. The decision model also classifies risk, but
// safety must not depend on credentials being configured or on a model's
// judgement alone — this blocklist runs first, always, in every mode.
const ABUSE_PATTERNS = [
  /phish(ing)?\b/i,
  /(harvest|steal|exfiltrat|scrape|collect).{0,30}(credential|password|credit ?card|card number|ssn|social security|login|token|secret|api ?key)/i,
  /(credential|password|credit ?card|card number|ssn|social security).{0,30}(harvest|steal|phish|exfiltrat|collect|skim)/i,
  /keylog(ger|ging)?/i,
  /\bmalware\b|\bransom ?ware\b|\btrojan\b|\brootkit\b|\bbooter\b|\bstresser\b/i,
  /\b(ddos|dos attack|denial of service)\b/i,
  /(fake|clone|replica|spoof).{0,25}(login|bank|paypal|google|microsoft|facebook|crypto|wallet|exchange)\b/i,
  /\bcard(ing|er)\b|\bcvv\b.{0,20}(dump|store|send)|\bfullz\b/i,
  /(bypass|evade|circumvent).{0,25}(captcha|2fa|two.?factor|rate limit|kyc|aml|sanction)/i,
  /(generate|create|build|make).{0,25}(ransomware|malware|virus|worm|exploit|payload|shellcode)/i,
  /\bcryptojacking\b|\bcoinhive\b|hidden miner/i,
  /(send|post|transmit|forward|exfil).{0,30}(to my server|to attacker|to a remote|secretly|without (the )?user)/i,
];

/**
 * Hard-block abusive requests before any model call or code generation.
 * Returns a reason string, or null when the request is allowed.
 */
export function detectAbuse(description) {
  const text = String(description || '');
  for (const re of ABUSE_PATTERNS) {
    if (re.test(text)) return re.source;
  }
  return null;
}

/**
 * Ask the decision model what kind of app this is before generating anything.
 * This is the "Clef as decision core inside the app builder" step: it picks
 * the template, flags risk, and decides whether the request is even buildable.
 */
export async function planApp(description, opts = {}) {
  const state = { request: description.slice(0, MAX_PROMPT_CHARS) };

  // Hard guard runs before any model call — works in demo mode too.
  const abuse = detectAbuse(description);
  if (abuse) {
    return {
      engine: 'guard',
      latencyMs: 0,
      simulated: false,
      buildable: false,
      appType: '—',
      appTypeProbs: {},
      complexity: '—',
      complexityScore: 0,
      needsPersistence: false,
      needsBackend: false,
      risk: 'high',
      riskProbs: { high: 1 },
      styling: '—',
      blocked: true,
      blockReason: 'abuse-pattern',
      answers: {},
    };
  }

  const { answers, engine, latencyMs, simulated } = await decide(
    {
      state,
      questions: {
        buildable: {
          type: 'noul',
          instructions:
            'Can this be built as a single self-contained static HTML file that runs entirely in the browser?',
          criteria: {
            true: 'Yes — pure client-side UI, logic, and local state.',
            false: 'No — it needs a server, database, payments, or auth.',
          },
        },
        app_type: {
          type: 'choice',
          instructions: 'What kind of app is being requested?',
          criteria: {
            productivity: 'Todo, notes, tracker, checklist, planner.',
            dashboard: 'Charts, metrics, data visualisation.',
            game: 'Playable interactive game.',
            form_tool: 'Calculator, converter, generator, quiz.',
            landing_page: 'Marketing or informational page.',
            creative: 'Drawing, music, animation, generative art.',
            commerce: 'Storefront, cart, checkout.',
            other: 'None of these.',
          },
        },
        complexity: {
          type: 'score',
          instructions: 'How complex is the implementation?',
          criteria: ['Trivial', 'Simple', 'Moderate', 'Complex', 'Very complex'],
        },
        needs_persistence: {
          type: 'noul',
          instructions: 'Does the app need to remember data between visits?',
        },
        needs_backend: {
          type: 'noul',
          instructions:
            'Does this require a server, database, third-party API key, or user accounts?',
        },
        risk: {
          type: 'choice',
          instructions: 'What content risk does this request carry?',
          criteria: {
            none: 'Benign, ordinary application.',
            low: 'Slightly unusual but harmless.',
            medium: 'Could be misused; needs care.',
            high: 'Requests credential theft, malware, scraping abuse, or illegal activity.',
          },
        },
        styling: {
          type: 'choice',
          instructions: 'What visual style fits best?',
          criteria: {
            minimal: 'Clean, lots of whitespace, neutral palette.',
            playful: 'Bright colours, rounded, friendly.',
            professional: 'Corporate, dense, data-forward.',
            dark: 'Dark theme, high contrast, modern.',
          },
        },
      },
    },
    opts
  );

  const type = pick(answers, 'app_type');
  const risk = pick(answers, 'risk');
  const complexity = scoreInfo(answers, 'complexity');
  const styling = pick(answers, 'styling');

  return {
    engine,
    latencyMs,
    simulated,
    buildable: bool(answers, 'buildable') !== false,
    appType: type.label,
    appTypeProbs: type.probabilities,
    complexity: complexity.label,
    complexityScore: complexity.raw,
    needsPersistence: bool(answers, 'needs_persistence'),
    needsBackend: bool(answers, 'needs_backend'),
    risk: risk.label,
    riskProbs: risk.probabilities,
    styling: styling.label,
    blocked: risk.label === 'high',
    blockReason: risk.label === 'high' ? 'model-risk' : null,
    answers,
  };
}

const BLOCKED_MESSAGE =
  'This request was blocked by the app planner: it looks like it asks for ' +
  'something harmful (credential theft, malware, or abuse tooling). ' +
  'Describe a legitimate app and I will build it.';

/**
 * Stream a complete single-file HTML app.
 * Yields { type: 'plan' | 'chunk' | 'done' | 'error' | 'blocked', ... }.
 */
export async function* buildApp(description, opts = {}) {
  const plan = await planApp(description, opts);
  yield { type: 'plan', plan };

  if (plan.blocked) {
    yield { type: 'blocked', message: BLOCKED_MESSAGE };
    return;
  }

  const prompt = buildPrompt(description, plan);
  const system =
    'You are an expert front-end engineer. You output ONE complete, valid, ' +
    'self-contained HTML file and nothing else — no markdown fences, no ' +
    'commentary, no explanations. The file must run with no build step and no ' +
    'network access.';

  let out = '';
  try {
    for await (const chunk of generateStream({ prompt, system, maxTokens: 8000, signal: opts.signal })) {
      out += chunk;
      if (out.length > MAX_APP_BYTES) {
        yield { type: 'error', message: `Generated app exceeded ${MAX_APP_BYTES >> 10} KiB; truncated.` };
        out = out.slice(0, MAX_APP_BYTES);
        break;
      }
      yield { type: 'chunk', text: chunk };
    }
  } catch (err) {
    yield { type: 'error', message: err.message || String(err) };
    return;
  }

  const html = sanitise(extractHtml(out));
  if (!html) {
    yield { type: 'error', message: 'Model returned no usable HTML.' };
    return;
  }
  yield { type: 'done', html, bytes: Buffer.byteLength(html), plan };
}

/** Non-streaming variant used by tests and the API. */
export async function buildAppOnce(description, opts = {}) {
  let plan = null;
  let html = '';
  let error = null;
  let blocked = null;
  for await (const ev of buildApp(description, opts)) {
    if (ev.type === 'plan') plan = ev.plan;
    else if (ev.type === 'chunk') html += ev.text;
    else if (ev.type === 'done') html = ev.html;
    else if (ev.type === 'error') error = ev.message;
    else if (ev.type === 'blocked') blocked = ev.message;
  }
  return { plan, html: html || null, error, blocked };
}

// ── Prompt construction ─────────────────────────────────────────────────────

function buildPrompt(description, plan) {
  const parts = [
    `Build this app: ${description.slice(0, MAX_PROMPT_CHARS)}`,
    '',
    'HARD REQUIREMENTS:',
    '- Output exactly one complete HTML document starting with <!DOCTYPE html>.',
    '- All CSS and JavaScript inline. No external files, no CDN links, no imports, no fetch calls.',
    '- Must work offline when opened as a standalone file.',
    '- No placeholder text like "TODO" or lorem ipsum — implement real behaviour.',
    '- Responsive: usable at 360px and 1440px wide.',
    `- Visual style: ${plan.styling}.`,
    `- App category: ${plan.appType}. Complexity target: ${plan.complexity}.`,
  ];

  if (plan.needsPersistence) {
    parts.push(
      '- Persist state with localStorage, wrapped in try/catch so it still works',
      '  when storage is unavailable (sandboxed iframes block it).'
    );
  }
  if (plan.needsBackend) {
    parts.push(
      '- The request implies a backend, but you must ship client-side only.',
      '  Simulate the server with in-memory data and clearly label it as demo data.',
      '  Never embed real credentials or call external APIs.'
    );
  }

  parts.push(
    '',
    'FORBIDDEN (the file is sandboxed and these will break it):',
    '- No window.open, no top.location, no parent.* access, no form target attributes.',
    '- No alert/prompt/confirm.',
    '- No external network requests of any kind.',
    '',
    'Return the HTML file now.'
  );
  return parts.join('\n');
}

// ── Output hardening ────────────────────────────────────────────────────────

/** Models often wrap code in ```html fences or add prose — keep only the document. */
export function extractHtml(raw) {
  if (!raw) return '';
  let s = String(raw);

  const fenced = s.match(/```(?:html|htm)?\s*([\s\S]*?)```/i);
  if (fenced) s = fenced[1];

  // Require an actual document. Without this, prose from a mis-routed
  // generation call would be passed through and rendered as an "app".
  const start = s.search(/<!DOCTYPE html>|<html[\s>]/i);
  if (start === -1) return '';

  if (start > 0) s = s.slice(start);
  const end = s.toLowerCase().lastIndexOf('</html>');
  if (end !== -1) s = s.slice(0, end + '</html>'.length);

  return s.trim();
}

/**
 * Strip frame-escape vectors. The iframe sandbox already denies same-origin,
 * but defence in depth: remove the things that could navigate the top window
 * or open a new one, and cap the size.
 *
 * Whole tags are removed (not just the offending attribute) so no dangling
 * fragments or bare URLs are left behind in the output.
 */
export function sanitise(html) {
  if (!html) return '';
  let s = String(html).slice(0, MAX_APP_BYTES);

  // Remove entire dangerous elements, including their content where relevant.
  const tagRemovals = [
    /<script\b[^>]*\bsrc\s*=[^>]*>[\s\S]*?<\/script\s*>/gi, // external scripts
    /<script\b[^>]*\bsrc\s*=[^>]*\/?>/gi,                    // external script, no body
    /<link\b[^>]*>/gi,                                        // external stylesheets/icons
    /<iframe\b[^>]*>[\s\S]*?<\/iframe\s*>/gi,                 // nested frames
    /<iframe\b[^>]*\/?>/gi,
    /<meta\b[^>]+http-equiv\s*=\s*["']?\s*refresh[^>]*>/gi,   // meta refresh
    /<object\b[^>]*>[\s\S]*?<\/object\s*>/gi,
    /<embed\b[^>]*>/gi,
    /<base\b[^>]*>/gi,                                        // base href hijack
  ];
  for (const re of tagRemovals) s = s.replace(re, '');

  // Neutralise frame-escape and navigation JS/attrs wherever they appear.
  const inlineRemovals = [
    /\bwindow\.open\s*\(/gi,
    /\btop\.location\b/gi,
    /\bparent\.location\b/gi,
    /\bwindow\.top\b/gi,
    /\bwindow\.parent\b/gi,
    /\bdocument\.cookie\b/gi,
    /\btarget\s*=\s*["']?_(top|parent|blank)/gi,
    /\baction\s*=\s*["']?\s*(?:https?:)?\/\//gi, // form action to external host
  ];
  for (const re of inlineRemovals) s = s.replace(re, '/*removed*/');

  return injectCsp(s);
}

/**
 * Force a CSP into the document itself, so the preview is network-isolated
 * even when rendered via srcdoc (where the server cannot set a header).
 * A model-supplied CSP is removed first — ours must be the only one.
 */
export function injectCsp(html) {
  if (!html) return '';
  let s = String(html).replace(
    /<meta[^>]+http-equiv\s*=\s*["']?content-security-policy["']?[^>]*>/gi,
    ''
  );
  const tag = `<meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP.replace(/"/g, '&quot;')}">`;
  const headOpen = s.match(/<head[^>]*>/i);
  if (headOpen) {
    const at = headOpen.index + headOpen[0].length;
    return s.slice(0, at) + tag + s.slice(at);
  }
  const htmlOpen = s.match(/<html[^>]*>/i);
  if (htmlOpen) {
    const at = htmlOpen.index + htmlOpen[0].length;
    return s.slice(0, at) + `<head>${tag}</head>` + s.slice(at);
  }
  return tag + s;
}

/**
 * Content Security Policy for the preview frame.
 * default-src 'none' + only inline script/style means the generated app cannot
 * reach the network at all, even if sanitisation missed something.
 */
export const PREVIEW_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data: blob:",
  "font-src data:",
  "media-src data: blob:",
  "connect-src 'none'",
  "form-action 'none'",
  "frame-ancestors 'self'",
  "base-uri 'none'",
].join('; ');

/** The sandbox attribute value used by the preview iframe. */
export const PREVIEW_SANDBOX = 'allow-scripts allow-modals allow-popups-to-escape-sandbox';

// ── Answer helpers ──────────────────────────────────────────────────────────

function pick(answers, id) {
  const a = answers?.[id];
  if (!a) return { label: '—', probabilities: {} };
  return { label: a.choice ?? '—', probabilities: a.probabilities ?? {} };
}

function bool(answers, id) {
  const a = answers?.[id];
  if (!a) return null;
  const p = a.noul ?? a.probability;
  return typeof p === 'number' ? p >= 0.5 : null;
}

function scoreInfo(answers, id) {
  const a = answers?.[id];
  if (!a) return { label: '—', raw: 0 };
  const legend = a.legend || {};
  const idx = Math.round(a.score ?? 0);
  return { label: legend[String(idx)] ?? `Level ${idx}`, raw: a.score ?? 0 };
}
