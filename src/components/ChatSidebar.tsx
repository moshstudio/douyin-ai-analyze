"use client";

import { useState } from "react";
import { useChatStore } from "@/lib/hooks/useChatStore";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MessageSquare, Plus, Trash2, X, MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";

interface ChatSidebarProps {
  className?: string;
  isOpen?: boolean;
  onClose?: () => void;
}

import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";

export function ChatSidebar({ className, isOpen, onClose }: ChatSidebarProps) {
  const router = useRouter();
  const locale = useLocale();
  const {
    conversations,
    currentConversationId,
    deleteConversation,
    isLoading,
  } = useChatStore();
  const t = useTranslations();

  const handleSelect = (id: string) => {
    router.push(`/${locale}/c/${id}`);
    onClose?.();
  };

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (deleteId) {
      await deleteConversation(deleteId);
      setDeleteId(null);
    }
  };

  const handleNewChat = () => {
    router.push(`/${locale}/`);
    onClose?.();
  };

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-slate-50 dark:bg-slate-900 border-r",
        className
      )}
    >
      <div className='p-4 border-b flex items-center justify-between'>
        <Button
          onClick={handleNewChat}
          className='w-full flex items-center gap-2'
          variant='outline'
        >
          <Plus className='w-4 h-4' />
          {t("sidebar.newChat")}
        </Button>
        {onClose && (
          <Button
            variant='ghost'
            size='icon'
            onClick={onClose}
            className='md:hidden ml-2'
          >
            <X className='w-4 h-4' />
          </Button>
        )}
      </div>

      <div className='flex-1 flex flex-col overflow-y-auto'>
        <div className='p-2 space-y-2 w-full h-full'>
          {conversations.length === 0 && !isLoading && (
            <div className='text-center text-sm text-muted-foreground p-4'>
              {t("sidebar.noHistory")}
            </div>
          )}

          {conversations.map((chat) => (
            <div
              key={chat.id}
              onClick={() => handleSelect(chat.id)}
              className={cn(
                "group relative w-full flex items-center gap-2 p-2 text-sm rounded-lg cursor-pointer transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 overflow-hidden",
                currentConversationId === chat.id &&
                  "bg-slate-200 dark:bg-slate-800 font-medium"
              )}
            >
              <MessageSquare className='w-4 h-4 text-muted-foreground shrink-0' />
              <div className='flex-1 min-w-0'>
                <p
                  className='truncate'
                  title={chat.title || "Untitled Chat"}
                >
                  {chat.title || "Untitled Chat"}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant='ghost'
                    size='icon'
                    className='h-8 w-8 shrink-0'
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className='w-4 h-4 text-muted-foreground' />
                    <span className='sr-only'>Open menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end'>
                  <DropdownMenuItem
                    className='text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20'
                    onClick={(e) => handleDelete(chat.id, e)}
                  >
                    <Trash2 className='mr-2 w-4 h-4' />
                    <span>{t("common.delete")}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      </div>
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("sidebar.deleteConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("sidebar.deleteDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className='bg-red-600 hover:bg-red-700 focus:ring-red-600'
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
