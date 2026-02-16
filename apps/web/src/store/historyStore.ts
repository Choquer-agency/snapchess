import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SavedAnalysis {
  id: string;
  fen: string;
  topMoves: {
    rank: number;
    san: string;
    score: number;
    mate?: number;
  }[];
  timestamp: number;
  imageUrl?: string;
}

interface HistoryState {
  analyses: SavedAnalysis[];
  addAnalysis: (analysis: Omit<SavedAnalysis, 'id' | 'timestamp'>) => string;
  removeAnalysis: (id: string) => void;
  clearHistory: () => void;
}

let nextId = 1;

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set) => ({
      analyses: [],

      addAnalysis: (analysis) => {
        const id = `local-${Date.now()}-${nextId++}`;
        set((s) => ({
          analyses: [
            { ...analysis, id, timestamp: Date.now() },
            ...s.analyses,
          ].slice(0, 100), // Keep last 100
        }));
        return id;
      },

      removeAnalysis: (id) =>
        set((s) => ({
          analyses: s.analyses.filter((a) => a.id !== id),
        })),

      clearHistory: () => set({ analyses: [] }),
    }),
    {
      name: 'snapchess-history',
    },
  ),
);
