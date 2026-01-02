"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
// import "highlight.js/styles/github-dark.css"; // Better dark mode syntax highlighting
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const CHINESE_FONT_STACK = [
  "Inter",
  "ui-sans-serif",
  "system-ui",
  "-apple-system",
  "BlinkMacSystemFont",
  '"PingFang SC"',
  '"Hiragino Sans GB"',
  '"Microsoft YaHei"',
  '"Helvetica Neue"',
  "Helvetica",
  "Arial",
  "sans-serif",
  '"Apple Color Emoji"',
  '"Segoe UI Emoji"',
  '"Segoe UI Symbol"',
].join(", ");

import { replaceDouyinEmotes } from "@/lib/emoji-utils";

export default function MarkdownRenderer({
  content,
  className,
}: MarkdownRendererProps) {
  const processedContent = replaceDouyinEmotes(content);

  return (
    <div
      className={cn(
        "prose prose-zinc dark:prose-invert max-w-none",
        // Text styling
        "prose-p:leading-loose prose-p:my-3", // Increased line spacing for paragraphs
        "prose-li:leading-relaxed prose-li:my-1", // List items
        "prose-headings:font-bold prose-headings:tracking-tight prose-headings:my-4",
        "prose-strong:font-bold prose-strong:text-zinc-900 dark:prose-strong:text-zinc-100",
        // Code styling
        "prose-code:text-sm prose-code:font-mono prose-code:bg-zinc-100 dark:prose-code:bg-zinc-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none",
        "prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-zinc-800 prose-pre:p-4 prose-pre:rounded-xl",
        // Link styling
        "prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline prose-a:font-medium prose-a:break-all",
        // Blockquote styling
        "prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:bg-blue-50 dark:prose-blockquote:bg-blue-900/20 prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:rounded-r-lg prose-blockquote:not-italic",
        // Table styling
        "prose-table:border-collapse prose-table:w-full prose-table:my-4",
        "prose-th:border prose-th:border-zinc-200 dark:prose-th:border-zinc-700 prose-th:bg-zinc-50 dark:prose-th:bg-zinc-800/50 prose-th:p-2 prose-th:text-left",
        "prose-td:border prose-td:border-zinc-200 dark:prose-td:border-zinc-700 prose-td:p-2",
        className
      )}
      style={{ fontFamily: CHINESE_FONT_STACK }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          a: ({ ...props }) => (
            <a
              {...props}
              target='_blank'
              rel='noopener noreferrer'
            />
          ),
          pre: ({ ...props }) => (
            <pre
              {...props}
              className='overflow-x-auto scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-700 scrollbar-track-transparent'
            />
          ),
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
