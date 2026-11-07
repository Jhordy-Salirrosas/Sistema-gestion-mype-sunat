import { create } from 'zustand';
import type { ReconcileSummary, SireBookType } from '../types/sire.types';

interface SireReconciliationState {
  period: string | null;
  bookType: SireBookType | null;
  summary: ReconcileSummary | null;
  isClosed: boolean;
  setSummary: (period: string, bookType: SireBookType, summary: ReconcileSummary) => void;
  setClosed: () => void;
  clearSummary: () => void;
}

export const useSireReconciliationStore = create<SireReconciliationState>((set) => ({
  period: null,
  bookType: null,
  summary: null,
  isClosed: false,
  setSummary: (period, bookType, summary) => set({ period, bookType, summary, isClosed: false }),
  setClosed: () => set({ isClosed: true }),
  clearSummary: () => set({ period: null, bookType: null, summary: null, isClosed: false }),
}));
