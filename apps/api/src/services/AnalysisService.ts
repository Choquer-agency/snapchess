import crypto from 'crypto';
import { prisma } from '../config/database';

export class AnalysisService {
  static hashFen(fen: string): string {
    return crypto.createHash('sha256').update(fen.trim()).digest('hex').slice(0, 16);
  }

  static async findCached(fen: string) {
    const fenHash = this.hashFen(fen);
    return prisma.analysis.findFirst({
      where: { fenHash },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async save(params: {
    userId?: string;
    fen: string;
    topMoves: unknown[];
    imageUrl?: string;
    cached?: boolean;
  }) {
    const fenHash = this.hashFen(params.fen);

    return prisma.analysis.create({
      data: {
        userId: params.userId,
        fen: params.fen,
        fenHash,
        topMoves: params.topMoves as any,
        imageUrl: params.imageUrl,
        cached: params.cached ?? false,
      },
    });
  }

  static async getById(id: string) {
    return prisma.analysis.findUnique({ where: { id } });
  }

  static async getUserHistory(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [analyses, total] = await Promise.all([
      prisma.analysis.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.analysis.count({ where: { userId } }),
    ]);

    return { analyses, total, page, limit };
  }
}
