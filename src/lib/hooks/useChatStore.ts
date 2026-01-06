import { create } from "zustand";
import { persist, createJSONStorage, StateStorage } from "zustand/middleware";
import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval";
// import { Message } from "ai"; // 'ai' export issues

// 用于防止 selectConversation 竞态条件的请求版本追踪
let selectConversationVersion = 0;

// Custom storage adapter for IndexedDB
const storage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (typeof window === "undefined") return null;
    return (await idbGet(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    if (typeof window === "undefined") return;
    await idbSet(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    if (typeof window === "undefined") return;
    await idbDel(name);
  },
};

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  toolName?: string; // Compatibility
  toolCallId?: string; // Compatibility
}

interface DbMessage {
  id: string;
  role: string;
  content: string;
  metadata?: string | null;
  createdAt: string | Date;
}

export interface Message {
  id: string;
  role: "system" | "user" | "assistant" | "tool" | "data";
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  createdAt?: Date | string;
}

// Define types locally if not available globally properly yet
interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  fingerprint?: string;
}

interface ChatState {
  conversations: Conversation[];
  currentConversationId: string | null;
  messages: Message[];
  isLoading: boolean;
  fingerprint: string | null; // For guest users

  // Actions
  setFingerprint: (fingerprint: string) => void;
  loadConversations: (userId?: string) => Promise<void>;
  refreshConversations: () => Promise<void>; // Helper to reload current list
  createConversation: (initialMessage?: string) => Promise<string>;
  selectConversation: (id: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void; // Optimistic update
  updateLastMessage: (
    content: string,
    toolCalls?: ToolCall[],
    tool_call_id?: string
  ) => void;
  setCurrentConversationId: (id: string | null) => void;
  // 新增：支持指定对话ID的方法，用于流式输出时防止对话切换导致的消息叠加
  addMessageToConversation: (
    message: Message,
    targetConversationId: string | null
  ) => void;
  updateLastMessageInConversation: (
    targetConversationId: string | null,
    content: string,
    toolCalls?: ToolCall[],
    tool_call_id?: string
  ) => void;
  // 获取指定对话的消息（从缓存或当前state）
  getMessagesForConversation: (
    conversationId: string | null
  ) => Promise<Message[]>;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: [],
      currentConversationId: null,
      messages: [],
      // messagesCache: {}, // Removed to save memory, rely on IndexedDB
      isLoading: false,
      fingerprint: null,

      setFingerprint: (fingerprint) => set({ fingerprint }),

      loadConversations: async (userId) => {
        set({ isLoading: true });
        try {
          const { fingerprint } = get();
          let url = "/api/history";
          if (!userId && fingerprint) {
            url += `?fingerprint=${fingerprint}`;
          } else if (!userId && !fingerprint) {
            set({ isLoading: false });
            return;
          }

          const res = await fetch(url);
          if (res.ok) {
            const data = (await res.json()) as Conversation[];
            set({ conversations: data });
          }
        } catch (error) {
          console.error("Failed to load conversations", error);
        } finally {
          set({ isLoading: false });
        }
      },

      refreshConversations: async () => {
        const { fingerprint } = get();
        try {
          let url = "/api/history";
          if (fingerprint) {
            url += `?fingerprint=${fingerprint}`;
          }
          const res = await fetch(url);
          if (res.ok) {
            const data = (await res.json()) as Conversation[];
            set({ conversations: data });
          }
        } catch (e) {
          console.error(e);
        }
      },

      createConversation: async () => {
        set({ currentConversationId: null, messages: [] });
        return "";
      },

      selectConversation: async (id) => {
        // 递增版本号，标记这是一个新的请求
        const currentVersion = ++selectConversationVersion;

        set({ currentConversationId: id, isLoading: true, messages: [] });

        // 2. Fetch from API (Sync)
        try {
          const { fingerprint } = get();

          let afterTimestamp: string | undefined;
          let validMessages: Message[] = [];
          // Check if we have cached messages to determine 'after' parameter
          if (typeof window !== "undefined") {
            try {
              const cachedMsgs = (await idbGet(`chat_msgs_${id}`)) as Message[];

              // 检查版本号，如果已过期则跳过
              if (currentVersion !== selectConversationVersion) {
                console.log(
                  `[Sync] Skipping stale request (version ${currentVersion} vs ${selectConversationVersion})`
                );
                return;
              }

              if (cachedMsgs && cachedMsgs.length > 0) {
                set({ messages: cachedMsgs, isLoading: false });

                // Find the last message that has a server-generated ID.
                // Client IDs are numeric (timestamp based) e.g. "170..." or "170... .123"
                // Server IDs (CUID/UUID) are alphanumeric e.g. "cmj..." or have dashes.
                // We treat any ID that is NOT a valid number as a server ID.
                let anchorIndex = -1;
                for (let i = cachedMsgs.length - 1; i >= 0; i--) {
                  const msgId = cachedMsgs[i].id;
                  // Check if ID is NOT a valid number (so it's a string ID like CUID/UUID)
                  if (Number.isNaN(Number(msgId))) {
                    anchorIndex = i;
                    break;
                  }
                }

                if (anchorIndex !== -1 && cachedMsgs[anchorIndex].createdAt) {
                  const lastMsg = cachedMsgs[anchorIndex];
                  validMessages = cachedMsgs.slice(0, anchorIndex + 1);
                  afterTimestamp =
                    lastMsg.createdAt instanceof Date
                      ? lastMsg.createdAt.toISOString()
                      : lastMsg.createdAt;

                  console.log(
                    `[Sync] Found anchor message: ${lastMsg.id} at time ${afterTimestamp}`
                  );
                } else {
                  console.log(
                    "[Sync] No valid anchor found in cache (missing server ID or createdAt)."
                  );
                }
              } else {
                console.log(
                  "[Sync] No local cache found for this conversation."
                );
              }
            } catch (err) {
              console.error("Error reading cache for incremental update", err);
            }
          }

          // 再次检查版本号
          if (currentVersion !== selectConversationVersion) {
            console.log(
              `[Sync] Skipping stale request before fetch (version ${currentVersion} vs ${selectConversationVersion})`
            );
            return;
          }

          const params = new URLSearchParams();
          if (fingerprint) params.append("fingerprint", fingerprint);
          if (afterTimestamp) params.append("after", afterTimestamp);

          const url = `/api/history/${id}?${params.toString()}`;
          console.log(`[Sync] Fetching updates from: ${url}`);

          const res = await fetch(url);

          // 请求完成后检查版本号，如果已过期则不更新状态
          if (currentVersion !== selectConversationVersion) {
            console.log(
              `[Sync] Skipping stale response (version ${currentVersion} vs ${selectConversationVersion})`
            );
            return;
          }

          if (res.ok) {
            const data = (await res.json()) as { messages: DbMessage[] };

            const newMessages: Message[] = (data.messages || []).map(
              (m: DbMessage) => ({
                id: m.id,
                role: m.role as Message["role"],
                content: m.content,
                createdAt: m.createdAt,
                tool_calls: m.metadata
                  ? JSON.parse(m.metadata).tool_calls
                  : undefined,
                tool_call_id: m.metadata
                  ? JSON.parse(m.metadata).tool_call_id
                  : undefined,
              })
            );

            // Merge: Keep valid cached history + append new server messages
            // This replaces pending/optimistic messages (after anchor) with server versions
            const finalMessages = afterTimestamp
              ? [...validMessages, ...newMessages]
              : newMessages;

            // 最后再检查一次版本号
            if (currentVersion !== selectConversationVersion) {
              console.log(
                `[Sync] Skipping stale final update (version ${currentVersion} vs ${selectConversationVersion})`
              );
              return;
            }

            // Update state
            set({ messages: finalMessages, isLoading: false });
            // Sync to local DB
            saveMessagesToDb(id, finalMessages);
          }
        } catch (error) {
          console.error("Failed to load conversation messages", error);
          // 只有当版本号匹配时才更新 isLoading 状态
          if (
            currentVersion === selectConversationVersion &&
            get().messages.length === 0
          ) {
            set({ isLoading: false });
          }
        }
      },

      deleteConversation: async (id) => {
        const { fingerprint, currentConversationId, conversations } = get();

        // Optimistic delete
        set({
          conversations: conversations.filter((c) => c.id !== id),
        });

        if (currentConversationId === id) {
          set({ currentConversationId: null, messages: [] });
        }

        // Remove from local DB
        if (typeof window !== "undefined") {
          idbDel(`chat_msgs_${id}`).catch(console.error);
        }

        try {
          let url = `/api/history/${id}`;
          if (fingerprint) url += `?fingerprint=${fingerprint}`;
          await fetch(url, { method: "DELETE" });
        } catch (error) {
          console.error("Failed to delete", error);
        }
      },

      setMessages: (messages) => {
        set({ messages });
        const { currentConversationId } = get();
        if (currentConversationId) {
          debouncedSave(currentConversationId, messages);
        }
      },

      addMessage: (message) =>
        set((state) => {
          // Ensure local messages have a createdAt for future sync references
          const msgWithDate = {
            ...message,
            createdAt: message.createdAt || new Date().toISOString(),
          };
          const newMessages = [...state.messages, msgWithDate];
          if (state.currentConversationId) {
            debouncedSave(state.currentConversationId, newMessages);
          }
          return { messages: newMessages };
        }),

      updateLastMessage: (
        content: string,
        toolCalls?: ToolCall[],
        tool_call_id?: string
      ) =>
        set((state) => {
          const messages = [...state.messages];
          if (messages.length === 0) return { messages };

          const lastMsg = messages[messages.length - 1];
          const updatedMsg = {
            ...lastMsg,
            content: lastMsg.content + content,
          };

          if (toolCalls) {
            updatedMsg.tool_calls = toolCalls;
          }
          if (tool_call_id) {
            updatedMsg.tool_call_id = tool_call_id;
          }

          messages[messages.length - 1] = updatedMsg;

          if (state.currentConversationId) {
            debouncedSave(state.currentConversationId, messages);
          }

          return { messages };
        }),

      setCurrentConversationId: (id) => set({ currentConversationId: id }),

      // 添加消息到指定对话，只有当目标对话与当前显示对话匹配时才更新UI
      addMessageToConversation: (message, targetConversationId) => {
        const state = get();
        const msgWithDate = {
          ...message,
          createdAt: message.createdAt || new Date().toISOString(),
        };

        // 如果目标对话与当前显示对话相同，更新UI状态
        if (
          targetConversationId === state.currentConversationId ||
          (targetConversationId === null &&
            state.currentConversationId === null)
        ) {
          const newMessages = [...state.messages, msgWithDate];
          set({ messages: newMessages });
          if (targetConversationId) {
            debouncedSave(targetConversationId, newMessages);
          }
        } else if (targetConversationId) {
          // 目标对话与当前不同，只保存到缓存，不更新UI
          // 需要先获取该对话的缓存消息，然后追加
          (async () => {
            try {
              const cachedMsgs =
                ((await idbGet(
                  `chat_msgs_${targetConversationId}`
                )) as Message[]) || [];
              const newMessages = [...cachedMsgs, msgWithDate];
              await idbSet(`chat_msgs_${targetConversationId}`, newMessages);
              console.log(
                `[Stream] Message saved to background conversation: ${targetConversationId}`
              );
            } catch (err) {
              console.error(
                "Failed to save message to background conversation",
                err
              );
            }
          })();
        }
      },

      // 更新指定对话的最后一条消息
      updateLastMessageInConversation: (
        targetConversationId,
        content,
        toolCalls,
        tool_call_id
      ) => {
        const state = get();

        // 如果目标对话与当前显示对话相同，更新UI状态
        if (
          targetConversationId === state.currentConversationId ||
          (targetConversationId === null &&
            state.currentConversationId === null)
        ) {
          const messages = [...state.messages];
          if (messages.length === 0) return;

          const lastMsg = messages[messages.length - 1];
          const updatedMsg = {
            ...lastMsg,
            content: lastMsg.content + content,
          };

          if (toolCalls) {
            updatedMsg.tool_calls = toolCalls;
          }
          if (tool_call_id) {
            updatedMsg.tool_call_id = tool_call_id;
          }

          messages[messages.length - 1] = updatedMsg;
          set({ messages });

          if (targetConversationId) {
            debouncedSave(targetConversationId, messages);
          }
        } else if (targetConversationId) {
          // 目标对话与当前不同，只更新缓存
          (async () => {
            try {
              const cachedMsgs =
                ((await idbGet(
                  `chat_msgs_${targetConversationId}`
                )) as Message[]) || [];
              if (cachedMsgs.length === 0) return;

              const lastMsg = cachedMsgs[cachedMsgs.length - 1];
              const updatedMsg = {
                ...lastMsg,
                content: lastMsg.content + content,
              };

              if (toolCalls) {
                updatedMsg.tool_calls = toolCalls;
              }
              if (tool_call_id) {
                updatedMsg.tool_call_id = tool_call_id;
              }

              cachedMsgs[cachedMsgs.length - 1] = updatedMsg;
              await idbSet(`chat_msgs_${targetConversationId}`, cachedMsgs);
            } catch (err) {
              console.error(
                "Failed to update message in background conversation",
                err
              );
            }
          })();
        }
      },

      // 获取指定对话的消息
      getMessagesForConversation: async (conversationId) => {
        const state = get();
        if (conversationId === state.currentConversationId) {
          return state.messages;
        }
        if (conversationId && typeof window !== "undefined") {
          try {
            const cachedMsgs =
              ((await idbGet(`chat_msgs_${conversationId}`)) as Message[]) ||
              [];
            return cachedMsgs;
          } catch {
            return [];
          }
        }
        return [];
      },
    }),
    {
      name: "douyin-chat-storage", // name of the item in the storage (must be unique)
      storage: createJSONStorage(() => storage), // Use IndexedDB adapter
      partialize: (state) => ({
        fingerprint: state.fingerprint,
        conversations: state.conversations, // Persist conversations list
        // messages: state.messages, // REMOVED: Don't persist messages in main store to avoid heavy IO
        // currentConversationId: state.currentConversationId, // REMOVED: Don't persist active chat to avoid sync issues on reload
        // messagesCache: state.messagesCache, // REMOVED
      }),
    }
  )
);

// --- Helper for Debounced Saving ---
const SAVE_DELAY = 1000; // 1 second debounce
const saveTimeouts: Record<string, NodeJS.Timeout> = {};

function debouncedSave(conversationId: string, messages: Message[]) {
  if (typeof window === "undefined") return;

  // Clear existing timeout for this conversation
  if (saveTimeouts[conversationId]) {
    clearTimeout(saveTimeouts[conversationId]);
  }

  // Set new timeout
  saveTimeouts[conversationId] = setTimeout(() => {
    saveMessagesToDb(conversationId, messages);
    delete saveTimeouts[conversationId];
  }, SAVE_DELAY);
}

// Immediate save function
async function saveMessagesToDb(conversationId: string, messages: Message[]) {
  try {
    await idbSet(`chat_msgs_${conversationId}`, messages);
  } catch (err) {
    console.error("Failed to save messages to IndexedDB", err);
  }
}
