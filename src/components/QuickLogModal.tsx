import React, { useState } from 'react';
import { X, Bird, TrendingUp, DollarSign, Package, AlertCircle, ChevronRight, HeartPulse, Activity, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../firebase';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../utils/firestoreError';
import { format } from 'date-fns';
import { useFarm } from '../context/FarmContext';
import { IndividualLivestock, AnimalHealthRecord, AnimalVaccination } from '../types';
import { ANIMAL_PRODUCTS, PRODUCT_UNITS } from '../constants';

interface QuickLogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type LogType = 'livestock' | 'production' | 'finance' | 'health';

export default function QuickLogModal({ isOpen, onClose }: QuickLogModalProps) {
  const { selectedFarm } = useFarm();
  const [activeType, setActiveType] = useState<LogType>('production');
  const [loading, setLoading] = useState(false);
  const [showNotification, setShowNotification] = useState<{ show: boolean; count: number; species: string; groupId: string }>({ show: false, count: 0, species: '', groupId: '' });
  const [animals, setAnimals] = useState<IndividualLivestock[]>([]);

  // Form States
  const [production, setProduction] = useState({ type: 'Milk', quantity: 0, unit: 'Liters', date: format(new Date(), 'yyyy-MM-dd') });
  const [finance, setFinance] = useState({ type: 'income' as 'income' | 'expense', amount: 0, category: 'Sales', description: '', date: format(new Date(), 'yyyy-MM-dd') });
  const [livestock, setLivestock] = useState({ type: 'Cow', count: 0, ageGroup: 'Calves', healthStatus: 'Healthy' });
  const [health, setHealth] = useState({ 
    animalId: '', 
    logType: 'status' as 'status' | 'vaccination' | 'checkup',
    status: 'Healthy' as IndividualLivestock['healthStatus'],
    vaccineName: '',
    nextDueDate: '',
    notes: '',
    date: format(new Date(), 'yyyy-MM-dd')
  });

  React.useEffect(() => {
    if (isOpen && selectedFarm && auth.currentUser) {
      const q = query(
        collection(db, 'individual_livestock'),
        where('ownerId', '==', auth.currentUser.uid),
        where('farmId', '==', selectedFarm.id)
      );
      getDocs(q).then(snap => {
        const data: IndividualLivestock[] = [];
        snap.forEach(d => data.push({ ...d.data(), id: d.id } as IndividualLivestock));
        setAnimals(data);
        if (data.length > 0 && !health.animalId) {
            setHealth(prev => ({ ...prev, animalId: data[0].id }));
        }
      }).catch(err => console.error("Error fetching animals for quick log:", err));
    }
  }, [isOpen, selectedFarm?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user || !selectedFarm) return;

    setLoading(true);
    try {
      if (activeType === 'production') {
        await addDoc(collection(db, 'production'), { ...production, ownerId: user.uid, farmId: selectedFarm.id, createdAt: new Date().toISOString() });
      } else if (activeType === 'finance') {
        await addDoc(collection(db, 'transactions'), { ...finance, ownerId: user.uid, farmId: selectedFarm.id, createdAt: new Date().toISOString() });
      } else if (activeType === 'livestock') {
        const q = query(
          collection(db, 'individual_livestock'),
          where('ownerId', '==', user.uid),
          where('farmId', '==', selectedFarm.id),
          where('species', '==', livestock.type)
        );
        const snap = await getDocs(q);
        
        // Create the bulk summary record
        const bulkDoc = await addDoc(collection(db, 'livestock'), { 
          ...livestock, 
          ownerId: user.uid, 
          farmId: selectedFarm.id, 
          lastUpdated: new Date().toISOString() 
        });

        // CRITICAL FIX: Create incomplete individual records to match the bulk count
        // This prevents the "count vs records" inconsistency
        const largeAnimals = ['Cow', 'Goat', 'Sheep', 'Pig', 'Camel', 'Donkey'];
        const isLargeAnimal = largeAnimals.includes(livestock.type);

        if (livestock.count > 0) {
          const promises = [];
          const currentCount = snap.size;
          // Cap at 20 for quick log placeholders
          const batchSize = Math.min(livestock.count, 20);
          for (let i = 0; i < batchSize; i++) {
            promises.push(addDoc(collection(db, 'individual_livestock'), {
              groupId: bulkDoc.id,
              name: `${livestock.type} #${currentCount + i + 1}`,
              species: livestock.type,
              type: livestock.type, // Added type for consistency
              status: 'incomplete', // Marked as incomplete for later full registration
              ownerId: user.uid,
              farmId: selectedFarm.id,
              registrationProgress: 20, 
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              healthStatus: 'Healthy'
            }));
          }
          await Promise.all(promises);
        }

        if (isLargeAnimal && livestock.count > 0) {
          // Auto-navigate for large animals if count > 0
          onClose();
          localStorage.setItem('targetGroupId', bulkDoc.id);
          window.dispatchEvent(new CustomEvent('navigate', { 
            detail: { 
              page: 'Livestock', 
              species: livestock.type 
            } 
          }));
        } else {
          setShowNotification({ show: true, count: livestock.count, species: livestock.type, groupId: bulkDoc.id });
        }
      } else if (activeType === 'health') {
        if (!health.animalId) throw new Error("Please select an animal");
        
        if (health.logType === 'status') {
           await updateDoc(doc(db, 'individual_livestock', health.animalId), {
             healthStatus: health.status,
             notes: health.notes
           });
           // Also add a health record for history
           await addDoc(collection(db, 'animal_health'), {
             animalId: health.animalId,
             type: 'Check-up',
             date: health.date,
             notes: `Quick Status Update: ${health.status}. ${health.notes}`,
             bodyCondition: 'Updated via Quick Log',
             ownerId: user.uid,
             createdAt: serverTimestamp()
           });
        } else if (health.logType === 'vaccination') {
            await addDoc(collection(db, 'animal_vaccinations'), {
                animalId: health.animalId,
                vaccineName: health.vaccineName,
                dateGiven: health.date,
                nextDueDate: health.nextDueDate || null,
                notes: health.notes,
                ownerId: user.uid,
                createdAt: serverTimestamp()
            });
            if (health.nextDueDate) {
                await updateDoc(doc(db, 'individual_livestock', health.animalId), {
                    nextVaccinationDate: health.nextDueDate
                });
            }
        } else if (health.logType === 'checkup') {
            await addDoc(collection(db, 'animal_health'), {
                animalId: health.animalId,
                type: 'Check-up',
                date: health.date,
                notes: health.notes,
                ownerId: user.uid,
                createdAt: serverTimestamp()
            });
        }
      }

      if (!showNotification.show && (activeType !== 'livestock' || !livestock.count)) {
          onClose();
      }
      
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, activeType);
    } finally {
      if (!showNotification.show) setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-[#FDFDFC] w-full max-w-lg rounded-[3rem] overflow-hidden shadow-2xl border border-brand/10"
          >
            <div className="p-10">
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h3 className="text-3xl font-serif font-black text-gray-900 tracking-tight">Agricultural Brief</h3>
                  <p className="text-[10px] text-brand/60 font-black uppercase tracking-widest mt-1">Accelerated Data Log</p>
                </div>
                <button onClick={onClose} className="p-3 hover:bg-brand/5 rounded-2xl transition-all">
                  <X size={24} className="text-gray-400" />
                </button>
              </div>

              {showNotification.show ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-6"
                >
                  <div className="bg-amber-50 border border-amber-100 p-8 rounded-[2rem] flex items-start gap-5">
                    <div className="p-4 bg-amber-100 text-amber-600 rounded-2xl shrink-0">
                      <AlertCircle size={32} />
                    </div>
                    <div>
                      <h4 className="text-xl font-serif font-black text-amber-900 mb-2">Unregistered Stock Detected</h4>
                      <p className="text-sm text-amber-800/80 font-medium leading-relaxed">
                        You've logged <span className="font-black underline">{showNotification.count} {showNotification.species}</span>, but no individual profiles exist for this species. Registration is required for detailed health and ancestry tracking.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => {
                          setShowNotification({ show: false, count: 0, species: '', groupId: '' });
                          onClose();
                      }}
                      className="py-4 bg-white border border-amber-100 text-amber-800 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-100 transition-all"
                    >
                      Dismiss
                    </button>
                    <button 
                      onClick={() => {
                        onClose();
                        localStorage.setItem('targetGroupId', showNotification.groupId);
                        window.dispatchEvent(new CustomEvent('navigate', { 
                          detail: { 
                            page: 'Livestock', 
                            species: showNotification.species 
                          } 
                        }));
                      }}
                      className="py-4 bg-amber-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20"
                    >
                      Register Now →
                    </button>
                  </div>
                </motion.div>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-4 mb-10">
                    {[
                      { id: 'production', icon: TrendingUp, label: 'Yield' },
                      { id: 'finance', icon: DollarSign, label: 'Capital' },
                      { id: 'livestock', icon: Bird, label: 'Census' },
                      { id: 'health', icon: HeartPulse, label: 'Health' }
                    ].map((tab) => (
                      <button 
                        key={tab.id}
                        onClick={() => setActiveType(tab.id as LogType)}
                        className={`flex flex-col items-center gap-3 p-6 rounded-[2rem] transition-all relative overflow-hidden group ${activeType === tab.id ? 'bg-brand text-white shadow-xl shadow-brand/20' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                      >
                        <tab.icon size={28} className={activeType === tab.id ? 'text-white' : 'group-hover:scale-110 transition-transform'} />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">{tab.label}</span>
                        {activeType === tab.id && (
                            <motion.div layoutId="quickLogTab" className="absolute inset-0 bg-white/10" />
                        )}
                      </button>
                    ))}
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-6">
                    {activeType === 'production' && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Classification</label>
                            <select 
                              className="w-full px-6 py-4 rounded-[1.5rem] bg-gray-50 border border-gray-100 focus:ring-4 focus:ring-brand/5 focus:border-brand/20 outline-none font-bold text-gray-900 appearance-none cursor-pointer"
                              value={production.type}
                              onChange={e => {
                                const newType = e.target.value;
                                const newUnit = PRODUCT_UNITS[newType] || production.unit;
                                setProduction({...production, type: newType, unit: newUnit});
                              }}
                            >
                              {Object.keys(PRODUCT_UNITS).map(type => (
                                <option key={type}>{type}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Volume Quantity</label>
                            <input 
                              type="number" 
                              className="w-full px-6 py-4 rounded-[1.5rem] bg-gray-50 border border-gray-100 focus:ring-4 focus:ring-brand/5 focus:border-brand/20 outline-none font-bold text-gray-900"
                              value={production.quantity || ''}
                              onChange={e => setProduction({...production, quantity: Number(e.target.value)})}
                            />
                          </div>
                        </div>
                        <div className="bg-brand/5 p-6 rounded-[2rem] border border-brand/5 relative group cursor-pointer hover:bg-brand/10 transition-all"
                          onClick={() => {
                            onClose();
                            window.dispatchEvent(new CustomEvent('navigate', { detail: 'Production' }));
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-[10px] font-black text-brand uppercase tracking-widest mb-1">Deep Analysis Mode</p>
                              <p className="text-xs text-brand/60 font-medium">Associate this yield with individual ID tags for performance audits.</p>
                            </div>
                            <ChevronRight size={20} className="text-brand group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {activeType === 'finance' && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                        <div className="flex p-2 bg-gray-100 rounded-[1.5rem] mb-4 border border-gray-100">
                          <button 
                            type="button"
                            onClick={() => setFinance({...finance, type: 'income'})}
                            className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${finance.type === 'income' ? 'bg-white text-emerald-600 shadow-sm border border-emerald-100' : 'text-gray-400'}`}
                          >
                            Capital Inflow
                          </button>
                          <button 
                            type="button"
                            onClick={() => setFinance({...finance, type: 'expense'})}
                            className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${finance.type === 'expense' ? 'bg-white text-red-600 shadow-sm border border-red-100' : 'text-gray-400'}`}
                          >
                            Resource Outlay
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Fiscal Amount ($)</label>
                            <input 
                              type="number" 
                              className="w-full px-6 py-4 rounded-[1.5rem] bg-gray-50 border border-gray-100 focus:ring-4 focus:ring-brand/5 focus:border-brand/20 outline-none font-bold text-gray-900"
                              value={finance.amount || ''}
                              onChange={e => setFinance({...finance, amount: Number(e.target.value)})}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Ledger Entry</label>
                            <select 
                              className="w-full px-6 py-4 rounded-[1.5rem] bg-gray-50 border border-gray-100 focus:ring-4 focus:ring-brand/5 focus:border-brand/20 outline-none font-bold text-gray-900"
                              value={finance.category}
                              onChange={e => setFinance({...finance, category: e.target.value})}
                            >
                              {finance.type === 'income' ? (
                                <><option>Sales</option><option>Grants</option><option>Divestment</option></>
                              ) : (
                                <><option>Feed</option><option>Medicine</option><option>Labor</option><option>Infrastructure</option></>
                              )}
                            </select>
                          </div>
                        </div>
                        <button 
                            type="button"
                            onClick={() => {
                              onClose();
                              window.dispatchEvent(new CustomEvent('navigate', { detail: 'Finance' }));
                            }}
                            className="w-full flex items-center justify-between p-6 bg-emerald-50/50 rounded-[2rem] border border-emerald-100 hover:bg-emerald-50 transition-all font-black text-[10px] text-emerald-800 uppercase tracking-widest"
                          >
                            Open Fiscal Ledger
                            <ChevronRight size={18} />
                          </button>
                      </motion.div>
                    )}

                    {activeType === 'livestock' && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Species Census</label>
                            <select 
                              className="w-full px-6 py-4 rounded-[1.5rem] bg-gray-50 border border-gray-100 focus:ring-4 focus:ring-brand/5 focus:border-brand/20 outline-none font-bold text-gray-900 cursor-pointer appearance-none"
                              value={livestock.type}
                              onChange={e => {
                                const newType = e.target.value;
                                let defaultAge = 'Adults';
                                if (['Chicken', 'Duck', 'Turkey'].includes(newType)) defaultAge = 'Chicks';
                                else if (newType === 'Cow') defaultAge = 'Calves';
                                else if (newType === 'Goat') defaultAge = 'Kids';
                                else if (newType === 'Sheep') defaultAge = 'Lambs';
                                else if (newType === 'Pig') defaultAge = 'Piglets';
                                else if (newType === 'Rabbit') defaultAge = 'Kits';
                                
                                setLivestock({...livestock, type: newType as any, ageGroup: defaultAge});
                              }}
                            >
                              <option>Chicken</option>
                              <option>Cow</option>
                              <option>Goat</option>
                              <option>Sheep</option>
                              <option>Pig</option>
                              <option>Rabbit</option>
                              <option>Camel</option>
                              <option>Donkey</option>
                              <option>Fish</option>
                              <option>Bees</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Incremental Count</label>
                            <input 
                              type="number" 
                              className="w-full px-6 py-4 rounded-[1.5rem] bg-gray-50 border border-gray-100 focus:ring-4 focus:ring-brand/5 focus:border-brand/20 outline-none font-bold text-gray-900"
                              value={livestock.count || ''}
                              onChange={e => setLivestock({...livestock, count: Number(e.target.value)})}
                            />
                          </div>
                          <div className="space-y-2">
                             <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Lifecycle Stage</label>
                              <select 
                                className="w-full px-6 py-4 rounded-[1.5rem] bg-gray-50 border border-gray-100 focus:ring-4 focus:ring-brand/5 focus:border-brand/20 outline-none font-bold text-gray-900 cursor-pointer appearance-none"
                                value={livestock.ageGroup}
                                onChange={e => setLivestock({...livestock, ageGroup: e.target.value})}
                              >
                                {['Chicken', 'Duck', 'Turkey'].includes(livestock.type) ? (
                                  <>
                                    <option value="Adults">Adults</option>
                                    <option value="Chicks">Chicks</option>
                                    <option value="Pullets">Pullets</option>
                                    <option value="Roosters">Roosters</option>
                                  </>
                                ) : (
                                  <>
                                    <option value="Adults">Adults</option>
                                    <option value="Young">Young</option>
                                    {livestock.type === 'Cow' && <option value="Calves">Calves</option>}
                                    {livestock.type === 'Cow' && <option value="Heifers">Heifers</option>}
                                    {livestock.type === 'Cow' && <option value="Bulls">Bulls</option>}
                                    {livestock.type === 'Sheep' && <option value="Lambs">Lambs</option>}
                                    {livestock.type === 'Goat' && <option value="Kids">Kids</option>}
                                    {livestock.type === 'Pig' && <option value="Piglets">Piglets</option>}
                                    {livestock.type === 'Rabbit' && <option value="Kits">Kits</option>}
                                  </>
                                )}
                              </select>
                           </div>
                         </div>
                         <div className="bg-brand/5 p-6 rounded-[2rem] border border-brand/5 group cursor-pointer hover:bg-brand/10 transition-all"
                          onClick={() => {
                            onClose();
                            window.dispatchEvent(new CustomEvent('navigate', { detail: 'Livestock' }));
                          }}
                        >
                           <div className="flex items-center justify-between">
                            <div>
                              <p className="text-[10px] font-black text-brand uppercase tracking-widest mb-1">Pedigree Registration</p>
                              <p className="text-xs text-brand/60 font-medium">Assign unique lineage and tag IDs to individual stock.</p>
                            </div>
                            <ChevronRight size={20} className="text-brand group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {activeType === 'health' && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                        <div className="space-y-2">
                           <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Subject Animal (Pedigree)</label>
                           <select 
                              className="w-full px-6 py-4 rounded-[1.5rem] bg-gray-50 border border-gray-100 focus:ring-4 focus:ring-brand/5 focus:border-brand/20 outline-none font-bold text-gray-900 cursor-pointer appearance-none"
                              value={health.animalId}
                              onChange={e => setHealth({...health, animalId: e.target.value})}
                           >
                              {animals.length === 0 && <option value="">No animals registered</option>}
                              {animals.map(a => (
                                <option key={a.id} value={a.id}>{a.name} ({a.tagId})</option>
                              ))}
                           </select>
                        </div>

                        <div className="flex p-2 bg-gray-100 rounded-[1.5rem] mb-4 border border-gray-100">
                          <button 
                            type="button"
                            onClick={() => setHealth({...health, logType: 'status'})}
                            className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${health.logType === 'status' ? 'bg-white text-brand shadow-sm border border-brand/10' : 'text-gray-400'}`}
                          >
                            Status
                          </button>
                          <button 
                            type="button"
                            onClick={() => setHealth({...health, logType: 'vaccination'})}
                            className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${health.logType === 'vaccination' ? 'bg-white text-brand shadow-sm border border-brand/10' : 'text-gray-400'}`}
                          >
                            Immunity
                          </button>
                          <button 
                            type="button"
                            onClick={() => setHealth({...health, logType: 'checkup'})}
                            className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${health.logType === 'checkup' ? 'bg-white text-brand shadow-sm border border-brand/10' : 'text-gray-400'}`}
                          >
                            Checkup
                          </button>
                        </div>

                        {health.logType === 'status' && (
                           <div className="space-y-2">
                              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Current Condition</label>
                              <div className="grid grid-cols-2 gap-2">
                                 {['Healthy', 'Sick', 'Quarantined', 'Recovering', 'Pregnant'].map(s => (
                                    <button
                                       key={s}
                                       type="button"
                                       onClick={() => setHealth({...health, status: s as any})}
                                       className={`py-3 px-4 rounded-xl text-xs font-bold border transition-all ${health.status === s ? 'bg-brand/10 border-brand text-brand' : 'bg-gray-50 border-gray-100 text-gray-500'}`}
                                    >
                                       {s}
                                    </button>
                                 ))}
                              </div>
                           </div>
                        )}

                        {health.logType === 'vaccination' && (
                           <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                 <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Vaccine Name</label>
                                 <input 
                                    className="w-full px-6 py-4 rounded-[1.5rem] bg-gray-50 border border-gray-100 outline-none font-bold text-gray-900"
                                    value={health.vaccineName}
                                    onChange={e => setHealth({...health, vaccineName: e.target.value})}
                                    placeholder="e.g. Anthrax"
                                 />
                              </div>
                              <div className="space-y-2">
                                 <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Boost Due Date</label>
                                 <input 
                                    type="date"
                                    className="w-full px-6 py-4 rounded-[1.5rem] bg-gray-50 border border-gray-100 outline-none font-bold text-gray-900"
                                    value={health.nextDueDate}
                                    onChange={e => setHealth({...health, nextDueDate: e.target.value})}
                                 />
                              </div>
                           </div>
                        )}

                        <div className="space-y-2">
                           <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Clinical Observations</label>
                           <textarea 
                              className="w-full px-6 py-4 rounded-[1.5rem] bg-gray-50 border border-gray-100 outline-none font-medium text-gray-900 h-24"
                              value={health.notes}
                              onChange={e => setHealth({...health, notes: e.target.value})}
                              placeholder="Describe symptoms, treatment administered, or findings..."
                           />
                        </div>
                      </motion.div>
                    )}

                    <button 
                      disabled={loading}
                      type="submit"
                      className="w-full py-5 bg-brand text-white rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] hover:bg-brand-dark transition-all disabled:opacity-50 mt-4 shadow-xl shadow-brand/20"
                    >
                      {loading ? 'Transmitting Data...' : 'Commit Log Entry'}
                    </button>
                  </form>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
