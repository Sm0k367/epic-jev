// Generation layer — free-form text via the Vercel AI Gateway.
//
// Decision models (Clef, Jev) return probabilities only; they cannot write
// prose. Summarisation, extraction, and app-code generation all run here.

import { generateText, streamText } from 'ai';

// A free agentic-coding model on the Gateway. Override with AI_GATEWAY_MODEL.
export const DEFAULT_CODE_MODEL = 'poolside/laguna-s-2.1-free';
// Cheap, fast, structured-output capable. Override with AI_GATEWAY_TEXT_MODEL.
export const DEFAULT_TEXT_MODEL = 'openai/gpt-oss-20b';

export function generationAvailable() {
  return Boolean(process.env.AI_GATEWAY_API_KEY);
}

export function textModel() {
  return process.env.AI_GATEWAY_TEXT_MODEL || DEFAULT_TEXT_MODEL;
}

export function codeModel() {
  return process.env.AI_GATEWAY_MODEL || DEFAULT_CODE_MODEL;
}

/**
 * Non-streaming generation. Returns { text, model, usage } or a simulated
 * result when no gateway key is configured.
 */
export async function generate({ prompt, system, json = false, maxTokens = 1200, model, signal }) {
  if (!generationAvailable()) {
    return { text: simulateGeneration(prompt, json), model: 'demo-simulator', usage: {}, simulated: true };
  }

  const result = await generateText({
    model: model || textModel(),
    system,
    prompt,
    temperature: json ? 0.1 : 0.4,
    maxTokens,
    abortSignal: signal,
  });

  let text = result.text ?? '';
  if (json) {
    // Models sometimes wrap JSON in prose or a fence — strip to the first object.
    const match = text.match(/\{[\s\S]*\}/);
    if (match) text = match[0];
  }
  return {
    text,
    model: result.response?.modelId || model || textModel(),
    usage: result.usage ? { ...result.usage } : {},
    simulated: false,
  };
}

/** Streaming generation — yields text chunks as they arrive. */
export async function* generateStream({ prompt, system, maxTokens = 4000, model, signal }) {
  if (!generationAvailable()) {
    const text = simulateGeneration(prompt, false);
    // Emit in small chunks so the demo still shows progressive rendering.
    for (let i = 0; i < text.length; i += 6) {
      yield text.slice(i, i + 6);
      await new Promise((r) => setTimeout(r, 12));
    }
    return;
  }

  const { textStream } = streamText({
    model: model || codeModel(),
    system,
    prompt,
    temperature: 0.3,
    maxTokens,
    abortSignal: signal,
  });

  for await (const chunk of textStream) yield chunk;
}

// ── Demo-mode fallback ──────────────────────────────────────────────────────

function simulateGeneration(prompt, json) {
  if (json) {
    return JSON.stringify(
      {
        entities: [
          { name: 'streaming', type: 'CONCEPT' },
          { name: 'tokens', type: 'CONCEPT' },
          { name: 'UI', type: 'TECHNOLOGY' },
        ],
        key_points: [
          'Tokens are delivered in real time.',
          'Progressive rendering makes interfaces feel responsive.',
        ],
        numbers: [],
        topics: ['streaming', 'user experience'],
        _note: 'DEMO MODE — connect AI_GATEWAY_API_KEY for real extraction.',
      },
      null,
      2
    );
  }

  if (/build this app|app builder|generate (?:a|an) (?:web )?app|single html file|<!DOCTYPE html>/i.test(prompt)) {
    return demoAppHtml(prompt);
  }

  return [
    '**TL;DR** (demo mode — no AI_GATEWAY_API_KEY configured)',
    '',
    'The text describes a system that streams model output incrementally so',
    'interfaces can render progressively instead of waiting for a full response.',
    '',
    '**Key points**',
    '- Output is delivered token by token in real time.',
    '- Progressive rendering keeps the UI responsive.',
    '- Latency to first visible output is what users perceive.',
    '',
    '_This is a simulated summary. Add `AI_GATEWAY_API_KEY` to run a real model._',
  ].join('\n');
}

/** A genuinely working fallback app so the builder demo is never empty. */
function demoAppHtml(prompt) {
  const idea =
    (prompt.match(/Build this app:\s*([^\n]{0,80})/i)?.[1] ||
      prompt.match(/(?:app|build)[:\s]+([^\n]{0,80})/i)?.[1] ||
      'My App')
      .replace(/[.!?]+$/, '')
      .trim();
  const title = (idea.replace(/[^\w\s-]/g, '').slice(0, 40) || 'My App').trim();
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh;display:grid;place-items:center;padding:24px}
  .card{background:#1e293b;border:1px solid #334155;border-radius:16px;padding:32px;max-width:480px;width:100%;text-align:center}
  h1{font-size:1.5rem;margin-bottom:8px}
  p{color:#94a3b8;margin-bottom:24px;font-size:.9rem}
  input{width:100%;padding:12px;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#e2e8f0;margin-bottom:12px}
  button{width:100%;padding:12px;border-radius:8px;border:0;background:#6366f1;color:#fff;font-weight:600;cursor:pointer}
  button:hover{background:#4f46e5}
  ul{list-style:none;margin-top:20px;text-align:left}
  li{padding:10px;border-bottom:1px solid #334155;display:flex;justify-content:space-between;align-items:center}
  .del{background:none;border:0;color:#f87171;cursor:pointer;font-size:1rem}
  .note{margin-top:20px;font-size:.75rem;color:#64748b}
</style>
</head>
<body>
<div class="card">
  <h1>${title}</h1>
  <p>Generated by Epic Jev App Builder &middot; demo mode</p>
  <input id="t" placeholder="Add an item&hellip;" autocomplete="off">
  <button onclick="add()">Add</button>
  <ul id="l"></ul>
  <p class="note">Add AI_GATEWAY_API_KEY to generate a real app from your description.</p>
</div>
<script>
  const items=[];
  function render(){
    document.getElementById('l').innerHTML=items.map((x,i)=>
      '<li><span>'+x.replace(/</g,'&lt;')+'</span><button class="del" onclick="del('+i+')">\\u00d7</button></li>').join('');
  }
  function add(){
    const el=document.getElementById('t');
    if(el.value.trim()){items.push(el.value.trim());el.value='';render();}
  }
  function del(i){items.splice(i,1);render();}
  document.getElementById('t').addEventListener('keydown',e=>{if(e.key==='Enter')add();});
</script>
</body>
</html>`;
}
