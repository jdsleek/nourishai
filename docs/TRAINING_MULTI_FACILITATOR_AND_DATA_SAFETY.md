# Multi-facilitator assessments & organizer admin — specification

This document merges the conversation into an implementable shape, critiques weak spots, describes what was shipped in code, and how to **protect live Railway Postgres data** on deploy.

## Product intent (frozen)

| Role | Responsibilities |
|------|------------------|
| **Student** | In a subgroup for cohort labelling only. Opens the slide deck (`/foundry/day03`). Submits architecture prompt/output. Graded against **the assessment tied to `?assessment=<slug>`** (or legacy default when omitted). |
| **Facilitator (4–5)** | Signs in **with email + password**. Creates/edits **assessments** (title, slug, subgroup list, min lengths, facilitator-written **grading instructions** driving the AI grader). **Opens or closes new submissions per assessment.** Sees submissions for **their** assessments only. |
| **Organizer (admin)** | Uses existing **admin password header** unchanged. **Sees everything** — all submissions, ideation registry, bootstrap new facilitators, **global assessment lock toggles**. Does **not** own rubric wording (facilitators do). |

Critical review:

- **Facilitator‑authored rubrics** imply **model variance**. Mitigation: enforced **JSON schema** downstream (`normalizeGraderResult` unchanged) and clear instructions in-app to paste “how to allocate the 10+10 categories.”
- **Magic links** were deferred — **password + bcrypt** + httpOnly cookie keeps Railway setup simple (`FACILITATOR_SESSION_SECRET`).
- **Assessment lock:** column **`submissions_open`** on **`training_assessments`** (`false` = no new learner grades for that slug; existing rows untouched). Organizer can toggle all assessments from **`/foundry/admin`**; each facilitator toggles theirs on **`/training/facilitator`**.
- Subgroups remain **student metadata**, not facilitator access scopes (every facilitator still coaches every student academically; each **assessment** is owned by one facilitator).

## Data model (Postgres additive)

Two new tables **`training_facilitators`**, **`training_assessments`**.  
Additive columns:

- **`foundry_submissions.assessment_id`** `UUID NULL` → **`training_assessments(id)`** **`ON DELETE SET NULL`**.
- **`training_assessments.submissions_open`** `BOOLEAN NOT NULL DEFAULT TRUE` — when **FALSE**, **`POST /api/foundry/grade`** with matching **`assessmentSlug`** returns **403** (learners cannot submit endlessly).

**Existing rows survive**: `assessment_id` stays `NULL` → UI shows **“Legacy (built‑in rubric)”**; grading without `assessmentSlug` keeps the original `buildFoundryRubricPrompt` path.

Nothing is **`DROP`**ped; no row overwrites during migration.

## Live deploy / Railway — avoiding data loss

1. **`pg_dump` before deploy** (organizer accountability):

   ```bash
   pg_dump "$DATABASE_URL" -Fc -f backup-$(date +%F).dump
   ```

2. Deploy new build. Schema migration runs lazily (`ensure*` on next request touching PG) via **additive DDL** only.

3. **Verify counts** after smoke:

   ```sql
   SELECT COUNT(*) FROM foundry_submissions;
   SELECT COUNT(*) FROM foundry_submissions WHERE assessment_id IS NULL;
   ```

   First count **must equal** pre‑deploy historical total (until new submits add rows).

4. **JSONL mirror** (`data/foundry-submissions*.jsonl`) remains the append path when PG fails — new fields are stored inline in JSON for forward compatibility.

5. Facilitators & assessments exist **only** in Postgres (no PG ⇒ facilitator UI warns to configure DATABASE_URL).

## Grading resilience (rate limits / TPM)

Server-side grading uses **`lib/foundry-grading-llm.ts`**: **Groq**, **OpenRouter**, and **NVIDIA NIM** (OpenAI-compatible HTTP) in **`FOUNDRY_GRADING_PROVIDER_ORDER`** until one returns valid JSON. Each provider retries transient **429 / 5xx / empty** responses with backoff (`FOUNDRY_GRADE_LLM_ATTEMPTS`). Long learner pastes are **clipped for the model only** (`lib/foundry-grade-clip.ts`); **full prompt/output still persist** on success.

Smokes: `npm run foundry:smoke-providers` (one tiny completion per configured key).

## Environment variables

| Variable | Purpose |
|----------|---------|
| `GROQ_API_KEY` | Primary grader (Groq Cloud) |
| `GROQ_MODEL` | Optional Groq model id |
| `OPENROUTER_API_KEY` | Optional fallback ([OpenRouter](https://openrouter.ai)) |
| `OPENROUTER_MODEL` | e.g. `meta-llama/llama-3.3-70b-instruct:free` (`:free` for free tier) |
| `OPENROUTER_HTTP_REFERER` | Public site URL (OpenRouter etiquette) |
| `NVIDIA_API_KEY` | Optional fallback ([NVIDIA NIM](https://build.nvidia.com)) |
| `NVIDIA_CHAT_MODEL` | e.g. `meta/llama-3.3-70b-instruct` |
| `FOUNDRY_GRADING_PROVIDER_ORDER` | e.g. `openrouter,nvidia,groq` |
| `FOUNDRY_GRADE_LLM_ATTEMPTS` | Per-provider retries (default `3`, max `8`) |
| `DATABASE_URL` | Required for facilitator features + admin assessment JOINs |
| `FOUNDRY_ADMIN_PASSWORD` | Organizer/admin API gate |
| `FACILITATOR_SESSION_SECRET` | HMAC cookie `training_fac_session` — **set in prod** (long random) |

Other clipping / admin envs: **`food-app/.env.example`**.

## Operational flow for organizers

1. Set `FACILITATOR_SESSION_SECRET` on Railway.
2. Organizer → `POST /api/foundry/admin/facilitators` with admin header — body `{ email, password, displayName }` (**use HTTPS-only** — password crosses wire once).
3. Facilitator visits `/training/facilitator/login`, sets session, creates assessment with unique **slug**.
4. Share student link: **`/foundry/day03?assessment=<slug>`** (bookmark / LMS).
5. Submissions tagged with `assessment_id`; organizer admin lists all incl. slug/title columns.
6. **Close / reopen learner submits** — organizer **`/foundry/admin`** (“Assignment submission window”), or facilitator **`/training/facilitator`** on each assessment card **Close** / **Re-open** (`submissions_open` in Postgres).

## Demo facilitator seed (optional)

Creates or **resets password** for a known demo row (local / staging — **avoid on production**):

```bash
cd food-app
# DATABASE_URL must point at Postgres (Railway Variables or food-app/.env.local)
npm run facilitator:demo-seed
```

- Default email: `nourishai-demo-facilitator@example.local`
- Default password when `DEMO_FACILITATOR_PASSWORD` unset: **`DemoCoach2026!`** (≥10 chars; override env for your own demo)
- Optional: `DEMO_FACILITATOR_EMAIL`, `DEMO_FACILITATOR_DISPLAY`

Then visit **`/training/facilitator/login`** while `FACILITATOR_SESSION_SECRET` is set (`npm run dev`).

## Local preview (before pushing to GitHub)

```bash
cd food-app
cp .env.local.example.txt .env.local  # if exists; else configure DATABASE_URL + secrets
pnpm install || npm install
npm run dev
```

- Organizer: `/foundry/admin`
- Facilitator: `/training/facilitator/login`
- Student legacy: `/foundry/day03`
- Student new: `/foundry/day03?assessment=<slug>`

Smoke: `npm run foundry:smoke` (DB + optional API) and `npm run foundry:smoke-providers` (one tiny hit per LLM key).

## Code shipped in this repo (MVP wiring)

| Area | Location |
|------|-----------|
| Spec + Railway safety framing | [`docs/TRAINING_MULTI_FACILITATOR_AND_DATA_SAFETY.md`](./TRAINING_MULTI_FACILITATOR_AND_DATA_SAFETY.md) (you are reading it) |
| Additive DDL + `submissions_open` | [`lib/training-pg.ts`](../lib/training-pg.ts) via [`ensureFoundrySubmissionsSchema`](../lib/foundry-pg.ts) |
| Multi-provider grading + retries | [`lib/foundry-grading-llm.ts`](../lib/foundry-grading-llm.ts) · clip [`lib/foundry-grade-clip.ts`](../lib/foundry-grade-clip.ts) |
| Organizer assessment lock API | GET/PATCH [`/api/foundry/admin/assessment-locks`](../app/api/foundry/admin/assessment-locks/route.ts) |
| Configurable grading prompt shell | [`lib/foundry-grade.ts`](../lib/foundry-grade.ts) (`buildAssessmentRubricPrompt`) + [`app/api/foundry/grade/route.ts`](../app/api/foundry/grade/route.ts) |
| Public subgroup/min-length manifest | [`app/api/foundry/assessment-config/route.ts`](../app/api/foundry/assessment-config/route.ts) |
| Learner deck `?assessment=` hook | [`public/day03-ai-builder.html`](../public/day03-ai-builder.html) |
| Organizer facilitator bootstrap UI + API | [`app/foundry/admin/page.tsx`](../app/foundry/admin/page.tsx) · POST [`/api/foundry/admin/facilitators`](../app/api/foundry/admin/facilitators/route.ts) |
| Demo facilitator seed CLI | [`scripts/demo-facilitator-seed.mjs`](../scripts/demo-facilitator-seed.mjs) · `npm run facilitator:demo-seed` |

- No facilitator password reset mail.
- Assessments editable without draft/version pinning (risk if submissions already exist — operators should duplicate slug by creating a new slug if rubric materially changes).

Future: assessment version FK on submission row to freeze snapshot.
