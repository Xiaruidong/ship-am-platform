export interface Material {
  id: string;
  materialName: string;
  materialCode: string;
  materialCategory: string;
  materialSubCategory: string;
  applicationDescription: string;
  supplier: string;
  batchNumber: string;
  chemicalComposition: {
    C: number;
    Cr: number;
    Ni: number;
    Mo: number;
    Mn: number;
    Si: number;
    P: number;
    S: number;
    N: number;
    O: number;
    Fe: number;
  };
  averageParticleSize: number;
  hallFlow: number;
  relatedParts: string[];
  relatedInspections: string[];
  relatedStandards: string[];
}

export interface Part {
  id: string;
  partName: string;
  categoryName: string;
  oemPartNumber: string;
  originalMaterialCode: string;
  modelFilePath: string;
  relatedMaterials: string[];
  relatedInspections: string[];
  relatedEquipment: string[];
}

export interface Equipment {
  id: string;
  equipmentName: string;
  manufacturer: string;
  machineType: string;
  buildSizeX: number;
  laserMaxPower: number;
  nodeLocation: string;
  equipmentStatus: string;
  relatedParts: string[];
}

export interface Inspection {
  id: string;
  sampleName: string;
  sampleDescription: string;
  samplingPosition: string;
  tensileStrength: number;
  yieldStrength: number;
  resultJudgment: string;
  remark: string;
  relatedParts: string[];
  relatedMaterials: string[];
}

export interface Standard {
  id: string;
  standardNumber: string;
  standardName: string;
  standardEnglishName: string;
  standardType: string;
  classificationSociety: string;
  standardPath: string;
  relatedMaterials: string[];
  relatedProcesses: string[];
  relatedInspections: string[];
}

export type ModuleType = 'materials' | 'parts' | 'equipment' | 'inspection' | 'standards' | 'orders';

export type OrderStatus = '待匹配' | '已匹配' | '已排产' | '生产中' | '已完成';

export interface ProcessParameters {
  laserPower: number;
  scanSpeed: number;
  layerThickness: number;
  scanStrategy: string;
  preheatTemperature: number;
  shieldingGas: string;
}

export interface ScheduleInfo {
  scheduleStartTime: string;
  scheduleEndTime: string;
  queuePosition: number;
  equipmentName: string;
}

export interface Order {
  id: string;
  orderName: string;
  materialId: string;
  partId: string;
  quantity: number;
  priority: string;
  requiredDeliveryDate: string;
  orderStatus: OrderStatus;
  matchedEquipmentId: string;
  processParameters: ProcessParameters;
  scheduleInfo: ScheduleInfo;
  qualityInspectionId: string;
  remark: string;
  createdAt: string;
}
