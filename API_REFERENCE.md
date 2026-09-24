# 📚 Epic Jev - Complete API Reference

Full API documentation for Epic Jev endpoints and integration patterns.

---

## Base URL

| Environment | URL |
|-------------|-----|
| Local | `http://localhost:3000` |
| Production | `https://epic-jev.unruly-capricorn.workers.dev` |
| Custom Domain | `https://your-domain.com` |

---

## Endpoints

### 1. Health Check

**GET** `/health`

Check if server is running.

**Response:**
```json
{
  "status": "ok"
}
```

**Example:**
```bash
curl http://localhost:3000/health
```

---

### 2. Jev Streaming API

**POST** `/api/jev`

Stream Jev model responses in real-time via Server-Sent Events (SSE).

#### Request

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "prompt": "Text to analyze (required)",
  "type": "evaluation|extraction|classification|summarization|sentiment|entity|intent|moderation|toxicity|fraud|routing|priority"
}
```

#### Response

**Content-Type:** `text/event-stream`

**Format:** Server-Sent Events (SSE)

```
data: Character stream...
data: [DONE]
```

---

## Request Types

### Core Tasks

#### 1. Evaluation
**Type:** `evaluation`

Evaluate the accuracy or validity of statements.

```json
{
  "prompt": "Machine learning is a subset of artificial intelligence.",
  "type": "evaluation"
}
```

**Response Stream:**
```
Yes. This statement is accurate...
```

**Use Cases:**
- Fact-checking
- Claim verification
- Statement validation
- Accuracy assessment

---

#### 2. Extraction
**Type:** `extraction`

Extract key concepts and information from text.

```json
{
  "prompt": "Token streaming delivers content in real-time through async iterators.",
  "type": "extraction"
}
```

**Response Stream:**
```
1. Token streaming - real-time delivery
2. Async iterators - asynchronous processing
```

**Use Cases:**
- Information extraction
- Entity detection
- Keyword mining
- Data enrichment

---

#### 3. Classification
**Type:** `classification`

Categorize and label content.

```json
{
  "prompt": "This implementation is elegant and performant.",
  "type": "classification"
}
```

**Response Stream:**
```
Positive. Expression of satisfaction with implementation.
```

**Use Cases:**
- Sentiment analysis
- Category assignment
- Type detection
- Content tagging

---

#### 4. Summarization
**Type:** `summarization`

Compress content to key points.

```json
{
  "prompt": "Long article about machine learning, neural networks, and deep learning...",
  "type": "summarization"
}
```

**Response Stream:**
```
ML is a field of AI focusing on algorithms that learn patterns from data...
```

**Use Cases:**
- Document summarization
- Abstract generation
- Content compression
- Key point extraction

---

### Content Analysis Tasks

#### 5. Sentiment Analysis
**Type:** `sentiment`

Detect emotion, tone, and sentiment polarity.

```json
{
  "prompt": "I absolutely love this product! Exceptional quality!",
  "type": "sentiment"
}
```

**Response Stream:**
```
Sentiment: POSITIVE | Confidence: 92%
Key indicators: 'love', 'absolutely', 'exceptional'
```

**Use Cases:**
- Customer feedback analysis
- Review sentiment scoring
- Social media monitoring
- Brand perception tracking

---

#### 6. Entity Recognition
**Type:** `entity`

Identify people, places, organizations, and products.

```json
{
  "prompt": "Sundar Pichai leads Google from Mountain View.",
  "type": "entity"
}
```

**Response Stream:**
```
Entities:
- PERSON: Sundar Pichai (CEO)
- ORGANIZATION: Google
- LOCATION: Mountain View (California)
```

**Use Cases:**
- Named Entity Recognition (NER)
- Knowledge graph construction
- Reference extraction
- Document indexing

---

#### 7. Intent Detection
**Type:** `intent`

Understand user intent and purpose.

```json
{
  "prompt": "I can't login to my account. I've reset my password but still can't access.",
  "type": "intent"
}
```

**Response Stream:**
```
Intent: SEEKING_SUPPORT (96% confidence)
Primary: Problem resolution
Secondary: Information request
Action: Route to support with priority flag
```

**Use Cases:**
- Chatbot routing
- Support ticket classification
- Sales lead qualification
- Conversation flow optimization

---

### Safety & Compliance Tasks

#### 8. Content Moderation
**Type:** `moderation`

Flag policy violations and inappropriate content.

```json
{
  "prompt": "This is professional business communication.",
  "type": "moderation"
}
```

**Response Stream:**
```
Safety Score: 95/100 ✓ APPROVED
Violations: NONE
Confidence: 98%
```

**Use Cases:**
- Comment filtering
- Jailbreak detection
- Policy violation flagging
- Community guideline enforcement

---

#### 9. Toxicity Detection
**Type:** `toxicity`

Identify harmful, abusive, or toxic language.

```json
{
  "prompt": "Great suggestion for improvement!",
  "type": "toxicity"
}
```

**Response Stream:**
```
Toxicity Level: MINIMAL (2/100)
Language: Professional
Tone: Constructive
Status: SAFE TO PUBLISH
```

**Use Cases:**
- Abuse prevention
- Toxic comment filtering
- Harassment detection
- Platform moderation

---

#### 10. Fraud Detection
**Type:** `fraud`

Score transaction risk and detect anomalies.

```json
{
  "prompt": "User: new account, $5000 purchase, foreign country, new payment method",
  "type": "fraud"
}
```

**Response Stream:**
```
Fraud Risk: HIGH (78%)
Flags: Multiple anomalies
Recommendation: MANUAL REVIEW
Anomalies: New account, unusual amount, new payment method
```

**Use Cases:**
- Payment fraud prevention
- Account security scoring
- Transaction anomaly detection
- Risk assessment

---

### Operations Tasks

#### 11. Smart Routing
**Type:** `routing`

Route issues to best handler, team, or specialist.

```json
{
  "prompt": "API returns 500 error processing large datasets with database.",
  "type": "routing"
}
```

**Response Stream:**
```
Route To: TECHNICAL_SUPPORT (94% confidence)
Reason: System architecture issue
Secondary: ENGINEERING_TEAM (87%)
SLA: 4 hours
```

**Use Cases:**
- Support ticket triage
- Department routing
- Escalation logic
- Tool/specialist selection

---

#### 12. Priority Scoring
**Type:** `priority`

Calculate task urgency and SLA requirements.

```json
{
  "prompt": "Multiple users report system completely down. All services inaccessible.",
  "type": "priority"
}
```

**Response Stream:**
```
Priority: CRITICAL (9/10)
SLA: 1 hour response
Impact: Production system
Users: Multiple
Revenue: High risk
```

**Use Cases:**
- SLA management
- Queue prioritization
- Response time calculation
- Escalation triggering

---

## Error Handling

### Invalid Request Type
```bash
curl -X POST http://localhost:3000/api/jev \
  -H "Content-Type: application/json" \
  -d '{"prompt": "test", "type": "invalid"}'
```

**Response:** Falls back to evaluation type

### Missing Prompt
```bash
curl -X POST http://localhost:3000/api/jev \
  -H "Content-Type: application/json" \
  -d '{"type": "sentiment"}'
```

**Response (HTTP 400):**
```json
{
  "error": "Prompt required"
}
```

### Server Error
```
data: [ERROR] Connection failed
data: [DONE]
```

---

## Client Integration Examples

### JavaScript (Fetch API)

```javascript
async function analyzeText(prompt, type) {
  const response = await fetch('/api/jev', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, type })
  });
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let result = '';
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') {
          console.log('Stream complete');
        } else if (data.startsWith('[ERROR]')) {
          console.error(data);
        } else {
          result += data;
          console.log(data); // Real-time output
        }
      }
    }
  }
  
  return result;
}

// Usage
analyzeText('Is Python popular?', 'evaluation');
```

### Python (requests)

```python
import requests
import json

def analyze_text(prompt, type):
    response = requests.post(
        'http://localhost:3000/api/jev',
        json={'prompt': prompt, 'type': type},
        stream=True
    )
    
    result = ''
    for line in response.iter_lines():
        if line:
            decoded = line.decode('utf-8')
            if decoded.startswith('data: '):
                data = decoded[6:]
                if data == '[DONE]':
                    print('Stream complete')
                elif data.startswith('[ERROR]'):
                    print(f'Error: {data}')
                else:
                    result += data
                    print(data, end='', flush=True)
    
    return result

# Usage
analyze_text('Is Python popular?', 'evaluation')
```

### cURL

```bash
curl -X POST http://localhost:3000/api/jev \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Analyze this sentiment",
    "type": "sentiment"
  }' \
  --http2 \
  --no-buffer
```

### React Component

```jsx
import { useEffect, useState } from 'react';

function AnalysisComponent() {
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  
  async function analyze(text, type) {
    setLoading(true);
    setOutput('');
    
    const response = await fetch('/api/jev', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: text, type })
    });
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data !== '[DONE]') {
            setOutput(prev => prev + data);
          }
        }
      }
    }
    
    setLoading(false);
  }
  
  return (
    <div>
      <button onClick={() => analyze('test text', 'sentiment')}>
        Analyze
      </button>
      <div>{output}</div>
    </div>
  );
}
```

### Next.js API Route

```javascript
// app/api/analyze/route.js
import { streamText } from 'ai';

export async function POST(req) {
  const { text, type } = await req.json();
  
  const { textStream } = await streamText({
    model: 'typesafe-ai/jev',
    prompt: `Analyze as ${type}: ${text}`,
  });
  
  return new Response(textStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

---

## Performance Characteristics

### Latency by Task Type

| Type | Latency (demo) | Latency (real) |
|------|----------------|----------------|
| evaluation | 0ms | 70-200ms |
| extraction | 0ms | 150-300ms |
| classification | 0ms | 100-250ms |
| sentiment | 0ms | 120-280ms |
| toxicity | 0ms | 80-200ms |
| fraud | 0ms | 150-350ms |
| routing | 0ms | 180-400ms |

### Throughput

- **Streaming Rate:** ~480 characters/second
- **Average Response Size:** 150-300 characters
- **Avg Response Time:** 200-400ms (demo mode: instant)

---

## Rate Limiting

Currently **no rate limiting** applied. For production, implement:

```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later.'
});

app.post('/api/jev', limiter, (req, res) => {
  // Handle request
});
```

---

## Authentication (Optional)

Add JWT authentication:

```javascript
import jwt from 'jsonwebtoken';

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

app.post('/api/jev', authMiddleware, (req, res) => {
  // Handle request
});
```

---

## CORS Configuration

Current configuration allows all origins. For production:

```javascript
import cors from 'cors';

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(','),
  credentials: true,
  methods: ['POST', 'GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

---

## Webhooks (Future)

To implement async processing with webhooks:

```javascript
app.post('/api/jev/async', (req, res) => {
  const { prompt, type, webhookUrl } = req.body;
  
  // Queue for processing
  queue.add({ prompt, type, webhookUrl });
  
  res.json({ jobId: 'job-xxx', status: 'queued' });
});
```

---

## Batch Processing (Future)

```javascript
app.post('/api/jev/batch', async (req, res) => {
  const { items } = req.body; // Array of { prompt, type }
  
  const results = await Promise.all(
    items.map(item => processJev(item))
  );
  
  res.json({ results });
});
```

---

## Changelog

### v1.0.0 (Current)
- ✅ 12 capability types
- ✅ Real-time streaming
- ✅ Demo + real mode
- ✅ Tab-based UI
- ✅ SSE streaming

### v1.1.0 (Planned)
- 🔄 Rate limiting
- 🔄 Authentication
- 🔄 Request logging
- 🔄 Batch API
- 🔄 Webhooks

---

## Support

- **Issues:** Check logs
- **Help:** See CAPABILITIES.md
- **Community:** TypeSafe AI Discord

---

**Epic Jev API** • Fast • Deterministic • Production-Ready
