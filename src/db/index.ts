import { drizzle } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "./schema";

/**
 * 获取数据库实例 (异步版本)
 * 在 Cloudflare Workers 的 waitUntil 回调或工具执行上下文中必须使用此版本
 */
export async function getDb() {
  const { env } = await getCloudflareContext({ async: true });
  return drizzle(env.douyin_ai_analyze, { schema });
}
