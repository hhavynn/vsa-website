import { createContext, useContext, ReactNode } from 'react';
import { usePoints } from '../hooks/usePoints';

interface PointsContextType {
  points: number;
  loading: boolean;
  addPoints: (amount: number, eventId?: string) => Promise<void>;
  refreshPoints: () => Promise<any>;
}

const PointsContext = createContext<PointsContextType | undefined>(undefined);

export function PointsProvider({ children }: { children: ReactNode }) {
  const pointsData = usePoints();

  return (
    <PointsContext.Provider value={pointsData}>
      {children}
    </PointsContext.Provider>
  );
}

export function usePointsContext() {
  const context = useContext(PointsContext);
  if (context === undefined) {
    throw new Error('usePointsContext must be used within a PointsProvider');
  }
  return context;
} 