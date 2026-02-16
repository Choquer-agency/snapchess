export type PieceColor = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type Square = string; // e.g., 'e4'

export interface Piece {
  type: PieceType;
  color: PieceColor;
}

export interface Move {
  from: Square;
  to: Square;
  promotion?: PieceType;
  san: string; // Standard algebraic notation, e.g., "Nf3"
  uci: string; // UCI notation, e.g., "g1f3"
}

export interface EngineEvaluation {
  depth: number;
  score: number; // In centipawns, from white's perspective
  mate?: number; // Moves to mate (positive = white mates, negative = black mates)
  pv: string[]; // Principal variation (UCI moves)
  multipv: number; // Which line (1, 2, or 3)
}

export interface AnalysisResult {
  id: string;
  fen: string;
  turn: PieceColor;
  topMoves: TopMove[];
  createdAt: string;
  imageUrl?: string;
  aiExplanation?: string;
}

export interface TopMove {
  rank: number; // 1, 2, or 3
  move: Move;
  evaluation: EngineEvaluation;
  explanation?: string; // AI-generated explanation (Pro only)
}

export interface CVDetectionResult {
  fen: string;
  confidence: number; // Overall confidence 0-1
  squareConfidences: Record<string, number>; // Per-square confidence
  lowConfidenceSquares: string[]; // Squares below 90% confidence
  needsReview: boolean;
}

export type SubscriptionTier = 'FREE' | 'PRO';
export type SubscriptionStatus = 'ACTIVE' | 'CANCELED' | 'PAST_DUE' | 'EXPIRED';

export interface UsageInfo {
  used: number;
  limit: number;
  canAnalyze: boolean;
  tier: SubscriptionTier;
}
