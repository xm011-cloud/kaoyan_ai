"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show after a short delay
      setTimeout(() => setShowPrompt(true), 3000);
    };

    const installedHandler = () => {
      setInstalled(true);
      setShowPrompt(false);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === "accepted") {
      setInstalled(true);
    }
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  if (!showPrompt || installed) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-4 left-4 right-4 lg:left-60 lg:right-4 z-50">
      <div className="max-w-sm mx-auto lg:mx-0 bg-white dark:bg-gray-800 rounded-xl border shadow-lg p-4 flex items-center gap-3 animate-in slide-in-from-bottom">
        <span className="text-2xl">📱</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">添加到主屏幕</p>
          <p className="text-xs text-gray-500">快速启动 AI 考研助手</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" onClick={handleInstall}>
            安装
          </Button>
          <button
            onClick={() => setShowPrompt(false)}
            className="text-gray-400 hover:text-gray-600 text-sm"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
