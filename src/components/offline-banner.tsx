"use client";

import { useEffect, useState } from "react";
import { useOfflineSync } from "@/hooks/use-offline-sync";
import { queuedCount } from "@/lib/offline-queue";

/**
 * 离线状态横幅：挂在 Shell 顶部。
 * 在线时不渲染；离线时提示数据可读、新操作排队、联网自动同步 + 待同步条数。
 */
export function OfflineBanner() {
  const online = useOfflineSync();
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if (online) {
      setPending(0);
      return;
    }
    let mounted = true;
    queuedCount().then((c) => {
      if (mounted) setPending(c);
    });
    return () => {
      mounted = false;
    };
  }, [online]);

  if (online) return null;

  return (
    <div className="shrink-0 bg-warning/15 text-warning px-4 py-1.5 text-xs text-center">
      📡 离线模式：已浏览的数据可读，新操作将排队，联网后自动同步
      {pending > 0 && <span className="ml-1 font-medium">（{pending} 条待同步）</span>}
    </div>
  );
}
