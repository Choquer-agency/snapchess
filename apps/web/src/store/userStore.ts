import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { FREE_DAILY_LIMIT } from '@snapchess/shared';

interface UserState {
  // Auth (simplified — works without backend for local-first experience)
  isAuthenticated: boolean;
  user: { id: string; email: string; name?: string; tier: 'FREE' | 'PRO' } | null;
  accessToken: string | null;

  // Usage tracking (local fallback when not authenticated)
  localUsageToday: number;
  localUsageDate: string; // YYYY-MM-DD

  // Computed
  canAnalyze: () => boolean;
  remainingAnalyses: () => number;
  isPro: () => boolean;

  // Actions
  incrementUsage: () => void;
  setUser: (user: UserState['user'], token: string) => void;
  logout: () => void;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      user: null,
      accessToken: null,
      localUsageToday: 0,
      localUsageDate: todayStr(),

      canAnalyze: () => {
        const state = get();
        if (state.user?.tier === 'PRO') return true;

        // Reset if new day
        const today = todayStr();
        if (state.localUsageDate !== today) return true;

        return state.localUsageToday < FREE_DAILY_LIMIT;
      },

      remainingAnalyses: () => {
        const state = get();
        if (state.user?.tier === 'PRO') return -1; // unlimited

        const today = todayStr();
        if (state.localUsageDate !== today) return FREE_DAILY_LIMIT;

        return Math.max(0, FREE_DAILY_LIMIT - state.localUsageToday);
      },

      isPro: () => get().user?.tier === 'PRO',

      incrementUsage: () => {
        const today = todayStr();
        set((s) => ({
          localUsageToday: s.localUsageDate === today ? s.localUsageToday + 1 : 1,
          localUsageDate: today,
        }));
      },

      setUser: (user, token) =>
        set({
          isAuthenticated: true,
          user,
          accessToken: token,
        }),

      logout: () =>
        set({
          isAuthenticated: false,
          user: null,
          accessToken: null,
        }),
    }),
    {
      name: 'snapchess-user',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        accessToken: state.accessToken,
        localUsageToday: state.localUsageToday,
        localUsageDate: state.localUsageDate,
      }),
    },
  ),
);
