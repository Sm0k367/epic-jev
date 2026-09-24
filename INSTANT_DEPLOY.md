# 🚀 Epic Jev - Instant Deployment Options

Choose your deployment method below. All options are production-ready!

---

## ⚡ Option 1: Render.com (Easiest - 3 minutes)

**Pros:** Free tier, super easy, auto-deploys from git  
**Cons:** Free tier has compute limits

### Steps:

1. **Push to GitHub** (if not already there)
   ```bash
   cd /tmp/epic-jev
   git init
   git add .
   git commit -m "Initial commit: Epic Jev"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/epic-jev.git
   git push -u origin main
   ```

2. **Go to Render.com**
   - Visit https://render.com
   - Sign up with GitHub
   - Click "New +"
   - Select "Web Service"
   - Connect your epic-jev repo

3. **Configure**
   - Name: `epic-jev`
   - Environment: `Node`
   - Build Command: `npm ci`
   - Start Command: `npm start`
   - Environment Variables:
     - Key: `AI_GATEWAY_API_KEY`
     - Value: `vcp_your_key_here`

4. **Deploy**
   - Click "Create Web Service"
   - Wait 2-3 minutes
   - Get live URL!

**Result:** https://epic-jev.onrender.com (example)

---

## ✨ Option 2: Vercel.com (Popular - 5 minutes)

**Pros:** Fast, great for Node.js, scalable  
**Cons:** Requires account

### Steps:

1. **Connect GitHub**
   - Visit https://vercel.com
   - Click "New Project"
   - Import your GitHub repo

2. **Configure**
   - Framework: Other (Node.js)
   - Build Command: `npm ci`
   - Start Command: `npm start`
   - Environment Variables:
     - `AI_GATEWAY_API_KEY` = `vcp_your_key_here`

3. **Deploy**
   - Click "Deploy"
   - Wait ~60 seconds
   - Get live URL!

**Result:** https://epic-jev.vercel.app (example)

---

## 🐳 Option 3: Docker (Local or Cloud - 10 minutes)

**Pros:** Full control, works anywhere  
**Cons:** Need Docker installed

### Build Locally:

```bash
cd /tmp/epic-jev

# Build image
docker build -t epic-jev:latest .

# Test locally
docker run -p 3000:3000 \
  -e AI_GATEWAY_API_KEY=vcp_your_key_here \
  epic-jev:latest

# Visit http://localhost:3000
```

### Deploy to Cloud:

#### Docker Hub (Free)
```bash
# Tag image
docker tag epic-jev:latest your-username/epic-jev:latest

# Push to Docker Hub
docker push your-username/epic-jev:latest

# Now deploy anywhere that runs Docker images
```

#### AWS (EC2)
```bash
# Launch EC2 instance with Docker
# Then:
docker pull your-username/epic-jev:latest
docker run -p 80:3000 \
  -e AI_GATEWAY_API_KEY=vcp_your_key_here \
  your-username/epic-jev:latest
```

#### Google Cloud Run
```bash
# Push to Google Container Registry
docker tag epic-jev:latest gcr.io/your-project/epic-jev:latest
docker push gcr.io/your-project/epic-jev:latest

# Deploy
gcloud run deploy epic-jev \
  --image gcr.io/your-project/epic-jev:latest \
  --platform managed \
  --region us-central1 \
  --set-env-vars AI_GATEWAY_API_KEY=vcp_your_key_here
```

#### Azure Container Instances
```bash
az container create \
  --resource-group myResourceGroup \
  --name epic-jev \
  --image your-username/epic-jev:latest \
  --cpu 1 --memory 1 \
  --ports 80 \
  --environment-variables AI_GATEWAY_API_KEY=vcp_your_key_here
```

---

## 🏠 Option 4: Self-Hosted (Heroku Alternative)

**Pros:** Complete control, permanent  
**Cons:** Need server, ongoing maintenance

### Using Railway.app (Like Heroku):

1. **Push to GitHub**
2. **Go to https://railway.app**
3. **Click "New Project"**
4. **Select "Deploy from GitHub repo"**
5. **Add environment variable:** `AI_GATEWAY_API_KEY`
6. **Deploy!**

### Using your own server:

```bash
# SSH into server
ssh user@your-server.com

# Clone repo
git clone https://github.com/your-username/epic-jev.git
cd epic-jev

# Install dependencies
npm ci --production

# Set environment
export AI_GATEWAY_API_KEY=vcp_your_key_here

# Run with PM2 (keeps running)
npm install -g pm2
pm2 start server.js --name epic-jev
pm2 save

# Set up reverse proxy (nginx)
# Point nginx to http://localhost:3000
```

---

## 🔧 Comparison

| Option | Setup Time | Cost | Scaling | Best For |
|--------|-----------|------|---------|----------|
| **Render** | 3 min | Free | Good | Beginners |
| **Vercel** | 5 min | Free tier | Excellent | Production |
| **Docker** | 10 min | Varies | Manual | Control |
| **Railway** | 5 min | Paid | Good | Easy hosting |
| **Self-hosted** | 20 min | $5-50/mo | Manual | Full control |

---

## 🚀 Quick Start (Render.com - Recommended)

### 1. Get API Key (2 min)
```bash
# Option A: Vercel AI Gateway (free tier available)
# https://vercel.com/dashboard/ai-gateway/keys

# Option B: TypeSafe Console (early access)
# https://console.typesafe.ai/settings/keys
```

### 2. Create GitHub Repo (2 min)
```bash
cd /tmp/epic-jev
git init
git add .
git commit -m "Initial: Epic Jev"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/epic-jev.git
git push -u origin main
```

### 3. Deploy to Render (2 min)
- Visit https://render.com
- Sign up with GitHub
- Create new Web Service
- Select your epic-jev repo
- Add `AI_GATEWAY_API_KEY` environment variable
- Click "Deploy"

### 4. Done! ✅
- Get live URL from Render dashboard
- Share with friends
- Add to portfolio

**Total time: ~5 minutes**

---

## 📊 Environment Variables

All deployments need this ONE environment variable:

```
AI_GATEWAY_API_KEY=vcp_your_key_here
```

Without it, the app runs in **demo mode** (simulated responses).  
With it, the app uses **real Jev model** (actual AI).

### How to get API key:

**Option 1: Vercel AI Gateway** (Recommended)
1. Go to https://vercel.com/dashboard/ai-gateway/keys
2. Create new API key
3. Copy and save

**Option 2: TypeSafe Console** (Early Access)
1. Go to https://console.typesafe.ai/settings/keys
2. Request early access
3. Create API key

**Option 3: Run in Demo Mode** (No key needed!)
- Just leave `AI_GATEWAY_API_KEY` empty
- App works perfectly with simulated responses

---

## ✅ Verification Checklist

After deploying, verify everything works:

### 1. Health Check
```bash
curl https://your-deployed-url.com/health
# Should return: {"status":"ok"}
```

### 2. Test API
```bash
curl -X POST https://your-deployed-url.com/api/jev \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Is Python popular?",
    "type": "evaluation"
  }'
```

### 3. Test UI
- Visit https://your-deployed-url.com in browser
- Try each of the 12 capabilities
- Verify real-time streaming works

### 4. Check Logs
- Render: Dashboard → Logs
- Vercel: Dashboard → Logs
- Docker: `docker logs container-id`

---

## 🆘 Troubleshooting

### Issue: Still in demo mode after deploying

**Solution:**
1. Verify `AI_GATEWAY_API_KEY` is set in deployment platform
2. Restart/redeploy the application
3. Check server logs for API key loading
4. Try with valid API key

### Issue: Application won't start

**Solution:**
1. Check logs for errors
2. Verify `npm install` ran successfully
3. Confirm `npm start` command is correct
4. Check for port conflicts

### Issue: Slow responses

**Solution:**
1. First request may be slow (cold start)
2. Check API key rate limits
3. Try restarting application
4. Upgrade to paid tier if needed

### Issue: 502 Bad Gateway

**Solution:**
1. Wait 30 seconds for deployment to complete
2. Check if application is running
3. Verify environment variables are set
4. Check server logs

---

## 📈 Scaling Considerations

### Free Tier Limits:
- Render: 0.5 CPU, 512MB RAM (fine for demo)
- Vercel: 10GB/month data transfer
- Railway: $5/month credit

### For Production Scale:
1. Upgrade to paid tier
2. Add caching layer (Redis)
3. Implement rate limiting
4. Set up monitoring & alerts
5. Use CDN for static assets

---

## 🔄 Continuous Deployment

Both Render and Vercel auto-deploy when you push to GitHub:

```bash
# Make changes locally
nano server.js

# Commit and push
git add .
git commit -m "Improve feature"
git push origin main

# Automatically deploys within seconds!
```

---

## 📞 Support

- **Render Support:** https://render.com/docs
- **Vercel Support:** https://vercel.com/docs
- **Docker Support:** https://docs.docker.com
- **Railway Support:** https://railway.app/docs

---

## 🎉 You're Ready to Deploy!

Choose your platform above and follow the steps.

**Recommended for beginners:** Render.com (3 minutes, free)  
**Recommended for production:** Vercel (5 minutes, scalable)  
**Recommended for control:** Docker (10 minutes, portable)

---

**Epic Jev** • Do Anything with AI • Now Live! 🚀
