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
  getDocs,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreError';
import { 
  Bird, 
  Plus, 
  Trash2, 
  Edit2, 
  Heart, 
  Activity, 
  Download, 
  Milk, 
  Beef, 
  Fish, 
  Bug, 
  Cloud, 
  Mountain, 
  Truck,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  Search,
  TrendingUp,
  ShieldCheck,
  ExternalLink,
  Save,
  X as CloseIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from './ConfirmModal';
import ReportCustomizerModal from './ReportCustomizerModal';
import { Livestock, IndividualLivestock } from '../types';
import { useFarm } from '../context/FarmContext';
import { 
  LineChart, 
  Line, 
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ResponsiveContainer 
} from 'recharts';
import IndividualLivestockDetails from './IndividualLivestockDetails';

const ANIMAL_TYPES = [
// ... (rest of the file remains the same)
  { value: 'Chicken', icon: Bird, color: 'bg-amber-50 text-amber-600' },
  { value: 'Cow', icon: Milk, color: 'bg-blue-50 text-blue-600' },
  { value: 'Goat', icon: Beef, color: 'bg-orange-50 text-orange-600' },
  { value: 'Sheep', icon: Cloud, color: 'bg-gray-50 text-gray-600' },
  { value: 'Pig', icon: Beef, color: 'bg-pink-50 text-pink-600' },
  { value: 'Camel', icon: Mountain, color: 'bg-yellow-50 text-yellow-700' },
  { value: 'Donkey', icon: Truck, color: 'bg-stone-50 text-stone-600' },
  { value: 'Rabbit', icon: Bird, color: 'bg-indigo-50 text-indigo-600' }, // Rabbit icon might not be available, using Bird as fallback
  { value: 'Fish', icon: Fish, color: 'bg-cyan-50 text-cyan-600' },
  { value: 'Bees', icon: Bug, color: 'bg-yellow-50 text-yellow-600' },
  { value: 'Other', icon: Activity, color: 'bg-slate-50 text-slate-600' }
];

export default function LivestockManager() {
  const { selectedFarm } = useFarm();
  const [animals, setAnimals] = useState<Livestock[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [filterHealth, setFilterHealth] = useState('All');
  const [filterAge, setFilterAge] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string }>({ isOpen: false, id: '' });
  const [editingNotes, setEditingNotes] = useState<{ id: string; text: string } | null>(null);
  const [selectedAnimalForDetails, setSelectedAnimalForDetails] = useState<Livestock | null>(null);
  const [healthTrends, setHealthTrends] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  
  const [newAnimal, setNewAnimal] = useState({
    type: 'Chicken' as Livestock['type'],
    count: 0,
    ageGroup: 'Adults',
    healthStatus: 'Healthy' as Livestock['healthStatus'],
    notes: '',
    trackingMode: 'bulk' as 'bulk' | 'individual'
  });

  useEffect(() => {
    const smallAnimals = ['Chicken', 'Rabbit', 'Fish', 'Bees', 'Duck', 'Turkey'];
    if (smallAnimals.includes(newAnimal.type)) {
      setNewAnimal(prev => ({ ...prev, trackingMode: 'bulk' }));
    } else {
      setNewAnimal(prev => ({ ...prev, trackingMode: 'individual' }));
    }
  }, [newAnimal.type]);

  const [allIndividuals, setAllIndividuals] = useState<IndividualLivestock[]>([]);
  
  useEffect(() => {
    const user = auth.currentUser;
    if (!user || !selectedFarm) return;

    const q = query(
      collection(db, 'livestock'), 
      where('ownerId', '==', user.uid),
      where('farmId', '==', selectedFarm.id)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const data: Livestock[] = [];
      snapshot.forEach(doc => data.push({ ...doc.data() as Livestock, id: doc.id }));
      setAnimals(data);

      // Check for targetAnimalId in localStorage (deep link from dashboard)
      const targetId = localStorage.getItem('targetAnimalId');
      if (targetId) {
        const findTarget = async () => {
          const indivsQuery = query(collection(db, 'individual_livestock'), where('ownerId', '==', user.uid));
          const indivDoc = await getDocs(indivsQuery);
          const targetRecord = indivDoc.docs.find(d => d.id === targetId);
          if (targetRecord) {
            const indivData = targetRecord.data();
            const group = data.find(g => g.id === indivData.groupId);
            if (group) {
              setSelectedAnimalForDetails(group);
              localStorage.removeItem('targetAnimalId');
            }
          }
        };
        findTarget();
      }
      
      // Process health trends (mocking history for now as we don't have a separate history collection yet)
      const trends = data.map(a => ({
        name: a.type,
        health: a.healthStatus === 'Healthy' ? 100 : a.healthStatus === 'Recovering' ? 70 : a.healthStatus === 'Quarantined' ? 40 : 20,
        date: a.lastUpdated
      }));
      setHealthTrends(trends);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'livestock');
    });

    // Fetch All Individual Livestock to calculate real counts and categories
    const qIndiv = query(
      collection(db, 'individual_livestock'),
      where('ownerId', '==', user.uid),
      where('farmId', '==', selectedFarm.id)
    );

    const unsubIndiv = onSnapshot(qIndiv, (snapshot) => {
      const data: IndividualLivestock[] = [];
      snapshot.forEach(doc => data.push({ ...doc.data() as IndividualLivestock, id: doc.id }));
      setAllIndividuals(data);
    });

    // Check for preselect or target navigation in localStorage
    const preselect = localStorage.getItem('preselectSpecies');
    const targetGroupId = localStorage.getItem('targetGroupId');
    
    if (targetGroupId) {
      const group = animals.find(a => a.id === targetGroupId);
      if (group) {
        setSelectedAnimalForDetails(group);
        localStorage.removeItem('targetGroupId');
        localStorage.removeItem('preselectSpecies');
      }
    } else if (preselect) {
      setNewAnimal(prev => ({ ...prev, type: preselect as any }));
      setIsModalOpen(true);
      localStorage.removeItem('preselectSpecies');
    }

    // Fetch Alerts from individual livestock
    const alertsQuery = query(
      collection(db, 'individual_livestock'),
      where('ownerId', '==', user.uid),
      where('farmId', '==', selectedFarm.id)
    );

    const alertsUnsub = onSnapshot(alertsQuery, (snapshot) => {
      const upcomingAlerts: any[] = [];
      const now = new Date();
      
      const indivs = snapshot.docs.map(d => ({ ...d.data() as IndividualLivestock, id: d.id }));
      const sickAnimals = indivs.filter(d => d.healthStatus === 'Sick');
      const quarantinedAnimals = indivs.filter(d => d.healthStatus === 'Quarantined');
      const pregnantAnimals = indivs.filter(d => d.healthStatus === 'Pregnant');

      // Vaccination Alerts (New)
      const overdueVaccinations = indivs.filter(d => {
        if (!d.nextVaccinationDate) return false;
        const dueDate = new Date(d.nextVaccinationDate);
        return dueDate <= now && d.healthStatus !== 'Dead';
      });

      if (overdueVaccinations.length > 0) {
        upcomingAlerts.push({
          id: 'summary-vaccination',
          type: 'Medical',
          title: `Overdue Vaccinations (${overdueVaccinations.length})`,
          message: `Vaccination due date reached. Please let the doctor or specialist know. Click to update medical records.`,
          priority: 'Urgent',
          target: 'vaccination'
        });
      }

      if (sickAnimals.length > 0) {
        upcomingAlerts.push({
          id: 'summary-sick',
          type: 'Health',
          title: `${sickAnimals.length} Sick Animals Detected`,
          message: `Multiple records are marked as Sick. Ensure medication protocols are logged in Individual Details.`,
          priority: 'Urgent'
        });
      }

      if (quarantinedAnimals.length > 0) {
        upcomingAlerts.push({
          id: 'summary-quarantine',
          type: 'Bio-Security',
          title: `Isolation Protocol Active`,
          message: `${quarantinedAnimals.length} animals are in quarantine. Limit cross-pen movement to prevent spread.`,
          priority: 'Medium'
        });
      }

      if (pregnantAnimals.length > 0) {
        upcomingAlerts.push({
          id: 'summary-pregnant',
          type: 'Reproduction',
          title: `Upcoming Harvest/Calving`,
          message: `${pregnantAnimals.length} animals are currently pregnant. Prep the calving pens and adjust nutrient density.`,
          priority: 'Medium'
        });
      }
      
      setAlerts(upcomingAlerts);
    });

    return () => {
      unsub();
      unsubIndiv();
      alertsUnsub();
    };
  }, [selectedFarm?.id, auth.currentUser?.uid]);

  const getAnimalIcon = (type: string, size: number | string = 24) => {
    const animal = ANIMAL_TYPES.find(a => a.value === type);
    const Icon = animal?.icon || Bird;
    return <Icon size={size} />;
  };

  const getAnimalColor = (type: string) => {
    const animal = ANIMAL_TYPES.find(a => a.value === type);
    return animal?.color || 'bg-gray-100 text-gray-600';
  };

  const filteredAnimals = animals.filter(animal => {
    const matchesSearch = animal.type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'All' || animal.type === filterType;
    const matchesHealth = filterHealth === 'All' || animal.healthStatus === filterHealth;
    const matchesAge = filterAge === 'All' || animal.ageGroup === filterAge;
    return matchesSearch && matchesType && matchesHealth && matchesAge;
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user || !selectedFarm) return;

    try {
      const isIndividualTracking = newAnimal.trackingMode === 'individual';
      let targetAnimal: Livestock | null = null;
      
      // Check for existing group with same type and ageGroup to consolidate
      const existingGroup = animals.find(a => 
        a.type === newAnimal.type && 
        a.ageGroup.toLowerCase() === newAnimal.ageGroup.toLowerCase()
      );

      if (existingGroup) {
        const newCount = existingGroup.count + newAnimal.count;
        const updatedData = {
          count: newCount,
          lastUpdated: new Date().toISOString(),
          notes: newAnimal.notes ? `${existingGroup.notes}\n---\n${newAnimal.notes}` : existingGroup.notes
        };
        await updateDoc(doc(db, 'livestock', existingGroup.id), updatedData);
        targetAnimal = { ...existingGroup, ...updatedData };

        // Create placeholders for the NEWLY added count
        if (isIndividualTracking && newAnimal.count > 0) {
          const batchSize = Math.min(newAnimal.count, 20); // Allow slightly more for updates
          for (let i = 0; i < batchSize; i++) {
            await addDoc(collection(db, 'individual_livestock'), {
              groupId: existingGroup.id,
              name: `${newAnimal.type} (New Entry) #${i + 1}`,
              type: newAnimal.type,
              species: newAnimal.type,
              status: 'incomplete',
              ownerId: user.uid,
              farmId: selectedFarm.id,
              dob: new Date().toISOString(),
              gender: 'Female',
              registrationProgress: 10,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              healthStatus: 'Healthy'
            });
          }
        }
      } else {
        const docData = {
          ...newAnimal,
          ownerId: user.uid,
          farmId: selectedFarm.id,
          lastUpdated: new Date().toISOString()
        };
        const groupDoc = await addDoc(collection(db, 'livestock'), docData);
        targetAnimal = { ...docData, id: groupDoc.id } as Livestock;

        // If in individual mode, create placeholder individual records (max 10 for safety)
        if (isIndividualTracking && newAnimal.count > 0) {
          const batchSize = Math.min(newAnimal.count, 10);
          for (let i = 0; i < batchSize; i++) {
            await addDoc(collection(db, 'individual_livestock'), {
              groupId: groupDoc.id,
              name: `${newAnimal.type} #${i + 1} (Incomplete)`,
              type: newAnimal.type, // Consistent with IndividualLivestockDetails filtering
              species: newAnimal.type,
              status: 'incomplete', 
              ownerId: user.uid,
              farmId: selectedFarm.id,
              dob: new Date().toISOString(),
              gender: 'Female',
              registrationProgress: 10,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              healthStatus: 'Healthy'
            });
          }
        }
      }

      setIsModalOpen(false);
      
      // Navigate to detailed view if individual tracking is needed
      if (isIndividualTracking && targetAnimal) {
        setSelectedAnimalForDetails(targetAnimal);
      }

      setNewAnimal({
        type: 'Chicken',
        count: 0,
        ageGroup: 'Adults',
        healthStatus: 'Healthy',
        notes: '',
        trackingMode: 'bulk'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'livestock');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'livestock', id));
      setDeleteConfirm({ isOpen: false, id: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `livestock/${id}`);
    }
  };

  const handleUpdateNotes = async (id: string) => {
    if (!editingNotes) return;
    try {
      await updateDoc(doc(db, 'livestock', id), {
        notes: editingNotes.text,
        lastUpdated: new Date().toISOString()
      });
      setEditingNotes(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `livestock/${id}`);
    }
  };

  const allSpecies = Array.from(new Set([
    ...filteredAnimals.map(a => a.type),
    ...allIndividuals.map(i => i.type)
  ]));

  const groupedAnimals = allSpecies.reduce((acc, speciesType) => {
    // Find the bulk group if it exists
    const bulkGroup = filteredAnimals.find(a => a.type === speciesType);
    
    // Find individuals of this species
    const relevantIndivs = allIndividuals.filter(i => i.type === speciesType);
    const individualCount = relevantIndivs.length;

    // Use bulk group data as base, or create a placeholder if it doesn't exist
    const baseRecord: any = bulkGroup ? { ...bulkGroup } : {
      id: `virtual-${speciesType}`,
      type: speciesType,
      count: 0,
      ageGroup: 'Various',
      healthStatus: 'Healthy',
      notes: 'No bulk group record found. Tracking individuals only.',
      lastUpdated: new Date().toISOString(),
      trackingMode: 'individual',
      isVirtual: true // Flag to show it needs regularizing
    };

    if (!acc[speciesType]) {
      acc[speciesType] = {
        ...baseRecord,
        count: 0,
        groups: []
      };
    }
    
    // Identity categories from individuals
    const categories: Record<string, number> = {};
    relevantIndivs.forEach(i => {
      const cat = i.ageGroup || 'Adults';
      categories[cat] = (categories[cat] || 0) + 1;
    });

    // Use the higher value between specified count and individual records count
    // BUT if trackingMode is individual, we show the Registered Count and the Target Count
    const finalCount = bulkGroup ? bulkGroup.count : individualCount;
    acc[speciesType].count = finalCount;
    acc[speciesType].registeredCount = individualCount;
    
    // Check for registry gap
    if (baseRecord.trackingMode === 'individual' && individualCount < (baseRecord.count || 0)) {
      acc[speciesType].isRegistryIncomplete = true;
      acc[speciesType].missingIndividualCount = (baseRecord.count || 0) - individualCount;
    }
    
    // Create localized groups based on individuals if they exist
    if (relevantIndivs.length > 0) {
      Object.entries(categories).forEach(([name, count]) => {
        const existingGroupIdx = acc[speciesType].groups.findIndex(g => g.ageGroup === name);
        if (existingGroupIdx !== -1) {
          acc[speciesType].groups[existingGroupIdx].count = Math.max(acc[speciesType].groups[existingGroupIdx].count, count);
        } else {
          acc[speciesType].groups.push({
            ...baseRecord,
            ageGroup: name,
            count: count,
            id: `${baseRecord.id}-${name}`
          });
        }
      });
    } else if (bulkGroup) {
      // If no individuals but bulk group exists, add the bulk group info
      acc[speciesType].groups.push(bulkGroup);
    }
    
    return acc;
  }, {} as Record<string, Livestock & { groups: Livestock[], isRegistryIncomplete?: boolean, missingIndividualCount?: number, isVirtual?: boolean, registeredCount?: number }>);

  const displayAnimals = Object.values(groupedAnimals);

  const chartData = Object.values(groupedAnimals).map(a => ({
    name: a.type,
    count: a.count
  }));

  return (
    <div className="space-y-10 max-w-[1800px] 2xl:max-w-[2200px] mx-auto">
      {/* Navigation / Back Button */}
      {!selectedAnimalForDetails && (
        <div className="mb-2">
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'dashboard' }))}
            className="group flex items-center gap-3 px-6 py-3 bg-white hover:bg-brand hover:text-white rounded-2xl border border-gray-100 transition-all font-bold text-xs uppercase tracking-widest shadow-sm"
          >
            <ChevronRight className="w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform" />
            Estate Dashboard
          </button>
        </div>
      )}

      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
      >
        <div>
          <h2 className="text-2xl font-serif font-bold text-gray-900 mb-1">Livestock Estate</h2>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-brand/5 text-brand text-[9px] font-black rounded-full border border-brand/10">
              {allIndividuals.filter(i => i.status !== 'incomplete' && i.healthStatus !== 'Dead').length} / {animals.reduce((acc, curr) => acc + curr.count, 0)} Registered
            </span>
            {allIndividuals.some(i => i.status === 'incomplete') && (
              <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-[9px] font-black rounded-full border border-amber-100 flex items-center gap-1">
                <AlertCircle size={10} />
                {allIndividuals.filter(i => i.status === 'incomplete').length} Incomplete
              </span>
            )}
            <span className="text-gray-400 text-[10px] font-medium italic truncate">Across {animals.length} species</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <div className="relative w-full md:w-48 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand transition-colors" size={14} />
            <input 
              type="text"
              placeholder="Search registry..."
              className="w-full pl-9 pr-9 py-2 bg-white border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-brand/5 focus:border-brand/20 transition-all text-[11px] font-medium shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <select 
            className="flex-1 min-w-[100px] md:flex-none px-3 py-2 bg-white border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-brand/5 transition-all text-[10px] font-black text-brand shadow-sm cursor-pointer uppercase tracking-tight"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="All">All Species</option>
            {ANIMAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.value}</option>)}
          </select>

          <select 
            className="flex-1 min-w-[100px] md:flex-none px-3 py-2 bg-white border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-brand/5 transition-all text-[10px] font-black text-brand shadow-sm cursor-pointer uppercase tracking-tight"
            value={filterAge}
            onChange={(e) => setFilterAge(e.target.value)}
          >
            <option value="All">All Ages</option>
            <option value="Adults">Adults</option>
            <option value="Young">Young</option>
            <option value="Newborns">Newborns</option>
            <option value="Seniors">Seniors</option>
          </select>

          <button 
            onClick={() => setIsReportModalOpen(true)}
            className="hidden xl:flex items-center justify-center gap-1.5 px-4 py-2 bg-white border border-gray-100 text-brand rounded-xl font-black hover:bg-gray-50 transition-all shadow-sm text-[10px] uppercase tracking-widest"
          >
            <Download size={14} />
            Export
          </button>
          <button 
            onClick={() => setIsModalOpen(!isModalOpen)}
            className={cn(
              "w-full md:w-auto flex items-center justify-center gap-1.5 px-5 py-2 rounded-xl font-black transition-all shadow-md text-[10px] uppercase tracking-widest",
              isModalOpen ? "bg-gray-100 text-gray-500" : "bg-brand text-white"
            )}
          >
            {isModalOpen ? <CloseIcon size={14} /> : <Plus size={14} />}
            {isModalOpen ? 'Cancel' : 'New Entry'}
          </button>
        </div>
      </motion.div>

      {/* New Entry Reveal Section */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-white rounded-[2rem] border border-gray-100 shadow-xl"
          >
            <div className="p-6 md:p-8">
              <div className="max-w-4xl mx-auto">
                <h3 className="text-xl font-serif font-black text-[#1a1a1a] mb-1 text-center uppercase tracking-tight">New Estate Record</h3>
                <p className="text-[#5A5A40] text-[10px] italic mb-6 text-center">Add a new animal group to your digital registry.</p>
                
                <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[9px] font-black text-gray-400 uppercase mb-2 ml-1 tracking-widest">Animal Classification</label>
                      <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 p-3 bg-gray-50 rounded-2xl border border-gray-100 max-h-48 overflow-y-auto custom-scrollbar">
                        {ANIMAL_TYPES.map((type) => (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => setNewAnimal({...newAnimal, type: type.value as any})}
                            className={cn(
                              "flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl transition-all aspect-square",
                              newAnimal.type === type.value ? "bg-white shadow-md ring-1 ring-brand" : "hover:bg-white/50"
                            )}
                          >
                            <type.icon size={16} className={newAnimal.type === type.value ? "text-brand" : "text-gray-400"} />
                            <span className="text-[7.5px] font-black uppercase tracking-tighter truncate w-full text-center">{type.value}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Census</label>
                        <input 
                          required
                          type="number" 
                          min="1"
                          className="w-full px-4 py-2 text-xs rounded-xl border border-gray-100 bg-gray-50 focus:ring-2 focus:ring-brand/5 focus:border-brand/20 outline-none font-bold text-gray-900 transition-all shadow-inner"
                          value={newAnimal.count || ''}
                          onChange={e => setNewAnimal({...newAnimal, count: Number(e.target.value)})}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Cohort</label>
                        <select 
                          className="w-full px-4 py-2 text-[10px] rounded-xl border border-gray-100 bg-gray-50 outline-none font-bold text-gray-900 cursor-pointer"
                          value={newAnimal.ageGroup}
                          onChange={e => setNewAnimal({...newAnimal, ageGroup: e.target.value})}
                        >
                          {newAnimal.type === 'Cow' ? (
                            <>
                              <option value="Adults">Adults</option>
                              <option value="Male">Bulls</option>
                              <option value="Female">Cows</option>
                              <option value="Calves">Calves</option>
                              <option value="Heifers">Heifers</option>
                            </>
                          ) : (['Chicken', 'Duck', 'Turkey'].includes(newAnimal.type)) ? (
                            <>
                              <option value="Adults">Adults</option>
                              <option value="Chicks">Chicks</option>
                              <option value="Layers">Layers</option>
                            </>
                          ) : (
                            <>
                              <option value="Adults">Adults</option>
                              <option value="Young">Young</option>
                              <option value="Newborns">Newborns</option>
                            </>
                          )}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Status</label>
                        <select 
                          className="w-full px-4 py-2 text-[10px] rounded-xl border border-gray-100 bg-gray-50 outline-none font-bold text-gray-900 cursor-pointer"
                          value={newAnimal.healthStatus}
                          onChange={e => setNewAnimal({...newAnimal, healthStatus: e.target.value as any})}
                        >
                          <option value="Healthy">Healthy</option>
                          <option value="Sick">Sick</option>
                          <option value="Recovering">Recovering</option>
                          <option value="Quarantined">Quarantine</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Tracking</label>
                        <div className="flex p-1 bg-gray-100 rounded-xl border border-gray-200">
                          <button
                            type="button"
                            onClick={() => setNewAnimal({...newAnimal, trackingMode: 'bulk'})}
                            className={cn(
                              "flex-1 py-1.5 px-2 rounded-lg text-[8px] font-black uppercase transition-all",
                              newAnimal.trackingMode === 'bulk' ? "bg-white shadow-sm text-brand" : "text-gray-400"
                            )}
                          >
                            Bulk
                          </button>
                          <button
                            type="button"
                            onClick={() => setNewAnimal({...newAnimal, trackingMode: 'individual'})}
                            className={cn(
                              "flex-1 py-1.5 px-2 rounded-lg text-[8px] font-black uppercase transition-all",
                              newAnimal.trackingMode === 'individual' ? "bg-white shadow-sm text-brand" : "text-gray-400"
                            )}
                          >
                            Indiv.
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Notes</label>
                      <textarea 
                        className="w-full px-4 py-2 text-[11px] rounded-xl border border-gray-100 bg-gray-50 outline-none font-medium text-gray-900 transition-all shadow-inner resize-none"
                        placeholder="Group details..."
                        rows={1}
                        value={newAnimal.notes}
                        onChange={e => setNewAnimal({...newAnimal, notes: e.target.value})}
                      />
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button 
                        type="button"
                        onClick={() => setIsModalOpen(false)}
                        className="flex-1 px-4 py-2 bg-gray-50 text-gray-400 rounded-xl font-black uppercase tracking-widest text-[9px] hover:bg-gray-100 transition-all border border-gray-100"
                      >
                        Dismiss
                      </button>
                      <button 
                        type="submit"
                        className="flex-[2] px-4 py-2 bg-brand text-white rounded-xl font-black uppercase tracking-widest text-[9px] hover:bg-brand-dark transition-all shadow-lg shadow-brand/10 active:scale-95"
                      >
                        Register Group
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {selectedAnimalForDetails ? (
          <motion.div 
            key="details"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="w-full"
          >
            <IndividualLivestockDetails 
              animalGroup={selectedAnimalForDetails}
              onClose={() => setSelectedAnimalForDetails(null)}
            />
          </motion.div>
        ) : (
          <motion.div 
            key="list"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-12"
          >
            {/* Analytics Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 bg-white/80 p-5 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-serif font-black text-gray-900">Population Dynamics</h3>
                    <p className="text-[7.5px] text-gray-400 font-black uppercase tracking-widest mt-0.5">Headcount distribution</p>
                  </div>
                  <TrendingUp size={14} className="text-brand opacity-20" />
                </div>
                <div className="h-[150px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 8, fontWeight: 900, fill: '#999' }}
                        dy={8}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 8, fontWeight: 900, fill: '#999' }}
                      />
                      <Tooltip 
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{ 
                          borderRadius: '8px', 
                          border: 'none', 
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                          fontSize: '9px',
                          fontWeight: 900
                        }}
                      />
                      <Bar 
                        dataKey="count" 
                        fill="#8B4513" 
                        radius={[4, 4, 0, 0]} 
                        barSize={24}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-[#8B4513] p-6 rounded-2xl shadow-xl text-white relative overflow-hidden flex flex-col justify-between min-h-[150px]">
                <div>
                  <Heart className="mb-4 opacity-40 shrink-0" size={24} />
                  <h3 className="text-lg font-serif font-black mb-1.5 tracking-tight">Herd Vitality</h3>
                  <p className="text-white/60 text-[9px] leading-relaxed mb-4">
                    Resilient health status across all registered sectors.
                  </p>
                </div>
                
                <div className="space-y-2 relative z-10">
                  <div className="flex justify-between items-end">
                    <span className="text-[8px] font-black uppercase tracking-widest text-white/50">Overall Score</span>
                    <span className="text-xl font-black">94%</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: "94%" }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      className="h-full bg-emerald-400"
                    />
                  </div>
                </div>
              </div>
            </div>

            <AnimatePresence>
              {alerts.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="bg-amber-50/40 backdrop-blur-sm border border-amber-100 rounded-3xl p-6 shadow-xl shadow-amber-900/5"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                        <AlertCircle className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-serif font-bold text-gray-900">Health Watch</h3>
                        <p className="text-amber-700/70 text-[8px] font-black uppercase tracking-widest leading-none">Active Surveillance</p>
                      </div>
                    </div>
                    <div className="bg-white/80 px-3 py-1 rounded-full border border-amber-200 shadow-sm">
                      <span className="text-amber-600 text-[8px] font-black uppercase tracking-[0.2em]">{alerts.length} Critical Notifications</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {alerts.map((alert) => (
                      <motion.div 
                        key={alert.id}
                        whileHover={{ y: -3 }}
                        className="bg-white p-4 rounded-2xl shadow-sm border border-amber-100 flex flex-col gap-3 group"
                      >
                        <div className="flex items-start justify-between">
                          <div className={cn(
                            "p-2 rounded-lg transition-colors",
                            alert.priority === 'Urgent' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'
                          )}>
                            {alert.type === 'Health' ? <Activity size={18} /> : <Beef size={18} />}
                          </div>
                          <div className={cn(
                            "text-[8px] font-black uppercase tracking-[0.1em] px-2 py-0.5 rounded-md",
                            alert.priority === 'Urgent' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                          )}>
                            {alert.priority}
                          </div>
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900 text-sm mb-0.5">{alert.title}</h4>
                          <p className="text-[10px] text-gray-500 leading-tight font-medium line-clamp-2">{alert.message}</p>
                          <button 
                            onClick={() => {
                              if (alert.animal) {
                                const speciesGroup = animals.find(a => a.id === alert.animal.groupId);
                                if (speciesGroup) setSelectedAnimalForDetails(speciesGroup);
                              } else {
                                setSearchTerm('');
                                setFilterHealth(alert.type === 'Health' ? 'Sick' : alert.type === 'Bio-Security' ? 'Quarantined' : 'All');
                              }
                            }}
                            className="text-[9px] font-black text-brand mt-2 uppercase tracking-[0.1em] group-hover:translate-x-1 transition-transform inline-flex items-center gap-1.5"
                          >
                            Audit Records <Plus size={8} />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

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
                {displayAnimals.map((animal: any) => (
                  <motion.div 
                    variants={{
                      hidden: { opacity: 0, scale: 0.95, y: 10 },
                      show: { opacity: 1, scale: 1, y: 0 }
                    }}
                    layout
                    key={animal.type} 
                    onClick={() => setSelectedAnimalForDetails(animal)}
                    className="bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-white group hover:shadow-lg transition-all relative overflow-hidden flex flex-col h-full cursor-pointer hover:-translate-y-0.5"
                  >
                    <div className="absolute -top-4 -right-4 w-24 h-24 bg-brand/5 rounded-full blur-xl group-hover:bg-brand/10 transition-colors" />
                    
                    <div className="flex items-start justify-between mb-4 relative z-10 gap-2">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 group-hover:rotate-3 shadow-md border border-white/50",
                        getAnimalColor(animal.type)
                      )}>
                        {getAnimalIcon(animal.type, 18)}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className="bg-white/80 px-1.5 py-0.5 rounded-lg border border-gray-50 shadow-sm flex items-center gap-1">
                          <TrendingUp className="w-2.5 h-2.5 text-emerald-500" />
                          <span className="text-[7px] font-black uppercase tracking-widest text-brand">Live Census</span>
                        </div>
                        {animal.isRegistryIncomplete && (
                          <div className="bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-lg text-[7px] font-black uppercase tracking-widest border border-amber-50 animate-pulse flex items-center gap-1">
                            <Clock size={8} />
                            Gap: {animal.missingIndividualCount}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mb-4 relative z-10">
                      <h4 className="text-base font-serif font-black text-gray-900 mb-2 tracking-tight leading-tight">{animal.type}</h4>
                      <div className="flex flex-wrap gap-1">
                        {animal.groups.slice(0, 2).map((g: any) => (
                          <span key={g.id} className="px-1.5 py-0.5 bg-gray-50 text-brand text-[8px] font-black rounded-md uppercase tracking-tighter border border-gray-100">
                            {g.ageGroup} • {g.count}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-4 relative z-10 flex-1">
                      <div className="bg-gray-50/50 p-3 rounded-xl border border-gray-100 flex flex-col justify-center transition-all group-hover:bg-white group-hover:shadow-md">
                        <p className="text-[7px] text-gray-400 uppercase font-black mb-0.5 opacity-60 tracking-widest leading-none italic">Census</p>
                        <p className="text-xl font-serif font-black text-gray-900 leading-none">{animal.count}</p>
                      </div>
                      <div className="bg-gray-50/50 p-3 rounded-xl border border-gray-100 flex flex-col justify-center transition-all group-hover:bg-white group-hover:shadow-md">
                        <p className="text-[7px] text-emerald-600 uppercase font-black mb-0.5 opacity-60 tracking-widest leading-none italic">Verified</p>
                        <p className="text-xl font-serif font-black text-emerald-700 leading-none">{animal.registeredCount || 0}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-auto relative z-10">
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-lg bg-gray-50 flex items-center justify-center border border-gray-50">
                          <ShieldCheck className="w-3 h-3 text-brand/40" />
                        </div>
                        <div>
                          <p className="text-[6.5px] font-black uppercase tracking-widest text-gray-400 leading-none mb-0.5">Updated</p>
                          <p className="text-[9px] font-bold text-gray-900 tracking-tight leading-none">
                            {new Date(animal.lastUpdated).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAnimalForDetails(animal);
                        }}
                        className="px-3 py-1.5 bg-brand text-white font-black text-[8px] uppercase tracking-widest rounded-lg shadow-md transition-all active:scale-95"
                      >
                        Enter
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              
              {animals.length === 0 && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="col-span-full text-center py-32 bg-white/40 backdrop-blur-sm rounded-[4rem] border-4 border-dashed border-gray-100"
                >
                  <div className="w-24 h-24 bg-white/60 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-sm">
                    <Bird className="text-brand/20" size={48} />
                  </div>
                  <h3 className="text-2xl font-serif font-bold text-gray-400 mb-3">No Livestock Residents</h3>
                  <p className="text-sm text-gray-400 max-w-xs mx-auto font-medium leading-relaxed italic">Begin your digital estate mapping by registering your first livestock inventory group.</p>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal 
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, id: '' })}
        onConfirm={() => handleDelete(deleteConfirm.id)}
        title="Delete Livestock Record"
        message="Are you sure you want to delete this record? This action cannot be undone."
      />


      {isReportModalOpen && (
        <ReportCustomizerModal 
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          title="Livestock Inventory Report"
          availableColumns={['Type', 'Age Group', 'Count', 'Health Status', 'Notes', 'Last Updated']}
          columnMapping={{
            'Type': 'type',
            'Age Group': 'ageGroup',
            'Count': 'count',
            'Health Status': 'healthStatus',
            'Notes': 'notes',
            'Last Updated': 'lastUpdated'
          }}
          data={animals}
          fileName="livestock_report"
        />
      )}

    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
