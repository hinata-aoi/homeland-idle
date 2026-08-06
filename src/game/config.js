// ============================================================
// 《家园》游戏配置 — 所有可调参数都在这里
// ============================================================

// ========================
// 物资定义
// ========================

export const BASIC_RESOURCES = {
  wheat:  { name: '小麦', icon: '🌾', starting: 50,  baseCapacity: 1000 },
  wood:  { name: '木材', icon: '🪵', starting: 30,  baseCapacity: 800 },
  stone: { name: '石头', icon: '🪨', starting: 10,  baseCapacity: 600 },
  hide:  { name: '兽皮', icon: '🦴', starting: 5,   baseCapacity: 400 },
}

export const REFINED_RESOURCES = {
  plank:   { name: '木板', icon: '🪵', starting: 0, baseCapacity: 300 },
  brick:   { name: '石材', icon: '🧱', starting: 0, baseCapacity: 300 },
  leather: { name: '皮革', icon: '👜', starting: 0, baseCapacity: 200 },
  wine:    { name: '酒',   icon: '🍷', starting: 0, baseCapacity: 150 },
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
//   slots = base + floor((level-1) / perLevel)

export const BUILDINGS = [
  // ========== 生产建筑 ==========
  {
    id: 'farm',
    type: 'production',
    name: '农田',
    icon: '🌾',
    description: '自动种植和收获小麦',
    produces: 'wheat',
    baseRate: 1.0,
    ratePerLevel: 0.10,
    baseCost: 15,
    costMultiplier: 1.5,
    costResource: 'wood',
    populationSlots: { base: 3, perLevel: 1 },
    milestones: {
      5:  { desc: '解锁酿酒坊', bonus: 0.25, unlockBuilding: 'brewery' },
      10: { desc: '产量翻倍', bonus: 1.0 },
      15: { desc: '自动产出少量酒', bonus: 1.5, autoProduce: 'wine' },
    }
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
    populationSlots: { base: 3, perLevel: 1 },
    milestones: {
      5:  { desc: '解锁锯木厂', bonus: 0.25, unlockBuilding: 'sawmill' },
      10: { desc: '产量翻倍', bonus: 1.0 },
      15: { desc: '自动产出少量木板', bonus: 1.5, autoProduce: 'plank' },
    }
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
    populationSlots: { base: 3, perLevel: 1 },
    milestones: {
      5:  { desc: '解锁石匠坊', bonus: 0.25, unlockBuilding: 'mason' },
      10: { desc: '产量翻倍', bonus: 1.0 },
      15: { desc: '自动产出少量石材', bonus: 1.5, autoProduce: 'brick' },
    }
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
    populationSlots: { base: 3, perLevel: 1 },
    milestones: {
      5:  { desc: '解锁制皮坊', bonus: 0.25, unlockBuilding: 'tannery' },
      10: { desc: '产量翻倍', bonus: 1.0 },
      15: { desc: '自动产出少量皮革', bonus: 1.5, autoProduce: 'leather' },
    }
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
    baseCost: 20,
    costMultiplier: 1.6,
    costResource: 'wood',
    unlockBy: { building: 'forest', level: 5 },
    levelUpBonus: 0.05,
    populationSlots: { base: 3, perLevel: 1 },
    milestones: {
      5:  { desc: '加工效率 +25%', bonus: 0.25 },
      10: { desc: '每次产出 +1', bonus: 0, extraOutput: 1 },
    }
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
    baseCost: 25,
    costMultiplier: 1.6,
    costResource: 'wood',
    unlockBy: { building: 'quarry', level: 5 },
    levelUpBonus: 0.05,
    populationSlots: { base: 3, perLevel: 1 },
    milestones: {
      5:  { desc: '加工效率 +25%', bonus: 0.25 },
      10: { desc: '每次产出 +1', bonus: 0, extraOutput: 1 },
    }
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
    baseCost: 30,
    costMultiplier: 1.7,
    costResource: 'hide',
    unlockBy: { building: 'hunting', level: 5 },
    levelUpBonus: 0.05,
    populationSlots: { base: 3, perLevel: 1 },
    milestones: {
      5:  { desc: '加工效率 +25%', bonus: 0.25 },
      10: { desc: '每次产出 +1', bonus: 0, extraOutput: 1 },
    }
  },
  {
    id: 'brewery',
    type: 'processing',
    name: '酿酒坊',
    icon: '🍺',
    description: '将小麦酿造成酒',
    input: { resource: 'wheat', amount: 5 },
    output: { resource: 'wine', amount: 1 },
    processTime: 5,
    baseCost: 40,
    costMultiplier: 1.8,
    costResource: 'wood',
    unlockBy: { building: 'farm', level: 10 },
    levelUpBonus: 0.05,
    populationSlots: { base: 3, perLevel: 1 },
    milestones: {
      5:  { desc: '加工效率 +25%', bonus: 0.25 },
      10: { desc: '每次产出 +1', bonus: 0, extraOutput: 1 },
    }
  },

  // ========== 关键建筑 ==========
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
 * 计算从 n 人口增长到 n+1 所需的食物值
 * 公式: 15 + 8*(n-1) + (n-1)^1.5
 */
export function getGrowthNeeded(n) {
  if (n < 1) return 15
  return 15 + 8 * (n - 1) + Math.pow(n - 1, 1.5)
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
