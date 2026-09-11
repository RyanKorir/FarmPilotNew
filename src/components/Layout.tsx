import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, onSnapshot, getDoc, collection, query, orderBy, limit, addDoc } from 'firebase/firestore';
import { db, auth, logOut } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreError';
import type { SupabaseUser as User } from '../lib/supabaseAuth';
import Login from './Login';
import InteractiveEffects from './InteractiveEffects';
import { 
  LayoutDashboard, 
  Package, 
  Bird, 
  TrendingUp, 
  DollarSign, 
  ShoppingBag, 
  BookOpen, 
  LogOut, 
  Menu, 
  X,
  User as UserIcon,
  Settings as SettingsIcon,
  Trophy,
  Wifi,
  WifiOff,
  Home,
  ChevronDown,
  MessageSquare,
  Sparkles,
  HelpCircle,
  ShieldAlert,
  Megaphone,
  Plus,
  MapPin,
  Save,
  ChevronRight
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useFarm } from '../context/FarmContext';
import FarmManager from './FarmManager';
import ReminderDispatcher from './ReminderDispatcher';
import HelpManual from './HelpManual';
import FarmAssistant from './FarmAssistant';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Layout({ children, activeTab, setActiveTab }: LayoutProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isFarmManagerOpen, setIsFarmManagerOpen] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const { farms, selectedFarm, setSelectedFarm } = useFarm();
  const [isEstateDropdownOpen, setIsEstateDropdownOpen] = useState(false);
  const [isAddingInDropdown, setIsAddingInDropdown] = useState(false);
  const [newFarm, setNewFarm] = useState({ name: '', location: '', description: '' });
  const [addingLoading, setAddingLoading] = useState(false);

  const handleAddEstate = async () => {
    const user = auth.currentUser;
    if (!user || !newFarm.name) return;

    setAddingLoading(true);
    try {
      const docRef = await addDoc(collection(db, 'farms'), {
        ...newFarm,
        ownerId: user.uid,
        createdAt: new Date().toISOString(),
        isDefault: farms.length === 0
      });
      
      setIsAddingInDropdown(false);
      setIsEstateDropdownOpen(false);
      setNewFarm({ name: '', location: '', description: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'farms');
    } finally {
      setAddingLoading(false);
    }
  };

  useEffect(() => {
    // Also listen for assistant navigation event
    const handleToggleAssistant = () => setIsAssistantOpen(prev => !prev);
    window.addEventListener('toggle-assistant', handleToggleAssistant);
    return () => window.removeEventListener('toggle-assistant', handleToggleAssistant);
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const docSnap = await getDoc(doc(db, 'settings', user.uid));
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.theme === 'midnight') {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
      } catch (error) {
        console.error("Error fetching theme:", error);
      }
    };
    fetchSettings();
  }, [activeTab]); // Re-check on tab changes or periodically

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      setUser(u);
      setLoading(false);

      // After a Google OAuth redirect, create the user profile if it doesn't exist yet
      if (u) {
        try {
          const userRef = doc(db, 'users', u.uid);
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              email: u.email,
              name: u.displayName || u.email?.split('@')[0] || 'Farmer',
              photoURL: u.photoURL,
              role: 'user',
              provider: u.providerData?.[0]?.providerId || 'email',
              createdAt: new Date().toISOString(),
            });
            await setDoc(doc(db, 'settings', u.uid), {
              authSettings: { otpMethod: 'email', requireAuthForEdits: true },
              updatedAt: new Date().toISOString(),
            }, { merge: true });
          }
        } catch (err) {
          console.error('Profile init error:', err);
        }
      }
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const [userData, setUserData] = useState<any>(null);
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [dismissedBroadcasts, setDismissedBroadcasts] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'broadcasts'), orderBy('createdAt', 'desc'), limit(1));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setBroadcasts(data);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setUserData(null);
      return;
    }
    const unsub = onSnapshot(doc(db, 'users', user.uid), (doc) => {
      if (doc.exists()) {
        setUserData(doc.data());
      }
    });
    return () => unsub();
  }, [user]);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'livestock', label: 'Livestock Records', icon: Bird },
    { id: 'production', label: 'Production Logs', icon: TrendingUp },
    { id: 'inventory', label: 'Feed & Supplies', icon: Package },
    { id: 'finance', label: 'Finances', icon: DollarSign },
    { id: 'game', label: 'Maasai Runner', icon: Trophy },
    { id: 'feedback', label: 'Suggest Innovation', icon: MessageSquare },
    { id: 'settings', label: 'Account Settings', icon: SettingsIcon },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-warm-bg)] flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative"
        >
          <div className="w-20 h-20 border-4 border-brand/20 border-t-brand rounded-full animate-spin" />
          <Bird className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-brand w-8 h-8" />
        </motion.div>
        <motion.p 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-6 text-brand font-serif italic text-lg"
        >
          Tend to your farm...
        </motion.p>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-[var(--color-warm-bg)] flex selection:bg-brand/20">
      <InteractiveEffects />
      <ReminderDispatcher selectedFarmId={selectedFarm?.id || null} />
      
      {/* Sidebar for Desktop */}
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-56 bg-[#151614] text-white transition-all duration-500 ease-in-out lg:relative lg:translate-x-0 border-r border-white/5",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="h-full flex flex-col p-4 overflow-y-auto custom-scrollbar">
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2.5 mb-8 cursor-pointer select-none group"
          >
            <div className="w-8 h-8 bg-[#5A5A40] rounded-lg flex items-center justify-center transition-all group-hover:rotate-6 duration-500 shadow-xl shadow-brand/10">
              <Bird className="text-white w-5 h-5" />
            </div>
            <div>
              <span className="text-lg font-serif font-black tracking-tight block">FarmPilot</span>
              <span className="text-[7px] text-brand uppercase font-black tracking-[0.3em] block opacity-80">Premium</span>
            </div>
          </motion.div>

          <nav className="flex-1 space-y-0.5">
            {navItems.map((item, idx) => (
              <motion.button
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + idx * 0.05 }}
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsSidebarOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all duration-500 group relative overflow-hidden",
                  activeTab === item.id 
                    ? "bg-brand text-white shadow-lg shadow-brand/20" 
                    : "text-gray-500 hover:text-white hover:bg-white/[0.02]"
                )}
              >
                <item.icon size={14} className={cn(
                  "transition-all duration-500",
                  activeTab === item.id ? "scale-110" : "group-hover:scale-110 group-hover:rotate-3"
                )} />
                <span className="font-semibold text-[10px] tracking-wide">{item.label}</span>
                {activeTab === item.id && (
                  <motion.div 
                    layoutId="activeTabBadge"
                    className="absolute inset-0 bg-white/2"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.8 }}
                  />
                )}
              </motion.button>
            ))}
          </nav>

          <div className="mt-4 pt-4 border-t border-white/5">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="bg-white/3 rounded-xl p-3 mb-4 border border-white/5"
            >
              <div className="flex items-center gap-2.5 mb-3">
                <div className="relative">
                  <img 
                    src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}&background=5A5A40&color=fff`} 
                    alt="Profile" 
                    className="w-8 h-8 rounded-lg object-cover ring-2 ring-brand/10 shadow-lg"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#151614] rounded-full" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black truncate leading-tight tracking-tight">{user.displayName}</p>
                  <p className="text-[7px] text-gray-500 truncate mt-0.5 font-bold uppercase tracking-widest">{user.email?.split('@')[0]}</p>
                </div>
              </div>
              <button
                onClick={logOut}
                className="w-full flex items-center justify-center gap-1.5 py-2 bg-red-500/10 text-red-400 hover:bg-red-500 text-[7px] font-black uppercase tracking-widest rounded-md transition-all hover:text-white"
              >
                <LogOut size={10} />
                Logout
              </button>
            </motion.div>

            <div className="text-center opacity-20">
              <p className="text-[8px] font-black text-gray-400 uppercase tracking-[0.4em]">
                V2.4.0
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Header */}
        <header className="h-12 bg-white/95 backdrop-blur-xl border-b border-gray-100 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-[40] shadow-sm">
          <div className="flex items-center gap-3">
            <button 
              className="lg:hidden p-1.5 text-brand bg-brand/10 rounded-lg"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu size={16} />
            </button>
            
            <div className="hidden sm:flex flex-col">
              <motion.h2 
                key={activeTab}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-base font-serif font-black text-gray-900 leading-tight tracking-tight"
              >
                {navItems.find(i => i.id === activeTab)?.label}
              </motion.h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className={cn(
                  "w-1 h-1 rounded-full",
                  isOnline ? "bg-emerald-500" : "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                )} />
                <span className={cn(
                  "text-[7px] uppercase font-black tracking-widest",
                  isOnline ? "text-gray-400" : "text-amber-600"
                )}>
                  {isOnline ? "GRID SYNCED" : "OFFLINE"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Estate Registry Dropdown */}
            <div className="relative">
              <AnimatePresence mode="wait">
                {selectedFarm ? (
                  <motion.div 
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="hidden md:block"
                  >
                    <button 
                      onClick={() => setIsEstateDropdownOpen(!isEstateDropdownOpen)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 bg-[#F9F9F7] hover:bg-white hover:shadow-lg hover:shadow-brand/5 rounded-lg border transition-all group",
                        isEstateDropdownOpen ? "border-brand border bg-white" : "border-gray-100"
                      )}
                    >
                      <div className="w-6 h-6 bg-brand text-white rounded-md flex items-center justify-center transition-transform group-hover:scale-105">
                        <Home size={12} style={{ backgroundColor: '#5A5A40' }} />
                      </div>
                      <div className="text-left">
                        <p className="text-[10px] font-black text-gray-900 leading-none truncate max-w-[100px]">{selectedFarm.name}</p>
                      </div>
                      <ChevronDown className={cn("text-gray-300 ml-1 transition-transform", isEstateDropdownOpen && "rotate-180")} size={10} />
                    </button>
                  </motion.div>
                ) : (
                  <motion.button 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={() => setIsEstateDropdownOpen(!isEstateDropdownOpen)}
                    className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white rounded-lg font-black text-[8px] uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-brand/10"
                  >
                    <Home size={12} />
                    Register
                    <ChevronDown className={cn("transition-transform", isEstateDropdownOpen && "rotate-180")} size={10} />
                  </motion.button>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {isEstateDropdownOpen && (
                  <>
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-[45]"
                      onClick={() => setIsEstateDropdownOpen(false)}
                    />
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-100 z-[50] overflow-hidden"
                    >
                      <div className="p-4">
                         <div className="flex items-center justify-between mb-4">
                            <div>
                               <h3 className="text-sm font-serif font-black text-gray-900 leading-none">Registry</h3>
                               <p className="text-[7px] text-brand font-black uppercase tracking-widest mt-1">Assets</p>
                            </div>
                            <button 
                              onClick={() => setIsAddingInDropdown(!isAddingInDropdown)}
                              className="p-1.5 bg-brand/5 text-brand rounded-lg hover:bg-brand hover:text-white transition-all group"
                            >
                              {isAddingInDropdown ? <X size={12} /> : <Plus size={12} className="group-hover:rotate-90 transition-transform" />}
                            </button>
                         </div>

                         <AnimatePresence mode="wait">
                            {isAddingInDropdown ? (
                               <motion.div 
                                 key="add-form"
                                 initial={{ opacity: 0, height: 0 }}
                                 animate={{ opacity: 1, height: 'auto' }}
                                 exit={{ opacity: 0, height: 0 }}
                                 className="space-y-3"
                               >
                                  <div className="space-y-2">
                                     <div className="space-y-1">
                                        <label className="text-[7px] font-black text-gray-400 uppercase tracking-widest ml-2">Identity</label>
                                        <input 
                                          type="text" 
                                          placeholder="Estate Name"
                                          className="w-full px-3 py-2 bg-gray-50 rounded-lg border border-transparent focus:bg-white focus:border-brand outline-none transition-all font-black text-[10px] text-gray-900"
                                          value={newFarm.name}
                                          onChange={e => setNewFarm({...newFarm, name: e.target.value})}
                                        />
                                     </div>
                                  </div>
                                  <button 
                                    onClick={handleAddEstate}
                                    disabled={addingLoading || !newFarm.name}
                                    className="w-full py-2 bg-brand text-white rounded-lg font-black text-[8px] uppercase tracking-widest shadow-lg shadow-brand/10 hover:bg-black transition-all flex items-center justify-center gap-1.5"
                                  >
                                    {addingLoading ? '...' : 'Register'}
                                    <Save size={12} />
                                  </button>
                               </motion.div>
                            ) : (
                               <motion.div 
                                 key="list"
                                 initial={{ opacity: 0 }}
                                 animate={{ opacity: 1 }}
                                 exit={{ opacity: 0 }}
                                 className="max-h-[200px] overflow-y-auto custom-scrollbar space-y-1.5 pr-1"
                               >
                                  {farms.map(farm => (
                                     <button 
                                       key={farm.id}
                                       onClick={() => {
                                         setSelectedFarm(farm);
                                         setIsEstateDropdownOpen(false);
                                       }}
                                       className={cn(
                                         "w-full flex items-center gap-2.5 p-2 rounded-lg border transition-all text-left group relative",
                                         selectedFarm?.id === farm.id 
                                           ? "bg-brand/5 border-brand/20 shadow-inner" 
                                           : "border-gray-50 hover:bg-gray-50"
                                       )}
                                     >
                                        <div className={cn(
                                          "w-7 h-7 rounded-md flex items-center justify-center transition-all",
                                          selectedFarm?.id === farm.id ? "bg-brand text-white" : "bg-white text-gray-300 group-hover:bg-brand/10 group-hover:text-brand"
                                        )}>
                                           <Home size={14} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                           <p className="text-[10px] font-black text-gray-900 truncate leading-none uppercase tracking-tight">{farm.name}</p>
                                        </div>
                                     </button>
                                  ))}
                               </motion.div>
                            )}
                         </AnimatePresence>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <div className="hidden xl:flex flex-col items-end border-l border-gray-100 pl-3 h-6 justify-center">
              <span className="text-[7px] text-gray-400 uppercase tracking-widest font-black leading-none mb-0.5">Date</span>
              <span className="text-[10px] font-black text-gray-900 leading-none">
                {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
            
            <div className="flex items-center gap-1.5">
              <button 
                onClick={() => setIsHelpOpen(true)}
                className="p-1.5 bg-brand/5 text-brand rounded-lg hover:bg-brand hover:text-white transition-all"
              >
                <HelpCircle size={14} />
              </button>

              <button 
                onClick={() => setIsAssistantOpen(true)}
                className="p-1.5 bg-brand/5 text-brand rounded-lg hover:bg-brand hover:text-white transition-all shadow-sm"
              >
                <Sparkles size={14} />
              </button>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-[var(--color-warm-bg)]">
          <div className="max-w-[1700px] 2xl:max-w-[2200px] mx-auto p-3 md:p-4 lg:p-6 min-h-full flex flex-col">
            <AnimatePresence>
               {broadcasts.filter(b => !dismissedBroadcasts.includes(b.id)).map(b => (
                 <motion.div 
                   key={b.id}
                   initial={{ opacity: 0, y: -20 }}
                   animate={{ opacity: 1, y: 0 }}
                   exit={{ opacity: 0, scale: 0.95 }}
                   className="mb-8 p-6 bg-[#8B4513] text-white rounded-[2rem] shadow-xl relative overflow-hidden group border border-white/10"
                 >
                    <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
                       <Megaphone size={64} />
                    </div>
                    <div className="relative z-10 flex items-start justify-between">
                       <div className="flex gap-5">
                          <div className="p-3 bg-white/20 rounded-2xl flex-shrink-0">
                             <Megaphone size={24} />
                          </div>
                          <div>
                             <h4 className="text-lg font-serif font-black uppercase tracking-tight">{b.heading}</h4>
                             <p className="text-white/80 text-sm mt-1 max-w-2xl">{b.message}</p>
                          </div>
                       </div>
                       <button 
                         onClick={() => setDismissedBroadcasts(prev => [...prev, b.id])}
                         className="p-2 hover:bg-white/10 rounded-full transition-all"
                       >
                          <X size={18} />
                       </button>
                    </div>
                 </motion.div>
               ))}
            </AnimatePresence>

            {selectedFarm ? children : (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="h-[70vh] flex flex-col items-center justify-center text-center space-y-10"
              >
                <div className="relative">
                  <div className="w-32 h-32 bg-brand/10 text-brand rounded-[2.5rem] flex items-center justify-center animate-pulse">
                    <Home size={56} />
                  </div>
                  <div className="absolute -top-4 -right-4 w-12 h-12 bg-white rounded-2xl shadow-xl flex items-center justify-center text-brand">
                    <Sparkles size={24} />
                  </div>
                </div>
                <div className="max-w-md">
                  <h3 className="text-4xl font-serif font-bold text-gray-900">Establish your Estate</h3>
                  <p className="text-gray-500 mt-4 text-lg leading-relaxed font-medium">To begin your agricultural journey, please select or register a farm profile.</p>
                </div>
                <button 
                  onClick={() => {
                    setIsEstateDropdownOpen(true);
                    setIsAddingInDropdown(true);
                  }}
                  className="px-12 py-6 bg-brand text-white rounded-[2.5rem] font-black text-[11px] uppercase tracking-[0.3em] hover:bg-black hover:scale-105 transition-all shadow-2xl shadow-brand/30 flex items-center gap-4 group"
                >
                  <Home className="group-hover:scale-110 transition-transform" />
                  Initialize Registry
                  <ChevronDown className="group-hover:translate-y-1 transition-transform" />
                </button>
              </motion.div>
            )}
          </div>

          <footer className="py-12 px-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.4em]">
            Legacy Ent. — RYAN KORIR @2026
          </footer>
        </div>

        <FarmManager isOpen={isFarmManagerOpen} onClose={() => setIsFarmManagerOpen(false)} />
        <HelpManual isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
        <FarmAssistant isOpen={isAssistantOpen} onClose={() => setIsAssistantOpen(false)} />
      </main>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
