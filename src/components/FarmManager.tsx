import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreError';
import { 
  X, 
  Plus, 
  Trash2, 
  MapPin, 
  Home, 
  CheckCircle2, 
  Info,
  Save,
  Settings,
  ChevronRight,
  Edit2,
  Shield
} from 'lucide-react';

function cn(...inputs: (string | boolean | undefined)[]) {
  return inputs.filter(Boolean).join(' ');
}
import { motion, AnimatePresence } from 'motion/react';
import { Farm } from '../types';

import { useFarm } from '../context/FarmContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function FarmManager({ isOpen, onClose }: Props) {
  const { selectedFarm, setSelectedFarm } = useFarm();
  const [farms, setFarms] = useState<Farm[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingFarm, setEditingFarm] = useState<Farm | null>(null);
  const [loading, setLoading] = useState(false);
  const [newFarm, setNewFarm] = useState({
    name: '',
    location: '',
    description: ''
  });

  const [scale, setScale] = useState(1);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      // Smart scaling for TVs and ultra-wide displays
      if (width > 2500) setScale(1.5);
      else if (width > 1900) setScale(1.2);
      else setScale(1);
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const q = query(collection(db, 'farms'), where('ownerId', '==', user.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      const data: Farm[] = [];
      snapshot.forEach(doc => data.push({ ...doc.data() as Farm, id: doc.id }));
      setFarms(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'farms');
    });

    return () => unsub();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    setLoading(true);
    try {
      await addDoc(collection(db, 'farms'), {
        ...newFarm,
        ownerId: user.uid,
        createdAt: new Date().toISOString(),
        isDefault: farms.length === 0
      });
      setIsAdding(false);
      setNewFarm({ name: '', location: '', description: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'farms');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFarm) return;

    setLoading(true);
    try {
      const { id, ...data } = editingFarm;
      await updateDoc(doc(db, 'farms', id), {
        ...data,
        updatedAt: new Date().toISOString()
      });
      setEditingFarm(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `farms/${editingFarm.id}`);
    } finally {
      setLoading(false);
    }
  };

  const setDefaultFarm = async (id: string) => {
    try {
      const updates = farms.map(f => 
        updateDoc(doc(db, 'farms', f.id), { isDefault: f.id === id })
      );
      await Promise.all(updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `farms/${id}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this farm? All associated records will remain but will be unlinked.')) return;
    try {
      await deleteDoc(doc(db, 'farms', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `farms/${id}`);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] bg-[#F5F5F0] overflow-y-auto flex flex-col">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col w-full max-w-[1920px] mx-auto"
            style={{ transformOrigin: 'top center' }}
          >
            {/* Header */}
            <header className="p-6 md:p-10 bg-white border-b border-gray-100 flex items-center justify-between sticky top-0 z-[110] shadow-sm">
              <div className="flex items-center gap-6">
                <div className="w-14 h-14 bg-[#5A5A40] text-white rounded-[1.5rem] shadow-xl shadow-[#5A5A40]/30 flex items-center justify-center transform hover:scale-105 transition-transform">
                  <Home size={32} />
                </div>
                <div>
                  <h3 className="text-2xl md:text-4xl font-serif font-black text-[#1a1a1a] tracking-tight">Estate Registry</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 bg-brand/10 text-brand text-[8px] font-black uppercase tracking-widest rounded-full">Primary Hub</span>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Manage your agricultural assets</p>
                  </div>
                </div>
              </div>
              <button 
                onClick={onClose} 
                className="p-4 bg-gray-50 hover:bg-red-50 hover:text-red-500 rounded-3xl transition-all group"
              >
                <X size={24} className="group-hover:rotate-90 transition-transform" />
              </button>
            </header>

            <div className="flex-1 p-6 md:p-14 space-y-12">
              {/* Stats & Actions */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                <div className="lg:col-span-8 space-y-10">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xl md:text-2xl font-serif font-black text-[#1a1a1a]">Registered Domains</h4>
                    <button 
                      onClick={() => setIsAdding(!isAdding)}
                      className={cn(
                        "flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all shadow-xl",
                        isAdding ? "bg-gray-100 text-gray-500" : "bg-brand text-white shadow-brand/20 hover:bg-black"
                      )}
                    >
                      {isAdding ? <X size={18} /> : <Plus size={18} />}
                      {isAdding ? 'Discard Entry' : 'Register New Unit'}
                    </button>
                  </div>

                  <AnimatePresence>
                    {isAdding && (
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="bg-white rounded-[3rem] p-8 md:p-12 border-4 border-brand shadow-2xl relative overflow-hidden"
                      >
                         <div className="absolute top-0 right-0 w-64 h-64 bg-brand/5 rounded-full -mr-32 -mt-32 blur-3xl" />
                         <form onSubmit={handleAdd} className="space-y-10 relative z-10">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                               <div className="space-y-4">
                                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] ml-4">Estate Identity</label>
                                  <div className="relative">
                                    <Home className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-300" size={20} />
                                    <input 
                                      required
                                      type="text" 
                                      placeholder="e.g. Green Valley Estate"
                                      className="w-full pl-16 pr-6 py-6 bg-gray-50 rounded-[2rem] border-2 border-transparent focus:bg-white focus:border-brand outline-none transition-all font-black text-sm text-gray-900 placeholder:text-gray-200"
                                      value={newFarm.name}
                                      onChange={e => setNewFarm({...newFarm, name: e.target.value})}
                                    />
                                  </div>
                               </div>
                               <div className="space-y-4">
                                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] ml-4">Geographic Coordinates</label>
                                  <div className="relative">
                                    <MapPin className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-300" size={20} />
                                    <input 
                                      required
                                      type="text" 
                                      placeholder="e.g. Nakuru, Rift Valley"
                                      className="w-full pl-16 pr-6 py-6 bg-gray-50 rounded-[2rem] border-2 border-transparent focus:bg-white focus:border-brand outline-none transition-all font-black text-sm text-gray-900 placeholder:text-gray-200"
                                      value={newFarm.location}
                                      onChange={e => setNewFarm({...newFarm, location: e.target.value})}
                                    />
                                  </div>
                               </div>
                            </div>
                            <div className="space-y-4">
                               <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] ml-4">Operational Blueprint</label>
                               <textarea 
                                 rows={4}
                                 placeholder="Describe the primary activities of this unit..."
                                 className="w-full px-8 py-6 bg-gray-50 rounded-[2.5rem] border-2 border-transparent focus:bg-white focus:border-brand outline-none transition-all font-medium text-sm text-gray-600 resize-none"
                                 value={newFarm.description}
                                 onChange={e => setNewFarm({...newFarm, description: e.target.value})}
                               />
                            </div>
                            <div className="flex justify-end pt-4">
                               <button 
                                 type="submit"
                                 disabled={loading}
                                 className="w-full md:w-auto px-16 py-6 bg-brand text-white rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.3em] shadow-2xl shadow-brand/30 hover:bg-black transition-all flex items-center justify-center gap-4"
                               >
                                 {loading ? 'Processing Registry...' : 'Initialize Estate'}
                                 <Save size={18} />
                               </button>
                            </div>
                         </form>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="grid grid-cols-1 gap-6">
                    {farms.length > 0 ? (
                      farms.map((farm) => (
                        <motion.div 
                          key={farm.id} 
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={async () => {
                            if (selectedFarm?.id === farm.id) {
                              onClose();
                              return;
                            }
                            setSelectedFarm(farm);
                            // Brief delay for the user to see the selection before closing
                            setTimeout(onClose, 200);
                          }}
                          className={cn(
                            "bg-white fluid-card-p rounded-[3rem] border transition-all flex flex-col md:flex-row items-center gap-[clamp(1.5rem,3vw,4rem)] group cursor-pointer relative overflow-hidden",
                            selectedFarm?.id === farm.id 
                              ? 'border-brand ring-4 ring-brand/5 shadow-2xl shadow-brand/10' 
                              : 'border-gray-100 hover:border-brand/40 hover:shadow-xl'
                          )}
                        >
                           {selectedFarm?.id === farm.id && (
                             <motion.div 
                               initial={{ opacity: 0, scale: 0 }}
                               animate={{ opacity: 1, scale: 1 }}
                               className="absolute inset-0 bg-brand/5 pointer-events-none z-0"
                             />
                           )}
                           <div className={cn(
                             "w-[clamp(4rem,6vw,10rem)] h-[clamp(4rem,6vw,10rem)] rounded-[clamp(1rem,1.5vw,2.5rem)] flex items-center justify-center transition-all shrink-0",
                             selectedFarm?.id === farm.id 
                               ? 'bg-brand text-white' 
                               : 'bg-gray-50 text-gray-300 group-hover:bg-brand/10 group-hover:text-brand'
                           )}>
                             <Home size="clamp(1.5rem, 2.5vw, 4rem)" />
                           </div>
                           
                           <div className="flex-1 text-center md:text-left min-w-0">
                              <div className="flex flex-col md:flex-row items-center gap-[clamp(0.5rem,1vw,1.5rem)] mb-[clamp(0.5rem,1vw,1rem)]">
                                 <h5 className="text-fluid-2xl font-serif font-black text-[#1a1a1a] tracking-tight truncate">{farm.name}</h5>
                                 <div className="flex gap-[clamp(0.25rem,0.5vw,1rem)] shrink-0">
                                    {farm.isDefault && (
                                      <span className="px-[clamp(0.5rem,1vw,1.5rem)] py-[clamp(0.2rem,0.4vw,0.6rem)] bg-emerald-50 text-emerald-600 text-[clamp(8px,0.8vw,12px)] font-black rounded-full uppercase tracking-widest border border-emerald-100 flex items-center gap-1.5">
                                        <CheckCircle2 size="clamp(10px, 1vw, 14px)" />
                                        Default
                                      </span>
                                    )}
                                    {selectedFarm?.id === farm.id && (
                                      <span className="px-[clamp(0.5rem,1vw,1.5rem)] py-[clamp(0.2rem,0.4vw,0.6rem)] bg-brand text-white text-[clamp(8px,0.8vw,12px)] font-black rounded-full uppercase tracking-widest">Active</span>
                                    )}
                                 </div>
                              </div>
                              <p className="text-[clamp(11px,1.2vw,16px)] text-gray-400 font-bold uppercase tracking-widest flex items-center justify-center md:justify-start gap-2 truncate">
                                 <MapPin size="clamp(12px, 1.2vw, 18px)" className="text-brand shrink-0" />
                                 {farm.location}
                              </p>
                           </div>
   
                           <div className="flex items-center gap-[clamp(0.5rem,1vw,2rem)] shrink-0" onClick={e => e.stopPropagation()}>
                              {!farm.isDefault && (
                                <button 
                                  onClick={() => setDefaultFarm(farm.id)}
                                  className="px-[clamp(0.75rem,1vw,2rem)] py-[clamp(0.5rem,0.8vw,1.5rem)] bg-gray-50 hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 rounded-2xl transition-all flex items-center gap-2 border border-transparent hover:border-emerald-100 text-[clamp(8px,0.8vw,12px)] font-black uppercase tracking-widest"
                                  title="Set as Default"
                                >
                                  <Shield size="clamp(12px, 1.2vw, 20px)" />
                                  Make Default
                                </button>
                              )}
                              <button 
                                onClick={() => setEditingFarm(farm)}
                                className="w-[clamp(3rem,4.5vw,7rem)] h-[clamp(3rem,4.5vw,7rem)] bg-gray-50 hover:bg-white hover:shadow-lg text-gray-400 hover:text-brand rounded-2xl transition-all flex items-center justify-center border border-transparent hover:border-gray-100"
                              >
                                 <Edit2 size="clamp(18px, 2vw, 36px)" />
                              </button>
                              <button 
                                onClick={() => handleDelete(farm.id)}
                                className="w-[clamp(3rem,4.5vw,7rem)] h-[clamp(3rem,4.5vw,7rem)] bg-red-50 hover:bg-red-500 text-red-500 hover:text-white rounded-2xl transition-all flex items-center justify-center border border-red-100 hover:border-red-500"
                              >
                                 <Trash2 size="clamp(18px, 2vw, 36px)" />
                              </button>
                           </div>
                        </motion.div>
                      ))
                    ) : (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="bg-white/50 backdrop-blur-sm border-4 border-dashed border-gray-100 rounded-[4rem] p-16 text-center"
                      >
                        <div className="w-24 h-24 bg-white rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-sm">
                          <Home className="text-gray-200" size={48} />
                        </div>
                        <h3 className="text-3xl font-serif font-black text-gray-900 mb-4 tracking-tight">No Estates Registered</h3>
                        <p className="text-gray-400 font-medium max-w-sm mx-auto mb-10 leading-relaxed italic">
                          Your digital agriculture hub is currently empty. Register your first production unit or estate domain to begin tracking assets.
                        </p>
                        <button 
                          onClick={() => setIsAdding(true)}
                          className="px-12 py-5 bg-[#5A5A40] text-white rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.3em] hover:bg-black transition-all shadow-2xl shadow-[#5A5A40]/30 flex items-center gap-4 mx-auto"
                        >
                          <Plus size={20} />
                          Create First Domain
                        </button>
                      </motion.div>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-4 space-y-10">
                   <div className="bg-[#5A5A40] p-10 md:p-14 rounded-[3.5rem] text-white relative overflow-hidden shadow-2xl shadow-brand/30">
                      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.1),transparent)]" />
                      <Settings className="opacity-20 mb-8" size={60} />
                      <h4 className="text-4xl font-serif font-black mb-6 tracking-tight">System Configuration</h4>
                      <p className="text-white/70 leading-relaxed mb-10 text-lg">
                        Estates are strictly isolated. Switching profiles re-initializes all inventory, livestock, and financial modules for targeted management.
                      </p>
                      <div className="space-y-6">
                         <div className="flex justify-between items-center bg-black/10 p-5 rounded-2xl">
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/50">Total Assets</span>
                            <span className="text-2xl font-black">{farms.length}</span>
                         </div>
                         <div className="flex justify-between items-center bg-black/10 p-5 rounded-2xl">
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/50">Vault Status</span>
                            <span className="text-[10px] font-black uppercase tracking-widest py-1 px-3 bg-emerald-500 rounded-full">Synchronized</span>
                         </div>
                      </div>
                   </div>

                   <div className="bg-white p-10 md:p-14 rounded-[3.5rem] border border-gray-100 shadow-sm">
                      <h4 className="text-xl font-serif font-black text-gray-900 mb-8 flex items-center gap-3">
                         <Info size={24} className="text-brand" />
                         Domain Policies
                      </h4>
                      <div className="space-y-8">
                         <PolicyItem 
                           label="Identity Security" 
                           text="Estate names are unique within your profile. Avoid duplicate identifiers." 
                         />
                         <PolicyItem 
                           label="Data Migration" 
                           text="Moving records between domains requires a manual 'Asset Transfer' log entry." 
                         />
                      </div>
                   </div>
                </div>
              </div>
            </div>

            <footer className="p-8 bg-white border-t border-gray-100 flex items-center justify-between sticky bottom-0 z-[110]">
               <div className="flex items-center gap-3 text-[10px] text-gray-300 font-black uppercase tracking-[0.3em]">
                  <Shield size={14} className="text-emerald-500" />
                  GCM Cloud Protected
               </div>
               <button 
                 onClick={onClose}
                 className="px-12 py-5 bg-gray-900 text-white rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.3em] hover:bg-black transition-all shadow-xl"
               >
                 Exit Registry
               </button>
            </footer>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function PolicyItem({ label, text }: { label: string, text: string }) {
  return (
    <div className="flex gap-4">
      <div className="shrink-0 w-1.5 h-1.5 bg-brand rounded-full mt-2" />
      <div>
        <h5 className="text-[11px] font-black text-gray-900 uppercase tracking-widest mb-1">{label}</h5>
        <p className="text-xs text-gray-500 leading-relaxed font-medium">{text}</p>
      </div>
    </div>
  );
}
