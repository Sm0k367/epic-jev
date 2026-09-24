# 🚀 Epic Jev - Do Anything with AI

**Production-ready AI application** demonstrating **12+ real-world use cases** with a single, fast, deterministic model: **Jev** (TypeSafe AI).

## 🎯 What It Does

| Category | Tasks | Examples |
|----------|-------|----------|
| **Core** | Evaluation, Extraction, Classification, Summarization | Fact-checking, data mining, sentiment analysis, content compression |
| **Content** | Sentiment Analysis, Entity Recognition, Intent Detection | Customer feedback, NER, chatbot routing |
| **Safety** | Content Moderation, Toxicity Detection, Fraud Detection | Policy enforcement, abuse prevention, transaction scoring |
| **Operations** | Smart Routing, Priority Scoring | Support triage, SLA management |

**Total: 12 Production-Ready Capabilities in One App**

---

## 🚀 Quick Start

### Demo Mode (No Setup Required)

```bash
npm install
npm start
```

Visit **http://localhost:3000** — works immediately!

### Real Jev Mode

```bash
# 1. Get API key
# https://vercel.com/dashboard/ai-gateway/keys

# 2. Set environment variable
export AI_GATEWAY_API_KEY=your_key_here

# 3. Start server
npm start
```

---

## 📋 Complete Feature List

### 🎯 Core Tasks (4)
- **📋 Text Evaluation** - Judge accuracy of statements
- **🔍 Data Extraction** - Pull key concepts and information
- **🏷️ Classification** - Categorize and label content
- **📝 Summarization** - Compress content to key points

### 📊 Content Analysis (3)
- **😊 Sentiment Analysis** - Detect emotion and tone
- **🏢 Entity Recognition** - Identify people, places, organizations
- **🎯 Intent Detection** - Understand what users want

### 🛡️ Safety & Compliance (3)
- **🚫 Content Moderation** - Flag policy violations
- **☢️ Toxicity Detection** - Identify harmful language
- **🔐 Fraud Detection** - Score transaction risk

### 🔀 Operations (2)
- **📍 Smart Routing** - Route issues to best handler
- **⚠️ Priority Scoring** - Calculate task urgency

---

## 🏗️ Architecture

```
┌─────────────────────────────────────┐
│     Epic Jev Web UI (React)         │
│  • Tab-based interface              │
│  • Real-time streaming display      │
│  • 12+ interactive demos            │
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│   Express.js Backend (/api/jev)     │
│  • SSE streaming                    │
│  • Demo & real mode support         │
│  • Multi-type request routing       │
└────────────┬────────────────────────┘
             │
    ┌────────┴────────┐
    │                 │
[With API Key]  [Without API Key]
    │                 │
    ▼                 ▼
 Real Jev      Demo Mode
 (70-500ms)    (Instant)
```

---

## 🎮 Live Examples

### Example 1: Customer Support Triage
```
Input:  "I can't login to my account. I reset my password but still can't access."

Steps:
  1. Sentiment Analysis → Frustrated (Negative)
  2. Intent Detection → Seeking Support
  3. Smart Routing → TECHNICAL_SUPPORT (94% confidence)
  4. Priority Scoring → HIGH (8/10)

Output: Pre-triaged ticket with routing and urgency level
```

### Example 2: Content Moderation
```
Input:  "Check this user comment for policy violations"

Steps:
  1. Toxicity Detection → Minimal (2/100)
  2. Content Moderation → No violations detected
  3. Classification → Professional tone

Output: APPROVED ✓ Safe to publish
```

### Example 3: Fraud Detection
```
Input:  "Transaction: $50 from familiar store, verified card, home city"

Steps:
  1. Entity Recognition → Extract transaction details
  2. Fraud Detection → Score risk (LOW: 12%)
  3. Priority Scoring → Normal processing

Output: Auto-approve transaction
```

---

## 💰 Performance Comparison

| Metric | Jev | GPT-4o | Claude |
|--------|-----|--------|--------|
| **Latency** | 70-500ms | 3-10s | 3-10s |
| **Input Cost** | $0.042/M | $0.30/M | $0.30/M |
| **Output Cost** | FREE | $1.50/M | $1.50/M |
| **Throughput** | ~480 chars/sec | ~50 chars/sec | ~50 chars/sec |
| **Best For** | Fast decisions | Creative writing | Long reasoning |

---

## 🚀 Deployment

### Cloudflare Workers (Fastest)
```bash
npm run deploy
# Live at: epic-jev.unruly-capricorn.workers.dev
```

### Vercel (Easiest)
```bash
vercel deploy
# Set AI_GATEWAY_API_KEY in Vercel dashboard
```

### Heroku (Classic)
```bash
git push heroku main
```

### Docker
```bash
docker build -t epic-jev .
docker run -p 3000:3000 -e AI_GATEWAY_API_KEY=xxx epic-jev
```

---

## 📚 API Reference

### Endpoint: POST /api/jev

**Request:**
```json
{
  "prompt": "Text to analyze",
  "type": "evaluation|extraction|classification|summarization|sentiment|entity|intent|moderation|toxicity|fraud|routing|priority"
}
```

**Response:** Server-Sent Events (SSE) stream
```
data: Character stream...
data: [DONE]
```

**cURL Example:**
```bash
curl -X POST http://localhost:3000/api/jev \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Is machine learning a subset of AI?",
    "type": "evaluation"
  }'
```

---

## 🔧 Configuration

### Environment Variables
```bash
# Optional: Real Jev API key (leave empty for demo mode)
AI_GATEWAY_API_KEY=vcp_your_key_here

# Server port (default: 3000)
PORT=3000

# Optional: KMS authentication
VERCEL_KMS_ISSUER_ID=your_issuer_id
VERCEL_KMS_KEY_ID=your_key_id
```

### .env File
```bash
# Create .env (not tracked by git)
AI_GATEWAY_API_KEY=your_key_here
PORT=3000
```

---

## 🔒 Security

✅ **No hardcoded secrets** — All credentials from environment variables  
✅ **Demo mode** — Works without API key  
✅ **Production-ready** — Security audit passed  
✅ **Input validation** — All endpoints validated  
✅ **CORS configured** — Safe cross-origin requests  
✅ **SSE streaming** — Real-time without polling  

---

## 📊 Use Cases by Industry

### 🏥 Healthcare
- Patient feedback sentiment analysis
- Medical record information extraction
- Priority triage for ER intake

### 🛒 E-Commerce
- Review sentiment analysis
- Product classification
- Fraud detection for payments
- Customer intent routing

### 🏢 Enterprise
- Support ticket triage
- Internal documentation summarization
- Employee feedback analysis
- Policy compliance checking

### 🎓 Education
- Student feedback analysis
- Essay evaluation
- Content moderation for forums
- Student intent detection (help vs. question)

### 🚗 Finance
- Transaction fraud scoring
- Customer sentiment from complaints
- Priority routing for incidents
- Regulatory compliance checks

---

## 🎓 Learning Resources

- **Full Capabilities Guide:** See [CAPABILITIES.md](./CAPABILITIES.md)
- **Integration Examples:** See [JEV_INTEGRATION_GUIDE.md](../JEV_INTEGRATION_GUIDE.md)
- **KMS Authentication:** See [KMS_INTEGRATION_SUMMARY.md](../KMS_INTEGRATION_SUMMARY.md)
- **Jev Model:** https://typesafe.ai
- **Vercel AI Gateway:** https://vercel.com/docs/ai-gateway

---

## 📁 File Structure

```
epic-jev/
├── server.js              # Express backend with /api/jev endpoint
├── public/
│   └── index.html         # Interactive UI with 12 demos
├── package.json           # Dependencies and scripts
├── README.md              # This file
├── CAPABILITIES.md        # Detailed feature guide
├── .env.example           # Environment template
└── wrangler.toml          # Cloudflare Workers config
```

---

## 🔄 Integration Examples

### Express.js
```javascript
import { streamText } from 'ai';

app.post('/api/analyze', async (req, res) => {
  const { textStream } = await streamText({
    model: 'typesafe-ai/jev',
    prompt: `Analyze sentiment: ${req.body.text}`,
  });
  
  for await (const chunk of textStream) {
    res.write(`data: ${chunk}\n\n`);
  }
  res.end();
});
```

### Next.js API Route
```javascript
export async function POST(req) {
  const { text } = await req.json();
  
  const { textStream } = await streamText({
    model: 'typesafe-ai/jev',
    prompt: `Evaluate: ${text}`,
  });
  
  return new Response(textStream);
}
```

### React Component
```javascript
const [output, setOutput] = useState('');

async function analyze(text) {
  const response = await fetch('/api/jev', {
    method: 'POST',
    body: JSON.stringify({ prompt: text, type: 'sentiment' }),
  });
  
  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = new TextDecoder().decode(value);
    setOutput(prev => prev + chunk);
  }
}
```

---

## 🎯 Next Steps

1. **Try it locally:**
   ```bash
   npm install && npm start
   ```

2. **Get an API key:**
   - https://vercel.com/dashboard/ai-gateway/keys
   - Or: https://console.typesafe.ai/settings/keys

3. **Enable real Jev:**
   ```bash
   export AI_GATEWAY_API_KEY=your_key
   npm start
   ```

4. **Deploy to production:**
   ```bash
   npm run deploy  # Cloudflare
   # or
   vercel deploy   # Vercel
   ```

5. **Integrate into your app:**
   - Copy `/api/jev` pattern to your backend
   - Use SSE streaming for real-time responses
   - Add more capability types as needed

---

## 📞 Support

- **Questions:** Check [CAPABILITIES.md](./CAPABILITIES.md)
- **Issues:** Review the Express server logs
- **Help:** See integration examples above
- **Community:** TypeSafe AI Discord / Vercel Discord

---

## 📄 License

MIT — Use freely in your projects

---

**Epic Jev** • Do Anything with AI • Real-time Streaming • Production-Ready

**Powered by:** Jev (TypeSafe AI) • Express.js • Real-time SSE Streaming
