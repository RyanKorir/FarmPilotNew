import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Book, HelpCircle, ChevronRight, Bird, TrendingUp, Package, Shield, Settings, Info } from 'lucide-react';

interface ManualSection {
  id: string;
  title: string;
  icon: any;
  content: string;
  tips: string[];
}

const SECTIONS: ManualSection[] = [
  {
    id: 'intro',
    title: 'Welcome to FarmPilot',
    icon: Bird,
    content: 'FarmPilot is your comprehensive digital greenhouse. Designed for precision agriculture, it helps you track every aspect of your estate from livestock health to financial growth.',
    tips: ['Use the Sidebar to navigate', 'Watch for Atmospheric Alerts on the dashboard']
  },
  {
    id: 'livestock',
    title: 'Managing Livestock',
    icon: TrendingUp,
    content: 'Register species groups (Bulk) or individual animals for detailed histories. Poultry is best managed in Bulk mode, while cattle/dairy benefit from Individual tracking.',
    tips: ['Individual tracking allows for medical history and weight monitoring', 'Certify Births for official documentation']
  },
  {
    id: 'inventory',
    title: 'Supplies & Feed',
    icon: Package,
    content: 'Keep track of your resources. The system automatically alerts you when feed or medicine stocks drop below your custom-set threshold.',
    tips: ['Set a lead-time buffer in Settings', 'Stock anomaly alerts will appear on the dashboard']
  },
  {
    id: 'security',
    title: 'Data Vault',
    icon: Shield,
    content: 'Your farm data is secured with AES-256 bit encryption. Access is authorized only to your verified account.',
    tips: ['Enable OTP for sensitive edits in Settings', 'Your data is solely yours']
  }
];

export default function HelpManual({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white rounded-[3rem] shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col"
          >
            <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#5A5A40] rounded-2xl flex items-center justify-center text-white shadow-lg shadow-[#5A5A40]/20">
                  <Book size={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-serif font-black text-gray-900">FarmPilot Manual</h3>
                  <p className="text-[10px] text-[#5A5A40] font-black uppercase tracking-widest">Digital Resource Guide v2.4</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-3 hover:bg-gray-200 rounded-full transition-colors text-gray-400"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-10 scroll-mask">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {SECTIONS.map((section) => (
                  <div key={section.id} className="p-8 rounded-[2.5rem] bg-[#F9F9F7] border border-gray-100 space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-[#5A5A40] shadow-sm">
                        <section.icon size={20} />
                      </div>
                      <h4 className="font-serif font-bold text-xl text-gray-900">{section.title}</h4>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed italic">
                      {section.content}
                    </p>
                    <div className="space-y-3 pt-4 border-t border-gray-200/50">
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#5A5A40]">Expert Tips</p>
                      {section.tips.map((tip, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#5A5A40] mt-1.5 shrink-0" />
                          <p className="text-xs text-gray-500 font-medium">{tip}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-12 p-10 bg-[#5A5A40] rounded-[3rem] text-white relative overflow-hidden group">
                <div className="relative z-10">
                  <div className="flex items-center gap-4 mb-6">
                    <Sparkles className="text-white/60" size={32} />
                    <h4 className="text-3xl font-serif font-black">Need Direct Support?</h4>
                  </div>
                  <p className="text-white/80 text-lg max-w-xl leading-relaxed mb-8">
                    Our cooperative network is always growing. If you encounter a complex issue, use the Feedback tab to send a report directly to the engineers.
                  </p>
                  <button 
                    onClick={onClose}
                    className="px-10 py-4 bg-white text-[#5A5A40] rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-100 transition-all shadow-xl"
                  >
                    Return to Estate
                  </button>
                </div>
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl transition-transform group-hover:scale-125" />
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-center">
              <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                Authorized Educational Material — Legacy Ent. 2026
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

const Sparkles = ({ className, size }: { className?: string; size?: number }) => (
  <div className={className}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" /><path d="M19 17v4" /><path d="M3 5h4" /><path d="M17 19h4" />
    </svg>
  </div>
);
