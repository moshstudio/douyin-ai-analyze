"use client";

import React, { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  CheckCircle2,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ToolResultRenderer from "./ToolResultRenderer";
import { ToolCall } from "@/lib/hooks/useChatStore";

interface CollapsibleToolMessageProps {
  toolCall: ToolCall;
  result?: string;
  isExecuting?: boolean;
}

export default function CollapsibleToolMessage({
  toolCall,
  result,
  isExecuting,
}: CollapsibleToolMessageProps) {
  const [isOpen, setIsOpen] = useState(false); // Default closed as requested
  const isCompleted = !!result;

  return (
    <div className='rounded-lg border border-border/50 bg-card/50 overflow-hidden shadow-sm my-2 transition-all hover:border-border'>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-muted/50",
          isOpen ? "bg-muted/50" : ""
        )}
      >
        <div className='flex items-center gap-2'>
          <div
            className={cn(
              "flex items-center justify-center w-6 h-6 rounded-md",
              isCompleted
                ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                : "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
            )}
          >
            {isExecuting ? (
              <Loader2 className='w-3.5 h-3.5 animate-spin' />
            ) : isCompleted ? (
              <CheckCircle2 className='w-3.5 h-3.5' />
            ) : (
              <Terminal className='w-3.5 h-3.5' />
            )}
          </div>
          <span className='font-medium text-foreground/80'>
            {toolCall.toolName || toolCall.name}
          </span>
          <span className='text-xs text-muted-foreground font-mono ml-2 opacity-50 hidden sm:inline-block'>
            {/* Show a snippet of args if needed, or just "Called" */}
            {toolCall.toolCallId}
          </span>
        </div>
        <div className='flex items-center gap-1 text-muted-foreground'>
          <span className='text-xs font-normal'>
            {isOpen ? "收起" : "详情"}
          </span>
          {isOpen ? (
            <ChevronDown className='w-4 h-4' />
          ) : (
            <ChevronRight className='w-4 h-4' />
          )}
        </div>
      </button>

      {isOpen && (
        <div className='border-t border-border/50 text-sm'>
          {/* Arguments */}
          {toolCall.args && (
            <div className='px-4 py-3 bg-muted/20 border-b border-border/50'>
              <div className='text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider'>
                输入参数
              </div>
              <div className='font-mono text-xs bg-slate-50 dark:bg-slate-950 p-2 rounded border border-border/50 overflow-auto max-h-[150px]'>
                {JSON.stringify(toolCall.args, null, 2)}
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className='px-4 py-3 bg-background'>
              <div className='text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider'>
                执行结果
              </div>
              <div className='overflow-auto max-h-[500px]'>
                <ToolResultRenderer content={result} />
              </div>
            </div>
          )}

          {/* Loading State Body */}
          {isExecuting && !result && (
            <div className='px-4 py-3 text-muted-foreground italic text-xs'>
              正在执行工具调用...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
