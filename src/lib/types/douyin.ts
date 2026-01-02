export interface DouyinVideoData {
  aweme_id: string;
  desc: string;
  create_time: number;
  author: {
    uid?: string;
    nickname: string;
    avatar_larger?: string;
    follower_count?: number;
    signature?: string;
    birthday?: string;
  };
  statistics: {
    digg_count: number;
    comment_count: number;
    share_count: number;
    collect_count: number;
    play_count: number;
  };
  video: {
    play_addr: string;
    cover: string;
    duration: number;
    width: number;
    height: number;
  };
  music?: {
    id?: string;
    title?: string;
    author?: string;
    play_url?: string;
  };
  cha_list?: Array<{
    cid: string;
    cha_name: string;
  }>;
  share_url: string;
  text_extra?: unknown[];
}

export interface DouyinSearchResult {
  code: number;
  message: string;
  params?: Record<string, unknown>;
  data: {
    business_data: Array<{
      data_id: string;
      type: number;
      data: DouyinVideoData;
    }>;
  };
}

export interface DouyinComment {
  cid: string;
  text: string;
  aweme_id: string;
  create_time: number;
  digg_count: number;
  ip_label?: string;
  reply_id: string;
  reply_comment_total?: number;
  label_text?: string;
  user: {
    uid: string;
    nickname: string;
    avatar_thumb: {
      url_list: string[];
    };
  };
  reply_comment?: DouyinComment[] | null;
}

export interface DouyinCommentResponse {
  code: number;
  message: string;
  data: {
    comments: DouyinComment[];
    cursor: number;
    has_more: number | boolean;
    total: number;
  };
}
export interface DouyinHotSearchItem {
  word: string;
  hot_value: number;
  view_count?: number;
  video_count?: number;
  position?: number;
  event_time?: number;
  label?: number;
}

export interface DouyinHotSearchResponse {
  code: number;
  message: string;
  data: {
    active_time: string;
    trending_list: DouyinHotSearchItem[];
    word_list: DouyinHotSearchItem[];
  } | null;
}
