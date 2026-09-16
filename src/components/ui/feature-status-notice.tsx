import type { ReactNode } from "react";

export function FeatureStatusNotice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/20">
      <p className="font-semibold text-amber-800 dark:text-amber-200"><span className="mr-1.5 rounded-full bg-amber-200/80 px-1.5 py-0.5 text-[10px] uppercase tracking-wide dark:bg-amber-900/70">Beta</span>{title}</p>
      <p className="mt-1 leading-relaxed text-amber-800/80 dark:text-amber-100/75">{children}</p>
    </section>
  );
}
