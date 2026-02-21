# REXON — AI Test Automation Platform

Self-healing Playwright test runner powered by Claude AI.  
**100% free stack** — Claude Pro + GitHub Actions + Supabase + Cloudflare R2 + Railway + Vercel.

---

## Architecture

```
User → Frontend (Vercel)
     → Backend (Railway) → Claude API (generate scripts)
     → GitHub Actions    → Playwright runner
                         → Fail? Claude heals selectors → retry
                         → Cloudflare R2 (artifacts)
                         → Supabase (DB + Realtime)
     → Frontend streams live results via Supabase Realtime
```

---

## Quick Start

### 1. Clone & install
```bash
git clone <your-repo>
cd rexon

# Backend
cd backend && npm install

# Test Runner
cd ../test-runner && npm install

# Frontend
cd ../frontend && npm install
```

### 2. Set up Supabase
1. Go to https://supabase.com → New project
2. Run `supabase/schema.sql` in the SQL editor
3. Copy your Project URL and anon key

### 3. Set up Cloudflare R2
1. Go to Cloudflare Dashboard → R2 → Create bucket: `rexon-artifacts`
2. Create API token with R2 read/write permissions
3. Note your endpoint: `https://<account_id>.r2.cloudflarestorage.com`

### 4. Configure environment variables

**backend/.env**
```
ANTHROPIC_API_KEY=sk-ant-...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=your_anon_key
CLOUDFLARE_R2_ENDPOINT=https://xxx.r2.cloudflarestorage.com
CLOUDFLARE_R2_ACCESS_KEY=your_key
CLOUDFLARE_R2_SECRET_KEY=your_secret
R2_BUCKET_NAME=rexon-artifacts
GITHUB_TOKEN=ghp_...
GITHUB_OWNER=your_github_username
GITHUB_REPO=rexon
PORT=3001
```

**test-runner/.env** (same values)
```
ANTHROPIC_API_KEY=sk-ant-...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=your_anon_key
CLOUDFLARE_R2_ENDPOINT=https://xxx.r2.cloudflarestorage.com
CLOUDFLARE_R2_ACCESS_KEY=your_key
CLOUDFLARE_R2_SECRET_KEY=your_secret
R2_BUCKET_NAME=rexon-artifacts
```

**frontend/.env**
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_BACKEND_URL=https://your-railway-app.railway.app
```

### 5. Add GitHub Secrets
In your repo → Settings → Secrets → Actions, add:
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `ANTHROPIC_API_KEY`
- `R2_ENDPOINT`
- `R2_ACCESS_KEY`
- `R2_SECRET_KEY`
- `R2_BUCKET_NAME`

### 6. Deploy

**Backend → Railway**
```bash
npm install -g @railway/cli
cd backend
railway login && railway init && railway up
```

**Frontend → Vercel**
```bash
npm install -g vercel
cd frontend
vercel --prod
```

### 7. Run locally
```bash
docker-compose up
# Frontend:
cd frontend && npm run dev
```

---

## Test Case Format (JSON upload)

```json
[
  {
    "name": "Login Test",
    "url": "https://example.com/login",
    "steps": [
      { "action": "fill", "selector": "#email", "value": "user@test.com" },
      { "action": "fill", "selector": "#password", "value": "password123" },
      { "action": "click", "selector": "button[type=submit]" },
      { "action": "expect", "selector": ".dashboard", "condition": "visible" }
    ]
  }
]
```

---

## Self-Healing Flow

1. Test fails with selector error
2. Claude receives: failed selector + DOM snapshot + error message
3. Claude returns new selector + reasoning
4. Script is patched automatically
5. Test retries once with healed selector
6. Result marked as `healed: true` in DB

---

## Cost Breakdown

| Service | Free Tier |
|---|---|
| Claude API | Included in Claude Pro |
| GitHub Actions | 2,000 min/month |
| Supabase | 500MB DB, 1GB storage |
| Cloudflare R2 | 10GB storage, 10M requests |
| Railway | $5 credit/month (covers small apps) |
| Vercel | Unlimited hobby projects |
