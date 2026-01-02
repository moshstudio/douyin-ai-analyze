import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getReportModel } from "@/lib/llm";
import { withCache } from "./cache";

// Report generation tool
const reportGeneratorToolBase = new DynamicStructuredTool({
  name: "generate_report",
  description: "基于分析的视频数据生成综合报告。",
  schema: z.object({
    conversationId: z.string().describe("对话ID"),
    videoIds: z.array(z.string()).describe("包含的视频ID列表"),
    title: z.string().describe("报告标题"),
    focus: z.string().optional().describe("报告重点关注领域"),
    userRequirements: z
      .string()
      .optional()
      .describe("用户的具体要求，例如'关注负面评论'或'分析商业模式'"),
  }),
  func: async ({
    conversationId,
    videoIds,
    title,
    focus,
    userRequirements,
  }) => {
    try {
      // Fetch analyzed videos
      const videos = await prisma.videoAnalysis.findMany({
        where: {
          videoId: {
            in: videoIds,
          },
        },
      });

      if (videos.length === 0) {
        return JSON.stringify({
          success: false,
          error: "未找到分析的视频数据",
        });
      }

      // Generate comprehensive report using AI
      const model = getReportModel();

      const reportPrompt = `基于以下分析的抖音视频数据，生成一份专业的${
        focus || "综合"
      }分析报告。${
        userRequirements
          ? `\n特别注意：用户有以下具体要求，请在报告中重点体现：\n"${userRequirements}"`
          : ""
      }

标题: ${title}

视频数据:
${videos
  .map(
    (v, i) => `
${i + 1}. ${v.title}
   - 作者: ${v.author}
   - 互动数据: 点赞${v.likes} | 评论${v.comments} | 分享${v.shares} | 观看${
      v.views
    }
   - AI分析: ${v.analysis || "待分析"}
   - 情感: ${v.sentiment || "中性"}
`
  )
  .join("\n")}

请生成包含以下部分的报告，并严格按照JSON格式返回，不要包含任何Markdown formatting (不需要 \`\`\`json 或 \`\`\` 标记)，只要纯JSON字符串：

{
  "summary": "执行摘要 (一段精炼的总结文字)",
  "chartData": {
    "engagement": [
      { "name": "视频标题(简短)", "likes": 100, "comments": 50, "shares": 20 },
      ...
    ],
    "trends": [
      { "name": "趋势关键词/话题", "value": 85 (热度0-100) },
      ...
    ],
    "sentiment": [
      { "name": "正面", "value": 60 },
      { "name": "中性", "value": 30 },
      { "name": "负面", "value": 10 }
    ]
  },
  "insights": "深度洞察 (详细的分析文本，可以使用Markdown格式以及列表)",
  "recommendations": "行动建议 (具体的建议列表，使用Markdown格式)"
}`;

      const reportResponse = await model.invoke(reportPrompt);
      let content = reportResponse.content.toString();

      // Clean up markdown code blocks if present
      content = content
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      let parsedReport;
      try {
        parsedReport = JSON.parse(content);
      } catch (e) {
        console.error("Failed to parse report JSON:", content, e);
        throw new Error("报告生成格式错误，请重试");
      }

      // Create report in database
      const report = await prisma.report.create({
        data: {
          conversationId,
          title,
          summary: parsedReport.summary || "生成摘要失败",
          data: JSON.stringify(parsedReport.chartData || {}),
          insights: `## 深度洞察\n\n${
            parsedReport.insights || ""
          }\n\n## 行动建议\n\n${parsedReport.recommendations || ""}`,
          status: "completed",
        },
      });

      return JSON.stringify({
        success: true,
        reportId: report.id,
        report: {
          title: report.title,
          summary: report.summary,
          insights: report.insights,
          data: report.data,
        },
      });
    } catch (error) {
      console.error("Report generation error:", error);
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "生成报告失败",
      });
    }
  },
});

export const reportGeneratorTool = withCache(reportGeneratorToolBase, {
  ttl: 3600,
});
