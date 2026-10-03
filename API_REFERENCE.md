# API Reference — Epic Jev

Base URL: `https://epic-jev.vercel.app` (or `http://localhost:3000` locally)

All endpoints accept and return `application/json`, except
`/api/builder/build` which streams Server-Sent Events.

---

## Contents

- [Overview](#overview)
- [`GET /health`](#get-health)
- [`GET /api/status`](#get-apistatus)
- [`GET /api/capabilities`](#get-apicapabilities)
- [`POST /api/decide`](#post-apidecide)
- [`POST /api/generate`](#post-apigenerate)
- [`POST /api/builder/plan`](#post-apibuilderplan)
- [`POST /api/builder/build`](#post-apibuilderbuild)
- [Answer types](#answer-types)
- [Errors](#errors)
- [Rate limits](#rate-limits)
- [Deprecated endpoints](#deprecated-endpoints)

---

## Overview

Epic Jev exposes two kinds of AI work:

| Kind | Endpoint | Model | Returns |
|------|----------|-------|---------|
| **Decision** | `/api/decide` | Clef or Jev | Probabilities for every option |
| **Generation** | `/api/generate` | Text LLM | Free-form prose or JSON |
| **App build** | `/api/builder/*` | Both | A complete HTML app |

Decision models cannot generate text — they return a probability distribution
over a fixed set of allowed options in a single forward pass. That is why
summarization and extraction live on a separate endpoint.

---

## `GET /health`

Liveness probe.

```bash
curl https://epic-jev.vercel.app/health
```

```json
{ "status": "ok", "engine": "clef-flash" }
```

`engine` is the decision engine currently in use (`demo` when no credentials
are configured).

---

## `GET /api/status`

Reports configuration. **Never returns credential values** — only booleans.

```bash
curl https://epic-jev.vercel.app/api/status
```

```json
{
  "engine": "demo",
  "cloudflare": false,
  "gateway": false,
  "generation": false,
  "generationModel": null,
  "codeModel": null,
  "capabilities": ["evaluation", "classification", "sentiment", "intent",
                   "entity", "moderation", "toxicity", "fraud", "routing",
                   "priority", "summarization", "extraction"],
  "tabs": {
    "core": "Core Tasks",
    "content": "Content Analysis",
    "safety": "Safety & Compliance",
    "ops": "Routing & Operations",
    "builder": "App Builder"
  }
}
```

| Field | Meaning |
|-------|---------|
| `engine` | Active decision engine: `clef`, `clef-flash`, `jev`, `laya`, or `demo` |
| `cloudflare` | Whether Clef credentials are present |
| `gateway` | Whether an AI Gateway key is present |
| `generation` | Whether text generation is live (same as `gateway`) |
| `generationModel` | Text model id, or `null` in demo mode |
| `codeModel` | App Builder code model id, or `null` in demo mode |

---

## `GET /api/capabilities`

Lists every capability with its metadata. The UI builds itself from this.

```bash
curl https://epic-jev.vercel.app/api/capabilities
```

```json
[
  {
    "id": "priority",
    "label": "Priority Scoring",
    "icon": "⚠️",
    "tab": "ops",
    "engine": "decision",
    "blurb": "Severity, SLA target, and whether to page someone.",
    "example": "Multiple users report system is completely down..."
  }
]
```

`engine` is `decision` or `generation` and determines which endpoint to call.

---

## `POST /api/decide`

Runs a **decision** capability.

### Request

```json
{
  "capability": "priority",
  "text": "Multiple users report the system is completely down.",
  "engine": "clef-flash"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `capability` | string | yes | A `decision`-engine id from `/api/capabilities` |
| `text` | string | yes | The state to evaluate. Truncated to 8,000 chars |
| `engine` | string | no | Override the engine. Ignored if its credentials are absent |

### Response

```json
{
  "capability": "priority",
  "label": "Priority Scoring",
  "engine": "demo",
  "model": "demo-simulator",
  "simulated": true,
  "latencyMs": 8,
  "usage": { "input_tokens": 86, "output_tokens": 0 },
  "answers": {
    "severity": {
      "type": "score",
      "score": 3.03,
      "legend": {
        "0": "Cosmetic", "1": "Minor", "2": "Major",
        "3": "Critical", "4": "Catastrophic"
      },
      "probabilities": {
        "0": 0.02, "1": 0.04, "2": 0.11, "3": 0.44, "4": 0.39
      },
      "confidence": 0.44,
      "question": "How severe is this issue?",
      "label": "Critical",
      "index": 3,
      "levels": 5
    },
    "page": {
      "type": "noul",
      "noul": 0.901,
      "question": "Should this page an on-call engineer immediately?",
      "label": "YES",
      "confidence": 0.802
    }
  }
}
```

`simulated: true` means the answer came from the local demo simulator, not a
model. The UI surfaces this as `⚠ simulated` so a demo is never mistaken for a
real result.

### Example

```bash
curl -X POST https://epic-jev.vercel.app/api/decide \
  -H 'Content-Type: application/json' \
  -d '{
    "capability": "moderation",
    "text": "You are a pathetic idiot and this garbage should be banned."
  }'
```

```json
{
  "answers": {
    "verdict": {
      "type": "choice",
      "choice": "block",
      "probabilities": { "block": 0.952, "review": 0.045, "approve": 0.003 },
      "confidence": 0.908,
      "label": "block"
    },
    "harassment": { "type": "noul", "noul": 0.856, "label": "YES" }
  }
}
```

### JavaScript

```js
const res = await fetch('/api/decide', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    capability: 'fraud',
    text: 'Unverified device, different country, 3am, large amount.',
  }),
});
const { answers, simulated } = await res.json();

// Act on a probability rather than a bare label
if (answers.risk.choice === 'critical' || answers.approve.noul < 0.3) {
  holdForReview();
}
```

---

## `POST /api/generate`

Runs a **generation** capability (`summarization`, `extraction`).

### Request

```json
{ "capability": "summarization", "text": "…" }
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `capability` | string | yes | A `generation`-engine id |
| `text` | string | yes | Truncated to 8,000 chars |

### Response

```json
{
  "capability": "extraction",
  "label": "Data Extraction",
  "model": "openai/gpt-oss-20b",
  "simulated": false,
  "latencyMs": 840,
  "usage": { "inputTokens": 120, "outputTokens": 210, "totalTokens": 330 },
  "text": "{\"entities\":[…],\"key_points\":[…]}",
  "json": { "entities": [], "key_points": [], "numbers": [], "topics": [] }
}
```

`json` is present only for `extraction`, and is `null` if the model returned
unparseable output (the raw `text` is still provided).

### Example

```bash
curl -X POST https://epic-jev.vercel.app/api/generate \
  -H 'Content-Type: application/json' \
  -d '{"capability":"summarization","text":"Long article text here..."}'
```

---

## `POST /api/builder/plan`

Runs **only** the planning step — the decision-model pass that classifies the
request. Fast and cheap; useful for pre-flight checks.

### Request

```json
{ "description": "A pomodoro timer with a progress ring." }
```

`description` is truncated to 4,000 chars.

### Response

```json
{
  "plan": {
    "engine": "clef-flash",
    "latencyMs": 41,
    "simulated": false,
    "buildable": true,
    "appType": "form_tool",
    "appTypeProbs": {
      "form_tool": 0.62, "productivity": 0.21, "dashboard": 0.08,
      "game": 0.04, "landing_page": 0.02, "creative": 0.02,
      "commerce": 0.01, "other": 0.00
    },
    "complexity": "Moderate",
    "complexityScore": 2.1,
    "needsPersistence": false,
    "needsBackend": false,
    "risk": "none",
    "riskProbs": { "none": 0.94, "low": 0.05, "medium": 0.01, "high": 0.00 },
    "styling": "minimal",
    "blocked": false,
    "blockReason": null,
    "answers": { }
  }
}
```

When a request is blocked:

```json
{
  "plan": {
    "engine": "guard",
    "blocked": true,
    "blockReason": "abuse-pattern",
    "risk": "high",
    "buildable": false
  }
}
```

`blockReason` is `abuse-pattern` (hard blocklist, runs in every mode including
demo) or `model-risk` (the decision model scored risk as high).

---

## `POST /api/builder/build`

Plans **and** generates a complete app. Streams Server-Sent Events.

### Request

```json
{ "description": "A dark-themed habit tracker with a 7-day streak grid." }
```

### Event stream

```bash
curl -N -X POST https://epic-jev.vercel.app/api/builder/build \
  -H 'Content-Type: application/json' \
  -d '{"description":"A pomodoro timer with a progress ring."}'
```

```
event: plan
data: {"plan":{…}}

event: chunk
data: {"text":"<!DOCTYPE html>\n<html"}

event: chunk
data: {"text":" lang=\"en\">\n<head>"}

event: done
data: {"bytes":2372,"plan":{…}}

event: app
data: {"html":"<!DOCTYPE html>…</html>","bytes":2372}
```

| Event | Payload | Meaning |
|-------|---------|---------|
| `plan` | `{plan}` | Decision-model classification, sent first |
| `chunk` | `{text}` | Incremental generated code (raw model output) |
| `done` | `{bytes, plan}` | Generation finished |
| `app` | `{html, bytes}` | **Final sanitised app** — use this, not the chunks |
| `blocked` | `{message}` | Request rejected; no code was generated |
| `error` | `{message}` | Generation failed |

> **Important:** `chunk` events carry raw model output. The `app` event carries
> the **sanitised** HTML with the CSP injected — it is what the preview renders
> and what the download button saves. Always prefer `app`.

### Consuming the stream

```js
const res = await fetch('/api/builder/build', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ description: 'A snake game with levels' }),
});

const reader = res.body.getReader();
const decoder = new TextDecoder();
let buf = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buf += decoder.decode(value, { stream: true });

  const events = buf.split('\n\n');
  buf = events.pop();               // keep the incomplete tail

  for (const raw of events) {
    const type = raw.match(/^event: (.+)$/m)?.[1];
    const data = raw.match(/^data: ([\s\S]+)$/m)?.[1];
    if (!data) continue;
    const payload = JSON.parse(data);

    if (type === 'plan')    showPlan(payload.plan);
    if (type === 'chunk')   appendCode(payload.text);
    if (type === 'app')     previewInSandbox(payload.html);
    if (type === 'blocked') showBlocked(payload.message);
    if (type === 'error')   showError(payload.message);
  }
}
```

### Rendering the preview safely

The generated app must run in a sandboxed frame. **Do not omit
`allow-same-origin`'s absence** — adding it would let the generated code read
your app's cookies and storage.

```js
const frame = document.createElement('iframe');
frame.setAttribute(
  'sandbox',
  'allow-scripts allow-modals allow-popups-to-escape-sandbox'
);
frame.setAttribute('referrerpolicy', 'no-referrer');
frame.srcdoc = payload.html;   // already sanitised + CSP-injected server-side
document.body.appendChild(frame);
```

See [SECURITY.md](SECURITY.md) for the full containment model.

---

## Answer types

Every decision answer is one of three shapes, matching the System One protocol
that Clef and Jev both implement.

### `noul` — boolean

A yes/no probability.

```json
{ "type": "noul", "noul": 0.901 }
```

`noul` is **P(true)**, not confidence in either outcome. `0.901` means 90.1%
likely true; `0.099` means 90.1% likely false.

The API layer adds `label` (`"YES"`/`"NO"`) and `confidence`
(`|p − 0.5| × 2`, so 0.5 → 0% confident, 1.0 or 0.0 → 100%).

### `choice` — named options

```json
{
  "type": "choice",
  "choice": "block",
  "probabilities": { "block": 0.952, "review": 0.045, "approve": 0.003 },
  "confidence": 0.908
}
```

`choice` is the highest-probability option. `probabilities` sums to 1.0.
`confidence` is the margin between the top two options.

### `score` — ordered levels

```json
{
  "type": "score",
  "score": 3.03,
  "legend": { "0": "Cosmetic", "1": "Minor", "2": "Major",
              "3": "Critical", "4": "Catastrophic" },
  "probabilities": { "0": 0.02, "1": 0.04, "2": 0.11, "3": 0.44, "4": 0.39 },
  "confidence": 0.44
}
```

`score` is the **probability-weighted mean** of the level indices, so it can
land between levels (`3.03` sits just above Critical). `legend` maps index →
description. The API layer adds `index` (`round(score)`), `levels`, and `label`
(the legend entry at `index`).

---

## Errors

All errors return JSON with an `error` field.

| Status | Cause |
|--------|-------|
| `400` | Missing/empty `text` or `description`, unknown `capability`, wrong endpoint for the capability's engine |
| `403` | Cross-origin `POST` (the `Origin` header did not match `Host`) |
| `404` | Unknown route |
| `410` | Deprecated endpoint (see below) |
| `429` | Rate limit exceeded; a `Retry-After` header gives seconds |
| `500` | Upstream model failure or unexpected server error |

```json
{ "error": "Unknown capability: __proto__" }
```

Capability ids are resolved with an own-property check, so `__proto__`,
`constructor`, and `toString` are rejected rather than resolving to inherited
`Object` members.

---

## Rate limits

Per-IP token buckets, tiered by cost:

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/decide`, `/api/builder/plan` | 60 requests | 1 minute |
| `/api/generate` | 20 requests | 1 minute |
| `/api/builder/build` | 6 requests | 1 minute |

```json
{ "error": "Rate limit exceeded for build. Try again in 42s." }
```

> On serverless these buckets are **per container**, not global. Pair with
> platform-level rate limiting for production abuse control.

Other bounds: request bodies are capped at 1 MB; `text` at 8,000 chars;
`description` at 4,000 chars; generated apps at 200 KiB.

---

## Deprecated endpoints

| Endpoint | Status | Replacement |
|----------|--------|-------------|
| `POST /api/jev` | `410 Gone` | `/api/decide` or `/api/generate` |
| `GET /preview/:id` | `410 Gone` | Client-side `srcdoc` preview |
| `GET /api/builder/download/:id` | `410 Gone` | Client-side Blob download |

`/api/jev` was removed because it called `streamText()` against a decision
model. Decision models do not generate text, so that path could never have
worked — it is replaced by the two endpoints that match what the models
actually do.

The preview and download routes were removed because they stored generated apps
in server memory, which does not survive on serverless (the build request and
the preview request can land on different instances). Both are now handled
client-side from the `app` event.
