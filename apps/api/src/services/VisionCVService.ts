import { env } from '../config/env';
import { Chess } from 'chess.js';
import type { CVDetectionResult } from './CVService';

const SQUARES = [
  'a8','b8','c8','d8','e8','f8','g8','h8',
  'a7','b7','c7','d7','e7','f7','g7','h7',
  'a6','b6','c6','d6','e6','f6','g6','h6',
  'a5','b5','c5','d5','e5','f5','g5','h5',
  'a4','b4','c4','d4','e4','f4','g4','h4',
  'a3','b3','c3','d3','e3','f3','g3','h3',
  'a2','b2','c2','d2','e2','f2','g2','h2',
  'a1','b1','c1','d1','e1','f1','g1','h1',
];

function validateFen(fen: string): string[] {
  const errors: string[] = [];
  const placement = fen.split(' ')[0];
  const ranks = placement.split('/');

  if (ranks.length !== 8) {
    errors.push(`Expected 8 ranks, got ${ranks.length}`);
    return errors;
  }

  let whiteKings = 0;
  let blackKings = 0;

  for (let i = 0; i < ranks.length; i++) {
    const rank = ranks[i];
    let squares = 0;
    for (const ch of rank) {
      if (ch >= '1' && ch <= '8') {
        squares += parseInt(ch);
      } else if ('pnbrqkPNBRQK'.includes(ch)) {
        squares++;
        if (ch === 'K') whiteKings++;
        if (ch === 'k') blackKings++;
        // Pawns on ranks 1 or 8
        if ((ch === 'P' || ch === 'p') && (i === 0 || i === 7)) {
          errors.push(`Pawn on rank ${i === 0 ? 8 : 1} is invalid`);
        }
      }
    }
    if (squares !== 8) {
      errors.push(`Rank ${8 - i} has ${squares} squares instead of 8`);
    }
  }

  if (whiteKings !== 1) errors.push(`Expected 1 white king, found ${whiteKings}`);
  if (blackKings !== 1) errors.push(`Expected 1 black king, found ${blackKings}`);

  return errors;
}

function buildFullFen(placement: string): string {
  // Default: white to move, all castling rights, no en passant
  return `${placement} w KQkq - 0 1`;
}

export class VisionCVService {
  static async detectPosition(
    imageBuffer: Buffer,
    mimeType: string = 'image/png',
  ): Promise<CVDetectionResult> {
    const startTime = Date.now();

    const base64 = imageBuffer.toString('base64');
    const mediaType = mimeType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';

    const prompt = `You are a chess position detector. Analyze this image of a chess board and output ONLY the FEN piece placement string (the first part of a FEN string, with 8 ranks separated by slashes).

Rules:
- Use standard FEN notation: K=white king, Q=white queen, R=white rook, B=white bishop, N=white knight, P=white pawn, k/q/r/b/n/p for black pieces, numbers for empty squares
- Each rank must sum to exactly 8 squares
- There must be exactly one white king (K) and one black king (k)
- No pawns on rank 1 or rank 8
- Output ONLY the piece placement (e.g. "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR"), nothing else
- If the board orientation appears to be from Black's perspective (white pieces at top), still output from White's perspective (rank 8 first)`;

    let fen = await this.callVision(base64, mediaType, prompt);
    let errors = validateFen(fen);

    // One retry with error feedback
    if (errors.length > 0) {
      console.warn('Vision FEN validation failed, retrying:', errors);
      const retryPrompt = `Your previous attempt to read this chess position produced an invalid FEN: "${fen}"

Validation errors:
${errors.map((e) => `- ${e}`).join('\n')}

Please look at the image again carefully and output ONLY the corrected FEN piece placement string. Remember:
- Exactly 8 ranks separated by /
- Each rank sums to 8 squares
- Exactly one K and one k
- No pawns (P/p) on ranks 1 or 8`;

      fen = await this.callVision(base64, mediaType, retryPrompt);
      errors = validateFen(fen);
    }

    // Try loading into chess.js for final validation
    const fullFen = buildFullFen(fen);
    try {
      new Chess(fullFen);
    } catch {
      // chess.js rejected it — try with black to move
      try {
        new Chess(fen.split('/').length === 8 ? `${fen} b KQkq - 0 1` : fullFen);
      } catch {
        errors.push('Position rejected by chess.js validator');
      }
    }

    const squareConfidences: Record<string, number> = {};
    for (const sq of SQUARES) {
      squareConfidences[sq] = 0.95;
    }

    return {
      fen: fullFen,
      confidence: errors.length === 0 ? 0.95 : 0.6,
      squareConfidences,
      lowConfidenceSquares: [],
      needsReview: errors.length > 0,
      validationErrors: errors,
      processingTimeMs: Date.now() - startTime,
    };
  }

  private static async callVision(
    base64Image: string,
    mediaType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
    prompt: string,
  ): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64Image,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Vision API error:', response.status, errorText);
      throw new Error(`Vision API returned ${response.status}`);
    }

    const data = await response.json();
    const text: string = data.content?.[0]?.text || '';

    // Extract FEN-like pattern from response
    const fenMatch = text.match(/([pnbrqkPNBRQK1-8]+\/){7}[pnbrqkPNBRQK1-8]+/);
    if (fenMatch) {
      return fenMatch[0];
    }

    // If no regex match, try trimming the whole response
    const trimmed = text.trim().split(/\s/)[0];
    if (trimmed.includes('/')) {
      return trimmed;
    }

    throw new Error('Could not extract FEN from vision response');
  }
}
