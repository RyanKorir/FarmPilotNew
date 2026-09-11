import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface Petal {
  id: number;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  color: string;
}

export default function InteractiveEffects() {
  const [petals, setPetals] = useState<Petal[]>([]);
  const [isEnabled, setIsEnabled] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const unsub = onSnapshot(doc(db, 'settings', user.uid), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setIsEnabled(data.visualEffects?.interactiveClicks ?? true);
      }
    }, (error) => {
      console.error("InteractiveEffects snapshot error:", error);
    });

    return () => unsub();
  }, []);

  const spawnPetals = useCallback((x: number, y: number) => {
    const colors = ['#FFB7C5', '#FFC0CB', '#FFD1DC', '#FFE4E1']; // Cherry blossom colors
    const newPetals = Array.from({ length: 5 }).map((_, i) => ({
      id: Date.now() + i,
      x: x + (Math.random() - 0.5) * 40,
      y: y + (Math.random() - 0.5) * 40,
      rotation: Math.random() * 360,
      scale: 0.5 + Math.random() * 0.5,
      color: colors[Math.floor(Math.random() * colors.length)]
    }));

    setPetals(prev => [...prev, ...newPetals].slice(-30)); // Keep last 30 petals max
  }, []);

  useEffect(() => {
    if (!isEnabled) return;

    const handleClick = (e: MouseEvent) => {
      // Don't spawn if clicking on buttons, inputs, or links
      const target = e.target as HTMLElement;
      const isInteractive = target.closest('button, input, select, a, textarea, [role="button"]');
      
      if (!isInteractive) {
        spawnPetals(e.clientX, e.clientY);
      }
    };

    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [isEnabled, spawnPetals]);

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      <AnimatePresence>
        {petals.map(petal => (
          <motion.div
            key={petal.id}
            initial={{ 
              opacity: 0, 
              x: petal.x, 
              y: petal.y, 
              rotate: petal.rotation, 
              scale: 0 
            }}
            animate={{ 
              opacity: [0, 1, 1, 0],
              y: petal.y + 150 + Math.random() * 100,
              x: petal.x + (Math.random() - 0.5) * 100,
              rotate: petal.rotation + 180 + Math.random() * 180,
              scale: petal.scale
            }}
            exit={{ opacity: 0 }}
            transition={{ 
              duration: 2 + Math.random() * 2,
              ease: "easeOut"
            }}
            onAnimationComplete={() => {
              setPetals(prev => prev.filter(p => p.id !== petal.id));
            }}
            className="absolute w-4 h-4 rounded-full"
            style={{ 
              backgroundColor: petal.color,
              borderRadius: '60% 40% 70% 30% / 70% 30% 60% 40%', // Petal shape
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
