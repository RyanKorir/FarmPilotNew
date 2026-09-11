import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  orderBy, 
  limit,
  serverTimestamp,
  doc,
  updateDoc,
  getDocs
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreError';
import { 
  X, 
  Heart, 
  Activity, 
  ShieldCheck, 
  Dna, 
  TrendingUp, 
  DollarSign, 
  Clock, 
  Calendar,
  ChevronRight,
  Plus,
  Scale,
  Thermometer,
  Stethoscope,
  Milk,
  Info,
  History,
  AlertCircle,
  Save,
  Download,
  Trash2,
  Baby,
  FileText,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { generateSectionedPDFReport } from '../utils/reportGenerator';
import { 
  IndividualLivestock, 
  AnimalHealthRecord, 
  AnimalVaccination, 
  AnimalBreedingRecord, 
  AnimalProductionLog, 
  AnimalWeightLog 
} from '../types';
import { format, differenceInDays, addWeeks, parseISO } from 'date-fns';
import { PRODUCT_UNITS, ANIMAL_PRODUCTS } from '../constants';
import { calculateAge, calculateTimeOnFarm } from '../utils/animalUtils';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

function cn(...inputs: (string | boolean | undefined)[]) {
  return inputs.filter(Boolean).join(' ');
}

interface Props {
  animal: IndividualLivestock;
  onClose: () => void;
}

type TabType = 'Overview' | 'Timeline' | 'Health' | 'Breeding' | 'Production' | 'Growth' | 'Financial';

export default function AnimalProfile({ animal: initialAnimal, onClose }: { animal: IndividualLivestock, onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<TabType>('Overview');
  const [animal, setAnimal] = useState<IndividualLivestock>(initialAnimal);
  const [healthRecords, setHealthRecords] = useState<AnimalHealthRecord[]>([]);
  const [vaccinations, setVaccinations] = useState<AnimalVaccination[]>([]);
  const [breedingRecords, setBreedingRecords] = useState<AnimalBreedingRecord[]>([]);
  const [productionLogs, setProductionLogs] = useState<AnimalProductionLog[]>([]);
  const [weightLogs, setWeightLogs] = useState<AnimalWeightLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const unsub = onSnapshot(doc(db, 'individual_livestock', initialAnimal.id), (doc) => {
      if (doc.exists()) setAnimal({ ...doc.data() as IndividualLivestock, id: doc.id });
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `individual_livestock/${initialAnimal.id}`);
    });

    return () => unsub();
  }, [initialAnimal.id]);

  const generateBirthCertificate = () => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const brandColor: [number, number, number] = [90, 90, 64];
    const accentColor: [number, number, number] = [140, 140, 120];

    // 1. Sleek Minimal Border
    doc.setDrawColor(brandColor[0], brandColor[1], brandColor[2]);
    doc.setLineWidth(1);
    doc.rect(7, 7, pageWidth - 14, pageHeight - 14);
    
    doc.setLineWidth(0.3);
    doc.setDrawColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.rect(10, 10, pageWidth - 20, pageHeight - 20);

    // Subtle Corner Markers
    const markSize = 5;
    doc.setLineWidth(0.8);
    doc.setDrawColor(brandColor[0], brandColor[1], brandColor[2]);
    // Top Left
    doc.line(10, 10, 10 + markSize, 10);
    doc.line(10, 10, 10, 10 + markSize);
    // Top Right
    doc.line(pageWidth - 10, 10, pageWidth - 10 - markSize, 10);
    doc.line(pageWidth - 10, 10, pageWidth - 10, 10 + markSize);
    // Bottom Left
    doc.line(10, pageHeight - 10, 10 + markSize, pageHeight - 10);
    doc.line(10, pageHeight - 10, 10, pageHeight - 10 - markSize);
    // Bottom Right
    doc.line(pageWidth - 10, pageHeight - 10, pageWidth - 10 - markSize, pageHeight - 10);
    doc.line(pageWidth - 10, pageHeight - 10, pageWidth - 10, pageHeight - 10 - markSize);

    // 2. Sophisticated Background/Watermark
    doc.saveGraphicsState();
    doc.setGState(new (doc as any).GState({ opacity: 0.02 }));
    doc.setTextColor(brandColor[0], brandColor[1], brandColor[2]);
    doc.setFontSize(80);
    doc.setFont('times', 'bold');
    doc.text('OFFICIAL REGISTRY', pageWidth / 2, pageHeight / 2, { 
      align: 'center', 
      angle: 45 
    });
    doc.restoreGraphicsState();

    // 3. Header Section
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('DEPARTMENT OF BIOLOGICAL RECORDS & PEDIGREE', pageWidth / 2, 25, { align: 'center' });

    doc.setTextColor(brandColor[0], brandColor[1], brandColor[2]);
    doc.setFontSize(32);
    doc.setFont('times', 'bold');
    doc.text('CERTIFICATE OF BIRTH', pageWidth / 2, 42, { align: 'center' });

    doc.setDrawColor(brandColor[0], brandColor[1], brandColor[2]);
    doc.setLineWidth(0.4);
    doc.line(pageWidth / 4, 48, (pageWidth * 3) / 4, 48);

    // 4. Content Grid - Spaced out to avoid "mushing"
    const leftColX = 40;
    const midX = pageWidth / 2;
    const rightColX = pageWidth / 2 + 15;
    let currentY = 70;
    const rowHeight = 22; // Increased from 15

    const dataPairs = [
      { label: 'ANIMAL NAME', value: animal.name || 'Unnamed' },
      { label: 'OFFICIAL TAG ID', value: animal.tagId || 'Pending' },
      { label: 'SPECIES / BREED', value: animal.breed || 'Regional Stock' },
      { label: 'GENDER', value: animal.gender || 'Unknown' },
      { label: 'DATE OF BIRTH', value: animal.dob ? format(new Date(animal.dob), 'MMMM dd, yyyy') : 'Pending' },
      { label: 'INITIAL WEIGHT', value: animal.initialWeight ? `${animal.initialWeight} kg` : 'N/A' },
    ];

    dataPairs.forEach((pair, index) => {
        const x = index % 2 === 0 ? leftColX : rightColX;
        const rowY = currentY + (Math.floor(index / 2) * rowHeight);
        
        // Label
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
        doc.text(pair.label, x, rowY - 6);
        
        // Value
        doc.setFontSize(14);
        doc.setFont('times', 'bolditalic');
        doc.setTextColor(30, 30, 30);
        doc.text(pair.value.toString().toUpperCase(), x, rowY + 2);

        // Underline
        doc.setDrawColor(240, 240, 240);
        doc.setLineWidth(0.1);
        doc.line(x, rowY + 5, x + 85, rowY + 5);
    });

    currentY += (Math.ceil(dataPairs.length / 2) * rowHeight) + 12;

    // Lineage Section
    doc.setDrawColor(brandColor[0], brandColor[1], brandColor[2]);
    doc.setLineWidth(0.15);
    doc.line(leftColX, currentY - 8, pageWidth - leftColX, currentY - 8);

    doc.setFontSize(10);
    doc.setFont('times', 'bolditalic');
    doc.setTextColor(brandColor[0], brandColor[1], brandColor[2]);
    doc.text('GENETIC LINEAGE PROFILE', midX, currentY - 1, { align: 'center' });

    currentY += 8;
    
    const podWidth = 80; // Increased
    const podHeight = 18; // Increased

    const drawPod = (x: number, y: number, label: string, value: string) => {
      doc.setDrawColor(240, 240, 230);
      doc.setFillColor(254, 254, 252);
      doc.roundedRect(x, y, podWidth, podHeight, 1.5, 1.5, 'FD');
      
      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.text(label, x + 5, y + 6);
      
      doc.setFontSize(11);
      doc.setFont('times', 'bold');
      doc.setTextColor(40, 40, 40);
      doc.text(value, x + 5, y + 13, { maxWidth: podWidth - 10 });
    };

    drawPod(leftColX + 5, currentY, 'MATERNAL (DAM)', animal.motherId || 'Registered Stock');
    drawPod(midX + 15, currentY, 'PATERNAL (SIRE)', animal.fatherId || 'Registered Stock');

    // 5. Professional Footer
    const footerY = pageHeight - 35;
    
    // Signatures
    doc.setDrawColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.setLineWidth(0.2);
    doc.line(leftColX, footerY - 5, leftColX + 60, footerY - 5);
    doc.line(pageWidth - leftColX - 60, footerY - 5, pageWidth - leftColX, footerY - 5);
    
    doc.setFontSize(6);
    doc.setTextColor(150, 150, 150);
    doc.text('AUTHORIZED REGISTRAR', leftColX + 30, footerY, { align: 'center' });
    doc.text('CERTIFYING VETERINARIAN', pageWidth - leftColX - 30, footerY, { align: 'center' });

    // Official Seal
    const sealX = midX;
    const sealY = footerY + 2;
    doc.setDrawColor(brandColor[0], brandColor[1], brandColor[2]);
    doc.setLineWidth(0.5);
    doc.circle(sealX, sealY, 15);
    doc.setLineWidth(0.1);
    doc.circle(sealX, sealY, 13);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.text('AUTHENTIC', sealX, sealY - 5, { align: 'center' });
    doc.setFontSize(10);
    doc.text('CERTIFIED', sealX, sealY + 1, { align: 'center' });
    doc.setFontSize(5);
    doc.text('BIOLOGICAL ASSET', sealX, sealY + 6, { align: 'center' });

    // Meta Text
    doc.setFontSize(7);
    doc.setTextColor(190, 190, 180);
    const metaY = pageHeight - 15;
    doc.text(`Verification Hash: ${animal.id.toUpperCase()}`, 15, metaY);
    doc.text(`Authenticated Document Generated: ${format(new Date(), 'PPpp')}`, pageWidth - 15, metaY, { align: 'right' });

    doc.save(`${animal.name}_Birth_Certificate.pdf`);
  };

  const generateFullHistory = () => {
    const sections = [
      {
        title: "Subject Biological Metadata",
        columns: ['Metric', 'Detail'],
        data: [
          ['Name', animal.name],
          ['Tag ID', animal.tagId || 'N/A'],
          ['Exact Age', calculateAge(animal.dob)],
          ['Tenure (On Farm)', calculateTimeOnFarm(animal.dateAcquired, animal.dateRegistered)],
          ['Breed', animal.breed || 'N/A'],
          ['Gender', animal.gender],
          ['DOB', animal.dob ? format(new Date(animal.dob), 'PP') : 'N/A'],
          ['Age Group', animal.ageGroup || 'N/A'],
          ['Farm Estate ID', animal.farmId],
          ['Status', animal.healthStatus]
        ]
      },
      {
        title: "Health & Immunization History",
        columns: ['Date', 'Type', 'Description', 'Action/Notes'],
        data: [
          ...vaccinations.map(v => [format(new Date(v.dateGiven), 'PP'), 'Vaccination', v.vaccineName, v.notes || '-']),
          ...healthRecords.map(h => [format(new Date(h.date), 'PP'), h.type, h.diagnosis || '-', h.treatment || '-'])
        ].sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
      },
      {
        title: "Production Registry",
        columns: ['Date', 'Category', 'Yield', 'Notes'],
        data: productionLogs.map(p => [
          format(new Date(p.date), 'PP'),
          p.type,
          `${p.quantity} ${p.unit}`,
          p.notes || '-'
        ])
      },
      {
        title: "Growth & Weight Monitoring",
        columns: ['Date', 'Weight (kg)', 'Observation'],
        data: weightLogs.map(w => [
          format(new Date(w.date), 'PP'),
          `${w.weight}`,
          w.notes || '-'
        ])
      }
    ];

    // Filter out empty sections
    const activeSections = sections.filter(s => s.data.length > 0);

    generateSectionedPDFReport(
      "Comprehensive Animal History Record",
      `${animal.name} | REGISTRY_ID: ${animal.id.substring(0, 8)}`,
      activeSections,
      `${animal.name}_Strategic_History`,
      {
        footer: {
          label: 'Cumulative Production Yield',
          value: `${stats.totalProduction} units`
        }
      }
    );
  };

  // Modal States
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);
  const [isVaccineModalOpen, setIsVaccineModalOpen] = useState(false);
  const [isBreedingModalOpen, setIsBreedingModalOpen] = useState(false);
  const [isProductionModalOpen, setIsProductionModalOpen] = useState(false);
  const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);

  const safeDate = (dateStr: string | undefined) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  };

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const baseQuery = (col: string) => query(
      collection(db, col),
      where('animalId', '==', animal.id),
      where('ownerId', '==', user.uid),
      orderBy('date', 'desc')
    );

    // Specific orderings/queries
    const unsubHealth = onSnapshot(baseQuery('animal_health'), (snap) => {
      setHealthRecords(snap.docs.map(d => ({ ...d.data(), id: d.id } as AnimalHealthRecord)));
    });

    const unsubVacc = onSnapshot(query(
      collection(db, 'animal_vaccinations'),
      where('animalId', '==', animal.id),
      where('ownerId', '==', user.uid),
      orderBy('dateGiven', 'desc')
    ), (snap) => {
      setVaccinations(snap.docs.map(d => ({ ...d.data(), id: d.id } as AnimalVaccination)));
    });

    const unsubBreeding = onSnapshot(query(
      collection(db, 'animal_breeding'),
      where('animalId', '==', animal.id),
      where('ownerId', '==', user.uid),
      orderBy('matingDate', 'desc')
    ), (snap) => {
      setBreedingRecords(snap.docs.map(d => ({ ...d.data(), id: d.id } as AnimalBreedingRecord)));
    });

    const unsubProd = onSnapshot(baseQuery('animal_production'), (snap) => {
      setProductionLogs(snap.docs.map(d => ({ ...d.data(), id: d.id } as AnimalProductionLog)));
    });

    const unsubWeight = onSnapshot(baseQuery('animal_weight_logs'), (snap) => {
      setWeightLogs(snap.docs.map(d => ({ ...d.data(), id: d.id } as AnimalWeightLog)));
      setLoading(false);
    });

    return () => {
      unsubHealth();
      unsubVacc();
      unsubBreeding();
      unsubProd();
      unsubWeight();
    };
  }, [animal.id, auth.currentUser?.uid]);

  // Lifecycle Timeline Data Aggregation
  interface TimelineEvent {
    date: string;
    label: string;
    icon: any;
    color: string;
    category: string;
    details?: string;
  }

  const combinedTimeline: TimelineEvent[] = [
    // Birth
    ...(safeDate(animal.dob) ? [{
      date: animal.dob!,
      label: 'Animal Birth',
      icon: Baby,
      color: 'bg-orange-500',
      category: 'Lifecycle'
    }] : []),
    // Registration
    ...(safeDate(animal.dateRegistered) ? [{
      date: animal.dateRegistered!,
      label: 'Farm Registration',
      icon: ShieldCheck,
      color: 'bg-[#5A5A40]',
      category: 'Lifecycle'
    }] : []),
    // Vaccinations
    ...vaccinations.map(v => ({
      date: v.dateGiven,
      label: `Vaccination: ${v.vaccineName}`,
      details: v.notes,
      icon: ShieldCheck,
      color: 'bg-emerald-500',
      category: 'Health'
    })),
    // Health Records
    ...healthRecords.map(h => ({
      date: h.date,
      label: `${h.type}: ${h.diagnosis || 'Check-up'}`,
      details: h.treatment,
      icon: Activity,
      color: h.type === 'Illness' ? 'bg-red-500' : 'bg-blue-500',
      category: 'Health'
    })),
    // Breeding
    ...breedingRecords.map(b => ({
      date: b.matingDate,
      label: 'Breeding Event',
      details: `Sire: ${b.bullId || 'N/A'} - Result: ${b.pregnancyCheckResult}`,
      icon: Dna,
      color: 'bg-purple-500',
      category: 'Reproduction'
    })),
    // Calving (if expected date is in past, it might be a calving event placeholder)
    ...breedingRecords.filter(b => b.expectedCalvingDate && new Date(b.expectedCalvingDate) < new Date()).map(b => ({
      date: b.expectedCalvingDate!,
      label: 'Expected Calving',
      details: 'Check registration logs for offspring details',
      icon: Baby,
      color: 'bg-blue-400',
      category: 'Reproduction'
    })),
    // Sales
    ...(animal.saleDate ? [{
      date: animal.saleDate,
      label: 'Animal Sold',
      icon: DollarSign,
      color: 'bg-emerald-600',
      category: 'Financial'
    }] : []),
    // Death
    ...(animal.deathDate ? [{
      date: animal.deathDate,
      label: 'Animal Deceased',
      icon: Trash2,
      color: 'bg-gray-800',
      category: 'Lifecycle'
    }] : [])
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const stats = {
    avgProduction: productionLogs.length > 0 
      ? (productionLogs.reduce((sum, l) => sum + l.quantity, 0) / productionLogs.length).toFixed(1)
      : '0',
    totalProduction: productionLogs.reduce((sum, l) => sum + l.quantity, 0).toFixed(0),
    currentWeight: weightLogs[0]?.weight || animal.initialWeight || 0,
    daysOnFarm: differenceInDays(new Date(), new Date(animal.dateAcquired || animal.dob)),
    upcomingVaccination: vaccinations
      .filter(v => v.nextDueDate)
      .sort((a, b) => new Date(a.nextDueDate!).getTime() - new Date(b.nextDueDate!).getTime())
      .find(v => new Date(v.nextDueDate!) > new Date()),
    overdueVaccination: vaccinations
      .filter(v => v.nextDueDate)
      .find(v => new Date(v.nextDueDate!) < new Date())
  };

  const productionChartData = productionLogs
    .slice(0, 14)
    .reverse()
    .map(l => ({ 
      date: format(new Date(l.date), 'MM/dd'), 
      value: l.quantity 
    }));

  const weightChartData = weightLogs
    .slice(0, 10)
    .reverse()
    .map(l => ({
      date: format(new Date(l.date), 'MM/dd'),
      value: l.weight
    }));

  return (
    <div className="fixed inset-0 z-[80] bg-[#F5F5F0] overflow-y-auto flex flex-col md:flex-row">
      {/* Mobile Header / Close */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-[100] bg-white/80 backdrop-blur-md p-4 flex items-center justify-between border-b border-gray-100 shadow-sm">
        <div className="flex items-center gap-3">
           <div className="w-10 h-10 bg-[#5A5A40] text-white rounded-xl flex items-center justify-center">
             <Activity size={20} />
           </div>
           <div>
             <h3 className="text-sm font-serif font-black text-gray-900 leading-none">{animal.name}</h3>
             <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">{animal.tagId}</p>
           </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-red-50 hover:text-red-500 rounded-full transition-all">
          <X size={20} />
        </button>
      </div>

      {/* Navigation Rail - Responsive */}
      <nav className="fixed bottom-0 left-0 right-0 md:sticky md:top-0 md:h-screen md:w-40 bg-white border-t md:border-t-0 md:border-r border-gray-100 z-[90] flex flex-row md:flex-col overflow-x-auto md:overflow-y-auto no-scrollbar shrink-0">
        <div className="hidden md:flex p-4 flex-col items-center gap-3 border-b border-gray-50 bg-[#F9F9F7]/30">
          <div className="w-10 h-10 bg-[#5A5A40] text-white rounded-xl shadow-lg shadow-[#5A5A40]/20 flex items-center justify-center transform hover:rotate-3 transition-transform duration-500">
            <Activity size={18} />
          </div>
          <div className="text-center">
            <h3 className="text-[11px] font-serif font-black text-gray-900 tracking-tight leading-none mb-1">{animal.name}</h3>
            <span className="px-1.5 py-0.5 bg-white border border-gray-100 text-[#5A5A40] text-[7px] font-black rounded-full uppercase tracking-widest">
              {animal.tagId || 'No Tag'}
            </span>
          </div>
        </div>
        
        <div className="flex flex-row md:flex-col p-2 gap-1 flex-1">
          <NavButton active={activeTab === 'Overview'} icon={Activity} label="Overview" onClick={() => setActiveTab('Overview')} />
          <NavButton active={activeTab === 'Timeline'} icon={History} label="Timeline" onClick={() => setActiveTab('Timeline')} />
          <NavButton active={activeTab === 'Health'} icon={Heart} label="Health" onClick={() => setActiveTab('Health')} />
          <NavButton active={activeTab === 'Breeding'} icon={Baby} label="Breeding" onClick={() => setActiveTab('Breeding')} />
          <NavButton active={activeTab === 'Production'} icon={Milk} label="Production" onClick={() => setActiveTab('Production')} />
          <NavButton active={activeTab === 'Growth'} icon={Scale} label="Stats" onClick={() => setActiveTab('Growth')} />
          <NavButton active={activeTab === 'Financial'} icon={DollarSign} label="Financial" onClick={() => setActiveTab('Financial')} />
        </div>

        <div className="hidden md:block p-3 border-t border-gray-50">
           <button 
             onClick={onClose}
             className="w-full py-2 bg-gray-50 hover:bg-red-50 hover:text-red-500 text-gray-400 rounded-lg text-[7.5px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5"
           >
             <X size={10} /> Exit
           </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 p-4 md:p-6 pt-16 md:pt-6 scroll-smooth">
        <div className="mx-auto space-y-6 md:space-y-8">
          {/* Back Button (Desktop-ish) */}
          <div className="hidden md:flex mb-0.5">
            <button 
              onClick={onClose}
              className="group flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-brand hover:text-white rounded-lg border border-gray-100 transition-all font-black text-[8px] uppercase tracking-widest shadow-sm"
            >
              <ChevronRight className="w-2.5 h-2.5 rotate-180 group-hover:-translate-x-0.5 transition-transform" />
              Registry
            </button>
          </div>

          {/* Header Stats Bar */}
          <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
            <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-3 px-1">
              <HeaderStat label="Gender" value={animal.gender} color="text-brand" />
              <HeaderStat label="Status" value={animal.healthStatus} color={animal.healthStatus === 'Healthy' ? 'text-emerald-500' : 'text-amber-500'} />
              <HeaderStat label="Breed" value={animal.breed || 'Unknown'} color="text-brand" />
              <HeaderStat label="Exact Age" value={calculateAge(animal.dob)} color="text-brand" />
              <HeaderStat label="Time on Farm" value={calculateTimeOnFarm(animal.dateAcquired, animal.dateRegistered)} color="text-brand" />
            </div>
            
            <div className="flex flex-row gap-2">
              <button 
                onClick={generateBirthCertificate}
                className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-white hover:bg-[#5A5A40] text-[#5A5A40] hover:text-white border border-[#5A5A40]/10 rounded-lg font-black text-[8px] uppercase tracking-widest transition-all shadow-sm group whitespace-nowrap"
              >
                <FileText size={12} className="transition-transform group-hover:scale-105" />
                Birth Cert
              </button>
              <button 
                onClick={generateFullHistory}
                className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-[#5A5A40] text-white rounded-lg font-black text-[8px] uppercase tracking-widest hover:bg-black transition-all shadow-md group whitespace-nowrap"
              >
                <Download size={12} className="transition-transform group-hover:translate-y-0.5" />
                History
              </button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="min-h-[500px]"
            >
              {activeTab === 'Overview' && (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 md:gap-5 items-start">
                  {/* Summary Card */}
                  <div className="xl:col-span-8 flex flex-col gap-4 md:gap-5">
                    {animal.status === 'incomplete' && (
                      <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <AlertCircle size={14} className="text-amber-600" />
                          <div>
                            <h5 className="text-[10px] font-black text-amber-900 uppercase tracking-widest">Incomplete Data</h5>
                            <p className="text-[9px] text-amber-700">Missing vital pedigree details.</p>
                          </div>
                        </div>
                        <button 
                          className="px-3 py-1 bg-amber-600 text-white rounded-lg font-black text-[8px] uppercase tracking-widest"
                          onClick={() => setIsEditingProfile(true)}
                        >
                          Complete
                        </button>
                      </div>
                    )}

                    <div className="bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group">
                      <div className="flex flex-col md:flex-row gap-4 md:gap-6 relative z-10">
                        <div className="w-full md:w-32 space-y-3">
                           <div className="aspect-square bg-gray-50 rounded-xl flex items-center justify-center text-gray-200 border border-gray-100">
                             <Activity size={32} className="opacity-10" />
                           </div>
                           <div className="flex items-center justify-between px-2 py-1 bg-emerald-50 rounded-lg">
                             <p className="text-[7px] font-black text-emerald-800 uppercase tracking-widest">Healthy</p>
                             <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
                           </div>
                        </div>

                        <div className="flex-1 space-y-4">
                           <div>
                             <h4 className="text-[7px] font-black text-gray-300 uppercase tracking-widest mb-3">Biological Profile</h4>
                             <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3">
                               <DetailItem label="Tag ID" value={animal.tagId || 'N/A'} />
                               <DetailItem label="Breed" value={animal.breed || 'N/A'} />
                               <DetailItem label="Gender" value={animal.gender} />
                               <DetailItem label="DOB" value={animal.dob ? format(new Date(animal.dob), 'MMM dd, yyyy') : 'N/A'} />
                               <DetailItem label="Age Group" value={animal.ageGroup || 'N/A'} />
                               <DetailItem label="exact age" value={calculateAge(animal.dob)} />
                               <DetailItem label="tenure" value={calculateTimeOnFarm(animal.dateAcquired, animal.dateRegistered)} />
                               <DetailItem label="Status" value="Certified" />
                             </div>
                           </div>

                           <div className="pt-4 border-t border-gray-50">
                             <h4 className="text-[7px] font-black text-gray-300 uppercase tracking-widest mb-3">Lineage</h4>
                             <div className="grid grid-cols-2 gap-4">
                               <DetailItem label="Dam (Mother)" value={animal.motherId || 'Registered Stock'} />
                               <DetailItem label="Sire (Father)" value={animal.fatherId || 'Registered Stock'} />
                             </div>
                           </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <ProductionSimpleCard animal={animal} logs={productionLogs} />
                      <HealthSummaryCard healthRecords={healthRecords} vaccinations={vaccinations} />
                      <LifecycleStatsCard animal={animal} />
                    </div>
                  </div>

                  {/* Sidebar */}
                  <div className="xl:col-span-4 flex flex-col gap-4 md:gap-5">
                    <div className="bg-[#5A5A40] p-5 rounded-2xl text-white shadow-lg shadow-[#5A5A40]/10 relative overflow-hidden">
                       <h4 className="text-base font-serif font-black mb-1">Performance</h4>
                       <p className="text-white/60 text-[9px] mb-4">Top percentile in growth metrics.</p>
                       <div className="space-y-3">
                         <div className="flex justify-between items-end">
                            <span className="text-[7px] font-black uppercase tracking-widest text-white/40">Efficiency Index</span>
                            <span className="text-xl font-black italic">A+</span>
                         </div>
                         <div className="w-full h-1 bg-black/10 rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: '85%' }} className="h-full bg-emerald-400" />
                         </div>
                       </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                       <h4 className="text-[10px] font-black text-gray-900 uppercase tracking-widest mb-4">Milestones</h4>
                       <div className="space-y-4 relative">
                          <div className="absolute left-2.5 top-0 bottom-4 w-px bg-gray-50" />
                          <TimelineItem date="Oct 20" label="Registered" icon={Activity} color="bg-emerald-500" />
                          <TimelineItem date="Dec 15" label="Vet Check" icon={Heart} color="bg-blue-500" />
                          <TimelineItem date="Jan 05" label="Vaccine Due" icon={ShieldCheck} color="bg-amber-500" />
                       </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'Timeline' && (
                <div className="max-w-2xl mx-auto space-y-8 py-6">
                  <div className="text-center space-y-2">
                    <h2 className="text-2xl font-serif font-black text-gray-900 tracking-tight">Lifecycle Registry</h2>
                    <p className="text-gray-400 text-[10px] max-w-xs mx-auto uppercase tracking-widest font-black leading-relaxed">Chronological history of assets & biological events.</p>
                  </div>

                  <div className="relative pt-4">
                    <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-px bg-gray-200 -translate-x-px" />
                    
                    <div className="space-y-8">
                      {combinedTimeline.map((event, idx) => (
                        <motion.div 
                          initial={{ opacity: 0, y: 20 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true }}
                          key={`${event.date}-${idx}`} 
                          className={cn(
                            "relative flex flex-col md:flex-row items-center gap-8 md:gap-16",
                            idx % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
                          )}
                        >
                          {/* Dot/Icon */}
                          <div className={cn(
                            "absolute left-8 md:left-1/2 w-10 h-10 -ml-5 rounded-full flex items-center justify-center text-white ring-8 ring-[#F5F5F0] z-10 shadow-lg",
                            event.color
                          )}>
                            <event.icon size={20} />
                          </div>

                          {/* Content Side */}
                          <div className={cn(
                            "w-full md:w-1/2 pl-16 md:pl-0",
                            idx % 2 === 0 ? "md:pr-12 md:text-right" : "md:pl-12 md:text-left"
                          )}>
                            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                              <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest block mb-2">{format(new Date(event.date), 'MMMM dd, yyyy')}</span>
                              <h5 className="text-xl font-bold text-gray-900 mb-2">{event.label}</h5>
                              <p className="text-sm text-gray-500 leading-relaxed">{event.details || `Standard ${event.category} recorded for the animal profile.`}</p>
                              <div className="mt-4 flex items-center gap-2 justify-start md:justify-end">
                                <span className="px-3 py-1 bg-gray-50 text-[10px] font-bold text-gray-400 rounded-full uppercase tracking-widest">{event.category}</span>
                              </div>
                            </div>
                          </div>

                          {/* Date side (Desktop) */}
                          <div className={cn(
                            "hidden md:block w-1/2",
                            idx % 2 === 0 ? "pl-12 text-left" : "pr-12 text-right"
                          )}>
                             <p className="text-3xl font-serif font-bold text-gray-300 opacity-50">{format(new Date(event.date), 'yyyy')}</p>
                             <p className="text-lg font-medium text-gray-400 mt-2">{format(new Date(event.date), 'MMMM')}</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'Health' && <HealthTab records={healthRecords} vaccinations={vaccinations} animalId={animal.id} />}
              {activeTab === 'Breeding' && <BreedingTab records={breedingRecords} animalId={animal.id} gender={animal.gender} />}
              {activeTab === 'Production' && <ProductionTab logs={productionLogs} animal={animal} />}
              {activeTab === 'Growth' && <GrowthTab logs={weightLogs} animalId={animal.id} />}
              {activeTab === 'Financial' && <FinancialTab animalId={animal.id} purchasePrice={animal.purchasePrice || 0} productionLogs={productionLogs} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <AnimatePresence>
        {isEditingProfile && (
          <EditProfileModal 
            animal={animal} 
            onClose={() => setIsEditingProfile(false)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function EditProfileModal({ animal, onClose }: { animal: IndividualLivestock, onClose: () => void }) {
  const [formData, setFormData] = useState({
    name: animal.name || '',
    tagId: animal.tagId || '',
    dob: animal.dob || format(new Date(), 'yyyy-MM-dd'),
    gender: animal.gender || 'Female',
    breed: animal.breed || '',
    color: animal.color || '',
    physicalDescription: animal.physicalDescription || '',
    motherId: animal.motherId || '',
    fatherId: animal.fatherId || '',
    source: animal.source || 'Born on farm',
    initialWeight: animal.initialWeight || 0,
    notes: animal.notes || ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, 'individual_livestock', animal.id), {
        ...formData,
        status: 'active', // Mark as active/complete
        updatedAt: serverTimestamp()
      });
      onClose();
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `individual_livestock/${animal.id}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-5 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-lg font-serif font-black text-gray-900">Pedigree Registry Update</h3>
            <p className="text-[8px] text-brand/60 font-black uppercase tracking-widest mt-0.5">Lifecycle Verification</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-50 rounded-xl transition-all">
            <X size={20} className="text-gray-300" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 md:p-8 space-y-6 md:space-y-8 custom-scrollbar">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            <div className="space-y-4">
              <h4 className="text-[8px] font-black text-gray-300 uppercase tracking-[0.2em]">Identity</h4>
              <FormInput label="Name" value={formData.name} onChange={v => setFormData({...formData, name: v})} required />
              <FormInput label="Tag ID" value={formData.tagId} onChange={v => setFormData({...formData, tagId: v})} required />
              <FormSelect label="Gender" value={formData.gender} options={['Male', 'Female']} onChange={v => setFormData({...formData, gender: v as any})} />
              <FormInput label="Breed" value={formData.breed} onChange={v => setFormData({...formData, breed: v})} />
            </div>

            <div className="space-y-4">
              <h4 className="text-[8px] font-black text-gray-300 uppercase tracking-[0.2em]">Origin</h4>
              <FormInput label="Birth Date" type="date" value={formData.dob} onChange={v => setFormData({...formData, dob: v})} />
              <FormInput label="Weight (kg)" type="number" value={formData.initialWeight} onChange={v => setFormData({...formData, initialWeight: Number(v)})} />
              <FormSelect label="Source" value={formData.source} options={['Born on farm', 'Purchased']} onChange={v => setFormData({...formData, source: v as any})} />
              <FormInput label="Markings" value={formData.color} onChange={v => setFormData({...formData, color: v})} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 pt-6 border-t border-gray-50">
             <div className="space-y-4">
               <h4 className="text-[8px] font-black text-gray-300 uppercase tracking-[0.2em]">Lineage</h4>
               <FormInput label="Mother ID" value={formData.motherId} onChange={v => setFormData({...formData, motherId: v})} />
               <FormInput label="Father ID" value={formData.fatherId} onChange={v => setFormData({...formData, fatherId: v})} />
             </div>
             <div className="space-y-4">
               <h4 className="text-[8px] font-black text-gray-300 uppercase tracking-[0.2em]">Notes</h4>
               <label className="block text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1">Observations</label>
               <textarea 
                 value={formData.notes}
                 onChange={e => setFormData({...formData, notes: e.target.value})}
                 placeholder="Records, history..."
                 className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-brand font-medium text-[11px] h-24 resize-none"
               />
             </div>
          </div>
        </form>

        <div className="p-5 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 text-[8px] font-black uppercase tracking-widest text-gray-400">Cancel</button>
          <button 
            type="submit" 
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-8 py-2 bg-[#5A5A40] text-white rounded-xl font-black text-[8px] uppercase tracking-widest shadow-lg shadow-[#5A5A40]/10 hover:bg-black transition-all"
          >
            {isSubmitting ? 'Syncing...' : 'Save Registry'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function HeaderStat({ label, value, color }: any) {
  return (
    <div className="bg-white p-3 md:p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center min-h-[4rem] overflow-hidden transition-all hover:shadow-md group">
      <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1 opacity-60 italic group-hover:opacity-100 transition-opacity truncate">{label}</p>
      <h4 className={cn("text-xs md:text-sm font-serif font-black tracking-tight line-clamp-1", color)} title={value}>{value}</h4>
    </div>
  );
}

function DetailItem({ label, value }: any) {
  return (
    <div>
      <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest leading-none mb-0.5">{label}</p>
      <p className="text-[10px] font-bold text-gray-900">{value}</p>
    </div>
  );
}

function ProductionSimpleCard({ animal, logs }: any) {
  const avg = logs.length > 0 ? (logs.reduce((s: any, l: any) => s + l.quantity, 0) / logs.length).toFixed(1) : 0;
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-white">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-serif font-black text-gray-900 tracking-tight">Production Status</h4>
        <Milk size={16} className="text-gray-200" />
      </div>
      <div className="space-y-4">
        <div className="flex justify-between items-end">
          <div>
            <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest mb-1">Rolling Average</p>
            <h3 className="text-2xl font-black text-gray-900">{avg}L <span className="text-[9px] font-medium text-gray-400">/ day</span></h3>
          </div>
          <TrendingUp className="text-emerald-500 mb-1" size={18} />
        </div>
        <div className="h-16">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={logs.slice(0, 7).reverse().map((l: any) => ({ date: l.date, value: l.quantity }))}>
              <Area type="monotone" dataKey="value" stroke="#5A5A40" fill="#5A5A40" fillOpacity={0.1} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function HealthSummaryCard({ healthRecords, vaccinations }: any) {
  const latestHealth = healthRecords[0];
  const nextVacc = vaccinations.find((v: any) => v.nextDueDate && new Date(v.nextDueDate) > new Date());

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-white">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-serif font-black text-gray-900 tracking-tight">Health Summary</h4>
        <Heart size={16} className="text-gray-200" />
      </div>
      <div className="space-y-4">
        <div>
          <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest mb-1.5">Latest Status</p>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
            <p className="text-[11px] font-bold text-gray-900 line-clamp-1">{latestHealth?.diagnosis || 'Standard Health Check'}</p>
          </div>
        </div>
        <div className="pt-3 border-t border-gray-50">
          <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest mb-1.5">Next Vaccination</p>
          {nextVacc ? (
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-gray-900 line-clamp-1">{nextVacc.vaccineName}</p>
              <p className="text-[8px] font-black text-[#5A5A40] uppercase tracking-widest bg-[#5A5A40]/5 px-2 py-0.5 rounded-full">
                {format(new Date(nextVacc.nextDueDate), 'MMM dd')}
              </p>
            </div>
          ) : (
             <p className="text-[9px] text-gray-400 italic">No scheduled immunizations</p>
          )}
        </div>
      </div>
    </div>
  );
}

function LifecycleStatsCard({ animal }: { animal: IndividualLivestock }) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-white">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-serif font-black text-gray-900 tracking-tight">Lifecycle Statistics</h4>
        <Clock size={16} className="text-gray-200" />
      </div>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
            <Baby size={16} className="text-orange-500" />
          </div>
          <div>
            <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest leading-none mb-1">Biological Age</p>
            <p className="text-sm font-black text-gray-900">{calculateAge(animal.dob)}</p>
          </div>
        </div>
        
        <div className="pt-3 border-t border-gray-50 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#5A5A40]/5 flex items-center justify-center">
            <ShieldCheck size={16} className="text-[#5A5A40]" />
          </div>
          <div>
            <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest leading-none mb-1">Time on Farm</p>
            <p className="text-sm font-black text-gray-900">{calculateTimeOnFarm(animal.dateAcquired, animal.dateRegistered)}</p>
          </div>
        </div>

        <div className="pt-3 border-t border-gray-50 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <Calendar size={16} className="text-blue-500" />
          </div>
          <div>
            <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest leading-none mb-1">Registry Date</p>
            <p className="text-sm font-black text-gray-900">{animal.dateRegistered ? format(new Date(animal.dateRegistered), 'MMM dd, yyyy') : 'N/A'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function NavButton({ active, icon: Icon, label, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex md:flex-row flex-col items-center gap-1 md:gap-3 px-3 md:px-4 py-1.5 md:py-2.5 rounded-lg md:rounded-xl transition-all duration-300 w-full group",
        active 
          ? "bg-[#5A5A40] text-white shadow-md shadow-[#5A5A40]/10" 
          : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"
      )}
    >
      <Icon size={14} className={cn("transition-transform", active ? "scale-110" : "group-hover:scale-110")} />
      <span className="text-[8px] md:text-[10px] font-black md:uppercase md:tracking-widest">{label}</span>
    </button>
  );
}

function SummaryCard({ label, value, trend, icon: Icon }: any) {
  return (
    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden group">
      <div className="relative z-10 flex flex-col justify-between h-full">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
          <div className="p-1 px-1.5 bg-gray-50 rounded-lg text-gray-400 transition-colors group-hover:bg-[#5A5A40]/5 group-hover:text-[#5A5A40]">
            <Icon size={12} />
          </div>
        </div>
        <div className="flex items-baseline gap-1.5">
          <h4 className="text-lg font-serif font-bold text-[#1a1a1a]">{value}</h4>
          {trend && <span className="text-[8px] font-bold text-emerald-500">{trend}</span>}
        </div>
      </div>
    </div>
  );
}

function TimelineItem({ date, label, icon: Icon, color }: any) {
  return (
    <div className="flex items-start gap-4 relative z-10">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white ring-4 ring-white shadow-sm ${color}`}>
        <Icon size={12} />
      </div>
      <div>
        <p className="text-xs font-bold text-gray-900 mb-0.5">{label}</p>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{date}</p>
      </div>
    </div>
  );
}

// --- SUB-TABS ---

function HealthTab({ records, vaccinations, animalId }: { records: AnimalHealthRecord[], vaccinations: AnimalVaccination[], animalId: string }) {
  const [isAddingHealth, setIsAddingHealth] = useState(false);
  const [healthUpdateMode, setHealthUpdateMode] = useState(false);
  const [selectedHealthToFollowUp, setSelectedHealthToFollowUp] = useState('');
  const [isAddingVacc, setIsAddingVacc] = useState(false);
  const [updateMode, setUpdateMode] = useState(false);
  const [selectedVaccToUpdate, setSelectedVaccToUpdate] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const [newHealth, setNewHealth] = useState<Partial<AnimalHealthRecord>>({
    type: 'Check-up',
    date: format(new Date(), 'yyyy-MM-dd'),
    diagnosis: '',
    treatment: '',
    medication: '',
    veterinarian: '',
    followUpDate: '',
    notes: ''
  });

  const [newVacc, setNewVacc] = useState<Partial<AnimalVaccination>>({
    vaccineName: '',
    dateGiven: format(new Date(), 'yyyy-MM-dd'),
    nextDueDate: '',
    administeredBy: '',
    notes: ''
  });

  useEffect(() => {
    if (selectedVaccToUpdate) {
      const v = vaccinations.find(v => v.id === selectedVaccToUpdate);
      if (v) {
        setNewVacc({
          vaccineName: v.vaccineName,
          dateGiven: format(new Date(), 'yyyy-MM-dd'),
          administeredBy: v.administeredBy || '',
          notes: v.notes || ''
        });
      }
    }
  }, [selectedVaccToUpdate, vaccinations]);

  useEffect(() => {
    if (healthUpdateMode && selectedHealthToFollowUp) {
      const r = records.find(r => r.id === selectedHealthToFollowUp);
      if (r) {
        setNewHealth({
          type: r.type,
          date: format(new Date(), 'yyyy-MM-dd'),
          diagnosis: r.diagnosis || '',
          treatment: r.treatment || '',
          medication: r.medication || '',
          veterinarian: r.veterinarian || '',
          followUpDate: ''
        });
      }
    }
  }, [healthUpdateMode, selectedHealthToFollowUp, records]);

  const handleAddHealth = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'animal_health'), {
        ...newHealth,
        animalId,
        ownerId: user.uid,
        createdAt: serverTimestamp()
      });
      setIsAddingHealth(false);
      setHealthUpdateMode(false);
      setSelectedHealthToFollowUp('');
      setNewHealth({ type: 'Check-up', date: format(new Date(), 'yyyy-MM-dd'), diagnosis: '', treatment: '', medication: '', veterinarian: '', followUpDate: '', notes: '' });
    } catch (e) { handleFirestoreError(e, OperationType.WRITE, 'animal_health'); }
    finally { setLoading(false); }
  };

  const handleAddVacc = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;
    setLoading(true);
    try {
      if (updateMode && selectedVaccToUpdate) {
        // Update existing record with new deployment and next due date
        await updateDoc(doc(db, 'animal_vaccinations', selectedVaccToUpdate), {
          dateGiven: newVacc.dateGiven,
          nextDueDate: newVacc.nextDueDate,
          administeredBy: newVacc.administeredBy,
          notes: newVacc.notes ? `${newVacc.notes} (Brought forward)` : 'Protocol updated'
        });
      } else {
        // Create new record
        await addDoc(collection(db, 'animal_vaccinations'), {
          ...newVacc,
          animalId,
          ownerId: user.uid,
          createdAt: serverTimestamp()
        });
      }

      // Update nextVaccinationDate on the animal record for filtering
      if (newVacc.nextDueDate) {
        await updateDoc(doc(db, 'individual_livestock', animalId), {
          nextVaccinationDate: newVacc.nextDueDate
        });
      }

      setIsAddingVacc(false);
      setUpdateMode(false);
      setSelectedVaccToUpdate('');
      setNewVacc({ vaccineName: '', dateGiven: format(new Date(), 'yyyy-MM-dd'), nextDueDate: '', administeredBy: '', notes: '' });
    } catch (e) { handleFirestoreError(e, OperationType.WRITE, 'animal_vaccinations'); }
    finally { setLoading(false); }
  };

  const handleConfirmVaccination = async (v: AnimalVaccination, nextDate: string) => {
    if (!nextDate) return;

    const user = auth.currentUser;
    if (!user) return;
    setLoading(true);
    try {
      const nowStr = format(new Date(), 'yyyy-MM-dd');
      
      await addDoc(collection(db, 'animal_health'), {
        animalId,
        ownerId: user.uid,
        type: 'Treatment',
        date: nowStr,
        diagnosis: `Routine Protocol: ${v.vaccineName}`,
        treatment: 'Vaccination completed per schedule',
        administeredBy: v.administeredBy || 'Authorized personnel',
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'animal_vaccinations', v.id), {
        dateGiven: nowStr,
        nextDueDate: nextDate,
        lastConfirmationTimestamp: serverTimestamp(),
        notes: v.notes ? `${v.notes} (Verified at ${format(new Date(), 'p')})` : `Verified at ${format(new Date(), 'p')}`
      });

      await updateDoc(doc(db, 'individual_livestock', animalId), {
        nextVaccinationDate: nextDate,
        lastVaccinationDate: nowStr,
        updatedAt: serverTimestamp()
      });
      setConfirmingVaccine(null);
    } catch (e) { 
      handleFirestoreError(e, OperationType.WRITE, `animal_vaccinations/${v.id}`); 
    } finally { 
      setLoading(false); 
    }
  };

  const [confirmingVaccine, setConfirmingVaccine] = useState<{ id: string, nextDate: string } | null>(null);

  return (
    <div className="space-y-6 md:space-y-8 max-w-[1700px] mx-auto">
      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6 md:gap-8 items-start">
        {/* Vaccinations */}
        <div className="bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
           <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-base font-serif font-black text-gray-900 leading-tight">Immunization</h4>
              <p className="text-[8px] text-gray-400 font-black uppercase tracking-widest mt-0.5">Preventative Protocol</p>
            </div>
            <button 
              onClick={() => setIsAddingVacc(true)}
              className="p-2 bg-[#5A5A40] text-white rounded-lg hover:bg-black transition-all shadow-md shrink-0"
            >
              <Plus size={14} />
            </button>
          </div>

          <AnimatePresence>
            {isAddingVacc && (
              <motion.form 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={handleAddVacc} 
                className="mb-4 space-y-3 pr-1 overflow-hidden bg-gray-50/50 p-3 rounded-xl border border-gray-100"
              >
                <div className="flex items-center gap-1 mb-1 p-1 bg-white rounded-lg border border-gray-100">
                  <button 
                    type="button" 
                    onClick={() => { setUpdateMode(false); setSelectedVaccToUpdate(''); }}
                    className={`flex-1 py-1 rounded-md text-[7px] font-black uppercase tracking-widest transition-all ${!updateMode ? 'bg-[#5A5A40] text-white' : 'text-gray-400'}`}
                  >
                    New
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setUpdateMode(true)}
                    className={`flex-1 py-1 rounded-md text-[7px] font-black uppercase tracking-widest transition-all ${updateMode ? 'bg-[#5A5A40] text-white' : 'text-gray-400'}`}
                  >
                    Recurring
                  </button>
                </div>

                {updateMode && (
                  <div>
                    <label className="block text-[7px] font-black text-gray-400 uppercase mb-1 ml-1 tracking-widest">Active Protocols</label>
                    <select 
                      className="w-full px-3 py-1.5 bg-white border border-gray-100 rounded-lg text-[10px] font-bold text-[#5A5A40] outline-none"
                      value={selectedVaccToUpdate}
                      onChange={e => setSelectedVaccToUpdate(e.target.value)}
                      required={updateMode}
                    >
                      <option value="">-- Select --</option>
                      {vaccinations.map(v => (
                        <option key={v.id} value={v.id}>{v.vaccineName}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <FormInput label="Name" value={newVacc.vaccineName} onChange={v => setNewVacc({...newVacc, vaccineName: v})} required disabled={updateMode && !!selectedVaccToUpdate} />
                  <FormInput label="Date" type="date" value={newVacc.dateGiven} onChange={v => setNewVacc({...newVacc, dateGiven: v})} required />
                  <FormInput label="Next Date" type="date" value={newVacc.nextDueDate} onChange={v => setNewVacc({...newVacc, nextDueDate: v})} required />
                  <FormInput label="Official" value={newVacc.administeredBy} onChange={v => setNewVacc({...newVacc, administeredBy: v})} />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => { setIsAddingVacc(false); setUpdateMode(false); }} className="px-2 py-1 text-gray-400 font-black text-[7px] uppercase tracking-widest">Cancel</button>
                  <button type="submit" className="px-4 py-1 bg-[#5A5A40] text-white rounded-lg font-black text-[7px] uppercase tracking-widest">
                    {updateMode ? 'Sync' : 'Save'}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          <div className="space-y-2 flex-1">
            {vaccinations.map(v => {
              const isOverdue = v.nextDueDate && new Date(v.nextDueDate) <= new Date();
              const isConfirming = confirmingVaccine?.id === v.id;

              return (
                <div key={v.id} className="flex flex-col gap-2">
                  <div className={cn(
                    "p-3 rounded-xl flex items-center justify-between gap-3 group border",
                    isOverdue ? "bg-red-50/50 border-red-100" : "bg-gray-50 border-transparent hover:border-gray-100 transition-all"
                  )}>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0",
                        isOverdue ? "bg-red-100 text-red-600" : "bg-white text-[#5A5A40]"
                      )}>
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <h5 className="text-[10px] font-bold text-gray-900 leading-none truncate max-w-[100px]">{v.vaccineName}</h5>
                          {isOverdue && <span className="px-1 py-0.5 bg-red-100 text-red-600 rounded-[4px] text-[6px] font-black uppercase">Overdue</span>}
                        </div>
                        <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">{format(new Date(v.dateGiven), 'MMM dd, yy')}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-[6.5px] font-black text-gray-300 uppercase tracking-widest leading-none mb-0.5">Next</p>
                        <p className={cn(
                          "text-[9px] font-black italic",
                          isOverdue ? "text-red-600" : "text-[#5A5A40]"
                        )}>
                          {v.nextDueDate ? format(new Date(v.nextDueDate), 'MMM dd, yy') : 'N/A'}
                        </p>
                      </div>
                      
                      {!isConfirming && (
                         <div className="flex items-center gap-1">
                           {isOverdue ? (
                             <button 
                               onClick={() => setConfirmingVaccine({ id: v.id, nextDate: format(addWeeks(new Date(), 12), 'yyyy-MM-dd') })}
                               className="px-2 py-1 bg-red-600 text-white rounded-md text-[7px] font-black uppercase tracking-widest"
                             >
                               Fix
                             </button>
                           ) : (
                             <button 
                               onClick={() => {
                                 setUpdateMode(true);
                                 setSelectedVaccToUpdate(v.id);
                                 setIsAddingVacc(true);
                               }}
                               className="p-1.5 text-gray-400 hover:text-[#5A5A40] transition-colors"
                             >
                               <Plus size={12} />
                             </button>
                           )}
                         </div>
                      )}
                    </div>
                  </div>

                  <AnimatePresence>
                    {isConfirming && (
                      <motion.div 
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="p-3 bg-white border border-red-100 rounded-xl shadow-sm relative"
                      >
                        <button onClick={() => setConfirmingVaccine(null)} className="absolute top-2 right-2 text-gray-300 hover:text-gray-600">
                          <X size={12} />
                        </button>
                        <h6 className="text-[7px] font-black text-red-600 uppercase tracking-widest mb-2">Sync Protocol</h6>
                        <div className="grid grid-cols-2 gap-3 items-end">
                           <FormInput 
                             label="Next Dose date" 
                             type="date" 
                             value={confirmingVaccine.nextDate} 
                             onChange={v => setConfirmingVaccine({...confirmingVaccine, nextDate: v})} 
                           />
                           <button 
                             onClick={() => handleConfirmVaccination(v, confirmingVaccine.nextDate)}
                             disabled={loading}
                             className="h-8 bg-red-600 text-white rounded-lg text-[7px] font-black uppercase tracking-widest"
                           >
                             {loading ? '...' : 'Confirm'}
                           </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
            {vaccinations.length === 0 && (
              <div className="text-center py-8 bg-gray-50/50 rounded-xl border border-dashed border-gray-100">
                <p className="text-gray-400 font-bold uppercase tracking-widest text-[7px]">Empty Registry</p>
              </div>
            )}
          </div>
        </div>

        {/* Clinical Logbook */}
        <div className="bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-gray-100">
           <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-base font-serif font-black text-gray-900 leading-tight">Clinical Log</h4>
              <p className="text-[8px] text-gray-400 font-black uppercase tracking-widest mt-0.5">Wellness History</p>
            </div>
            <button 
              onClick={() => setIsAddingHealth(true)}
              className="p-2 bg-[#5A5A40] text-white rounded-lg hover:bg-black transition-all shadow-md shrink-0"
            >
              <Plus size={14} />
            </button>
          </div>

          <AnimatePresence>
            {isAddingHealth && (
              <motion.form 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={handleAddHealth} 
                className="mb-4 space-y-3 pr-1 overflow-hidden bg-gray-50/50 p-3 rounded-xl border border-gray-100"
              >
                 <div className="flex items-center gap-1 mb-1 p-1 bg-white rounded-lg border border-gray-100">
                  <button 
                    type="button" 
                    onClick={() => { setHealthUpdateMode(false); setSelectedHealthToFollowUp(''); }}
                    className={`flex-1 py-1 rounded-md text-[7px] font-black uppercase tracking-widest transition-all ${!healthUpdateMode ? 'bg-[#5A5A40] text-white' : 'text-gray-400'}`}
                  >
                    New
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setHealthUpdateMode(true)}
                    className={`flex-1 py-1 rounded-md text-[7px] font-black uppercase tracking-widest transition-all ${healthUpdateMode ? 'bg-[#5A5A40] text-white' : 'text-gray-400'}`}
                  >
                    Follow-up
                  </button>
                </div>

                {healthUpdateMode && (
                  <div>
                    <label className="block text-[7px] font-black text-gray-400 uppercase mb-1 ml-1 tracking-widest">Select Incident</label>
                    <select 
                      className="w-full px-3 py-1.5 bg-white border border-gray-100 rounded-lg text-[10px] font-bold text-[#5A5A40] outline-none"
                      value={selectedHealthToFollowUp}
                      onChange={e => setSelectedHealthToFollowUp(e.target.value)}
                      required={healthUpdateMode}
                    >
                      <option value="">-- Select --</option>
                      {records.filter(r => r.followUpDate).map(r => (
                        <option key={r.id} value={r.id}>{format(new Date(r.date), 'MMM dd')} - {r.diagnosis || r.type}</option>
                      ))}
                      {records.filter(r => !r.followUpDate).length > 0 && (
                        <optgroup label="Recent History">
                          {records.filter(r => !r.followUpDate).slice(0, 5).map(r => (
                            <option key={r.id} value={r.id}>{format(new Date(r.date), 'MMM dd')} - {r.diagnosis || r.type}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>
                )}

                 <div className="grid grid-cols-2 gap-3">
                  <FormSelect 
                    label="Incident" 
                    value={newHealth.type} 
                    options={['Illness', 'Vet Visit', 'Medication', 'Treatment', 'Check-up']} 
                    onChange={v => setNewHealth({...newHealth, type: v as any})} 
                  />
                  <FormInput label="Date" type="date" value={newHealth.date} onChange={v => setNewHealth({...newHealth, date: v})} required />
                  <FormInput label="Diagnosis" value={newHealth.diagnosis} onChange={v => setNewHealth({...newHealth, diagnosis: v})} />
                  <FormInput label="Method" value={newHealth.treatment} onChange={v => setNewHealth({...newHealth, treatment: v})} />
                  <FormInput label="Pharmaceutical" value={newHealth.medication} onChange={v => setNewHealth({...newHealth, medication: v})} />
                  <FormInput label="Official" value={newHealth.veterinarian} onChange={v => setNewHealth({...newHealth, veterinarian: v})} />
                  <FormInput label="Follow-up Date" type="date" value={newHealth.followUpDate} onChange={v => setNewHealth({...newHealth, followUpDate: v})} />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setIsAddingHealth(false)} className="px-3 py-2 text-gray-400 font-black text-[8px] uppercase tracking-widest">Cancel</button>
                  <button type="submit" className="px-8 py-2 bg-[#5A5A40] text-white rounded-lg font-black text-[8px] uppercase tracking-widest hover:bg-black transition-all shadow-md">Record Entry</button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          <div className="space-y-3 flex-1">
            {records.map(r => (
              <div key={r.id} className="relative pl-6 pb-4 border-l border-gray-100 last:pb-0 group">
                <div className="absolute left-[-3.5px] top-0 w-1.5 h-1.5 rounded-full bg-white border border-[#5A5A40] shadow-sm group-hover:scale-125 transition-transform" />
                <div className="p-3 bg-gray-50 rounded-xl group-hover:bg-white group-hover:shadow-sm transition-all border border-transparent group-hover:border-gray-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[7.5px] font-black text-gray-400 uppercase tracking-widest">{format(new Date(r.date), 'MMM dd, yyyy')}</span>
                    <span className={`px-1.5 py-0.5 rounded-md text-[6.5px] font-black uppercase tracking-widest ${
                       r.type === 'Illness' ? 'bg-red-50 text-red-600' : 'bg-brand/10 text-brand'
                    }`}>{r.type}</span>
                  </div>
                  <h5 className="font-black text-gray-900 mb-1 text-[11px] break-words">{r.diagnosis || r.type}</h5>
                  {r.followUpDate && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded-md text-[6.5px] font-black uppercase tracking-widest flex items-center gap-1">
                        <Clock size={8} />
                        Follow-up: {format(new Date(r.followUpDate), 'MMM dd, yyyy')}
                      </span>
                      {new Date(r.followUpDate) <= new Date() && (
                        <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded-md text-[6.5px] font-black uppercase tracking-widest animate-pulse">Overdue</span>
                      )}
                    </div>
                  )}
                  <p className="text-[9px] text-gray-500 leading-relaxed font-medium break-words">
                    {r.treatment && <span className="block mb-0.5">Method: {r.treatment}</span>}
                    {r.medication && <span className="block italic text-gray-400">Log: {r.medication}</span>}
                  </p>
                  {r.veterinarian && (
                    <div className="mt-2 pt-2 border-t border-gray-100/50 flex items-center gap-1">
                       <ShieldCheck size={8} className="text-[#5A5A40]" />
                       <p className="text-[7px] text-[#5A5A40] font-black uppercase tracking-widest">Off.: {r.veterinarian}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {records.length === 0 && (
              <div className="text-center py-8 bg-gray-50/50 rounded-xl border border-dashed border-gray-100">
                <p className="text-gray-400 font-bold uppercase tracking-widest text-[7px]">No History</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function BreedingTab({ records, animalId, gender }: { records: AnimalBreedingRecord[], animalId: string, gender: string }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newRec, setNewRec] = useState<Partial<AnimalBreedingRecord>>({
    matingDate: format(new Date(), 'yyyy-MM-dd'),
    bullId: '',
    pregnancyCheckResult: 'Pending',
    expectedCalvingDate: '',
    complications: ''
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;
    try {
      await addDoc(collection(db, 'animal_breeding'), {
        ...newRec,
        animalId,
        ownerId: user.uid,
        createdAt: serverTimestamp()
      });
      setIsAdding(false);
      setNewRec({ matingDate: format(new Date(), 'yyyy-MM-dd'), bullId: '', pregnancyCheckResult: 'Pending', expectedCalvingDate: '' });
    } catch (e) { handleFirestoreError(e, OperationType.WRITE, 'animal_breeding'); }
  };

  if (gender === 'Male') {
    return (
      <div className="text-center py-12 bg-white rounded-3xl border border-gray-50">
        <AlertCircle className="mx-auto text-gray-200 mb-2" size={32} />
        <h4 className="text-sm font-serif font-black text-gray-400">Reproduction tracking disabled for males.</h4>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h4 className="text-lg font-serif font-black text-[#1a1a1a]">Reproduction & Calving</h4>
            <p className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-widest font-black">Mating cycles & Offspring</p>
          </div>
          <button 
            onClick={() => setIsAdding(true)}
            className="p-2.5 bg-[#5A5A40] text-white rounded-xl hover:bg-black transition-all shadow-md shadow-[#5A5A40]/10"
          >
            <Plus size={16} />
          </button>
        </div>

        <AnimatePresence>
          {isAdding && (
            <motion.form 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleAdd} 
              className="mb-6 p-4 bg-gray-50 rounded-2xl space-y-3 overflow-hidden border border-gray-100"
            >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <FormInput label="Mating Date" type="date" value={newRec.matingDate} onChange={v => setNewRec({...newRec, matingDate: v})} required />
                <FormInput label="Semen/Bull ID" value={newRec.bullId} onChange={v => setNewRec({...newRec, bullId: v})} />
                <FormSelect label="Pregnancy" value={newRec.pregnancyCheckResult} options={['Positive', 'Negative', 'Pending']} onChange={v => setNewRec({...newRec, pregnancyCheckResult: v as any})} />
                <FormInput label="Est. Calving" type="date" value={newRec.expectedCalvingDate} onChange={v => {
                  setNewRec({...newRec, expectedCalvingDate: v});
                }} />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setIsAdding(false)} className="px-3 py-2 text-gray-500 font-black text-[9px] uppercase tracking-widest">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-[#5A5A40] text-white rounded-lg font-black text-[9px] uppercase tracking-widest">Log Entry</button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {records.map(r => (
            <div key={r.id} className="p-4 bg-gray-50 rounded-2xl border border-transparent hover:border-gray-100 hover:bg-white hover:shadow-lg transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{format(new Date(r.matingDate), 'MMMM dd, yyyy')}</span>
                <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                   r.pregnancyCheckResult === 'Positive' ? 'bg-emerald-50 text-emerald-600' : 
                   r.pregnancyCheckResult === 'Negative' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                }`}>{r.pregnancyCheckResult}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[7px] font-black text-gray-300 uppercase mb-0.5 tracking-widest">Sire / Bull</p>
                  <p className="text-[11px] font-bold text-[#1a1a1a] truncate">{r.bullId || 'Natural Service'}</p>
                </div>
                {r.expectedCalvingDate && (
                  <div>
                    <p className="text-[7px] font-black text-gray-300 uppercase mb-0.5 tracking-widest">Est. Calving</p>
                    <p className="text-[11px] font-bold text-[#5A5A40]">{format(new Date(r.expectedCalvingDate), 'MMM dd, yyyy')}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
          {records.length === 0 && <p className="text-center py-12 text-gray-400 italic text-[10px] col-span-2">No breeding records found.</p>}
        </div>
      </div>
    </div>
  );
}

function ProductionTab({ logs, animal }: { logs: AnimalProductionLog[], animal: IndividualLivestock }) {
  const [isAdding, setIsAdding] = useState(false);
  const defaultType = (ANIMAL_PRODUCTS[animal.type as string] || 'Milk') as any;
  const [newLog, setNewLog] = useState<Partial<AnimalProductionLog>>({
    date: format(new Date(), 'yyyy-MM-dd'),
    quantity: 0,
    unit: PRODUCT_UNITS[defaultType] || 'Liters',
    type: defaultType
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;
    try {
      await addDoc(collection(db, 'animal_production'), {
        ...newLog,
        animalId: animal.id,
        ownerId: user.uid,
        createdAt: serverTimestamp()
      });
      setIsAdding(false);
      setNewLog({ 
        date: format(new Date(), 'yyyy-MM-dd'), 
        quantity: 0, 
        unit: PRODUCT_UNITS[defaultType] || 'Liters', 
        type: defaultType 
      });
    } catch (e) { handleFirestoreError(e, OperationType.WRITE, 'animal_production'); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-base font-serif font-black text-gray-900 leading-tight">Production Log</h4>
              <p className="text-[8px] text-gray-400 font-black uppercase tracking-widest mt-0.5">Yield Registry</p>
            </div>
            <button 
               onClick={() => setIsAdding(true)}
               className="p-2 bg-[#5A5A40] text-white rounded-lg hover:bg-black transition-all shadow-md shrink-0"
             >
               <Plus size={14} />
             </button>
        </div>

        <AnimatePresence>
          {isAdding && (
             <motion.form 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={handleAdd} 
                className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-3 bg-gray-50/50 p-3 rounded-xl overflow-hidden border border-gray-100"
              >
                <FormInput label="Date" type="date" value={newLog.date} onChange={v => setNewLog({...newLog, date: v})} required />
                <FormInput label="Quantity" type="number" value={newLog.quantity} onChange={v => setNewLog({...newLog, quantity: Number(v)})} required min="0.01" step="0.01" />
                <FormInput label="Unit" value={newLog.unit} onChange={v => setNewLog({...newLog, unit: v})} />
                <FormSelect label="Type" value={newLog.type} options={Object.keys(PRODUCT_UNITS)} onChange={v => {
                  const newType = v as string;
                  const newUnit = PRODUCT_UNITS[newType] || newLog.unit;
                  setNewLog({...newLog, type: newType as any, unit: newUnit});
                }} />
                <div className="col-span-full flex justify-end gap-2 pt-1 border-t border-gray-100/50">
                   <button type="button" onClick={() => setIsAdding(false)} className="px-2 py-1 text-gray-400 font-black text-[7px] uppercase tracking-widest">Cancel</button>
                    <button type="submit" className="px-4 py-1 bg-[#5A5A40] text-white rounded-lg font-black text-[7px] uppercase tracking-widest">Save</button>
                </div>
             </motion.form>
          )}
        </AnimatePresence>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-3 py-2 text-[7px] font-black text-gray-400 uppercase tracking-widest leading-none">Date</th>
                <th className="px-3 py-2 text-[7px] font-black text-gray-400 uppercase tracking-widest leading-none">Volume</th>
                <th className="px-3 py-2 text-[7px] font-black text-gray-400 uppercase tracking-widest leading-none text-right pr-6">Yield</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {logs.map(l => (
                <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2 font-bold text-gray-400 text-[9px]">{format(new Date(l.date), 'MMM dd, yy')}</td>
                  <td className="px-3 py-2 font-black text-gray-800 text-[11px]">{l.quantity} {l.unit}</td>
                  <td className="px-3 py-2 flex justify-end pr-6">
                     <div className="w-20 h-1 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, (l.quantity / 20) * 100)}%` }}
                          className="h-full bg-[#5A5A40]" 
                        />
                     </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="md:hidden space-y-3">
          {logs.map(l => (
            <div key={l.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
               <div className="flex justify-between items-center mb-1.5">
                 <span className="text-[7.5px] font-black text-gray-400 uppercase tracking-widest">{format(new Date(l.date), 'MMM dd, yy')}</span>
                 <span className="text-[11px] font-black text-gray-800">{l.quantity}{l.unit.charAt(0)}</span>
               </div>
               <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#5A5A40]" style={{ width: `${Math.min(100, (l.quantity / 20) * 100)}%` }} />
               </div>
            </div>
          ))}
        </div>

        {logs.length === 0 && (
          <div className="text-center py-12 bg-gray-50 mt-2 rounded-2xl border border-dashed border-gray-200">
             <Milk size={24} className="mx-auto text-gray-200 mb-2" />
             <p className="text-gray-400 font-bold uppercase tracking-widest text-[8px]">Registry Empty</p>
          </div>
        )}
      </div>
    </div>
  );
}

function GrowthTab({ logs, animalId }: { logs: AnimalWeightLog[], animalId: string }) {
   const [isAdding, setIsAdding] = useState(false);
  const [newLog, setNewLog] = useState<Partial<AnimalWeightLog>>({
    date: format(new Date(), 'yyyy-MM-dd'),
    weight: 0,
    conditionScore: 3
  });

  const handleAddWeight = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;
    try {
      await addDoc(collection(db, 'animal_weight_logs'), {
        ...newLog,
        animalId,
        ownerId: user.uid,
        createdAt: serverTimestamp()
      });
      setIsAdding(false);
      setNewLog({ date: format(new Date(), 'yyyy-MM-dd'), weight: 0, conditionScore: 3 });
    } catch (e) { handleFirestoreError(e, OperationType.WRITE, 'animal_weight_logs'); }
  };

  return (
    <div className="bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-gray-100">
       <div className="flex items-center justify-between mb-4">
          <h4 className="text-base font-serif font-black text-gray-900 leading-tight">Growth Tracker</h4>
          <button 
            onClick={() => setIsAdding(true)}
            className="p-2 bg-[#5A5A40] text-white rounded-lg hover:bg-black transition-all shadow-md shrink-0"
          >
            <Plus size={14} />
          </button>
        </div>

        <AnimatePresence>
           {isAdding && (
             <motion.form 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={handleAddWeight} 
                className="mb-4 grid grid-cols-2 md:grid-cols-3 gap-3 bg-gray-50/50 p-3 rounded-xl overflow-hidden border border-gray-100"
              >
                <FormInput label="Date" type="date" value={newLog.date} onChange={v => setNewLog({...newLog, date: v})} required />
                <FormInput label="Weight (kg)" type="number" value={newLog.weight} onChange={v => setNewLog({...newLog, weight: Number(v)})} required min="0.1" step="0.1" />
                <FormInput label="Score (1-5)" type="number" value={newLog.conditionScore} onChange={v => setNewLog({...newLog, conditionScore: Number(v)})} min="1" max="5" />
                <div className="col-span-full flex justify-end gap-2 pt-1 border-t border-gray-100/50">
                   <button type="button" onClick={() => setIsAdding(false)} className="px-2 py-1 text-gray-400 font-black text-[7px] uppercase tracking-widest">Cancel</button>
                    <button type="submit" className="px-4 py-1 bg-[#5A5A40] text-white rounded-lg font-black text-[7px] uppercase tracking-widest">Save</button>
                </div>
              </motion.form>
           )}
        </AnimatePresence>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
           {logs.map(l => (
             <div key={l.id} className="p-3 bg-gray-50 rounded-xl flex items-center justify-between group hover:border-gray-100 hover:bg-white transition-all border border-transparent">
                <div className="flex items-center gap-2">
                   <div className="w-7 h-7 bg-white rounded-lg text-[#5A5A40] group-hover:bg-[#5A5A40] group-hover:text-white transition-colors border border-gray-100 flex items-center justify-center shrink-0">
                      <Scale size={12} />
                   </div>
                   <div className="min-w-0">
                      <h5 className="font-black text-gray-800 text-[11px] leading-none mb-1">{l.weight} kg</h5>
                      <p className="text-[7.5px] text-gray-400 font-black uppercase tracking-widest">{format(new Date(l.date), 'MMM dd, yy')}</p>
                   </div>
                </div>
                <div className="text-right">
                   <p className="text-[6.5px] font-black text-gray-300 uppercase tracking-widest leading-none mb-1 text-right">Score</p>
                   <div className="flex gap-0.5 justify-end">
                      {[1,2,3,4,5].map(s => (
                        <div key={s} className={`w-0.5 h-1.5 rounded-full ${s <= (l.conditionScore || 0) ? 'bg-[#5A5A40]' : 'bg-gray-200'}`} />
                      ))}
                   </div>
                </div>
             </div>
           ))}
           {logs.length === 0 && (
              <div className="text-center py-8 bg-gray-50/50 rounded-xl border border-dashed border-gray-100 col-span-full">
                <p className="text-gray-400 font-bold uppercase tracking-widest text-[7px]">Empty Growth Log</p>
              </div>
           )}
        </div>
    </div>
  );
}

function FinancialTab({ animalId, purchasePrice, productionLogs }: { animalId: string, purchasePrice: number, productionLogs: AnimalProductionLog[] }) {
  const revenue = productionLogs.reduce((sum, l) => sum + (l.quantity * 0.5), 0);
  const feedingCost = 50; 
  const medicalCost = 20; 

  const profit = revenue - (feedingCost + medicalCost + purchasePrice);

  return (
    <div className="space-y-4">
       <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
             <div className="flex items-center justify-between mb-1">
                <p className="text-[7px] font-black text-gray-400 uppercase tracking-widest">Revenue</p>
                <TrendingUp size={12} className="text-emerald-500" />
             </div>
             <h4 className="text-base font-serif font-black text-gray-900 tracking-tight">${revenue.toFixed(2)}</h4>
          </div>
          <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
             <div className="flex items-center justify-between mb-1">
                <p className="text-[7px] font-black text-gray-400 uppercase tracking-widest">Costs</p>
                <TrendingUp size={12} className="text-red-500 rotate-180" />
             </div>
             <h4 className="text-base font-serif font-black text-gray-900 tracking-tight">${(feedingCost + medicalCost + purchasePrice).toFixed(2)}</h4>
          </div>
          <div className={`p-3 rounded-xl shadow-sm col-span-2 md:col-span-1 ${profit >= 0 ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
             <div className="flex items-center justify-between mb-1">
                <p className="text-[7px] font-black text-white/50 uppercase tracking-widest">Net Profit</p>
                <DollarSign size={12} />
             </div>
             <h4 className="text-base font-serif font-black tracking-tight">${profit.toFixed(2)}</h4>
          </div>
       </div>

       <div className="bg-white p-6 rounded-2xl border border-gray-50 flex flex-col items-center text-center">
          <TrendingUp size={32} className="text-gray-100 mb-3" />
          <h4 className="text-[11px] font-serif font-black text-gray-900 uppercase tracking-widest mb-1">Projection Engine</h4>
          <p className="text-[9px] text-gray-400 max-w-xs leading-relaxed font-medium capitalize">Linking biological events with financial outflows for real-time ROI analysis.</p>
       </div>
    </div>
  );
}

// --- HELPER COMPONENTS ---

function FormInput({ label, type = 'text', value, onChange, required, disabled, min, max, step }: any) {
  return (
    <div>
      <label className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1.5">{label}</label>
      <input 
        required={required}
        type={type} 
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className="w-full px-4 py-2 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-[#5A5A40] outline-none transition-all font-bold text-[11px] text-[#1a1a1a] disabled:opacity-50" 
        value={value} 
        onChange={e => onChange(e.target.value)} 
      />
    </div>
  );
}

function FormSelect({ label, value, options, onChange }: any) {
  return (
    <div>
      <label className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1.5">{label}</label>
      <select 
        className="w-full px-4 py-2 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-[#5A5A40] outline-none transition-all font-bold text-[11px] text-[#1a1a1a] appearance-none" 
        value={value} 
        onChange={e => onChange(e.target.value)}
      >
        {options.map((o: any) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
