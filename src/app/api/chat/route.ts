import { NextRequest, NextResponse } from "next/server";
import { getAgentModel } from "@/lib/llm";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
} from "@langchain/core/messages";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { messages, conversationId } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Invalid messages format" },
        { status: 400 }
      );
    }

    // Initialize LangChain Agent Model
    const model = getAgentModel({ streaming: false });

    // Convert messages to LangChain format
    const langchainMessages = messages.map(
      (msg: { role: string; content: string }) => {
        switch (msg.role) {
          case "user":
            return new HumanMessage(msg.content);
          case "assistant":
            return new AIMessage(msg.content);
          case "system":
            return new SystemMessage(msg.content);
          default:
            return new HumanMessage(msg.content);
        }
      }
    );

    // Add system message for context
    const systemPrompt =
      new SystemMessage(`你是一个专业的抖音视频数据分析助手。你的任务是：
1. 理解用户的需求（如寻找创业点子）
2. 通过提问澄清用户的具体需求（如哪个领域的创业点子）
3. 制定搜索和分析计划（如"我会先搜索xx视频，然后进行分析，分析后生成报表展示"）
4. 调用相应的工具获取和分析抖音视频数据
5. 生成结构化的分析报告

始终保持友好、专业的语气，并提供清晰的执行规划。`);

    const allMessages = [systemPrompt, ...langchainMessages];

    // Get AI response
    const response = await model.invoke(allMessages);

    // Save conversation to database
    let dbConversationId = conversationId;
    if (!dbConversationId) {
      // Create new conversation
      const conversation = await prisma.conversation.create({
        data: {
          userId: "default-user", // TODO: Implement user authentication
          title: messages[0]?.content?.substring(0, 50) || "新对话",
        },
      });
      dbConversationId = conversation.id;
    }

    // Save messages
    const lastUserMessage = messages[messages.length - 1];
    if (lastUserMessage) {
      await prisma.message.create({
        data: {
          conversationId: dbConversationId,
          role: lastUserMessage.role,
          content: lastUserMessage.content,
        },
      });
    }

    await prisma.message.create({
      data: {
        conversationId: dbConversationId,
        role: "assistant",
        content: response.content.toString(),
      },
    });

    return NextResponse.json({
      message: response.content,
      conversationId: dbConversationId,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Failed to process chat message" },
      { status: 500 }
    );
  }
}
