import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from '../firebase';
import { auth } from '../firebase';
import { Farm } from '../types';
import { handleFirestoreError, OperationType } from '../utils/firestoreError';

interface FarmContextType {
  farms: Farm[];
  selectedFarm: Farm | null;
  setSelectedFarm: (farm: Farm | null) => void;
  loading: boolean;
}

const FarmContext = createContext<FarmContextType | undefined>(undefined);

export function FarmProvider({ children }: { children: React.ReactNode }) {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [selectedFarm, setSelectedFarm] = useState<Farm | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Track auth state
  useEffect(() => {
    return auth.onAuthStateChanged((user) => {
      setUserId(user ? user.uid : null);
      if (!user) {
        setFarms([]);
        setSelectedFarm(null);
        setLoading(false);
      }
    });
  }, []);

  // Subscribe to farms for the current user
  useEffect(() => {
    if (!userId) return;

    const q = query(collection(null, 'farms'), where('ownerId', '==', userId));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const farmData: Farm[] = snapshot.docs.map((doc) => ({
          ...(doc.data() as Farm),
          id: doc.id,
        }));
        setFarms(farmData);

        setSelectedFarm((prev) => {
          if (!prev) {
            return farmData.find((f) => f.isDefault) || farmData[0] || null;
          }
          const updated = farmData.find((f) => f.id === prev.id);
          return updated || farmData[0] || null;
        });

        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'farms');
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [userId]);

  return (
    <FarmContext.Provider value={{ farms, selectedFarm, setSelectedFarm, loading }}>
      {children}
    </FarmContext.Provider>
  );
}

export function useFarm() {
  const context = useContext(FarmContext);
  if (context === undefined) {
    throw new Error('useFarm must be used within a FarmProvider');
  }
  return context;
}
