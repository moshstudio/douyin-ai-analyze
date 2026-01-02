"use client";

import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { FileText, X, BarChart3, ExternalLink } from "lucide-react";
import MarkdownRenderer from "@/components/MarkdownRenderer";

interface ReportViewerProps {
  report: {
    title: string;
    summary: string;
    data: string;
    insights: string;
  };
}

interface EngagementData {
  name: string;
  likes?: number;
  comments?: number;
  shares?: number;
  value?: number;
  [key: string]: string | number | undefined;
}

interface TrendData {
  name: string;
  value: number;
  [key: string]: string | number | undefined;
}

interface SentimentData {
  name: string;
  value: number;
  [key: string]: string | number | undefined;
}

interface ChartData {
  engagement?: EngagementData[];
  trends?: TrendData[];
  sentiment?: SentimentData[];
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

export default function ReportViewer({ report }: ReportViewerProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Parse report data using useMemo
  const chartData = useMemo<ChartData | null>(() => {
    try {
      const parsed = JSON.parse(report.data);
      return parsed.chartData || parsed;
    } catch {
      return null;
    }
  }, [report.data]);

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // 1. Minimized View (Card)
  if (!isOpen) {
    return (
      <div
        className='w-full max-w-sm bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden hover:shadow-md transition-shadow duration-200 group cursor-pointer'
        onClick={() => setIsOpen(true)}
      >
        <div className='p-4 border-b border-zinc-100 dark:border-zinc-700/50 flex items-start justify-between'>
          <div className='flex items-center gap-3'>
            <div className='p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg'>
              <BarChart3 className='w-5 h-5' />
            </div>
            <div>
              <h3 className='font-semibold text-zinc-900 dark:text-zinc-100 text-sm leading-tight'>
                {report.title}
              </h3>
              <p className='text-xs text-zinc-500 dark:text-zinc-400 mt-1'>
                点击查看完整报告
              </p>
            </div>
          </div>
          <ExternalLink className='w-4 h-4 text-zinc-400 group-hover:text-blue-500 transition-colors' />
        </div>
        <div className='p-4 bg-zinc-50 dark:bg-zinc-800/50'>
          <p className='text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2'>
            {report.summary}
          </p>
        </div>
      </div>
    );
  }

  // 2. Full Modal View - Using Portal to cover the whole page
  return createPortal(
    <div className='fixed inset-0 z-[9999] flex items-center justify-center p-0 md:p-4'>
      {/* Backdrop */}
      <div
        className='absolute inset-0 bg-black/70 backdrop-blur-md animate-in fade-in duration-300'
        onClick={() => setIsOpen(false)}
      />

      {/* Modal Content */}
      <div className='relative w-full h-full md:h-[92vh] md:max-w-7xl bg-white dark:bg-zinc-900 md:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-bottom-5 duration-300'>
        {/* Header */}
        <div className='flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md sticky top-0 z-10'>
          <div className='flex items-center gap-3'>
            <div className='p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg'>
              <FileText className='w-5 h-5' />
            </div>
            <h2 className='text-xl font-bold text-zinc-900 dark:text-zinc-100 truncate max-w-[200px] sm:max-w-md'>
              {report.title}
            </h2>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className='p-2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-all duration-300 hover:rotate-90'
          >
            <X className='w-6 h-6' />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className='flex-1 overflow-y-auto p-6 scroll-smooth'>
          <div className='max-w-4xl mx-auto space-y-8'>
            {/* Summary Section */}
            <div className='bg-blue-50/50 dark:bg-blue-900/10 p-6 rounded-xl border border-blue-100 dark:border-blue-800/30'>
              <h3 className='text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2'>
                💡 执行摘要
              </h3>
              <p className='text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed'>
                {report.summary}
              </p>
            </div>

            {/* Charts Section */}
            {chartData && (
              <div className='space-y-6'>
                <h3 className='text-xl font-bold text-zinc-900 dark:text-zinc-100 border-l-4 border-blue-500 pl-3'>
                  数据可视化
                </h3>

                <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
                  {/* Engagement Chart */}
                  {chartData.engagement && chartData.engagement.length > 0 && (
                    <div className='p-5 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-800'>
                      <h4 className='text-md font-medium text-zinc-700 dark:text-zinc-300 mb-4 text-center'>
                        互动数据分析
                      </h4>
                      <ResponsiveContainer
                        width='100%'
                        height={300}
                      >
                        <BarChart data={chartData.engagement}>
                          <CartesianGrid
                            strokeDasharray='3 3'
                            vertical={false}
                            stroke='#E4E4E7'
                          />
                          <XAxis
                            dataKey='name'
                            tick={{ fontSize: 12, fill: "#71717a" }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{ fontSize: 12, fill: "#71717a" }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            contentStyle={{
                              borderRadius: "8px",
                              border: "none",
                              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                            }}
                          />
                          <Legend wrapperStyle={{ paddingTop: "10px" }} />
                          {/* Backward compatibility logic */}
                          {chartData.engagement[0] &&
                          chartData.engagement[0].likes !== undefined ? (
                            <>
                              <Bar
                                dataKey='likes'
                                fill='#3B82F6'
                                name='点赞'
                                radius={[4, 4, 0, 0]}
                              />
                              <Bar
                                dataKey='comments'
                                fill='#10B981'
                                name='评论'
                                radius={[4, 4, 0, 0]}
                              />
                              <Bar
                                dataKey='shares'
                                fill='#F59E0B'
                                name='分享'
                                radius={[4, 4, 0, 0]}
                              />
                            </>
                          ) : (
                            <Bar
                              dataKey='value'
                              fill='#3B82F6'
                              name='互动总数'
                              radius={[4, 4, 0, 0]}
                            />
                          )}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Sentiment Chart */}
                  {chartData.sentiment && chartData.sentiment.length > 0 && (
                    <div className='p-5 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-800'>
                      <h4 className='text-md font-medium text-zinc-700 dark:text-zinc-300 mb-4 text-center'>
                        情感分布
                      </h4>
                      <ResponsiveContainer
                        width='100%'
                        height={300}
                      >
                        <PieChart>
                          <Pie
                            data={chartData.sentiment}
                            cx='50%'
                            cy='50%'
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey='value'
                          >
                            {chartData.sentiment.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={COLORS[index % COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              borderRadius: "8px",
                              border: "none",
                              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                            }}
                          />
                          <Legend
                            layout='vertical'
                            verticalAlign='middle'
                            align='right'
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Trends/Keywords Chart */}
                  {chartData.trends && chartData.trends.length > 0 && (
                    <div className='col-span-1 lg:col-span-2 p-5 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-800'>
                      <h4 className='text-md font-medium text-zinc-700 dark:text-zinc-300 mb-4'>
                        热点趋势/关键词
                      </h4>
                      <ResponsiveContainer
                        width='100%'
                        height={300}
                      >
                        <BarChart
                          data={chartData.trends}
                          layout='vertical'
                          barSize={20}
                        >
                          <CartesianGrid
                            strokeDasharray='3 3'
                            horizontal={false}
                            stroke='#E4E4E7'
                          />
                          <XAxis
                            type='number'
                            hide
                          />
                          <YAxis
                            dataKey='name'
                            type='category'
                            width={120}
                            tick={{ fontSize: 12, fill: "#71717a" }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            contentStyle={{
                              borderRadius: "8px",
                              border: "none",
                              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                            }}
                          />
                          <Bar
                            dataKey='value'
                            fill='#8B5CF6'
                            name='热度'
                            radius={[0, 4, 4, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Insights Section */}
            <div className='p-6 bg-zinc-50/50 dark:bg-zinc-800/30 rounded-xl border border-zinc-100 dark:border-zinc-700'>
              <h3 className='text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 border-l-4 border-green-500 pl-3'>
                深度洞察与建议
              </h3>
              <div className='max-w-none'>
                <MarkdownRenderer content={report.insights} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
