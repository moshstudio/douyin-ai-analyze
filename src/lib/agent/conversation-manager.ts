import { ChatMessageHistory } from "langchain/stores/message/in_memory";
import {
  HumanMessage,
  AIMessage,
  ToolMessage,
  BaseMessage,
} from "@langchain/core/messages";
import { getDb } from "@/db";
import { conversations, messages as messagesTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  getHistoryFromCache,
  setHistoryToCache,
  createNewHistory,
} from "./history-cache";

interface IntermediateStep {
  action: {
    tool: string;
    toolInput: unknown;
    log?: string;
    messageLog?: { content: string | unknown }[];
  };
  observation: unknown;
}

/**
 * 获取或创建对话历史
 * 优先从缓存获取，缓存未命中则从数据库加载
 */
export async function getOrCreateHistory(
  conversationId?: string
): Promise<ChatMessageHistory> {
  // 如果有会话ID，尝试从缓存获取
  if (conversationId) {
    const cachedHistory = getHistoryFromCache(conversationId);
    if (cachedHistory) {
      return cachedHistory;
    }

    // 缓存未命中，从数据库加载
    return await loadHistoryFromDatabase(conversationId);
  }

  // 全新会话
  return createNewHistory();
}

/**
 * 从数据库加载对话历史
 */
async function loadHistoryFromDatabase(
  conversationId: string
): Promise<ChatMessageHistory> {
  const db = await getDb();
  const dbMessages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, conversationId))
    .orderBy(messagesTable.createdAt);

  const history = createNewHistory();

  for (const msg of dbMessages) {
    const metadata = msg.metadata ? JSON.parse(msg.metadata) : {};

    if (msg.role === "user") {
      await history.addMessage(new HumanMessage(msg.content));
    } else if (msg.role === "assistant") {
      await history.addMessage(
        new AIMessage({
          content: msg.content,
          tool_calls: metadata.tool_calls || [],
        })
      );
    } else if (msg.role === "tool") {
      await history.addMessage(
        new ToolMessage({
          content: msg.content,
          tool_call_id: metadata.tool_call_id || "legacy",
        })
      );
    }
  }

  // 加载后存入缓存
  setHistoryToCache(conversationId, history);
  return history;
}

/**
 * 创建新会话（数据库记录）
 */
export async function createConversation(
  userId: string | undefined,
  fingerprint: string | undefined,
  title: string
): Promise<string> {
  const db = await getDb();
  const createdConversation = await db
    .insert(conversations)
    .values({
      userId: userId || null,
      fingerprint: userId ? null : fingerprint,
      title: title.substring(0, 50) || "新对话",
    })
    .returning();

  return createdConversation[0].id;
}

/**
 * 保存用户消息到数据库
 */
export async function saveUserMessage(
  conversationId: string,
  content: string
): Promise<void> {
  const db = await getDb();
  await db.insert(messagesTable).values({
    conversationId,
    role: "user",
    content,
    createdAt: new Date(),
  });
}

/**
 * 保存助手消息到数据库
 */
export async function saveAssistantMessage(
  conversationId: string,
  content: string,
  metadata?: object
): Promise<void> {
  const db = await getDb();
  await db.insert(messagesTable).values({
    conversationId,
    role: "assistant",
    content,
    metadata: metadata ? JSON.stringify(metadata) : undefined,
    createdAt: new Date(),
  });
}

/**
 * 保存工具消息到数据库
 */
export async function saveToolMessage(
  conversationId: string,
  content: string,
  toolCallId: string
): Promise<void> {
  const db = await getDb();
  await db.insert(messagesTable).values({
    conversationId,
    role: "tool",
    content,
    metadata: JSON.stringify({ tool_call_id: toolCallId }),
    createdAt: new Date(),
  });
}

/**
 * 更新对话历史并保存到数据库
 * 处理用户消息、中间步骤和最终响应
 */
export async function updateHistoryWithResult(
  history: ChatMessageHistory,
  conversationId: string,
  userInput: string,
  intermediateSteps: IntermediateStep[] | undefined,
  finalOutput: string
): Promise<void> {
  // 添加用户消息到历史
  await history.addMessage(new HumanMessage(userInput));

  // 处理中间步骤
  if (intermediateSteps) {
    for (const step of intermediateSteps) {
      const toolCallId = `call_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 5)}`;

      // 提取干净的内容
      const action = step.action as {
        log?: string;
        messageLog?: { content: unknown }[];
      };
      let cleanContent = action.log || "";

      if (
        action.messageLog &&
        Array.isArray(action.messageLog) &&
        action.messageLog.length > 0
      ) {
        const lastMsg = action.messageLog[action.messageLog.length - 1];
        cleanContent =
          typeof lastMsg.content === "string"
            ? lastMsg.content
            : JSON.stringify(lastMsg.content);
      } else {
        cleanContent = cleanContent.replace(
          /^Invoking\s+".*?"\s+with\s+.*$/gm,
          ""
        );
      }

      const aiMsg = new AIMessage({
        content: cleanContent,
        tool_calls: [
          {
            name: step.action.tool,
            args: step.action.toolInput as Record<string, unknown>,
            id: toolCallId,
          },
        ],
      });

      const toolMsg = new ToolMessage({
        content:
          typeof step.observation === "string"
            ? step.observation
            : JSON.stringify(step.observation),
        tool_call_id: toolCallId,
      });

      await history.addMessage(aiMsg);
      await history.addMessage(toolMsg);

      // 保存到数据库
      await saveAssistantMessage(conversationId, aiMsg.content as string, {
        tool_calls: aiMsg.tool_calls,
      });
      await saveToolMessage(
        conversationId,
        toolMsg.content as string,
        toolCallId
      );
    }
  }

  // 添加最终响应到历史
  await history.addMessage(new AIMessage(finalOutput));

  // 保存最终响应到数据库
  await saveAssistantMessage(conversationId, finalOutput);
}

/**
 * 获取历史消息列表
 */
export async function getHistoryMessages(
  history: ChatMessageHistory
): Promise<BaseMessage[]> {
  return await history.getMessages();
}

/**
 * 初始化会话历史缓存
 */
export function initializeHistoryCache(
  conversationId: string,
  history: ChatMessageHistory
): void {
  setHistoryToCache(conversationId, history);
}
