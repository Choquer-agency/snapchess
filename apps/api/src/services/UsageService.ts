import { prisma } from '../config/database';
import { FREE_DAILY_LIMIT } from '@snapchess/shared';

export class UsageService {
  static async getToday(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const usage = await prisma.dailyUsage.findUnique({
      where: { userId_date: { userId, date: today } },
    });

    return usage?.count ?? 0;
  }

  static async canAnalyze(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tier: true },
    });

    if (user?.tier === 'PRO') return true;

    const used = await this.getToday(userId);
    return used < FREE_DAILY_LIMIT;
  }

  static async increment(userId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const usage = await prisma.dailyUsage.upsert({
      where: { userId_date: { userId, date: today } },
      update: { count: { increment: 1 } },
      create: { userId, date: today, count: 1 },
    });

    return usage.count;
  }

  static async getUsageInfo(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tier: true },
    });

    const tier = user?.tier ?? 'FREE';
    const used = await this.getToday(userId);
    const limit = tier === 'PRO' ? Infinity : FREE_DAILY_LIMIT;

    return {
      used,
      limit: tier === 'PRO' ? -1 : FREE_DAILY_LIMIT, // -1 = unlimited
      canAnalyze: tier === 'PRO' || used < FREE_DAILY_LIMIT,
      tier,
    };
  }
}
