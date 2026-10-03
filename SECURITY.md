# Security Model — Epic Jev

This document describes the threat model for Epic Jev and the mitigations in
place. The App Builder is the sensitive surface: it takes **untrusted natural
language** and produces **executable HTML/JS**. Everything below exists to make
that safe.

Last reviewed: 2026-10-03. All controls verified against a running instance.

---

## Threat model

| # | Threat | Surface | Status |
|---|--------|---------|--------|
| T1 | Generated code executes on the server (RCE) | `/api/builder/build` | Mitigated |
| T2 | Generated code escapes the preview frame | Browser preview | Mitigated |
| T3 | Generated code reaches the network (exfil, C2) | Browser preview | Mitigated |
| T4 | Generated code reads the host app's cookies/storage | Browser preview | Mitigated |
| T5 | Abuse: user requests malware/phishing/credential theft | `/api/builder/*` | Mitigated |
| T6 | Prototype pollution via attacker-controlled `capability` id | `/api/decide`, `/api/generate` | Mitigated |
| T7 | Client forces an unprovisioned decision backend | `/api/decide` | Mitigated |
| T8 | Cross-origin request forgery against the API | All `POST` routes | Mitigated |
| T9 | Cost/DoS amplification via the generation endpoints | `/api/generate`, `/api/builder/build` | Mitigated |
| T10 | Unbounded memory growth from large inputs or stored apps | All routes | Mitigated |
| T11 | Framework fingerprinting | All responses | Mitigated |
| T12 | Credential leakage into client or logs | Server env | Mitigated |

---

## T1 — No server-side execution

Generated code is **never run on the server**. There is no `eval`, no `vm`, no
`child_process`, no `Function()` constructor anywhere in the codebase.

```bash
$ grep -rn "eval(\|new Function\|child_process\|require('vm')\|import.*vm" server.js lib/
# (no matches)
```

The server treats generated HTML as an **opaque string**: it is sanitised,
byte-capped, and streamed back to the client. The only code that executes is
the user's own browser, rendering their own app.

---

## T2/T3/T4 — The preview sandbox

The preview is an `<iframe>` built with `srcdoc`, sandboxed as follows:

```html
<iframe
  sandbox="allow-scripts allow-modals allow-popups-to-escape-sandbox"
  referrerpolicy="no-referrer"
  srcdoc="...generated app...">
```

**`allow-same-origin` is deliberately absent.** Without it the frame gets an
*opaque origin*, which means the generated app:

- cannot read `epic-jev.vercel.app` cookies,
- cannot read or write the host app's `localStorage`/`sessionStorage`,
- cannot make credentialed same-origin `fetch` calls,
- cannot script the parent document (`parent.*` is cross-origin).

`allow-scripts` is present because the app must run — but scripts in an opaque
origin can only affect their own frame.

### Defence in depth: injected CSP

Sandboxing alone would still permit outbound network calls. So `sanitise()`
injects a Content-Security-Policy **into the generated document itself**, which
applies even under `srcdoc` (where the server cannot set a response header):

```
default-src 'none';
script-src 'unsafe-inline';
style-src 'unsafe-inline';
img-src data: blob:;
font-src data:;
media-src data: blob:;
connect-src 'none';
form-action 'none';
frame-ancestors 'self';
base-uri 'none'
```

`connect-src 'none'` blocks `fetch`, `XHR`, `WebSocket`, and `EventSource` —
the generated app **cannot reach the network at all**. `default-src 'none'`
blocks external scripts, stylesheets, and subresources. Any model-supplied CSP
is stripped first so ours is the only one.

### Output sanitisation

Before the CSP is injected, `sanitise()` removes frame-escape and navigation
vectors. Whole tags are removed (not just attributes) so no dangling fragments
survive:

| Removed | Why |
|---------|-----|
| `<script src=…>` | External code execution |
| `<link …>` | External stylesheets/subresources |
| `<iframe>`, `<object>`, `<embed>` | Nested frames, plugin content |
| `<base href=…>` | Relative-URL hijack |
| `<meta http-equiv=refresh>` | Auto-navigation |
| `window.open(` | New-window escape |
| `top.location`, `parent.location`, `window.top`, `window.parent` | Top-frame navigation |
| `document.cookie` | Cookie access |
| `target="_top" / "_parent" / "_blank"` | Link-based frame escape |
| `action="//host"` | Form POST to an external host |

Output is hard-capped at **200 KiB** (`MAX_APP_BYTES`).

**Verified:** a deliberately malicious document containing every vector above
was reduced to inert text, while a legitimate app (inline `<style>`, inline
`<script>`, `localStorage`, DOM manipulation) survived intact and ran with zero
console errors.

---

## T5 — Abuse guard (model-independent)

The decision model classifies request risk, but **safety must not depend on
credentials being configured or on a model's judgement**. So a hard blocklist
runs *first*, in every mode including demo:

```js
export function detectAbuse(description) { /* ABUSE_PATTERNS */ }
```

It blocks phishing, credential/password/card harvesting, keyloggers, malware,
ransomware, DDoS tooling, fake login clones, carding/CVV dumps, CAPTCHA/2FA/KYC
bypass, cryptojacking, and covert exfiltration phrasing.

`planApp()` short-circuits on a match and returns
`{ blocked: true, blockReason: 'abuse-pattern', engine: 'guard' }` — **no model
call and no code generation happens**.

**Verified:** 6/6 malicious prompts blocked, 6/6 benign prompts allowed —
including the deliberately tricky *"password strength checker"* (a legitimate
app that mentions passwords), which correctly passes.

A second layer remains: if the decision model itself scores `risk: high`, the
build is blocked with `blockReason: 'model-risk'`.

---

## T6 — Prototype pollution

`CAPABILITIES[id]` with an attacker-controlled `id` resolves `__proto__`,
`constructor`, `toString`, and `hasOwnProperty` to **inherited Object members**
— all truthy — so a naive `if (!cap)` guard does not reject them.

All lookups go through an own-property check:

```js
function getCapability(id) {
  if (typeof id !== 'string') return null;
  return Object.hasOwn(CAPABILITIES, id) ? CAPABILITIES[id] : null;
}
```

**Verified:** `__proto__`, `constructor`, `toString`, `hasOwnProperty` all
return `400 Unknown capability`; valid ids still return `200`.

---

## T7 — Engine override

`/api/decide` accepts a client-supplied `engine`. Left unchecked, a client
could select `clef` on a deployment with no Cloudflare credentials, producing a
request signed with `Bearer undefined`.

`resolveEngine()` validates the value against the known engine list **and**
checks that the required credentials exist, falling back to the configured
engine otherwise.

**Verified:** requesting `engine: "clef"` with no Cloudflare credentials
silently falls back to the demo simulator rather than making a broken call.

---

## T8 — Cross-origin protection

Every `POST`/`PUT` carrying an `Origin` header is rejected unless the origin
host matches the request's `Host`:

**Verified:** `Origin: https://evil.com` → `403 Cross-origin request rejected`;
`Origin: http://localhost:3000` → `200`.

This is a lightweight guard, not full CORS. The API is not intended for
third-party browser callers; server-to-server clients (no `Origin` header) are
unaffected.

---

## T9/T10 — Rate limiting and resource bounds

Per-IP token buckets, tiered by cost:

| Endpoint | Limit | Rationale |
|----------|-------|-----------|
| `/api/decide`, `/api/builder/plan` | 60 / min | Cheap decision calls |
| `/api/generate` | 20 / min | LLM generation costs money |
| `/api/builder/build` | 6 / min | Most expensive: full app generation |

Exceeding a limit returns `429` with a `Retry-After` header.

**Verified:** the 7th consecutive `/api/builder/build` request returned `429`.

> **Serverless caveat.** Buckets are in-memory, so on Vercel the limit is
> *per container*, not global — a determined attacker can fan out across
> instances. For production abuse control, pair this with platform-level rate
> limiting (Vercel WAF / Cloudflare). This is documented rather than hidden.

Other bounds:

- Request body capped at **1 MB** (`express.json({ limit: '1mb' })`).
- Decision/generation input truncated to **8,000 chars**; builder descriptions
  to **4,000 chars** (`MAX_PROMPT_CHARS`).
- Generated apps capped at **200 KiB**.
- Stale rate-limit buckets are swept every 60 s, so the map cannot grow
  unboundedly.
- **No server-side app storage.** Generated apps stream to the client and are
  rendered/downloaded locally, so there is no accumulating store to exhaust —
  and nothing a user builds is persisted on our servers.

---

## T11/T12 — Hardening and secrets

**Response hardening** (applied before `express.static`, so it covers
`index.html` and every asset):

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: no-referrer
Permissions-Policy: geolocation=(), microphone=(), camera=()
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self';
  frame-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'
```

`app.disable('x-powered-by')` removes the `X-Powered-By: Express` fingerprint.

The host page's own CSP allows `frame-src 'self' blob:` so the sandboxed
preview can load, while `object-src 'none'` and `base-uri 'self'` close the
usual injection helpers.

**Secrets.** No credential appears in source, in the client bundle, or in logs.
All three are read from the environment at request time:

- `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_AUTH_TOKEN` — Clef via Workers AI
- `AI_GATEWAY_API_KEY` — Jev decisions and text/code generation

`/api/status` reports only **booleans** about which credentials are present,
never their values. With none set, the app runs entirely in demo mode.

---

## Residual risk

Honestly stated, not papered over:

1. **`unsafe-inline` for scripts.** The host page uses inline `<script>`, and
   generated apps need inline scripts to function. A CSP nonce or hash would be
   stronger for the host page. The generated app's inline scripts are contained
   by the opaque-origin sandbox, so the residual risk there is low.
2. **Per-instance rate limits on serverless** (see T9).
3. **The abuse blocklist is pattern-based.** It catches known phrasings, not
   novel ones. The decision model's risk classification is the second layer;
   with real credentials both run.
4. **Sanitisation is regex-based**, not a full HTML parse. The injected
   `connect-src 'none'` CSP and the opaque-origin sandbox are the load-bearing
   controls; sanitisation is defence in depth on top of them.
5. **No authentication.** The app is a public demo. Adding real user accounts
   would require auth, per-user quotas, and abuse monitoring.

---

## Verification summary

| Control | Test | Result |
|---------|------|--------|
| No server-side execution | grep for `eval`/`vm`/`child_process` | none present |
| Sandbox attribute | read `iframe.sandbox` | `allow-scripts allow-modals allow-popups-to-escape-sandbox` — no `allow-same-origin` |
| CSP injected into generated app | inspect `srcdoc` | `default-src 'none'` present |
| Malicious markup stripped | 13-vector attack document | all 13 neutralised |
| Legitimate app preserved | inline style/script/localStorage | all intact, runs clean |
| Generated app executes | standalone render + interaction | heading/input/button render, add-item works, 0 console errors |
| Abuse guard | 6 malicious + 6 benign prompts | 6 blocked, 6 allowed |
| Prototype pollution | `__proto__`, `constructor`, `toString`, `hasOwnProperty` | all `400` |
| Engine override | `engine: "clef"` without credentials | falls back to demo |
| Cross-origin | `Origin: https://evil.com` | `403` |
| Rate limit | 7 rapid builds | 7th → `429` |
| Security headers | `GET /` | all 5 present, `X-Powered-By` absent |
| Oversized input | 200 KB body | truncated to 8,000 chars, `200` |
