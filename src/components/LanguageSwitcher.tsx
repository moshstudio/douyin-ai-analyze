"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Globe } from "lucide-react";

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleLanguageChange = (newLocale: string) => {
    // pathname usually includes the locale, e.g. /en/foo
    // We need to replace the locale segment
    const segments = pathname.split("/");
    // segments[1] is the locale if the structure is /[locale]/...
    if (segments.length > 1) {
      segments[1] = newLocale;
    } else {
      // If for some reason we are at root (unlikely due to middleware), prepend
      segments.splice(1, 0, newLocale);
    }
    const newPath = segments.join("/");
    router.push(newPath);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          size='icon'
          className='h-8 w-8'
        >
          <Globe className='h-4 w-4' />
          <span className='sr-only'>Switch Language</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        <DropdownMenuItem
          onClick={() => handleLanguageChange("en")}
          className={locale === "en" ? "bg-accent" : ""}
        >
          English
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleLanguageChange("zh")}
          className={locale === "zh" ? "bg-accent" : ""}
        >
          中文 (Chinese)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
