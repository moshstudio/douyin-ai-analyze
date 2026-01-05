import { ChatPromptTemplate } from "@langchain/core/prompts";
import { douyinSearchTool } from "@/lib/tools/douyin-search";
import { videoAnalyzerTool } from "@/lib/tools/video-analyzer";
import { reportGeneratorTool } from "@/lib/tools/report-generator";
import { fetchVideoCommentsTool } from "@/lib/tools/fetch-comments";
import { fetchVideoDetailTool } from "@/lib/tools/fetch-video-detail";
import { fetchHotSearchListTool } from "@/lib/tools/fetch-hot-search-list";

/**
 * Agent 可用的工具列表
 */
export const agentTools = [
  douyinSearchTool,
  videoAnalyzerTool,
  reportGeneratorTool,
  fetchVideoCommentsTool,
  fetchVideoDetailTool,
  fetchHotSearchListTool,
];

/**
 * Agent 系统提示词
 */
export const AGENT_SYSTEM_PROMPT = `你是一个专业的抖音视频数据分析助手。你有以下能力：

1. 搜索抖音视频 (douyin_search)
2. 获取视频评论 (fetch_video_comments)
3. 获取视频详情 (fetch_video_detail)
4. 获取抖音热搜榜 (fetch_hot_search_list)
5. 分析视频内容 (analyze_videos)
6. 生成分析报告 (generate_report)

核心原则：
1. **优先使用专用工具**：当用户指令对应特定功能时（例如"查看热点榜"），应优先使用专用工具（如 'fetch_hot_search_list'），而不是通用搜索工具。
2. **准确理解需求**：仔细分析用户意图，准确区分"获取数据"、"分析内容"等不同指令。
3. **高效执行**：对于明确、简单的单一任务（如"查一下热搜"、"获取视频评论"），直接调用工具即可，无需输出繁琐的计划。

工作流程：

【第一阶段：意图识别】
- 分析用户输入，判断是简单查询还是复杂分析任务。
- 如果是简单查询，直接进入工具执行阶段。
- 如果是复杂任务（如"分析某领域趋势并生成报告"），可以先简要说明执行思路（例如"好的，我将按以下步骤分析..."）。

【第二阶段：工具执行】
- 根据需求选择最合适的工具。
- 在调用 'analyze_videos' 和 'generate_report' 时，请务必提取用户关注点并准确填入 'userRequirements' 参数。如果没有明确要求，请根据视频内容自动归纳分析重点。

【第三阶段：结果反馈】
- 工具执行完成后，结合数据回答用户问题。
- 如需生成报告，请使用 'generate_report' 工具。

保持语气专业、客观。

当前对话ID: {conversationId}`;

/**
 * 创建 Agent 的 Prompt 模板
 */
export function createAgentPrompt(): ChatPromptTemplate {
  return ChatPromptTemplate.fromMessages([
    ["system", AGENT_SYSTEM_PROMPT],
    ["placeholder", "{chat_history}"],
    ["human", "{input}"],
    ["placeholder", "{agent_scratchpad}"],
  ]);
}

/**
 * 获取 Agent 最大迭代次数
 */
export function getAgentMaxIterations(): number {
  return parseInt(process.env.AGENT_MAX_ITERATIONS || "12");
}
