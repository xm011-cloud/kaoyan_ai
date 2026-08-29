/**
 * 登出时清空客户端残留状态 —— 避免下一个账号读到上一个账号的数据。
 *
 * 覆盖：
 * 1. zustand 持久化 store（practice-store/ui-store/pomodoro-store，localStorage）
 * 2. 离线写队列（IndexedDB `c6-offline-queue`）
 * 3. SW 的 API 缓存（postMessage 给 Service Worker）
 */
const STORE_KEYS = ["ui-store", "practice-store", "pomodoro-store"];

export function clearClientStateOnLogout() {
  // 1. 持久化 store（同步，立刻生效，防下一个账号读到本账号的练习/UI 数据）
  try {
    for (const k of STORE_KEYS) localStorage.removeItem(k);
  } catch { /* ignore */ }

  // 2. 离线写队列（尽力而为，deleteDatabase 异步）
  try {
    indexedDB.deleteDatabase("c6-offline-queue");
  } catch { /* ignore */ }

  // 3. SW 的 API 缓存（postMessage 给 SW 清理本账号的接口响应缓存）
  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    try {
      navigator.serviceWorker.controller.postMessage({ type: "clear-api-cache" });
    } catch { /* ignore */ }
  }
}
