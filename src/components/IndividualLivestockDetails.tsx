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
  serverTimestamp,
  getDocs,
  increment,
  getDoc
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreError';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { generateSectionedPDFReport } from '../utils/reportGenerator';
import { 
  X, 
  Plus, 
  Trash2, 
  Heart, 
  Activity, 
  Calendar, 
  Tag, 
  Scale, 
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  Info,
  Save,
  Download,
  Baby,
  Edit2,
  Search,
  Filter,
  FileText,
  BarChart3,
  Milk,
  TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Livestock, IndividualLivestock } from '../types';
import { format, differenceInDays } from 'date-fns';
import { ANIMAL_BREEDS } from '../constants';
import { calculateAge, calculateTimeOnFarm } from '../utils/animalUtils';

import AnimalProfile from './AnimalProfile';

function cn(...inputs: (string | boolean | undefined)[]) {
  return inputs.filter(Boolean).join(' ');
}

interface Props {
  animalGroup: Livestock;
  onClose: () => void;
}

export default function IndividualLivestockDetails({ animalGroup, onClose }: Props) {
  const safeFormat = (dateStr: string | undefined, formatStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'Invalid Date';
      return format(d, formatStr);
    } catch {
      return 'Invalid Date';
    }
  };

  const getAgeGroup = (dob: string | undefined, gender: 'Male' | 'Female', type?: string): string => {
    if (!dob) return 'Unknown Age';
    const d = new Date(dob);
    if (isNaN(d.getTime())) return 'Invalid DOB';
    
    const diffDays = differenceInDays(new Date(), d);
    if (diffDays < 0) return 'Upcoming';
    if (diffDays <= 7) return 'Newborn';
    if (diffDays <= 60) return type === 'Cow' ? 'Young Calf' : `${Math.floor(diffDays / 7)} Weeks Old`;
    if (diffDays <= 240) return type === 'Cow' ? 'Calf' : 'Young';
    if (diffDays <= 730) {
      if (type === 'Cow') return gender === 'Female' ? 'Heifer' : 'Yearling';
      return 'Juvenile';
    }
    return 'Adult';
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .filter(n => n.length > 0)
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-50 text-blue-600 border-blue-100',
      'bg-emerald-50 text-emerald-600 border-emerald-100',
      'bg-purple-50 text-purple-600 border-purple-100',
      'bg-rose-50 text-rose-600 border-rose-100',
      'bg-amber-50 text-amber-600 border-amber-100',
      'bg-indigo-50 text-indigo-600 border-indigo-100',
      'bg-teal-50 text-teal-600 border-teal-100',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const [individuals, setIndividuals] = useState<IndividualLivestock[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [vaccinationFilter, setVaccinationFilter] = useState('All');
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingAnimal, setEditingAnimal] = useState<IndividualLivestock | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedAnimal, setSelectedAnimal] = useState<IndividualLivestock | null>(null);
  const [isImmuneModalOpen, setIsImmuneModalOpen] = useState(false);
  const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const isPoultry = ['Chicken', 'Duck', 'Turkey', 'Bird'].includes(animalGroup.type);
  const [poultrySimplified, setPoultrySimplified] = useState(isPoultry);

  const generateBulkReport = () => {
    const sections = [
      {
        title: "Collective Production History",
        columns: ['Date', 'Product', 'Yield', 'Notes'],
        data: productionLogs.map(p => [
          format(new Date(p.date), 'PP'),
          p.type,
          `${p.quantity} ${p.unit}`,
          p.notes || '-'
        ])
      }
    ];

    generateSectionedPDFReport(
      `${animalGroup.type} Group Report`.toUpperCase(),
      `Total Count: ${animalGroup.count} | Status: ${animalGroup.healthStatus}`,
      sections,
      `${animalGroup.type}_Bulk_Report`
    );
  };

  const filteredIndividuals = individuals.filter(animal => {
    const matchesSearch = 
      animal.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (animal.tagId || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'All' || 
                         (statusFilter === 'Incomplete' ? animal.status === 'incomplete' : animal.healthStatus === statusFilter);
    
    const now = new Date();
    const nextVacc = animal.nextVaccinationDate ? new Date(animal.nextVaccinationDate) : null;
    let matchesVaccination = true;
    if (vaccinationFilter === 'Overdue') {
      matchesVaccination = !!nextVacc && nextVacc < now;
    } else if (vaccinationFilter === 'Due Soon') {
      const nextWeek = new Date();
      nextWeek.setDate(now.getDate() + 7);
      matchesVaccination = !!nextVacc && nextVacc >= now && nextVacc <= nextWeek;
    }

    return matchesSearch && matchesStatus && matchesVaccination;
  });

  const [newWeight, setNewWeight] = useState({
    weight: 0,
    date: format(new Date(), 'yyyy-MM-dd')
  });
  const [newImmune, setNewImmune] = useState({
    type: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    notes: ''
  });
  const [newAnimal, setNewAnimal] = useState({
    name: '',
    tagId: '',
    dob: format(new Date(), 'yyyy-MM-dd'),
    gender: 'Female' as 'Male' | 'Female',
    breed: '',
    healthStatus: 'Healthy' as IndividualLivestock['healthStatus'],
    physicalDescription: '',
    color: '',
    motherId: '',
    fatherId: '',
    source: 'Born on farm' as 'Born on farm' | 'Purchased',
    dateAcquired: format(new Date(), 'yyyy-MM-dd'),
    initialWeight: 0,
    purchasePrice: 0,
    breederInfo: '',
    notes: ''
  });

  useEffect(() => {
    if (isAdding && !newAnimal.tagId) {
      const typePrefix = animalGroup.type.toUpperCase().substring(0, 3);
      
      // Find the highest number used in existing tags to suggest the next one
      let maxNum = individuals.length;
      individuals.forEach(ind => {
        if (ind.tagId) {
          const parts = ind.tagId.split('#');
          if (parts.length > 1) {
            const num = parseInt(parts[parts.length - 1]);
            if (!isNaN(num) && num > maxNum) maxNum = num;
          } else {
            const matches = ind.tagId.match(/\d+$/);
            if (matches) {
              const num = parseInt(matches[0]);
              if (num > maxNum) maxNum = num;
            }
          }
        }
      });

      const nextNum = maxNum + 1;
      setNewAnimal(prev => ({
        ...prev,
        tagId: `${typePrefix}#${nextNum}`,
        name: `${animalGroup.type} ${nextNum}`,
        breed: ANIMAL_BREEDS[animalGroup.type]?.[0] || ''
      }));
    }
  }, [isAdding, individuals, animalGroup.type]);

  const [viewMode, setViewMode] = useState<'list' | 'performance'>('list');
  const [productionLogs, setProductionLogs] = useState<any[]>([]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // Fetch All Individuals of this Species for the farm
    const q = query(
      collection(db, 'individual_livestock'), 
      where('ownerId', '==', user.uid),
      where('farmId', '==', animalGroup.farmId || 'default')
    );
    
    const unsub = onSnapshot(q, (snapshot) => {
      const data: IndividualLivestock[] = [];
      snapshot.forEach(doc => {
        const d = doc.data() as IndividualLivestock;
        data.push({ 
          ...d, 
          id: doc.id,
          ageGroup: d.ageGroup || getAgeGroup(d.dob, d.gender, animalGroup.type)
        });
      });
      const groupData = data.filter(ind => ind.groupId === animalGroup.id);
      setIndividuals(groupData);

      // Auto-select animal if targetAnimalId matches
      const targetId = localStorage.getItem('targetAnimalId');
      if (targetId) {
        const target = groupData.find(i => i.id === targetId);
        if (target) {
          setSelectedAnimal(target);
          localStorage.removeItem('targetAnimalId');
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'individual_livestock');
    });

    return () => unsub();
  }, [animalGroup.id, auth.currentUser?.uid]);

  // Fetch Production Logs for the Species
  useEffect(() => {
    const user = auth.currentUser;
    if (!user || !animalGroup.farmId) return;

    const q = query(
      collection(db, 'production'),
      where('ownerId', '==', user.uid),
      where('farmId', '==', animalGroup.farmId),
      where('type', '==', animalGroup.type === 'Chicken' ? 'Eggs' : animalGroup.type === 'Cow' ? 'Milk' : 'Wool')
    );

    const unsub = onSnapshot(q, (snap) => {
      const logs: any[] = [];
      snap.forEach(doc => logs.push({ ...doc.data(), id: doc.id }));
      setProductionLogs(logs);
    });

    return () => unsub();
  }, [animalGroup.type, animalGroup.farmId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    setLoading(true);
    try {
      await addDoc(collection(db, 'individual_livestock'), {
        ...newAnimal,
        species: animalGroup.type, // Required by security rules
        status: 'active', // Required by security rules
        ageGroup: getAgeGroup(newAnimal.dob, newAnimal.gender, animalGroup.type),
        dateRegistered: new Date().toISOString(),
        groupId: animalGroup.id,
        ownerId: user.uid,
        farmId: animalGroup.farmId || 'default',
        immunizations: [],
        weightLogs: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Increment group count ONLY if we are adding beyond the initial group count
      // This maintains the "normalization" where individuals fill up the group slots first
      if (individuals.length >= animalGroup.count) {
        await updateDoc(doc(db, 'livestock', animalGroup.id), {
          count: increment(1),
          lastUpdated: new Date().toISOString()
        });
      }

      setIsAdding(false);
      setNewAnimal({
        name: '',
        tagId: '',
        dob: format(new Date(), 'yyyy-MM-dd'),
        gender: 'Female',
        breed: '',
        healthStatus: 'Healthy',
        physicalDescription: '',
        color: '',
        motherId: '',
        fatherId: '',
        breederInfo: '',
        source: 'Born on farm',
        dateAcquired: format(new Date(), 'yyyy-MM-dd'),
        initialWeight: 0,
        purchasePrice: 0,
        notes: ''
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'individual_livestock');
    } finally {
      setLoading(false);
    }
  };

  const generateBirthCertificate = (animal: IndividualLivestock) => {
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

    // 4. Content Grid - Spaced out
    const leftColX = 40;
    const midX = pageWidth / 2;
    const rightColX = pageWidth / 2 + 15;
    let currentY = 70;
    const rowHeight = 22;

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
    
    const podWidth = 80;
    const podHeight = 18;

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

    doc.save(`Birth_Certificate_${animal.tagId || animal.name}.pdf`);
  };

  const handlePrintReport = (animal: IndividualLivestock) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const content = `
      <html>
        <head>
          <title>Animal Report - ${animal.name}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #333; }
            .header { border-bottom: 2px solid #5A5A40; padding-bottom: 20px; margin-bottom: 30px; }
            h1 { color: #5A5A40; margin: 0; }
            .section { margin-bottom: 30px; }
            .section-title { font-weight: bold; text-transform: uppercase; font-size: 12px; color: #999; margin-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { text-align: left; padding: 12px; border-bottom: 1px solid #eee; }
            th { background: #f9f9f9; font-size: 12px; text-transform: uppercase; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
            .info-item { margin-bottom: 10px; }
            .info-label { font-weight: bold; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Animal Health & Lifecycle Report</h1>
            <p>Generated on ${format(new Date(), 'MMMM dd, yyyy')}</p>
          </div>

          <div class="section">
            <div class="section-title">General Information</div>
            <div class="grid">
              <div class="info-item"><span class="info-label">Name:</span> ${animal.name}</div>
              <div class="info-item"><span class="info-label">Tag ID:</span> ${animal.tagId || 'N/A'}</div>
              <div class="info-item"><span class="info-label">Exact Age:</span> ${calculateAge(animal.dob)}</div>
              <div class="info-item"><span class="info-label">Tenure (On Farm):</span> ${calculateTimeOnFarm(animal.dateAcquired, animal.dateRegistered)}</div>
              <div class="info-item"><span class="info-label">Type:</span> ${animalGroup.type}</div>
              <div class="info-item"><span class="info-label">Breed:</span> ${animal.breed || 'N/A'}</div>
              <div class="info-item"><span class="info-label">DOB:</span> ${animal.dob ? format(new Date(animal.dob), 'MMM dd, yyyy') : 'N/A'}</div>
              <div class="info-item"><span class="info-label">Age Group:</span> ${animal.ageGroup || 'N/A'}</div>
              <div class="info-item"><span class="info-label">Registered:</span> ${animal.dateRegistered ? format(new Date(animal.dateRegistered), 'MMM dd, yyyy') : 'N/A'}</div>
              <div class="info-item"><span class="info-label">Gender:</span> ${animal.gender}</div>
              <div class="info-item"><span class="info-label">Health Status:</span> ${animal.healthStatus}</div>
            </div>
          </div>

          <p style="font-size: 12px; color: #666; font-style: italic;">
            Note: For full historical logs including vaccinations, breeding, and production, please view the digital dashboard.
          </p>

          <div style="margin-top: 50px; font-size: 10px; color: #999; text-align: center;">
            Smart Farm Manager - Digital Agriculture Solutions
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this individual record?')) return;
    
    try {
      const animalToDelete = individuals.find(i => i.id === id);
      await deleteDoc(doc(db, 'individual_livestock', id));
      
      if (animalToDelete && animalToDelete.healthStatus !== 'Dead') {
        await updateDoc(doc(db, 'livestock', animalGroup.id), {
          count: increment(-1),
          lastUpdated: new Date().toISOString()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `individual_livestock/${id}`);
    }
  };

  const handleUpdateHealth = async (animalId: string, newStatus: IndividualLivestock['healthStatus']) => {
    const animal = individuals.find(i => i.id === animalId);
    if (!animal) return;

    try {
      const oldStatus = animal.healthStatus;
      const updateData: any = { healthStatus: newStatus };
      
      if (newStatus === 'Dead' && oldStatus !== 'Dead') {
        updateData.deathDate = new Date().toISOString();
      } else if (newStatus !== 'Dead' && oldStatus === 'Dead') {
        updateData.deathDate = null;
      }

      await updateDoc(doc(db, 'individual_livestock', animalId), updateData);

      if (newStatus === 'Dead' && oldStatus !== 'Dead') {
        await updateDoc(doc(db, 'livestock', animalGroup.id), {
          count: increment(-1),
          lastUpdated: new Date().toISOString()
        });
      } else if (oldStatus === 'Dead' && newStatus !== 'Dead') {
        await updateDoc(doc(db, 'livestock', animalGroup.id), {
          count: increment(1),
          lastUpdated: new Date().toISOString()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `individual_livestock/${animalId}`);
    }
  };

  const handleEdit = (animal: IndividualLivestock) => {
    setEditingAnimal(animal);
    setIsEditing(true);
    setNewAnimal({
      name: animal.name,
      tagId: animal.tagId,
      dob: animal.dob,
      gender: animal.gender,
      breed: animal.breed || '',
      healthStatus: animal.healthStatus,
      physicalDescription: animal.physicalDescription || '',
      color: animal.color || '',
      motherId: animal.motherId || '',
      fatherId: animal.fatherId || '',
      breederInfo: animal.breederInfo || '',
      source: animal.source || 'Born on farm',
      dateAcquired: animal.dateAcquired || format(new Date(), 'yyyy-MM-dd'),
      initialWeight: animal.initialWeight || 0,
      purchasePrice: animal.purchasePrice || 0,
      notes: animal.notes || ''
    });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAnimal) return;
    
    setLoading(true);
    try {
      const updateData = {
        ...newAnimal,
        ageGroup: getAgeGroup(newAnimal.dob, newAnimal.gender, animalGroup.type)
      };
      
      // If it was incomplete, set it to active (or default to empty if type is specific)
      if (editingAnimal.status === 'incomplete') {
        (updateData as any).status = 'active';
      }

      await updateDoc(doc(db, 'individual_livestock', editingAnimal.id), updateData);
      setIsEditing(false);
      setEditingAnimal(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `individual_livestock/${editingAnimal.id}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full bg-[#F9F9F7] rounded-[3.5rem] shadow-sm relative overflow-hidden flex flex-col min-h-[80vh] border border-white">
        {/* Header and Navigation */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-gray-100 sticky top-0 z-20 shadow-sm overflow-hidden shrink-0">
        <div className="max-w-7xl mx-auto px-4">
          <div className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-2 relative z-30">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-[#5A5A40] text-white rounded-lg shadow-md shadow-[#5A5A40]/10 flex items-center justify-center transition-transform hover:rotate-3 duration-500">
                <Activity size={18} />
              </div>
              <div>
                <h3 className="text-sm font-serif font-black text-gray-900 leading-none tracking-tight mb-0.5">
                  {animalGroup.type} <span className="opacity-20 mx-0.5 font-light">/</span> {poultrySimplified ? 'Bulk' : 'Directory'}
                </h3>
                <div className="flex items-center gap-1.5">
                  <span className="px-1 py-0 bg-[#5A5A40]/5 text-[#5A5A40] text-[6.5px] font-black uppercase tracking-widest rounded-full border border-[#5A5A40]/5">
                    {poultrySimplified ? 'Autonomous' : 'Registry'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {isPoultry && (
                <button 
                  onClick={() => setPoultrySimplified(!poultrySimplified)}
                  className="px-2.5 py-1.5 bg-[#F9F9F7] border border-gray-100 rounded-lg text-[7px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-100 transition-all"
                >
                  {poultrySimplified ? 'Individual' : 'Bulk'}
                </button>
              )}
              <button 
                onClick={generateBulkReport}
                className="px-3 py-1.5 bg-white border border-gray-100 rounded-lg text-[7px] font-black uppercase tracking-widest text-[#5A5A40] hover:bg-[#5A5A40] hover:text-white transition-all flex items-center gap-1 shadow-sm"
              >
                <Download size={10} />
                Export
              </button>
              <button onClick={onClose} className="p-1.5 hover:bg-red-50 hover:text-red-500 rounded-full transition-all ml-1 text-gray-300">
                <X size={18} />
              </button>
            </div>
          </div>

          {(!isPoultry || !poultrySimplified) && (
            <div className="flex gap-6 border-t border-gray-50 relative z-30 overflow-x-auto no-scrollbar">
              <button 
                onClick={() => setViewMode('list')}
                className={cn(
                  "py-2 text-[7px] font-black uppercase tracking-widest transition-all border-b-2",
                  viewMode === 'list' ? "border-[#5A5A40] text-[#5A5A40]" : "border-transparent text-gray-400 hover:text-gray-600"
                )}
              >
                Directory
              </button>
              <button 
                onClick={() => setViewMode('performance')}
                className={cn(
                  "py-2 text-[7px] font-black uppercase tracking-widest transition-all border-b-2",
                  viewMode === 'performance' ? "border-[#5A5A40] text-[#5A5A40]" : "border-transparent text-gray-400 hover:text-gray-600"
                )}
              >
                Performance
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pt-2">
        <div className="max-w-[1700px] mx-auto p-4 md:p-6 space-y-6">
            {/* Navigation / Back Button */}
            <div className="mb-2 px-2">
              <button 
                onClick={onClose}
                className="group flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-brand hover:text-white rounded-xl border border-gray-100 transition-all font-black text-[9px] uppercase tracking-widest shadow-sm"
              >
                <ChevronRight className="w-3 h-3 rotate-180 group-hover:-translate-x-1 transition-transform" />
                Registry
              </button>
            </div>

            {isPoultry && poultrySimplified && (
              <div className="p-4 bg-[#5A5A40]/5 border border-[#5A5A40]/10 rounded-2xl flex items-center gap-4 mb-4">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-[#5A5A40]">
                  <ShieldCheck size={20} />
                </div>
                <div className="flex-1">
                  <h5 className="font-bold text-[#1a1a1a] text-xs">Simplified Mode Active</h5>
                  <p className="text-[10px] text-gray-500 leading-normal">Individual records are hidden to reduce clutter. Log events for the entire flock via Quick Log.</p>
                </div>
              </div>
            )}

            {(!isPoultry || !poultrySimplified) && viewMode === 'list' ? (
              <>
                {/* Registration Progress and Stats */}
          <div className="space-y-2">
            {(individuals.length < animalGroup.count || individuals.some(i => i.status === 'incomplete')) && (
              <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl flex flex-col xl:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center shrink-0">
                    <Activity size={16} className="animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-[11px] font-serif font-black text-amber-900 leading-none mb-1">Census Required</h4>
                    <p className="text-[9px] text-amber-700 font-medium leading-none">
                      {individuals.length < animalGroup.count && `${animalGroup.count - individuals.length} missing. `}
                      {individuals.some(i => i.status === 'incomplete') && `${individuals.filter(i => i.status === 'incomplete').length} pending tags.`}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1.5 w-full xl:w-auto">
                  {individuals.some(i => i.status === 'incomplete') && (
                    <button 
                      onClick={() => setStatusFilter('Incomplete')}
                      className="flex-1 xl:flex-none px-2.5 py-1.5 bg-white border border-amber-200 text-amber-700 rounded-lg font-black uppercase tracking-widest text-[7px] hover:bg-amber-100 transition-all"
                    >
                      Fill
                    </button>
                  )}
                  {individuals.length < animalGroup.count && (
                    <button 
                      onClick={() => setIsAdding(true)}
                      className="flex-1 xl:flex-none px-2.5 py-1.5 bg-amber-600 text-white rounded-lg font-black uppercase tracking-widest text-[7px] hover:bg-amber-700 transition-all"
                    >
                      Add
                    </button>
                  )}
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              <div className="bg-white p-2.5 rounded-xl shadow-sm border border-gray-50 text-center hover:shadow-md transition-all group overflow-hidden">
                <p className="text-[6px] font-black text-gray-400 uppercase tracking-widest mb-0.5 opacity-60 truncate">Target</p>
                <div className="flex items-center justify-center gap-1">
                  <h4 className="text-base font-serif font-black text-gray-900 leading-none">{animalGroup.count}</h4>
                  <TrendingUp size={7} className="text-[#5A5A40] opacity-20 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
              </div>
              <div className="bg-white p-2.5 rounded-xl shadow-sm border border-gray-50 text-center hover:shadow-md transition-all group overflow-hidden">
                <p className="text-[6px] font-black text-gray-400 uppercase tracking-widest mb-0.5 opacity-60 truncate">Verified</p>
                <div className="flex items-center justify-center gap-1">
                  <h4 className="text-base font-serif font-black text-[#5A5A40] leading-none">
                    {individuals.filter(i => i.status !== 'incomplete').length}
                  </h4>
                  <ShieldCheck size={7} className="text-emerald-500 opacity-20 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
              </div>
              <div className="col-span-2 md:col-span-2 lg:col-span-4 bg-white/80 p-2.5 rounded-xl shadow-sm border border-gray-50 hover:shadow-md transition-all">
                <div className="flex flex-wrap justify-center gap-3">
                  {Object.entries(
                    individuals.reduce((acc, curr) => {
                      const cat = curr.ageGroup || 'Unknown';
                      acc[cat] = (acc[cat] || 0) + 1;
                      return acc;
                    }, {} as Record<string, number>)
                  ).map(([cat, count]) => (
                    <div key={cat} className="text-center group min-w-[35px]">
                      <p className="text-sm font-black text-gray-900 group-hover:text-[#5A5A40] transition-colors leading-none">{count}</p>
                      <p className="text-[6px] font-black uppercase text-gray-400 tracking-tighter opacity-70 leading-none mt-1">{cat}</p>
                    </div>
                  ))}
                  {individuals.length === 0 && <p className="text-[8px] text-gray-400 italic">No data</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Individual List Header with Search and Filter */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2.5 bg-white p-2 rounded-xl border border-gray-100 shadow-sm">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" size={10} />
                <input 
                  type="text"
                  placeholder="Registry Search..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-gray-50/50 rounded-lg outline-none transition-all text-[10px] font-bold"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="px-2 py-1.5 bg-gray-50 rounded-lg outline-none text-[8px] font-black uppercase tracking-widest appearance-none border-transparent focus:border-[#5A5A40]/20"
                >
                  <option value="All">Status</option>
                  <option value="Incomplete">Pending</option>
                  <option value="Healthy">Healthy</option>
                  <option value="Sick">Sick</option>
                  <option value="Pregnant">Pregnant</option>
                  <option value="Quarantined">Quar.</option>
                  <option value="Recovering">Recov.</option>
                  <option value="Dead">Dead</option>
                </select>
                <select
                  value={vaccinationFilter}
                  onChange={e => setVaccinationFilter(e.target.value)}
                  className="px-2 py-1.5 bg-gray-50 rounded-lg outline-none text-[8px] font-black uppercase tracking-widest appearance-none border-transparent focus:border-[#5A5A40]/20"
                >
                  <option value="All">Vax</option>
                  <option value="Overdue">Overdue</option>
                  <option value="Due Soon">Soon</option>
                </select>
                <button 
                  onClick={() => setIsAdding(true)}
                  className="px-2.5 py-1.5 bg-[#5A5A40] text-white rounded-lg font-black uppercase tracking-widest text-[8px] hover:bg-black transition-all flex items-center gap-1"
                >
                  <Plus size={12} />
                  Add
                </button>
              </div>
            </div>

            <AnimatePresence>
              {(isAdding || isEditing) && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-white rounded-2xl p-4 border border-[#5A5A40]/10 overflow-hidden shadow-lg shadow-[#5A5A40]/5"
                >
                  <form onSubmit={isEditing ? handleUpdate : handleAdd} className="space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                       <div className="p-1.5 bg-[#5A5A40]/5 text-[#5A5A40] rounded-lg">
                          {isEditing ? <Edit2 size={12} /> : <Plus size={12} />}
                       </div>
                       <h5 className="font-serif font-black text-sm">{isEditing ? `Edit ${editingAnimal?.name}` : 'Register Asset'}</h5>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[8px] font-black text-gray-400 uppercase mb-1 ml-1 tracking-widest">Animal Name</label>
                        <input 
                          required
                          type="text" 
                          placeholder="Name"
                          className="w-full px-4 py-2 bg-gray-50 rounded-xl border border-transparent focus:bg-white focus:border-[#5A5A40] outline-none transition-all text-xs font-bold"
                          value={newAnimal.name}
                          onChange={e => setNewAnimal({...newAnimal, name: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-[8px] font-black text-gray-400 uppercase mb-1 ml-1 tracking-widest">Tag ID</label>
                        <input 
                          type="text" 
                          placeholder="Tag #"
                          className="w-full px-4 py-2 bg-gray-50 rounded-xl border border-transparent focus:bg-white focus:border-[#5A5A40] outline-none transition-all text-xs font-bold"
                          value={newAnimal.tagId}
                          onChange={e => setNewAnimal({...newAnimal, tagId: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-[8px] font-black text-gray-400 uppercase mb-1 ml-1 tracking-widest">DOB</label>
                        <input 
                          required
                          type="date" 
                          className="w-full px-4 py-2 bg-gray-50 rounded-xl border border-transparent focus:bg-white focus:border-[#5A5A40] outline-none transition-all text-xs font-bold"
                          value={newAnimal.dob}
                          onChange={e => setNewAnimal({...newAnimal, dob: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-[8px] font-black text-gray-400 uppercase mb-1 ml-1 tracking-widest">Gender</label>
                        <select 
                          className="w-full px-4 py-2 bg-gray-50 rounded-xl border border-transparent focus:bg-white focus:border-[#5A5A40] outline-none transition-all text-xs font-bold appearance-none"
                          value={newAnimal.gender}
                          onChange={e => setNewAnimal({...newAnimal, gender: e.target.value as any})}
                        >
                          <option value="Female">Female</option>
                          <option value="Male">Male</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[8px] font-black text-gray-400 uppercase mb-1 ml-1 tracking-widest">Breed</label>
                        {ANIMAL_BREEDS[animalGroup.type] ? (
                          <select 
                            className="w-full px-4 py-2 bg-gray-50 rounded-xl border border-transparent focus:bg-white focus:border-[#5A5A40] outline-none transition-all text-xs font-bold appearance-none"
                            value={newAnimal.breed}
                            onChange={e => setNewAnimal({...newAnimal, breed: e.target.value})}
                          >
                            <option value="">Select Breed</option>
                            {ANIMAL_BREEDS[animalGroup.type].map(breed => (
                              <option key={breed} value={breed}>{breed}</option>
                            ))}
                            <option value="Other">Other</option>
                          </select>
                        ) : (
                          <input 
                            type="text" 
                            placeholder="Breed"
                            className="w-full px-4 py-2 bg-gray-50 rounded-xl border border-transparent focus:bg-white focus:border-[#5A5A40] outline-none transition-all text-xs font-bold"
                            value={newAnimal.breed}
                            onChange={e => setNewAnimal({...newAnimal, breed: e.target.value})}
                          />
                        )}
                      </div>
                      <div>
                        <label className="block text-[8px] font-black text-gray-400 uppercase mb-1 ml-1 tracking-widest">Health Status</label>
                        <select 
                          className="w-full px-4 py-2 bg-gray-50 rounded-xl border border-transparent focus:bg-white focus:border-[#5A5A40] outline-none transition-all text-xs font-bold appearance-none"
                          value={newAnimal.healthStatus}
                          onChange={e => setNewAnimal({...newAnimal, healthStatus: e.target.value as any})}
                        >
                          <option value="Healthy">Healthy</option>
                          <option value="Sick">Sick</option>
                          <option value="Recovering">Recovering</option>
                          <option value="Quarantined">Quarantined</option>
                          <option value="Pregnant">Pregnant</option>
                          <option value="Dead">Dead</option>
                        </select>
                      </div>

                      {/* Expanded Fields */}
                      <div>
                        <label className="block text-[8px] font-black text-gray-400 uppercase mb-1 ml-1 tracking-widest">Source</label>
                        <select 
                          className="w-full px-4 py-2 bg-gray-50 rounded-xl border border-transparent focus:bg-white focus:border-[#5A5A40] outline-none transition-all text-xs font-bold appearance-none"
                          value={newAnimal.source}
                          onChange={e => setNewAnimal({...newAnimal, source: e.target.value as any})}
                        >
                          <option value="Born on farm">Born on farm</option>
                          <option value="Purchased">Purchased</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[8px] font-black text-gray-400 uppercase mb-1 ml-1 tracking-widest">Acquired Date</label>
                        <input 
                          type="date" 
                          className="w-full px-4 py-2 bg-gray-50 rounded-xl border border-transparent focus:bg-white focus:border-[#5A5A40] outline-none transition-all text-xs font-bold"
                          value={newAnimal.dateAcquired}
                          onChange={e => setNewAnimal({...newAnimal, dateAcquired: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-[8px] font-black text-gray-400 uppercase mb-1 ml-1 tracking-widest">Color / Marks</label>
                        <input 
                          type="text" 
                          placeholder="Description"
                          className="w-full px-4 py-2 bg-gray-50 rounded-xl border border-transparent focus:bg-white focus:border-[#5A5A40] outline-none transition-all text-xs font-bold"
                          value={newAnimal.color}
                          onChange={e => setNewAnimal({...newAnimal, color: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button 
                        type="button"
                        onClick={() => {
                          setIsAdding(false);
                          setIsEditing(false);
                          setEditingAnimal(null);
                        }}
                        className="px-4 py-2 text-[9px] font-black text-gray-400 hover:text-gray-600 transition-colors uppercase tracking-widest"
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit"
                        disabled={loading}
                        className="px-6 py-2 bg-[#5A5A40] text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2 shadow-sm"
                      >
                        {loading ? '...' : isEditing ? 'Update' : 'Register'}
                        <Save size={12} />
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="fluid-grid">
              {filteredIndividuals.map((animal) => (
                  <motion.div 
                    layout
                    key={animal.id} 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col gap-3 group hover:shadow-lg transition-all relative overflow-hidden"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className={cn(
                          "w-9 h-9 rounded-lg flex items-center justify-center text-xs font-black shadow-inner shrink-0 border transition-transform group-hover:scale-105 duration-500",
                          getAvatarColor(animal.name)
                        )}>
                          {getInitials(animal.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h5 className="text-[11px] font-serif font-black text-gray-900 truncate tracking-tight" title={animal.name}>
                            {animal.name}
                          </h5>
                          <div className={cn(
                             "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[6.5px] font-black uppercase tracking-widest",
                             animal.status === 'incomplete' ? "bg-amber-50 text-amber-600" : "bg-gray-50 text-gray-400"
                          )}>
                             {animal.status === 'incomplete' && <Info size={7} />}
                             {animal.status === 'incomplete' ? 'Pending' : (animal.tagId || 'No ID')}
                          </div>
                        </div>
                      </div>

                      {/* Status */}
                      <div className="shrink-0">
                         {animal.status === 'incomplete' ? (
                            <button 
                              onClick={() => handleEdit(animal)}
                              className="bg-[#5A5A40] text-white w-7 h-7 rounded-lg flex items-center justify-center shadow-lg shadow-[#5A5A40]/20 hover:scale-105 transition-transform"
                            >
                              <Plus size={14} />
                            </button>
                         ) : (
                            <div className={cn(
                              "px-1.5 py-0.5 rounded-md text-[7px] font-black uppercase tracking-widest border shadow-sm flex items-center gap-1",
                              animal.healthStatus === 'Healthy' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                              animal.healthStatus === 'Sick' ? 'bg-red-50 text-red-600 border-red-100' : 
                              animal.healthStatus === 'Dead' ? 'bg-gray-100 text-gray-600 border-gray-200' : 'bg-amber-50 text-amber-600 border-amber-100'
                            )}>
                              <div className={cn(
                                "w-1 h-1 rounded-full",
                                animal.healthStatus === 'Healthy' ? 'bg-emerald-500' : 
                                animal.healthStatus === 'Sick' ? 'bg-red-500' : 
                                animal.healthStatus === 'Dead' ? 'bg-gray-400' : 'bg-amber-500'
                              )} />
                              {animal.healthStatus}
                            </div>
                         )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-2">
                       <div className="bg-gray-50/30 p-2 rounded-lg border border-gray-100/50 text-center">
                          <p className="text-[6.5px] font-black text-gray-400 uppercase tracking-widest mb-0.5 opacity-60">Genealogy</p>
                          <p className="text-[9px] font-black text-gray-600 truncate">{animal.breed || 'Regional'}</p>
                       </div>
                       <div className="bg-gray-50/30 p-2 rounded-lg border border-gray-100/50 text-center">
                          <p className="text-[6.5px] font-black text-gray-400 uppercase tracking-widest mb-0.5 opacity-60">Maturation</p>
                          <p className="text-[9px] font-black text-gray-600 truncate">{animal.ageGroup} ({calculateAge(animal.dob)})</p>
                       </div>
                       <div className="bg-gray-50/30 p-2 rounded-lg border border-gray-100/50 text-center col-span-2">
                          <p className="text-[6.5px] font-black text-gray-400 uppercase tracking-widest mb-0.5 opacity-60">Tenure (Time on Farm)</p>
                          <p className="text-[9px] font-black text-gray-600 truncate">{calculateTimeOnFarm(animal.dateAcquired, animal.dateRegistered)}</p>
                       </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-50 mt-auto">
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => {
                            setSelectedAnimal(animal);
                            setIsProfileModalOpen(true);
                          }}
                          className="flex items-center gap-1 px-2 py-1 bg-[#5A5A40]/5 text-[#5A5A40] rounded-lg text-[7px] font-black uppercase tracking-widest hover:bg-[#5A5A40] hover:text-white transition-all"
                        >
                          <FileText size={8} />
                          Profile
                        </button>
                        <select 
                          value={animal.healthStatus}
                          onChange={(e) => handleUpdateHealth(animal.id, e.target.value as any)}
                          className="px-1 py-1 bg-gray-50 border border-gray-100 rounded-lg text-[7px] font-black uppercase tracking-widest text-gray-500 outline-none"
                        >
                          <option value="Healthy">Status</option>
                          <option value="Sick">Sick</option>
                          <option value="Quarantined">Quar.</option>
                          <option value="Recovering">Recov.</option>
                          <option value="Pregnant">Preg.</option>
                          <option value="Dead">Dead</option>
                        </select>
                      </div>
                      
                      <div className="flex items-center gap-0.5">
                        <button 
                          onClick={() => handleEdit(animal)}
                          className="p-1 px-1.5 text-gray-300 hover:text-[#5A5A40] hover:bg-[#5A5A40]/5 rounded-md transition-all"
                        >
                          <Edit2 size={10} />
                        </button>
                        <button 
                          onClick={() => generateBirthCertificate(animal)}
                          className="p-1 px-1.5 text-gray-300 hover:text-[#5A5A40] hover:bg-[#5A5A40]/5 rounded-md transition-all"
                        >
                          <ShieldCheck size={10} />
                        </button>
                        <button 
                          onClick={() => handleDelete(animal.id)}
                          className="p-1 px-1.5 text-gray-200 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>
                    
                    {/* Shadow Decor */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-brand/5 rounded-full blur-3xl -mr-16 -mt-16 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </motion.div>
              ))}

              {individuals.length === 0 && !isAdding && (
                <div className="text-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-gray-100">
                  <Info className="mx-auto text-gray-300 mb-4" size={48} />
                  <p className="text-gray-400 font-medium italic">No individual records registered for this group yet.</p>
                </div>
              )}

              {individuals.length > 0 && filteredIndividuals.length === 0 && (
                <div className="text-center py-20 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm">
                  <Search className="mx-auto text-gray-200 mb-4" size={48} />
                  <h4 className="text-xl font-serif font-bold text-gray-400">No matching animals found</h4>
                  <p className="text-gray-400 text-sm mt-2">Try adjusting your filters or search term.</p>
                  <button 
                    onClick={() => {
                      setSearchTerm('');
                      setStatusFilter('All');
                      setVaccinationFilter('All');
                    }}
                    className="mt-6 px-6 py-2 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-all text-xs"
                  >
                    Clear All Filters
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden group">
                  <div className="flex items-center gap-2 mb-2 relative z-10">
                    <div className="w-7 h-7 bg-orange-50 text-orange-600 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-orange-600 group-hover:text-white transition-all">
                      <Milk size={14} />
                    </div>
                    <h5 className="font-serif font-black text-[10px] text-gray-800 tracking-tight truncate">Top Asset Output</h5>
                  </div>
                  {(() => {
                    const logsByAnimal = productionLogs.reduce((acc, log) => {
                      if (log.animalId) {
                        acc[log.animalId] = (acc[log.animalId] || 0) + (log.quantity || 0);
                      }
                      return acc;
                    }, {} as Record<string, number>);
                    
                    const topAnimalId = Object.entries(logsByAnimal).sort((a: [string, number], b: [string, number]) => b[1] - a[1])[0]?.[0];
                    const topAnimal = individuals.find(i => i.id === topAnimalId);
                    
                    return topAnimal ? (
                      <div className="relative z-10">
                        <p className="text-lg font-serif font-black text-gray-900 leading-none tracking-tight">{topAnimal.name}</p>
                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mt-1">{logsByAnimal[topAnimalId]} {productionLogs[0]?.unit || 'Units'}</p>
                      </div>
                    ) : (
                      <p className="text-[9px] text-gray-400 italic font-medium">No yield markers</p>
                    );
                  })()}
                  <div className="absolute top-0 right-0 w-20 h-20 bg-orange-500/5 rounded-full blur-2xl -mr-10 -mt-10" />
                </div>

                <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden group">
                  <div className="flex items-center gap-2 mb-2 relative z-10">
                    <div className="w-7 h-7 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-all">
                      <BarChart3 size={14} />
                    </div>
                    <h5 className="font-serif font-black text-[10px] text-gray-800 tracking-tight truncate">Estate Aggregate</h5>
                  </div>
                  <div className="relative z-10">
                    <p className="text-lg font-serif font-black text-gray-900 leading-none tracking-tight">
                      {productionLogs.reduce((acc, l) => acc + (l.quantity || 0), 0).toLocaleString()}
                    </p>
                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mt-1">Lifetime Yield</p>
                  </div>
                  <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/5 rounded-full blur-2xl -mr-10 -mt-10" />
                </div>

                <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden group">
                  <div className="flex items-center gap-2 mb-2 relative z-10">
                    <div className="w-7 h-7 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                      <TrendingUp size={14} />
                    </div>
                    <h5 className="font-serif font-black text-[10px] text-gray-800 tracking-tight truncate">Efficiency Marker</h5>
                  </div>
                  <div className="relative z-10">
                    <p className="text-lg font-serif font-black text-gray-900 leading-none tracking-tight">
                      {(productionLogs.reduce((acc, l) => acc + (l.quantity || 0), 0) / (productionLogs.length || 1)).toFixed(1)}
                    </p>
                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mt-1">Metric Avg</p>
                  </div>
                  <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-full blur-2xl -mr-10 -mt-10" />
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-50 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50/50 border-b border-gray-100">
                        <th className="px-3 py-1.5 text-left text-[7px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                        <th className="px-3 py-1.5 text-left text-[7px] font-black text-gray-400 uppercase tracking-widest">Asset</th>
                        <th className="px-3 py-1.5 text-left text-[7px] font-black text-gray-400 uppercase tracking-widest">Yield</th>
                        <th className="px-3 py-1.5 text-left text-[7px] font-black text-gray-400 uppercase tracking-widest">Category</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {productionLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(log => {
                        const animal = individuals.find(i => i.id === log.animalId);
                        return (
                          <tr key={log.id} className="hover:bg-gray-50/50 transition-colors group">
                            <td className="px-3 py-2 text-[9px] font-bold text-gray-400">
                              {log.date ? format(new Date(log.date), 'MMM dd, yy') : 'N/A'}
                            </td>
                            <td className="px-3 py-2 font-black text-gray-700 text-[10px] truncate max-w-[100px]">{animal ? animal.name : '-- Bulk --'}</td>
                            <td className="px-3 py-2 font-black text-[#5A5A40] text-[10px]">{log.quantity} {log.unit}</td>
                            <td className="px-3 py-2">
                              <span className="px-1.5 py-0.5 bg-gray-50 text-gray-400 text-[6.5px] font-black rounded uppercase tracking-widest">{log.type}</span>
                            </td>
                          </tr>
                        );
                      })}
                      {productionLogs.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-gray-300 italic text-[9px] font-medium">
                            No yield markers discovered yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          </div>
        </div>

        {/* Full Profile View */}
        {isProfileModalOpen && selectedAnimal && (
          <AnimalProfile 
            animal={selectedAnimal} 
            onClose={() => setIsProfileModalOpen(false)} 
          />
        )}
      </div>
    );
}
