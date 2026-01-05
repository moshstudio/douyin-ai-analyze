"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Chat, {
  useMessages,
  MessageProps,
  IconButton,
  Typing,
} from "@chatui/core";
import "@chatui/core/dist/index.css";
import { ChatSidebar } from "@/components/ChatSidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Menu,
  StopCircle,
  Bot,
  User as UserIcon,
  Sparkles,
} from "lucide-react";
import FingerprintJS from "@fingerprintjs/fingerprintjs";
import { useChatStore, Message, ToolCall } from "@/lib/hooks/useChatStore";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { useSession } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import ToolResultRenderer from "@/components/ToolResultRenderer";
import ReportViewer from "@/components/ReportViewer";
import CollapsibleToolMessage from "@/components/CollapsibleToolMessage";

import { replaceDouyinEmotes } from "@/lib/emoji-utils";

interface ChatInterfaceProps {
  rateLimit?: { remaining: number; limit: number } | null;
  setRateLimit?: (limit: { remaining: number; limit: number }) => void;
  conversationId?: string;
}

// 消息内容渲染组件
function MessageContent({
  msg,
  toolResults,
}: {
  msg: Message;
  toolResults?: Record<string, string>;
}) {
  const isUser = msg.role === "user";

  if (msg.role === "tool") {
    let data = undefined;
    try {
      data = JSON.parse(msg.content);
    } catch {
      /* ignore */
    }
    if (data?.success && data?.report) {
      return <ReportViewer report={data.report} />;
    } else {
      return <ToolResultRenderer content={msg.content} />;
    }
  }

  return (
    <div className='flex flex-col gap-2 w-full'>
      {!msg.content && !msg.tool_calls?.length && <Typing />}
      {msg.content && (
        <div
          className={cn(
            "w-full",
            isUser ? "text-base whitespace-pre-wrap" : ""
          )}
        >
          {isUser ? (
            <div>{replaceDouyinEmotes(msg.content)}</div>
          ) : (
            <MarkdownRenderer
              className='prose-sm md:prose-base'
              content={msg.content.replace(
                /^Invoking\s+".*?"\s+with\s+.*$/gm,
                ""
              )}
            />
          )}
        </div>
      )}
      {msg.tool_calls?.map((toolCall) => {
        const result = toolResults?.[toolCall.toolCallId || toolCall.id];
        try {
          const parsed = result ? JSON.parse(result) : null;
          if (parsed?.success && parsed?.report)
            return (
              <div
                key={toolCall.id}
                className='my-2 w-full'
              >
                <ReportViewer report={parsed.report} />
              </div>
            );
        } catch {
          /* ignore */
        }
        return (
          <CollapsibleToolMessage
            key={toolCall.id}
            toolCall={toolCall}
            result={result}
            isExecuting={!result}
          />
        );
      })}
    </div>
  );
}

export default function ChatInterface({
  setRateLimit,
  conversationId,
}: ChatInterfaceProps) {
  const {
    messages,
    currentConversationId,
    setFingerprint,
    addMessage,
    updateLastMessage,
    addMessageToConversation,
    updateLastMessageInConversation,
    loadConversations,
    refreshConversations,
    selectConversation,
    createConversation,
    fingerprint,
  } = useChatStore();
  const { data: session } = useSession();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const locale = useLocale();
  const t = useTranslations("chat");
  const { messages: chatMessages, appendMsg, resetList } = useMessages([]);

  // Sync URL conversationId with store
  useEffect(() => {
    // Wait for authentication check or fingerprint generation
    if (!session?.user && !fingerprint) return;

    if (conversationId && conversationId !== currentConversationId)
      selectConversation(conversationId);
    else if (!conversationId && currentConversationId !== null) {
      // Logic to prevent resetting conversation if we just manually updated URL
      // (Seamless transition from New Chat -> Active Chat)
      if (
        typeof window !== "undefined" &&
        window.location.pathname.includes(currentConversationId)
      ) {
        return;
      }
      createConversation();
    }
  }, [
    conversationId,
    currentConversationId,
    selectConversation,
    createConversation,
    session,
    fingerprint,
  ]);

  // Initialize fingerprint
  useEffect(() => {
    (async () => {
      const fp = await FingerprintJS.load();
      setFingerprint((await fp.get()).visitorId);
      loadConversations();
    })();
  }, [setFingerprint, loadConversations]);

  // Sync store messages to ChatUI format
  useEffect(() => {
    resetList();
    messages
      .reduce<Array<Message & { toolResults?: Record<string, string> }>>(
        (acc, msg, i) => {
          if (msg.role === "tool") return acc;
          if (msg.role === "assistant" && msg.tool_calls?.length) {
            const toolResults: Record<string, string> = {};
            for (
              let j = i + 1;
              j < messages.length && messages[j].role === "tool";
              j++
            ) {
              if (messages[j].tool_call_id)
                toolResults[messages[j].tool_call_id!] = messages[j].content;
            }
            acc.push({ ...msg, toolResults });
          } else acc.push(msg);
          return acc;
        },
        []
      )
      .forEach((msg) =>
        appendMsg({
          _id: msg.id,
          type: "custom",
          content: msg,
          position: msg.role === "user" ? "right" : "left",
        })
      );
  }, [messages, resetList, appendMsg]);

  // Handle send message
  const handleSend = useCallback(
    async (_type: string, val: string) => {
      if (!val.trim() || isSending) return;
      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content: val,
      };
      addMessage(userMessage);
      setIsSending(true);

      const convId = currentConversationId;
      const { fingerprint } = useChatStore.getState();
      const ac = new AbortController();
      abortControllerRef.current = ac;

      try {
        const response = await fetch("/api/chat-agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [userMessage],
            conversationId: convId,
            fingerprint,
          }),
          signal: ac.signal,
        });
        if (!response.ok) throw new Error("Network error");
        if (!response.body) return;

        addMessageToConversation(
          { id: `${Date.now() + 1}`, role: "assistant", content: "" },
          convId
        );
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let done = false,
          lastToolCallId: string | null = null,
          // 使用可变变量追踪当前流式输出的对话ID（用于新对话创建后更新）
          streamConvId: string | null = convId;

        while (!done) {
          const { value, done: doneReading } = await reader.read();
          done = doneReading;
          for (const line of decoder.decode(value).split("\n\n")) {
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6);
            if (jsonStr === "[DONE]") break;
            try {
              const data = JSON.parse(jsonStr);
              // 获取目标对话的当前消息（用于判断最后一条消息）
              const targetMsgs = await useChatStore
                .getState()
                .getMessagesForConversation(streamConvId);
              const lastMsg = targetMsgs[targetMsgs.length - 1];

              if (data.type === "token") {
                if (!lastMsg || lastMsg.role !== "assistant")
                  addMessageToConversation(
                    {
                      id: `${Date.now()}_${Math.random()}`,
                      role: "assistant",
                      content: data.content,
                    },
                    streamConvId
                  );
                else
                  updateLastMessageInConversation(streamConvId, data.content);
              } else if (data.type === "step") {
                if (data.status === "start") {
                  lastToolCallId = `call_${
                    typeof crypto !== "undefined" && crypto.randomUUID
                      ? crypto.randomUUID()
                      : `${Date.now()}_${Math.random()
                          .toString(36)
                          .slice(2, 11)}`
                  }`;
                  const toolCall: ToolCall = {
                    id: lastToolCallId,
                    name: data.tool,
                    args:
                      typeof data.input === "string"
                        ? { input: data.input }
                        : data.input,
                    toolName: data.tool,
                    toolCallId: lastToolCallId,
                  };
                  if (lastMsg?.role === "assistant" && !lastMsg.content)
                    updateLastMessageInConversation(streamConvId, "", [
                      ...(lastMsg.tool_calls || []),
                      toolCall,
                    ]);
                  else
                    addMessageToConversation(
                      {
                        id: `${Date.now()}_${Math.random()}`,
                        role: "assistant",
                        content: "",
                        tool_calls: [toolCall],
                      },
                      streamConvId
                    );
                } else if (data.status === "end") {
                  addMessageToConversation(
                    {
                      id: `${Date.now()}_${Math.random()}`,
                      role: "tool",
                      content:
                        typeof data.output === "string"
                          ? data.output
                          : JSON.stringify(data.output),
                      tool_call_id: lastToolCallId || `call_${Date.now()}`,
                    },
                    streamConvId
                  );
                }
              } else if (data.type === "meta") {
                if (data.conversationId && !convId) {
                  // 更新流式输出追踪的对话ID
                  streamConvId = data.conversationId;

                  // 只有当用户没有切换到其他对话时，才更新当前对话ID和URL
                  const currentState = useChatStore.getState();
                  if (currentState.currentConversationId === null) {
                    useChatStore
                      .getState()
                      .setCurrentConversationId(data.conversationId);

                    // Seamless URL update without page reload
                    const newPath = `/${locale}/c/${data.conversationId}`;
                    window.history.replaceState(
                      { ...window.history.state, as: newPath, url: newPath },
                      "",
                      newPath
                    );
                  }

                  // Immediately refresh the sidebar list
                  refreshConversations();
                }
                if (data.remaining !== undefined && setRateLimit)
                  setRateLimit({
                    remaining: data.remaining,
                    limit: data.limit,
                  });
              } else if (data.type === "error")
                updateLastMessageInConversation(
                  streamConvId,
                  `\n\n**Error:** ${data.message || data.error}`
                );
            } catch (e) {
              console.error("SSE parse error", e);
            }
          }
        }
        refreshConversations();
      } catch (error: unknown) {
        if (error instanceof Error && error.name !== "AbortError")
          addMessage({
            id: Date.now().toString(),
            role: "assistant",
            content: t("errorMessage"),
          });
      } finally {
        setIsSending(false);
        abortControllerRef.current = null;
      }
    },
    [
      isSending,
      currentConversationId,
      locale,
      setRateLimit,
      t,
      addMessage,
      addMessageToConversation,
      updateLastMessageInConversation,
      refreshConversations,
    ]
  );

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsSending(false);
  }, []);

  // Custom message bubble renderer
  const renderMessageContent = useCallback(
    (msg: MessageProps) => {
      const data = msg.content as Message & {
        toolResults?: Record<string, string>;
      };
      const isUser = data.role === "user";
      return (
        <div
          className={cn(
            "flex gap-3 w-full max-w-full",
            isUser ? "flex-row-reverse" : "flex-row"
          )}
        >
          <Avatar className='h-8 w-8 border shadow-sm shrink-0'>
            {isUser ? (
              <>
                <AvatarImage src={session?.user?.image || ""} />
                <AvatarFallback className='bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-sm'>
                  {session?.user?.name?.[0]?.toUpperCase() || (
                    <UserIcon className='h-4 w-4' />
                  )}
                </AvatarFallback>
              </>
            ) : (
              <AvatarFallback className='bg-gradient-to-br from-indigo-500 to-purple-600 text-white'>
                <Bot className='h-4 w-4' />
              </AvatarFallback>
            )}
          </Avatar>
          <div
            className={cn(
              "relative px-4 py-3 shadow-sm max-w-[calc(100%-3rem)]",
              isUser
                ? "bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-2xl rounded-tr-sm"
                : "bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl rounded-tl-sm shadow-md"
            )}
          >
            <MessageContent
              msg={data}
              toolResults={data.toolResults}
            />
          </div>
        </div>
      );
    },
    [session]
  );

  return (
    <div className='flex h-full relative overflow-hidden bg-white dark:bg-slate-950'>
      {/* Desktop Sidebar */}
      <div className='hidden md:block w-64 h-full border-r shrink-0'>
        <ChatSidebar />
      </div>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div className='absolute inset-0 z-50 md:hidden flex'>
          <div className='w-64 h-full bg-background border-r shadow-xl'>
            <ChatSidebar onClose={() => setIsSidebarOpen(false)} />
          </div>
          <div
            className='flex-1 bg-black/20 backdrop-blur-sm'
            onClick={() => setIsSidebarOpen(false)}
          />
        </div>
      )}

      {/* Main Chat Area */}
      <div className='flex-1 flex flex-col h-full w-full min-w-0'>
        {/* Mobile Header */}
        <div className='md:hidden border-b p-3 flex items-center gap-2 bg-background/80 backdrop-blur-sm z-10 shrink-0'>
          <Button
            variant='ghost'
            size='icon'
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu className='w-5 h-5' />
          </Button>
          <span className='font-semibold'>Chat</span>
        </div>

        {/* ChatUI Container */}
        <div className='flex-1 overflow-hidden'>
          {messages.length === 0 ? (
            <div className='h-full flex flex-col'>
              <div className='flex-1 flex items-center justify-center hidden'>
                <div className='flex flex-col items-center text-center space-y-6 p-8'>
                  <div className='w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/20'>
                    <Sparkles className='w-10 h-10' />
                  </div>
                  <div className='max-w-md space-y-2'>
                    <h2 className='text-3xl font-bold tracking-tight'>
                      {t("emptyStateTitle")}
                    </h2>
                    <p className='text-muted-foreground text-lg'>
                      {t("emptyStateDesc")}
                    </p>
                  </div>
                </div>
              </div>
              <Chat
                messages={[]}
                renderMessageContent={() => null}
                onSend={handleSend}
                placeholder={t("placeholder")}
                locale='zh-CN'
              />
            </div>
          ) : (
            <Chat
              messages={chatMessages}
              renderMessageContent={renderMessageContent}
              onSend={handleSend}
              placeholder={t("placeholder")}
              locale='zh-CN'
              rightAction={
                isSending
                  ? {
                      icon: "pause-circle",
                      label: "停止",
                      className:
                        "!bg-gradient-to-r !from-red-500 !to-rose-500 !text-white !border-0 !rounded-lg !px-3 !py-1 !text-sm !font-medium   hover:!from-red-600 hover:!to-rose-600 !transition-all !duration-300",
                      onClick: handleStop,
                    }
                  : undefined
              }
            />
          )}
        </div>

        {/* Disclaimer */}
        <div className='px-4 py-2 text-center shrink-0 hidden'>
          <p className='text-[10px] md:text-xs text-muted-foreground opacity-70'>
            {t("disclaimer")}
          </p>
        </div>
      </div>
    </div>
  );
}
