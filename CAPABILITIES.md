# Capabilities — Epic Jev

Twelve capabilities. Ten run on a **decision model** (Clef or Jev) and return
probability distributions. Two need free-form text and run on a **generation
LLM**, because decision models cannot generate prose at all.

Every schema below is the actual typed-question schema the app sends. Nothing
here is aspirational — it is dumped from `lib/schemas.js`.

- [How decision answers work](#how-decision-answers-work)
- [Core Tasks](#core-tasks)
- [Content Analysis](#content-analysis)
- [Safety & Compliance](#safety--compliance)
- [Routing & Operations](#routing--operations)
- [App Builder](#app-builder)
- [Demo mode](#demo-mode)
- [Choosing an engine](#choosing-an-engine)

---

## How decision answers work

A decision model takes a `state` (the text) and a map of typed `questions`, and
returns one answer per question **in a single forward pass**. There is no text
generation and no output parsing.

Three question types:

| Type | Returns | Example |
|------|---------|---------|
| `noul` | `P(true)` — a single probability | `0.901` → 90.1% likely yes |
| `choice` | The top option + the full distribution | `{block: 0.95, review: 0.04, approve: 0.01}` |
| `score` | A probability-weighted position on an ordered scale | `3.03` of `0–4` |

`noul` is **P(true), not confidence in either outcome**. `0.9` means "likely
yes"; `0.1` means "likely no" — both are high-confidence, in opposite
directions.

`score` can land **between** levels (`3.03`), because it is the weighted mean
of the distribution rather than a picked index. That is useful: `2.9` and `3.4`
both round to level 3, but `3.4` is the more confident call.

Every answer also carries `confidence`, so you can set your own threshold
instead of trusting a bare label:

```js
const { answers } = await decide('fraud', transactionText);

// Don't just read the label — act on the distribution
if (answers.approve.noul < 0.3 || answers.risk.choice === 'critical') {
  holdForReview();
} else if (answers.risk.confidence < 0.2) {
  stepUpVerification();   // model is unsure
} else {
  approve();
}
```

---

## Core Tasks

### 📋 Text Evaluation

Judge whether a statement is accurate and usable.

| Question | Type | Options / levels |
|----------|------|------------------|
| `accurate` | noul | Is this statement factually accurate? |
| `supported` | noul | Is the claim specific enough to be verified? |
| `verdict` | choice | `accept` · `qualify` · `reject` |
| `confidence` | score | Do not use < Needs review < Usable < High trust |

```bash
curl -X POST localhost:3000/api/decide -H 'Content-Type: application/json' \
  -d '{"capability":"evaluation","text":"Machine learning is a subset of artificial intelligence."}'
```

**Use for:** fact-checking pipelines, claim validation, gating whether
generated content is safe to publish.

---

### 🏷️ Classification

Categorise text by topic and register.

| Question | Type | Options / levels |
|----------|------|------------------|
| `topic` | choice | `technical` · `business` · `support` · `security` · `general` |
| `register` | choice | `formal` · `neutral` · `casual` · `emotional` |
| `actionable` | noul | Does this require someone to take an action? |

**Use for:** inbox triage, tagging, routing content to the right pipeline.

---

### 📝 Summarization

*Generation capability — runs on a text LLM, not a decision model.*

Compresses text to a one-sentence TL;DR plus 3–5 key points.

```bash
curl -X POST localhost:3000/api/generate -H 'Content-Type: application/json' \
  -d '{"capability":"summarization","text":"Long article..."}'
```

Returns `{ text }` — prose, not probabilities.

**Use for:** document digests, meeting notes, TL;DR generation.

---

### 🔍 Data Extraction

*Generation capability — runs on a text LLM.*

Pulls structured fields out of unstructured text. Returns **JSON**:

```json
{
  "entities": [{ "name": "Google", "type": "ORGANIZATION" }],
  "key_points": ["…"],
  "numbers": [49.99],
  "topics": ["cloud computing"]
}
```

The response includes both `text` (raw) and `json` (parsed, or `null` if the
model returned something unparseable).

**Use for:** invoice parsing, CRM enrichment, document intelligence.

> **Why not a decision model?** Extraction produces open-ended values — an
> arbitrary entity name, an arbitrary key point. Decision models score a
> **fixed, known set of options**, so they can classify *"is there a person
> mentioned?"* (see Entity Recognition) but cannot emit *"Sundar Pichai"*.

---

## Content Analysis

### 😊 Sentiment Analysis

| Question | Type | Options / levels |
|----------|------|------------------|
| `polarity` | choice | `very_positive` · `positive` · `neutral` · `negative` · `very_negative` |
| `intensity` | score | Flat < Mild < Moderate < Strong < Extreme |
| `churn_risk` | noul | Is this author at risk of leaving? |
| `needs_reply` | noul | Should a human respond? |

**Use for:** review monitoring, brand health, escalation triggers. `churn_risk`
and `needs_reply` are the operationally useful ones — polarity alone rarely
tells you what to *do*.

---

### 🎯 Intent Detection

| Question | Type | Options / levels |
|----------|------|------------------|
| `intent` | choice | `get_support` · `ask_question` · `purchase` · `complain` · `cancel` · `small_talk` |
| `emotion` | choice | `calm` · `confused` · `frustrated` · `angry` · `happy` |
| `self_serve` | noul | Could a bot or help article resolve this? |
| `urgency` | score | Whenever < This week < Today < Right now |

**Use for:** chatbot routing, deflection (via `self_serve`), queue prioritisation.

Clef scores **97.4 macro-F1** on CLINC150+OOS and **94.2** on BANKING77 —
intent classification is exactly what decision models are best at.

---

### 🏢 Entity Recognition

| Question | Type | Options / levels |
|----------|------|------------------|
| `has_person` | noul | Mentions a specific person? |
| `has_org` | noul | Mentions an organisation? |
| `has_location` | noul | Mentions a place? |
| `has_money` | noul | Mentions a monetary amount? |
| `has_date` | noul | Mentions a date or time period? |
| `has_product` | noul | Mentions a product/service/technology? |
| `dominant` | choice | `person` · `organisation` · `location` · `product` · `none` |

**Use for:** filtering, PII detection, deciding whether a document is
person-centric or org-centric.

> **Detection, not extraction.** This tells you *whether* entities are present
> and *which class dominates* — not their names. For named values, use
> [Data Extraction](#-data-extraction).

---

## Safety & Compliance

### 🚫 Content Moderation

| Question | Type | Options / levels |
|----------|------|------------------|
| `verdict` | choice | `approve` · `review` · `block` |
| `harassment` | noul | Harasses, bullies, or threatens a person? |
| `hate` | noul | Hate toward a protected group? |
| `sexual` | noul | Sexual or adult content? |
| `violence` | noul | Promotes or glorifies violence? |
| `self_harm` | noul | Encourages self-harm? |
| `pii` | noul | Exposes private personal information? |
| `spam` | noul | Spam, scam, or deceptive promotion? |

**Use for:** UGC pipelines, comment filtering, trust & safety queues.

The per-category `noul` scores matter more than `verdict` in practice — they
tell you *why* something was flagged, which is what a human reviewer needs.

```bash
curl -X POST localhost:3000/api/decide -H 'Content-Type: application/json' \
  -d '{"capability":"moderation","text":"You are a pathetic idiot and this garbage should be banned."}'
```

```json
{
  "verdict":    { "choice": "block", "confidence": 0.915 },
  "harassment": { "noul": 0.932 },
  "hate":       { "noul": 0.146 },
  "sexual":     { "noul": 0.136 },
  "violence":   { "noul": 0.070 },
  "self_harm":  { "noul": 0.143 },
  "pii":        { "noul": 0.048 },
  "spam":       { "noul": 0.054 }
}
```

Note how only `harassment` fires. Generic toxicity does **not** drag every
category up with it — each has its own detector, so the flags tell a reviewer
*why* something was blocked rather than lighting up the whole board.

---

### ☢️ Toxicity Detection

| Question | Type | Options / levels |
|----------|------|------------------|
| `toxic` | noul | Is this text toxic? |
| `level` | score | Clean < Mild < Harsh < Abusive < Severe |
| `severe` | noul | Contains a severe insult or threat? |
| `targeted` | noul | Aimed at a specific person or group? |
| `obscene` | noul | Contains profanity? |
| `publishable` | noul | Safe to publish without edits? |

**Use for:** comment scoring, abuse prevention, deciding between delete /
edit / allow.

`targeted` is the distinction that matters most: toxicity aimed at a person is
a different policy problem from general profanity.

---

### 🔐 Fraud Detection

| Question | Type | Options / levels |
|----------|------|------------------|
| `risk` | choice | `low` · `medium` · `high` · `critical` |
| `score` | score | Very unlikely < Unlikely < Possible < Likely < Very likely |
| `device_mismatch` | noul | Device or location unusual for this account? |
| `velocity` | noul | Purchase velocity abnormal? |
| `identity` | noul | Identity or verification concerns? |
| `chargeback` | noul | Chargeback or dispute likely? |
| `approve` | noul | Should this be approved automatically? |

**Use for:** transaction screening, step-up authentication triggers, manual
review queues.

The individual signal flags are what make this auditable — you can tell a
reviewer *which* signals fired rather than handing them an opaque score.

---

## Routing & Operations

### 📍 Smart Routing

| Question | Type | Options / levels |
|----------|------|------------------|
| `team` | choice | `technical_support` · `billing` · `sales` · `security` · `success` |
| `channel` | choice | `self_serve` · `email` · `chat` · `phone` · `on_call` |
| `escalate` | noul | Should this be escalated above the first responder? |
| `customer_impact` | score | None < One < A few < Many < All |

**Use for:** support triage, ticket assignment, on-call routing.

`channel` and `customer_impact` together tell you both *how* to respond and
*how fast*.

---

### ⚠️ Priority Scoring

| Question | Type | Options / levels |
|----------|------|------------------|
| `severity` | score | Cosmetic < Minor < Major < Critical < Catastrophic |
| `priority` | choice | `p3` (Backlog) · `p2` (Normal) · `p1` (Urgent) · `p0` (Drop everything) |
| `sla` | choice | `1h` · `4h` · `1d` · `3d` |
| `page` | noul | Should this page an on-call engineer immediately? |
| `revenue_impact` | noul | Is revenue actively being lost? |

**Use for:** incident triage, SLA management, queue prioritisation.

```bash
curl -X POST localhost:3000/api/decide -H 'Content-Type: application/json' \
  -d '{"capability":"priority","text":"Multiple users report the system is completely down."}'
```

```json
{
  "severity":       { "score": 3.03, "label": "Critical" },
  "priority":       { "choice": "p0" },
  "sla":            { "choice": "1h" },
  "page":           { "noul": 0.801 },
  "revenue_impact": { "noul": 0.529 }
}
```

`page` at 0.80 on a total outage is the signal that should wake someone up.
`revenue_impact` at 0.53 is the model being honestly unsure — the text says
users are blocked but never mentions money, and a calibrated answer reflects
that instead of inventing confidence.

---

## App Builder

Not a capability in the same sense — it is a **pipeline** that uses both model
types.

**Step 1 — a decision model plans the app** (one forward pass):

| Question | Type | Options / levels |
|----------|------|------------------|
| `buildable` | noul | Can this be a self-contained static HTML file? |
| `app_type` | choice | `productivity` · `dashboard` · `game` · `form_tool` · `landing_page` · `creative` · `commerce` · `other` |
| `complexity` | score | Trivial < Simple < Moderate < Complex < Very complex |
| `needs_persistence` | noul | Does it need to remember data between visits? |
| `needs_backend` | noul | Does it need a server, database, API key, or accounts? |
| `risk` | choice | `none` · `low` · `medium` · `high` |
| `styling` | choice | `minimal` · `playful` · `professional` · `dark` |

**Step 2 — a code model writes the app**, conditioned on that plan.

The plan is not decorative. `needs_persistence` adds a localStorage
requirement (wrapped in try/catch, since sandboxed frames may block it).
`needs_backend` instructs the model to simulate the server with clearly-labelled
demo data rather than embedding credentials. `risk: high` blocks the build
before any code is generated.

See [SECURITY.md](SECURITY.md) for how the generated code is contained, and
[API_REFERENCE.md](API_REFERENCE.md#post-apibuilderbuild) for the streaming
protocol.

---

## Demo mode

With no credentials, decisions come from a **deterministic local simulator** in
`lib/decision.js`, and generated apps use a built-in working fallback.

The simulator is not random noise. It is keyword- and detector-driven, so it
produces internally consistent results:

| Input | Result |
|-------|--------|
| "system is completely down for all users" | `severity: Critical`, `page: YES`, `team: technical_support`, `sla: 1h` |
| "charged twice for my subscription, need a refund" | `team: billing`, `churn_risk: YES` |
| "You are a pathetic idiot, this garbage should be banned" | `verdict: block`, `toxic: YES`, `publishable: NO` |
| "professional business communication about project requirements" | `verdict: approve`, `toxic: NO`, all harm categories `NO` |
| "verified card, familiar store, home city" | `risk: low`, `approve: YES` |
| "unverified device, different country, 3am, prior dispute" | `risk: high`, `approve: NO` |

Same input always yields the same output. The UI labels every simulated result
`⚠ simulated` so a demo is never mistaken for a real model call.

Entity recognition in demo mode uses real heuristic detectors (capitalised
name runs, known org/place lists, money and date patterns) rather than guessing.

---

## Choosing an engine

| Engine | Median latency | Context | Vision | Notes |
|--------|---------------|---------|--------|-------|
| `clef-flash` | **38.8 ms** | 64K | ✅ | Fastest; best for hot paths |
| `clef` | 209 ms | 64K | ✅ | Highest accuracy; Cloudflare's 27B model |
| `jev` | 524 ms | 32K | ❌ | TypeSafe AI; strongest on pure reasoning |
| `laya` | ~6 ms | 8K | ❌ | Fastest overall, lower quality |
| `demo` | ~2 ms | — | — | Local simulator, no credentials |

Scores from the [Decision Index](https://clef-evals.workers-ai-mle.workers.dev),
on the benchmarks that map to these capabilities:

| Benchmark | Clef | Clef-flash | Jev | Epic Jev capability |
|-----------|------|-----------|-----|---------------------|
| CLINC150+OOS (macro-F1) | **97.4** | 66.8 | 89.3 | Intent Detection |
| BANKING77 (macro-F1) | **94.2** | 90.9 | 79.7 | Classification |
| FinEntity (macro-F1) | 96.2 | **97.1** | 87.0 | Entity Recognition |
| BPoMP (accuracy) | **96.9** | 95.4 | 90.6 | Content Moderation |
| ContractNLI (macro-F1) | 81.4 | **84.3** | 71.7 | Fraud Detection |
| GPQA Diamond (accuracy) | 48.0 | 51.0 | **78.3** | — (reasoning, not used here) |

**The takeaway:** for classification, intent, entity, moderation, and fraud —
which is most of this app — Clef beats Jev and is faster. Jev still wins on
open-ended reasoning (GPQA, MMLU-Pro, BBH), which none of these capabilities
require.

That is why `clef-flash` is the default when Cloudflare credentials are
present, and why the engine is swappable at runtime.

Set it explicitly with `DECISION_ENGINE`, or per-request with the `engine`
field on `/api/decide`. A requested engine whose credentials are missing is
ignored and falls back to the configured engine — it never makes an
unauthenticated call.
