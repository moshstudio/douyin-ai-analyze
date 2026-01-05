import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { getDb } from "@/db";
import { authConfig } from "./auth.config";
import { NextRequest } from "next/server";
import { users, accounts, verificationTokens } from "@/db/schema";

// Create auth handlers that lazily initialize the Drizzle adapter
// This ensures getCloudflareContext() is only called during request handling
async function createAuth() {
  const db = await getDb();
  return NextAuth({
    adapter: DrizzleAdapter(db, {
      usersTable: users,
      accountsTable: accounts,
      verificationTokensTable: verificationTokens,
    }),
    ...authConfig,
  });
}

// Export lazy handlers
export const handlers = {
  GET: async (request: NextRequest) => {
    const { handlers } = await createAuth();
    return handlers.GET(request);
  },
  POST: async (request: NextRequest) => {
    const { handlers } = await createAuth();
    return handlers.POST(request);
  },
};

export const auth = async () => {
  const authInstance = await createAuth();
  return authInstance.auth();
};

export const signIn = async (
  provider?: string,
  options?: { redirectTo?: string; redirect?: boolean }
) => {
  const authInstance = await createAuth();
  return authInstance.signIn(provider, options);
};

export const signOut = async (options?: {
  redirectTo?: string;
  redirect?: boolean;
}) => {
  const authInstance = await createAuth();
  return authInstance.signOut(options);
};
