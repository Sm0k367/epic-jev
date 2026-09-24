import express from 'express';
import { streamText } from 'ai';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint for Jev streaming
app.post('/api/jev', async (req, res) => {
  const { prompt, type } = req.body;
  
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt required' });
  }

  // Check if API key is available
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  
  if (!apiKey) {
    // Demo mode - send simulated response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Simulated Jev responses based on type
    const responses = {
      evaluation: 'Yes. This statement is accurate. Machine learning is indeed a subset of artificial intelligence, specifically focusing on systems that learn and improve from experience without being explicitly programmed.',
      extraction: '1. Token streaming - delivering model output token-by-token\n2. Real-time generation - immediate user feedback\n3. Async processing - non-blocking response handling',
      classification: 'Positive. The statement expresses clear satisfaction with the implementation quality and runtime performance characteristics.',
      summarization: 'Jev is a specialized language model excelling at structured text extraction, evaluation tasks, and classification. With a 32K token context window and deterministic outputs, it\'s ideal for enterprise applications requiring reliable information extraction and analysis.',
      sentiment: 'Sentiment: POSITIVE | Confidence: 92% | Tone: Enthusiastic, professional\n\nKey emotional indicators:\n- "amazing" (strong positive)\n- "highly recommended" (endorsement)\n- Exclamation marks (excitement)',
      moderation: 'Content Safety Score: 95/100 ✓ APPROVED\nViolation Type: NONE\nConfidence: 98%\n\nAnalysis: Professional business communication with no policy violations, harmful content, or sensitive material.',
      toxicity: 'Toxicity Level: MINIMAL (2/100)\nLanguage: Professional\nTone: Constructive\nRecommendation: SAFE TO PUBLISH',
      fraud: 'Fraud Risk: LOW (12%)\nFlags: None\n\nTransaction Pattern Analysis:\n✓ Standard purchase amount\n✓ Location matches account history\n✓ Payment method verified\n✓ Behavioral baseline normal',
      routing: 'Route To: TECHNICAL_SUPPORT\nConfidence: 94%\nReason: Issue involves system architecture and implementation details\nSecondary Route: ENGINEERING_TEAM (87%)',
      priority: 'Priority Level: HIGH (8/10)\nUrgency Indicators:\n- Blocking production system\n- Multiple users affected\n- Potential revenue impact\n- Recommended SLA: 2 hours',
      entity: 'Entities Detected:\n- ORGANIZATION: "Google" (Tech Company)\n- PERSON: "Sundar Pichai" (CEO)\n- LOCATION: "Mountain View" (California)\n- PRODUCT: "Google Cloud" (Service)\n- TECHNOLOGY: "Machine Learning" (Category)',
      intent: 'User Intent: SEEKING_SUPPORT\nConfidence: 96%\n\nIntent Breakdown:\n- Primary: Problem resolution\n- Secondary: Information request\n- Emotional: Frustrated\n\nRecommended Action: Route to support with priority flagging'
    };
    
    const response = responses[type] || responses.evaluation;
    
    // Stream character by character with delay
    let sent = 0;
    const interval = setInterval(() => {
      if (sent < response.length) {
        res.write(`data: ${response[sent]}\n\n`);
        sent++;
      } else {
        res.write(`data: [DONE]\n\n`);
        clearInterval(interval);
        res.end();
      }
    }, 20);
    
    return;
  }

  // Real mode - use Jev model
  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const { textStream } = await streamText({
      model: 'typesafe-ai/jev',
      prompt: prompt,
      temperature: 0.5,
      maxTokens: 200,
    });

    for await (const chunk of textStream) {
      res.write(`data: ${chunk}\n\n`);
    }
    
    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (error) {
    console.error('Error:', error.message);
    res.write(`data: [ERROR] ${error.message}\n\n`);
    res.end();
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`\n╔════════════════════════════════════════╗`);
  console.log(`║         Epic Jev - Live Demo           ║`);
  console.log(`╚════════════════════════════════════════╝`);
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`\n📝 API Key Status:`);
  console.log(`   ${process.env.AI_GATEWAY_API_KEY ? '✓ Real API key set' : '⚠ Demo mode (no API key)'}`);
  console.log(`\n💡 Features:`);
  console.log(`   • Text Evaluation - Judge statement accuracy`);
  console.log(`   • Data Extraction - Pull key concepts`);
  console.log(`   • Classification - Categorize sentiment`);
  console.log(`   • Summarization - Compress content`);
  console.log(`\n🌐 Visit http://localhost:${PORT} in your browser\n`);
});
