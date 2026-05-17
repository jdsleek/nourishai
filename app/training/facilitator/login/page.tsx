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
          <h1 className="mt-2 text-2xl font-bold text-white">Facilitator sign-in</h1>
          <p className="mt-2 text-sm text-slate-400">
            Sign in with the email and password your program organizer gave you. From here
            you can share the class deck, review learner submissions, and manage your
            assessments.
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

        <p className="text-xs text-slate-500">
          Trouble signing in? Ask your program organizer to confirm your email is registered
          and to reset your password if needed.
        </p>
      </div>
    </div>
  );
}
