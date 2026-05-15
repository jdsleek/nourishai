import Nav from "@/components/Nav";

export default function MainChromeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      <footer className="mt-16 border-t border-stone-200/70 py-8 text-center text-sm text-stone-500 dark:border-stone-800 dark:text-stone-500">
        NourishAI — for educational use only. Not medical advice.
      </footer>
    </>
  );
}
