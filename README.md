# NourishAI — Food, Calories & AI Nutrition Coach

A modern food & nutrition web app built with **Next.js 14 + TypeScript + Tailwind**, with an AI agent powered by **Groq** (Llama 3.3 70B by default — fast + free tier). Designed for users who want to lose, gain, or maintain weight with personalized calorie targets, daily food tracking, a 7-day AI-generated meal plan, and a nutrition chat coach.

## Features

- **Smart profile** — Mifflin-St Jeor BMR, TDEE, and target calorie calculator
- **Food tracker** — log foods by the gram; live macro progress bars vs your targets
- **7-day AI meal plan** — Groq builds a week of meals hitting your calorie + protein goals, tailored to your dietary preferences (uses JSON-mode for reliable output)
- **AI nutrition coach** — streaming chat that knows your profile and today's logs, suggests specific foods with macros
- **Class workbook** (`/class-workbook`) — in-class notes + class assistant (same Groq key). Link to **Day 03 — AI Builder** slides at **`/`** (site index; grading via `POST /api/foundry/grade`).
- **Food database** — 100+ whole foods and prepared meals with per-100g macros, searchable and filterable
- **Weight progress** — log weight over time with a Recharts line chart

All user data (profile, food logs, weight history) is stored in the **browser's localStorage** — no signup, no database, no server storage.

**Day 03 Foundry portal** (`POST /api/foundry/grade`, admin at `/foundry/admin`): on **production (Railway)** you should set **`DATABASE_URL`** to **managed Postgres** so submissions survive redeploys. Without it, submissions are only appended under `food-app/data/*.jsonl`, which the container discards on each deploy.

## Setup

### 1. Install dependencies

```bash
cd food-app
npm install
```

### 2. Add your Groq API key

Get a free key at https://console.groq.com/keys and put it in `food-app/.env.local`:

```
GROQ_API_KEY=gsk_...
```

The key is only used server-side inside Next.js API routes — it's never bundled into the browser.

Optionally override the model:

```
# Default is llama-3.3-70b-versatile (best quality)
# Faster / cheaper alternatives:
GROQ_MODEL=llama-3.1-8b-instant
# GROQ_MODEL=mixtral-8x7b-32768
```

### 3. Run the dev server

```bash
npm run dev
```

Visit http://localhost:3000 for the **Day 03 slide deck** (site index). The nutrition app dashboard is at http://localhost:3000/nourish. **QAF cohort ideation** is **not** a public route anymore — instructors regenerate it into `food-app/registry/qaf-product-ideation-registry.html` with **`npm run build:qaf-registry`** (Python 3, reads `vault/data/qaf-ideation/…csv`) and view it (after unlocking) under **`/foundry/admin` → QAF ideation registry**.

For Foundry grading locally you can add Postgres to `.env.local`:

```
DATABASE_URL=postgresql://user:pass@localhost:5432/nourish_local
```

Leave it unset to use JSONL under `data/` only (fine for local dev).

## Deploy to Railway

### Web app

1. Push this repo to GitHub.
2. On https://railway.app, click **New Project → Deploy from GitHub repo** and pick `nourishai`.
3. In the Next.js service **Variables** tab add `GROQ_API_KEY=gsk_...`.
4. Under **Settings → Networking**, click **Generate Domain**.

### Durable Foundry submissions (PostgreSQL)

Railway replaces the filesystem on each deploy, so **JSONL-only storage is not persistent** in production.

1. In the **same project**: **New → Database → PostgreSQL** (Railway’s managed DB includes automated backups).
2. On your **Next.js service** → **Variables** → **Add variable reference** → **`DATABASE_URL`** from the Postgres service (Railway injects the URL; you do not paste a database “token” into the app for normal operation).
3. **Redeploy** the web service. The first graded submission creates table `foundry_submissions` automatically.
4. Successful writes also append to `data/foundry-submissions.jsonl` and `…db-mirror.jsonl` as **best-effort mirrors** (those files can still be wiped on deploy — trust Postgres for history).
5. To **re-import** rows you still have on disk after adding Postgres:

   ```bash
   cd food-app
   DATABASE_URL='postgresql://…' npm run foundry:import-jsonl
   ```

   Or pass a path to a backup JSONL file as the first argument.

### Groq deploy helper (uses `RAILWAY_TOKEN`)

From this repo you can still run (uses `RAILWAY_TOKEN` + `GROQ_API_KEY` from env): `npm run railway:set-groq` — finds the **nourishai** service, sets `GROQ_*`, and redeploys if needed. That token is for the **Railway API**, not for SQL; database access is via **`DATABASE_URL`** on the service.

Railway auto-detects Next.js, runs `npm run build`, then `npm start`. Next.js reads `PORT` from the environment automatically — no extra config needed.

## Project Structure

```
food-app/
├─ app/
│  ├─ layout.tsx               # root: html + body only
│  ├─ (main)/layout.tsx        # Nourish nav, main, footer
│  ├─ (main)/nourish/page.tsx  # nutrition dashboard
│  ├─ (main)/profile/page.tsx
│  ├─ (main)/tracker/page.tsx
│  ├─ (main)/meal-plan/page.tsx
│  ├─ (main)/chat/page.tsx
│  ├─ (main)/class-workbook/page.tsx
│  ├─ (main)/foods/page.tsx
│  ├─ (main)/progress/page.tsx
│  ├─ foundry/day03/route.ts   # Day 03 deck HTML; `/` rewrites here
│  └─ api/                     # Groq + foundry grade + admin ideation-registry
├─ registry/
│  └─ qaf-product-ideation-registry.html  # built by build:qaf-registry (not public)
├─ components/                 # Nav, MacroBar, FoodSearch, WeightChart
├─ lib/
│  ├─ nutrition.ts             # BMR/TDEE/macro math
│  ├─ groq.ts                  # server-side Groq client
│  ├─ foundry-grade.ts
│  ├─ foundry-store.ts         # Foundry JSON + optional Postgres
│  ├─ store.ts                 # Zustand + localStorage
│  ├─ foods.json               # 100+ foods seed DB
│  └─ types.ts
└─ .env.local                  # your GROQ_API_KEY
```

## Tech Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS**
- **Recharts** for weight charts
- **Zustand** state management with localStorage persistence
- **groq-sdk** for fast Llama 3.3 70B inference (meal plan + chat)

## Scripts

| Command                      | Purpose                                                |
| ---------------------------- | ------------------------------------------------------ |
| `npm run dev`                | Start Next.js dev server                               |
| `npm run build`              | Production build                                       |
| `npm run start`              | Start production server                                |
| `npm run lint`               | Lint with Next.js ESLint config                       |
| `npm run railway:set-groq`   | Push `GROQ_*` to Railway via API (`RAILWAY_TOKEN`)     |
| `npm run foundry:import-jsonl` | Load `data/` JSONL into Postgres (`DATABASE_URL`)                   |
| `npm run foundry:smoke`        | Postgres schema + txn insert rollback (needs **`DATABASE_URL`**)     |
| `npm run foundry:smoke:full`   | Same + `--api --grade`: needs dev server running + **`GROQ_API_KEY`**  |
| `npm run foundry:smoke:railway-deploy` | Live test **production Railway** (uses **`RAILWAY_TOKEN`** to resolve app URL); grades + verifies admin count |

## Disclaimer

NourishAI is for educational purposes only. It is **not** a substitute for professional medical or dietary advice. Consult a registered dietitian or doctor for personalized medical nutrition therapy.
