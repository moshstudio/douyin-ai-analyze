import { AgentAction } from "langchain/agents";
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

const encoder = new TextEncoder();

/**
 * SSE 流式响应处理器
 */
export class StreamHandler {
  private controller: ReadableStreamDefaultController<Uint8Array>;
  private fullResponse: string = "";

  constructor(controller: ReadableStreamDefaultController<Uint8Array>) {
    this.controller = controller;
  }

  /**
   * 发送 SSE 数据
   */
  private send(data: object): void {
    this.controller.enqueue(
      encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
    );
  }

  /**
   * 发送无效格式错误
   */
  sendInvalidFormatError(message: string): void {
    const response: InvalidFormatErrorResponse = {
      type: "error",
      error: message,
    };
    this.send(response);
    this.controller.close();
  }

  /**
   * 发送限流错误
   */
  sendRateLimitError(
    isLoggedIn: boolean,
    remaining: number,
    limit: number
  ): void {
    const response: RateLimitErrorResponse = {
      type: "error",
      errorType: "rate_limit",
      message: isLoggedIn
        ? `已达到今日使用上限（${limit}次）`
        : `未登录用户今日使用次数已用完（${limit}次），请登录以获取更多使用次数`,
      remaining,
      limit,
    };
    this.send(response);
    this.controller.close();
  }

  /**
   * 发送通用错误
   */
  sendError(error: unknown): void {
    const response: ErrorResponse = {
      type: "error",
      message: error instanceof Error ? error.message : "Internal Server Error",
    };
    this.send(response);
    this.controller.close();
  }

  /**
   * 发送元数据（会话ID、限流信息）
   */
  sendMeta(conversationId: string, remaining: number, limit: number): void {
    const response: MetaResponse = {
      type: "meta",
      conversationId,
      remaining,
      limit,
    };
    this.send(response);
  }

  /**
   * 发送 token（流式输出）
   */
  sendToken(token: string): void {
    this.fullResponse += token;
    const response: TokenResponse = {
      type: "token",
      content: token,
    };
    this.send(response);
  }

  /**
   * 发送步骤开始信息
   */
  sendStepStart(action: AgentAction): void {
    const response: StepStartResponse = {
      type: "step",
      status: "start" as const,
      tool: action.tool,
      input: action.toolInput,
    };
    this.send(response);
  }

  /**
   * 发送步骤结束信息
   */
  sendStepEnd(output: string): void {
    const response: StepEndResponse = {
      type: "step",
      status: "end" as const,
      output,
    };
    this.send(response);
  }

  /**
   * 发送完成信号
   */
  sendDone(content: string): void {
    const response: DoneResponse = {
      type: "done",
      content,
    };
    this.send(response);
    this.controller.close();
  }

  /**
   * 发送测试消息（调试用）
   */
  sendTestToken(message: string): void {
    this.sendToken(` [TEST: ${message}] `);
  }

  /**
   * 获取完整的响应内容
   */
  getFullResponse(): string {
    return this.fullResponse;
  }

  /**
   * 创建 Agent 回调处理器
   */
  createAgentCallbacks() {
    return [
      {
        handleLLMNewToken: (token: string) => {
          this.sendToken(token);
        },
        handleAgentAction: (action: AgentAction) => {
          this.sendStepStart(action);
        },
        handleToolEnd: (output: string) => {
          this.sendStepEnd(output);
        },
      },
    ];
  }
}

/**
 * 创建 SSE 响应头
 */
export function createSSEHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  };
}
