"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function AuthenticatedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Page error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-sm flex-col items-center justify-center px-6 py-10 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-muted text-2xl text-brand">↻</div>
      <p className="mt-5 text-sm font-medium text-foreground">这页暂时没有加载出来</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        通常是网络短暂波动。你的本地草稿和待同步学习记录不会丢失。
      </p>
      <div className="mt-6 flex w-full gap-3">
        <Link href="/dashboard" className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-border bg-card px-4 text-sm font-medium text-muted-foreground">
          回到概览
        </Link>
        <button
          onClick={reset}
          className="min-h-11 flex-1 rounded-xl bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand/90"
        >
          重新加载
        </button>
      </div>
    </div>
  );
}
