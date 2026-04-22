# NourishAI — Food, Calories & AI Nutrition Coach

A modern food & nutrition web app built with **Next.js 14 + TypeScript + Tailwind**, with an AI agent powered by **Anthropic Claude**. Designed for users who want to lose, gain, or maintain weight with personalized calorie targets, daily food tracking, a 7-day AI-generated meal plan, and a nutrition chat coach.

## Features

- **Smart profile** — Mifflin-St Jeor BMR, TDEE, and target calorie calculator
- **Food tracker** — log foods by the gram; live macro progress bars vs your targets
- **7-day AI meal plan** — Claude builds a week of meals hitting your calorie + protein goals, tailored to your dietary preferences
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

### 2. Add your Anthropic API key

Get a key at https://console.anthropic.com/ and put it in `food-app/.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

The key is only used server-side inside Next.js API routes — it's never bundled into the browser.

Optionally override the model:

```
ANTHROPIC_MODEL=claude-3-5-sonnet-latest
```

### 3. Run the dev server

```bash
npm run dev
```

Visit http://localhost:3000.

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
│     ├─ chat/route.ts        # Claude streaming chat
│     └─ mealplan/route.ts    # Claude meal plan (JSON)
├─ components/                # Nav, MacroBar, FoodSearch, WeightChart
├─ lib/
│  ├─ nutrition.ts            # BMR/TDEE/macro math
│  ├─ claude.ts               # server-side Anthropic client
│  ├─ store.ts                # Zustand + localStorage
│  ├─ foods.json              # 100+ foods seed DB
│  └─ types.ts
└─ .env.local                 # your ANTHROPIC_API_KEY
```

## Tech Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS**
- **Recharts** for weight charts
- **Zustand** state management with localStorage persistence
- **@anthropic-ai/sdk** for Claude (meal plan + chat)

## Scripts

| Command         | Purpose                          |
| --------------- | -------------------------------- |
| `npm run dev`   | Start Next.js dev server         |
| `npm run build` | Production build                 |
| `npm run start` | Start production server          |
| `npm run lint`  | Lint with Next.js ESLint config  |

## Disclaimer

NourishAI is for educational purposes only. It is **not** a substitute for professional medical or dietary advice. Consult a registered dietitian or doctor for personalized medical nutrition therapy.
