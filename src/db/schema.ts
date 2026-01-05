import {
  sqliteTable,
  text,
  integer,
  index,
  unique,
} from "drizzle-orm/sqlite-core";
import type { AdapterAccountType } from "@auth/core/adapters";
import { relations } from "drizzle-orm";

// User
export const users = sqliteTable("User", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: text("email").unique(),
  name: text("name"),
  image: text("image"),
  emailVerified: integer("emailVerified", { mode: "timestamp_ms" }),
  canViewFeedback: integer("canViewFeedback", { mode: "boolean" }).default(
    false
  ),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).$defaultFn(
    () => new Date()
  ),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).$onUpdate(
    () => new Date()
  ),
});

// Account
export const accounts = sqliteTable(
  "Account",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => ({
    providerProviderAccountIdIndex: unique(
      "Account_provider_providerAccountId_key"
    ).on(t.provider, t.providerAccountId),
    userIdIndex: index("Account_userId_key").on(t.userId),
  })
);

// VerificationToken
export const verificationTokens = sqliteTable(
  "VerificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").unique().notNull(),
    expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => ({
    pk: unique("VerificationToken_identifier_token_key").on(
      t.identifier,
      t.token
    ),
  })
);

// UsageRecord
export const usageRecords = sqliteTable(
  "UsageRecord",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    fingerprint: text("fingerprint"),
    userId: text("userId"),
    action: text("action").notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).$defaultFn(
      () => new Date()
    ),
  },
  (t) => ({
    fingerprintCreatedAtIdx: index("UsageRecord_fingerprint_createdAt_idx").on(
      t.fingerprint,
      t.createdAt
    ),
    userIdCreatedAtIdx: index("UsageRecord_userId_createdAt_idx").on(
      t.userId,
      t.createdAt
    ),
  })
);

// Conversation
export const conversations = sqliteTable(
  "Conversation",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId").references(() => users.id, { onDelete: "cascade" }),
    fingerprint: text("fingerprint"),
    title: text("title"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).$defaultFn(
      () => new Date()
    ),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).$onUpdate(
      () => new Date()
    ),
  },
  (t) => ({
    userIdIdx: index("Conversation_userId_idx").on(t.userId),
    fingerprintIdx: index("Conversation_fingerprint_idx").on(t.fingerprint),
  })
);

// Message
export const messages = sqliteTable(
  "Message",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    conversationId: text("conversationId")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    metadata: text("metadata"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).$defaultFn(
      () => new Date()
    ),
  },
  (t) => ({
    conversationIdIdx: index("Message_conversationId_idx").on(t.conversationId),
  })
);

// VideoAnalysis
export const videoAnalysis = sqliteTable(
  "VideoAnalysis",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    videoId: text("videoId").notNull().unique(),
    videoUrl: text("videoUrl").notNull(),
    title: text("title"),
    author: text("author"),
    likes: integer("likes"),
    comments: integer("comments"),
    shares: integer("shares"),
    views: integer("views"),
    description: text("description"),
    tags: text("tags"),
    analysis: text("analysis"),
    sentiment: text("sentiment"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).$defaultFn(
      () => new Date()
    ),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).$onUpdate(
      () => new Date()
    ),
  },
  (t) => ({
    authorIdx: index("VideoAnalysis_author_idx").on(t.author),
  })
);

// Report
export const reports = sqliteTable(
  "Report",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    conversationId: text("conversationId")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    data: text("data").notNull(), // JSON
    insights: text("insights").notNull(),
    status: text("status").default("generating").notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).$defaultFn(
      () => new Date()
    ),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).$onUpdate(
      () => new Date()
    ),
  },
  (t) => ({
    conversationIdIdx: index("Report_conversationId_idx").on(t.conversationId),
    statusIdx: index("Report_status_idx").on(t.status),
  })
);

// ToolCache
export const toolCache = sqliteTable(
  "ToolCache",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    toolName: text("toolName").notNull(),
    inputHash: text("inputHash").notNull(),
    output: text("output").notNull(),
    expiresAt: integer("expiresAt", { mode: "timestamp_ms" }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).$defaultFn(
      () => new Date()
    ),
  },
  (t) => ({
    uniqueToolHash: unique("ToolCache_toolName_inputHash_key").on(
      t.toolName,
      t.inputHash
    ),
    toolNameIdx: index("ToolCache_toolName_idx").on(t.toolName),
  })
);

// Feedback
export const feedbacks = sqliteTable(
  "Feedback",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId").references(() => users.id, { onDelete: "set null" }),
    fingerprint: text("fingerprint"),
    email: text("email"),
    type: text("type").notNull(),
    content: text("content").notNull(),
    status: text("status").default("pending").notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).$defaultFn(
      () => new Date()
    ),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).$onUpdate(
      () => new Date()
    ),
  },
  (t) => ({
    userIdIdx: index("Feedback_userId_idx").on(t.userId),
    statusIdx: index("Feedback_status_idx").on(t.status),
    createdAtIdx: index("Feedback_createdAt_idx").on(t.createdAt),
  })
);

// Many-to-Many Join Table for Report <-> VideoAnalysis
export const reportToVideoAnalysis = sqliteTable(
  "_ReportToVideoAnalysis",
  {
    A: text("A")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    B: text("B")
      .notNull()
      .references(() => videoAnalysis.id, { onDelete: "cascade" }),
  },
  (t) => ({
    abUnique: unique("_ReportToVideoAnalysis_AB_unique").on(t.A, t.B),
    bIdx: index("_ReportToVideoAnalysis_B_index").on(t.B),
  })
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  conversations: many(conversations),
  feedbacks: many(feedbacks),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const conversationsRelations = relations(
  conversations,
  ({ one, many }) => ({
    user: one(users, {
      fields: [conversations.userId],
      references: [users.id],
    }),
    messages: many(messages),
    reports: many(reports),
  })
);

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

export const reportsRelations = relations(reports, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [reports.conversationId],
    references: [conversations.id],
  }),
  videos: many(reportToVideoAnalysis),
}));

export const videoAnalysisRelations = relations(videoAnalysis, ({ many }) => ({
  reports: many(reportToVideoAnalysis),
}));

export const reportToVideoAnalysisRelations = relations(
  reportToVideoAnalysis,
  ({ one }) => ({
    report: one(reports, {
      fields: [reportToVideoAnalysis.A],
      references: [reports.id],
    }),
    videoAnalysis: one(videoAnalysis, {
      fields: [reportToVideoAnalysis.B],
      references: [videoAnalysis.id],
    }),
  })
);

export const feedbacksRelations = relations(feedbacks, ({ one }) => ({
  user: one(users, { fields: [feedbacks.userId], references: [users.id] }),
}));
