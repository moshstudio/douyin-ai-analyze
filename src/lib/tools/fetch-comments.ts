import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { withCache } from "./cache";
import { tikhubClient } from "@/lib/tikhub-client";
import { DouyinComment, DouyinCommentResponse } from "@/lib/types/douyin";

/**
 * Interface for the raw comment structure from TikHub API before simplification
 */
interface RawTikHubComment {
  cid: string;
  text: string;
  aweme_id: string;
  create_time: number;
  digg_count: number;
  ip_label?: string;
  reply_id: string;
  reply_comment_total?: number;
  label_text?: string;
  user?: {
    uid: string;
    nickname: string;
    avatar_thumb?: {
      url_list?: string[];
    };
  };
  reply_comment?: RawTikHubComment[] | null;
  [key: string]: any; // Allow for other raw fields
}

interface RawTikHubResponse {
  code: number;
  message: string;
  data?: {
    comments?: RawTikHubComment[];
    cursor?: number;
    has_more?: number | boolean;
    total?: number;
  };
  [key: string]: any;
}

const fetchVideoCommentsToolBase = new DynamicStructuredTool({
  name: "fetch_video_comments",
  description: "获取单个视频评论数据。输入作品id，返回评论列表。",
  schema: z.object({
    aweme_id: z.string().describe("作品id"),
    cursor: z.number().optional().default(0).describe("游标，用于翻页"),
    count: z.number().optional().default(20).describe("数量，请保持默认 20"),
  }),
  func: async ({ aweme_id, cursor = 0, count = 20 }) => {
    try {
      const simplifiedData = await fetchVideoComments(aweme_id, cursor, count);
      return JSON.stringify(simplifiedData);
    } catch (error) {
      console.error("Fetch video comments error:", error);
      return JSON.stringify({
        code: 1,
        message:
          "获取评论失败: " +
          (error instanceof Error ? error.message : String(error)),
        data: { comments: [] },
      });
    }
  },
});

export const fetchVideoCommentsTool = withCache(fetchVideoCommentsToolBase, {
  ttl: 3600,
});

export async function fetchVideoComments(
  aweme_id: string,
  cursor: number = 0,
  count: number = 20
): Promise<DouyinCommentResponse> {
  const response = (await tikhubClient.get<RawTikHubResponse>(
    "/douyin/app/v3/fetch_video_comments",
    {
      params: {
        aweme_id,
        cursor,
        count,
      },
    }
  )) as unknown as RawTikHubResponse;

  return simplifyCommentResponse(response);
}

function simplifyCommentResponse(
  response: RawTikHubResponse
): DouyinCommentResponse {
  const data = response?.data || {};
  return {
    code: response?.code || 0,
    message: response?.message || "success",
    data: {
      comments: (data.comments || []).map((c) => simplifyComment(c)),
      cursor: data.cursor || 0,
      has_more: data.has_more ?? false,
      total: data.total || 0,
    },
  };
}

function simplifyComment(c: RawTikHubComment): DouyinComment {
  return {
    cid: c.cid,
    text: c.text,
    aweme_id: c.aweme_id,
    create_time: c.create_time,
    digg_count: c.digg_count,
    ip_label: c.ip_label,
    reply_id: c.reply_id,
    reply_comment_total: c.reply_comment_total,
    label_text: c.label_text,
    user: {
      uid: c.user?.uid || "",
      nickname: c.user?.nickname || "",
      avatar_thumb: {
        url_list: c.user?.avatar_thumb?.url_list?.slice(0, 1) || [],
      },
    },
    reply_comment: Array.isArray(c.reply_comment)
      ? c.reply_comment.map((rc) => simplifyComment(rc))
      : null,
  };
}
