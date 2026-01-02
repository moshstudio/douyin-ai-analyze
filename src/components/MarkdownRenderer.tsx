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
    <div>
      <ReactMarkdown>{processedContent}</ReactMarkdown>
    </div>
  );
}
