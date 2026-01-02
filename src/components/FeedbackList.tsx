"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ClipboardList,
  Loader2,
  ChevronLeft,
  ChevronRight,
  User,
  Lightbulb,
  Wrench,
  Bug,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FeedbackListProps {
  children?: React.ReactNode;
}

interface FeedbackUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

interface FeedbackItem {
  id: string;
  type: string;
  content: string;
  email: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  fingerprint: string | null;
  user: FeedbackUser | null;
}

interface FeedbackResponse {
  success: boolean;
  feedbacks: FeedbackItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  feature: <Lightbulb className='h-4 w-4 text-yellow-500' />,
  optimization: <Wrench className='h-4 w-4 text-blue-500' />,
  bug: <Bug className='h-4 w-4 text-red-500' />,
  other: <HelpCircle className='h-4 w-4 text-gray-500' />,
};

const STATUS_COLORS: Record<string, string> = {
  pending:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  reviewed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  resolved:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};

export function FeedbackList({ children }: FeedbackListProps) {
  const t = useTranslations("feedback");
  const [open, setOpen] = useState(false);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const fetchFeedbacks = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: "10",
      });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (typeFilter !== "all") params.set("type", typeFilter);

      const response = await fetch(`/api/feedback/list?${params}`);

      if (!response.ok) {
        if (response.status === 403) {
          setError("Permission denied");
        } else {
          throw new Error("Failed to fetch feedbacks");
        }
        return;
      }

      const data: FeedbackResponse = await response.json();
      setFeedbacks(data.feedbacks);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch (err) {
      console.error("Error fetching feedbacks:", err);
      setError("Failed to load feedbacks");
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter, typeFilter]);

  useEffect(() => {
    if (open) {
      fetchFeedbacks();
    }
  }, [open, fetchFeedbacks]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
    >
      <DialogTrigger asChild>
        {children || (
          <Button
            variant='ghost'
            size='sm'
            className='gap-2'
          >
            <ClipboardList className='h-4 w-4' />
            <span className='hidden sm:inline'>{t("viewTitle")}</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className='sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <ClipboardList className='h-5 w-5 text-blue-600' />
            {t("viewTitle")} ({total})
          </DialogTitle>
        </DialogHeader>

        {/* Filters */}
        <div className='flex gap-2 py-2'>
          <Select
            value={statusFilter}
            onValueChange={setStatusFilter}
          >
            <SelectTrigger className='w-[140px]'>
              <SelectValue placeholder='Status' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Status</SelectItem>
              <SelectItem value='pending'>{t("status.pending")}</SelectItem>
              <SelectItem value='reviewed'>{t("status.reviewed")}</SelectItem>
              <SelectItem value='resolved'>{t("status.resolved")}</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={typeFilter}
            onValueChange={setTypeFilter}
          >
            <SelectTrigger className='w-[140px]'>
              <SelectValue placeholder='Type' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Types</SelectItem>
              <SelectItem value='feature'>{t("types.feature")}</SelectItem>
              <SelectItem value='optimization'>
                {t("types.optimization")}
              </SelectItem>
              <SelectItem value='bug'>{t("types.bug")}</SelectItem>
              <SelectItem value='other'>{t("types.other")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Content */}
        <div className='flex-1 overflow-y-auto space-y-3 py-2'>
          {isLoading ? (
            <div className='flex items-center justify-center py-12'>
              <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
            </div>
          ) : error ? (
            <div className='text-center py-12 text-red-500'>{error}</div>
          ) : feedbacks.length === 0 ? (
            <div className='text-center py-12 text-muted-foreground'>
              {t("noFeedback")}
            </div>
          ) : (
            feedbacks.map((feedback) => (
              <div
                key={feedback.id}
                className='border rounded-lg p-4 space-y-3 bg-slate-50/50 dark:bg-slate-900/50'
              >
                {/* Header */}
                <div className='flex items-start justify-between gap-3'>
                  <div className='flex items-center gap-3'>
                    <Avatar className='h-8 w-8'>
                      {feedback.user?.image && (
                        <AvatarImage src={feedback.user.image} />
                      )}
                      <AvatarFallback className='bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xs'>
                        {feedback.user?.name?.[0]?.toUpperCase() || (
                          <User className='h-3 w-3' />
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div className='flex flex-col'>
                      <span className='font-medium text-sm'>
                        {feedback.user?.name || feedback.email || "Anonymous"}
                      </span>
                      <span className='text-xs text-muted-foreground'>
                        {formatDate(feedback.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className='flex items-center gap-2'>
                    <span className='flex items-center gap-1 text-xs'>
                      {TYPE_ICONS[feedback.type]}
                      {t(`types.${feedback.type}`)}
                    </span>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-medium",
                        STATUS_COLORS[feedback.status]
                      )}
                    >
                      {t(`status.${feedback.status}`)}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <p className='text-sm whitespace-pre-wrap leading-relaxed'>
                  {feedback.content}
                </p>

                {/* Footer */}
                {feedback.email && !feedback.user && (
                  <p className='text-xs text-muted-foreground'>
                    Contact: {feedback.email}
                  </p>
                )}
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className='flex items-center justify-between pt-4 border-t'>
            <span className='text-sm text-muted-foreground'>
              Page {page} of {totalPages}
            </span>
            <div className='flex gap-2'>
              <Button
                variant='outline'
                size='sm'
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || isLoading}
              >
                <ChevronLeft className='h-4 w-4' />
              </Button>
              <Button
                variant='outline'
                size='sm'
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || isLoading}
              >
                <ChevronRight className='h-4 w-4' />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
