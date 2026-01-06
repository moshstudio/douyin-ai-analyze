# 🎬 抖音 AI 分析助手

<div align="center">

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cloudflare/templates/tree/main/next-starter-template)

**智能分析抖音视频趋势 · AI 驱动的内容洞察**

[在线体验](https://douyin-ai-analyze.moshangapp.com) · [功能介绍](#-功能特性) · [快速开始](#-快速开始) · [部署指南](#-部署)

</div>

---

## 📖 项目简介

**抖音 AI 分析助手** 是一款基于大语言模型的智能抖音视频分析工具。通过自然语言对话，用户可以轻松搜索抖音视频、获取热搜榜单、分析视频内容趋势，并生成专业的分析报告。

项目采用 **Next.js 16** + **LangChain** + **Cloudflare Workers** 技术栈，提供流畅的流式对话体验和强大的 AI 分析能力。

## ✨ 功能特性

### 🔍 抖音视频搜索

- 关键词搜索抖音视频
- 支持多种排序方式（综合、最多点赞、最新发布）
- 支持时间筛选（不限、最近一天、一周、半年）
- 支持视频时长筛选

### 📊 热搜榜单

- 实时获取抖音热点榜
- 支持多种榜单类型：热点榜、种草榜、娱乐榜、社会榜、挑战榜
- 展示热度值、视频数量等关键数据

### 🎯 视频内容分析

- 智能分析视频内容主题
- 评论情感分析
- 用户互动数据解读
- 商业价值评估
- 趋势洞察与实操建议

### 💬 AI 对话助手

- 基于 LangChain Agent 的智能对话
- 流式响应，实时反馈
- 支持多轮对话记忆
- 工具调用透明展示

### 📈 报告生成

- 一键生成分析报告
- 包含数据可视化图表
- 支持历史报告管理

### 🔐 用户系统

- 支持 GitHub / Google 登录
- 设备指纹识别（匿名用户）
- API 使用次数限制

## 🛠️ 技术栈

| 类别        | 技术                               |
| ----------- | ---------------------------------- |
| **框架**    | Next.js 16 (App Router)            |
| **运行时**  | Cloudflare Workers (OpenNext 适配) |
| **AI 框架** | LangChain.js                       |
| **LLM**     | OpenAI 兼容 API (DeepSeek 等)      |
| **数据库**  | Cloudflare D1 (SQLite)             |
| **ORM**     | Drizzle ORM                        |
| **认证**    | NextAuth.js v5                     |
| **UI 组件** | Radix UI + Tailwind CSS            |
| **数据源**  | TikHub API                         |

## 📁 项目结构

```
douyin-ai-analyze/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── [locale]/           # 国际化路由
│   │   └── api/                # API 路由
│   │       ├── chat-agent/     # AI 对话接口
│   │       ├── history/        # 对话历史接口
│   │       └── feedback/       # 反馈接口
│   ├── components/             # React 组件
│   │   ├── ChatInterface.tsx   # 聊天界面
│   │   ├── ChatSidebar.tsx     # 对话侧边栏
│   │   └── ReportViewer.tsx    # 报告查看器
│   ├── lib/
│   │   ├── agent/              # LangChain Agent 模块
│   │   ├── tools/              # AI 工具集
│   │   │   ├── douyin-search.ts      # 视频搜索
│   │   │   ├── fetch-hot-search-list.ts # 热搜榜单
│   │   │   ├── video-analyzer.ts     # 视频分析
│   │   │   ├── fetch-comments.ts     # 评论获取
│   │   │   └── report-generator.ts   # 报告生成
│   │   ├── auth.ts             # 认证配置
│   │   └── llm.ts              # LLM 客户端
│   └── db/                     # 数据库模块
│       └── schema.ts           # Drizzle 数据模型
├── drizzle/                    # 数据库迁移
├── public/                     # 静态资源
└── wrangler.jsonc              # Cloudflare 配置
```

## 🚀 快速开始

### 环境要求

- Node.js 18+
- pnpm / npm / yarn
- Cloudflare 账户（用于部署）
- TikHub API Token

### 本地开发

1. **克隆项目**

   ```bash
   git clone https://github.com/your-username/douyin-ai-analyze.git
   cd douyin-ai-analyze
   ```

2. **安装依赖**

   ```bash
   pnpm install
   # 或者
   npm install
   ```

3. **配置环境变量**

   ```bash
   # 复制配置模板
   cp .env.example .env.local
   ```

   编辑 `.env.local` 文件

4. **初始化数据库**

   ```bash
   # 生成迁移文件
   npm run db:generate

   # 执行本地迁移
   npm run db:migrate
   ```

5. **启动开发服务器**

   ```bash
   npm run dev
   ```

   打开 [http://localhost:3000](http://localhost:3000) 查看应用。

## 📦 部署

### 部署到 Cloudflare Workers

| 命令                | 说明              |
| ------------------- | ----------------- |
| `npm run build`     | 构建生产版本      |
| `npm run preview`   | 本地预览生产构建  |
| `npm run deploy`    | 部署到 Cloudflare |
| `npx wrangler tail` | 查看实时日志      |

#### 生产环境变量配置

使用 Wrangler 设置生产环境密钥：

```bash
# 设置敏感变量（交互式输入）
npx wrangler secret put AUTH_SECRET
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put TIKHUB_TOKEN
npx wrangler secret put GITHUB_SECRET
npx wrangler secret put GOOGLE_SECRET
```

非敏感变量已在 `wrangler.jsonc` 的 `vars` 字段中配置。

#### 数据库迁移（生产环境）

```bash
npm run db:migrate:remote
```

## 🤖 AI 工具说明

项目内置以下 AI 工具供 Agent 调用：

| 工具名称                | 描述                                 |
| ----------------------- | ------------------------------------ |
| `douyin_search`         | 搜索抖音视频，支持关键词、排序、筛选 |
| `fetch_hot_search_list` | 获取抖音热搜榜单数据                 |
| `fetch_video_detail`    | 获取单个视频详细信息                 |
| `fetch_video_comments`  | 获取视频评论列表                     |
| `analyze_videos`        | 使用 AI 分析视频内容和趋势           |
| `generate_report`       | 生成分析报告                         |

## 📊 数据库模型

主要数据模型包括：

- **User** - 用户信息
- **Conversation** - 对话会话
- **Message** - 聊天消息
- **VideoAnalysis** - 视频分析记录
- **Report** - 分析报告
- **ToolCache** - 工具调用缓存
- **Feedback** - 用户反馈

## ⚙️ 配置说明

### 使用限制

| 用户类型 | 每日限制 |
| -------- | -------- |
| 匿名用户 | 10 次    |
| 登录用户 | 20 次    |

可在 `wrangler.jsonc` 中修改：

```json
{
  "vars": {
    "GUEST_DAILY_LIMIT": "10",
    "USER_DAILY_LIMIT": "20"
  }
}
```

### Agent 迭代限制

控制 AI Agent 最大工具调用次数，避免无限循环：

```json
{
  "vars": {
    "AGENT_MAX_ITERATIONS": "12"
  }
}
```

## 🔗 相关链接

- [Next.js 文档](https://nextjs.org/docs)
- [LangChain.js 文档](https://js.langchain.com/docs/)
- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [Drizzle ORM 文档](https://orm.drizzle.team/docs/overview)
- [TikHub API 文档](https://api.tikhub.io/docs)

## 📄 开源协议

本项目采用 [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/deed.zh-hans) 协议（知识共享署名-非商业性使用 4.0 国际许可协议）。

- ✅ 可以自由使用、修改、分发
- ✅ 需要保留原作者署名
- ❌ **禁止用于商业目的**

---

<div align="center">

**如果这个项目对你有帮助，欢迎 ⭐ Star 支持！**

</div>
