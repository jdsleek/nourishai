"use client";

import Link from "next/link";
import { useFoodStore, entriesForDate, sumEntries } from "@/lib/store";
import { macroTargets, todayISO } from "@/lib/nutrition";

export default function Home() {
  const profile = useFoodStore((s) => s.profile);
  const entries = useFoodStore((s) => s.foodEntries);
  const weights = useFoodStore((s) => s.weights);

  const today = todayISO();
  const todayEntries = entriesForDate(entries, today);
  const totals = sumEntries(todayEntries);
  const targets = profile ? macroTargets(profile) : null;

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-500 via-brand-600 to-emerald-700 px-6 py-12 text-white shadow-soft sm:px-12 sm:py-16">
        <div className="relative z-10 max-w-2xl">
          <span className="pill bg-white/20 text-white">
            AI-powered nutrition
          </span>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Eat with a purpose.
            <br />
            Reach your weight goal.
          </h1>
          <p className="mt-4 text-lg text-white/90">
            NourishAI calculates your personalized calorie target, tracks every
            meal, builds a 7-day AI meal plan, and answers nutrition questions
            like a dietitian in your pocket.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/profile"
              className="btn bg-white text-brand-700 hover:bg-brand-50"
            >
              {profile ? "Update my profile" : "Get started"}
            </Link>
            <Link
              href="/chat"
              className="btn border border-white/40 bg-white/10 text-white hover:bg-white/20"
            >
              Talk to AI Coach
            </Link>
          </div>
        </div>
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-emerald-300/20 blur-3xl" />
      </section>

      {profile && targets && (
        <section className="card">
          <h2 className="text-xl font-semibold">Today at a glance</h2>
          <p className="mt-1 text-sm text-stone-500">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
          <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
            <Stat
              label="Calories"
              value={`${Math.round(totals.kcal)} / ${targets.kcal}`}
              unit="kcal"
            />
            <Stat
              label="Protein"
              value={`${Math.round(totals.protein)} / ${targets.protein}`}
              unit="g"
            />
            <Stat
              label="Carbs"
              value={`${Math.round(totals.carbs)} / ${targets.carbs}`}
              unit="g"
            />
            <Stat
              label="Fat"
              value={`${Math.round(totals.fat)} / ${targets.fat}`}
              unit="g"
            />
          </div>
          <div className="mt-6 flex gap-3">
            <Link href="/tracker" className="btn-primary">
              Log food
            </Link>
            <Link href="/meal-plan" className="btn-secondary">
              Get meal plan
            </Link>
          </div>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Feature
          href="/profile"
          title="Smart calorie targets"
          body="We use the Mifflin-St Jeor formula plus your goal to set the right calorie + macro targets."
        />
        <Feature
          href="/tracker"
          title="Simple food logging"
          body="Search from 100+ foods, set portion size in grams, and watch your macros update in real time."
        />
        <Feature
          href="/meal-plan"
          title="7-day AI meal plan"
          body="A fast Llama 3.3 70B agent (via Groq) builds a full week of meals that hits your calorie and macro goals, tailored to your preferences."
        />
        <Feature
          href="/chat"
          title="AI nutrition coach"
          body="Ask anything — it knows your profile and today's logs, and suggests foods on the spot."
        />
        <Feature
          href="/foods"
          title="Food database"
          body="Browse our curated list of whole foods and prepared meals with accurate macro info."
        />
        <Feature
          href="/progress"
          title="Track weight over time"
          body="Log your weight and see a clean chart of your progress toward your goal."
        />
      </section>

      {weights.length >= 2 && profile && (
        <p className="text-center text-sm text-stone-500">
          You've logged {weights.length} weight entries. Keep it up — consistency
          wins.
        </p>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div>
      <div className="text-sm text-stone-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">
        {value}
        <span className="ml-1 text-sm font-normal text-stone-400">{unit}</span>
      </div>
    </div>
  );
}

function Feature({
  href,
  title,
  body,
}: {
  href: string;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="card group flex flex-col transition-shadow hover:shadow-lg"
    >
      <h3 className="text-lg font-semibold group-hover:text-brand-700 dark:group-hover:text-brand-300">
        {title}
      </h3>
      <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">{body}</p>
      <span className="mt-4 text-sm font-medium text-brand-600 group-hover:text-brand-700">
        Open →
      </span>
    </Link>
  );
}
