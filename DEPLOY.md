# Climate Studio Deployment Guide

## Overview
This app has 3 parts:
1. **Frontend** (React + Vite) → Deploy to **GitHub Pages**
2. **Node.js Backend** (Express API for NOAA tiles) → Deploy to **Railway or Render**
3. **Python Backend** (Climate data server) → Deploy to **Render**

---

## PART 1: Deploy Frontend to GitHub Pages

### Prerequisites
- GitHub account
- Git configured with SSH or Personal Access Token

### Steps

1. **Enable GitHub Pages**
   - Go to: https://github.com/joshimal/climate-studio/settings/pages
   - Under "Build and deployment" → "Source": Select **"GitHub Actions"**
   - Click Save

2. **Deploy using gh-pages package** (Option A - Direct deploy):
   ```bash
   cd frontend
   npm run deploy
   ```
   
   OR **Push to trigger GitHub Actions** (Option B - Automatic):
   ```bash
   git add .
   git commit -m "Deploy to GitHub Pages"
   git push
   ```

3. **Your site will be live at:**
   ```
   https://joshimal.github.io/climate-studio/
   ```

---

## PART 2: Deploy Node.js Backend (NOAA Tiles)

### Option A: Railway (Recommended - Easiest)

1. Go to https://railway.app/
2. Click "New Project" → "Deploy from GitHub repo"
3. Select `joshimal/climate-studio`
4. **Settings:**
   - **Root Directory**: `backend`
   - **Start Command**: `node server.js`
   - **Port**: Railway auto-assigns (use process.env.PORT)

5. **Add Environment Variables** (if any in backend/.env):
   - Click "Variables" tab
   - Add any required env vars

6. Copy your deployment URL (e.g., `https://climate-studio-backend.up.railway.app`)

### Option B: Render

1. Go to https://render.com/
2. Click "New +" → "Web Service"
3. Connect your GitHub repo
4. **Settings:**
   - **Name**: `climate-studio-backend`
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: Free

5. Copy your deployment URL (e.g., `https://climate-studio-backend.onrender.com`)

---

## PART 3: Deploy Python Climate Server

### Using Render (Supports Python)

1. Go to https://render.com/
2. Click "New +" → "Web Service"
3. Connect your GitHub repo
4. **Settings:**
   - **Name**: `climate-studio-python`
   - **Root Directory**: `qgis-processing` (or leave empty)
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python climate_server.py`

5. **Environment Variables:**
   ```
   PORT=5001
   EARTHENGINE_PROJECT=josh-geo-the-second
   ```

6. Copy your deployment URL (e.g., `https://climate-studio-python.onrender.com`)

---

## PART 4: Connect Frontend to Backends

After deploying both backends, you need to tell your frontend where they are.

### Method 1: Using GitHub Secrets (Recommended)

1. Go to: https://github.com/joshimal/climate-studio/settings/secrets/actions

2. Click "New repository secret" and add:
   - **Name**: `VITE_NODE_BACKEND_URL`
     **Value**: `https://your-node-backend.railway.app`
   
   - **Name**: `VITE_BACKEND_URL`
     **Value**: `https://your-python-backend.onrender.com`

3. The GitHub Actions workflow is already configured to use these secrets!

### Method 2: Using .env.production file

Create `frontend/.env.production`:
```bash
VITE_NODE_BACKEND_URL=https://your-node-backend.railway.app
VITE_BACKEND_URL=https://your-python-backend.onrender.com
```

Then commit and push:
```bash
git add frontend/.env.production
git commit -m "Add production environment variables"
git push
```

---

## PART 5: Verify Deployment

### Check Frontend Loading

1. **Open your GitHub Pages site:**
   ```
   https://joshimal.github.io/climate-studio/
   ```

2. **Open Browser DevTools** (F12 → Console)
   - Should see no 404 errors for JS/CSS files
   - Paths should be `/climate-studio/assets/...`

3. **Check Network Tab**:
   - Look for requests to your backend URLs
   - Should see successful API calls (200 status)

### Check Backend Health

Test your backends directly:

**Node.js Backend:**
```bash
curl https://your-node-backend.railway.app/health
# Or open in browser
```

**Python Backend:**
```bash
curl https://your-python-backend.onrender.com/health
# Or open in browser
```

---

## Local Development

Your local setup is already configured correctly!

### Start all services:

**Terminal 1 - Node.js Backend:**
```bash
cd backend
npm run dev
# Runs on http://localhost:3001
```

**Terminal 2 - Python Backend:**
```bash
cd qgis-processing
PORT=5001 EARTHENGINE_PROJECT='josh-geo-the-second' python3 climate_server.py
# Runs on http://localhost:5001
```

**Terminal 3 - Frontend:**
```bash
cd frontend
npm run dev
# Runs on http://localhost:8080
```

The frontend proxy in `vite.config.js` (lines 23-28) automatically forwards `/api/*` requests to `http://localhost:3001` during development.

---

## Troubleshooting

### Frontend shows blank page
1. Check browser console for errors
2. Verify assets load from `/climate-studio/assets/...`
3. Check `base` setting in `vite.config.js` is `/climate-studio/`

### API requests fail
1. Check environment variables are set correctly
2. Verify backend URLs in GitHub Secrets
3. Check CORS settings in backend allow your GitHub Pages domain

### gh-pages deploy fails
1. Set up SSH: `git remote set-url origin git@github.com:joshimal/climate-studio.git`
2. Or use Personal Access Token when prompted for password

---

## Quick Reference

**Frontend URL**: https://joshimal.github.io/climate-studio/
**GitHub Repo**: https://github.com/joshimal/climate-studio
**GitHub Pages Settings**: https://github.com/joshimal/climate-studio/settings/pages
**GitHub Secrets**: https://github.com/joshimal/climate-studio/settings/secrets/actions

**Key Files**:
- `frontend/vite.config.js` - Build configuration
- `frontend/package.json` - Deploy script (line 11)
- `frontend/.env` - Local environment variables
- `.github/workflows/deploy.yml` - Auto-deployment workflow
- `backend/server.js` - Node.js API server
- `qgis-processing/climate_server.py` - Python climate server
