import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { getDb } from "@/db";
import { videoAnalysis } from "@/db/schema";
import { withCache } from "./cache";
import { DouyinSearchResult, DouyinVideoData } from "@/lib/types/douyin";
import { tikhubClient } from "@/lib/tikhub-client";

// Mock Douyin video search tool
// In production, this would integrate with actual Douyin API or web scraping
const douyinSearchToolBase = new DynamicStructuredTool({
  name: "douyin_search",
  description: "搜索抖音视频。输入关键词，返回相关视频列表。",
  schema: z.object({
    keyword: z.string().describe("搜索关键词"),
    cursor: z.number().optional().default(0).describe("翻页游标"),
    sort_type: z
      .string()
      .optional()
      .default("0")
      .describe("排序方式：0=综合排序, 1=最多点赞, 2=最新发布"),
    publish_time: z
      .string()
      .optional()
      .default("0")
      .describe("发布时间筛选：0=不限, 1=最近一天, 7=最近一周, 180=最近半年"),
    filter_duration: z
      .string()
      .optional()
      .default("0")
      .describe(
        "视频时长筛选：0=不限, 0-1=1分钟内, 1-5=1-5分钟, 5-10000=5分钟以上"
      ),
    limit: z.number().optional().default(10).describe("返回结果数量限制"),
  }),
  func: async ({
    keyword,
    cursor = 0,
    sort_type = "0",
    publish_time = "0",
    filter_duration = "0",
    limit = 10,
  }) => {
    try {
      const rawData = await tikhubClient.post(
        "/douyin/search/fetch_video_search_v2",
        {
          keyword,
          cursor,
          sort_type,
          publish_time,
          filter_duration,
          content_type: "0",
          search_id: "",
          backtrace: "",
        }
      );

      // Simplify the data
      const simplifiedData = simplifyVideoData(rawData);

      // Save videos to database for future analysis (Parallel execution)
      if (simplifiedData.data && simplifiedData.data.business_data) {
        const savePromises = simplifiedData.data.business_data
          .filter((item) => item.type === 1 && item.data)
          .map((item) => saveVideoToDb(item.data));

        // We await here to ensure data is saved, but running in parallel is much faster
        // If speed is critical, we could wrap this in a catch block or not await it (if the environment allows background tasks)
        // For Cloudflare Workers, we generally must await before response ends, but parallel is fine.
        await Promise.all(savePromises).catch((err) =>
          console.error("Batch save error:", err)
        );
      }

      // Limit the number of videos returned to the tool
      if (simplifiedData.data && simplifiedData.data.business_data) {
        simplifiedData.data.business_data =
          simplifiedData.data.business_data.slice(0, limit);
      }

      return JSON.stringify(simplifiedData);
    } catch (error) {
      console.error("Douyin search error:", error);
      return JSON.stringify({
        code: 1,
        message:
          "搜索视频失败: " +
          (error instanceof Error ? error.message : String(error)),
        data: { business_data: [] },
      });
    }
  },
});

export const douyinSearchTool = withCache(douyinSearchToolBase, { ttl: 3600 });

export async function saveVideoToDb(v: DouyinVideoData) {
  const db = await getDb();
  try {
    const returning = await db
      .insert(videoAnalysis)
      .values({
        videoId: v.aweme_id,
        title: v.desc,
        author: v.author?.nickname,
        likes: v.statistics?.digg_count,
        comments: v.statistics?.comment_count,
        shares: v.statistics?.share_count,
        views: v.statistics?.play_count,
        description: v.desc,
        tags: JSON.stringify(v.cha_list?.map((c) => c.cha_name) || []),
        videoUrl: v.share_url,
      })
      .onConflictDoUpdate({
        target: videoAnalysis.videoId,
        set: {
          title: v.desc,
          author: v.author?.nickname,
          likes: v.statistics?.digg_count,
          comments: v.statistics?.comment_count,
          shares: v.statistics?.share_count,
          views: v.statistics?.play_count,
          description: v.desc,
          tags: JSON.stringify(v.cha_list?.map((c) => c.cha_name) || []),
          videoUrl: v.share_url,
          updatedAt: new Date(),
        },
      })
      .returning();

    return returning[0];
  } catch (dbError) {
    console.error("Failed to save video to DB:", dbError);
    return null; // Return null on error so caller can handle it
  }
}

export function simplifyVideoData(apiResponse: unknown): DouyinSearchResult {
  const response = apiResponse as any;
  // TikHub API might return the actual data inside a stringified 'data' field or directly as an object
  let baseData = response;
  if (typeof response?.data === "string") {
    try {
      baseData = JSON.parse(response.data);
    } catch (e) {
      console.warn("Failed to parse TikHub data string:", e);
    }
  } else if (response?.data && typeof response.data === "object") {
    baseData = response.data;
  }

  // 只提取关键数据
  const simplifiedData: DouyinSearchResult = {
    code: response?.code ?? 0,
    message: response?.message ?? "success",
    params: response?.params,
    data: {
      business_data: [],
    },
  };

  // 处理每条视频数据
  const businessSource = baseData.business_data || baseData;
  if (Array.isArray(businessSource)) {
    businessSource.forEach((businessItem: any) => {
      if (
        businessItem.type === 1 &&
        businessItem.data &&
        businessItem.data.aweme_info
      ) {
        const awemeInfo = businessItem.data.aweme_info;

        // 精简后的视频数据结构
        const simplifiedVideo = {
          aweme_id: awemeInfo.aweme_id,
          desc: awemeInfo.desc,
          create_time: awemeInfo.create_time,

          author: {
            uid: awemeInfo.author.uid,
            nickname: awemeInfo.author.nickname,
            avatar_larger: awemeInfo.author.avatar_larger?.url_list?.[0] || "",
            follower_count: awemeInfo.author.follower_count,
            signature: awemeInfo.author.signature,
            birthday: awemeInfo.author.birthday,
          },

          statistics: {
            digg_count: awemeInfo.statistics?.digg_count || 0,
            comment_count: awemeInfo.statistics?.comment_count || 0,
            share_count: awemeInfo.statistics?.share_count || 0,
            collect_count: awemeInfo.statistics?.collect_count || 0,
            play_count: awemeInfo.statistics?.play_count || 0,
          },

          video: {
            play_addr: awemeInfo.video?.play_addr?.url_list?.[0] || "",
            cover: awemeInfo.video?.cover?.url_list?.[0] || "",
            duration: awemeInfo.video?.duration || 0,
            width: awemeInfo.video?.width || 0,
            height: awemeInfo.video?.height || 0,
          },

          music: {
            id: awemeInfo.music?.id,
            title: awemeInfo.music?.title,
            author: awemeInfo.music?.author,
            play_url: awemeInfo.music?.play_url?.url_list?.[0] || "",
          },

          cha_list: (awemeInfo.cha_list || []).map((cha: any) => ({
            cid: cha.cid,
            cha_name: cha.cha_name,
          })),

          share_url: awemeInfo.share_url || "",
          text_extra: (awemeInfo.text_extra || []).map((item: any) => ({
            hashtag_name: item.hashtag_name,
          })),
        };

        // 移除空值或默认值的字段
        const videoForCleanup = simplifiedVideo as Record<string, any>;
        Object.keys(videoForCleanup).forEach((key) => {
          const val = videoForCleanup[key];
          if (
            val === null ||
            val === undefined ||
            (Array.isArray(val) && val.length === 0) ||
            (typeof val === "object" && Object.keys(val).length === 0)
          ) {
            delete videoForCleanup[key];
          }
        });

        // 精简作者信息
        const authorForCleanup = simplifiedVideo.author as Record<string, any>;
        Object.keys(authorForCleanup).forEach((key) => {
          if (!authorForCleanup[key]) {
            delete authorForCleanup[key];
          }
        });

        simplifiedData.data.business_data.push({
          data_id: businessItem.data_id,
          type: businessItem.type,
          data: simplifiedVideo,
        });
      }
    });
  }

  // No need to delete business_data if empty, keeping it maintains type safety
  return simplifiedData;
}
