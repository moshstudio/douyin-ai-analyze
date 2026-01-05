"use client";

import ReactMarkdown, { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import { cn } from "@/lib/utils";
import { replaceDouyinEmotes } from "@/lib/emoji-utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// 自定义组件样式，确保列表等元素正确显示
const components: Components = {
  ul: ({ children, ...props }) => (
    <ul
      className='list-disc list-outside pl-6 my-2 space-y-1'
      {...props}
    >
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol
      className='list-decimal list-outside pl-6 my-2 space-y-1'
      {...props}
    >
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li
      className='pl-1'
      {...props}
    >
      {children}
    </li>
  ),
  p: ({ children, ...props }) => (
    <p
      className='my-2 leading-relaxed'
      {...props}
    >
      {children}
    </p>
  ),
  h1: ({ children, ...props }) => (
    <h1
      className='text-2xl font-bold mt-6 mb-3'
      {...props}
    >
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2
      className='text-xl font-semibold mt-5 mb-2'
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3
      className='text-lg font-semibold mt-4 mb-2'
      {...props}
    >
      {children}
    </h3>
  ),
  code: ({ className, children, ...props }) => {
    const isInline = !className;
    return isInline ? (
      <code
        className='bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-sm font-mono text-pink-600 dark:text-pink-400'
        {...props}
      >
        {children}
      </code>
    ) : (
      <code
        className={cn(className, "text-sm")}
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ children, ...props }) => (
    <pre
      className='bg-slate-900 dark:bg-slate-950 rounded-lg p-4 my-3 overflow-x-auto'
      {...props}
    >
      {children}
    </pre>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote
      className='border-l-4 border-blue-500 pl-4 my-3 italic text-slate-600 dark:text-slate-400'
      {...props}
    >
      {children}
    </blockquote>
  ),
  a: ({ children, href, ...props }) => (
    <a
      href={href}
      className='text-blue-600 dark:text-blue-400 hover:underline'
      target='_blank'
      rel='noopener noreferrer'
      {...props}
    >
      {children}
    </a>
  ),
  table: ({ children, ...props }) => (
    <div className='overflow-x-auto my-3'>
      <table
        className='min-w-full border-collapse border border-slate-300 dark:border-slate-700'
        {...props}
      >
        {children}
      </table>
    </div>
  ),
  th: ({ children, ...props }) => (
    <th
      className='border border-slate-300 dark:border-slate-700 px-3 py-2 bg-slate-100 dark:bg-slate-800 font-semibold text-left'
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td
      className='border border-slate-300 dark:border-slate-700 px-3 py-2'
      {...props}
    >
      {children}
    </td>
  ),
};

export default function MarkdownRenderer({
  content,
  className,
}: MarkdownRendererProps) {
  const processedContent = replaceDouyinEmotes(content);

  return (
    <div className={cn("markdown-content", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
