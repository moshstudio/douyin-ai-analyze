import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { withCache } from "./cache";
import { tikhubClient } from "@/lib/tikhub-client";
import { DouyinVideoData } from "@/lib/types/douyin";
import { saveVideoToDb } from "./douyin-search";

/**
 * Interface for the raw video detail structure from TikHub API before simplification
 */
interface RawTikHubVideoDetailResponse {
  code: number;
  message: string;
  data?: {
    aweme_detail?: Record<string, unknown>;
  };
  [key: string]: unknown;
}

const fetchVideoDetailToolBase = new DynamicStructuredTool({
  name: "fetch_video_detail",
  description:
    "获取单个抖音作品的详细数据，包括视频地址、封面、点赞数、评论数等信息。输入作品id(aweme_id)，返回作品详情。",
  schema: z.object({
    aweme_id: z.string().describe("抖音作品id，例如 7448118827402972455"),
  }),
  func: async ({ aweme_id }) => {
    try {
      const simplifiedData = await fetchVideoDetail(aweme_id);

      // Save to DB if data exists to allow analyzer to use it later
      if (simplifiedData.data) {
        await saveVideoToDb(simplifiedData.data);
      }

      return JSON.stringify(simplifiedData);
    } catch (error) {
      console.error("Fetch video detail error:", error);
      return JSON.stringify({
        code: 1,
        message:
          "获取视频详情失败: " +
          (error instanceof Error ? error.message : String(error)),
        data: null,
      });
    }
  },
});

export const fetchVideoDetailTool = withCache(fetchVideoDetailToolBase, {
  ttl: 3600,
});

/**
 * Fetch video detail from TikHub API
 */
export async function fetchVideoDetail(
  aweme_id: string
): Promise<{ code: number; message: string; data: DouyinVideoData | null }> {
  try {
    const response = (await tikhubClient.get<RawTikHubVideoDetailResponse>(
      "/douyin/app/v3/fetch_one_video_v2",
      {
        params: {
          aweme_id,
        },
      }
    )) as unknown as RawTikHubVideoDetailResponse;

    if (response.code !== 200 || !response.data?.aweme_detail) {
      return {
        code: response.code || 1,
        message: response.message || "Failed to fetch video detail",
        data: null,
      };
    }

    const simplifiedData = simplifyVideoDetail(response.data.aweme_detail);
    return {
      code: 200,
      message: "success",
      data: simplifiedData,
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Simplify the raw video detail from TikHub API
 */
function simplifyVideoDetail(detail: Record<string, any>): DouyinVideoData {
  const author = detail.author || {};
  const stats = detail.statistics || {};
  const video = detail.video || {};
  const music = detail.music || {};
  const shareInfo = detail.share_info || {};

  return {
    aweme_id: String(detail.aweme_id || ""),
    desc: String(detail.desc || detail.caption || detail.preview_title || ""),
    create_time: Number(detail.create_time || 0),
    author: {
      uid: author.uid ? String(author.uid) : undefined,
      nickname: String(author.nickname || ""),
      avatar_larger: String(author.avatar_larger?.url_list?.[0] || ""),
      follower_count: author.follower_count
        ? Number(author.follower_count)
        : undefined,
      signature: author.signature ? String(author.signature) : undefined,
    },
    statistics: {
      digg_count: Number(stats.digg_count || 0),
      comment_count: Number(stats.comment_count || 0),
      share_count: Number(stats.share_count || 0),
      collect_count: Number(stats.collect_count || 0),
      play_count: Number(stats.play_count || 0),
    },
    video: {
      play_addr: String(video.play_addr?.url_list?.[0] || ""),
      cover: String(video.cover?.url_list?.[0] || ""),
      duration: Number(video.duration || 0),
      width: Number(video.width || 0),
      height: Number(video.height || 0),
    },
    music: detail.music
      ? {
          id: String(music.id_str || music.id || ""),
          title: String(music.title || ""),
          author: String(music.author || ""),
          play_url: String(music.play_url?.url_list?.[0] || ""),
        }
      : undefined,
    cha_list: Array.isArray(detail.cha_list)
      ? detail.cha_list.map((cha: any) => ({
          cid: String(cha.cid || ""),
          cha_name: String(cha.cha_name || ""),
        }))
      : undefined,
    share_url: String(shareInfo.share_url || detail.share_url || ""),
    text_extra: Array.isArray(detail.text_extra)
      ? detail.text_extra.map((item: any) => ({
          hashtag_name: item.hashtag_name,
        }))
      : undefined,
  };
}
