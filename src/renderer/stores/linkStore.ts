import { create } from 'zustand';

interface LinkStore {
  linkedProductCodes: string[];
  sourceLabel: string;
  setLinkedProducts: (codes: string[], sourceLabel: string) => void;
  clearLinkedProducts: () => void;
}

export const useLinkStore = create<LinkStore>((set) => ({
  linkedProductCodes: [],
  sourceLabel: '',
  setLinkedProducts: (codes, sourceLabel) =>
    set({
      linkedProductCodes: Array.from(new Set(codes.filter(Boolean))),
      sourceLabel
    }),
  clearLinkedProducts: () =>
    set({
      linkedProductCodes: [],
      sourceLabel: ''
    })
}));
