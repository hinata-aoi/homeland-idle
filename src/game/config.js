// ============================================================
// 《家园》游戏配置 — 所有可调参数都在这里
// ============================================================

// ========================
// 物资定义
// ========================

export const BASIC_RESOURCES = {
  wheat:      { name: '小麦', icon: '🌾', starting: 50,  baseCapacity: 1000 },
  wood:       { name: '木材', icon: '🪵', starting: 30,  baseCapacity: 800 },
  stone:      { name: '石头', icon: '🪨', starting: 10,  baseCapacity: 600 },
  hide:       { name: '兽皮', icon: '🦴', starting: 5,   baseCapacity: 400 },
  fish:       { name: '鱼',   icon: '🐟', starting: 0,   baseCapacity: 500 },
  freshWater: { name: '淡水', icon: '💧', starting: 0,   baseCapacity: 800 },
  rice:       { name: '水稻', icon: '🍚', starting: 0,   baseCapacity: 1000 },
  herb:       { name: '草药', icon: '🌿', starting: 0,   baseCapacity: 500 },
  treeFruit:  { name: '树果', icon: '🍎', starting: 0,   baseCapacity: 400 },
  milk:       { name: '牛奶', icon: '🥛', starting: 0,   baseCapacity: 400 },
  meat:       { name: '兽肉', icon: '🍖', starting: 0,   baseCapacity: 400 },
}

export const REFINED_RESOURCES = {
  plank:   { name: '木板', icon: '🪵', starting: 0, baseCapacity: 300 },
  brick:   { name: '石材', icon: '🧱', starting: 0, baseCapacity: 300 },
  leather: { name: '皮革', icon: '👜', starting: 0, baseCapacity: 200 },
  bread:   { name: '面包', icon: '🍞', starting: 0, baseCapacity: 200 },
  wine:    { name: '酒',   icon: '🍷', starting: 0, baseCapacity: 150 },
  simpleMedicine: { name: '简易医药', icon: '🧪', starting: 0, baseCapacity: 150 },
  flour:   { name: '面粉', icon: '🥖', starting: 0, baseCapacity: 200 },
  resin:   { name: '树脂', icon: '🍯', starting: 0, baseCapacity: 200 },
  marble:  { name: '大理石', icon: '🪦', starting: 0, baseCapacity: 200 },
  fur:     { name: '毛皮', icon: '🦫', starting: 0, baseCapacity: 200 },
  fiber:   { name: '纤维', icon: '🧵', starting: 0, baseCapacity: 200 },
  bandage: { name: '绷带', icon: '🩹', starting: 0, baseCapacity: 150 },
}

export const ALL_RESOURCES = { ...BASIC_RESOURCES, ...REFINED_RESOURCES }

// ========================
// 人口系统配置
// ========================

export const POPULATION_CONFIG = {
  initialPopulation: 4,       // 初始人口数
}

// ========================
// 需求系统配置（食物值）
// ========================

export const DEMAND_CONFIG = {
  foodValuePerPersonPerSec: 2,    // 每人每秒消耗食物值
  offlineConsumptionRate: 0.5,    // 离线消耗速率倍率
}

// ========================
// 政策系统配置
// ========================

export const POLICY_CONFIG = {
  conversions: [
    { input: 'wheat', output: 'foodValue', ratio: 5, maxRate: 50, name: '小麦转化' },
    { input: 'bread', output: 'foodValue', ratio: 1, maxRate: 10, name: '面包转化', unlockBy: { building: 'townhall', level: 2 } },
  ],
  defaultRate: 0,  // 默认不转化
}

// ========================
// 建筑定义（统一系统）
// ========================
// type: 'production'  → 随时间自动产出资源（需进驻人口）
// type: 'processing'  → 将资源加工为另一种资源（需进驻人口）
// type: 'key'         → 关键建筑，提供全局加成（无需人口）
//
// populationSlots: { base, perLevel } — 该建筑的人口槽位
//   slots = base + floor((level-1) / perLevel)，Lv5 后不再增加（见 store.getBuildingSlots）

// ========================
// 升级成本配置
// ========================
export const UPGRADE_COST_CONFIG = {
  levelThreshold: 5,           // Lv5 开始引入精炼资源成本
  multiplierIncrease: 0.10,    // Lv5+ 主成本 multiplier 额外增加
  secondaryRatio: 0.3,         // 精炼资源成本 ≈ 主成本 × 30%
  productionSecondary: 'plank',  // 生产建筑 Lv5+ 需要木板
  processingSecondary: 'brick',  // 加工建筑 Lv5+ 需要石材
}

export const BUILDINGS = [
  // ========== 生产建筑 ==========
  {
    id: 'farm',
    type: 'production',
    name: '农田',
    icon: '🌾',
    description: '自动种植和收获作物',
    produces: 'wheat',
    baseRate: 3,          // 1级 = 3 小麦/s
    ratePerLevel: 0.5,    // 每级 +1.5 小麦/s（3×0.5=1.5）
    baseCost: 15,
    costMultiplier: 1.5,
    costResource: 'wood',
    maxLevel: 5,          // Lv5 封顶 → 可专精进化（里程碑系统已重做）
    populationSlots: { base: 3, perLevel: 1 },
    recipes: [
      { id: 'wheat', name: '小麦', outputs: [{ resource: 'wheat', rate: 3 }] },
      { id: 'rice', name: '水稻', outputs: [{ resource: 'rice', rate: 1.5 }], unlockAt: 5 },
    ],
  },

  // ========== 农田进化分支 ==========
  {
    id: 'fertileFarm',
    type: 'production',
    name: '肥沃农场',
    icon: '🌱',
    description: '精耕细作，大量产出小麦',
    produces: 'wheat',
    baseRate: 8,          // 1级 = 8 小麦/s
    ratePerLevel: 0.25,   // 每级 +2 小麦/s（8×0.25）
    baseCost: 15,
    costMultiplier: 1.5,
    costResource: 'wood',
    maxLevel: 10,         // 预留二次进化
    evolvedOnly: true,    // 不可直接建造，只能通过农田 Lv5 专精获得
    evolvedFrom: 'farm',
    populationSlots: { base: 3, perLevel: 1 },
  },
  {
    id: 'plantation',
    type: 'production',
    name: '种植园',
    icon: '🏡',
    description: '轮作小麦与水稻',
    produces: 'wheat',
    baseRate: 4,          // 兼容占位（实际产出由 recipes 定义）
    ratePerLevel: 0.25,   // 每级小麦/水稻各 +1/s（4×0.25）
    baseCost: 15,
    costMultiplier: 1.5,
    costResource: 'wood',
    maxLevel: 10,
    evolvedOnly: true,
    evolvedFrom: 'farm',
    populationSlots: { base: 3, perLevel: 1 },
    recipes: [
      { id: 'default', name: '小麦+水稻', outputs: [
        { resource: 'wheat', rate: 4 },
        { resource: 'rice', rate: 4 }
      ]}
    ],
  },
  {
    id: 'forest',
    type: 'production',
    name: '森林',
    icon: '🌲',
    description: '伐木采集木材',
    produces: 'wood',
    baseRate: 0.8,
    ratePerLevel: 0.10,
    baseCost: 10,
    costMultiplier: 1.5,
    costResource: 'wood',
    maxLevel: 5,
    populationSlots: { base: 3, perLevel: 1 },
  },

  // ========== 森林进化分支 ==========
  {
    id: 'fastForest',
    type: 'production',
    name: '速生林',
    icon: '🌲',
    description: '快速生长的林地',
    produces: 'wood',
    baseRate: 2,          // 1级 = 2 木材/s
    ratePerLevel: 0.25,   // 每级 +0.5 木材/s（2×0.25）
    baseCost: 10,
    costMultiplier: 1.5,
    costResource: 'wood',
    maxLevel: 10,
    evolvedOnly: true,
    evolvedFrom: 'forest',
    populationSlots: { base: 3, perLevel: 1 },
  },
  {
    id: 'orchard',
    type: 'production',
    name: '果树林',
    icon: '🌳',
    description: '木材与树果并收',
    produces: 'wood',
    baseRate: 1,          // 兼容占位（实际产出由 recipes 定义）
    ratePerLevel: 0.25,   // 每级木材/树果各 +0.25/s（1×0.25）
    baseCost: 10,
    costMultiplier: 1.5,
    costResource: 'wood',
    maxLevel: 10,
    evolvedOnly: true,
    evolvedFrom: 'forest',
    populationSlots: { base: 3, perLevel: 1 },
    recipes: [
      { id: 'default', name: '木材+树果', outputs: [
        { resource: 'wood', rate: 1 },
        { resource: 'treeFruit', rate: 1 }
      ]}
    ],
  },
  {
    id: 'quarry',
    type: 'production',
    name: '采石场',
    icon: '⛰️',
    description: '开采建筑石料',
    produces: 'stone',
    baseRate: 0.5,
    ratePerLevel: 0.10,
    baseCost: 20,
    costMultiplier: 1.6,
    costResource: 'wood',
    maxLevel: 5,
    populationSlots: { base: 3, perLevel: 1 },
    unlockBy: { building: 'townhall', level: 2 },
  },

  // ========== 采石场进化分支 ==========
  {
    id: 'deepQuarry',
    type: 'production',
    name: '掘石场',
    icon: '⛏️',
    description: '深挖石头与石材',
    produces: 'stone',
    baseRate: 1,          // 兼容占位（实际产出由 recipes 定义）
    ratePerLevel: 0.5,    // 每级 +0.5 石头/s 与 +0.25 石材/s
    baseCost: 20,
    costMultiplier: 1.6,
    costResource: 'wood',
    maxLevel: 10,
    evolvedOnly: true,
    evolvedFrom: 'quarry',
    populationSlots: { base: 3, perLevel: 1 },
    recipes: [
      { id: 'default', name: '石头+石材', outputs: [
        { resource: 'stone', rate: 1 },
        { resource: 'brick', rate: 0.5 }
      ]}
    ],
  },
  {
    id: 'screeField',
    type: 'production',
    name: '乱石滩',
    icon: '🪨',
    description: '遍布碎石的采石滩',
    produces: 'stone',
    baseRate: 3,          // 1级 = 3 石头/s
    ratePerLevel: 0.1667, // 每级 +0.5 石头/s（3×0.1667≈0.5）
    baseCost: 20,
    costMultiplier: 1.6,
    costResource: 'wood',
    maxLevel: 10,
    evolvedOnly: true,
    evolvedFrom: 'quarry',
    populationSlots: { base: 3, perLevel: 1 },
  },
  {
    id: 'hunting',
    type: 'production',
    name: '狩猎场',
    icon: '🐗',
    description: '狩猎获取兽皮',
    produces: 'hide',
    baseRate: 0.3,
    ratePerLevel: 0.10,
    baseCost: 25,
    costMultiplier: 1.7,
    costResource: 'wood',
    maxLevel: 5,
    populationSlots: { base: 3, perLevel: 1 },
    unlockBy: { building: 'townhall', level: 3 },
  },

  // ========== 狩猎场进化分支 ==========
  {
    id: 'pasture',
    type: 'production',
    name: '牧场',
    icon: '🐄',
    description: '放牧牛群',
    produces: 'milk',
    baseRate: 2,          // 兼容占位（实际产出由 recipes 定义）
    ratePerLevel: 0.25,   // 牛奶 +0.5/s；兽肉/兽皮增量有偏差，见开发文档
    baseCost: 25,
    costMultiplier: 1.7,
    costResource: 'wood',
    maxLevel: 10,
    evolvedOnly: true,
    evolvedFrom: 'hunting',
    populationSlots: { base: 3, perLevel: 1 },
    recipes: [
      { id: 'default', name: '牛奶+兽肉+兽皮', outputs: [
        { resource: 'milk', rate: 2 },
        { resource: 'meat', rate: 0.5 },
        { resource: 'hide', rate: 0.5 }
      ]}
    ],
  },
  {
    id: 'huntZone',
    type: 'production',
    name: '猎区',
    icon: '🏹',
    description: '广袤的狩猎区域',
    produces: 'meat',
    baseRate: 1,          // 兼容占位（实际产出由 recipes 定义）
    ratePerLevel: 0.5,    // 每级兽肉/兽皮各 +0.5/s
    baseCost: 25,
    costMultiplier: 1.7,
    costResource: 'wood',
    maxLevel: 10,
    evolvedOnly: true,
    evolvedFrom: 'hunting',
    populationSlots: { base: 3, perLevel: 1 },
    recipes: [
      { id: 'default', name: '兽肉+兽皮', outputs: [
        { resource: 'meat', rate: 1 },
        { resource: 'hide', rate: 1 }
      ]}
    ],
  },

  // 深山：市政厅Lv2解锁，采集草药，Lv5封顶
  {
    id: 'deepMountain',
    type: 'production',
    name: '深山',
    icon: '🏔️',
    description: '采集野生草药',
    produces: 'herb',
    baseRate: 0.2,          // 1级 = 0.2 草药/s
    ratePerLevel: 0.5,      // 每级 +0.1 草药/s（0.2×0.5）
    baseCost: 18,
    costMultiplier: 1.55,
    costResource: 'wood',
    maxLevel: 5,
    populationSlots: { base: 3, perLevel: 1 },
    unlockBy: { building: 'townhall', level: 2 },
  },

  // ========== 深山进化分支 ==========
  {
    id: 'herbGarden',
    type: 'production',
    name: '草药园',
    icon: '🌿',
    description: '培育优质草药',
    produces: 'herb',
    baseRate: 1,          // 1级 = 1 草药/s
    ratePerLevel: 0.2,    // 每级 +0.2 草药/s（1×0.2）
    baseCost: 18,
    costMultiplier: 1.55,
    costResource: 'wood',
    maxLevel: 10,
    evolvedOnly: true,
    evolvedFrom: 'deepMountain',
    populationSlots: { base: 3, perLevel: 1 },
  },
  {
    id: 'ridgeForest',
    type: 'production',
    name: '山脊林地',
    icon: '🏔️',
    description: '山脊采集草药、树果与兽皮',
    produces: 'herb',
    baseRate: 0.25,       // 兼容占位（实际产出由 recipes 定义）
    ratePerLevel: 0.4,    // 每级 +0.1 草药/s +0.2 树果/s +0.2 兽皮/s
    baseCost: 18,
    costMultiplier: 1.55,
    costResource: 'wood',
    maxLevel: 10,
    evolvedOnly: true,
    evolvedFrom: 'deepMountain',
    populationSlots: { base: 3, perLevel: 1 },
    recipes: [
      { id: 'default', name: '草药+树果+兽皮', outputs: [
        { resource: 'herb', rate: 0.25 },
        { resource: 'treeFruit', rate: 0.5 },
        { resource: 'hide', rate: 0.5 }
      ]}
    ],
  },

  // 湖泊：初始可用，双产出（鱼 + 淡水）
  {
    id: 'lake',
    type: 'production',
    name: '湖泊',
    icon: '🏞️',
    description: '捕鱼并收集淡水',
    produces: 'fish',
    baseRate: 1,          // 兼容占位（实际产出由 recipes 定义）
    ratePerLevel: 0.10,
    baseCost: 12,
    costMultiplier: 1.5,
    costResource: 'wood',
    maxLevel: 5,
    populationSlots: { base: 3, perLevel: 1 },
    recipes: [
      { id: 'default', name: '捕鱼+取水', outputs: [
        { resource: 'fish', rate: 0.25 },
        { resource: 'freshWater', rate: 1 }
      ]}
    ],
  },

  // ========== 湖泊进化分支 ==========
  {
    id: 'fishPond',
    type: 'production',
    name: '鱼塘',
    icon: '🎣',
    description: '养鱼与蓄水',
    produces: 'fish',
    baseRate: 2,          // 兼容占位（实际产出由 recipes 定义）
    ratePerLevel: 0.25,   // 鱼 +0.5/s；淡水增量有偏差（+0.75/s），见开发文档
    baseCost: 12,
    costMultiplier: 1.5,
    costResource: 'wood',
    maxLevel: 10,
    evolvedOnly: true,
    evolvedFrom: 'lake',
    populationSlots: { base: 3, perLevel: 1 },
    recipes: [
      { id: 'default', name: '捕鱼+蓄水', outputs: [
        { resource: 'fish', rate: 2 },
        { resource: 'freshWater', rate: 3 }
      ]}
    ],
  },
  {
    id: 'watershed',
    type: 'production',
    name: '水源地',
    icon: '🚿',
    description: '汇集山泉淡水',
    produces: 'freshWater',
    baseRate: 8,          // 1级 = 8 淡水/s
    ratePerLevel: 0.25,   // 每级 +2 淡水/s（8×0.25）
    baseCost: 12,
    costMultiplier: 1.5,
    costResource: 'wood',
    maxLevel: 10,
    evolvedOnly: true,
    evolvedFrom: 'lake',
    populationSlots: { base: 3, perLevel: 1 },
  },

  // ========== 加工建筑 ==========
  {
    id: 'sawmill',
    type: 'processing',
    name: '锯木厂',
    icon: '🪚',
    description: '将木材加工为木板',
    input: { resource: 'wood', amount: 3 },
    output: { resource: 'plank', amount: 1 },
    processTime: 2,
    baseCost: 60,
    costMultiplier: 1.40,
    costResource: 'stone',
    ratePerLevel: 0.12,
    unlockBy: { building: 'townhall', level: 2 },
    levelUpBonus: 0.08,
    maxLevel: 5,
    populationSlots: { base: 3, perLevel: 1 },
  },

  // ========== 锯木厂进化分支 ==========
  {
    id: 'sawmillA',
    type: 'processing',
    name: '锯木厂a',
    icon: '🪚',
    description: '专注加工木板',
    input: { resource: 'wood', amount: 1 },
    outputs: [ { resource: 'plank', amount: 1 } ],
    processTime: 3,
    baseCost: 60,
    costMultiplier: 1.40,
    costResource: 'stone',
    ratePerLevel: 0.25,   // 每次升级加工速度 +25%（加算）
    levelUpBonus: 0.08,
    maxLevel: 10,
    evolvedOnly: true,
    evolvedFrom: 'sawmill',
    populationSlots: { base: 3, perLevel: 1 },
  },
  {
    id: 'sawmillB',
    type: 'processing',
    name: '锯木厂b',
    icon: '🪚',
    description: '木板与树脂',
    input: { resource: 'wood', amount: 1 },
    outputs: [ { resource: 'plank', amount: 0.5 }, { resource: 'resin', amount: 0.5 } ],
    processTime: 3,
    baseCost: 60,
    costMultiplier: 1.40,
    costResource: 'stone',
    ratePerLevel: 0.25,
    levelUpBonus: 0.08,
    maxLevel: 10,
    evolvedOnly: true,
    evolvedFrom: 'sawmill',
    populationSlots: { base: 3, perLevel: 1 },
  },
  {
    id: 'mason',
    type: 'processing',
    name: '石匠坊',
    icon: '🔨',
    description: '将石头加工为石材',
    input: { resource: 'stone', amount: 2 },
    output: { resource: 'brick', amount: 1 },
    processTime: 3,
    baseCost: 80,
    costMultiplier: 1.40,
    costResource: 'stone',
    ratePerLevel: 0.12,
    unlockBy: { building: 'townhall', level: 2 },
    levelUpBonus: 0.08,
    maxLevel: 5,
    populationSlots: { base: 3, perLevel: 1 },
  },

  // ========== 石匠坊进化分支 ==========
  {
    id: 'masonA',
    type: 'processing',
    name: '石匠坊a',
    icon: '🔨',
    description: '专注打磨石材',
    input: { resource: 'stone', amount: 1 },
    outputs: [ { resource: 'brick', amount: 1 } ],
    processTime: 3,
    baseCost: 80,
    costMultiplier: 1.40,
    costResource: 'stone',
    ratePerLevel: 0.25,
    levelUpBonus: 0.08,
    maxLevel: 10,
    evolvedOnly: true,
    evolvedFrom: 'mason',
    populationSlots: { base: 3, perLevel: 1 },
  },
  {
    id: 'masonB',
    type: 'processing',
    name: '石匠坊b',
    icon: '🔨',
    description: '石材与大理石',
    input: { resource: 'stone', amount: 1 },
    outputs: [ { resource: 'brick', amount: 0.5 }, { resource: 'marble', amount: 0.5 } ],
    processTime: 3,
    baseCost: 80,
    costMultiplier: 1.40,
    costResource: 'stone',
    ratePerLevel: 0.25,
    levelUpBonus: 0.08,
    maxLevel: 10,
    evolvedOnly: true,
    evolvedFrom: 'mason',
    populationSlots: { base: 3, perLevel: 1 },
  },
  {
    id: 'tannery',
    type: 'processing',
    name: '制皮坊',
    icon: '🪡',
    description: '将兽皮加工为皮革',
    input: { resource: 'hide', amount: 2 },
    output: { resource: 'leather', amount: 1 },
    processTime: 4,
    baseCost: 100,
    costMultiplier: 1.45,
    costResource: 'stone',
    ratePerLevel: 0.12,
    unlockBy: { building: 'townhall', level: 3 },  // Lv3 解锁（原Lv2）
    levelUpBonus: 0.08,
    maxLevel: 5,
    populationSlots: { base: 3, perLevel: 1 },
  },

  // ========== 制皮坊进化分支 ==========
  {
    id: 'tanneryA',
    type: 'processing',
    name: '制皮坊a',
    icon: '🪡',
    description: '专注鞣制皮革',
    input: { resource: 'hide', amount: 1 },
    outputs: [ { resource: 'leather', amount: 1 } ],
    processTime: 3,
    baseCost: 100,
    costMultiplier: 1.45,
    costResource: 'stone',
    ratePerLevel: 0.25,
    levelUpBonus: 0.08,
    maxLevel: 10,
    evolvedOnly: true,
    evolvedFrom: 'tannery',
    populationSlots: { base: 3, perLevel: 1 },
  },
  {
    id: 'tanneryB',
    type: 'processing',
    name: '制皮坊b',
    icon: '🪡',
    description: '皮革与毛皮',
    input: { resource: 'hide', amount: 1 },
    outputs: [ { resource: 'leather', amount: 0.5 }, { resource: 'fur', amount: 0.5 } ],
    processTime: 3,
    baseCost: 100,
    costMultiplier: 1.45,
    costResource: 'stone',
    ratePerLevel: 0.25,
    levelUpBonus: 0.08,
    maxLevel: 10,
    evolvedOnly: true,
    evolvedFrom: 'tannery',
    populationSlots: { base: 3, perLevel: 1 },
  },
  {
    id: 'mill',
    type: 'processing',
    name: '磨坊',
    icon: '🌾',
    description: '将小麦研磨为面包',
    input: { resource: 'wheat', amount: 3 },
    output: { resource: 'bread', amount: 1 },
    processTime: 3,
    baseCost: 120,
    costMultiplier: 1.45,
    costResource: 'stone',
    ratePerLevel: 0.12,
    unlockBy: { building: 'townhall', level: 2 },
    levelUpBonus: 0.08,
    maxLevel: 5,
    populationSlots: { base: 3, perLevel: 1 },
  },

  // ========== 磨坊进化分支 ==========
  {
    id: 'millA',
    type: 'processing',
    name: '磨坊a',
    icon: '🌾',
    description: '专注研磨面粉',
    input: { resource: 'wheat', amount: 1 },
    outputs: [ { resource: 'flour', amount: 1 } ],
    processTime: 2,
    baseCost: 120,
    costMultiplier: 1.45,
    costResource: 'stone',
    ratePerLevel: 0.25,
    levelUpBonus: 0.08,
    maxLevel: 10,
    evolvedOnly: true,
    evolvedFrom: 'mill',
    populationSlots: { base: 3, perLevel: 1 },
  },
  {
    id: 'millB',
    type: 'processing',
    name: '磨坊b',
    icon: '🌾',
    description: '面粉与纤维',
    input: { resource: 'wheat', amount: 1 },
    outputs: [ { resource: 'flour', amount: 0.5 }, { resource: 'fiber', amount: 0.5 } ],
    processTime: 2,
    baseCost: 120,
    costMultiplier: 1.45,
    costResource: 'stone',
    ratePerLevel: 0.25,
    levelUpBonus: 0.08,
    maxLevel: 10,
    evolvedOnly: true,
    evolvedFrom: 'mill',
    populationSlots: { base: 3, perLevel: 1 },
  },

  // 诊所：市政厅Lv2解锁，双原料（草药+淡水）→ 简易医药，Lv5封顶
  {
    id: 'clinic',
    type: 'processing',
    name: '诊所',
    icon: '💒',
    description: '将草药与淡水调配为简易医药',
    inputs: [
      { resource: 'herb', amount: 2 },
      { resource: 'freshWater', amount: 1 },
    ],
    output: { resource: 'simpleMedicine', amount: 1 },
    processTime: 1,
    baseCost: 100,
    costMultiplier: 1.45,
    costResource: 'stone',
    ratePerLevel: 0.5,      // 每级 +0.5 简易医药/s
    maxLevel: 5,
    levelUpBonus: 0.08,
    populationSlots: { base: 3, perLevel: 1 },
    unlockBy: { building: 'townhall', level: 2 },
  },

  // ========== 诊所进化分支 ==========
  {
    id: 'clinicA',
    type: 'processing',
    name: '诊所a',
    icon: '💒',
    description: '调配简易医药',
    inputs: [
      { resource: 'herb', amount: 2 },
      { resource: 'freshWater', amount: 10 },
    ],
    outputs: [ { resource: 'simpleMedicine', amount: 1 } ],
    processTime: 5,
    baseCost: 100,
    costMultiplier: 1.45,
    costResource: 'stone',
    ratePerLevel: 0.25,
    levelUpBonus: 0.08,
    maxLevel: 10,
    evolvedOnly: true,
    evolvedFrom: 'clinic',
    populationSlots: { base: 3, perLevel: 1 },
  },
  {
    id: 'clinicB',
    type: 'processing',
    name: '诊所b',
    icon: '💒',
    description: '以草药与纤维制作绷带',
    inputs: [
      { resource: 'herb', amount: 3 },
      { resource: 'fiber', amount: 5 },
    ],
    outputs: [ { resource: 'bandage', amount: 1 } ],
    processTime: 5,
    baseCost: 100,
    costMultiplier: 1.45,
    costResource: 'stone',
    ratePerLevel: 0.25,
    levelUpBonus: 0.08,
    maxLevel: 10,
    evolvedOnly: true,
    evolvedFrom: 'clinic',
    populationSlots: { base: 3, perLevel: 1 },
  },

  // ========== 关键建筑 ==========
  {
    id: 'townhall',
    type: 'key',
    name: '市政厅',
    icon: '🏛️',
    description: '主营地，解锁建筑与科技',
    baseCost: 80,
    costMultiplier: 2.0,
    costResource: 'wood',
    passiveFood: 2,  // 每秒被动产出食物值，防止最后人口被饿死
    milestones: {
      2: { desc: '解锁加工建筑 + 采石场 + 深山 + 诊所', unlockBuildings: ['sawmill', 'mason', 'mill', 'quarry', 'deepMountain', 'clinic'] },
      3: { desc: '解锁狩猎场 + 制皮坊', unlockBuildings: ['hunting', 'tannery'] },
    }
  },
  {
    id: 'settlement',
    type: 'key',
    name: '聚集地',
    icon: '🏘️',
    description: '人口上限 +5/级',
    baseCost: 50,
    costMultiplier: 2.0,
    costResource: 'wood',
    maxPopBase: 8,        // 1级时的人口上限
    maxPopPerLevel: 3,    // 每升1级 +3 上限
    milestones: {
      5:  { desc: '人口增长加速 +50%', bonus: 0 },
      10: { desc: '人口上限额外 +10', bonus: 0 },
    }
  },
]

export const PRODUCTION_BUILDINGS = BUILDINGS.filter(b => b.type === 'production')
export const PROCESSING_BUILDINGS = BUILDINGS.filter(b => b.type === 'processing')
export const KEY_BUILDINGS = BUILDINGS.filter(b => b.type === 'key')

export function getBuilding(id) {
  return BUILDINGS.find(b => b.id === id)
}

/**
 * 获取建筑的生产配方列表
 * 支持新格式 recipes（多配方），旧格式 produces/baseRate 自动推导单一配方
 * recipe: { id, name, outputs: [{ resource, rate }], unlockAt? }
 */
export function getBuildingRecipes(building) {
  if (building.recipes) return building.recipes
  // 向后兼容：自动生成单一配方
  return [{
    id: 'default',
    name: building.name,
    outputs: [{ resource: building.produces, rate: building.baseRate }]
  }]
}

/**
 * 计算从 n 人口增长到 n+1 所需的食物值
 * 公式: (15 + 8*(n-1) + (n-1)^1.5) * 5
 */
export function getGrowthNeeded(n) {
  if (n < 1) return 15 * 5
  return (15 + 8 * (n - 1) + Math.pow(n - 1, 1.5)) * 5
}

// ========================
// 仓库配置
// ========================
export const WAREHOUSE_CONFIG = {
  capacityPerLevel: 250,
  baseUpgradeCost: { resource: 'wood', amount: 30 },
  costMultiplier: 1.6,
}

// ========================
// 离线计算配置
// ========================
export const OFFLINE_CONFIG = {
  maxOfflineHours: 12,
  offlineRateMultiplier: 1.0,
}

// ========================
// 幸福度系统配置
// ========================
export const HAPPINESS_CONFIG = {
  eventCheckInterval: 5,   // 每 N 秒检查一次事件

  // 幸福度事件表：满足条件获得点数，不再满足收回
  // 新增事件时添加 { id, name, description, icon, points, check(state) }
  events: [
    {
      id: 'fresh_water',
      name: '充足淡水',
      description: '仓库淡水存量 ≥ 人口 × 200',
      icon: '💧',
      points: 1,
      // check 接收 { resources, refined, totalPopulation }
      check(state) {
        return (state.resources.freshWater || 0) >= state.totalPopulation * 200
      },
    },
    {
      id: 'wine_supply',
      name: '美酒供应',
      description: '仓库酒存量 ≥ 人口 × 20',
      icon: '🍷',
      points: 1,
      check(state) {
        return (state.refined.wine || 0) >= state.totalPopulation * 20
      },
    },
  ],

  // 幸福度状态层级（按净点数从高到低匹配，第一个满足的生效）
  statusLevels: [
    { minNetPoints:  3, name: '狂喜',   icon: '🤩', growthMod:  0.20, outputMod:  0.10 },
    { minNetPoints:  1, name: '高兴',   icon: '😊', growthMod:  0.10, outputMod:  0.05 },
    { minNetPoints:  0, name: '满意',   icon: '😐', growthMod:  0,    outputMod:  0 },
    { minNetPoints: -2, name: '不开心', icon: '😟', growthMod: -0.15, outputMod: -0.05 },
    { minNetPoints: -4, name: '生气',   icon: '😠', growthMod: -0.30, outputMod: -0.10 },
    { minNetPoints: -6, name: '不安',   icon: '😰', growthMod: -1.00, outputMod: -0.30 },
    { minNetPoints: -999, name: '反感', icon: '🤬', growthMod: -1.00, outputMod: -0.60 },
  ],
}

/**
 * 根据净幸福度（点数 - 需求）匹配状态等级
 * 从最高 minNetPoints 向下匹配，第一个满足的生效
 */
export function getHappinessStatus(netPoints) {
  for (const level of HAPPINESS_CONFIG.statusLevels) {
    if (netPoints >= level.minNetPoints) return level
  }
  // 兜底（-999 全量捕获，理论上不会到达）
  return HAPPINESS_CONFIG.statusLevels[HAPPINESS_CONFIG.statusLevels.length - 1]
}
