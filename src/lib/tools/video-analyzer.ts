import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { getDb } from "@/db";
import { videoAnalysis } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getAnalysisModel } from "@/lib/llm";
import { withCache } from "./cache";
import { tikhubClient } from "@/lib/tikhub-client";
import { saveVideoToDb, simplifyVideoData } from "./douyin-search";
import { fetchVideoComments } from "./fetch-comments";
import { DouyinComment } from "@/lib/types/douyin";

// Video content analysis tool
const videoAnalyzerToolBase = new DynamicStructuredTool({
  name: "analyze_videos",
  description: "分析抖音视频内容，提取关键信息和趋势洞察。",
  schema: z.object({
    videoIds: z.array(z.string()).describe("要分析的视频ID列表"),
    analysisType: z
      .enum(["content", "sentiment", "trend", "comprehensive"])
      .optional()
      .default("comprehensive")
      .describe("分析类型"),
    userRequirements: z
      .string()
      .optional()
      .describe("用户的具体要求，例如'关注负面评论'或'分析商业模式'"),
  }),
  func: async ({
    videoIds,
    analysisType = "comprehensive",
    userRequirements,
  }) => {
    try {
      const db = await getDb();
      // Fetch videos from database
      const videos = await db
        .select()
        .from(videoAnalysis)
        .where(inArray(videoAnalysis.videoId, videoIds));

      // Fallback: If some videos were not found in DB, try to fetch them from TikHub
      const foundVideoIds = videos.map((v) => v.videoId);
      const missingVideoIds = videoIds.filter(
        (id) => !foundVideoIds.includes(id)
      );

      if (missingVideoIds.length > 0) {
        console.log(
          `[Video Analyzer] ${missingVideoIds.length} videos missing from DB, fetching...`
        );
        for (const videoId of missingVideoIds) {
          try {
            // Using search for a specific ID is a common fallback if a direct detail endpoint is unknown
            // Most APIs allow searching by ID or have a detail endpoint.
            // For TikHub, we'll try the video info endpoint if possible, or another search.
            const rawData = await tikhubClient.get(
              "/douyin/video/fetch_video_details",
              {
                params: { aweme_id: videoId },
              }
            );

            const simplified = simplifyVideoData(rawData);
            if (simplified.data?.business_data?.[0]?.data) {
              const videoData = simplified.data.business_data[0].data;
              const savedVideo = await saveVideoToDb(videoData);
              if (savedVideo) {
                videos.push(savedVideo);
              }
            }
          } catch (fetchError) {
            console.error(
              `Failed to fetch missing video ${videoId}:`,
              fetchError
            );
          }
        }
      }

      if (videos.length === 0) {
        return JSON.stringify({
          success: false,
          error: "未找到指定的视频数据，请尝试重新搜索",
        });
      }

      // Fetch comments for all videos in parallel
      const videosWithComments = await Promise.all(
        videos.map(async (v) => {
          let commentsText = "";
          try {
            const commentsData = await fetchVideoComments(v.videoId, 0, 20);
            if (commentsData.data.comments.length > 0) {
              commentsText = commentsData.data.comments
                .map(
                  (c: DouyinComment) => `- "${c.text}" (点赞: ${c.digg_count})`
                )
                .join("\n");
            } else {
              commentsText = "(暂无评论)";
            }
          } catch (e) {
            console.error(
              `Failed to fetch comments for video ${v.videoId}:`,
              e
            );
            commentsText = "(获取评论失败)";
          }
          return { ...v, commentsText };
        })
      );

      // Use AI to analyze video content
      const model = getAnalysisModel();

      const analysisPrompt = `分析以下抖音视频 data，提供${analysisType}分析：

${videosWithComments
  .map(
    (v, i) => `
视频${i + 1}:
- 标题: ${v.title}
- 作者: ${v.author}
- 描述: ${v.description}
- 点赞数: ${v.likes}
- 评论数: ${v.comments}
- 分享数: ${v.shares}
- 观看数: ${v.views}
- 标签: ${v.tags}
- 热门评论 (Top 20):
${v.commentsText}
`
  )
  .join("\n")}

请结合视频内容和评论区反馈，提供以下分析：
1. 内容主题总结
2. 受众情感倾向（结合评论区情绪）
3. 热门趋势分析
4. 商业价值洞察
5. 实操建议

请特别关注评论区用户的真实反馈，挖掘用户关注点和痛点。
${
  userRequirements
    ? `\n特别注意：用户有以下具体要求，请在分析中重点关注：\n"${userRequirements}"\n`
    : ""
}
以JSON格式返回结构化分析结果。`;

      const analysisResult = await model.invoke(analysisPrompt);

      // Update videos with analysis
      for (const video of videos) {
        await db
          .update(videoAnalysis)
          .set({
            analysis: analysisResult.content.toString(),
            sentiment: "积极", // Can be extracted from AI response
          })
          .where(eq(videoAnalysis.id, video.id));
      }

      return JSON.stringify({
        success: true,
        analysis: analysisResult.content.toString(),
        videosAnalyzed: videos.length,
      });
    } catch (error) {
      console.error("Video analysis error:", error);
      return JSON.stringify({
        success: false,
        error: "分析视频失败",
      });
    }
  },
});

export const videoAnalyzerTool = withCache(videoAnalyzerToolBase, {
  ttl: 86400,
}); // Analysis can be cached longer
