"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface StreamingTextProps {
  content: string;
  isStreaming?: boolean;
  className?: string;
}

export function StreamingText({ content, isStreaming, className }: StreamingTextProps) {
  console.log("STREAM CONTENT:", JSON.stringify(content));
  return (
    <div className={cn("prose prose-sm dark:prose-invert max-w-none", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mt-4 mb-2">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mt-4 mb-2 pb-1 border-b border-gray-100 dark:border-zinc-800">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold text-brand-600 dark:text-brand-400 mt-3 mb-1">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-3">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="space-y-1.5 mb-3 pl-0">{children}</ul>
          ),
          li: ({ children }) => (
            <li className="flex gap-2 text-gray-600 dark:text-gray-300">
              <span className="text-brand-500 mt-1 flex-shrink-0">›</span>
              <span>{children}</span>
            </li>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-gray-900 dark:text-white">{children}</strong>
          ),
          code: ({ children }) => (
            <code className="text-xs bg-gray-100 dark:bg-zinc-800 text-brand-600 dark:text-brand-400 px-1.5 py-0.5 rounded font-mono">{children}</code>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
      {isStreaming && (
        <span
          className="inline-block w-2 h-4 bg-brand-500 ml-0.5 align-middle animate-[blink_1s_step-end_infinite]"
          aria-hidden="true"
        />
      )}
    </div>
  );
}
