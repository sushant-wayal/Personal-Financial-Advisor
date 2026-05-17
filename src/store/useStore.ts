import create from "zustand";

type UIState = {
    selectedTransactionId?: string | null;
    setSelected: (id?: string | null) => void;
};

export const useStore = create<UIState>((set) => ({
    selectedTransactionId: null,
    setSelected: (id) => set({ selectedTransactionId: id ?? null }),
}));

export default useStore;
