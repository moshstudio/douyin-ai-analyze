import { ChatOpenAI } from "@langchain/openai";

/**
 * 集中管理 LLM 实例的创建
 */

export interface LLMConfig {
  temperature?: number;
  streaming?: boolean;
}

/**
 * 获取用于智能体的回复模型
 */
export function getAgentModel(config: LLMConfig = {}) {
  return new ChatOpenAI({
    modelName: process.env.AGENT_MODEL || "deepseek-chat",
    temperature: config.temperature ?? 0.7,
    openAIApiKey: process.env.OPENAI_API_KEY,
    configuration: {
      baseURL: process.env.OPENAI_API_BASE,
    },
    streaming: config.streaming ?? true,
  });
}

/**
 * 获取用于数据分析的模型
 */
export function getAnalysisModel(config: LLMConfig = {}) {
  return new ChatOpenAI({
    modelName: process.env.ANALYSIS_MODEL || "deepseek-chat",
    temperature: config.temperature ?? 0.3,
    openAIApiKey: process.env.OPENAI_API_KEY,
    configuration: {
      baseURL: process.env.OPENAI_API_BASE,
    },
    streaming: config.streaming ?? false,
  });
}

/**
 * 获取用于报告生成的模型
 */
export function getReportModel(config: LLMConfig = {}) {
  return new ChatOpenAI({
    modelName: process.env.REPORT_MODEL || "deepseek-chat",
    temperature: config.temperature ?? 0.5,
    openAIApiKey: process.env.OPENAI_API_KEY,
    configuration: {
      baseURL: process.env.OPENAI_API_BASE,
    },
    streaming: config.streaming ?? false,
  });
}
