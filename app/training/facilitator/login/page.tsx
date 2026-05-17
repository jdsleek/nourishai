"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function FacilitatorLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-[#07080d] px-4 py-16 text-slate-100">
      <div className="mx-auto max-w-md space-y-6 rounded-2xl border border-white/10 bg-[#111520] p-8 shadow-xl">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-cyan-400">
            Trainer console
          </p>
          <h1 className="mt-2 text-2xl font-bold text-white">
            Facilitator sign-in
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Build assessments with your own grading instructions. Organizer creates
            your account via admin{" "}
            <span className="text-slate-500">
              (or provisions the row in{" "}
              <code className="rounded bg-white/10 px-1 font-mono text-[11px]">
                training_facilitators
              </code>
              ).
            </span>
          </p>
        </div>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setBusy(true);
            setMsg(null);
            void (async () => {
              try {
                const res = await fetch("/api/training/facilitator/auth/login", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({
                    email: email.trim(),
                    password: password.trim(),
                  }),
                });
                const data = (await res.json().catch(() => ({}))) as {
                  error?: string;
                };
                if (!res.ok) throw new Error(data.error || "Login failed.");
                router.replace("/training/facilitator");
                router.refresh();
              } catch (err) {
                setMsg(err instanceof Error ? err.message : "Login failed.");
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          <label className="block text-xs text-slate-400">
            Work email
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-white/15 bg-[#0c0e14] px-3 py-2.5 text-slate-100 outline-none focus:border-orange-400"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-white/15 bg-[#0c0e14] px-3 py-2.5 text-slate-100 outline-none focus:border-orange-400"
            />
          </label>
          {msg ? <p className="text-sm text-red-400">{msg}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-orange-500 py-3 font-semibold text-[#0a0a0c] disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <details className="mt-6 rounded-lg border border-white/10 bg-black/25 p-4 text-xs text-slate-400">
          <summary className="cursor-pointer font-medium text-slate-300">
            Can’t sign in? (credentials look right but get “invalid” here)
          </summary>
          <ul className="mt-3 list-disc space-y-2 pl-4 text-slate-400 [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1 [&_code]:font-mono">
            <li>
              This app only accepts logins backed by{" "}
              <strong className="text-slate-300">this deployment’s Postgres</strong>{" "}
              (<code>DATABASE_URL</code>). If nobody created your row{" "}
              <em>against that same database</em>, every password will fail —
              including duplicates of the demo password.
            </li>
            <li>
              Organizer fixes it from <strong className="text-slate-300">/foundry/admin</strong>{" "}
              → create facilitator, <strong className="text-slate-300">or</strong> “Update existing
              facilitator credentials” → set email + password.
            </li>
            <li>
              Ops / CLI (with Railway <code>DATABASE_URL</code> wired in{" "}
              <code>food-app/.env.local</code>):{" "}
              <code>
                DEMO_FACILITATOR_EMAIL=you@corp.com DEMO_FACILITATOR_PASSWORD='… ≥10 chars …' npm
                run facilitator:demo-seed
              </code>{" "}
              — upserts bcrypt for that email, then retry sign-in here.
            </li>
          </ul>
        </details>
      </div>
    </div>
  );
}
