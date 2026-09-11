import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreError';
import { Livestock, IndividualLivestock } from '../types';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { 
  TrendingUp, 
  AlertTriangle, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight,
  Egg,
  Bird,
  Package,
  ShieldCheck
} from 'lucide-react';
import { format, subDays, startOfDay, addHours, parseISO } from 'date-fns';
import { Cloud, Sun as SunIcon, CloudRain, Thermometer, Wind, Plus, ClipboardList, Activity, ShoppingCart, DollarSign, Clock, MapPin, Bell, Info, Droplets, ChevronDown, Home, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import QuickLogModal from './QuickLogModal';
import FarmManager from './FarmManager';
import { fetchWeather, getPlantingSeasonAdvice, WeatherData } from '../services/weatherService';
import { Farm } from '../types';
import { useFarm } from '../context/FarmContext';

export default function Dashboard() {
  const { selectedFarm, farms } = useFarm();
  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false);
  const [isFarmManagerOpen, setIsFarmManagerOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [stats, setStats] = useState({
    totalLivestock: 0,
    activeLivestock: 0,
    incompleteLivestock: 0,
    dailyProduction: 0,
    inventoryAlerts: 0,
    monthlyRevenue: 0
  });
  const [productionData, setProductionData] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [unregisteredAlerts, setUnregisteredAlerts] = useState<any[]>([]);
  const [vaccinationAlerts, setVaccinationAlerts] = useState<any[]>([]);
  const [isConfirmingVacc, setIsConfirmingVacc] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [location, setLocation] = useState({ lat: -1.286389, lon: 36.817223 }); // Default Nairobi

  useEffect(() => {
    // Real-time clock
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Fetch real-time weather
    const updateWeather = async () => {
      const data = await fetchWeather(location.lat, location.lon);
      setWeather(data);
    };

    updateWeather();
    const weatherTimer = setInterval(updateWeather, 15 * 60 * 1000); // Every 15 mins
    return () => clearInterval(weatherTimer);
  }, [location]);

  useEffect(() => {
    // Try to get user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      });
    }
  }, []);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user || !selectedFarm) return;

    // Fetch Livestock Stats and detect unregistered animals
    const qLivestock = query(
      collection(db, 'livestock'), 
      where('ownerId', '==', user.uid),
      where('farmId', '==', selectedFarm.id)
    );
    
    const qIndividuals = query(
      collection(db, 'individual_livestock'),
      where('ownerId', '==', user.uid),
      where('farmId', '==', selectedFarm.id)
    );

    let groupsData: any[] = [];
    let individualsData: any[] = [];

    const updateLivestockStats = () => {
      let targetTotal = 0;
      let activeCount = 0;
      let incompleteCount = 0;
      const alerts: any[] = [];
      
      // Count individuals and their status
      individualsData.forEach(ind => {
        if (ind.status === 'active' || !ind.status) { // Default to active if status is missing but Record exists
          // If it has tagId and name, it's considered basically "active/complete" for counting
          if (ind.tagId) activeCount++;
          else incompleteCount++;
        } else if (ind.status === 'incomplete') {
          incompleteCount++;
        }
      });

      // Compare with groups (Target Inventory)
      groupsData.forEach(group => {
        targetTotal += group.count;
        const registeredForGroup = individualsData.filter(i => i.groupId === group.id).length;
        if (registeredForGroup < group.count) {
          alerts.push({
            id: group.id,
            groupId: group.id,
            type: group.type,
            missing: group.count - registeredForGroup
          });
        }
      });
      
      setUnregisteredAlerts(alerts);
      setStats(prev => ({ 
        ...prev, 
        totalLivestock: targetTotal,
        activeLivestock: activeCount,
        incompleteLivestock: incompleteCount
      }));
    };

    const unsubIndividuals = onSnapshot(qIndividuals, (indSnap) => {
      const indivs = indSnap.docs.map(doc => ({ ...doc.data() as any, id: doc.id }));
      individualsData = indivs;
      
      // Update individual counts and look for vaccination alerts
      const now = new Date();
      const medAlerts: any[] = [];
      
      indivs.forEach(ind => {
        if (ind.nextVaccinationDate) {
          const dueDate = new Date(ind.nextVaccinationDate);
          if (dueDate <= now && ind.healthStatus !== 'Dead') {
            medAlerts.push({
              id: `vacc-${ind.id}`,
              animalId: ind.id,
              type: ind.type || 'Livestock',
              name: ind.name,
              dueDate: ind.nextVaccinationDate
            });
          }
        }
      });
      
      setVaccinationAlerts(medAlerts);
      updateLivestockStats();
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'individual_livestock');
    });

    const unsubGroups = onSnapshot(qLivestock, (snapshot) => {
      groupsData = snapshot.docs.map(doc => ({ ...doc.data() as Livestock, id: doc.id }));
      updateLivestockStats();
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'livestock');
    });

    // Fetch Production Data (Last 7 days)
    const qProduction = query(
      collection(db, 'production'), 
      where('ownerId', '==', user.uid),
      where('farmId', '==', selectedFarm.id)
    );
    const unsubProduction = onSnapshot(qProduction, (snapshot) => {
      const data: any[] = [];
      let dailyTotal = 0;
      const today = format(new Date(), 'yyyy-MM-dd');
      
      snapshot.forEach(doc => {
        const d = doc.data();
        data.push({ ...d, id: doc.id });
        if (d.date === today) dailyTotal += d.quantity;
      });

      // Process for chart
      const chartData = Array.from({ length: 7 }).map((_, i) => {
        const date = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd');
        const dayTotal = data
          .filter(d => d.date === date)
          .reduce((sum, d) => sum + d.quantity, 0);
        return { name: format(subDays(new Date(), 6 - i), 'EEE'), value: dayTotal };
      });

      setProductionData(chartData);
      setStats(prev => ({ ...prev, dailyProduction: dailyTotal }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'production');
    });

    // Fetch Inventory Alerts
    const qInventory = query(
      collection(db, 'inventory'), 
      where('ownerId', '==', user.uid),
      where('farmId', '==', selectedFarm.id)
    );
    const unsubInventory = onSnapshot(qInventory, (snapshot) => {
      let alerts = 0;
      const items: any[] = [];
      snapshot.forEach(doc => {
        const d = doc.data();
        if (d.quantity <= d.minThreshold) alerts++;
        items.push({ ...d, id: doc.id });
      });
      setInventoryItems(items);
      setStats(prev => ({ ...prev, inventoryAlerts: alerts }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'inventory');
    });

    return () => {
      unsubGroups && unsubGroups();
      unsubIndividuals && unsubIndividuals();
      unsubProduction();
      unsubInventory();
    };
  }, [selectedFarm?.id, auth.currentUser?.uid]);

  const handleConfirmVaccination = async (e: React.MouseEvent, alert: any) => {
    e.stopPropagation();
    const user = auth.currentUser;
    if (!user) return;

    setIsConfirmingVacc(alert.animalId);
    try {
      const indivRef = doc(db, 'individual_livestock', alert.animalId);
      const nextDue = new Date();
      nextDue.setMonth(nextDue.getMonth() + 6);

      await updateDoc(indivRef, {
        lastVaccinationDate: new Date().toISOString(),
        nextVaccinationDate: nextDue.toISOString(),
        updatedAt: serverTimestamp()
      });

      await addDoc(collection(db, 'activity_logs'), {
        ownerId: user.uid,
        farmId: selectedFarm?.id,
        type: 'Medical',
        entityId: alert.animalId,
        entityName: alert.name,
        action: 'Vaccination Confirmed',
        timestamp: serverTimestamp(),
        details: `Overdue vaccination confirmed from dashboard.`
      });

    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'individual_livestock');
    } finally {
      setIsConfirmingVacc(null);
    }
  };

  const user = auth.currentUser;
  const firstName = user?.displayName?.split(' ')[0] || 'Farmer';
  const plantingAdvice = getPlantingSeasonAdvice(currentTime.getMonth());

  return (
    <div className="space-y-10 2xl:space-y-20 relative fluid-container">
      {/* Farm Selector Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white/60 backdrop-blur-md p-3 rounded-2xl border border-white shadow-sm"
      >
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-10 h-10 md:w-11 md:h-11 bg-brand rounded-xl flex items-center justify-center shadow-lg shadow-brand/10 transition-transform hover:scale-105 duration-300 shrink-0">
            <Home 
              className="text-white" 
              size={20} 
              strokeWidth={1.5}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="text-base font-serif font-black text-gray-900 tracking-tight truncate">{selectedFarm?.name || 'My Estate'}</h3>
              <button 
                onClick={() => setIsFarmManagerOpen(true)}
                className="p-1 hover:bg-[#5A5A40]/10 rounded-lg text-[#5A5A40] transition-all active:scale-95 shrink-0"
              >
                <ChevronDown size={14} />
              </button>
            </div>
            <p className="text-[7px] text-[#5A5A40] font-black uppercase tracking-widest flex items-center gap-1 mt-0.5 opacity-60">
              <MapPin size={8} />
              {selectedFarm?.location || 'Uncharted'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsFarmManagerOpen(true)}
            className="px-4 py-2 text-[9px] font-black text-brand bg-brand/5 rounded-xl hover:bg-brand hover:text-white transition-all duration-300 flex items-center gap-1.5 group border border-brand/10 uppercase tracking-widest"
          >
            <Settings size={14} className="group-hover:rotate-90 transition-transform duration-500" />
            Registry
          </button>
        </div>
      </motion.div>

      {/* Weather & Welcome */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-8 bg-white p-5 md:p-6 rounded-2xl border border-gray-100 soft-shadow flex flex-col justify-between relative overflow-hidden group min-h-[160px]"
        >
          <div className="relative z-10">
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex items-center gap-1.5 text-[#5A5A40] mb-2"
            >
              <div className="p-1 bg-[#5A5A40]/5 rounded-md">
                <Clock size={10} />
              </div>
              <span className="text-[7.5px] font-black tracking-widest uppercase opacity-60">
                {format(currentTime, 'EEEE')} • {format(currentTime, 'MMMM do')} • {format(currentTime, 'HH:mm')}
              </span>
            </motion.div>
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-2xl md:text-3xl font-serif font-black text-gray-900 mb-2 leading-tight tracking-tight"
            >
              Good {currentTime.getHours() < 12 ? 'Morning' : currentTime.getHours() < 18 ? 'Afternoon' : 'Evening'}, <br/>
              <span className="text-[#5A5A40] italic">{firstName}.</span>
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-gray-500 text-[11px] md:text-xs max-w-sm leading-relaxed font-medium italic border-l-2 border-[#5A5A40]/20 pl-2.5"
            >
              {plantingAdvice}
            </motion.p>
          </div>
          
          <div className="absolute bottom-4 right-6 opacity-5 group-hover:opacity-10 transition-opacity duration-500">
             <Bird size={80} className="-rotate-12" />
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-4 bg-[#4A4A30] p-5 rounded-2xl shadow-xl shadow-[#5A5A40]/20 text-white flex flex-col justify-between relative overflow-hidden group border border-white/10 min-h-[160px]"
        >
          <div className="relative z-20 h-full flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1.5 p-1 bg-black/20 rounded-lg backdrop-blur-md border border-white/5">
                <MapPin size={8} className="text-white/80" />
                <span className="text-[7.5px] font-black text-white uppercase tracking-widest">Local Outlook</span>
              </div>
              <motion.div 
                animate={{ y: [0, -2, 0] }}
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                className="p-1 px-2 bg-white/20 rounded-lg backdrop-blur-xl border border-white/10"
              >
                {weather?.condition.includes('Rain') ? <CloudRain className="w-5 h-5" /> : weather?.condition.includes('Cloud') ? <Cloud className="w-5 h-5" /> : <SunIcon className="w-5 h-5" />}
              </motion.div>
            </div>
            
            <div>
              <div className="flex items-baseline gap-1 mb-0.5 text-white">
                <h4 className="text-3xl md:text-4xl font-serif font-black tracking-tighter">{weather?.temp || '--'}</h4>
                <span className="text-base font-serif font-bold opacity-60">°C</span>
              </div>
              <p className="text-[9px] font-black uppercase tracking-widest text-white/80 italic">{weather?.condition || 'Analyzing...'}</p>
              
              <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-white/10">
                <div className="space-y-0.5">
                  <p className="text-[7px] uppercase font-black tracking-widest text-white/40">Humidity</p>
                  <p className="text-[10px] font-black flex items-center gap-1"><Droplets size={10} className="text-white/60" /> {weather?.humidity || '--'}%</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[7px] uppercase font-black tracking-widest text-white/40">Wind</p>
                  <p className="text-[10px] font-black flex items-center gap-1"><Wind size={10} className="text-white/60" /> {weather?.windSpeed || '--'} <span className="text-[7px] opacity-40">km/h</span></p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Weather Alerts & Logic Detectors */}
      <AnimatePresence>
        <motion.div 
          layout
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {(weather?.alerts || []).map((alert, idx) => (
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              whileHover={{ scale: 1.01 }}
              transition={{ delay: 0.1 * idx }}
              key={`weather-${idx}`} 
              className="flex items-center gap-4 bg-amber-50/80 backdrop-blur-sm border border-amber-100 p-4 rounded-2xl text-amber-900 shadow-sm group cursor-pointer hover:bg-white transition-all"
            >
              <div className="p-2 bg-amber-200/50 rounded-xl text-amber-600 transition-transform group-hover:scale-105">
                <Bell size={18} />
              </div>
              <div className="flex-1">
                <p className="text-[8px] font-black uppercase tracking-widest text-amber-600 mb-0.5">Alert</p>
                <p className="text-[11px] font-bold leading-normal">{alert}</p>
              </div>
              <ArrowUpRight size={14} className="text-amber-300 opacity-0 group-hover:opacity-100 transition-all shrink-0" />
            </motion.div>
          ))}

          {vaccinationAlerts.map((alert, idx) => (
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              whileHover={{ scale: 1.01 }}
              transition={{ delay: 0.1 * idx }}
              key={`vacc-${idx}`} 
              className="group flex items-center gap-4 bg-emerald-50/80 backdrop-blur-sm border border-emerald-100 p-4 rounded-2xl text-emerald-900 shadow-sm cursor-pointer hover:bg-white transition-all border-l-2 border-l-emerald-500"
            >
              <div className="p-2 bg-emerald-100 rounded-xl text-emerald-600">
                <ShieldCheck size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[8px] font-black uppercase tracking-widest text-emerald-600 mb-0.5">Medical Due</p>
                <p className="text-[11px] font-bold leading-none truncate"><span className="text-emerald-700">{alert.name}</span> vaccination.</p>
              </div>
              <button
                disabled={isConfirmingVacc === alert.animalId}
                onClick={(e) => handleConfirmVaccination(e, alert)}
                className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                Done
              </button>
            </motion.div>
          ))}

          {unregisteredAlerts.map((alert, idx) => (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              whileHover={{ scale: 1.01 }}
              transition={{ delay: 0.1 * idx }}
              key={`reg-${idx}`} 
              className="flex items-center gap-4 bg-red-50/80 backdrop-blur-sm border border-red-100 p-4 rounded-2xl text-red-900 shadow-sm cursor-pointer hover:bg-white transition-all group border-l-2 border-l-red-500"
            >
              <div className="p-2 bg-red-100 rounded-xl text-red-600">
                <AlertTriangle size={18} />
              </div>
              <div className="flex-1">
                <p className="text-[8px] font-black uppercase tracking-widest text-red-700 mb-0.5">Census Anomaly</p>
                <p className="text-[11px] font-bold leading-normal">{alert.missing} {alert.type} records pending registration.</p>
              </div>
              <ArrowUpRight size={14} className="text-red-300 opacity-0 group-hover:opacity-100 transition-all shrink-0" />
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>

      {/* Hourly Outlook */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="bg-white/40 backdrop-blur-md p-4 rounded-2xl border border-white shadow-xl shadow-brand/5"
      >
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-1.5">
            <div className="p-1 bg-brand/10 rounded-md text-brand">
              <Info size={12} />
            </div>
            <h3 className="text-sm font-serif font-black text-gray-900 tracking-tight">Hourly Forecast</h3>
          </div>
          <div className="text-[7px] font-black text-brand uppercase tracking-widest bg-brand/5 px-2 py-0.5 rounded-full border border-brand/10">
            Live
          </div>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {weather?.forecast.slice(0, 6).map((f, idx) => (
            <motion.div 
              whileHover={{ y: -2, scale: 1.02 }}
              key={idx} 
              className="flex flex-col items-center p-3 rounded-xl bg-white shadow-sm border border-gray-50 transition-all"
            >
              <span className="text-[8px] font-black text-brand uppercase mb-1.5 opacity-50 tracking-widest">{format(parseISO(f.time), 'HH:mm')}</span>
              <div className="text-brand mb-2">
                {f.condition.includes('Rain') ? <CloudRain className="w-4 h-4" /> : f.condition.includes('Cloud') ? <Cloud className="w-4 h-4" /> : <SunIcon className="w-4 h-4" />}
              </div>
              <span className="text-base font-serif font-black text-gray-900 mb-0.5">{f.temp}°C</span>
              <div className="flex items-center gap-0.5 bg-blue-50 px-1.5 py-0.5 rounded-full">
                <Droplets size={6} className="text-blue-500" />
                <span className="text-[7.5px] font-black text-blue-600">{f.precipitation}%</span>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Quick Performance Metrics */}
      <div className="fluid-grid">
        <StatCard 
          title="Estate Census" 
          value={`${stats.activeLivestock}`} 
          subValue={`/ ${stats.totalLivestock} Total`}
          icon={Bird} 
          color="bg-[#C4A484]"
          trend={stats.incompleteLivestock > 0 ? `${stats.incompleteLivestock} Incomplete` : "All Registered"}
          isUp={stats.incompleteLivestock === 0}
          isWarning={stats.incompleteLivestock > 0}
          delay={0.1}
        />
        <StatCard 
          title="Daily Output" 
          value={stats.dailyProduction.toLocaleString()} 
          icon={TrendingUp} 
          color="bg-brand"
          trend="+12%"
          isUp={true}
          delay={0.2}
        />
        <StatCard 
          title="Inventory Buffer" 
          value={stats.inventoryAlerts} 
          icon={Package} 
          color="bg-[#D2B48C]"
          trend={stats.inventoryAlerts > 0 ? "Depleting" : "Optimal"}
          isUp={stats.inventoryAlerts === 0}
          isWarning={stats.inventoryAlerts > 0}
          delay={0.3}
        />
        <StatCard 
          title="Est. Harvest Revenue" 
          value={`KSh ${stats.monthlyRevenue.toLocaleString()}`} 
          icon={DollarSign} 
          color="bg-[#5A5A40]"
          trend="+5.2%"
          isUp={true}
          delay={0.4}
        />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="grid grid-cols-1 lg:grid-cols-12 gap-8"
      >
        {/* Production Chart */}
        <div className="lg:col-span-8 bg-white p-5 rounded-2xl shadow-xl shadow-brand/5 border border-gray-50 flex flex-col min-h-[300px]">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center shrink-0">
                <TrendingUp size={16} />
              </div>
              <div>
                <h3 className="text-sm font-serif font-black text-gray-900 tracking-tight">Analytics</h3>
                <p className="text-[7.5px] text-brand font-black uppercase tracking-widest opacity-40 leading-none">Yield History</p>
              </div>
            </div>
          </div>
          <div className="h-48 w-full flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={productionData}>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f5f5f0" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 8, fill: '#999', fontWeight: 900 }}
                  dy={8}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 8, fill: '#999', fontWeight: 900 }}
                  dx={-4}
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    padding: '8px',
                    fontSize: '9px',
                    fontWeight: 900
                  }}
                  itemStyle={{ color: '#5A5A40' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#5A5A40" 
                  strokeWidth={2} 
                  dot={{ r: 3, fill: '#fff', strokeWidth: 1.5, stroke: '#5A5A40' }}
                  activeDot={{ r: 4, strokeWidth: 0, fill: '#5A5A40' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Inventory Criticality List */}
        <div className="lg:col-span-4 bg-white p-5 rounded-2xl shadow-xl shadow-brand/5 border border-gray-100 flex flex-col min-h-[300px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-serif font-black text-gray-900 tracking-tight">Inventory Status</h3>
            <div className="p-1.5 bg-brand/10 text-brand rounded-md">
              <Package size={14} />
            </div>
          </div>
          
          <div className="space-y-1.5 flex-1 overflow-y-auto custom-scrollbar pr-1 max-h-[220px]">
            <AnimatePresence>
              {inventoryItems.slice(0, 5).map((item, idx) => (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * idx }}
                  key={item.id} 
                  className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50/50 border border-gray-100 transition-all group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                      item.quantity <= item.minThreshold ? "bg-red-50 text-red-600" : "bg-brand/5 text-brand"
                    )}>
                      <Package size={14} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-gray-900 truncate leading-none mb-1">{item.name}</p>
                      <p className="text-[7.5px] text-gray-400 font-black uppercase tracking-widest opacity-60 leading-none">{item.category}</p>
                    </div>
                  </div>
                  <div className="text-right pl-2 shrink-0">
                    <p className="text-[10px] font-black text-gray-900 leading-none">{item.quantity} <span className="text-[7.5px] opacity-40">{item.unit}</span></p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          
          <button className="w-full mt-4 py-2 bg-brand/5 text-brand rounded-xl font-black uppercase tracking-widest text-[8px] hover:bg-brand hover:text-white transition-all border border-brand/10">
            Expand Ledger
          </button>
        </div>
      </motion.div>

      {/* Quick Actions Floating Button */}
      <div className="fixed bottom-6 right-6 md:bottom-10 md:right-10 flex flex-col items-end gap-6 z-40">
        <motion.button 
          whileHover={{ scale: 1.08, y: -5 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsQuickLogOpen(true)}
          className="bg-brand text-white w-[50px] h-[50px] rounded-2xl md:rounded-[2rem] shadow-2xl shadow-brand/40 cursor-pointer flex items-center justify-center transition-all border-4 border-white border-double group relative"
        >
          <Plus size={28} className="md:w-9 md:h-9 group-hover:rotate-90 transition-transform duration-500" />
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileHover={{ opacity: 1, x: -80 }}
            className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 bg-gray-900 text-white px-5 py-2 rounded-xl text-xs font-bold whitespace-nowrap pointer-events-none uppercase tracking-widest shadow-xl"
          >
             Quick Action Record
          </motion.div>
        </motion.button>
      </div>

      <AnimatePresence>
        {isQuickLogOpen && (
          <QuickLogModal 
            isOpen={isQuickLogOpen} 
            onClose={() => setIsQuickLogOpen(false)} 
          />
        )}
      </AnimatePresence>

      <FarmManager 
        isOpen={isFarmManagerOpen}
        onClose={() => setIsFarmManagerOpen(false)}
      />
    </div>
  );
}

function StatCard({ title, value, subValue, icon: Icon, color, trend, isUp, isWarning, delay }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay }}
      whileHover={{ y: -2 }}
      className="bg-white/80 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-white hover:shadow-lg transition-all group overflow-hidden flex flex-col h-full"
    >
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className={cn("w-8 h-8 rounded-lg text-white transition-transform group-hover:scale-105 duration-500 flex items-center justify-center shadow-lg shadow-brand/10", color)}>
          <Icon size={16} />
        </div>
        <div className={cn(
          "flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest leading-none",
          isWarning ? "bg-amber-50 text-amber-600" : (isUp ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600")
        )}>
          {trend}
        </div>
      </div>
      <div className="flex-1">
        <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-0.5 opacity-60 leading-none">{title}</p>
        <div className="flex items-baseline gap-1.5">
          <p className="text-2xl font-serif font-black text-gray-900 tracking-tighter leading-none">{value}</p>
          {subValue && <span className="text-[8px] font-black text-gray-300 uppercase tracking-widest">{subValue}</span>}
        </div>
      </div>
    </motion.div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
