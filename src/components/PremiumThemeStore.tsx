import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, CreditCard, Check, Crown, Paintbrush, Zap, Droplets, CloudRain, Star, ShieldCheck, ChevronRight } from 'lucide-react';

interface ThemeItem {
  id: string;
  name: string;
  description: string;
  price: string;
  features: string[];
  icon: any;
  color: string;
  premium: boolean;
}

const THEMES: ThemeItem[] = [
  {
    id: 'heritage',
    name: 'Heritage Light',
    description: 'The standard classic layout. Optimized for daily estate management.',
    price: 'Free',
    features: ['Standard Icons', 'Standard Spacing', 'Basic Animations'],
    icon: Sparkles,
    color: 'bg-gray-100 text-[#5A5A40]',
    premium: false
  },
  {
    id: 'midnight',
    name: 'Midnight Estate',
    description: 'A deep, midnight-black theme designed for night-time reviews.',
    price: '$4.99/mo',
    features: ['OLED True Black', 'Soft Amber Accents', 'Reduced Eye Strain'],
    icon: Zap,
    color: 'bg-black text-amber-500',
    premium: true
  },
  {
    id: 'storm',
    name: 'Atmospheric Storm',
    description: 'Backgrounds that adapt to the current weather with raining droplet effects.',
    price: '$6.99/mo',
    features: ['Dynamic BG Effects', 'Glassmorphism UI', 'Custom Weather Icons'],
    icon: Droplets,
    color: 'bg-blue-500 text-white',
    premium: true
  },
  {
    id: 'handwritten',
    name: 'Artisan Manual',
    description: 'A creative UI with handwritten fonts and soft, paper-like textures.',
    price: '$9.99/mo',
    features: ['Custom Fonts', 'Sketch-style Icons', 'Unique Transitions'],
    icon: Paintbrush,
    color: 'bg-orange-100 text-orange-900',
    premium: true
  }
];

const PLANS = [
  {
    name: "Seedling",
    price: "Free",
    period: "Forever",
    features: ["Standard Light/Dark Mode", "Basic Onboarding", "Community Hub Access"],
    accent: "bg-gray-100 text-gray-500"
  },
  {
    name: "Estate Pro",
    price: "$9.99",
    period: "/month",
    features: ["All Luxury Themes", "Atmospheric Storm VFX", "Dynamic Icon Scaling", "Priority Support Desk"],
    accent: "bg-[#5A5A40] text-white",
    popular: true
  },
  {
    name: "Legacy Enterprise",
    price: "$24.90",
    period: "/month",
    features: ["White-label Reports", "Unlimited Estate Vaults", "Advanced AI Logistics", "Custom Animation Store"],
    accent: "bg-amber-500 text-white"
  }
];

export default function PremiumThemeStore({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [view, setView] = useState<'themes' | 'plans'>('themes');

  // Masked contact for security
  const CONTACT_ID = "0790***791";

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white rounded-[3.5rem] shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-10 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-[#5A5A40]/5 to-transparent">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 bg-[#5A5A40] rounded-[1.5rem] flex items-center justify-center text-white shadow-xl shadow-[#5A5A40]/20">
                  <Crown size={28} />
                </div>
                <div>
                  <h3 className="text-3xl font-serif font-black text-gray-900">Legacy Commerce</h3>
                  <p className="text-[10px] text-[#5A5A40] font-black uppercase tracking-[0.25em]">Premium Appearance & Logistics</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex bg-gray-100 p-1 rounded-2xl">
                  <button 
                    onClick={() => setView('themes')}
                    className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'themes' ? 'bg-white shadow-sm text-[#5A5A40]' : 'text-gray-400'}`}
                  >
                    Themes
                  </button>
                  <button 
                    onClick={() => setView('plans')}
                    className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'plans' ? 'bg-white shadow-sm text-[#5A5A40]' : 'text-gray-400'}`}
                  >
                    Plans
                  </button>
                </div>
                <button 
                  onClick={onClose}
                  className="p-4 hover:bg-gray-100 rounded-full transition-colors text-gray-400"
                >
                  <X size={28} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-10 scroll-mask">
              {!showCheckout ? (
                <>
                  {view === 'themes' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {THEMES.map((theme) => (
                        <motion.div 
                          key={theme.id}
                          whileHover={{ y: -5 }}
                          className={`p-8 rounded-[3rem] border-2 transition-all cursor-pointer relative group ${
                            selectedTheme === theme.id ? 'border-[#5A5A40] bg-[#5A5A40]/5' : 'border-gray-100 hover:border-gray-200'
                          }`}
                          onClick={() => setSelectedTheme(theme.id)}
                        >
                          {theme.premium && (
                            <div className="absolute top-6 right-6 px-3 py-1 bg-[#5A5A40] text-white text-[8px] font-black uppercase tracking-widest rounded-full">
                              Premium
                            </div>
                          )}
                          
                          <div className="flex items-start gap-5 mb-6">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm ${theme.color}`}>
                              <theme.icon size={28} />
                            </div>
                            <div>
                              <h4 className="text-2xl font-serif font-black text-gray-900">{theme.name}</h4>
                              <p className="text-sm text-gray-500 mt-1">{theme.price}</p>
                            </div>
                          </div>

                          <p className="text-sm text-gray-600 leading-relaxed mb-6 italic">
                            "{theme.description}"
                          </p>

                          <div className="space-y-3">
                            {theme.features.map((feature, i) => (
                              <div key={i} className="flex items-center gap-3">
                                <Check size={14} className="text-[#5A5A40]" />
                                <span className="text-xs font-bold text-gray-500">{feature}</span>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      {PLANS.map((plan, i) => (
                        <div key={i} className={`p-10 rounded-[3rem] border-2 flex flex-col justify-between relative group ${plan.popular ? 'border-[#5A5A40] bg-[#5A5A40]/5' : 'border-gray-100'}`}>
                          {plan.popular && (
                             <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-1.5 bg-[#5A5A40] text-white text-[8px] font-black uppercase tracking-widest rounded-full">
                               Most Popular Plan
                             </div>
                          )}
                          <div>
                            <div className={`w-12 h-12 ${plan.accent} rounded-2xl flex items-center justify-center mb-8 shadow-lg`}>
                               <Zap size={24} />
                            </div>
                            <h4 className="text-3xl font-serif font-black text-gray-900 mb-2">{plan.name}</h4>
                            <div className="flex items-baseline gap-1 mb-8">
                               <span className="text-4xl font-serif font-black text-gray-900">{plan.price}</span>
                               <span className="text-gray-400 text-sm font-bold">{plan.period}</span>
                            </div>
                            <div className="space-y-4 mb-12">
                               {plan.features.map((f, j) => (
                                 <div key={j} className="flex items-center gap-3">
                                   <div className="w-1.5 h-1.5 rounded-full bg-[#5A5A40]" />
                                   <span className="text-xs font-bold text-gray-600">{f}</span>
                                 </div>
                               ))}
                            </div>
                          </div>
                          <button 
                            onClick={() => setShowCheckout(true)}
                            className={`w-full py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${plan.popular ? 'bg-[#5A5A40] text-white shadow-xl' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                          >
                            Select Plan
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-12 flex justify-center">
                    <button 
                      disabled={view === 'plans' ? false : (!selectedTheme || selectedTheme === 'heritage')}
                      onClick={() => setShowCheckout(true)}
                      className="px-12 py-5 bg-[#5A5A40] text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-[#4A4A30] transition-all shadow-2xl shadow-[#5A5A40]/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
                    >
                      <Sparkles size={16} />
                      {view === 'themes' ? 'Upgrade My Experience' : 'Confirm Membership'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="max-w-xl mx-auto py-10 text-center">
                  <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-xl">
                    <ShieldCheck size={48} />
                  </div>
                  <h4 className="text-3xl font-serif font-black text-gray-900 mb-4">Secure Subscription</h4>
                  <p className="text-gray-500 text-lg leading-relaxed mb-10">
                    To activate your monthly membership and unlock all premium aesthetic features, please reach out to our estate authorization desk.
                  </p>
                  
                  <div className="p-8 bg-gray-50 rounded-[2.5rem] border border-gray-100 mb-10">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">Authorization Reference</p>
                    <p className="text-2xl font-mono font-bold text-[#5A5A40]">FP-AUTH-{CONTACT_ID}</p>
                  </div>

                  <div className="flex flex-col gap-4">
                    <button 
                      onClick={() => setShowCheckout(false)}
                      className="w-full py-4 border-2 border-gray-100 text-gray-400 rounded-2xl font-bold hover:bg-gray-50 transition-all"
                    >
                      Browse More Themes
                    </button>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                      Subscription terms apply. Cancel anytime.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-8 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-400">
                <Star size={14} className="text-amber-400" />
                <span className="text-[10px] font-black uppercase tracking-widest">Legacy Membership Program</span>
              </div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                © 2026 Legacy Industries
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
