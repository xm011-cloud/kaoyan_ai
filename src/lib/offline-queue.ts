"use client";

/**
 * 离线写入队列 — IndexedDB 持久化。
 * 断网时把写入操作排队，联网后按顺序补传。
 *
 * 使用注意：
 * - 只放「可安全重放」的写入（打卡、任务完成状态等）；用 dedupeKey 归并同一目标的最新状态。
 * - 补传时成功或业务拒绝(4xx)会出队；网络错误/5xx 保留待下次。
 * - 同源请求自动带 cookie，Supabase Auth 会话可直接复用。
 */
const DB_NAME = "c6-offline-queue";
const STORE = "writes";
const VERSION = 1;

interface QueuedWrite {
  id: string;
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  createdAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("indexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(db: IDBDatabase, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** 把一次写入加入离线队列。opts.dedupeKey 相同时覆盖旧条目（保留最新状态，避免重复补传互相打架）。 */
export async function enqueueWrite(
  url: string,
  init: RequestInit,
  opts?: { dedupeKey?: string }
): Promise<void> {
  try {
    const db = await openDb();
    const id = opts?.dedupeKey ?? `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((v, k) => {
      headers[k] = v;
    });
    const write: QueuedWrite = {
      id,
      url,
      method: (init.method ?? "GET").toUpperCase(),
      headers: Object.keys(headers).length ? headers : undefined,
      body: typeof init.body === "string" ? init.body : undefined,
      createdAt: Date.now(),
    };
    await txDone(db, "readwrite", (store) => store.put(write));
  } catch {
    // 队列不可用时静默放弃，走回普通失败路径
  }
}

/** 当前待同步条数（用于离线横幅展示）。 */
export async function queuedCount(): Promise<number> {
  try {
    const db = await openDb();
    return await new Promise<number>((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}

/** 联网后按时间顺序补传。返回成功补传的条数。 */
export async function flushQueue(): Promise<number> {
  let flushed = 0;
  try {
    const db = await openDb();
    const all = await new Promise<QueuedWrite[]>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    all.sort((a, b) => a.createdAt - b.createdAt);

    for (const w of all) {
      const res = await fetch(w.url, {
        method: w.method,
        headers: w.headers ?? { "Content-Type": "application/json" },
        body: w.body,
      });
      // 成功(2xx)或业务拒绝(4xx) → 出队；网络错误/5xx → 保留并停止本轮
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        await txDone(db, "readwrite", (store) => store.delete(w.id));
        flushed++;
      } else {
        break;
      }
    }
  } catch {
    // 仍不可达，保留队列待下次
  }
  return flushed;
}
