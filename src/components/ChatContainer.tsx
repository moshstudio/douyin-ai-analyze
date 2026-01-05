"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import AuthButton from "@/components/AuthButton";
import { AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { FeedbackList } from "@/components/FeedbackList";

// 动态导入聊天界面组件，禁用 SSR
const ChatInterface = dynamic(() => import("./ChatInterface"), {
  ssr: false,
  loading: () => (
    <div className='flex h-screen items-center justify-center bg-background'>
      <div className='text-muted-foreground'>...</div>
    </div>
  ),
});

export default function ChatContainer({
  conversationId,
}: {
  conversationId?: string;
}) {
  const { data: session, status } = useSession();
  const [rateLimit, setRateLimit] = useState<{
    remaining: number;
    limit: number;
  } | null>(null);
  const [canViewFeedback, setCanViewFeedback] = useState(false);
  const [mounted, setMounted] = useState(false);
  const t = useTranslations();

  // Prevent hydration mismatch by only rendering session-dependent content after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch user permission for viewing feedback
  useEffect(() => {
    if (session?.user?.id) {
      fetch("/api/user/permissions")
        .then((res) => res.json())
        .then((data) => {
          const typedData = data as { canViewFeedback?: boolean };
          setCanViewFeedback(!!typedData.canViewFeedback);
        })
        .catch(() => {
          setCanViewFeedback(false);
        });
    }
  }, [session?.user?.id]);

  // Show loading placeholder until client is mounted to avoid hydration mismatch
  if (!mounted) {
    return (
      <div className='flex h-screen flex-col bg-background'>
        <header className='sticky top-0 z-10 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60'>
          <div className='mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8'>
            <div className='flex items-center gap-3'>
              <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20'>
                <svg
                  className='h-6 w-6'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M13 10V3L4 14h7v7l9-11h-7z'
                  />
                </svg>
              </div>
              <div>
                <h1 className='text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300'>
                  {t("app.title")}
                </h1>
              </div>
            </div>
            <div className='flex items-center gap-2'>
              {/* Placeholder for auth button area */}
              <div className='h-10 w-24 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800' />
            </div>
          </div>
        </header>
        <div className='flex-1 flex items-center justify-center'>
          <div className='text-muted-foreground'>...</div>
        </div>
      </div>
    );
  }

  return (
    <div className='flex h-screen flex-col bg-background'>
      {/* Header - Premium gradient border bottom */}
      <header className='sticky top-0 z-10 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60'>
        <div className='mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8'>
          {/* Logo Section */}
          <div className='flex items-center gap-3'>
            <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20'>
              <svg
                className='h-6 w-6'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M13 10V3L4 14h7v7l9-11h-7z'
                />
              </svg>
            </div>
            <div>
              <h1 className='text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300'>
                {t("app.title")}
              </h1>
            </div>
          </div>

          {/* Right Actions */}
          <div className='flex items-center gap-2'>
            <FeedbackDialog />
            {canViewFeedback && <FeedbackList />}
            <LanguageSwitcher />
            <AuthButton session={session} />
          </div>
        </div>

        {/* Rate Limit Alert - Subtle and clean */}
        {rateLimit && (
          <div className='border-t bg-blue-50/50 dark:bg-blue-900/10 backdrop-blur-sm'>
            <div className='mx-auto max-w-7xl px-4 py-2 sm:px-6 lg:px-8'>
              <div className='flex items-center gap-2 text-sm font-medium'>
                <AlertCircle className='h-4 w-4 text-blue-600 dark:text-blue-400' />
                <span className='text-blue-700 dark:text-blue-300'>
                  {session?.user
                    ? t("header.rateLimitAuth", {
                        remaining: rateLimit.remaining,
                        limit: rateLimit.limit,
                      })
                    : t("header.rateLimitGuest", {
                        remaining: rateLimit.remaining,
                        limit: rateLimit.limit,
                      })}
                </span>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Chat Area */}
      <div className='flex-1 overflow-hidden relative'>
        {/* Background gradient definitions or subtle patterns could go here */}
        <ChatInterface
          rateLimit={rateLimit}
          setRateLimit={setRateLimit}
          conversationId={conversationId}
        />
      </div>
    </div>
  );
}
