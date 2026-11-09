// 测试用例数据生成器：在种子数据基础上批量生成覆盖面更广的测试数据
// 运行：node --import tsx db/test-data.mjs [--clean]（--clean 仅删除测试数据）
//
// 数据特征设计（便于推进后续工作）：
// - materials 40 条：6 个大类 × 多批次，名称带编号便于搜索测试
// - parts 50 条：5 个分类，OEM 件号规则生成
// - equipment 15 台：3 种状态、3 个节点、功率/尺寸分档
// - inspections 40 条：合格/不合格/让步接收三种判定
// - standards 15 份：CCS/ABS/DNV/LR/BV 五家船级社
// - orders 40 单：五种状态全覆盖、四种优先级、含超设备功率的异常参数用例
// 所有测试数据 id 以 T- 开头，与种子数据（mat-/part-/…）隔离，可单独清理
import { pool } from '../src/db.js';
import { materials as seedMaterials, parts as seedParts } from '../../src/mock/mockData.ts';

const argClean = process.argv.includes('--clean');

// ---------- 材料模板：大类/子类/成分范围 ----------
const materialTemplates = [
  { cat: '铁基合金', sub: '奥氏体不锈钢', name: '奥氏体不锈钢', code: '316L', fe: '余量' },
  { cat: '铁基合金', sub: '马氏体不锈钢', name: '马氏体不锈钢', code: '15-5PH', fe: '余量' },
  { cat: '镍基合金', sub: '沉淀硬化镍基', name: '沉淀硬化镍基合金', code: 'IN718', fe: '18' },
  { cat: '镍基合金', sub: '固溶强化镍基', name: '固溶强化镍基合金', code: 'IN625', fe: '5' },
  { cat: '钛合金', sub: 'α+β两相钛', name: 'α+β两相钛合金', code: 'TC4', fe: '0.3' },
  { cat: '铝合金', sub: 'Al-Si铸造铝', name: '铸造铝硅合金', code: 'AlSi10Mg', fe: '0.3' },
];
const suppliers = ['赫格纳斯（中国）有限公司', '中航迈特粉冶科技', '西安欧中材料科技', '飞而康快速制造', '威拉里新材料', '鞍钢粉体材料'];

function genMaterials() {
  const list = [];
  const now = new Date();
  for (let i = 0; i < 40; i++) {
    const t = materialTemplates[i % materialTemplates.length];
    const no = String(i + 1).padStart(3, '0');
    const c = (v, j) => Number((v + ((i * 7 + j * 3) % 5) * 0.01).toFixed(2));
    list.push({
      id: `T-mat-${no}`,
      materialName: `${t.name}${t.code}-测试${no}`,
      materialCode: `${t.code}-T${no}`,
      materialCategory: t.cat,
      materialSubCategory: t.sub,
      applicationDescription: `测试用材料${no}：船舶增材制造数据共享平台测试数据，用于验证列表筛选、分页与全局搜索`,
      supplier: suppliers[i % suppliers.length],
      batchNumber: `B2026-${no}`,
      chemicalComposition: {
        C: c(0.02, 1), Cr: c(17, 2), Ni: c(8, 3), Mo: c(2.5, 4), Mn: c(0.8, 5),
        Si: c(0.5, 6), P: c(0.02, 7), S: c(0.01, 8), N: c(0.05, 9), O: c(0.02, 10), Fe: t.fe,
      },
      averageParticleSize: [15, 20, 25, 30, 45][i % 5],
      hallFlow: [22, 26, 30, 35][i % 4],
      relatedParts: [],
      relatedInspections: [],
      relatedStandards: [],
    });
  }
  return list;
}

// ---------- 零部件：分类 × OEM 件号 ----------
const partCategories = ['柴油机部件', '泵阀部件', '轴系部件', '叶片部件', '结构件'];
const partNames = ['缸体', '缸盖', '海水泵叶轮', '齿轮箱壳体', '联轴器', '涡轮叶片', '导向器', '排气歧管', '密封环', '支架', '阀座', '散热器壳体'];
function genParts() {
  const list = [];
  for (let i = 0; i < 50; i++) {
    const no = String(i + 1).padStart(3, '0');
    const mat = seedMaterials[i % seedMaterials.length];
    list.push({
      id: `T-part-${no}`,
      partName: `测试零件${no}-${partNames[i % partNames.length]}`,
      categoryName: partCategories[i % partCategories.length],
      oemPartNumber: `OEM-T-${String(1000 + i)}`,
      originalMaterialCode: mat.materialCode,
      modelFilePath: `/models/test/part_${no}.stl`,
      relatedMaterials: [mat.id],
      relatedInspections: [],
      relatedEquipment: [],
    });
  }
  return list;
}

// ---------- 设备：状态/节点/功率分档 ----------
function genEquipment() {
  const list = [];
  const makers = ['SLM Solutions', 'EOS', '华曙高科', '铂力特', '雷尼绍', 'DMG Mori'];
  const statuses = ['运行中', '待机', '维护中'];
  const locations = ['上海基地', '南通基地', '青岛基地', '广州基地'];
  for (let i = 0; i < 15; i++) {
    const no = String(i + 1).padStart(3, '0');
    list.push({
      id: `T-equip-${no}`,
      equipmentName: `${makers[i % makers.length]} TEST-${no}`,
      manufacturer: makers[i % makers.length],
      machineType: i % 3 === 0 ? 'SLM' : i % 3 === 1 ? 'EBM' : 'LPBF',
      buildSizeX: [250, 300, 400, 500, 600][i % 5],
      laserMaxPower: [400, 500, 700, 1000][i % 4],
      nodeLocation: locations[i % locations.length],
      equipmentStatus: statuses[i % 3 === 0 ? 0 : i % 3], // 运行中偏多
      relatedParts: [],
    });
  }
  return list;
}

// ---------- 检测：三种判定 ----------
function genInspections() {
  const list = [];
  const judgments = ['合格', '不合格', '让步接收'];
  const positions = ['顶部', '中部', '底部', 'X向侧壁', 'Y向侧壁', '45°悬垂区'];
  for (let i = 0; i < 40; i++) {
    const no = String(i + 1).padStart(3, '0');
    const ok = judgments[i % 10 === 4 ? 1 : i % 10 === 7 ? 2 : 0]; // 70% 合格 / 10% 不合格 / 20% 让步
    list.push({
      id: `T-ins-${no}`,
      sampleName: `测试试样${no}`,
      sampleDescription: `测试批次试样，验证检测数据列表与合格率统计（${ok}）`,
      samplingPosition: positions[i % positions.length],
      tensileStrength: 600 + (i % 12) * 25,
      yieldStrength: 400 + (i % 12) * 18,
      resultJudgment: ok,
      remark: ok === '合格' ? '力学性能满足标准要求' : ok === '让步接收' ? '局部指标略低，经评审让步接收' : '抗拉强度低于标准下限，判不合格',
      relatedParts: [],
      relatedMaterials: [],
    });
  }
  return list;
}

// ---------- 标准：五家船级社 ----------
function genStandards() {
  const list = [];
  const societies = ['CCS', 'ABS', 'DNV', 'LR', 'BV'];
  const types = ['材料标准', '工艺标准', '检测标准', '验收标准'];
  for (let i = 0; i < 15; i++) {
    const no = String(i + 1).padStart(2, '0');
    list.push({
      id: `T-std-${no}`,
      standardNumber: `${societies[i % 5]}-T-2026-${no}`,
      standardName: `船用金属增材制造测试标准 第${no}号：试验方法与验收准则`,
      standardEnglishName: `Test Standard for Marine Additive Manufacturing No.${no}`,
      standardType: types[i % types.length],
      classificationSociety: societies[i % societies.length],
      standardPath: `/standards/test/std_${no}.pdf`,
      relatedMaterials: [],
      relatedProcesses: [],
      relatedInspections: [],
    });
  }
  return list;
}

// ---------- 订单：五状态 × 四优先级 × 日期跨度 ----------
function genOrders() {
  const list = [];
  const statuses = ['待匹配', '已匹配', '已排产', '生产中', '已完成'];
  const priorities = ['紧急', '高', '普通', '低'];
  const ships = ['沪东H12xx', '江南H13xx', '外高桥H14xx', '黄埔文冲H15xx'];
  const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const equipAll = genEquipment();

  for (let i = 0; i < 40; i++) {
    const no = String(i + 1).padStart(3, '0');
    const mat = seedMaterials[i % seedMaterials.length];
    const part = seedParts[i % seedParts.length];
    const status = statuses[i % 5];
    const priority = priorities[i % 4];
    const equip = equipAll[i % equipAll.length];
    // 用例 5 的订单故意配置超出设备能力的激光功率，用于验证前端「超出设备能力」告警展示
    const overPower = i % 5 === 4;
    const matched = status !== '待匹配';
    list.push({
      id: `T-ORD-2026-${no}`,
      orderName: `${ships[i % 4]}测试订单${no}`,
      materialId: mat.id,
      partId: part.id,
      quantity: (i % 10) + 1,
      priority,
      requiredDeliveryDate: addDays(10 + (i % 6) * 10),
      orderStatus: status,
      matchedEquipmentId: matched ? equip.id : '',
      processParameters: matched ? {
        laserPower: overPower ? equip.laserMaxPower + 200 : Math.round(equip.laserMaxPower * 0.8),
        scanSpeed: 800 + (i % 5) * 100,
        layerThickness: 0.03 + (i % 3) * 0.01,
        scanStrategy: ['棋盘式', '条纹式', '岛式'][i % 3],
        preheatTemperature: [80, 100, 120, 150][i % 4],
        shieldingGas: i % 7 === 3 ? '氮气' : '氩气',
      } : { laserPower: 0, scanSpeed: 0, layerThickness: 0, scanStrategy: '', preheatTemperature: 0, shieldingGas: '' },
      scheduleInfo: matched ? {
        scheduleStartTime: status === '待匹配' ? '' : addDays(1 + (i % 5)),
        scheduleEndTime: status === '已完成' ? addDays(-3 - (i % 4)) : status === '待匹配' ? '' : addDays(5 + (i % 5)),
        queuePosition: (i % 3) + 1,
        equipmentName: equip.equipmentName,
      } : { scheduleStartTime: '', scheduleEndTime: '', queuePosition: 0, equipmentName: '' },
      qualityInspectionId: status === '已完成' ? `T-ins-${String((i % 40) + 1).padStart(3, '0')}` : '',
      remark: overPower ? '测试用例：激光功率超出设备能力上限，用于验证告警展示' : `测试订单${no}：状态流转与筛选分页验证`,
      createdAt: addDays(-30 + i),
    });
  }
  return list;
}

// ---------- 落库 ----------
async function insertEntity(name, list) {
  const { getEntityConfig } = await import('../src/db.js');
  const cfg = getEntityConfig(name);
  for (const item of list) {
    await pool.query(cfg.insertSql.replace('INSERT INTO', 'INSERT IGNORE INTO'), cfg.toRow(item));
  }
}

async function clean() {
  await pool.query("DELETE FROM orders WHERE id LIKE 'T-%'");
  await pool.query("DELETE FROM inspections WHERE id LIKE 'T-%'");
  await pool.query("DELETE FROM standards WHERE id LIKE 'T-%'");
  await pool.query("DELETE FROM equipment WHERE id LIKE 'T-%'");
  await pool.query("DELETE FROM parts WHERE id LIKE 'T-%'");
  await pool.query("DELETE FROM materials WHERE id LIKE 'T-%'");
  console.log('✓ 测试数据已清理（种子数据保留）');
}

async function main() {
  if (argClean) {
    await clean();
  } else {
    const plans = [
      ['materials', genMaterials()],
      ['parts', genParts()],
      ['equipment', genEquipment()],
      ['inspection', genInspections()],
      ['standards', genStandards()],
      ['orders', genOrders()],
    ];
    for (const [name, list] of plans) {
      await insertEntity(name, list);
      console.log(`✓ ${name}: +${list.length} 条测试数据`);
    }
    console.log('测试数据生成完成（id 前缀 T-，可用 --clean 单独清理）');
  }
  await pool.end();
}

main().catch((err) => {
  console.error('测试数据生成失败：', err);
  process.exit(1);
});
