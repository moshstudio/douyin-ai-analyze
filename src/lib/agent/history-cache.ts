import { ChatMessageHistory } from "langchain/stores/message/in_memory";

interface HistoryCacheEntry {
  history: ChatMessageHistory;
  lastAccess: number;
}

// 简单的内存缓存，存储 ChatMessageHistory 对象
const historyCache = new Map<string, HistoryCacheEntry>();
const CACHE_TTL = 30 * 60 * 1000; // 30 分钟过期

// 定期清理过期缓存
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of historyCache.entries()) {
    if (now - entry.lastAccess > CACHE_TTL) {
      historyCache.delete(id);
    }
  }
}, 5 * 60 * 1000);

/**
 * 获取缓存中的历史记录
 */
export function getHistoryFromCache(
  conversationId: string
): ChatMessageHistory | null {
  const entry = historyCache.get(conversationId);
  if (entry) {
    entry.lastAccess = Date.now();
    return entry.history;
  }
  return null;
}

/**
 * 将历史记录存入缓存
 */
export function setHistoryToCache(
  conversationId: string,
  history: ChatMessageHistory
): void {
  historyCache.set(conversationId, {
    history,
    lastAccess: Date.now(),
  });
}

/**
 * 检查缓存中是否存在历史记录
 */
export function hasHistoryInCache(conversationId: string): boolean {
  return historyCache.has(conversationId);
}

/**
 * 创建新的 ChatMessageHistory 实例
 */
export function createNewHistory(): ChatMessageHistory {
  return new ChatMessageHistory();
}
