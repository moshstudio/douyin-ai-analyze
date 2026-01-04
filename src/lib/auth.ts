import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { getDb } from "@/db";
import { authConfig } from "./auth.config";
import { NextRequest } from "next/server";

// Create auth handlers that lazily initialize the Drizzle adapter
// This ensures getCloudflareContext() is only called during request handling
function createAuth() {
  const db = getDb();
  return NextAuth({
    adapter: DrizzleAdapter(db),
    ...authConfig,
  });
}

// Export lazy handlers
export const handlers = {
  GET: async (request: NextRequest) => {
    const { handlers } = createAuth();
    return handlers.GET(request);
  },
  POST: async (request: NextRequest) => {
    const { handlers } = createAuth();
    return handlers.POST(request);
  },
};

export const auth = async () => {
  const authInstance = createAuth();
  return authInstance.auth();
};

export const signIn = async (
  provider?: string,
  options?: { redirectTo?: string; redirect?: boolean }
) => {
  const authInstance = createAuth();
  return authInstance.signIn(provider, options);
};

export const signOut = async (options?: {
  redirectTo?: string;
  redirect?: boolean;
}) => {
  const authInstance = createAuth();
  return authInstance.signOut(options);
};
