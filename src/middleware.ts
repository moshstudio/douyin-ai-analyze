import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import createMiddleware from "next-intl/middleware";
import { i18n } from "@/i18n/config";

import { type NextRequest, NextResponse } from "next/server";

const intlMiddleware = createMiddleware({
  locales: i18n.locales,
  defaultLocale: i18n.defaultLocale,
  localePrefix: "always",
});

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  return intlMiddleware(req);
});

export const config = {
  // Matcher for everything except static files and api
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
