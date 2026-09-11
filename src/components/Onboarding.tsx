import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, X, ChevronRight, ChevronLeft, Bird, Activity, TrendingUp, ShieldCheck, Heart, Droplets, Zap } from 'lucide-react';

interface Step {
  title: string;
  description: string;
  icon: any;
  color: string;
}

const STEPS: Step[] = [
  {
    title: "Welcome to FarmPilot",
    description: "Your digital greenhouse. This guide uses example scenarios—any records created during the tour are not saved to your actual vault.",
    icon: Bird,
    color: "bg-blue-50 text-blue-500"
  },
  {
    title: "Inventory & Assets",
    description: "Start by registering your livestock and supplies. Groups like poultry can be managed in bulk to save time.",
    icon: Activity,
    color: "bg-amber-50 text-amber-500"
  },
  {
    title: "Daily Logistics",
    description: "Use the 'Quick Log' button anywhere to record egg counts, milk yields, or health checks in seconds.",
    icon: TrendingUp,
    color: "bg-emerald-50 text-emerald-500"
  },
  {
    title: "Data Privacy First",
    description: "Your records are encrypted with AES-256 standards. No one—not even the developers—can access your sensitive data.",
    icon: ShieldCheck,
    color: "bg-purple-50 text-purple-500"
  },
  {
    title: "Community Growth",
    description: "Share tips in the Knowledge Hub or send feedback with screenshots. We grow better when we grow together.",
    icon: Heart,
    color: "bg-red-50 text-red-500"
  },
  {
    title: "Finance & Market",
    description: "The Finance tab is your farm's wallet. It tracks sales and expenses. Don't worry, the 'Quick Log' handles the math for you.",
    icon: TrendingUp,
    color: "bg-emerald-100 text-emerald-600"
  },
  {
    title: "Atmospheric Alerts",
    description: "The dashboard shows 'Local Outlook'. This is your early warning system for rain or heat that could affect your herds.",
    icon: Droplets,
    color: "bg-blue-100 text-blue-600"
  },
  {
    title: "Heritage Themes",
    description: "Personalize your dashboard in Settings. You can even unlock dynamic backgrounds from the Aesthetic Store.",
    icon: Zap,
    color: "bg-[#5A5A40]/10 text-[#5A5A40]"
  },
  {
    title: "The Knowledge Hub",
    description: "A library for the modern farmer. Read research, watch tutorials, and see what other experts are doing in the field.",
    icon: BookOpen,
    color: "bg-purple-100 text-purple-600"
  },
  {
    title: "Farm Estate Manager",
    description: "Switch between different farms or properties using the selector at the top. Each farm has its own independent records and vault.",
    icon: Activity,
    color: "bg-orange-100 text-orange-600"
  },
  {
    title: "Support & Feedback",
    description: "Got a bug or a great idea? Use the Feedback tab. Engineers are monitoring this 24/7 to keep your estate running smooth.",
    icon: Heart,
    color: "bg-pink-100 text-pink-600"
  }
];

export default function Onboarding() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('farmpilot_onboarding_v2');
    if (!hasSeenOnboarding) {
      const timer = setTimeout(() => setIsOpen(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem('farmpilot_onboarding_v2', 'true');
    setIsOpen(false);
  };

  const nextStep = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleClose();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white rounded-[3rem] shadow-2xl w-full max-w-xl overflow-hidden relative"
          >
            <button 
              onClick={handleClose}
              className="absolute top-8 right-8 p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 z-10"
            >
              <X size={20} />
            </button>

            <div className="p-12">
              <div className="flex flex-col items-center text-center">
                <motion.div 
                  key={currentStep}
                  initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  className={`w-24 h-24 rounded-[2rem] flex items-center justify-center mb-10 shadow-xl shadow-gray-100 ${STEPS[currentStep].color}`}
                >
                  {React.createElement(STEPS[currentStep].icon, { size: 48 })}
                </motion.div>

                <motion.h3 
                  key={`title-${currentStep}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-3xl font-serif font-black text-gray-900 mb-6"
                >
                  {STEPS[currentStep].title}
                </motion.h3>

                <motion.p 
                  key={`desc-${currentStep}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-gray-500 text-lg leading-relaxed max-w-sm"
                >
                  {STEPS[currentStep].description}
                </motion.p>
              </div>

              <div className="mt-12 flex flex-col gap-6">
                <div className="flex justify-center gap-2">
                  {STEPS.map((_, i) => (
                    <div 
                      key={i}
                      className={`h-1.5 rounded-full transition-all duration-500 ${
                        i === currentStep ? 'w-8 bg-[#5A5A40]' : 'w-2 bg-gray-100'
                      }`}
                    />
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <button 
                    onClick={prevStep}
                    disabled={currentStep === 0}
                    className="p-4 rounded-2xl text-gray-400 hover:bg-gray-50 transition-all disabled:opacity-0"
                  >
                    <ChevronLeft size={24} />
                  </button>

                  <button 
                    onClick={nextStep}
                    className="flex-1 max-w-[240px] py-4 bg-[#5A5A40] text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-[#4A4A30] shadow-xl shadow-[#5A5A40]/20 flex items-center justify-center gap-3 group"
                  >
                    {currentStep === STEPS.length - 1 ? 'Start Farming' : 'Next Lesson'}
                    <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            </div>

            {/* Decorative base */}
            <div className="h-2 bg-[#5A5A40]/5" />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
