"use client";

import { useEffect } from "react";

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
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="text-5xl mb-4">😵</div>
      <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">
        页面出了点问题
      </h2>
      <p className="text-sm text-gray-500 mb-6 max-w-md">
        {error.message || "加载页面时发生错误，请稍后再试"}
      </p>
      <button
        onClick={reset}
        className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
      >
        重试
      </button>
    </div>
  );
}
