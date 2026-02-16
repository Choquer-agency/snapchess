export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
}

export interface AuthTokens {
  accessToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

export interface AnalysisRequest {
  fen: string;
  depth?: number;
}

export interface DetectPositionResponse {
  fen: string;
  confidence: number;
  lowConfidenceSquares: string[];
  needsReview: boolean;
}
