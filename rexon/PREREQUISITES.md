# REXON — Prerequisites & Setup Checklist

## What You Need Before Starting

---

### 1. ACCOUNTS (All Free)

| Service | Purpose | Sign Up |
|---|---|---|
| **GitHub** | Host code + run tests via Actions | github.com |
| **Supabase** | Database + Realtime streaming | supabase.com |
| **Cloudflare** | Store screenshots/traces (R2) | cloudflare.com |
| **Railway** | Host the backend API | railway.app |
| **Vercel** | Host the frontend UI | vercel.com |
| **Anthropic** | Claude AI (you have Pro ✓) | Already done |

---

### 2. SOFTWARE ON YOUR MACHINE

```
Node.js v20+        → nodejs.org
Git                 → git-scm.com
npm (comes with Node)
```

Verify with:
```bash
node --version    # should be v20+
npm --version     # should be 9+
git --version
```

Optional but helpful:
```
VS Code           → code.visualstudio.com
Railway CLI       → npm install -g @railway/cli
Vercel CLI        → npm install -g vercel
```

---

### 3. KEYS & TOKENS YOU NEED TO COLLECT

Work through each service and collect these values:

#### A) Anthropic (Claude API Key)
1. Go to console.anthropic.com
2. Settings → API Keys → Create Key
3. Copy: `sk-ant-api03-...`

#### B) Supabase
1. supabase.com → New Project
2. Run `supabase/schema.sql` in SQL Editor
3. Settings → API → copy:
   - `Project URL` → `https://xxx.supabase.co`
   - `anon public` key

#### C) Cloudflare R2
1. Cloudflare Dashboard → R2 → Create Bucket: `rexon-artifacts`
2. R2 → Manage R2 API Tokens → Create Token (Object Read & Write)
3. Copy:
   - Access Key ID
   - Secret Access Key
   - Endpoint URL: `https://<account_id>.r2.cloudflarestorage.com`
4. Make bucket public: R2 → bucket → Settings → Public Access → Allow

#### D) GitHub Personal Access Token
1. GitHub → Settings → Developer Settings → Personal Access Tokens → Fine-grained
2. Permissions needed: `Actions: Read and Write`
3. Copy the token: `github_pat_...`

---

### 4. GITHUB REPOSITORY SETUP

```bash
# Create new repo on github.com named "rexon"
# Then:
cd rexon
git init
git add .
git commit -m "Initial REXON setup"
git remote add origin https://github.com/YOUR_USERNAME/rexon.git
git push -u origin main
```

Then add these **6 GitHub Secrets** (repo → Settings → Secrets → Actions):

| Secret Name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-...` |
| `SUPABASE_URL` | `https://xxx.supabase.co` |
| `SUPABASE_KEY` | your anon key |
| `R2_ENDPOINT` | `https://xxx.r2.cloudflarestorage.com` |
| `R2_ACCESS_KEY` | your R2 access key |
| `R2_SECRET_KEY` | your R2 secret key |
| `R2_BUCKET_NAME` | `rexon-artifacts` |

---

### 5. ENVIRONMENT FILES

Copy and fill in `.env.example` → `.env` in each folder:

**backend/.env**
```
ANTHROPIC_API_KEY=sk-ant-...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=your-anon-key
CLOUDFLARE_R2_ENDPOINT=https://xxx.r2.cloudflarestorage.com
CLOUDFLARE_R2_ACCESS_KEY=...
CLOUDFLARE_R2_SECRET_KEY=...
R2_BUCKET_NAME=rexon-artifacts
GITHUB_TOKEN=ghp_...
GITHUB_OWNER=your-username
GITHUB_REPO=rexon
PORT=3001
```

**test-runner/.env**
```
ANTHROPIC_API_KEY=sk-ant-...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=your-anon-key
CLOUDFLARE_R2_ENDPOINT=https://xxx.r2.cloudflarestorage.com
CLOUDFLARE_R2_ACCESS_KEY=...
CLOUDFLARE_R2_SECRET_KEY=...
R2_BUCKET_NAME=rexon-artifacts
```

**frontend/.env**
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_BACKEND_URL=https://your-app.railway.app
```

---

### 6. DEPLOY BACKEND TO RAILWAY

```bash
cd backend
npm install
railway login
railway init        # select "Empty Project"
railway up          # deploys
# Add all .env variables in Railway dashboard → Variables
```

Copy the Railway URL (e.g. `https://rexon-backend.railway.app`) → put in frontend `.env` as `VITE_BACKEND_URL`

---

### 7. DEPLOY FRONTEND TO VERCEL

```bash
cd frontend
npm install
vercel --prod
# Add .env variables in Vercel dashboard → Settings → Environment Variables
```

---

### 8. EXCEL FILE FORMAT

Your Excel file needs these columns (row 1 = headers):

| Test Name | URL | Action | Selector | Value | Condition | Description |
|---|---|---|---|---|---|---|
| Login Test | https://app.com/login | navigate | | | | Open page |
| Login Test | | fill | #email | user@test.com | | Enter email |
| Login Test | | click | button[type=submit] | | | Submit |
| Login Test | | expect | .dashboard | | visible | Check redirect |

**Supported actions:**
- `navigate` — go to URL
- `fill` — type into input
- `click` — click element
- `expect` — assert element state
- `select` — choose dropdown option
- `hover` — mouse over element
- `wait` — pause execution
- `screenshot` — capture screenshot

---

### 9. QUICK TEST CHECKLIST

Before first run, verify:
- [ ] Supabase schema SQL has been run
- [ ] R2 bucket is public
- [ ] All 7 GitHub secrets are set
- [ ] Backend deployed to Railway and responding at `/health`
- [ ] Frontend deployed to Vercel
- [ ] GitHub Actions workflow file is in `.github/workflows/run-tests.yml`

---

### 10. FIRST RUN

1. Open your Vercel frontend URL
2. Click **+ NEW RUN**
3. Upload the included `sample-test-cases.xlsx` OR download the template
4. Watch scripts generate via Claude
5. Watch GitHub Actions run Playwright
6. See live results stream back

---

## Cost Summary

| Service | Your Cost |
|---|---|
| Claude API | $0 (Claude Pro included) |
| GitHub Actions | $0 (2,000 min/month free) |
| Supabase | $0 (free tier) |
| Cloudflare R2 | $0 (10GB free) |
| Railway | ~$0-5/month |
| Vercel | $0 (hobby tier) |
| **TOTAL** | **~$0/month** |
