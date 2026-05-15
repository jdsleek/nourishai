"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const links = [
  { href: "/", label: "Slides" },
  { href: "/nourish", label: "Nourish" },
  { href: "/profile", label: "Profile" },
  { href: "/tracker", label: "Tracker" },
  { href: "/meal-plan", label: "Meal Plan" },
  { href: "/chat", label: "AI Coach" },
  { href: "/class-workbook", label: "Class" },
  { href: "/foods", label: "Foods" },
  { href: "/progress", label: "Progress" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/70 bg-white/80 backdrop-blur dark:border-stone-800 dark:bg-stone-950/80">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/nourish" className="flex items-center gap-2 font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">
            N
          </span>
          <span className="text-lg tracking-tight">NourishAI</span>
        </Link>
        <ul className="hidden gap-1 md:flex">
          {links.map((l) => {
            const active =
              pathname === l.href ||
              (l.href !== "/" && pathname.startsWith(l.href));
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={clsx(
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200"
                      : "text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-900 dark:hover:text-stone-100"
                  )}
                >
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-3 md:hidden">
        {links.map((l) => {
          const active =
            pathname === l.href ||
            (l.href !== "/" && pathname.startsWith(l.href));
          return (
            <Link
              key={l.href}
              href={l.href}
              className={clsx(
                "whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200"
                  : "text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-900"
              )}
            >
              {l.label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
