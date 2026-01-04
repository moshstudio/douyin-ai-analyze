import { drizzle } from "drizzle-orm/d1";
import { users } from "./db/schema";

export interface Env {
  douyin_ai_analyze: D1Database;
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const db = drizzle(env.douyin_ai_analyze);
    const result = await db.select().from(users).all();
    return new Response(JSON.stringify(result));
  },
} satisfies ExportedHandler<Env>;
