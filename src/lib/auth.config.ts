import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { i18n } from "@/i18n/config";

export const authConfig = {
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
    Google({
      clientId: process.env.GOOGLE_ID!,
      clientSecret: process.env.GOOGLE_SECRET!,
    }),
  ],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth;
      const isHomePage =
        nextUrl.pathname === "/" ||
        new RegExp(`^/(${i18n.locales.join("|")})$`).test(nextUrl.pathname);

      if (isHomePage) return true;
      return isLoggedIn;
    },
    async signIn({ user, account }) {
      console.log(`User ${user.email} signing in via ${account?.provider}`);
      return true;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      else if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
    async session({ session, token, user }) {
      // 在 JWT 模式下，用户 ID 存储在 token.sub
      // 在 Database 模式下，用户对象直接可用
      if (session.user) {
        if (token?.sub) {
          session.user.id = token.sub;
        } else if (user?.id) {
          session.user.id = user.id;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
} satisfies NextAuthConfig;
