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
  orderBy, 
  limit, 
  getDocs 
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreError';
import { Package, Plus, Search, Filter, Trash2, Edit2, AlertCircle, Download, History, ArrowUpRight, ArrowDownRight, X, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from './ConfirmModal';
import ReportCustomizerModal from './ReportCustomizerModal';
import { InventoryItem, InventoryHistory } from '../types';
import { useFarm } from '../context/FarmContext';
import { format } from 'date-fns';

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}

export default function Inventory() {
  const { selectedFarm } = useFarm();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string }>({ isOpen: false, id: '' });
  const [updateQuantity, setUpdateQuantity] = useState<{ isOpen: boolean; item: InventoryItem | null }>({ isOpen: false, item: null });
  const [viewHistory, setViewHistory] = useState<{ isOpen: boolean; item: InventoryItem | null }>({ isOpen: false, item: null });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [newItem, setNewItem] = useState({
    name: '',
    category: 'Feed',
    quantity: 0,
    unit: 'kg',
    minThreshold: 10,
    batchNumber: '',
    supplier: '',
    expiryDate: ''
  });

  const [quantityChange, setQuantityChange] = useState({
    amount: 0,
    reason: 'Restock',
    type: 'add' as 'add' | 'subtract'
  });

  const [historyData, setHistoryData] = useState<InventoryHistory[]>([]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user || !selectedFarm) return;

    const q = query(
      collection(db, 'inventory'), 
      where('ownerId', '==', user.uid),
      where('farmId', '==', selectedFarm.id)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const data: InventoryItem[] = [];
      snapshot.forEach(doc => data.push({ ...doc.data() as InventoryItem, id: doc.id }));
      setItems(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'inventory');
    });

    return () => unsub();
  }, [selectedFarm?.id, auth.currentUser?.uid]);

  useEffect(() => {
    if (viewHistory.isOpen && viewHistory.item) {
      const historyRef = collection(db, 'inventory', viewHistory.item.id, 'history');
      const q = query(historyRef, orderBy('timestamp', 'desc'), limit(20));
      
      const unsub = onSnapshot(q, (snapshot) => {
        const data: InventoryHistory[] = [];
        snapshot.forEach(doc => data.push({ ...doc.data() as InventoryHistory, id: doc.id }));
        setHistoryData(data);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `inventory/${viewHistory.item?.id}/history`);
      });

      return () => unsub();
    }
  }, [viewHistory.isOpen, viewHistory.item]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user || !selectedFarm) return;

    try {
      const existingItem = items.find(i => 
        i.name.toLowerCase() === newItem.name.toLowerCase() && 
        i.category === newItem.category &&
        i.unit === newItem.unit
      );

      if (existingItem) {
        const newQuantity = existingItem.quantity + newItem.quantity;
        await updateDoc(doc(db, 'inventory', existingItem.id), {
          quantity: newQuantity,
          lastUpdated: new Date().toISOString()
        });

        await addDoc(collection(db, 'inventory', existingItem.id, 'history'), {
          oldQuantity: existingItem.quantity,
          newQuantity: newQuantity,
          change: newItem.quantity,
          reason: 'Restock (Consolidated)',
          updatedBy: user.displayName || user.email,
          timestamp: new Date().toISOString()
        });
      } else {
        const docRef = await addDoc(collection(db, 'inventory'), {
          ...newItem,
          ownerId: user.uid,
          farmId: selectedFarm.id,
          createdAt: new Date().toISOString()
        });

        await addDoc(collection(db, 'inventory', docRef.id, 'history'), {
          oldQuantity: 0,
          newQuantity: newItem.quantity,
          change: newItem.quantity,
          reason: 'Initial Stock',
          updatedBy: user.displayName || user.email,
          timestamp: new Date().toISOString()
        });
      }

      setIsModalOpen(false);
      setNewItem({ 
        name: '', 
        category: 'Feed', 
        quantity: 0, 
        unit: 'kg', 
        minThreshold: 10,
        batchNumber: '',
        supplier: '',
        expiryDate: ''
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'inventory');
    }
  };

  const handleUpdateQuantity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateQuantity.item) return;

    const user = auth.currentUser;
    if (!user) return;

    const changeAmount = quantityChange.type === 'add' ? quantityChange.amount : -quantityChange.amount;
    const newQuantity = updateQuantity.item.quantity + changeAmount;

    try {
      await updateDoc(doc(db, 'inventory', updateQuantity.item.id), {
        quantity: newQuantity
      });

      await addDoc(collection(db, 'inventory', updateQuantity.item.id, 'history'), {
        oldQuantity: updateQuantity.item.quantity,
        newQuantity: newQuantity,
        change: changeAmount,
        reason: quantityChange.reason,
        updatedBy: user.displayName || user.email,
        timestamp: new Date().toISOString()
      });

      setUpdateQuantity({ isOpen: false, item: null });
      setQuantityChange({ amount: 0, reason: 'Restock', type: 'add' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `inventory/${updateQuantity.item.id}`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'inventory', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `inventory/${id}`);
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'All' || item.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-12">
      {/* Navigation / Back Button */}
      <div className="mb-2">
        <button 
          onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'dashboard' }))}
          className="group flex items-center gap-3 px-6 py-3 bg-white hover:bg-brand hover:text-white rounded-2xl border border-gray-100 transition-all font-bold text-xs uppercase tracking-widest shadow-sm"
        >
          <ChevronRight className="w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform" />
          Estate Dashboard
        </button>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col xl:flex-row xl:items-center justify-between gap-8"
      >
        <div>
          <h2 className="text-4xl md:text-5xl font-serif font-black text-gray-900 mb-3 tracking-tight">Inventory Registry</h2>
          <div className="flex flex-wrap items-center gap-4">
            <span className="px-4 py-1 bg-brand text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-brand/20">
              {items.length} Strategic Assets
            </span>
            <span className="text-gray-400 text-sm font-medium italic opacity-60">Monitoring the lifecycle of your estate resources</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
          <div className="relative flex-1 md:flex-none group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand transition-colors" size={20} />
            <input 
              type="text" 
              placeholder="Query logistics..." 
              className="w-full md:w-80 pl-14 pr-6 py-4 bg-white/80 backdrop-blur-md border border-gray-100 rounded-3xl outline-none focus:ring-4 focus:ring-brand/5 focus:border-brand/20 transition-all text-sm font-semibold shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select 
            className="flex-1 md:flex-none min-w-[160px] px-6 py-4 bg-white border border-gray-100 rounded-3xl outline-none focus:ring-4 focus:ring-brand/5 transition-all text-[11px] font-black text-brand uppercase tracking-widest shadow-sm cursor-pointer appearance-none"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="All">All Classifications</option>
            <option value="Feed">Nutritional Reserve</option>
            <option value="Medicine">Medical Protocol</option>
            <option value="Tools">Surgical/Hardware</option>
            <option value="Equipment">Heavy Machinery</option>
            <option value="Packaging">Containment Units</option>
          </select>
          <button 
            onClick={() => setIsReportModalOpen(true)}
            className="flex-1 md:flex-none justify-center px-8 py-4 bg-white border border-gray-200 text-brand rounded-[1.75rem] font-black uppercase tracking-widest text-[10px] hover:bg-gray-50 transition-all shadow-sm flex items-center gap-3 active:scale-95"
          >
            <Download size={18} />
            Ledger
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="w-full md:w-auto flex items-center justify-center gap-3 px-10 py-4 bg-brand text-white rounded-[1.75rem] font-black uppercase tracking-widest text-[10px] hover:bg-brand-dark transition-all shadow-2xl shadow-brand/30 active:scale-95"
          >
            <Plus size={20} />
            New Logistics
          </button>
        </div>
      </motion.div>

      <motion.div 
        variants={{
          hidden: { opacity: 0 },
          show: {
            opacity: 1,
            transition: {
              staggerChildren: 0.1
            }
          }
        }}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
      >
        <AnimatePresence mode="popLayout">
          {filteredItems.map((item) => (
            <motion.div 
              variants={{
                hidden: { opacity: 0, scale: 0.95, y: 10 },
                show: { opacity: 1, scale: 1, y: 0 }
              }}
              layout
              key={item.id} 
              className="bg-white/90 backdrop-blur-md p-6 rounded-3xl shadow-sm border border-white group hover:shadow-xl hover:shadow-brand/5 transition-all relative overflow-hidden flex flex-col h-full"
            >
              <div className="flex items-start justify-between mb-8">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-700 group-hover:rotate-6 shadow-xl shadow-brand/5 border border-white/50",
                  item.quantity <= item.minThreshold ? "bg-red-50 text-red-600" : "bg-brand/5 text-brand"
                )}>
                  <Package className="w-6 h-6 transition-transform group-hover:scale-110 duration-500" />
                </div>
                <div className="flex items-center gap-1.5 opacity-20 group-hover:opacity-100 transition-all">
                  <button 
                    onClick={() => setUpdateQuantity({ isOpen: true, item })}
                    className="p-2.5 bg-brand text-white rounded-xl hover:bg-brand-dark transition-all shadow-lg shadow-brand/20"
                  >
                    <Plus size={16} />
                  </button>
                  <button 
                    onClick={() => setViewHistory({ isOpen: true, item })}
                    className="p-2.5 bg-white border border-gray-100 text-brand rounded-xl hover:bg-brand/5 transition-all shadow-sm"
                  >
                    <History size={16} />
                  </button>
                  <button 
                    onClick={() => setDeleteConfirm({ isOpen: true, id: item.id })}
                    className="p-2.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              <div className="mb-6">
                <h4 className="text-xl font-serif font-black text-gray-900 mb-2 tracking-tight truncate leading-none">{item.name}</h4>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-gray-50 text-brand/60 text-[9px] font-black rounded-full uppercase tracking-tighter border border-gray-100">
                    {item.category}
                  </span>
                  {item.batchNumber && (
                    <span className="text-[8px] text-gray-400 font-black uppercase tracking-tighter opacity-40 truncate">
                      #{item.batchNumber}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col gap-4 p-5 bg-gray-50/50 rounded-2xl border border-gray-100 mt-auto">
                <div className="flex items-center justify-between w-full">
                  <div className="space-y-1">
                    <p className="text-[8px] text-gray-400 uppercase font-black tracking-widest opacity-60 leading-none">Net Reserve</p>
                    <div className="flex items-baseline gap-1.5">
                      <p className={cn(
                        "text-3xl font-serif font-black tracking-tighter leading-none",
                        item.quantity <= item.minThreshold ? "text-red-600" : "text-gray-900"
                      )}>
                        {item.quantity}
                      </p>
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">{item.unit}</span>
                    </div>
                  </div>
                  {item.quantity <= item.minThreshold && (
                    <motion.div 
                      animate={{ opacity: [1, 0.5, 1] }} 
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      className="flex items-center gap-1.5 text-red-600 bg-white px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border border-red-50 shadow-lg shadow-red-500/5"
                    >
                      <AlertCircle size={10} />
                      Low
                    </motion.div>
                  )}
                </div>

                <div className="space-y-2 pt-2 border-t border-gray-100/50">
                  <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-gray-400 leading-none">
                    <span>Depletion</span>
                    <span>{Math.round((item.quantity / (item.minThreshold * 2 || 1)) * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-100/50 h-2 rounded-full overflow-hidden border border-gray-100 shadow-inner">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((item.quantity / (item.minThreshold * 2 || 1)) * 100, 100)}%` }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      className={cn(
                        "h-full rounded-full",
                        item.quantity <= item.minThreshold ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]" : "bg-brand shadow-[0_0_8px_rgba(90,90,64,0.3)]"
                      )}
                    />
                  </div>
                </div>
              </div>
              
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand/5 rounded-full blur-[40px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
            </motion.div>
          ))}
        </AnimatePresence>
        
        {items.length === 0 && (
          <div className="col-span-full py-48 text-center bg-white/40 backdrop-blur-md rounded-[5rem] border-8 border-dashed border-gray-100/50">
            <div className="w-32 h-32 bg-white/60 rounded-[3rem] flex items-center justify-center mx-auto mb-10 shadow-sm">
                <Package size={80} className="text-brand/10" />
            </div>
            <h3 className="text-3xl font-serif font-black text-gray-300 tracking-tight">Vantablack Reserve Repository</h3>
            <p className="mt-4 text-base text-gray-400 italic font-medium max-w-sm mx-auto opacity-60 leading-relaxed">Your logistics infrastructure is currently empty. Begin the asset mapping session with a new stock entry.</p>
          </div>
        )}
      </motion.div>

      <ConfirmModal 
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, id: '' })}
        onConfirm={() => handleDelete(deleteConfirm.id)}
        title="Dissolve Logistics Asset"
        message="This will permanently purge this item from the farm registries. This cannot be reversed."
      />

      <ReportCustomizerModal 
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        title="Estate Inventory Manifesto"
        availableColumns={['Name', 'Category', 'Quantity', 'Unit', 'Min Threshold', 'Created At']}
        columnMapping={{
          'Name': 'name',
          'Category': 'category',
          'Quantity': 'quantity',
          'Unit': 'unit',
          'Min Threshold': 'minThreshold',
          'Created At': 'createdAt'
        }}
        data={items}
        fileName="estate_inventory_manifest"
      />

      {/* Update Quantity Modal */}
      <AnimatePresence>
        {updateQuantity.isOpen && updateQuantity.item && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-2xl overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[3.5rem] p-12 shadow-[0_0_100px_rgba(0,0,0,0.5)] my-auto border border-white"
            >
              <h3 className="text-4xl font-serif font-black text-gray-900 mb-2 tracking-tight">Audit Session</h3>
              <p className="text-[11px] text-brand/60 font-black uppercase tracking-[0.3em] mb-12">{updateQuantity.item.name} <span className="mx-2">•</span> Vol: {updateQuantity.item.quantity} {updateQuantity.item.unit}</p>
              
              <form onSubmit={handleUpdateQuantity} className="space-y-8">
                <div className="flex gap-3 p-3 bg-gray-50 rounded-[2rem] border border-gray-100">
                  <button 
                    type="button"
                    onClick={() => setQuantityChange({...quantityChange, type: 'add'})}
                    className={cn(
                      "flex-1 py-4 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest transition-all",
                      quantityChange.type === 'add' ? "bg-white text-brand shadow-xl border border-brand/5 scale-105" : "text-gray-400 hover:text-brand/60"
                    )}
                  >
                    Resupply
                  </button>
                  <button 
                    type="button"
                    onClick={() => setQuantityChange({...quantityChange, type: 'subtract'})}
                    className={cn(
                      "flex-1 py-4 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest transition-all",
                      quantityChange.type === 'subtract' ? "bg-white text-red-600 shadow-xl border border-red-100 scale-105" : "text-gray-400 hover:text-red-400"
                    )}
                  >
                    Usage Logs
                  </button>
                </div>

                <div className="space-y-3">
                  <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest ml-2 leading-none">Adjustment Magnitude ({updateQuantity.item.unit})</label>
                  <input 
                    required
                    type="number" 
                    min="1"
                    className="w-full px-8 py-6 rounded-[2rem] border border-gray-100 bg-gray-50 focus:ring-8 focus:ring-brand/5 focus:border-brand/20 outline-none font-black text-2xl text-gray-900 transition-all"
                    value={quantityChange.amount || ''}
                    onChange={e => setQuantityChange({...quantityChange, amount: Number(e.target.value)})}
                  />
                </div>

                <div className="space-y-3">
                  <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest ml-2 leading-none">Log Rationale</label>
                  <select 
                    className="w-full px-8 py-6 rounded-[2rem] border border-gray-100 bg-gray-50 focus:ring-8 focus:ring-brand/5 focus:border-brand/20 outline-none font-black text-xs uppercase tracking-widest text-gray-900 cursor-pointer appearance-none transition-all shadow-inner"
                    value={quantityChange.reason}
                    onChange={e => setQuantityChange({...quantityChange, reason: e.target.value})}
                  >
                    <option>Regular Resupply</option>
                    <option>Operational Protocol</option>
                    <option>Wastage/Anomaly</option>
                    <option>Commercial Trade</option>
                    <option>Registry Recalibration</option>
                    <option>Other / Unspecified</option>
                  </select>
                </div>

                <div className="flex gap-5 pt-8">
                  <button 
                    type="button"
                    onClick={() => setUpdateQuantity({ isOpen: false, item: null })}
                    className="flex-1 py-5 bg-white text-gray-400 rounded-3xl font-black text-[11px] uppercase tracking-widest hover:bg-gray-50 transition-all border border-gray-100"
                  >
                    Abort
                  </button>
                  <button 
                    type="submit"
                    className={cn(
                      "flex-1 py-5 text-white rounded-3xl font-black text-[11px] uppercase tracking-widest transition-all shadow-2xl active:scale-95",
                      quantityChange.type === 'add' ? "bg-brand hover:bg-brand-dark shadow-brand/30" : "bg-red-500 hover:bg-red-600 shadow-red-500/30"
                    )}
                  >
                    Commit Transaction
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* History Modal */}
      <AnimatePresence>
        {viewHistory.isOpen && viewHistory.item && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-2xl overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, x: 20 }}
              className="bg-white w-full max-w-4xl rounded-[4rem] p-12 shadow-[0_0_120px_rgba(0,0,0,0.6)] my-auto max-h-[88vh] flex flex-col border border-white"
            >
              <div className="flex items-center justify-between mb-12 shrink-0">
                <div className="flex items-center gap-6">
                    <div className="w-20 h-20 bg-brand/10 text-brand rounded-[2rem] flex items-center justify-center">
                        <History size={40} />
                    </div>
                    <div>
                        <h3 className="text-4xl font-serif font-black text-gray-900 tracking-tight leading-none mb-2">Audit Timeline</h3>
                        <p className="text-[11px] text-brand/60 font-black uppercase tracking-[0.4em] leading-none">{viewHistory.item.name}</p>
                    </div>
                </div>
                <button 
                  onClick={() => setViewHistory({ isOpen: false, item: null })}
                  className="w-16 h-16 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-full transition-all flex items-center justify-center shadow-inner border border-gray-50"
                >
                  <X size={32} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-6 space-y-6 custom-scrollbar">
                {historyData.length === 0 ? (
                  <div className="text-center py-32 bg-gray-50 rounded-[3rem] border-4 border-dashed border-gray-100 flex flex-col items-center justify-center">
                    <History size={80} className="mb-8 opacity-5" />
                    <p className="text-gray-400 font-serif italic text-2xl opacity-40">No chronological logs detected in local registries.</p>
                  </div>
                ) : (
                  historyData.map((log) => (
                    <motion.div 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      key={log.id} 
                      className="flex items-center gap-8 p-10 bg-gray-50/50 rounded-[3rem] border border-gray-100 hover:bg-white hover:shadow-2xl hover:shadow-brand/5 transition-all group relative overflow-hidden"
                    >
                      <div className={cn(
                        "w-20 h-20 rounded-[1.75rem] flex items-center justify-center shrink-0 shadow-lg transition-transform group-hover:scale-110 duration-500",
                        log.change > 0 ? "bg-emerald-50 text-emerald-600 shadow-emerald-500/10" : "bg-red-50 text-red-600 shadow-red-500/10"
                      )}>
                        {log.change > 0 ? <Plus size={32} /> : <Trash2 size={32} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-4">
                          <p className="font-serif text-3xl font-black text-gray-900 tracking-tight leading-none">{log.reason}</p>
                          <span className="text-[11px] text-gray-400 font-black uppercase tracking-[0.2em]">{format(new Date(log.timestamp), 'MMM d, h:mm a')}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-6">
                            <div className="flex items-center gap-3 px-4 py-2 bg-white rounded-full border border-gray-100 shadow-sm">
                                <span className="w-2 h-2 bg-gray-200 rounded-full" />
                                <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                    {log.oldQuantity} <span className="mx-1 text-gray-200">→</span> <span className="text-gray-900">{log.newQuantity}</span> {viewHistory.item?.unit}
                                </p>
                            </div>
                            <div className="flex items-center gap-3 px-4 py-2 bg-white rounded-full border border-gray-100 shadow-sm">
                                <span className={cn("w-2 h-2 rounded-full", log.change > 0 ? "bg-emerald-400" : "bg-red-400")} />
                                <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                    Magnitude: <span className={log.change > 0 ? "text-emerald-600" : "text-red-600"}>{log.change > 0 ? '+' : ''}{log.change}</span>
                                </p>
                            </div>
                            <div className="flex items-center gap-3 px-4 py-2 bg-brand/5 rounded-full border border-brand/10 shadow-sm">
                                <span className="w-2 h-2 bg-brand/30 rounded-full" />
                                <p className="text-[11px] font-black uppercase tracking-widest text-brand opacity-60">
                                    Identity: {log.updatedBy}
                                </p>
                            </div>
                        </div>
                      </div>
                      <div className="absolute top-0 right-0 w-32 h-32 bg-brand/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-2xl overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[4rem] p-12 md:p-16 shadow-[0_0_120px_rgba(0,0,0,0.6)] my-auto border border-white"
            >
              <div className="flex items-center justify-between mb-12">
                  <h3 className="text-5xl font-serif font-black text-gray-900 tracking-tight">Supply Mapping</h3>
                  <button onClick={() => setIsModalOpen(false)} className="p-4 hover:bg-red-50 text-gray-300 hover:text-red-500 rounded-full transition-all">
                      <X size={32} />
                  </button>
              </div>
              <form onSubmit={handleAddItem} className="space-y-10">
                <div className="space-y-4">
                  <label className="block text-[11px] font-black text-gray-400 uppercase tracking-[0.3em] ml-2 leading-none">Commodity Nomenclature</label>
                  <input 
                    required
                    type="text" 
                    placeholder="e.g., Pure Alfalfa Concentrate"
                    className="w-full px-10 py-7 rounded-[2.5rem] border border-gray-100 bg-gray-50 focus:ring-8 focus:ring-brand/5 focus:border-brand/20 outline-none font-black text-xl text-gray-900 transition-all shadow-inner"
                    value={newItem.name}
                    onChange={e => setNewItem({...newItem, name: e.target.value})}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <label className="block text-[11px] font-black text-gray-400 uppercase tracking-[0.3em] ml-2 leading-none">Asset Classification</label>
                        <select 
                        className="w-full px-8 py-6 rounded-[2rem] border border-gray-100 bg-gray-50 focus:ring-8 focus:ring-brand/5 focus:border-brand/20 outline-none font-black text-xs uppercase tracking-widest text-gray-900 cursor-pointer appearance-none transition-all shadow-inner"
                        value={newItem.category}
                        onChange={e => setNewItem({...newItem, category: e.target.value})}
                        >
                        <option>Feed</option>
                        <option>Medicine</option>
                        <option>Tools</option>
                        <option>Equipment</option>
                        <option>Packaging</option>
                        </select>
                    </div>
                    <div className="space-y-4">
                        <label className="block text-[11px] font-black text-gray-400 uppercase tracking-[0.3em] ml-2 leading-none">Metric Quantifier</label>
                        <input 
                        required
                        type="text" 
                        placeholder="kg, units, crates"
                        className="w-full px-8 py-6 rounded-[2rem] border border-gray-100 bg-gray-50 focus:ring-8 focus:ring-brand/5 focus:border-brand/20 outline-none font-black text-sm uppercase tracking-widest text-gray-900 transition-all shadow-inner"
                        value={newItem.unit}
                        onChange={e => setNewItem({...newItem, unit: e.target.value})}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <label className="block text-[11px] font-black text-gray-400 uppercase tracking-[0.3em] ml-2 leading-none">Initial Magnitude</label>
                        <input 
                        required
                        type="number" 
                        className="w-full px-8 py-6 rounded-[2rem] border border-gray-100 bg-gray-50 focus:ring-8 focus:ring-brand/5 focus:border-brand/20 outline-none font-black text-2xl text-gray-900 transition-all shadow-inner"
                        value={newItem.quantity || ''}
                        onChange={e => setNewItem({...newItem, quantity: Number(e.target.value)})}
                        />
                    </div>
                    <div className="space-y-4">
                        <label className="block text-[11px] font-black text-gray-400 uppercase tracking-[0.3em] ml-2 leading-none">Scarcity Threshold</label>
                        <input 
                        required
                        type="number" 
                        className="w-full px-8 py-6 rounded-[2rem] border border-gray-100 bg-gray-50 focus:ring-8 focus:ring-brand/5 focus:border-brand/20 outline-none font-black text-2xl text-gray-900 transition-all shadow-inner"
                        value={newItem.minThreshold || ''}
                        onChange={e => setNewItem({...newItem, minThreshold: Number(e.target.value)})}
                        />
                    </div>
                </div>

                <div className="flex gap-6 pt-10">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-6 bg-white text-gray-400 rounded-3xl font-black text-[11px] uppercase tracking-widest hover:bg-gray-50 transition-all border border-gray-100"
                  >
                    Abort Registry
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-6 bg-brand text-white rounded-3xl font-black text-[11px] uppercase tracking-widest hover:bg-brand-dark transition-all shadow-2xl shadow-brand/30 active:scale-95"
                  >
                    Commence Supply Stream
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
