// ============================================================
// 《家园》游戏配置 — 所有可调参数都在这里
// ============================================================

// ========================
// 物资定义
// ========================

// 基础物资（由生产建筑直接产出）
export const BASIC_RESOURCES = {
  food:  { name: '食物', icon: '🍞', starting: 50,  baseCapacity: 1000 },
  wood:  { name: '木材', icon: '🪵', starting: 30,  baseCapacity: 800 },
  stone: { name: '石头', icon: '🪨', starting: 10,  baseCapacity: 600 },
  hide:  { name: '兽皮', icon: '🦴', starting: 5,   baseCapacity: 400 },
}

// 高级物资（由加工建筑产出）
export const REFINED_RESOURCES = {
  plank:   { name: '木板', icon: '🪵', starting: 0, baseCapacity: 300 },
  brick:   { name: '石材', icon: '🧱', starting: 0, baseCapacity: 300 },
  leather: { name: '皮革', icon: '👜', starting: 0, baseCapacity: 200 },
  wine:    { name: '酒',   icon: '🍷', starting: 0, baseCapacity: 150 },
}

export const ALL_RESOURCES = { ...BASIC_RESOURCES, ...REFINED_RESOURCES }

// ========================
// 建筑定义（统一系统）
// ========================
// type: 'production' → 随时间自动产出资源
// type: 'processing' → 手动/自动将资源加工为另一种资源

export const BUILDINGS = [
  // ========== 生产建筑 ==========
  {
    id: 'farm',
    type: 'production',
    name: '农田',
    icon: '🌾',
    description: '自动种植和收获农作物',
    produces: 'food',             // 产出的资源
    baseRate: 1.0,                // 1级每秒产量
    ratePerLevel: 0.10,           // 每级 +10%
    baseCost: 15,
    costMultiplier: 1.5,
    costResource: 'food',
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
    costResource: 'food',
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
    processTime: 2,               // 每次加工秒数（预留，当前为即时加工）
    baseCost: 20,
    costMultiplier: 1.6,
    costResource: 'wood',
    unlockBy: { building: 'forest', level: 5 },  // 森林5级解锁
    levelUpBonus: 0.05,           // 每升一级，加工效率+5%（减少所需原料）
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
    description: '将食物酿造成酒',
    input: { resource: 'food', amount: 5 },
    output: { resource: 'wine', amount: 1 },
    processTime: 5,
    baseCost: 40,
    costMultiplier: 1.8,
    costResource: 'food',
    unlockBy: { building: 'farm', level: 10 },
    levelUpBonus: 0.05,
    milestones: {
      5:  { desc: '加工效率 +25%', bonus: 0.25 },
      10: { desc: '每次产出 +1', bonus: 0, extraOutput: 1 },
    }
  },
]

// 按类型分组（便捷访问）
export const PRODUCTION_BUILDINGS = BUILDINGS.filter(b => b.type === 'production')
export const PROCESSING_BUILDINGS = BUILDINGS.filter(b => b.type === 'processing')

// 根据 ID 查找建筑
export function getBuilding(id) {
  return BUILDINGS.find(b => b.id === id)
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
