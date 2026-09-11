import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  orderBy, 
  limit,
  getDocs 
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreError';
import { TrendingUp, Plus, Trash2, Calendar, Egg, Droplets, Download, Tag, X, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from './ConfirmModal';
import ReportCustomizerModal from './ReportCustomizerModal';
import { Production, IndividualLivestock } from '../types';
import { useFarm } from '../context/FarmContext';
import { format } from 'date-fns';
import { PRODUCT_UNITS, ANIMAL_PRODUCTS } from '../constants';

function cn(...inputs: (string | boolean | undefined)[]) {
  return inputs.filter(Boolean).join(' ');
}

export default function ProductionTracker() {
  const { selectedFarm } = useFarm();
  const [records, setRecords] = useState<Production[]>([]);
  const [individuals, setIndividuals] = useState<IndividualLivestock[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string }>({ isOpen: false, id: '' });
  const [newRecord, setNewRecord] = useState({
    type: 'Milk',
    animalId: '',
    quantity: 0,
    unit: 'Liters',
    date: format(new Date(), 'yyyy-MM-dd')
  });

  useEffect(() => {
    const user = auth.currentUser;
    if (!user || !selectedFarm) return;

    const livestockQuery = query(
      collection(db, 'individual_livestock'),
      where('ownerId', '==', user.uid),
      where('farmId', '==', selectedFarm.id)
    );
    
    const unsubLivestock = onSnapshot(livestockQuery, (snap) => {
      const data: IndividualLivestock[] = [];
      snap.forEach(doc => data.push({ ...doc.data() as IndividualLivestock, id: doc.id }));
      setIndividuals(data);
    });

    const productionQuery = query(
      collection(db, 'production'), 
      where('ownerId', '==', user.uid),
      where('farmId', '==', selectedFarm.id),
      orderBy('date', 'desc'),
      limit(50)
    );
    const unsubProd = onSnapshot(productionQuery, (snapshot) => {
      const data: Production[] = [];
      snapshot.forEach(doc => data.push({ ...doc.data() as Production, id: doc.id }));
      setRecords(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'production');
    });

    return () => {
      unsubLivestock();
      unsubProd();
    };
  }, [selectedFarm?.id, auth.currentUser?.uid]);

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'production', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `production/${id}`);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user || !selectedFarm) return;

    try {
      await addDoc(collection(db, 'production'), {
        ...newRecord,
        ownerId: user.uid,
        farmId: selectedFarm.id,
        createdAt: new Date().toISOString()
      });
      setIsModalOpen(false);
      setNewRecord({ type: 'Milk', animalId: '', quantity: 0, unit: 'Liters', date: format(new Date(), 'yyyy-MM-dd') });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'production');
    }
  };

  const getAnimalName = (id?: string) => {
    if (!id) return 'General/Bulk Pool';
    return individuals.find(i => i.id === id)?.name || 'Unknown Subject';
  };

  const todayProduction = records
    .filter(r => r.date === format(new Date(), 'yyyy-MM-dd'))
    .reduce((sum, r) => sum + r.quantity, 0);

  return (
    <div className="space-y-8 fluid-container pb-10">
      {/* Navigation / Back Button */}
      <div className="mb-0">
        <button 
          onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'dashboard' }))}
          className="group flex items-center gap-2 px-4 py-2 bg-white hover:bg-brand hover:text-white rounded-xl border border-gray-100 transition-all font-black text-[9px] uppercase tracking-widest shadow-sm"
        >
          <ChevronRight className="w-3 h-3 rotate-180 group-hover:-translate-x-1 transition-transform" />
          Estate Dashboard
        </button>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-brand text-white rounded-xl flex items-center justify-center shadow-md shadow-brand/10 transition-transform hover:rotate-3 duration-500 shrink-0">
                <TrendingUp size={20} />
            </div>
            <div>
                <h2 className="text-xl font-serif font-black text-gray-900 tracking-tight leading-none mb-1">Harvest Log</h2>
                <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-brand/5 text-brand text-[7px] font-black uppercase tracking-widest rounded-full border border-brand/10">
                    {records.length} Entries
                    </span>
                    <span className="text-gray-400 text-[9px] font-medium opacity-60">Estate production registry</span>
                </div>
            </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className=" hidden sm:flex bg-white/60 backdrop-blur-md px-3 py-2 rounded-xl border border-gray-50 shadow-sm items-center gap-2">
            <div className="w-6 h-6 bg-brand/5 rounded-lg flex items-center justify-center text-brand">
              <TrendingUp size={12} />
            </div>
            <div className="flex flex-col">
                <p className="text-[6px] text-gray-400 uppercase font-black tracking-widest leading-none mb-0.5">Sum</p>
                <p className="text-xs font-serif font-black text-gray-900 leading-none">
                    {todayProduction}
                </p>
            </div>
          </div>
          
          <button 
            onClick={() => setIsReportModalOpen(true)}
            className="px-3 py-2 bg-white border border-gray-100 text-brand rounded-lg font-black uppercase tracking-widest text-[7px] hover:bg-gray-50 transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
          >
            <Download size={12} />
            Ledger
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-brand text-white rounded-lg font-black uppercase tracking-widest text-[7px] hover:bg-brand-dark transition-all shadow-md shadow-brand/10 active:scale-95"
          >
            <Plus size={14} />
            New
          </button>
        </div>
      </motion.div>


      <div className="bg-white/80 backdrop-blur-xl rounded-[1.5rem] shadow-sm border border-white overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-brand/5 rounded-lg flex items-center justify-center text-brand/30">
                <Calendar size={14} />
            </div>
            <h3 className="text-sm font-serif font-black text-gray-900 tracking-tight leading-none">Timeline</h3>
          </div>
        </div>
        
        <div className="p-4 md:p-6">
          <div className="space-y-3">
            {records.map((record, idx) => (
              <motion.div 
                layout
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.05 * idx }}
                key={record.id} 
                className="group"
              >
                <div className="bg-white px-4 py-3 rounded-2xl border border-gray-50 shadow-sm hover:shadow-md transition-all flex items-center justify-between gap-4">
                  
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-10 h-10 rounded-xl bg-gray-50 flex flex-col items-center justify-center border border-gray-100 group-hover:bg-brand group-hover:text-white transition-all duration-300">
                      <span className="text-sm font-black leading-none">{format(new Date(record.date), 'dd')}</span>
                      <span className="text-[6px] font-black uppercase tracking-widest opacity-60">{format(new Date(record.date), 'MMM')}</span>
                    </div>
                  </div>

                  <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-4 items-center">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex flex-col min-w-0">
                        <span className="text-[6px] font-black uppercase tracking-widest text-[#5A5A40]/50 mb-0.5">Source</span>
                        <span className="text-[10px] font-bold text-gray-900 truncate">{getAnimalName(record.animalId)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center",
                        record.type === 'Eggs' ? "bg-amber-50 text-amber-600" : 
                        record.type === 'Milk' ? "bg-blue-50 text-blue-600" : 
                        "bg-emerald-50 text-emerald-600"
                      )}>
                        {record.type === 'Eggs' ? <Egg size={14} /> : record.type === 'Milk' ? <Droplets size={14} /> : <TrendingUp size={14} />}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[6px] font-black uppercase tracking-widest text-[#5A5A40]/50 mb-0.5">Yield</span>
                        <span className="text-[10px] font-black text-gray-900 uppercase tracking-widest">{record.type}</span>
                      </div>
                    </div>

                    <div className="hidden md:flex justify-end">
                       <div className="inline-flex items-center gap-2 bg-gray-50/50 px-3 py-1.5 rounded-xl border border-gray-100">
                        <span className="text-sm font-black text-gray-900 tracking-tighter">{record.quantity}</span>
                        <span className="text-[7px] font-black uppercase tracking-widest text-brand">{record.unit}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="md:hidden inline-flex items-center gap-1.5 bg-gray-50/50 px-2 py-1 rounded-lg">
                        <span className="text-[10px] font-black text-gray-900">{record.quantity}</span>
                    </div>
                    <button 
                      onClick={() => setDeleteConfirm({ isOpen: true, id: record.id })}
                      className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                </div>
              </motion.div>
            ))}
          </div>

          {records.length === 0 && (
            <div className="text-center py-24 flex flex-col items-center justify-center relative z-10">
              <div className="w-24 h-24 bg-white/60 rounded-[2rem] flex items-center justify-center mb-6 shadow-sm border border-gray-50">
                <TrendingUp className="text-brand/10 w-12 h-12" />
              </div>
              <p className="text-gray-400 font-serif italic text-2xl opacity-30 tracking-tight">Yield History Detected.</p>
              <p className="mt-4 text-xs md:text-sm text-gray-400 italic font-medium max-w-xs mx-auto opacity-50 leading-relaxed">No harvesting events registered. Log your first yield to begin the data registry.</p>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal 
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, id: '' })}
        onConfirm={() => handleDelete(deleteConfirm.id)}
        title="Expunge Production Log"
        message="This action will permanently purge this harvesting event from the farm's historical dataset."
      />

      <ReportCustomizerModal 
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        title="Annual Strategic Production Audit"
        availableColumns={['Date', 'Animal', 'Type', 'Quantity', 'Unit']}
        columnMapping={{
          'Date': 'date',
          'Animal': (item: any) => getAnimalName(item.animalId),
          'Type': 'type',
          'Quantity': 'quantity',
          'Unit': 'unit'
        }}
        data={records}
        fileName="strategic_production_manifest_2024_monthly"
      />

      {/* Production Registration Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-lg overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="bg-white w-full max-w-xl rounded-[2rem] p-6 md:p-10 shadow-2xl my-auto border border-white"
            >
              <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl md:text-3xl font-serif font-black text-gray-900 tracking-tight leading-none">Register Harvest</h3>
                  <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 hover:bg-red-50 text-gray-300 hover:text-red-500 rounded-full transition-all flex items-center justify-center shadow-inner border border-gray-100 shrink-0">
                      <X size={20} />
                  </button>
              </div>
              
              <form onSubmit={handleAdd} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="block text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2 leading-none">Yield Specification</label>
                        <select 
                            className="w-full px-4 py-4 rounded-xl border border-gray-100 bg-gray-50 focus:ring-8 focus:ring-brand/5 focus:border-brand/20 outline-none font-black text-[10px] uppercase tracking-widest text-gray-900 cursor-pointer appearance-none transition-all shadow-inner"
                            value={newRecord.type}
                            onChange={e => {
                              const newType = e.target.value;
                              const newUnit = PRODUCT_UNITS[newType] || newRecord.unit;
                              setNewRecord({...newRecord, type: newType, unit: newUnit});
                            }}
                        >
                            {Object.keys(PRODUCT_UNITS).map(type => (
                              <option key={type}>{type}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2 leading-none">Biological Origin</label>
                        <div className="relative group">
                            <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand transition-colors w-4 h-4" />
                            <select 
                            className="w-full pl-12 pr-4 py-4 rounded-xl border border-gray-100 bg-gray-50 focus:ring-8 focus:ring-brand/5 focus:border-brand/20 outline-none font-black text-[10px] uppercase tracking-widest text-gray-900 cursor-pointer appearance-none transition-all shadow-inner"
                            value={newRecord.animalId}
                            onChange={e => {
                              const animalId = e.target.value;
                              const animal = individuals.find(i => i.id === animalId);
                              if (animal) {
                                const defaultType = ANIMAL_PRODUCTS[animal.type as string] || newRecord.type;
                                const defaultUnit = PRODUCT_UNITS[defaultType] || newRecord.unit;
                                setNewRecord({ ...newRecord, animalId, type: defaultType, unit: defaultUnit });
                              } else {
                                setNewRecord({ ...newRecord, animalId });
                              }
                            }}
                            >
                            <option value="">Estate Pool</option>
                            {individuals.map(ind => (
                                <option key={ind.id} value={ind.id}>{ind.name} • #{ind.tagId}</option>
                            ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2 leading-none">Yield Magnitude</label>
                    <input 
                      required
                      type="number" 
                      min="0.01"
                      step="0.01"
                      className="w-full px-5 py-4 rounded-xl border border-gray-100 bg-gray-50 focus:ring-8 focus:ring-brand/5 focus:border-brand/20 outline-none font-black text-2xl text-gray-900 transition-all shadow-inner tracking-tighter"
                      value={newRecord.quantity || ''}
                      onChange={e => setNewRecord({...newRecord, quantity: Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2 leading-none">Unit Descriptor</label>
                    <input 
                      required
                      type="text" 
                      placeholder="Liters, Crates..."
                      className="w-full px-5 py-4 rounded-xl border border-gray-100 bg-gray-50 focus:ring-8 focus:ring-brand/5 focus:border-brand/20 outline-none font-black text-xs text-gray-900 transition-all shadow-inner uppercase tracking-widest"
                      value={newRecord.unit}
                      onChange={e => setNewRecord({...newRecord, unit: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2 leading-none">Temporal Harvest Anchor</label>
                  <input 
                    required
                    type="date" 
                    className="w-full px-5 py-4 rounded-xl border border-gray-100 bg-gray-50 focus:ring-8 focus:ring-brand/5 focus:border-brand/20 outline-none font-black text-sm text-gray-900 cursor-text transition-all shadow-inner"
                    value={newRecord.date}
                    onChange={e => setNewRecord({...newRecord, date: e.target.value})}
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="order-2 sm:order-1 flex-1 py-4 bg-white text-gray-400 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-gray-50 transition-all border border-gray-100"
                  >
                    Abort
                  </button>
                  <button 
                    type="submit"
                    className="order-1 sm:order-2 flex-1 py-4 bg-brand text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-brand-dark transition-all shadow-lg shadow-brand/10 active:scale-95"
                  >
                    Commence Registry
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
