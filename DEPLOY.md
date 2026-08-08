# 🚀 Deploying to Vercel — HCL RAG Chatbot

This guide walks you through deploying this project to Vercel with MongoDB Atlas as the cloud database.

---

## Prerequisites

- A [GitHub](https://github.com) account
- A [Vercel](https://vercel.com) account (free)
- A [MongoDB Atlas](https://www.mongodb.com/atlas) account (free)
- A [Google AI Studio](https://aistudio.google.com) Gemini API Key

---

## Step 1 — Set Up MongoDB Atlas (Cloud Database)

> ⚠️ Vercel cannot connect to `localhost` MongoDB. You **must** use Atlas.

1. Go to [mongodb.com/atlas](https://www.mongodb.com/atlas) and sign up / log in
2. Create a **free M0 cluster** (choose any region)
3. Go to **Database Access** → Add a new database user:
   - Username: e.g. `raguser`
   - Password: e.g. `MySecret123`
   - Role: **Read and Write to any database**
4. Go to **Network Access** → Click **Add IP Address** → Select **Allow Access from Anywhere** (`0.0.0.0/0`)
5. Go to your cluster → Click **Connect** → **Drivers** → Copy the URI:
   ```
   mongodb+srv://raguser:MySecret123@cluster0.xxxxx.mongodb.net/hcl_rag
   ```
   > Replace `<password>` with your actual password. Keep `hcl_rag` as the database name.

---

## Step 2 — Push Code to GitHub

Open a terminal in your project folder and run:

```bash
git init
git add .
git commit -m "Initial commit — HCL RAG Chatbot"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

> Replace `YOUR_USERNAME` and `YOUR_REPO_NAME` with your actual GitHub username and repository name.

---

## Step 3 — Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and **Sign in with GitHub**
2. Click **Add New Project**
3. Click **Import** next to your GitHub repository
4. Vercel will auto-detect the `vercel.json` — **do not change any framework settings**
5. Before clicking Deploy, scroll to **Environment Variables** and add the following:

| Variable Name    | Value                                              |
|------------------|----------------------------------------------------|
| `GEMINI_API_KEY` | Your Gemini API key from aistudio.google.com       |
| `MONGODB_URI`    | The Atlas connection string from Step 1            |
| `AUTH_USERNAME`  | Admin username fallback (e.g. `admin`)             |
| `AUTH_PASSWORD`  | Admin password fallback (e.g. `secret123`)         |

6. Click **Deploy** ✅

Your app will be live at `https://YOUR_REPO_NAME.vercel.app` in ~1 minute.

---

## Step 4 — Auto-Deploy on Every Push

Once your GitHub repo is linked to Vercel, **every `git push` triggers an automatic redeployment**. No extra setup needed.

```bash
# Make your changes, then:
git add .
git commit -m "your update message"
git push
# Vercel redeploys automatically in ~30 seconds
```

---

## Environment Variables Reference

| Variable         | Required | Description |
|------------------|----------|-------------|
| `GEMINI_API_KEY` | Yes      | Google Gemini API key for AI responses |
| `MONGODB_URI`    | Yes      | MongoDB Atlas connection URI |
| `AUTH_USERNAME`  | Optional | Fallback admin username (default: `admin`) |
| `AUTH_PASSWORD`  | Optional | Fallback admin password (default: `password`) |

---

## Project Structure (Vercel Architecture)

```
project/
├── api/                        <- Vercel Serverless Functions
│   ├── lib/
│   │   ├── db.ts               <- MongoDB connection (with serverless caching)
│   │   ├── models.ts           <- Mongoose models
│   │   ├── auth.ts             <- Authentication helper
│   │   └── rag.ts              <- RAG chunking & retrieval logic
│   ├── login.ts                <- POST /api/login
│   ├── signup.ts               <- POST /api/signup
│   ├── forgot-password/        <- Password reset flow
│   ├── sources/                <- Knowledge source CRUD
│   └── chat/                   <- Chat + history endpoints
├── src/                        <- React frontend (unchanged)
├── vercel.json                 <- Vercel config (routing + CORS)
├── package.json
└── DEPLOY.md                   <- This file
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| **MongoDB connection fails** | Ensure `0.0.0.0/0` is in Atlas Network Access. Check URI has no `<password>` placeholder |
| **Build fails on Vercel** | Check that all required env vars are set in Vercel dashboard |
| **API returns 401** | `AUTH_USERNAME` / `AUTH_PASSWORD` must match what you use to log in |
| **Blank white page** | Open browser DevTools → Console — check for a missing env var error |
| **File uploads fail** | Vercel has a 4.5MB request body limit on serverless functions. Keep files under 4MB |

---

## Local Development

The original `server.ts` Express server still works locally. Use:

```bash
npm run dev
```

Local dev uses your `.env` file. Vercel deployment uses env vars set in the dashboard.

> Never commit your `.env` file — it is already in `.gitignore`.
