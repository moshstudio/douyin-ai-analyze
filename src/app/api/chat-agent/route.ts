import { NextRequest } from "next/server";
import { getAgentModel } from "@/lib/llm";
import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import {
  AgentAction,
  AgentExecutor,
  createToolCallingAgent,
} from "langchain/agents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import prisma from "@/lib/prisma";
import { douyinSearchTool } from "@/lib/tools/douyin-search";
import { videoAnalyzerTool } from "@/lib/tools/video-analyzer";
import { reportGeneratorTool } from "@/lib/tools/report-generator";
import { fetchVideoCommentsTool } from "@/lib/tools/fetch-comments";
import { fetchVideoDetailTool } from "@/lib/tools/fetch-video-detail";
import { fetchHotSearchListTool } from "@/lib/tools/fetch-hot-search-list";
import { auth } from "@/lib/auth";
import { ChatMessageHistory } from "langchain/stores/message/in_memory";
import { checkRateLimit, recordUsage } from "@/lib/rate-limit";
import {
  ErrorResponse,
  RateLimitErrorResponse,
  MetaResponse,
  TokenResponse,
  StepStartResponse,
  StepEndResponse,
  DoneResponse,
  InvalidFormatErrorResponse,
} from "@/lib/types/api-response";

// 简单的内存缓存，存储 ChatMessageHistory 对象
const historyCache = new Map<
  string,
  { history: ChatMessageHistory; lastAccess: number }
>();
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

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const { messages, conversationId, fingerprint } =
          (await req.json()) as {
            messages: { role: string; content: string }[];
            conversationId?: string;
            fingerprint?: string;
          };

        if (!messages || !Array.isArray(messages)) {
          const errorResponse: InvalidFormatErrorResponse = {
            type: "error",
            error: "Invalid messages format",
          };
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(errorResponse)}\n\n`)
          );
          controller.close();
          return;
        }

        // 检查认证状态
        const session = await auth();
        const userId = session?.user?.id;

        // 检查限流
        const rateLimitResult = await checkRateLimit(fingerprint, userId);

        if (!rateLimitResult.allowed) {
          const rateLimitErrorResponse: RateLimitErrorResponse = {
            type: "error",
            errorType: "rate_limit",
            message: userId
              ? `已达到今日使用上限（${rateLimitResult.limit}次）`
              : `未登录用户今日使用次数已用完（${rateLimitResult.limit}次），请登录以获取更多使用次数`,
            remaining: rateLimitResult.remaining,
            limit: rateLimitResult.limit,
          };
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify(rateLimitErrorResponse)}\n\n`
            )
          );
          controller.close();
          return;
        }

        // Initialize LangChain Agent Model
        const model = getAgentModel({ streaming: true });

        // Define tools
        const tools = [
          douyinSearchTool,
          videoAnalyzerTool,
          reportGeneratorTool,
          fetchVideoCommentsTool,
          fetchVideoDetailTool,
          fetchHotSearchListTool,
        ];

        // Create agent prompt
        const prompt = ChatPromptTemplate.fromMessages([
          [
            "system",
            `你是一个专业的抖音视频数据分析助手。你有以下能力：

1. 搜索抖音视频 (douyin_search)
2. 获取视频评论 (fetch_video_comments)
3. 获取视频详情 (fetch_video_detail)
4. 获取抖音热搜榜 (fetch_hot_search_list)
5. 分析视频内容 (analyze_videos)
6. 生成分析报告 (generate_report)

核心原则：
1. **优先使用专用工具**：当用户指令对应特定功能时（例如"查看热点榜"），应优先使用专用工具（如 'fetch_hot_search_list'），而不是通用搜索工具。
2. **准确理解需求**：仔细分析用户意图，准确区分"获取数据"、"分析内容"等不同指令。
3. **高效执行**：对于明确、简单的单一任务（如"查一下热搜"、"获取视频评论"），直接调用工具即可，无需输出繁琐的计划。

工作流程：

【第一阶段：意图识别】
- 分析用户输入，判断是简单查询还是复杂分析任务。
- 如果是简单查询，直接进入工具执行阶段。
- 如果是复杂任务（如"分析某领域趋势并生成报告"），可以先简要说明执行思路（例如"好的，我将按以下步骤分析..."）。

【第二阶段：工具执行】
- 根据需求选择最合适的工具。
- 在调用 'analyze_videos' 和 'generate_report' 时，请务必提取用户关注点并准确填入 'userRequirements' 参数。如果没有明确要求，请根据视频内容自动归纳分析重点。

【第三阶段：结果反馈】
- 工具执行完成后，结合数据回答用户问题。
- 如需生成报告，请使用 'generate_report' 工具。

保持语气专业、客观。

当前对话ID: {conversationId}`,
          ],
          ["placeholder", "{chat_history}"],
          ["human", "{input}"],
          ["placeholder", "{agent_scratchpad}"],
        ]);

        // Create agent
        const agent = createToolCallingAgent({
          llm: model,
          tools,
          prompt,
        });

        // Create agent executor
        const maxIterations = parseInt(
          process.env.AGENT_MAX_ITERATIONS || "12"
        );

        const agentExecutor = new AgentExecutor({
          agent,
          tools,
          verbose: false,
          maxIterations: maxIterations,
          returnIntermediateSteps: true,
        });

        const currentInput = messages[messages.length - 1]?.content || "";

        // 维护对话历史
        let langchainHistory: ChatMessageHistory;

        if (conversationId && historyCache.has(conversationId)) {
          // 缓存命中
          const entry = historyCache.get(conversationId)!;
          entry.lastAccess = Date.now();
          langchainHistory = entry.history;

          // 如果前端只传了最后一条消息（优化模式），我们可以直接使用缓存的历史
          // 如果前端传了完整历史（兼容模式），我们暂时以缓存为准，或者可以合并
          // 在本需求中，前端将只传最新一条，所以我们只需要把新消息加入历史
        } else if (conversationId) {
          // 缓存未命中但有会话ID，从数据库加载
          const dbMessages = await prisma.message.findMany({
            where: { conversationId },
            orderBy: { createdAt: "asc" },
          });

          langchainHistory = new ChatMessageHistory();
          for (const msg of dbMessages) {
            const metadata = msg.metadata ? JSON.parse(msg.metadata) : {};
            if (msg.role === "user") {
              await langchainHistory.addMessage(new HumanMessage(msg.content));
            } else if (msg.role === "assistant") {
              await langchainHistory.addMessage(
                new AIMessage({
                  content: msg.content,
                  tool_calls: metadata.tool_calls || [],
                })
              );
            } else if (msg.role === "tool") {
              await langchainHistory.addMessage(
                new ToolMessage({
                  content: msg.content,
                  tool_call_id: metadata.tool_call_id || "legacy",
                })
              );
            }
          }
          historyCache.set(conversationId, {
            history: langchainHistory,
            lastAccess: Date.now(),
          });
        } else {
          // 全新会话
          langchainHistory = new ChatMessageHistory();
        }

        const chatHistory = await langchainHistory.getMessages();

        // Save conversation to database
        let dbConversationId = conversationId;
        if (!dbConversationId) {
          const conversation = await prisma.conversation.create({
            data: {
              userId: userId || null,
              fingerprint: userId ? null : fingerprint,
              title: currentInput.substring(0, 50) || "新对话",
            },
          });
          dbConversationId = conversation.id;
          historyCache.set(dbConversationId, {
            history: langchainHistory,
            lastAccess: Date.now(),
          });
        }

        // Save user message to database immediately to ensure correct order
        await prisma.message.create({
          data: {
            conversationId: dbConversationId,
            role: "user",
            content: currentInput,
          },
        });

        // 记录使用次数
        await recordUsage("chat", fingerprint, userId);

        // 发送会话 ID 和限流信息
        const metaResponse: MetaResponse = {
          type: "meta",
          conversationId: dbConversationId,
          remaining: rateLimitResult.remaining - 1,
          limit: rateLimitResult.limit,
        };
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(metaResponse)}\n\n`)
        );

        let fullResponse = "";

        // Execute agent with streaming
        const result = await agentExecutor.invoke(
          {
            input: currentInput,
            chat_history: chatHistory,
            conversationId: dbConversationId,
          },
          {
            callbacks: [
              {
                handleLLMNewToken(token: string) {
                  fullResponse += token;
                  const tokenResponse: TokenResponse = {
                    type: "token",
                    content: token,
                  };
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify(tokenResponse)}\n\n`)
                  );
                },
                handleAgentAction(action: AgentAction) {
                  const stepStartResponse: StepStartResponse = {
                    type: "step",
                    status: "start" as const,
                    tool: action.tool,
                    input: action.toolInput,
                  };
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify(stepStartResponse)}\n\n`
                    )
                  );
                },
                handleToolEnd(output: string) {
                  const stepEndResponse: StepEndResponse = {
                    type: "step",
                    status: "end" as const,
                    output: output,
                  };
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify(stepEndResponse)}\n\n`
                    )
                  );
                },
              },
            ],
          }
        );

        // 发送完成信号
        const finalOutput = result.output || fullResponse;
        // 更新缓存 (这里我们简单处理，把全量消息推入缓存)
        // 实际上 langchainHistory 已经在执行过程中被 AgentExecutor 同步更新了吗？
        // 不，AgentExecutor 不会自动写回 ChatMessageHistory，我们需要手动同步。
        await langchainHistory.addMessage(new HumanMessage(currentInput));

        // 如果有中间步骤，也加入内存历史
        if (result.intermediateSteps) {
          for (const step of result.intermediateSteps) {
            const toolCallId = `call_${Date.now()}_${Math.random()
              .toString(36)
              .slice(2, 5)}`;
            // Extract clean content from messageLog if available, as AgentAction.log contains "Invoking..." text
            const action = step.action as any;
            let cleanContent = action.log || "";

            if (
              action.messageLog &&
              Array.isArray(action.messageLog) &&
              action.messageLog.length > 0
            ) {
              const lastMsg = action.messageLog[action.messageLog.length - 1];
              // Use the raw message content (thought) which doesn't have the synthetic "Invoking..." text
              cleanContent =
                typeof lastMsg.content === "string"
                  ? lastMsg.content
                  : JSON.stringify(lastMsg.content);
            } else {
              // Fallback for agents that don't provide messageLog
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
                  args: step.action.toolInput,
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
            await langchainHistory.addMessage(aiMsg);
            await langchainHistory.addMessage(toolMsg);

            // 同时保存到数据库
            await prisma.message.create({
              data: {
                conversationId: dbConversationId,
                role: "assistant",
                content: aiMsg.content as string,
                metadata: JSON.stringify({ tool_calls: aiMsg.tool_calls }),
              },
            });
            await prisma.message.create({
              data: {
                conversationId: dbConversationId,
                role: "tool",
                content: toolMsg.content as string,
                metadata: JSON.stringify({
                  tool_call_id: toolMsg.tool_call_id,
                }),
              },
            });
          }
        }

        await langchainHistory.addMessage(new AIMessage(finalOutput));

        // Save final assistant message to database
        await prisma.message.create({
          data: {
            conversationId: dbConversationId,
            role: "assistant",
            content: finalOutput,
          },
        });

        const doneResponse: DoneResponse = {
          type: "done",
          content: finalOutput,
        };
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(doneResponse)}\n\n`)
        );

        controller.close();
      } catch (error) {
        console.error("Chat agent API error:", error);
        const errorResponse: ErrorResponse = {
          type: "error",
          message:
            error instanceof Error ? error.message : "Internal Server Error",
        };
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(errorResponse)}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
