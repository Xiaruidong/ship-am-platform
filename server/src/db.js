import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'am_database',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true, // DATE/DATETIME 直接以 'YYYY-MM-DD' 字符串返回，与前端类型一致
});

// ---------- 实体配置：表名 + 驼峰字段 <-> 下划线列名 ----------

const fmtDate = (d) => {
  if (!d) return d;
  if (typeof d === 'string') return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
};

const entityConfigs = {
  materials: {
    table: 'materials',
    toObj: (r) => ({
      id: r.id,
      materialName: r.material_name,
      materialCode: r.material_code,
      materialCategory: r.material_category,
      materialSubCategory: r.material_sub_category,
      applicationDescription: r.application_description,
      supplier: r.supplier,
      batchNumber: r.batch_number,
      chemicalComposition: r.chemical_composition,
      averageParticleSize: r.average_particle_size,
      hallFlow: r.hall_flow,
      relatedParts: r.related_parts || [],
      relatedInspections: r.related_inspections || [],
      relatedStandards: r.related_standards || [],
    }),
    toRow: (o) => ([
      o.id, o.materialName, o.materialCode, o.materialCategory, o.materialSubCategory || '',
      o.applicationDescription || '', o.supplier || '', o.batchNumber || '',
      JSON.stringify(o.chemicalComposition || {}), o.averageParticleSize ?? 0, o.hallFlow ?? 0,
      JSON.stringify(o.relatedParts || []), JSON.stringify(o.relatedInspections || []), JSON.stringify(o.relatedStandards || []),
    ]),
    insertSql: `INSERT INTO materials (id, material_name, material_code, material_category, material_sub_category,
      application_description, supplier, batch_number, chemical_composition, average_particle_size, hall_flow,
      related_parts, related_inspections, related_standards) VALUES (${'?,'.repeat(13)}?)`,
  },
  parts: {
    table: 'parts',
    toObj: (r) => ({
      id: r.id,
      partName: r.part_name,
      categoryName: r.category_name,
      oemPartNumber: r.oem_part_number,
      originalMaterialCode: r.original_material_code,
      modelFilePath: r.model_file_path,
      relatedMaterials: r.related_materials || [],
      relatedInspections: r.related_inspections || [],
      relatedEquipment: r.related_equipment || [],
    }),
    toRow: (o) => ([
      o.id, o.partName, o.categoryName || '', o.oemPartNumber || '', o.originalMaterialCode || '',
      o.modelFilePath || '',
      JSON.stringify(o.relatedMaterials || []), JSON.stringify(o.relatedInspections || []), JSON.stringify(o.relatedEquipment || []),
    ]),
    insertSql: `INSERT INTO parts (id, part_name, category_name, oem_part_number, original_material_code,
      model_file_path, related_materials, related_inspections, related_equipment) VALUES (${'?,'.repeat(8)}?)`,
  },
  equipment: {
    table: 'equipment',
    toObj: (r) => ({
      id: r.id,
      equipmentName: r.equipment_name,
      manufacturer: r.manufacturer,
      machineType: r.machine_type,
      buildSizeX: r.build_size_x,
      laserMaxPower: r.laser_max_power,
      nodeLocation: r.node_location,
      equipmentStatus: r.equipment_status,
      relatedParts: r.related_parts || [],
    }),
    toRow: (o) => ([
      o.id, o.equipmentName, o.manufacturer || '', o.machineType || '', o.buildSizeX ?? 0,
      o.laserMaxPower ?? 0, o.nodeLocation || '', o.equipmentStatus || '待机',
      JSON.stringify(o.relatedParts || []),
    ]),
    insertSql: `INSERT INTO equipment (id, equipment_name, manufacturer, machine_type, build_size_x,
      laser_max_power, node_location, equipment_status, related_parts) VALUES (${'?,'.repeat(8)}?)`,
  },
  inspection: {
    table: 'inspections',
    toObj: (r) => ({
      id: r.id,
      sampleName: r.sample_name,
      sampleDescription: r.sample_description,
      samplingPosition: r.sampling_position,
      tensileStrength: r.tensile_strength,
      yieldStrength: r.yield_strength,
      resultJudgment: r.result_judgment,
      remark: r.remark,
      relatedParts: r.related_parts || [],
      relatedMaterials: r.related_materials || [],
    }),
    toRow: (o) => ([
      o.id, o.sampleName, o.sampleDescription || '', o.samplingPosition || '',
      o.tensileStrength ?? 0, o.yieldStrength ?? 0, o.resultJudgment || '', o.remark || '',
      JSON.stringify(o.relatedParts || []), JSON.stringify(o.relatedMaterials || []),
    ]),
    insertSql: `INSERT INTO inspections (id, sample_name, sample_description, sampling_position,
      tensile_strength, yield_strength, result_judgment, remark, related_parts, related_materials)
      VALUES (${'?,'.repeat(9)}?)`,
  },
  standards: {
    table: 'standards',
    toObj: (r) => ({
      id: r.id,
      standardNumber: r.standard_number,
      standardName: r.standard_name,
      standardEnglishName: r.standard_english_name,
      standardType: r.standard_type,
      classificationSociety: r.classification_society,
      standardPath: r.standard_path,
      relatedMaterials: r.related_materials || [],
      relatedProcesses: r.related_processes || [],
      relatedInspections: r.related_inspections || [],
    }),
    toRow: (o) => ([
      o.id, o.standardNumber, o.standardName || '', o.standardEnglishName || '', o.standardType || '',
      o.classificationSociety || '', o.standardPath || '',
      JSON.stringify(o.relatedMaterials || []), JSON.stringify(o.relatedProcesses || []), JSON.stringify(o.relatedInspections || []),
    ]),
    insertSql: `INSERT INTO standards (id, standard_number, standard_name, standard_english_name, standard_type,
      classification_society, standard_path, related_materials, related_processes, related_inspections)
      VALUES (${'?,'.repeat(9)}?)`,
  },
  orders: {
    table: 'orders',
    toObj: (r) => ({
      id: r.id,
      orderName: r.order_name,
      materialId: r.material_id,
      partId: r.part_id,
      quantity: r.quantity,
      priority: r.priority,
      requiredDeliveryDate: fmtDate(r.required_delivery_date),
      orderStatus: r.order_status,
      matchedEquipmentId: r.matched_equipment_id || '',
      processParameters: r.process_parameters || {},
      scheduleInfo: r.schedule_info || {},
      qualityInspectionId: r.quality_inspection_id || '',
      remark: r.remark || '',
      createdAt: fmtDate(r.created_at),
    }),
    toRow: (o) => ([
      o.id, o.orderName, o.materialId, o.partId, o.quantity ?? 1, o.priority || '普通',
      o.requiredDeliveryDate || null, o.orderStatus || '待匹配', o.matchedEquipmentId || '',
      JSON.stringify(o.processParameters || {}), JSON.stringify(o.scheduleInfo || {}),
      o.qualityInspectionId || '', o.remark || '', o.createdAt || new Date().toISOString().slice(0, 10),
    ]),
    insertSql: `INSERT INTO orders (id, order_name, material_id, part_id, quantity, priority,
      required_delivery_date, order_status, matched_equipment_id, process_parameters, schedule_info,
      quality_inspection_id, remark, created_at) VALUES (${'?,'.repeat(13)}?)`,
  },
};

export function getEntityConfig(name) {
  return entityConfigs[name] || null;
}

export async function listEntity(name) {
  const cfg = entityConfigs[name];
  const [rows] = await pool.query(`SELECT * FROM ${cfg.table}`);
  return rows.map(cfg.toObj);
}

export async function getEntityById(name, id) {
  const cfg = entityConfigs[name];
  const [rows] = await pool.query(`SELECT * FROM ${cfg.table} WHERE id = ?`, [id]);
  return rows.length ? cfg.toObj(rows[0]) : null;
}

// 与前端 src/mock/mockOrders.ts 保持一致的状态机
export const statusTransitions = {
  '待匹配': { next: '已匹配', prev: null },
  '已匹配': { next: '已排产', prev: '待匹配' },
  '已排产': { next: '生产中', prev: '已匹配' },
  '生产中': { next: '已完成', prev: '已排产' },
  '已完成': { next: null, prev: '生产中' },
};
