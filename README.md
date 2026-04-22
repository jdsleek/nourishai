# NourishAI — Food, Calories & AI Nutrition Coach

A modern food & nutrition web app built with **Next.js 14 + TypeScript + Tailwind**, with an AI agent powered by **Groq** (Llama 3.3 70B by default — fast + free tier). Designed for users who want to lose, gain, or maintain weight with personalized calorie targets, daily food tracking, a 7-day AI-generated meal plan, and a nutrition chat coach.

## Features

- **Smart profile** — Mifflin-St Jeor BMR, TDEE, and target calorie calculator
- **Food tracker** — log foods by the gram; live macro progress bars vs your targets
- **7-day AI meal plan** — Groq builds a week of meals hitting your calorie + protein goals, tailored to your dietary preferences (uses JSON-mode for reliable output)
- **AI nutrition coach** — streaming chat that knows your profile and today's logs, suggests specific foods with macros
- **Food database** — 100+ whole foods and prepared meals with per-100g macros, searchable and filterable
- **Weight progress** — log weight over time with a Recharts line chart

All user data (profile, food logs, weight history) is stored in the **browser's localStorage** — no signup, no database, no server storage.

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

Visit http://localhost:3000.

## Deploy to Railway

1. Push this repo to GitHub.
2. On https://railway.app, click **New Project → Deploy from GitHub repo** and pick `nourishai`.
3. In the service's **Variables** tab add `GROQ_API_KEY=gsk_...`.
4. Under **Settings → Networking**, click **Generate Domain**.

Railway auto-detects Next.js, runs `npm run build`, then `npm start`. Next.js reads `PORT` from the environment automatically — no extra config needed.

## Project Structure

```
food-app/
├─ app/
│  ├─ layout.tsx              # root layout, nav
│  ├─ page.tsx                # landing / dashboard
│  ├─ profile/page.tsx        # profile + live TDEE calculator
│  ├─ tracker/page.tsx        # daily calorie & macro log
│  ├─ meal-plan/page.tsx      # 7-day AI plan
│  ├─ chat/page.tsx           # streaming AI coach
│  ├─ foods/page.tsx          # food database browser
│  ├─ progress/page.tsx       # weight chart
│  └─ api/
│     ├─ chat/route.ts        # Groq streaming chat
│     └─ mealplan/route.ts    # Groq meal plan (JSON mode)
├─ components/                # Nav, MacroBar, FoodSearch, WeightChart
├─ lib/
│  ├─ nutrition.ts            # BMR/TDEE/macro math
│  ├─ groq.ts                 # server-side Groq client
│  ├─ store.ts                # Zustand + localStorage
│  ├─ foods.json              # 100+ foods seed DB
│  └─ types.ts
└─ .env.local                 # your GROQ_API_KEY
```

## Tech Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS**
- **Recharts** for weight charts
- **Zustand** state management with localStorage persistence
- **groq-sdk** for fast Llama 3.3 70B inference (meal plan + chat)

## Scripts

| Command         | Purpose                          |
| --------------- | -------------------------------- |
| `npm run dev`   | Start Next.js dev server         |
| `npm run build` | Production build                 |
| `npm run start` | Start production server          |
| `npm run lint`  | Lint with Next.js ESLint config  |

## Disclaimer

NourishAI is for educational purposes only. It is **not** a substitute for professional medical or dietary advice. Consult a registered dietitian or doctor for personalized medical nutrition therapy.
