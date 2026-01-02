"use client";

import { useMemo } from "react";
import { Message } from "@/lib/hooks/useChatStore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Bot, User as UserIcon } from "lucide-react";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import ToolResultRenderer from "@/components/ToolResultRenderer";
import ReportViewer from "@/components/ReportViewer";
import CollapsibleToolMessage from "@/components/CollapsibleToolMessage";

interface ChatMessageProps {
  message: Message & { toolResults?: Record<string, string> };
  userImage?: string | null;
  userName?: string | null;
}

export default function ChatMessage({
  message,
  userImage,
  userName,
}: ChatMessageProps) {
  const isUser = message.role === "user";

  const renderContent = () => {
    // If it's a tool output (fallback for orphan messages)
    if (message.role === "tool") {
      try {
        const data = JSON.parse(message.content);
        if (data.success && data.report) {
          return <ReportViewer report={data.report} />;
        }
      } catch {
        // ignore
      }
      return <ToolResultRenderer content={message.content} />;
    }

    return (
      <div className='flex flex-col gap-2 w-full'>
        {/* Text Content */}
        {message.content && (
          <div
            className={cn(
              isUser
                ? "text-base"
                : "prose prose-sm md:prose-base dark:prose-invert max-w-none leading-relaxed"
            )}
          >
            {isUser ? (
              <div className='whitespace-pre-wrap'>{message.content}</div>
            ) : (
              <MarkdownRenderer
                content={message.content.replace(
                  /^Invoking\s+".*?"\s+with\s+.*$/gm,
                  ""
                )}
              />
            )}
          </div>
        )}

        {/* Tool Calls */}
        {message.tool_calls && message.tool_calls.length > 0 && (
          <div className='mt-2 space-y-3 w-full'>
            {message.tool_calls.map((toolCall) => {
              const result =
                message.toolResults?.[toolCall.toolCallId || toolCall.id];

              const isExecuting = !result;
              let isReport = false;
              let reportData = null;

              if (result) {
                try {
                  const parsed = JSON.parse(result);
                  if (parsed.success && parsed.report) {
                    isReport = true;
                    reportData = parsed.report;
                  }
                } catch {
                  // Not a report
                }
              }

              if (isReport && reportData) {
                return (
                  <div
                    key={toolCall.toolCallId || toolCall.id}
                    className='my-2 w-full animate-in fade-in zoom-in-95 duration-300'
                  >
                    <ReportViewer report={reportData} />
                  </div>
                );
              }

              return (
                <CollapsibleToolMessage
                  key={toolCall.toolCallId || toolCall.id}
                  toolCall={toolCall}
                  result={result}
                  isExecuting={isExecuting}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={cn(
        "flex w-full gap-4 md:gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <Avatar className='h-8 w-8 md:h-10 md:w-10 border shadow-sm shrink-0'>
        {isUser ? (
          <>
            <AvatarImage
              src={userImage || ""}
              alt={userName || "User"}
            />
            <AvatarFallback className='bg-gradient-to-br from-blue-500 to-indigo-600 text-white'>
              {userName ? (
                userName[0].toUpperCase()
              ) : (
                <UserIcon className='h-5 w-5' />
              )}
            </AvatarFallback>
          </>
        ) : (
          <>
            <AvatarImage src='/bot-avatar.png' />
            <AvatarFallback className='bg-gradient-to-br from-indigo-500 to-purple-600 text-white'>
              <Bot className='h-5 w-5' />
            </AvatarFallback>
          </>
        )}
      </Avatar>

      {/* Message Bubble & Content */}
      <div
        className={cn(
          "flex flex-col max-w-[85%] md:max-w-[80%] min-w-0",
          isUser ? "items-end" : "items-start"
        )}
      >
        {/* Name (Optional, good for group chats but maybe clean here? Let's hide it for now or make it subtle) */}
        {/* <span className="text-xs text-muted-foreground mb-1 ml-1">{isUser ? "You" : "AI Analyst"}</span> */}

        <div
          className={cn(
            "relative px-5 py-3.5 shadow-sm",
            isUser
              ? "bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-2xl rounded-tr-sm"
              : "bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl rounded-tl-sm shadow-md"
          )}
        >
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
