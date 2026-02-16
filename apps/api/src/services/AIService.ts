import crypto from 'crypto';
import { env } from '../config/env';
import { prisma } from '../config/database';

interface MoveToExplain {
  san: string;
  uci: string;
  score: number; // centipawns
  mate?: number;
  pv: string[]; // principal variation
  rank: number;
}

interface ExplanationResult {
  explanations: { move: string; explanation: string }[];
  opening?: string;
  tactics?: string[];
  cached: boolean;
}

// Known openings for quick lookup (subset — full DB would be larger)
const OPENINGS: Record<string, string> = {
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR': "King's Pawn Opening",
  'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR': "Queen's Pawn Opening",
  'rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR': 'English Opening',
  'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R': "Reti Opening",
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR': "King's Pawn Game",
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R': "King's Knight Opening",
  'rnbqkb1r/pppppppp/5n2/8/4P3/8/PPPP1PPP/RNBQKBNR': "Alekhine's Defense",
  'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR': 'Sicilian Defense',
  'rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR': 'French Defense',
  'rnbqkbnr/ppppppp1/7p/8/4P3/8/PPPP1PPP/RNBQKBNR': 'Borg Defense',
  'rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR': 'Indian Defense',
  'rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR': "Queen's Pawn Game",
  'rnbqkbnr/ppp1pppp/8/3p4/2P5/8/PP1PPPPP/RNBQKBNR': "Queen's Gambit",
};

export class AIService {
  private static cacheKey(fen: string, moves: string[]): string {
    const input = `${fen}:${moves.join(',')}`;
    return crypto.createHash('sha256').update(input).digest('hex').slice(0, 20);
  }

  static async explainMoves(
    fen: string,
    moves: MoveToExplain[],
    turn: 'w' | 'b',
  ): Promise<ExplanationResult> {
    const cacheKey = this.cacheKey(fen, moves.map((m) => m.uci));

    // Check cache
    const cached = await prisma.analysis.findFirst({
      where: { fenHash: cacheKey, aiExplanation: { not: null } },
      select: { aiExplanation: true },
    });

    if (cached?.aiExplanation) {
      try {
        const parsed = JSON.parse(cached.aiExplanation);
        return { ...parsed, cached: true };
      } catch {
        // Cache corrupted, regenerate
      }
    }

    // Detect opening
    const piecePlacement = fen.split(' ')[0];
    const opening = OPENINGS[piecePlacement] || undefined;

    // Generate explanations via AI
    const explanations = await this.callAI(fen, moves, turn, opening);

    // Extract tactical patterns from AI response
    const tactics = this.extractTactics(explanations.map((e) => e.explanation).join(' '));

    const result: ExplanationResult = {
      explanations,
      opening,
      tactics: tactics.length > 0 ? tactics : undefined,
      cached: false,
    };

    // Cache the result
    await prisma.analysis
      .updateMany({
        where: { fenHash: cacheKey.slice(0, 16) },
        data: { aiExplanation: JSON.stringify(result) },
      })
      .catch(() => {
        // If no matching analysis exists, that's fine — explanation is returned either way
      });

    return result;
  }

  private static async callAI(
    fen: string,
    moves: MoveToExplain[],
    turn: 'w' | 'b',
    opening?: string,
  ): Promise<{ move: string; explanation: string }[]> {
    if (!env.ANTHROPIC_API_KEY) {
      // Fallback: generate basic explanations without AI
      return this.generateBasicExplanations(moves, turn);
    }

    const turnName = turn === 'w' ? 'White' : 'Black';
    const movesDescription = moves
      .map((m) => {
        const scoreStr =
          m.mate !== undefined
            ? `mate in ${Math.abs(m.mate)}`
            : `${(m.score / 100).toFixed(1)} pawns`;
        return `${m.rank}. ${m.san} (evaluation: ${scoreStr}, line: ${m.pv.slice(0, 5).join(' ')})`;
      })
      .join('\n');

    const prompt = `You are a chess coach explaining engine analysis to an intermediate player. The position FEN is: ${fen}
${opening ? `This is the ${opening}.` : ''}
It is ${turnName}'s turn to move. The engine's top ${moves.length} moves are:

${movesDescription}

For each move, write a concise explanation (2-3 sentences) of WHY it's a strong move. Focus on:
- The strategic or tactical idea behind the move
- What threats it creates or prevents
- How it improves the position

Identify any tactical patterns (forks, pins, skewers, discovered attacks, sacrifices, zwischenzug).

Respond in JSON format:
{
  "explanations": [
    {"move": "SAN notation", "explanation": "2-3 sentence explanation"}
  ],
  "tactics": ["pattern1", "pattern2"]
}`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        console.error('AI API error:', response.status, await response.text());
        return this.generateBasicExplanations(moves, turn);
      }

      const data = await response.json();
      const text = data.content?.[0]?.text || '';

      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.explanations || this.generateBasicExplanations(moves, turn);
      }

      return this.generateBasicExplanations(moves, turn);
    } catch (error) {
      console.error('AI explanation error:', error);
      return this.generateBasicExplanations(moves, turn);
    }
  }

  private static generateBasicExplanations(
    moves: MoveToExplain[],
    turn: 'w' | 'b',
  ): { move: string; explanation: string }[] {
    const turnName = turn === 'w' ? 'White' : 'Black';

    return moves.map((m) => {
      let explanation: string;

      if (m.mate !== undefined) {
        if (m.mate > 0) {
          explanation = `${m.san} leads to checkmate in ${m.mate} move${m.mate > 1 ? 's' : ''}. This is a forced winning sequence that ${turnName} should play immediately.`;
        } else {
          explanation = `${m.san} is the best defense, but the opponent has a forced checkmate in ${Math.abs(m.mate)} moves. ${turnName} should look for ways to complicate the position.`;
        }
      } else if (Math.abs(m.score) > 300) {
        const winning = (turn === 'w' && m.score > 0) || (turn === 'b' && m.score < 0);
        explanation = winning
          ? `${m.san} maintains a decisive advantage of ${(Math.abs(m.score) / 100).toFixed(1)} pawns. This move keeps ${turnName} firmly in control of the position.`
          : `${m.san} is the best try in a difficult position. ${turnName} is down significant material but this move offers the most resistance.`;
      } else if (Math.abs(m.score) > 100) {
        explanation = `${m.san} gives ${turnName} a clear advantage. The evaluation of ${(m.score / 100).toFixed(1)} suggests this move creates meaningful pressure.`;
      } else {
        explanation = `${m.san} is the engine's top choice in a balanced position. It likely improves piece activity or controls key squares.`;
      }

      if (m.rank > 1) {
        const diff = Math.abs(moves[0].score - m.score);
        if (diff < 20) {
          explanation += ' This is nearly as strong as the top move.';
        }
      }

      return { move: m.san, explanation };
    });
  }

  private static extractTactics(text: string): string[] {
    const patterns = [
      'fork', 'pin', 'skewer', 'discovered attack', 'discovered check',
      'double attack', 'sacrifice', 'zwischenzug', 'deflection',
      'decoy', 'overloading', 'back rank', 'battery', 'outpost',
      'passed pawn', 'pawn break', 'fianchetto', 'castling',
    ];

    const lower = text.toLowerCase();
    return patterns.filter((p) => lower.includes(p));
  }
}
