# 🚀 Epic Jev - Deployment Guide

Deploy **Epic Jev** to production with real Jev model streaming.

---

## 📋 Prerequisites

- Node.js 18+ installed
- Jev API key (from Vercel or TypeSafe)
- Git repository (for Vercel/Heroku)

---

## 🌐 Deployment Options

### Option 1: Cloudflare Workers (⚡ Fastest)

**Pros:** Instant deployment, global edge network, free tier generous  
**Cons:** Requires Wrangler CLI

```bash
# 1. Install Wrangler
npm install -g wrangler

# 2. Login to Cloudflare
wrangler login

# 3. Set environment variable in wrangler.toml
# Add to wrangler.toml:
# [env.production]
# vars = { AI_GATEWAY_API_KEY = "your_key" }

# 4. Deploy
npm run deploy

# 5. Get live URL from output
# https://epic-jev.unruly-capricorn.workers.dev
```

**wrangler.toml Configuration:**
```toml
name = "epic-jev"
main = "server.js"
compatibility_date = "2024-01-01"
node_compat = true

[env.production]
vars = { AI_GATEWAY_API_KEY = "vcp_xxxxx" }

[[r2.buckets]]
binding = "BUCKET"
```

---

### Option 2: Vercel (✨ Easiest)

**Pros:** One-click deployment, auto-scaling, great for Node.js  
**Cons:** Requires Vercel account

```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Deploy
vercel deploy

# 3. Add environment variable
# - Go to Vercel Dashboard
# - Project Settings → Environment Variables
# - Add: AI_GATEWAY_API_KEY = your_key

# 4. Redeploy to use new env var
vercel deploy --prod
```

**Or use vercel.json:**
```json
{
  "buildCommand": "npm install",
  "outputDirectory": ".",
  "env": {
    "AI_GATEWAY_API_KEY": "@ai_gateway_api_key"
  }
}
```

Then set in Vercel dashboard.

---

### Option 3: Heroku (Classic)

**Pros:** Familiar platform, one-click deploy  
**Cons:** Slower startup, paid after free tier

```bash
# 1. Create app
heroku create epic-jev

# 2. Set environment variable
heroku config:set AI_GATEWAY_API_KEY=your_key

# 3. Deploy
git push heroku main

# 4. Get live URL
heroku open
```

**Procfile:**
```
web: npm start
```

---

### Option 4: Docker (Production)

**Pros:** Full control, reproducible, any host  
**Cons:** Requires Docker knowledge

```bash
# 1. Build image
docker build -t epic-jev .

# 2. Run locally
docker run -p 3000:3000 \
  -e AI_GATEWAY_API_KEY=your_key \
  epic-jev

# 3. Deploy to Docker Hub
docker tag epic-jev:latest username/epic-jev:latest
docker push username/epic-jev:latest

# 4. Deploy anywhere (AWS, GCP, Azure, etc.)
```

**Dockerfile:**
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .

ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start"]
```

---

### Option 5: AWS (Lambda + API Gateway)

**Pros:** Scalable, enterprise-ready  
**Cons:** Complex setup

```bash
# 1. Install Serverless Framework
npm install -g serverless

# 2. Initialize AWS credentials
serverless config credentials --provider aws

# 3. Create serverless.yml
cat > serverless.yml << EOF
service: epic-jev

provider:
  name: aws
  runtime: nodejs18.x
  environment:
    AI_GATEWAY_API_KEY: ${ssm:/epic-jev/api-key}

functions:
  api:
    handler: server.handler
    events:
      - http:
          path: /{proxy+}
          method: ANY
          cors: true
EOF

# 4. Deploy
serverless deploy
```

---

## 🔐 Environment Variable Management

### Local Development
```bash
# Create .env file (NOT committed to git)
echo "AI_GATEWAY_API_KEY=vcp_xxxxx" > .env

# .gitignore already includes .env
npm start
```

### Production Deployment

#### Vercel
```bash
# Via CLI
vercel env add AI_GATEWAY_API_KEY
vercel deploy --prod

# Or via Dashboard
# Settings → Environment Variables
```

#### Cloudflare
```bash
# Via CLI
wrangler secret put AI_GATEWAY_API_KEY

# Or in wrangler.toml
[env.production]
vars = { AI_GATEWAY_API_KEY = "vcp_xxxxx" }
```

#### Heroku
```bash
heroku config:set AI_GATEWAY_API_KEY=vcp_xxxxx
heroku config  # Verify
```

#### Docker/Self-Hosted
```bash
# Pass as environment variable
docker run -e AI_GATEWAY_API_KEY=vcp_xxxxx epic-jev

# Or create .env file
docker run --env-file .env epic-jev
```

---

## 📊 Monitoring & Logging

### Vercel
```bash
# View logs
vercel logs epic-jev

# Stream live logs
vercel logs epic-jev --follow
```

### Heroku
```bash
# View logs
heroku logs -t

# View specific app
heroku logs -n 100 --app epic-jev
```

### Cloudflare
```bash
# View logs via dashboard
# Workers → epic-jev → Logs
```

---

## 🧪 Post-Deployment Testing

### Test Health Endpoint
```bash
curl https://your-deployed-url.com/health
```

### Test API Endpoint
```bash
curl -X POST https://your-deployed-url.com/api/jev \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Test sentiment analysis",
    "type": "sentiment"
  }'
```

### Full Integration Test
```bash
# Visit in browser
https://your-deployed-url.com

# Test each tab and demo
# Verify real-time streaming works
# Check both core and content analysis tabs
```

---

## 🔄 CI/CD Pipeline

### GitHub Actions Example

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Deploy to Vercel
        run: |
          npm install -g vercel
          vercel deploy --prod --token ${{ secrets.VERCEL_TOKEN }}
        env:
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
```

### GitLab CI Example

```yaml
# .gitlab-ci.yml
deploy:
  stage: deploy
  script:
    - npm install -g wrangler
    - wrangler deploy
  environment:
    name: production
    url: https://epic-jev.unruly-capricorn.workers.dev
```

---

## 📈 Scaling Considerations

### For High Traffic

1. **Enable Response Caching**
   ```javascript
   app.use(compression());
   app.set('view cache', true);
   ```

2. **Add Rate Limiting**
   ```javascript
   import rateLimit from 'express-rate-limit';
   
   const limiter = rateLimit({
     windowMs: 15 * 60 * 1000,
     max: 100
   });
   
   app.use('/api/', limiter);
   ```

3. **Database Persistence**
   - Add MongoDB/PostgreSQL for request history
   - Cache responses for repeated queries

4. **Load Balancing**
   - Deploy multiple instances
   - Use nginx reverse proxy
   - Vercel handles this automatically

---

## 🆘 Troubleshooting

### API Key Not Working
```bash
# Verify environment variable is set
# Vercel
vercel env ls

# Heroku
heroku config

# Cloudflare
wrangler secret list

# Docker
docker inspect epic-jev | grep AI_GATEWAY_API_KEY
```

### Demo Mode When Should Be Real
```
Problem: Still seeing demo responses
Solution: 
  1. Check API key is set
  2. Check server logs for errors
  3. Verify API key is valid
  4. Restart server after setting env var
```

### Streaming Not Working
```
Problem: Output not streaming, appears all at once
Solution:
  1. Check Content-Type header (should be text/event-stream)
  2. Verify client is using EventSource or fetch().body.getReader()
  3. Check for proxies stripping streaming headers
```

### Timeout Issues
```
Problem: Requests timeout after 30s
Solution:
  - Vercel: Increase timeout (up to 60s on Pro)
  - Heroku: Use Procfile to set timeout
  - Cloudflare: Set timeout in wrangler.toml
  - Self-hosted: Configure nginx/reverse proxy timeout
```

---

## 🎯 Performance Optimization

### Response Caching
```javascript
// Cache sentiment analysis for 1 hour
app.post('/api/jev', (req, res) => {
  const cacheKey = `${req.body.type}:${req.body.prompt}`;
  
  if (cache.has(cacheKey)) {
    return res.send(cache.get(cacheKey));
  }
  
  // ... normal processing
  cache.set(cacheKey, response, 3600);
});
```

### Batch Requests
```javascript
// Accept array of prompts for bulk processing
app.post('/api/jev/batch', async (req, res) => {
  const { items } = req.body;
  
  const results = await Promise.all(
    items.map(item => processJev(item))
  );
  
  res.json(results);
});
```

### Compression
```javascript
import compression from 'compression';
app.use(compression());
```

---

## 📋 Deployment Checklist

- [ ] API key obtained and tested locally
- [ ] .env file created and .gitignore updated
- [ ] All demos tested in demo mode
- [ ] Sensitive data removed from code
- [ ] Environment variable configured on platform
- [ ] App deployed successfully
- [ ] Health endpoint responds
- [ ] API endpoint tested with real requests
- [ ] UI loads and streams work
- [ ] Multiple capability types tested
- [ ] Monitoring/logging configured
- [ ] Error handling verified
- [ ] Performance acceptable
- [ ] Ready for production traffic

---

## 🚀 One-Click Deploy Buttons

### Vercel
```markdown
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-repo/epic-jev&env=AI_GATEWAY_API_KEY)
```

### Heroku
```markdown
[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/your-repo/epic-jev)
```

---

## 📚 Additional Resources

- **Vercel Deployment Docs:** https://vercel.com/docs/concepts/deployments/overview
- **Cloudflare Workers:** https://developers.cloudflare.com/workers/
- **Heroku Node.js Support:** https://devcenter.heroku.com/articles/nodejs-support
- **Docker Best Practices:** https://docs.docker.com/develop/develop-images/dockerfile_best-practices/

---

**Epic Jev** • Deployed and Production-Ready 🚀
