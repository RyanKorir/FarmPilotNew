export interface Farm {
  id: string;
  name: string;
  ownerId: string;
  location?: string;
  createdAt: string;
  description?: string;
  isDefault?: boolean;
}

export interface Livestock {
  id: string;
  type: 'Chicken' | 'Cow' | 'Goat' | 'Sheep' | 'Pig' | 'Camel' | 'Donkey' | 'Rabbit' | 'Fish' | 'Bees' | 'Duck' | 'Turkey' | 'Other';
  count: number;
  ageGroup: string;
  healthStatus: 'Healthy' | 'Sick' | 'Quarantined' | 'Recovering' | 'Dead';
  lastUpdated: string;
  ownerId: string;
  notes?: string;
  farmId?: string;
  registeredCount?: number;
}

export interface IndividualLivestock {
  id: string;
  groupId: string; // Reference to Livestock group
  name: string;
  tagId: string; // Mandatory for unique identification
  dob: string;
  ageGroup: string; // Calculated based on DOB (Newborn, Calf, Heifer, etc.)
  dateRegistered: string; // Auto-set on creation
  gender: 'Male' | 'Female';
  breed?: string;
  healthStatus: 'Healthy' | 'Sick' | 'Quarantined' | 'Recovering' | 'Dead' | 'Pregnant';
  physicalDescription?: string;
  color?: string;
  motherId?: string;
  fatherId?: string;
  breederInfo?: string;
  source?: 'Born on farm' | 'Purchased';
  dateAcquired?: string;
  initialWeight?: number;
  purchasePrice?: number;
  feedSchedule?: {
    type: string;
    quantity: number;
    unit: string;
    schedule: string;
  };
  ownerId: string;
  farmId: string;
  notes?: string;
  nextVaccinationDate?: string; // Denormalized for filtering
  saleDate?: string;
  deathDate?: string;
  status?: 'active' | 'incomplete' | 'sold' | 'deceased';
  registrationProgress?: number;
  type?: string; 
  updatedAt?: any;
  createdAt: any;
}

export interface AnimalHealthRecord {
  id: string;
  animalId: string;
  type: 'Illness' | 'Vet Visit' | 'Medication' | 'Treatment' | 'Check-up';
  date: string;
  diagnosis?: string;
  treatment?: string;
  medication?: string;
  veterinarian?: string;
  bodyCondition?: string; // e.g. "Excellent", "Good", "Thin"
  followUpDate?: string;
  notes?: string;
  ownerId: string;
}

export interface AnimalVaccination {
  id: string;
  animalId: string;
  vaccineName: string;
  dateGiven: string;
  nextDueDate?: string;
  administeredBy?: string;
  notes?: string;
  ownerId: string;
}

export interface AnimalBreedingRecord {
  id: string;
  animalId: string;
  matingDate: string;
  bullId?: string;
  pregnancyCheckResult: 'Positive' | 'Negative' | 'Pending';
  expectedCalvingDate?: string;
  actualCalvingDate?: string;
  complications?: string;
  calves?: {
    id: string;
    sex: 'Male' | 'Female';
    weight: number;
  }[];
  ownerId: string;
}

export interface AnimalProductionLog {
  id: string;
  animalId: string;
  date: string;
  quantity: number;
  unit: string;
  type: 'Milk' | 'Eggs' | 'Wool';
  ownerId: string;
  notes?: string;
}

export interface AnimalWeightLog {
  id: string;
  animalId: string;
  date: string;
  weight: number;
  growthRate?: number; // kg/day since last weight
  conditionScore?: number; // 1-5 scale
  ownerId: string;
  notes?: string;
}

export interface Production {
  id: string;
  type: string;
  animalId?: string;
  quantity: number;
  unit: string;
  date: string;
  ownerId: string;
  farmId: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  minThreshold: number;
  ownerId: string;
  farmId: string;
  batchNumber?: string; // For unique identification of batches
  supplier?: string;
  expiryDate?: string;
}

export interface InventoryHistory {
  id: string;
  oldQuantity: number;
  newQuantity: number;
  change: number;
  reason: string;
  updatedBy: string;
  timestamp: string;
}

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description: string;
  date: string;
  ownerId: string;
  farmId: string;
  relatedInventoryId?: string; // Link to inventory item
  relatedLivestockId?: string; // Link to livestock group or individual
  quantity?: number; // Quantity involved in the transaction
}

export interface WidgetConfig {
  id: string;
  type: string;
  title: string;
  visible: boolean;
  position: number;
}
