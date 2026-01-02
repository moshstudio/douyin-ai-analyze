// 定义统一的返回数据类型接口
export interface BaseResponse {
  type: string;
}

export interface ErrorResponse extends BaseResponse {
  type: "error";
  message: string;
  errorType?: string;
}

export interface RateLimitErrorResponse extends BaseResponse {
  type: "error";
  errorType: "rate_limit";
  message: string;
  remaining: number;
  limit: number;
}

export interface MetaResponse extends BaseResponse {
  type: "meta";
  conversationId: string;
  remaining: number;
  limit: number;
}

export interface TokenResponse extends BaseResponse {
  type: "token";
  content: string;
}

export interface StepStartResponse extends BaseResponse {
  type: "step";
  status: "start";
  tool: string;
  input: Record<string, unknown> | string;
  log?: string;
}

export interface StepEndResponse extends BaseResponse {
  type: "step";
  status: "end";
  output: string;
}

export interface DoneResponse extends BaseResponse {
  type: "done";
  content: string;
}

export interface InvalidFormatErrorResponse extends BaseResponse {
  type: "error";
  error: string;
}

// 联合类型定义
export type ApiResponse =
  | ErrorResponse
  | RateLimitErrorResponse
  | MetaResponse
  | TokenResponse
  | StepStartResponse
  | StepEndResponse
  | DoneResponse
  | InvalidFormatErrorResponse;

// 类型守卫函数
export function isErrorResponse(
  response: BaseResponse
): response is ErrorResponse {
  if (response.type !== "error") return false;
  const errorResponse = response as { errorType?: string; error?: string };
  return !errorResponse.errorType && !errorResponse.error;
}

export function isRateLimitErrorResponse(
  response: BaseResponse
): response is RateLimitErrorResponse {
  if (response.type !== "error") return false;
  const rateLimitResponse = response as { errorType?: string };
  return rateLimitResponse.errorType === "rate_limit";
}

export function isMetaResponse(
  response: BaseResponse
): response is MetaResponse {
  return response.type === "meta";
}

export function isTokenResponse(
  response: BaseResponse
): response is TokenResponse {
  return response.type === "token";
}

export function isStepStartResponse(
  response: BaseResponse
): response is StepStartResponse {
  if (response.type !== "step") return false;
  const stepResponse = response as { status?: string };
  return stepResponse.status === "start";
}

export function isStepEndResponse(
  response: BaseResponse
): response is StepEndResponse {
  if (response.type !== "step") return false;
  const stepResponse = response as { status?: string };
  return stepResponse.status === "end";
}

export function isDoneResponse(
  response: BaseResponse
): response is DoneResponse {
  return response.type === "done";
}

export function isInvalidFormatErrorResponse(
  response: BaseResponse
): response is InvalidFormatErrorResponse {
  if (response.type !== "error") return false;
  return "error" in response;
}
