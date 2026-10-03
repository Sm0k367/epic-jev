// Decision engine — talks to Clef (Cloudflare Workers AI) or Jev (Vercel AI
// Gateway), and falls back to a deterministic local simulator when no
// credentials are configured.
//
// All three backends speak the same "System One" protocol: a `state` plus a
// map of typed `questions` (choice | score | noul), returning one answer per
// question id. Clef and Jev are API-compatible, so swapping is a config change.

import { experimental_evaluate } from 'ai';

export const ENGINES = ['clef', 'clef-flash', 'jev', 'laya', 'demo'];

const CLEF_MODEL_IDS = {
  'clef': '@cf/cloudflare/clef',
  'clef-flash': '@cf/cloudflare/clef-flash',
};

// Gateway model ids for engines reachable through the Vercel AI Gateway.
const GATEWAY_MODEL_IDS = {
  'jev': 'typesafe-ai/jev',
  'laya': 'convaiinnovations/laya-free',
};

export function configuredEngine() {
  const requested = (process.env.DECISION_ENGINE || '').trim().toLowerCase();
  const hasCloudflare = Boolean(
    process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_AUTH_TOKEN
  );
  const hasGateway = Boolean(process.env.AI_GATEWAY_API_KEY);

  if (requested && ENGINES.includes(requested)) {
    if (CLEF_MODEL_IDS[requested] && hasCloudflare) return requested;
    if (GATEWAY_MODEL_IDS[requested] && hasGateway) return requested;
    if (requested === 'demo') return 'demo';
    // Requested engine lacks credentials — fall through to best available.
  }
  if (hasCloudflare) return 'clef-flash';
  if (hasGateway) return 'jev';
  return 'demo';
}

export function engineStatus() {
  return {
    engine: configuredEngine(),
    cloudflare: Boolean(
      process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_AUTH_TOKEN
    ),
    gateway: Boolean(process.env.AI_GATEWAY_API_KEY),
    generation: Boolean(process.env.AI_GATEWAY_API_KEY),
  };
}

/**
 * Resolve a caller-requested engine to one that is actually usable.
 *
 * The engine is client-supplied, so it must never select a backend whose
 * credentials are absent — otherwise a request would be sent to Cloudflare
 * with `Bearer undefined`, or bypass the demo fallback entirely. Unknown or
 * unprovisioned values fall back to the configured engine.
 */
function resolveEngine(requested) {
  const fallback = configuredEngine();
  if (!requested || typeof requested !== 'string') return fallback;

  const want = requested.trim().toLowerCase();
  if (!ENGINES.includes(want)) return fallback;

  const hasCloudflare = Boolean(
    process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_AUTH_TOKEN
  );
  const hasGateway = Boolean(process.env.AI_GATEWAY_API_KEY);

  if (CLEF_MODEL_IDS[want]) return hasCloudflare ? want : fallback;
  if (GATEWAY_MODEL_IDS[want]) return hasGateway ? want : fallback;
  if (want === 'demo') return 'demo';
  return fallback;
}

/**
 * Run a decision.
 * @param {{state: string|object, questions: Record<string, object>, images?: string[]}} req
 * @param {{engine?: string, signal?: AbortSignal}} [opts]
 * @returns {Promise<{engine: string, model: string, answers: Record<string, object>, usage: object, simulated: boolean}>}
 */
export async function decide(req, opts = {}) {
  const engine = resolveEngine(opts.engine);
  const started = Date.now();

  if (CLEF_MODEL_IDS[engine]) {
    const out = await callClef(engine, req, opts.signal);
    return { ...out, engine, latencyMs: Date.now() - started, simulated: false };
  }
  if (GATEWAY_MODEL_IDS[engine]) {
    const out = await callGateway(engine, req, opts.signal);
    return { ...out, engine, latencyMs: Date.now() - started, simulated: false };
  }
  const out = simulate(req);
  return { ...out, engine: 'demo', latencyMs: Date.now() - started, simulated: true };
}

// ── Clef via Cloudflare Workers AI REST ─────────────────────────────────────

async function callClef(engine, req, signal) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_AUTH_TOKEN;
  const url =
    `https://api.cloudflare.com/client/v4/accounts/${accountId}` +
    `/ai/run/${CLEF_MODEL_IDS[engine]}`;

  const body = {
    model: engine,
    state: req.state,
    questions: req.questions,
  };
  // Clef accepts embedded base64 images (max 4); remote URLs are rejected.
  if (req.images?.length) body.images = req.images.slice(0, 4);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errs = (json.errors || []).map((e) => e.message || e.code).join('; ');
    throw new Error(`Clef ${res.status}: ${errs || res.statusText}`);
  }

  // Workers AI wraps the payload in `result`.
  const payload = json.result ?? json;
  return {
    model: payload.model || engine,
    answers: payload.answers || {},
    usage: payload.usage || {},
  };
}

// ── Jev / Laya via the Vercel AI Gateway ────────────────────────────────────

async function callGateway(engine, req, signal) {
  // The AI SDK's evaluation API uses `boolean` where the REST protocol uses
  // `noul`; translate on the way in and back on the way out.
  const questions = {};
  for (const [id, q] of Object.entries(req.questions)) {
    questions[id] =
      q.type === 'noul'
        ? { type: 'boolean', instructions: q.instructions, criteria: q.criteria }
        : q;
  }

  const result = await experimental_evaluate({
    model: GATEWAY_MODEL_IDS[engine],
    state: req.state,
    questions,
    abortSignal: signal,
  });

  const answers = {};
  for (const [id, a] of Object.entries(result.answers || {})) {
    answers[id] =
      a.type === 'boolean'
        ? { type: 'noul', noul: a.probability }
        : a;
  }

  return {
    model: result.response?.modelId || GATEWAY_MODEL_IDS[engine],
    answers,
    usage: {
      input_tokens: result.usage?.inputTokens,
      output_tokens: result.usage?.outputTokens,
    },
  };
}

// ── Deterministic local simulator (demo mode) ───────────────────────────────
//
// Not random: the same input always yields the same answer, and keyword
// signals push results in a plausible direction so the demo is honest about
// being a demo without being nonsense.

const POSITIVE = /\b(amazing|love|great|excellent|good|best|wonderful|fantastic|perfect|happy|pleased|impressive|solid|elegant|fast|reliable|recommend|thanks|awesome|beautiful|clean|helpful|satisfied|delighted)\b/i;
const NEGATIVE = /\b(bad|terrible|awful|hate|worst|horrible|broken|fail(ed|ing|ure)?|error|bug|crash|slow|angry|frustrat(ed|ing)|disappoint|refund|cancel|outage|down|blocked|urgent|asap|immediately|offline|unavailable|cannot|can't|unable)\b/i;
const TOXIC = /\b(idiot|stupid|moron|kill|die|damn|hell|suck|trash|garbage|hate you|loser|pathetic|worthless)\b/i;
const FRAUD = /\b(unverified|suspicious|foreign|unusual|mismatch|charged ?back|dispute|stolen|different (country|city)|3am|midnight|large amount)\b/i;
const TECH = /\b(api|server|database|500|error|crash|deploy|config|timeout|stack|latency|bug|exception|endpoint|integration|system|service|services|down|offline|unavailable|broken|outage|login|access|technical|software|app|application)\b/i;
const BILLING = /\b(billing|invoice|charge|charged|payment|refund|subscription|plan|price|pricing|card|receipt|twice|overcharg)\b/i;
const SALES = /\b(upgrade|demo|trial|purchase|buy|enterprise|quote|sales|pricing plan)\b/i;

// Strong emotional markers push sentiment to the extreme end of a scale.
const INTENSE_POS = /\b(absolutely|exceptional|amazing|incredible|love|best|perfect|outstanding|brilliant|phenomenal)\b|!/i;
const INTENSE_NEG = /\b(absolutely|completely|totally|utterly)\b.*\b(hate|awful|terrible|horrible|worst|furious|disgusting)\b|\b(furious|disgusting|outrageous|unacceptable)\b|!{2,}/i;

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

// ── Entity detectors ────────────────────────────────────────────────────────
// Heuristic NER for demo mode. Deliberately conservative: capitalised
// multi-word runs and well-known suffixes, not a guess per token.

const MONEY_RE = /(\$\s?\d[\d,]*(?:\.\d{1,2})?)|(\b\d[\d,]*(?:\.\d{1,2})?\s?(?:usd|eur|gbp|dollars?|euros?|pounds?|cents?|m\b|k\b))|\b\d[\d,]*(?:\.\d{1,2})?\s?(?:million|billion|thousand)/i;
const DATE_RE = /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})|(\d{4}-\d{2}-\d{2})|((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}?)|(\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b)|(\b(?:today|tomorrow|yesterday|tonight)\b)|(\b(?:next|last|this)\s+(?:week|month|year|quarter|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b)|(\b\d{1,2}(?:st|nd|rd|th)\b)|(\b(?:q[1-4]|h[12])\s?\d{0,4}\b)|(\b\d{1,2}(?::\d{2})?\s?(?:am|pm)\b)|(\b\d{4}\b)/i;
const ORG_SUFFIX = /\b(inc|llc|ltd|co|corp|corporation|company|gmbh|ag|sa|plc|group|holdings|foundation|institute|university|college|bank|airlines|labs?|technologies|tech|systems|software|media|studios|industries|enterprises|partners|associates|consulting|agency|solutions|networks|dynamics)\b\.?/i;
const KNOWN_ORGS = /\b(google|microsoft|apple|amazon|meta|facebook|netflix|tesla|nvidia|openai|anthropic|cloudflare|vercel|stripe|shopify|ibm|oracle|salesforce|adobe|intel|amd|samsung|toyota|nike|coca.?cola|pepsi|disney|sony|uber|airbnb|twitter|linkedin|github|gitlab|atlassian|slack|zoom|dropbox|spotify|reddit|wikipedia|mozilla|linux|united nations|world bank|federal reserve|nasa|esa|fbi|cia|nhs|eu|un|nato)\b/i;
const LOCATION_WORDS = /\b(city|town|country|state|street|road|avenue|district|region|province|county|island|mountain|river|lake|park|airport|station|office|headquarters|hq|branch)\b/i;
const KNOWN_PLACES = /\b(new york|san francisco|los angeles|seattle|chicago|boston|austin|denver|miami|london|paris|berlin|madrid|rome|amsterdam|tokyo|beijing|shanghai|sydney|toronto|vancouver|dublin|zurich|singapore|dubai|mumbai|delhi|bangalore|mountain view|palo alto|sunnyvale|cupertino|redmond|menlo park|california|texas|florida|washington|virginia|oregon|colorado|georgia|europe|asia|africa|america|usa|us\b|uk\b|canada|australia|india|china|japan|germany|france|spain|italy|brazil|mexico)\b/i;
const PRODUCT_WORDS = /\b(product|platform|service|software|app|application|api|sdk|tool|system|engine|model|database|framework|library|package|version|release|feature|cloud|ai|ml|machine learning|kubernetes|docker|react|node|python|javascript|typescript|gpt|claude|gemini|llama|jev|clef)\b/i;
// A person is a capitalised 2-3 word run that is not an org or a place.
const PERSON_RE = /\b([A-Z][a-z]{1,15}(?:\s+[A-Z][a-z]{1,15}){1,2})\b/g;

// ── Harm-category detectors ─────────────────────────────────────────────────
// Generic toxicity must NOT make every harm category fire. "You are an idiot"
// is harassment, not sexual content or self-harm. Each category needs its own
// signal, otherwise moderation returns all-flags-high and is useless for
// telling a reviewer *why* something was flagged.

const HARM_DETECTORS = {
  harassment: /\b(idiot|stupid|moron|loser|pathetic|worthless|ugly|fat|shut up|suck|trash|garbage|hate you|kill yourself|nobody (likes|loves) you|you('| a)re (a |an )?\w+)\b/i,
  hate: /\b(racist|nazi|slur|inferior|subhuman|ethnic|religion|gay|trans|immigrant|refugee|jewish|muslim|black people|white people|all (men|women|jews|muslims))\b/i,
  sexual: /\b(sex|sexual|nude|naked|porn|xxx|erotic|nsfw|onlyfans|hookup|nudes|dick|pussy|breasts|genital)\b/i,
  violence: /\b(kill|murder|shoot|stab|bomb|attack|beat (him|her|them)|assault|weapon|gun|knife|terror|massacre|slit|strangle)\b/i,
  self_harm: /\b(suicide|kill myself|self.?harm|cut myself|cutting|end my life|want to die|overdose|hang myself)\b/i,
  pii: /\b(ssn|social security|\b\d{3}-\d{2}-\d{4}\b|passport|driver'?s? license|\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.\w+\b|\b\d{16}\b|credit card number|home address|date of birth|\bdob\b)\b/i,
  spam: /\b(click here|act now|limited time|free money|winner|congratulations|you have been selected|viagra|casino|lottery|wire transfer|bitcoin|double your|guaranteed|no obligation|unsubscribe|buy now|discount code|earn \$|work from home)\b/i,
};

/** True when a specific harm category has a real signal in the text. */
function detectHarm(category, text) {
  const re = HARM_DETECTORS[category];
  return re ? re.test(text) : false;
}

function detectEntities(text) {
  const hasMoney = MONEY_RE.test(text);
  const hasDate = DATE_RE.test(text);
  const hasOrg = ORG_SUFFIX.test(text) || KNOWN_ORGS.test(text);
  const hasLocation = KNOWN_PLACES.test(text) || LOCATION_WORDS.test(text);

  // Person: capitalised runs, minus ones that are actually orgs/places.
  let hasPerson = false;
  const candidates = text.match(PERSON_RE) || [];
  for (const c of candidates) {
    if (KNOWN_ORGS.test(c) || ORG_SUFFIX.test(c) || KNOWN_PLACES.test(c)) continue;
    // Skip sentence-initial single words and known product names.
    if (PRODUCT_WORDS.test(c)) continue;
    const words = c.split(/\s+/);
    if (words.length >= 2) {
      hasPerson = true;
      break;
    }
  }
  // Titles strongly imply a person even if the name is formatted oddly.
  if (/\b(ceo|cto|cfo|coo|president|director|manager|founder|engineer|dr\.|mr\.|mrs\.|ms\.|professor|prof\.)\b/i.test(text)) {
    hasPerson = true;
  }

  const hasProduct = PRODUCT_WORDS.test(text);
  return { hasPerson, hasOrg, hasLocation, hasMoney, hasDate, hasProduct };
}

function stateText(state) {
  return typeof state === 'string' ? state : JSON.stringify(state);
}

const STOPWORDS = new Set([
  'the','a','an','and','or','but','is','are','was','were','be','been','to','of','in','on','for',
  'with','at','by','from','this','that','it','its','as','i','we','you','they','he','she','my',
  'our','your','their','have','has','had','do','does','did','not','no','yes','can','could',
  'will','would','should','about','into','over','after','before','than','then','so','if',
]);

/** Lowercase word tokens, stopwords and very short words removed. */
function tokenize(text) {
  const words = String(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  return new Set(words);
}

/** How many state tokens appear in an option's label/description text. */
function countOverlap(stateTokens, optText) {
  let n = 0;
  for (const t of stateTokens) {
    // Word-boundary match so "it" doesn't hit "critical".
    if (new RegExp(`(^|[^a-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(optText)) n++;
  }
  return n;
}

function clamp01(n) {
  return Math.min(1, Math.max(0, n));
}

/** Distribute `weight` across keys, normalised to sum to 1. */
function distribute(weights) {
  const keys = Object.keys(weights);
  const total = keys.reduce((s, k) => s + weights[k], 0) || 1;
  const out = {};
  for (const k of keys) out[k] = Math.round((weights[k] / total) * 10000) / 10000;
  return out;
}

function simulate(req) {
  const text = stateText(req.state);
  const base = hash(text);
  const pos = POSITIVE.test(text);
  const neg = NEGATIVE.test(text);
  const toxic = TOXIC.test(text);
  const fraud = FRAUD.test(text);
  const tech = TECH.test(text);
  const billing = BILLING.test(text);
  const sales = SALES.test(text);

  const answers = {};
  for (const [id, q] of Object.entries(req.questions)) {
    const seed = hash(id + '|' + text);
    const instr = typeof q.instructions === 'string' ? q.instructions : JSON.stringify(q.instructions ?? '');
    const hay = (id + ' ' + instr).toLowerCase();

    if (q.type === 'noul' || q.type === 'boolean') {
      // Entity-presence questions use the heuristic detectors, not sentiment.
      const ent = detectEntities(text);
      const entMap = {
        has_person: ent.hasPerson, has_org: ent.hasOrg, has_organization: ent.hasOrg,
        has_location: ent.hasLocation, has_place: ent.hasLocation, has_money: ent.hasMoney,
        has_date: ent.hasDate, has_time: ent.hasDate, has_product: ent.hasProduct,
      };
      if (id in entMap) {
        const present = entMap[id];
        answers[id] = { type: 'noul', noul: present ? 0.9 + seed * 0.09 : 0.03 + seed * 0.1 };
        continue;
      }

      // Harm categories each use their OWN detector. Without this, generic
      // toxicity makes sexual/self_harm/pii all fire high, which defeats the
      // point of per-category moderation flags.
      const harmKey = id.replace(/^(has_|is_|contains_)/, '');
      if (harmKey in HARM_DETECTORS) {
        const present = detectHarm(harmKey, text);
        answers[id] = {
          type: 'noul',
          noul: Math.round(clamp01(present ? 0.82 + seed * 0.16 : 0.03 + seed * 0.12) * 10000) / 10000,
        };
        continue;
      }

      // Question framing is detected from the QUESTION ONLY. Mixing the state
      // in here makes "Is this toxic?" over text containing "professional"
      // read as a positive-framed question.
      const qText = (id + ' ' + instr).toLowerCase();
      let p = 0.5 + (seed - 0.5) * 0.2;

      const asksPositive =
        /\bsafe\b|publishable|legit|valid|accurate|approve|professional|legible|benign|self.?serve|\bcorrect\b|should this be approved/.test(qText);
      const asksNegative =
        /toxic|urgent|urgency|fraud|risk|violation|harmful|spam|abusive|escalat|outage|block|severe|threat|malicious|churn|angry|\bpage\b|immediate|critical|abnormal|mismatch|harass|hate|obscene|identity|velocity|chargeback|device|sexual|adult|self.?harm|\bpii\b|personal information|profanity|violence|glorif|private personal|deceptive|scam|insult/.test(qText);

      const stateNegative = neg || toxic || fraud;
      if (asksPositive && !asksNegative) {
        p = stateNegative ? 0.1 + seed * 0.16 : 0.82 + seed * 0.15;
      } else if (asksNegative && !asksPositive) {
        p = stateNegative ? 0.78 + seed * 0.18 : 0.08 + seed * 0.15;
      } else if (asksPositive && asksNegative) {
        // e.g. "Should this be approved automatically?" — invert on risk.
        p = stateNegative ? 0.12 + seed * 0.16 : 0.85 + seed * 0.12;
      }
      answers[id] = { type: 'noul', noul: Math.round(clamp01(p) * 10000) / 10000 };
      continue;
    }

    if (q.type === 'choice') {
      const options = Object.keys(q.criteria || {});
      if (!options.length) {
        answers[id] = { type: 'choice', choice: 'unknown', probabilities: {}, confidence: 0 };
        continue;
      }
      const stateTokens = tokenize(text);
      const weights = {};
      for (const o of options) {
        const desc = q.criteria[o];
        const descText = typeof desc === 'string' ? desc : JSON.stringify(desc ?? '');
        const ol = o.toLowerCase();
        const optText = (ol + ' ' + descText).toLowerCase();

        // Small base so signal dominates; deterministic per option+state.
        let w = 0.08 + hash(o + '|' + text) * 0.12;

        // Term overlap between the state and this option's label/description.
        // This is what makes "system is down" pick `technical: bugs, outages`.
        const overlap = countOverlap(stateTokens, optText);
        w += overlap * 0.55;

        // Category affinity: does a detected state category name this option?
        // Tech outranks billing when both fire, so "system down" routes to
        // engineering rather than to whatever mentions "access".
        if (tech && /(technical|engineering|support|bug|outage|error|it\b|dev|infra|on.?call)/.test(optText)) w += 1.6;
        if (billing && !tech && /(billing|finance|payment|invoice|refund|subscription|charge)/.test(optText)) w += 1.4;
        if (billing && tech && /(billing|finance|payment|invoice|refund|subscription|charge)/.test(optText)) w += 0.5;
        if (sales && !tech && !billing && /(sales|upgrade|demo|trial|quote|purchase)/.test(optText)) w += 1.2;
        if (toxic && /(toxic|abusive|violation|unsafe|harmful|block|severe|harass|hate)/.test(optText)) w += 1.3;
        if (fraud && /(fraud|risk|high|critical|block|chargeback|identity|velocity)/.test(optText)) w += 1.1;

        // Sentiment intensity: strong language selects the extreme option.
        const intensePos = INTENSE_POS.test(text);
        const intenseNeg = INTENSE_NEG.test(text);
        if (pos && intensePos && /(very_positive|delighted|enthusiastic|extreme|rave)/.test(optText)) w += 1.5;
        if (pos && !intensePos && /^positive$|\bsatisfied\b|\bfavourable\b/.test(ol) ) w += 1.0;
        if (pos && /(positive|happy|approve|safe|good|praise|delight)/.test(optText)) w += 0.9;
        if (neg && intenseNeg && /(very_negative|angry|hostile|furious|extreme)/.test(optText)) w += 1.5;
        if (neg && !intenseNeg && /^negative$|\bunhappy\b|\bcritical\b/.test(ol)) w += 1.0;
        if (neg && /(negative|reject|risk|complaint|critical|major|high|urgent)/.test(optText)) w += 0.9;
        // Negative but not hostile: prefer "frustrated"/"confused" over "angry".
        if (neg && !intenseNeg && !toxic) {
          if (/frustrat|annoyed|confused|uncertain|needs guidance/.test(optText)) w += 0.9;
          if (/^angry$|hostile|demanding/.test(optText)) w -= 0.6;
        }
        if (toxic && /(angry|hostile|furious|demanding)/.test(optText)) w += 1.2;
        if (!pos && !neg && /(neutral|factual|no strong|plain|calm|composed)/.test(optText)) w += 1.1;

        // Support channel must agree with escalation: a dire outage cannot be
        // routed to self-serve docs.
        if (/channel|which channel|should handle it/.test(hay)) {
          const dire = neg && (/down|outage|completely|all users|multiple users|every|unable|500|error|crash|blocked/.test(text) || intenseNeg);
          if (dire) {
            if (/on.?call|page an engineer|phone|real.?time conversation|live agent|chat/.test(optText)) w += 1.5;
            if (/self.?serve|docs or a bot|asynchronous|non.?urgent/.test(optText)) w -= 1.0;
          } else if (!neg) {
            if (/self.?serve|docs or a bot|asynchronous|email/.test(optText)) w += 1.0;
            if (/on.?call|page an engineer/.test(optText)) w -= 1.0;
          }
        }

        // Severity/urgency scales: escalate the level when the state is dire.
        if (/sever|urgen|priorit|impact|escalat|\bsla\b|response/.test(hay)) {
          const dire = neg && (/down|outage|completely|all|multiple|every|unable/.test(text) || intenseNeg);
          if (dire && /(critical|catastrophic|severe|extreme|drop everything|p0|right now|all|severe|one hour|\b1h\b|immediate)/.test(optText)) w += 1.8;
          if (dire && /(three business|3d|backlog|whenever|cosmetic)/.test(optText)) w -= 0.7;
          if (!dire && pos && /(cosmetic|minor|whenever|low|none|backlog|three business|3d|1d)/.test(optText)) w += 0.8;
        }

        // Risk/fraud axes: without this, "verified card, familiar store" has no
        // term overlap with any tier and the answer is arbitrary. Tilt toward
        // the low end unless the state actually carries risk signals.
        if (/risk|fraud|threat|toxic|suspicious/.test(hay)) {
          const risky = fraud || toxic || neg;
          const isLowEnd = /\blow\b|approve|normal|consistent|clean|none|no concern|benign|unlikely|step.?down|minimal/.test(optText);
          const isHighEnd = /\bcritical\b|\bhigh\b|block|severe|near.?certain|certain fraud|very likely|hold for|manual review|catastrophic/.test(optText);
          if (risky) {
            if (isHighEnd) w += 1.7;
            if (isLowEnd) w -= 0.5;
          } else {
            if (isLowEnd) w += 1.7;
            if (isHighEnd) w -= 0.5;
          }
        }

        // Moderation/policy axes: "What action should be taken?" over benign
        // text has no term overlap with any option, so without this tilt the
        // answer is decided by hash luck.
        if (/moderation|policy|violation|action should be taken|moderate/.test(hay)) {
          // Toxicity drives blocking; mere negativity drives review.
          const unsafe = toxic;
          const merelyNegative = !toxic && neg;
          const isLenient = /approve|no policy concern|allow|pass|benign|no concern/.test(optText);
          const isReview = /borderline|human should look|review|flag for/.test(optText);
          const isStrict = /block|clear policy violation|remove|reject|escalate/.test(optText);
          if (unsafe) {
            if (isStrict) w += 1.8;
            if (isLenient) w -= 0.6;
          } else if (merelyNegative) {
            if (isReview) w += 1.5;
            if (isLenient) w += 0.3;
            if (isStrict) w -= 0.5;
          } else {
            if (isLenient) w += 1.8;
            if (isStrict) w -= 0.6;
          }
        }

        // Entity dominance: agree with the boolean detectors rather than
        // picking a class the text does not contain. Score each option once
        // (max boost, not per-key) so "location / a place" is not double-counted.
        if (/dominant|entity class|primary entity/.test(hay)) {
          const ent = detectEntities(text);
          const boosts = [
            [ent.hasPerson, /person|individual|named/],
            [ent.hasOrg, /organisation|organization|company|institution/],
            [ent.hasLocation, /location|place/],
            [ent.hasProduct, /product|technology/],
          ];
          let best = 0;
          for (const [present, re] of boosts) {
            if (present && re.test(optText)) best = Math.max(best, 2.0);
          }
          const anyFound = ent.hasPerson || ent.hasOrg || ent.hasLocation || ent.hasProduct;
          if (!anyFound && /^none\b|no clear/.test(optText)) best = Math.max(best, 2.0);
          w += best;
        }

        // Accuracy verdict must agree with the accurate/supported booleans:
        // an accurate statement cannot come back as "reject".
        if (/verdict|overall|should a human reviewer trust|rely on/.test(hay)) {
          const looksTrue = !neg && !toxic && /\b(is|are|was|were|subset|part of|consists|means|refers|defined|used to|can be)\b/i.test(text);
          const isAccept = /accept|accurate and well|safe to rely|correct/.test(optText);
          const isReject = /reject|incorrect|misleading/.test(optText);
          const isQualify = /qualify|broadly right|imprecise|missing conditions/.test(optText);
          if (looksTrue) {
            if (isAccept) w += 1.9;
            if (isQualify) w += 0.5;
            if (isReject) w -= 0.9;
          } else if (neg || toxic) {
            if (isReject) w += 1.6;
            if (isAccept) w -= 0.8;
          }
        }

        weights[o] = Math.max(0.01, w);
      }
      const probs = distribute(weights);
      const choice = Object.keys(probs).reduce((a, b) => (probs[a] >= probs[b] ? a : b));
      const sorted = Object.values(probs).sort((a, b) => b - a);
      answers[id] = {
        type: 'choice',
        choice,
        probabilities: probs,
        confidence: Math.round((sorted[0] - (sorted[1] ?? 0)) * 10000) / 10000,
      };
      continue;
    }

    if (q.type === 'score') {
      const levels = q.criteria || [];
      const n = Array.isArray(levels) ? levels.length : 0;
      if (n < 2) {
        answers[id] = { type: 'score', score: 0, legend: {}, probabilities: {}, confidence: 0 };
        continue;
      }
      // Higher-index levels mean "more of the axis being measured". Pick the
      // tilt from the QUESTION's axis so the score agrees with the noul/choice
      // answers for the same state (no "toxic=NO but level=Abusive").
      const intensePos = INTENSE_POS.test(text);
      const intenseNeg = INTENSE_NEG.test(text);
      const dire = neg && (/down|outage|completely|all|multiple|every|unable|blocked/.test(text) || intenseNeg);

      let tilt;
      if (/toxic|abusive|obscene|harass|harmful|profan|insult/.test(hay)) {
        tilt = toxic ? 0.85 : neg ? 0.45 : 0.08;
      } else if (/fraud|risk|suspicious|likely.*(fraud|chargeback)|chargeback/.test(hay)) {
        tilt = fraud ? 0.85 : neg ? 0.5 : 0.1;
      } else if (/sever|urgen|priorit|impact|escalat|how many customers|affected/.test(hay)) {
        tilt = dire ? 0.9 : neg ? 0.6 : pos ? 0.15 : 0.3;
      } else if (/sentiment|positive|satisf|intensity|emotion|how intense/.test(hay)) {
        tilt = pos ? (intensePos ? 0.9 : 0.7) : neg ? (intenseNeg ? 0.85 : 0.3) : 0.4;
      } else if (/trust|confidence|reliab|accura/.test(hay)) {
        tilt = neg || toxic ? 0.2 : 0.75;
      } else {
        tilt = 0.35 + base * 0.3; // neutral default, deterministic
      }

      const weights = {};
      for (let i = 0; i < n; i++) {
        const dist = Math.abs(i / (n - 1) - tilt);
        weights[String(i)] = Math.exp(-3.6 * dist) + 0.02;
      }
      const probs = distribute(weights);
      const score =
        Object.entries(probs).reduce((s, [k, v]) => s + Number(k) * v, 0);
      answers[id] = {
        type: 'score',
        score: Math.round(score * 10000) / 10000,
        legend: Object.fromEntries(
          (Array.isArray(levels) ? levels : []).map((l, i) => [
            String(i),
            typeof l === 'string' ? l : JSON.stringify(l ?? ''),
          ])
        ),
        probabilities: probs,
        confidence: Math.round(Math.max(...Object.values(probs)) * 10000) / 10000,
      };
      continue;
    }

    answers[id] = { type: q.type, unsupported: true };
  }

  return { model: 'demo-simulator', answers, usage: { input_tokens: text.length, output_tokens: 0 } };
}

// ── Answer helpers shared by the API layer ──────────────────────────────────

/** Best label + confidence for any answer type. */
export function summariseAnswer(answer, question) {
  if (!answer) return { label: '—', confidence: 0 };
  if (answer.type === 'noul' || answer.type === 'boolean') {
    const p = answer.noul ?? answer.probability ?? 0;
    return { label: p >= 0.5 ? 'YES' : 'NO', confidence: Math.abs(p - 0.5) * 2, raw: p };
  }
  if (answer.type === 'choice') {
    return {
      label: answer.choice,
      confidence: answer.confidence ?? (answer.probabilities?.[answer.choice] ?? 0),
      raw: answer.probabilities?.[answer.choice] ?? 0,
    };
  }
  if (answer.type === 'score') {
    const legend = answer.legend || {};
    const idx = Math.round(answer.score ?? 0);
    return {
      label: legend[String(idx)] ?? `Level ${idx}`,
      confidence: answer.confidence ?? 0,
      raw: answer.score ?? 0,
      index: idx,
      levels: Object.keys(legend).length,
    };
  }
  return { label: '—', confidence: 0 };
}
