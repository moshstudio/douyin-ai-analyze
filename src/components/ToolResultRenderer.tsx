"use client";

import React, { useState } from "react";
import MarkdownRenderer from "./MarkdownRenderer";
import { ChevronDown, ChevronRight, Copy, Check } from "lucide-react";

interface ToolResultRendererProps {
  content: string;
}

export default function ToolResultRenderer({
  content,
}: ToolResultRendererProps) {
  const [copied, setCopied] = useState(false);

  // Try to parse as JSON
  let data: unknown = null;
  let isJson = false;

  try {
    if (content.trim().startsWith("{") || content.trim().startsWith("[")) {
      data = JSON.parse(content) as JsonValue;
      isJson = true;
    }
  } catch {
    isJson = false;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isJson) {
    return (
      <div className='relative group'>
        <button
          onClick={handleCopy}
          className='absolute right-2 top-2 p-1.5 rounded-md bg-muted/50 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted'
          title='复制结果'
        >
          {copied ? (
            <Check className='w-3.5 h-3.5 text-green-500' />
          ) : (
            <Copy className='w-3.5 h-3.5' />
          )}
        </button>
        <div className='p-3 font-mono text-xs whitespace-pre-wrap break-all'>
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className='relative group flex flex-col'>
      <div className='absolute right-2 top-2 z-10'>
        <button
          onClick={handleCopy}
          className='p-1.5 rounded-md bg-muted/50 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted'
          title='复制 JSON'
        >
          {copied ? (
            <Check className='w-3.5 h-3.5 text-green-500' />
          ) : (
            <Copy className='w-3.5 h-3.5' />
          )}
        </button>
      </div>
      <div className='p-2 overflow-x-auto'>
        <JsonNode
          value={data as JsonValue}
          depth={0}
        />
      </div>
    </div>
  );
}

type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

function JsonNode({
  value,
  name,
  depth = 0,
}: {
  value: JsonValue;
  name?: string;
  depth?: number;
}) {
  const [isExpanded, setIsExpanded] = useState(depth < 2);

  // Fields that likely contain markdown content
  const markdownFields = [
    "analysis",
    "content",
    "summary",
    "insights",
    "recommendations",
    "description",
    "message",
    "error",
  ];

  if (value === null)
    return <div className='ml-4 text-muted-foreground italic'>null</div>;

  if (typeof value !== "object") {
    const isMarkdown =
      name &&
      markdownFields.includes(name.toLowerCase()) &&
      typeof value === "string";

    return (
      <div className='flex flex-col ml-4'>
        <div className='flex items-start gap-2 py-0.5'>
          {name && (
            <span className='text-primary/80 font-semibold shrink-0'>
              {name}:
            </span>
          )}
          {!isMarkdown && (
            <span
              className={
                typeof value === "string"
                  ? "text-green-600 dark:text-green-400 break-all"
                  : "text-blue-600 dark:text-blue-400"
              }
            >
              {typeof value === "string" ? `"${value}"` : String(value)}
            </span>
          )}
        </div>
        {isMarkdown && (
          <div className='mt-1 p-3 bg-muted/30 rounded-md border border-border/50'>
            <MarkdownRenderer content={value} />
          </div>
        )}
      </div>
    );
  }

  const isArray = Array.isArray(value);
  const keys = Object.keys(value);
  const isEmpty = keys.length === 0;

  if (isEmpty) {
    return (
      <div className='ml-4 flex items-center gap-1 py-0.5'>
        {name && <span className='text-primary/80 font-semibold'>{name}:</span>}
        <span className='text-muted-foreground'>{isArray ? "[]" : "{}"}</span>
      </div>
    );
  }

  return (
    <div className='flex flex-col ml-4'>
      <div
        className='flex items-center gap-1 py-0.5 cursor-pointer hover:bg-muted/30 rounded px-1 -ml-1 transition-colors'
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? (
          <ChevronDown className='w-3.5 h-3.5' />
        ) : (
          <ChevronRight className='w-3.5 h-3.5' />
        )}
        {name && <span className='text-primary/80 font-semibold'>{name}:</span>}
        <span className='text-muted-foreground text-[10px]'>
          {isArray ? `Array(${value.length})` : "Object"}
        </span>
      </div>

      {isExpanded && (
        <div className='border-l border-border/50 ml-1.5 pl-1 flex flex-col'>
          {isArray
            ? (value as JsonValue[]).map((val, index) => (
                <JsonNode
                  key={index}
                  name={index.toString()}
                  value={val}
                  depth={depth + 1}
                />
              ))
            : Object.entries(value as { [key: string]: JsonValue }).map(
                ([key, val]) => (
                  <JsonNode
                    key={key}
                    name={key}
                    value={val}
                    depth={depth + 1}
                  />
                )
              )}
        </div>
      )}
    </div>
  );
}
