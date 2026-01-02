"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import FingerprintJS from "@fingerprintjs/fingerprintjs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageSquarePlus, Loader2, Check } from "lucide-react";

interface FeedbackDialogProps {
  children?: React.ReactNode;
}

type FeedbackType = "feature" | "optimization" | "bug" | "other";

export function FeedbackDialog({ children }: FeedbackDialogProps) {
  const t = useTranslations("feedback");
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("feature");
  const [content, setContent] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!content.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Get fingerprint for non-logged-in users
      const fp = await FingerprintJS.load();
      const result = await fp.get();
      const fingerprint = result.visitorId;

      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          content: content.trim(),
          email: email.trim() || null,
          fingerprint,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit feedback");
      }

      setIsSuccess(true);
      // Reset form after short delay
      setTimeout(() => {
        setOpen(false);
        setIsSuccess(false);
        setType("feature");
        setContent("");
        setEmail("");
      }, 1500);
    } catch (err) {
      console.error("Error submitting feedback:", err);
      setError(t("submitError"));
    } finally {
      setIsSubmitting(false);
    }
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
            <MessageSquarePlus className='h-4 w-4' />
            <span className='hidden sm:inline'>{t("title")}</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <MessageSquarePlus className='h-5 w-5 text-blue-600' />
            {t("title")}
          </DialogTitle>
        </DialogHeader>

        {isSuccess ? (
          <div className='flex flex-col items-center justify-center py-8 space-y-4'>
            <div className='w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center'>
              <Check className='h-8 w-8 text-green-600 dark:text-green-400' />
            </div>
            <p className='text-lg font-medium text-green-600 dark:text-green-400'>
              {t("submitSuccess")}
            </p>
          </div>
        ) : (
          <div className='space-y-4 py-4'>
            {/* Feedback Type */}
            <div className='space-y-2'>
              <label className='text-sm font-medium'>{t("typeLabel")}</label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as FeedbackType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='feature'>{t("types.feature")}</SelectItem>
                  <SelectItem value='optimization'>
                    {t("types.optimization")}
                  </SelectItem>
                  <SelectItem value='bug'>{t("types.bug")}</SelectItem>
                  <SelectItem value='other'>{t("types.other")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Feedback Content */}
            <div className='space-y-2'>
              <label className='text-sm font-medium'>{t("contentLabel")}</label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={t("contentPlaceholder")}
                className='min-h-[120px] resize-none'
              />
            </div>

            {/* Email (Optional) */}
            <div className='space-y-2'>
              <label className='text-sm font-medium'>{t("emailLabel")}</label>
              <Input
                type='email'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("emailPlaceholder")}
              />
            </div>

            {/* Error Message */}
            {error && (
              <p className='text-sm text-red-500 dark:text-red-400'>{error}</p>
            )}

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={!content.trim() || isSubmitting}
              className='w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
            >
              {isSubmitting ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  {t("submit")}...
                </>
              ) : (
                t("submit")
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
