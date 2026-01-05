import { NextRequest } from "next/server";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAgentModel } from "@/lib/llm";
import { auth } from "@/lib/auth";
import { checkRateLimit, recordUsage } from "@/lib/rate-limit";
import {
  agentTools,
  createAgentPrompt,
  getAgentMaxIterations,
  getOrCreateHistory,
  createConversation,
  saveUserMessage,
  updateHistoryWithResult,
  getHistoryMessages,
  initializeHistoryCache,
  createSSEHeaders,
} from "@/lib/agent";

interface ChatRequest {
  messages: { role: string; content: string }[];
  conversationId?: string;
  fingerprint?: string;
}

export async function POST(req: NextRequest) {
  // 使用 TransformStream 创建流式响应
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // 获取 Cloudflare context 用于 waitUntil
  const context = await getCloudflareContext({ async: true });

  // 辅助函数：发送 SSE 数据
  const sendData = async (data: object) => {
    await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  };

  // 在后台执行 Agent 逻辑
  const agentTask = async () => {
    try {
      // 解析请求
      const { messages, conversationId, fingerprint } =
        (await req.json()) as ChatRequest;

      // 验证请求格式
      if (!messages || !Array.isArray(messages)) {
        await sendData({ type: "error", error: "Invalid messages format" });
        await writer.close();
        return;
      }

      // 检查认证状态
      const session = await auth();
      const userId = session?.user?.id;

      // 检查限流
      const rateLimitResult = await checkRateLimit(fingerprint, userId);
      if (!rateLimitResult.allowed) {
        await sendData({
          type: "error",
          errorType: "rate_limit",
          message: userId
            ? `已达到今日使用上限（${rateLimitResult.limit}次）`
            : `未登录用户今日使用次数已用完（${rateLimitResult.limit}次），请登录以获取更多使用次数`,
          remaining: rateLimitResult.remaining,
          limit: rateLimitResult.limit,
        });
        await writer.close();
        return;
      }

      // 获取用户输入
      const currentInput = messages[messages.length - 1]?.content || "";

      // 获取或创建对话历史
      const langchainHistory = await getOrCreateHistory(conversationId);

      // 确定会话 ID（创建新会话或使用现有会话）
      let dbConversationId = conversationId;
      if (!dbConversationId) {
        dbConversationId = await createConversation(
          userId,
          fingerprint,
          currentInput
        );
        initializeHistoryCache(dbConversationId, langchainHistory);
      }

      // 保存用户消息到数据库
      await saveUserMessage(dbConversationId, currentInput);

      // 记录使用次数
      await recordUsage("chat", fingerprint, userId);

      // 发送元数据
      await sendData({
        type: "meta",
        conversationId: dbConversationId,
        remaining: rateLimitResult.remaining - 1,
        limit: rateLimitResult.limit,
      });

      // 获取聊天历史
      const chatHistory = await getHistoryMessages(langchainHistory);

      // 初始化 Agent
      const model = getAgentModel({ streaming: true });
      const prompt = createAgentPrompt();

      // 用于存储完整响应
      let fullResponse = "";

      // 创建 Agent 回调
      const callbacks = [
        {
          handleLLMNewToken: async (token: string) => {
            fullResponse += token;
            await sendData({ type: "token", content: token });
          },
          handleAgentAction: async (action: {
            tool: string;
            toolInput: unknown;
          }) => {
            await sendData({
              type: "step",
              status: "start",
              tool: action.tool,
              input: action.toolInput,
            });
          },
          handleToolEnd: async (output: string) => {
            await sendData({ type: "step", status: "end", output });
          },
        },
      ];

      const agent = createToolCallingAgent({
        llm: model,
        tools: agentTools,
        prompt,
      });

      const agentExecutor = new AgentExecutor({
        agent,
        tools: agentTools,
        verbose: false,
        maxIterations: getAgentMaxIterations(),
        returnIntermediateSteps: true,
      });

      // 执行 Agent
      const result = await agentExecutor.invoke(
        {
          input: currentInput,
          chat_history: chatHistory,
          conversationId: dbConversationId,
        },
        { callbacks }
      );

      // 获取最终输出
      const finalOutput = result.output || fullResponse;

      // 更新历史并保存到数据库
      await updateHistoryWithResult(
        langchainHistory,
        dbConversationId,
        currentInput,
        result.intermediateSteps,
        finalOutput
      );

      // 发送完成信号
      await sendData({ type: "done", content: finalOutput });
      await writer.close();
    } catch (error) {
      console.error("Chat agent API error:", error);
      await sendData({
        type: "error",
        message:
          error instanceof Error ? error.message : "Internal Server Error",
      });
      await writer.close();
    }
  };

  // 使用 waitUntil 在后台执行 Agent 任务
  context.ctx.waitUntil(agentTask());

  return new Response(readable, {
    headers: createSSEHeaders(),
  });
}
