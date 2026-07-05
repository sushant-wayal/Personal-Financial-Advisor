import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

type AdvisorContextType = {
  isAdvisorOpen: boolean;
  openAdvisor: () => void;
  closeAdvisor: () => void;
};

const AdvisorContext = createContext<AdvisorContextType | null>(null);

export function AdvisorProvider({ children }: { children: ReactNode }) {
  const [isAdvisorOpen, setIsAdvisorOpen] = useState(false);

  const openAdvisor = useCallback(() => setIsAdvisorOpen(true), []);
  const closeAdvisor = useCallback(() => setIsAdvisorOpen(false), []);

  return (
    <AdvisorContext.Provider value={{ isAdvisorOpen, openAdvisor, closeAdvisor }}>
      {children}
    </AdvisorContext.Provider>
  );
}

export function useAdvisorContext() {
  const context = useContext(AdvisorContext);
  if (!context) {
    throw new Error("useAdvisorContext must be used within an AdvisorProvider");
  }
  return context;
}
