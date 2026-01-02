import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { withCache } from "./cache";
import { tikhubClient } from "@/lib/tikhub-client";
import {
  DouyinHotSearchItem,
  DouyinHotSearchResponse,
} from "@/lib/types/douyin";

/**
 * Interface for the raw hot search response from TikHub API
 */
interface RawTikHubHotSearchResponse {
  code: number;
  message: string;
  data?: {
    data?: {
      active_time: string;
      trending_list?: Record<string, unknown>[];
      word_list?: Record<string, unknown>[];
    };
  };
  [key: string]: unknown;
}

const fetchHotSearchListToolBase = new DynamicStructuredTool({
  name: "fetch_hot_search_list",
  description:
    "获取抖音热搜榜数据，包括：热点榜、种草榜、娱乐榜、社会榜、挑战榜。返回热榜关键词、热度值等极其简化的数据。",
  schema: z.object({
    board_type: z
      .number()
      .optional()
      .default(0)
      .describe(
        "榜单类型：0: 热点榜（默认），2: 其他榜单（如种草榜、挑战榜等）"
      ),
    board_sub_type: z
      .string()
      .optional()
      .default("")
      .describe(
        "榜单子类型（仅在board_type为2时有效）：空字符串: 热点榜（默认），seeding: 种草榜，2: 娱乐榜，4: 社会榜，hotspot_challenge: 挑战榜"
      ),
  }),
  func: async ({ board_type, board_sub_type }) => {
    try {
      const result = await fetchHotSearchList(board_type, board_sub_type);
      return JSON.stringify(result);
    } catch (error) {
      console.error("Fetch hot search list error:", error);
      return JSON.stringify({
        code: 1,
        message:
          "获取热搜榜数据失败: " +
          (error instanceof Error ? error.message : String(error)),
        data: null,
      });
    }
  },
});

/**
 * Tool for fetching Douyin hot search list with 30-minute cache
 */
export const fetchHotSearchListTool = withCache(fetchHotSearchListToolBase, {
  ttl: 1800, // 30 minutes
});

/**
 * Fetch hot search list from TikHub API and simplify it
 */
export async function fetchHotSearchList(
  board_type: number = 0,
  board_sub_type: string = ""
): Promise<DouyinHotSearchResponse> {
  try {
    const response = (await tikhubClient.get<RawTikHubHotSearchResponse>(
      "/douyin/app/v3/fetch_hot_search_list",
      {
        params: {
          board_type,
          board_sub_type,
        },
      }
    )) as unknown as RawTikHubHotSearchResponse;
    console.log(response);

    if (response.code !== 200 || !response.data?.data) {
      return {
        code: response.code || 1,
        message: response.message || "Failed to fetch hot search list",
        data: null,
      };
    }

    const { active_time, trending_list, word_list } = response.data.data;

    // Filter out items with empty words and simplify fields
    const simplifiedTrending: DouyinHotSearchItem[] = (trending_list || [])
      .filter((item) => item.word)
      .map((item) => ({
        word: item.word as string,
        hot_value: (item.hot_value as number) || 0,
        video_count: item.video_count as number,
        event_time: item.event_time as number,
        label: item.label as number,
      }));

    const simplifiedWord: DouyinHotSearchItem[] = (word_list || [])
      .filter((item) => item.word)
      .map((item) => ({
        word: item.word as string,
        hot_value: (item.hot_value as number) || 0,
        view_count: item.view_count as number,
        position: item.position as number,
        label: item.label as number,
      }));

    return {
      code: 200,
      message: "success",
      data: {
        active_time: active_time || new Date().toISOString(),
        trending_list: simplifiedTrending,
        word_list: simplifiedWord,
      },
    };
  } catch (error) {
    console.error("API request failed:", error);
    throw error;
  }
}
