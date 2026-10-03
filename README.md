# 🚀 Epic Jev

**A decision engine + app builder.** Twelve AI capabilities that return
*probabilities instead of guesses*, plus an App Builder that turns a sentence
into a working, sandboxed web app.

Live: **https://epic-jev.vercel.app** · [Security model](SECURITY.md) · [API](API_REFERENCE.md) · [Capabilities](CAPABILITIES.md)

---

## What makes this different

Most "AI demo" apps pipe a prompt into a chat model and stream back prose.
Epic Jev uses **decision models** — [Clef](https://huggingface.co/Cloudflare/clef)
(Cloudflare) and [Jev](https://typesafe.ai/) (TypeSafe AI) — which take a
*state* plus a *schema of typed questions* and return a **probability for every
allowed option in a single forward pass**.

That means:

- **No output parsing.** You get `{ choice, probabilities, confidence }`, not a
  string you have to regex apart.
- **Deterministic.** Same input → same distribution. No temperature roulette.
- **Fast.** Clef-flash runs at ~39 ms median; Jev ~524 ms.
- **Calibrated.** Every answer carries its full distribution, so you can set
  your own thresholds instead of trusting a single label.

Clef and Jev are **API-compatible** (both speak the System One protocol), so
swapping engines is a config change, not a rewrite.

---

## Capabilities

Ten run on the decision engine; two need free-form text and run on a generation
LLM instead (decision models cannot write prose — see
[Architecture](#architecture)).

| Tab | Capability | Engine | Returns |
|-----|-----------|--------|---------|
| Core | 📋 Text Evaluation | decision | accuracy, verdict, trust score |
| Core | 🏷️ Classification | decision | topic, register, actionability |
| Core | 📝 Summarization | generation | TL;DR + key points |
| Core | 🔍 Data Extraction | generation | structured JSON entities |
| Content | 😊 Sentiment Analysis | decision | polarity, intensity, churn risk |
| Content | 🎯 Intent Detection | decision | intent, emotion, urgency |
| Content | 🏢 Entity Recognition | decision | person/org/location/money/date/product |
| Safety | 🚫 Content Moderation | decision | verdict + 8 violation categories |
| Safety | ☢️ Toxicity Detection | decision | toxicity level, target, publishability |
| Safety | 🔐 Fraud Detection | decision | risk tier + 5 signal flags |
| Ops | 📍 Smart Routing | decision | team, channel, escalation, impact |
| Ops | ⚠️ Priority Scoring | decision | severity, priority, SLA, page |

---

## 🛠️ App Builder

Describe an app in plain language. Two models cooperate:

1. **A decision model plans it** — classifying app type, complexity, risk,
   styling, and whether it needs persistence or a backend, in one forward pass.
2. **A code model writes it** — producing a complete, self-contained single-file
   HTML app.

You get a **live preview** in a sandboxed frame, plus **download** and **copy**
buttons. The generated app is never executed on the server and cannot reach the
network — see [SECURITY.md](SECURITY.md) for the full containment model.

Requests for malware, phishing, or credential theft are blocked by a
model-independent guard *before* any code is generated.

---

## Quick start

```bash
git clone https://github.com/Sm0k367/epic-jev.git
cd epic-jev
npm install
npm start
```

Open **http://localhost:3000**. It works immediately — no API key required.

### Demo mode vs. live mode

With **no credentials**, the app runs in demo mode:

- Decisions come from a **deterministic local simulator** (keyword-driven, so
  "the system is down" really does route to engineering and score Critical).
  It is clearly labelled `⚠ simulated` in the UI — it never pretends to be a
  model.
- Generated apps use a built-in working fallback.

Add credentials to switch to real models. Nothing else changes.

---

## Configuration

All variables are **optional**. See [`.env.example`](.env.example).

| Variable | Enables | Where to get it |
|----------|---------|-----------------|
| `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_AUTH_TOKEN` | **Clef** decision engine | [dash.cloudflare.com](https://dash.cloudflare.com) → Account ID; API Tokens → Workers AI |
| `AI_GATEWAY_API_KEY` | **Jev** decisions + all generation | [vercel.com/dashboard/ai-gateway/keys](https://vercel.com/dashboard/ai-gateway/keys) |
| `DECISION_ENGINE` | Force an engine | `clef` \| `clef-flash` \| `jev` \| `laya` \| `demo` |
| `AI_GATEWAY_TEXT_MODEL` | Override the text model | default `openai/gpt-oss-20b` |
| `AI_GATEWAY_MODEL` | Override the code model | default `poolside/laguna-s-2.1-free` (free) |

**Engine auto-selection:** `clef-flash` if Cloudflare creds are present →
`jev` if a Gateway key is present → `demo`. A requested engine whose
credentials are missing is ignored rather than called unauthenticated.

---

## Architecture

```
                 ┌──────────────────────────────────────┐
   Browser  ───▶ │  Express server                      │
                 │                                      │
                 │  /api/decide    ──┐                  │
                 │  /api/generate  ──┤                  │
                 │  /api/builder/* ──┤                  │
                 └───────────────────┼──────────────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              ▼                      ▼                      ▼
     ┌─────────────────┐   ┌──────────────────┐   ┌──────────────────┐
     │ lib/decision.js │   │ lib/generate.js  │   │ lib/builder.js   │
     │                 │   │                  │   │                  │
     │ Clef (CF REST)  │   │ Vercel AI        │   │ plan → generate  │
     │ Jev  (Gateway)  │   │ Gateway          │   │ → sanitise       │
     │ demo simulator  │   │ (text + code)    │   │ → stream         │
     └─────────────────┘   └──────────────────┘   └──────────────────┘
```

**Why two engines?** Decision models return probabilities only — they have no
text generation at all. Summarization and Data Extraction need prose, so they
route to a generation LLM. The App Builder uses *both*: a decision model to
plan, a code model to write. This is the architecture Cloudflare recommends —
Clef in the hot path for decisions, an LLM alongside it for action.

| File | Lines | Role |
|------|-------|------|
| `server.js` | 337 | HTTP layer, security middleware, rate limiting, SSE |
| `lib/decision.js` | 594 | Clef/Jev clients + deterministic demo simulator |
| `lib/schemas.js` | 407 | Typed-question schemas for all 12 capabilities |
| `lib/generate.js` | 178 | Text/code generation via the AI Gateway |
| `lib/builder.js` | 409 | App planning, generation, sanitisation, CSP |
| `public/index.html` | 627 | UI: probability bars, builder, sandboxed preview |

~2,550 lines total.

---

## API

```bash
# Decision capability
curl -X POST localhost:3000/api/decide \
  -H 'Content-Type: application/json' \
  -d '{"capability":"priority","text":"The system is completely down for all users."}'

# Generation capability
curl -X POST localhost:3000/api/generate \
  -H 'Content-Type: application/json' \
  -d '{"capability":"summarization","text":"..."}'

# App Builder (SSE stream: plan → chunk* → done → app)
curl -N -X POST localhost:3000/api/builder/build \
  -H 'Content-Type: application/json' \
  -d '{"description":"A pomodoro timer with a progress ring."}'
```

Full reference: [API_REFERENCE.md](API_REFERENCE.md)

---

## Security

The App Builder accepts untrusted input and produces executable code, so it is
the sensitive surface. Controls in place:

- **No server-side execution** — no `eval`, `vm`, or `child_process` anywhere.
- **Opaque-origin sandbox** — the preview iframe omits `allow-same-origin`, so
  generated code cannot read this app's cookies or storage.
- **Injected CSP** — `default-src 'none'; connect-src 'none'` inside the
  generated document: no network access at all.
- **Output sanitisation** — frame-escape vectors stripped, 200 KiB cap.
- **Abuse guard** — model-independent blocklist runs before any generation.
- **Prototype-pollution safe** — own-property capability lookups.
- **Rate limiting** — tiered by cost (6/min for builds, 60/min for decisions).
- **Security headers** on every response, including static assets.

Full threat model, verification results, and honestly-stated residual risk:
**[SECURITY.md](SECURITY.md)**

---

## Deploy

### Vercel

```bash
npx vercel deploy --prod
```

Or push to GitHub and connect the repo — every push auto-deploys. Add the
environment variables in **Project → Settings → Environment Variables**.

> **Note:** `vercel.json` uses a `builds` block, so Vercel's dashboard Build
> Settings are ignored in favour of it. That is intentional — the app is a
> plain Express server with no build step.

### Docker

```bash
docker build -t epic-jev .
docker run -p 3000:3000 epic-jev
```

### Render

`render.yaml` is included — connect the repo and it picks up the config.

---

## Verification

The app was tested end-to-end in a real browser, not just via curl:

- All 12 capabilities return structurally valid answers (distributions sum to
  1.0, probabilities in `[0,1]`, scores within their legend bounds).
- Probability bars, boolean meters, and score levels render correctly.
- The App Builder streams a plan, generates code, and renders a **working,
  interactive** app in the sandboxed preview with zero console errors.
- All 13 security controls in [SECURITY.md](SECURITY.md) were exercised against
  a running instance and passed.

---

## Credits

- **[Clef](https://huggingface.co/Cloudflare/clef)** — Cloudflare's open-source
  decision models (Apache-2.0), hosted on Workers AI.
- **[Jev](https://typesafe.ai/)** — TypeSafe AI's System One decision model.
- **[Vercel AI Gateway](https://vercel.com/docs/ai-gateway)** — unified model
  access; its AI SDK ships a native `experimental_evaluate` API for decision
  models.

## License

MIT
