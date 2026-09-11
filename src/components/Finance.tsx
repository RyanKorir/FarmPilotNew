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
  updateDoc
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreError';
import { DollarSign, Plus, Trash2, ArrowUpRight, ArrowDownRight, Filter, Download, Link as LinkIcon, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from './ConfirmModal';
import ReportCustomizerModal from './ReportCustomizerModal';
import { Transaction, InventoryItem } from '../types';
import { useFarm } from '../context/FarmContext';
import { format } from 'date-fns';

export default function Finance() {
  const { selectedFarm } = useFarm();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string }>({ isOpen: false, id: '' });
  const [newTx, setNewTx] = useState<{
    type: 'income' | 'expense';
    amount: number;
    category: string;
    description: string;
    date: string;
    relatedInventoryId: string;
    quantity: number;
  }>({
    type: 'income',
    amount: 0,
    category: 'Sales',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    relatedInventoryId: '',
    quantity: 0
  });

  useEffect(() => {
    const user = auth.currentUser;
    if (!user || !selectedFarm) return;

    const qTx = query(
      collection(db, 'transactions'), 
      where('ownerId', '==', user.uid),
      where('farmId', '==', selectedFarm.id),
      orderBy('date', 'desc')
    );
    const unsubTx = onSnapshot(qTx, (snapshot) => {
      const data: Transaction[] = [];
      snapshot.forEach(doc => data.push({ ...doc.data() as Transaction, id: doc.id }));
      setTransactions(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    });

    const qInv = query(
      collection(db, 'inventory'), 
      where('ownerId', '==', user.uid),
      where('farmId', '==', selectedFarm.id)
    );
    const unsubInv = onSnapshot(qInv, (snapshot) => {
      const data: InventoryItem[] = [];
      snapshot.forEach(doc => data.push({ ...doc.data() as InventoryItem, id: doc.id }));
      setInventoryItems(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'inventory');
    });

    return () => {
      unsubTx();
      unsubInv();
    };
  }, [selectedFarm?.id, auth.currentUser?.uid]);

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'transactions', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `transactions/${id}`);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user || !selectedFarm) return;

    try {
      const txData = {
        ...newTx,
        ownerId: user.uid,
        farmId: selectedFarm.id,
        createdAt: new Date().toISOString()
      };
      
      await addDoc(collection(db, 'transactions'), txData);

      if (newTx.relatedInventoryId && newTx.quantity > 0) {
        const item = inventoryItems.find(i => i.id === newTx.relatedInventoryId);
        if (item) {
          const newQuantity = newTx.type === 'income' 
            ? item.quantity - newTx.quantity 
            : item.quantity + newTx.quantity;
          
          await updateDoc(doc(db, 'inventory', item.id), {
            quantity: newQuantity
          });

          await addDoc(collection(db, 'inventory', item.id, 'history'), {
            oldQuantity: item.quantity,
            newQuantity: newQuantity,
            change: newTx.type === 'income' ? -newTx.quantity : newTx.quantity,
            reason: `Finance: ${newTx.description || newTx.category}`,
            updatedBy: user.displayName || user.email,
            timestamp: new Date().toISOString()
          });
        }
      }

      setIsModalOpen(false);
      setNewTx({ 
        type: 'income', 
        amount: 0, 
        category: 'Sales', 
        description: '', 
        date: format(new Date(), 'yyyy-MM-dd'),
        relatedInventoryId: '',
        quantity: 0
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'transactions');
    }
  };

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const netProfit = totalIncome - totalExpense;

  return (
    <div className="space-y-8 md:space-y-12">
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
        className="flex flex-col xl:flex-row xl:items-center justify-between gap-6"
      >
        <div>
          <h2 className="text-3xl font-serif font-black text-gray-900 mb-1 tracking-tighter">Financial Ledger</h2>
          <div className="flex flex-wrap items-center gap-3">
            <span className="px-3 py-1 bg-brand/5 text-brand text-[9px] font-black uppercase tracking-widest rounded-full border border-brand/10">
              {format(new Date(), 'MMMM yyyy')}
            </span>
            <span className="text-gray-400 text-[10px] font-black uppercase tracking-widest italic opacity-40">Transparency in every harvest.</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={() => setIsReportModalOpen(true)}
            className="flex-1 md:flex-none justify-center px-6 py-3 bg-white border border-gray-100 text-brand rounded-2xl font-black uppercase tracking-widest text-[9px] hover:bg-gray-50 transition-all shadow-sm flex items-center gap-2"
          >
            <Download size={16} />
            Audit
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex-1 md:flex-none justify-center items-center gap-2 px-6 py-3 bg-brand text-white rounded-2xl font-black uppercase tracking-widest text-[9px] hover:bg-brand-dark transition-all shadow-xl shadow-brand/20"
          >
            <Plus size={16} />
            New Entry
          </button>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Revenue', value: totalIncome, icon: ArrowUpRight, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
          { label: 'Outflow', value: totalExpense, icon: ArrowDownRight, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
          { label: 'Agricultural Asset', value: netProfit, icon: DollarSign, color: 'text-white', bg: 'bg-brand', border: 'border-brand', main: true }
        ].map((card, idx) => (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 * idx }}
            key={card.label} 
            className={cn(
              "p-6 rounded-[2rem] border transition-all duration-500 hover:shadow-xl hover:-translate-y-1 relative overflow-hidden group",
              card.main ? "bg-brand text-white shadow-xl shadow-brand/30 border-brand" : "bg-white border-gray-50 shadow-sm"
            )}
          >
            <div className="flex items-center gap-4 mb-4 relative z-10">
              <div className={cn(
                "p-2 rounded-xl transition-transform group-hover:rotate-12 duration-500 border border-white/10",
                card.main ? "bg-white/20 text-white" : `${card.bg} ${card.color}`
              )}>
                <card.icon className="w-5 h-5" />
              </div>
              <span className={cn(
                "text-[9px] font-black uppercase tracking-[0.2em] opacity-60",
                card.main ? "text-white" : "text-gray-400"
              )}>
                {card.label}
              </span>
            </div>
            <h4 className={cn(
              "text-3xl font-serif font-black tracking-tighter relative z-10 leading-none",
              card.main ? "text-white" : "text-gray-900"
            )}>
              KSh {card.value.toLocaleString()}
            </h4>
            
            {card.main && (
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
            )}
          </motion.div>
        ))}
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <div>
            <h3 className="text-xl md:text-2xl font-serif font-black text-gray-900 leading-none">Chronological Logs</h3>
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-2">Verified Audit Trail</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl border border-gray-100">
              <Filter size={12} className="text-gray-400" />
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Active Filters</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <AnimatePresence mode="popLayout">
            {transactions.map((tx, idx) => (
              <motion.div
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: Math.min(idx * 0.05, 0.5) }}
                key={tx.id}
                className="group relative bg-white rounded-3xl p-5 md:p-6 border border-gray-100 hover:border-brand/20 transition-all hover:shadow-xl hover:shadow-brand/5 flex flex-wrap md:flex-nowrap items-center gap-4 md:gap-8"
              >
                {/* Date Bubble */}
                <div className="flex flex-col items-center justify-center min-w-[70px] h-[70px] bg-[#F9F9F7] rounded-2xl border border-gray-100 group-hover:bg-brand/5 transition-colors">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">
                    {tx.date && !isNaN(new Date(tx.date).getTime()) ? format(new Date(tx.date), 'MMM') : '---'}
                  </span>
                  <span className="text-2xl font-serif font-black text-gray-900 group-hover:text-brand transition-colors">
                    {tx.date && !isNaN(new Date(tx.date).getTime()) ? format(new Date(tx.date), 'dd') : '??'}
                  </span>
                </div>

                {/* Info Section */}
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 mb-1.5 transition-transform group-hover:translate-x-1">
                    <span className={cn(
                      "w-2 h-2 rounded-full",
                      tx.type === 'income' ? "bg-emerald-500 animate-pulse" : "bg-red-500"
                    )} />
                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">
                      {tx.category} • Ref ID {tx.id.slice(-6).toUpperCase()}
                    </span>
                  </div>
                  <h4 className="text-base md:text-lg font-bold text-gray-900 leading-tight">
                    {tx.description || <span className="text-gray-300 italic font-normal">Anonymous Transaction</span>}
                  </h4>
                </div>

                {/* Amount & Actions */}
                <div className="w-full md:w-auto flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 border-gray-50 pt-4 md:pt-0">
                  <div className="flex flex-col items-end">
                    <div className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-2xl text-sm md:text-base font-black transition-all",
                      tx.type === 'income' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                    )}>
                      {tx.type === 'income' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                      KSh {tx.amount.toLocaleString()}
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => setDeleteConfirm({ isOpen: true, id: tx.id })}
                    className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all group/btn"
                  >
                    <Trash2 size={18} className="group-hover/btn:scale-110 transition-transform" />
                  </button>
                </div>

                {/* Hover Indicator */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-0 group-hover:h-12 bg-brand rounded-r-full transition-all duration-500" />
              </motion.div>
            ))}
          </AnimatePresence>

          {transactions.length === 0 && (
            <div className="text-center py-24 md:py-32 bg-gray-50/50 rounded-[3rem] border border-dashed border-gray-200">
              <div className="w-16 h-16 md:w-24 md:h-24 bg-white rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-sm">
                <DollarSign className="text-gray-200 md:w-12 md:h-12" />
              </div>
              <h3 className="text-xl md:text-2xl font-serif font-black text-gray-300">Quiet Fiscal Horizon</h3>
              <p className="mt-2 text-xs md:text-sm text-gray-400 italic font-medium max-w-xs mx-auto">The ledger awaits your first agricultural transaction to begin tracking growth.</p>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal 
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, id: '' })}
        onConfirm={() => handleDelete(deleteConfirm.id)}
        title="Dissolve Transaction"
        message="This will permanently nullify this financial record. Proceed with caution."
      />

      <ReportCustomizerModal 
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        title="Comprehensive Financial Audit"
        availableColumns={['Date', 'Category', 'Description', 'Type', 'Amount']}
        columnMapping={{
          'Date': 'date',
          'Category': 'category',
          'Description': 'description',
          'Type': 'type',
          'Amount': 'amount'
        }}
        data={transactions}
        fileName="finance_report"
        includeNetProfit={true}
        netProfitValue={netProfit}
      />

      {/* Transaction Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 shadow-2xl my-auto border border-brand/10 shadow-brand/5"
            >
              <h3 className="text-xl md:text-3xl font-serif font-black text-gray-900 mb-6 md:mb-8">Financial Registry Entry</h3>
              <form onSubmit={handleAdd} className="space-y-4 md:space-y-6">
                <div className="flex p-2 bg-[#F9F9F7] rounded-xl md:rounded-[1.5rem] border border-gray-100">
                  <button 
                    type="button"
                    onClick={() => setNewTx({...newTx, type: 'income'})}
                    className={cn(
                      "flex-1 py-3 rounded-xl md:rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all",
                      newTx.type === 'income' ? "bg-white text-emerald-600 shadow-sm border border-emerald-100" : "text-gray-400 hover:text-emerald-400"
                    )}
                  >
                    Income Flow
                  </button>
                  <button 
                    type="button"
                    onClick={() => setNewTx({...newTx, type: 'expense' as const})}
                    className={cn(
                      "flex-1 py-3 rounded-xl md:rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all",
                      newTx.type === 'expense' ? "bg-white text-red-600 shadow-sm border border-red-100" : "text-gray-400 hover:text-red-400"
                    )}
                  >
                    Expense Output
                  </button>
                </div>

                <div className="space-y-1.5 md:space-y-2">
                  <label className="block text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Asset Link (Integration)</label>
                  <div className="relative group">
                    <LinkIcon className="absolute left-5 md:left-6 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand transition-colors w-4 h-4 md:w-5 md:h-5" />
                    <select 
                      className="w-full pl-12 md:pl-14 pr-5 md:pr-6 py-3 md:py-4 rounded-xl md:rounded-[1.5rem] border border-gray-100 bg-[#F9F9F7] focus:ring-4 focus:ring-brand/5 focus:border-brand/20 outline-none font-bold text-gray-900 cursor-pointer appearance-none text-sm md:text-base"
                      value={newTx.relatedInventoryId}
                      onChange={e => {
                        const item = inventoryItems.find(i => i.id === e.target.value);
                        setNewTx({
                          ...newTx, 
                          relatedInventoryId: e.target.value,
                          description: item ? `${newTx.type === 'income' ? 'Sale' : 'Purchase'} of ${item.name}` : newTx.description,
                          category: item ? (newTx.type === 'income' ? 'Sales' : item.category) : newTx.category
                        });
                      }}
                    >
                      <option value="">Detached Entry</option>
                      {inventoryItems.map(item => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {newTx.relatedInventoryId && (
                  <div className="space-y-1.5 md:space-y-2">
                    <label className="block text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Logistical Quantity</label>
                    <input 
                      required
                      type="number" 
                      min="1"
                      className="w-full px-5 md:px-6 py-3 md:py-4 rounded-xl md:rounded-[1.5rem] border border-gray-100 bg-[#F9F9F7] focus:ring-4 focus:ring-brand/5 focus:border-brand/20 outline-none font-bold text-gray-900 text-sm md:text-base"
                      value={newTx.quantity || ''}
                      onChange={e => setNewTx({...newTx, quantity: Number(e.target.value)})}
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 md:space-y-2">
                    <label className="block text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Amount (KSh)</label>
                    <input 
                      required
                      type="number" 
                      min="0"
                      className="w-full px-5 md:px-6 py-3 md:py-4 rounded-xl md:rounded-[1.5rem] border border-gray-100 bg-[#F9F9F7] focus:ring-4 focus:ring-brand/5 focus:border-brand/20 outline-none font-bold text-gray-900 text-sm md:text-base"
                      value={newTx.amount || ''}
                      onChange={e => setNewTx({...newTx, amount: Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-1.5 md:space-y-2">
                    <label className="block text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Classification</label>
                    <select 
                      className="w-full px-5 md:px-6 py-3 md:py-4 rounded-xl md:rounded-[1.5rem] border border-gray-100 bg-[#F9F9F7] focus:ring-4 focus:ring-brand/5 focus:border-brand/20 outline-none font-bold text-gray-900 cursor-pointer appearance-none text-sm md:text-base"
                      value={newTx.category}
                      onChange={e => setNewTx({...newTx, category: e.target.value})}
                    >
                      {newTx.type === 'income' ? (
                        <>
                          <option>Sales</option>
                          <option>Grants</option>
                          <option>Other Income</option>
                        </>
                      ) : (
                        <>
                          <option>Feed</option>
                          <option>Medicine</option>
                          <option>Labor</option>
                          <option>Equipment</option>
                          <option>Transport</option>
                          <option>Utilities</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5 md:space-y-2">
                  <label className="block text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Designated Reference</label>
                  <input 
                    type="text" 
                    placeholder="Identifying context..."
                    className="w-full px-5 md:px-6 py-3 md:py-4 rounded-xl md:rounded-[1.5rem] border border-gray-100 bg-[#F9F9F7] focus:ring-4 focus:ring-brand/5 focus:border-brand/20 outline-none font-bold text-gray-900 text-sm md:text-base"
                    value={newTx.description}
                    onChange={e => setNewTx({...newTx, description: e.target.value})}
                  />
                </div>

                <div className="space-y-1.5 md:space-y-2">
                  <label className="block text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Log Date</label>
                  <input 
                    required
                    type="date" 
                    className="w-full px-5 md:px-6 py-3 md:py-4 rounded-xl md:rounded-[1.5rem] border border-gray-100 bg-[#F9F9F7] focus:ring-4 focus:ring-brand/5 focus:border-brand/20 outline-none font-bold text-gray-900 cursor-text text-sm md:text-base"
                    value={newTx.date}
                    onChange={e => setNewTx({...newTx, date: e.target.value})}
                  />
                </div>

                <div className="flex gap-4 pt-4 md:pt-6">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-3 md:py-4 bg-gray-50 text-gray-400 rounded-xl md:rounded-[1.5rem] font-black text-[10px] md:text-xs uppercase tracking-widest hover:bg-gray-100 transition-all border border-gray-100"
                  >
                    Abort
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-3 md:py-4 bg-brand text-white rounded-xl md:rounded-[1.5rem] font-black text-[10px] md:text-xs uppercase tracking-widest hover:bg-brand-dark transition-all shadow-xl shadow-brand/20"
                  >
                    Commit Entry
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

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
