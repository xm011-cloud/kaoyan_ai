"use client";

import { useEffect, useSyncExternalStore } from "react";
import { flushQueue } from "@/lib/offline-queue";

// 订阅 navigator.onLine（React 推荐的 useSyncExternalStore 方式）。
// getServerSnapshot 固定返回 true：SSR 与首屏水合都当作在线（不渲染离线横幅），
// 避免服务端（Node 自带全局 navigator）与浏览器读到的 onLine 不一致导致 hydration mismatch。
const subscribe = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};
const getSnapshot = () => navigator.onLine;
const getServerSnapshot = () => true;

/** 实时网络状态（navigator.onLine + online/offline 事件）。 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * 全局挂载一次：跟踪在线状态，联网（含恢复网络）时自动补传离线队列。
 * 兜底：online 事件只在"断→连"转换时触发；联网但请求失败（抖动）时队列会卡住，
 * 故在线状态下每 30s 周期重试一次（空队列近乎零开销）。
 * 返回当前是否在线。
 */
export function useOfflineSync(): boolean {
  const online = useOnlineStatus();
  useEffect(() => {
    if (!online) return;
    void flushQueue();
    const timer = setInterval(() => {
      void flushQueue();
    }, 30_000);
    return () => clearInterval(timer);
  }, [online]);
  return online;
}
