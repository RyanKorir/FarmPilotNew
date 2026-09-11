import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import Livestock from './components/Livestock';
import Production from './components/Production';
import Finance from './components/Finance';
import Settings from './components/Settings';
import Feedback from './components/Feedback';
import MaasaiRunner from './components/MaasaiRunner';
import ErrorBoundary from './components/ErrorBoundary';
import { FarmProvider, useFarm } from './context/FarmContext';

import Onboarding from './components/Onboarding';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <ErrorBoundary>
      <FarmProvider>
        <AppContent activeTab={activeTab} setActiveTab={setActiveTab} />
      </FarmProvider>
    </ErrorBoundary>
  );
}

function AppContent({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (tab: string) => void }) {
  const { selectedFarm } = useFarm();

  React.useEffect(() => {
    const handleNavigate = (e: any) => {
      const detail = e.detail;
      const tab = (typeof detail === 'string' ? detail : detail.page).toLowerCase();
      setActiveTab(tab);
    };
    window.addEventListener('navigate' as any, handleNavigate);
    return () => window.removeEventListener('navigate' as any, handleNavigate);
  }, [setActiveTab]);

  const renderContent = () => {
    return (
      <motion.div
        key={`${activeTab}-${selectedFarm?.id || 'none'}`}
        initial={{ opacity: 0, y: 10, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: -10, filter: 'blur(8px)' }}
        transition={{ 
          duration: 0.5, 
          ease: [0.16, 1, 0.3, 1] 
        }}
        className="w-full h-full min-h-[calc(100vh-120px)]"
      >
        {(() => {
          switch (activeTab) {
            case 'dashboard': return <Dashboard />;
            case 'inventory': return <Inventory />;
            case 'livestock': return <Livestock />;
            case 'production': return <Production />;
            case 'finance': return <Finance />;
            case 'game': return <MaasaiRunner />;
            case 'settings': return <Settings />;
            case 'feedback': return <Feedback />;
            default: return <Dashboard />;
          }
        })()}
      </motion.div>
    );
  };

  return (
    <>
      <Onboarding />
      <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
        <AnimatePresence mode="wait" initial={false}>
          {renderContent()}
        </AnimatePresence>
      </Layout>
    </>
  );
}
