// ============================================================
// 《家园》store.js 集成测试 — 游戏核心流程
// 每个用例独立 Pinia + 清空 localStorage
// ============================================================
import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useGameStore } from './store.js'
import { getGrowthNeeded, POLICY_CONFIG } from './config.js'

const SAVE_KEY = 'homeland_save_v6'

let store

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  store = useGameStore()
})

describe('initNewGame 初始状态', () => {
  it('初始资源量正确', () => {
    store.initNewGame()
    expect(store.resources.wheat).toBe(50)
    expect(store.resources.wood).toBe(30)
    expect(store.resources.stone).toBe(10)
    expect(store.resources.hide).toBe(5)
    expect(store.resources.fish).toBe(0)
    expect(store.refined.plank).toBe(0)
  })

  it('建筑初始等级：生产/关键=1，未解锁与加工=0', () => {
    store.initNewGame()
    expect(store.buildingLevels.farm).toBe(1)
    expect(store.buildingLevels.forest).toBe(1)
    expect(store.buildingLevels.townhall).toBe(1)
    expect(store.buildingLevels.settlement).toBe(1)
    expect(store.buildingLevels.quarry).toBe(0)      // 市政厅 Lv2 解锁
    expect(store.buildingLevels.sawmill).toBe(0)     // 加工建筑初始未解锁
    expect(store.buildingLevels.fertileFarm).toBe(0) // 进化建筑不可直接建造
  })

  it('初始人口 4、食物值 = 增长需求的一半、无派遣', () => {
    store.initNewGame()
    expect(store.totalPopulation).toBe(4)
    expect(store.foodValue).toBe(Math.floor(getGrowthNeeded(4) / 2))
    expect(store.unassignedPopulation).toBe(4)
    expect(Object.keys(store.populationAssigned).length).toBe(0)
  })

  it('默认配方为各生产建筑第一个配方', () => {
    store.initNewGame()
    expect(store.activeRecipes.farm).toBe('wheat')
    expect(store.activeRecipes.lake).toBe('default')
  })

  it('幸福度初始无激活事件', () => {
    store.initNewGame()
    expect(store.activeHappinessEvents).toEqual([])
  })
})

describe('getUpgradeCost 升级成本（经升级预览间接验证）', () => {
  it('Lv1→2 仅主成本（farm 15 木材，无精炼二级成本）', () => {
    store.initNewGame()
    store.openUpgradePreview('farm')
    expect(store.upgradePreview.cost.primary).toEqual({ resource: 'wood', amount: 15 })
    expect(store.upgradePreview.cost.secondary).toBeNull()
  })

  it('Lv5→6 引入精炼二级成本（生产建筑=木板）', () => {
    store.initNewGame()
    store.buildingLevels.farm = 5
    store.openUpgradePreview('farm')
    const cost = store.upgradePreview.cost
    expect(cost.primary).toEqual({ resource: 'wood', amount: 98 }) // floor(15×1.6^4)
    expect(cost.secondary.resource).toBe('plank')
    expect(cost.secondary.amount).toBe(4) // floor(15×0.3×1.6^0)
  })

  it('加工建筑 Lv5+ 二级成本为石材，关键建筑无二级成本', () => {
    store.initNewGame()
    store.buildingLevels.sawmill = 5
    store.openUpgradePreview('sawmill')
    expect(store.upgradePreview.cost.secondary.resource).toBe('brick')

    store.closeUpgradePreview()
    store.buildingLevels.townhall = 5
    store.openUpgradePreview('townhall')
    expect(store.upgradePreview.cost.secondary).toBeNull()
  })

  it('成本随等级递增', () => {
    store.initNewGame()
    store.openUpgradePreview('farm')
    const lv1 = store.upgradePreview.cost.primary.amount
    store.closeUpgradePreview()
    store.buildingLevels.farm = 2
    store.openUpgradePreview('farm')
    const lv2 = store.upgradePreview.cost.primary.amount
    expect(lv2).toBeGreaterThan(lv1)
  })
})

describe('upgradeBuilding 升级与解锁', () => {
  it('资源充足时升级成功并扣费', () => {
    store.initNewGame()
    store.setResourceAmount('wood', 500)
    expect(store.upgradeBuilding('farm')).toBe(true)
    expect(store.buildingLevels.farm).toBe(2)
    expect(store.resources.wood).toBe(485)
  })

  it('资源不足时升级失败且等级不变', () => {
    store.initNewGame()
    store.setResourceAmount('wood', 0)
    expect(store.upgradeBuilding('townhall')).toBe(false)
    expect(store.buildingLevels.townhall).toBe(1)
  })

  it('maxLevel 封顶后拒绝升级', () => {
    store.initNewGame()
    store.setResourceAmount('wood', 5000)
    store.buildingLevels.farm = 5
    expect(store.upgradeBuilding('farm')).toBe(false)
    expect(store.buildingLevels.farm).toBe(5)
  })

  it('市政厅 Lv2 里程碑解锁加工建筑与采石场/深山/诊所', () => {
    store.initNewGame()
    store.setResourceAmount('wood', 500)
    store.upgradeBuilding('townhall')
    for (const id of ['sawmill', 'mason', 'mill', 'quarry', 'deepMountain', 'clinic']) {
      expect(store.buildingLevels[id], `${id} 未被解锁`).toBe(1)
    }
    // 狩猎场/制皮坊仍是 Lv3 解锁
    expect(store.buildingLevels.hunting).toBe(0)
    expect(store.buildingLevels.tannery).toBe(0)
  })

  it('市政厅 Lv3 里程碑解锁狩猎场与制皮坊', () => {
    store.initNewGame()
    store.setResourceAmount('wood', 5000)
    store.buildingLevels.townhall = 2
    store.upgradeBuilding('townhall')
    expect(store.buildingLevels.hunting).toBe(1)
    expect(store.buildingLevels.tannery).toBe(1)
  })
})

describe('人口分配', () => {
  it('派遣与撤回人口，空闲数同步变化', () => {
    store.initNewGame()
    expect(store.assignPop('farm')).toBe(true)
    expect(store.getAssignedPop('farm')).toBe(1)
    expect(store.unassignedPopulation).toBe(3)
    expect(store.unassignPop('farm')).toBe(true)
    expect(store.getAssignedPop('farm')).toBe(0)
    expect(store.unassignedPopulation).toBe(4)
  })

  it('超过槽位或没有空闲人口时拒绝派遣', () => {
    store.initNewGame()
    for (let i = 0; i < 3; i++) store.assignPop('farm')
    expect(store.getAssignedPop('farm')).toBe(3)
    expect(store.assignPop('farm')).toBe(false) // 槽位满
    expect(store.assignPop('forest')).toBe(true) // 还剩 1 空闲人口
    expect(store.assignPop('lake')).toBe(false) // 无空闲人口
  })
})

describe('tick 游戏循环', () => {
  it('驻人后生产建筑按配方产出，容量内精确累加', () => {
    store.initNewGame()
    store.assignPop('farm')
    store.tick()
    // 初始 4 人口无幸福度事件 → 净 -2 → 不开心（产出 ×0.95）：3×0.95=2.85
    expect(store.resources.wheat).toBeCloseTo(52.85, 5)
  })

  it('食物值：被动产出 +2/s、每人消耗 2/s，最低 0 不扣负', () => {
    store.initNewGame()
    const before = store.foodValue
    store.tick()
    expect(store.foodValue).toBe(before + 2 - 8) // 市政厅 +2，4人×2
    // 极端情况：耗尽后保持 0
    store.foodValue = 0
    store.tick()
    expect(store.foodValue).toBe(0)
  })

  it('人口增长：食物值满槽后 +1 并扣除对应食物值', () => {
    store.initNewGame()
    store.foodValue = getGrowthNeeded(4) + 10 // 预留本 tick 的净消耗（+2−8）
    store.tick()
    expect(store.totalPopulation).toBe(5)
    // 220.98+10+2−8 = 224.98 → 满槽 220.98 → 增长 1 → 剩 4
    expect(store.foodValue).toBeCloseTo(4, 5)
  })

  it('未驻人的建筑不产出', () => {
    store.initNewGame()
    store.tick()
    expect(store.resources.wheat).toBe(50)
    expect(store.resources.wood).toBe(30)
  })
})

describe('配方切换', () => {
  it('未达解锁等级时切换失败，达标后成功并影响产出', () => {
    store.initNewGame()
    expect(store.setActiveRecipe('farm', 'rice')).toBe(false) // 水稻 Lv5 解锁

    store.buildingLevels.farm = 5
    expect(store.setActiveRecipe('farm', 'rice')).toBe(true)
    expect(store.activeRecipes.farm).toBe('rice')

    store.assignPop('farm')
    store.tick()
    // 水稻 1.5 × 等级倍率(1+(5−1)×0.5=3) × 幸福度 0.95 = 4.275
    expect(store.resources.rice).toBeCloseTo(4.275, 5)
    expect(store.resources.wheat).toBe(50) // 不再产小麦
  })
})

describe('加工建筑 processBuildingPerSecond', () => {
  beforeEach(() => {
    store.initNewGame()
    store.buildingLevels.sawmill = 1
  })

  it('原料充足时按批加工：3 木材 → 1 木板（1 人 0.5 批/s × 幸福度 0.95）', () => {
    store.setResourceAmount('wood', 100)
    store.assignPop('sawmill')
    // 0.475 批/s：需 3 次调用（1.425）完成 1 批
    store.processBuildingPerSecond('sawmill')
    store.processBuildingPerSecond('sawmill')
    store.processBuildingPerSecond('sawmill')
    expect(store.resources.wood).toBeCloseTo(97, 5)
    expect(store.refined.plank).toBe(1)
    expect(store.processProgress.sawmill).toBeCloseTo(0.425, 5)
  })

  it('原料不足时进度暂停', () => {
    store.setResourceAmount('wood', 2) // 不足 3
    store.assignPop('sawmill')
    store.processBuildingPerSecond('sawmill')
    expect(store.processProgress.sawmill || 0).toBe(0)
    expect(store.refined.plank).toBe(0)
  })

  it('产物满仓时批次完成前进度照常累积，完成时暂停不消费', () => {
    store.setResourceAmount('wood', 100)
    store.refined.plank = 300 // 满仓
    store.assignPop('sawmill')
    // 0.475 批/s × 3 = 1.425 → 达到 1 批，但输出容量检查失败 → 暂停
    store.processBuildingPerSecond('sawmill')
    store.processBuildingPerSecond('sawmill')
    store.processBuildingPerSecond('sawmill')
    expect(store.resources.wood).toBe(100) // 未消费
    expect(store.refined.plank).toBe(300)
    expect(store.processProgress.sawmill).toBeCloseTo(1.425, 5)
  })

  it('无人值守不加工', () => {
    store.setResourceAmount('wood', 100)
    store.processBuildingPerSecond('sawmill')
    expect(store.processProgress.sawmill || 0).toBe(0)
  })
})

describe('幸福度系统', () => {
  it('满足条件的事件激活并获得点数，条件消失后收回', () => {
    store.initNewGame()
    store.resources.freshWater = store.totalPopulation * 200
    store.checkHappinessEvents()
    expect(store.activeHappinessEvents).toContain('fresh_water')

    store.resources.freshWater = 0
    store.checkHappinessEvents()
    expect(store.activeHappinessEvents).not.toContain('fresh_water')
  })

  it('净幸福度 = 点数 − ⌊人口/2⌋，状态影响产出倍率', () => {
    store.initNewGame()
    // 4 人口 → 需求 2；激活淡水事件(+1) + 聚集地被动(+1) → 净 0 → 满意（无修正）
    store.resources.freshWater = store.totalPopulation * 200
    store.checkHappinessEvents()
    expect(store.happinessPoints).toBe(2)
    expect(store.happinessDemand).toBe(2)
    expect(store.happinessNetPoints).toBe(0)
    expect(store.happinessStatus.name).toBe('满意')
    expect(store.happinessOutputMultiplier).toBeCloseTo(1, 5)
  })

  it('聚集地被动幸福度：Lv1 起常驻 +1 点，不计入事件表，等级回退收回', () => {
    store.initNewGame()
    expect(store.happinessPoints).toBe(1) // 仅被动（无激活事件）
    expect(store.activeHappinessEvents).toEqual([]) // 不走事件表
    expect(store.passiveHappinessBonuses).toHaveLength(1)
    expect(store.passiveHappinessBonuses[0].building).toBe('settlement')
    // 聚集地等级降为 0（异常/未来可回退场景）→ 被动收回
    store.buildingLevels.settlement = 0
    expect(store.happinessPoints).toBe(0)
    expect(store.passiveHappinessBonuses).toHaveLength(0)
  })

  it('被动加成把初始净幸福度从 -2 提升到 -1（仍为不开心档）', () => {
    store.initNewGame()
    // 被动 1 − 需求 2 = −1 → 不开心（产出 −5%）
    expect(store.happinessNetPoints).toBe(-1)
    expect(store.happinessStatus.name).toBe('不开心')
    expect(store.happinessOutputMultiplier).toBeCloseTo(0.95, 5)
  })

  it('tick 中产出倍率随状态生效（激活事件后满意 → 满速产出）', () => {
    store.initNewGame()
    store.resources.freshWater = store.totalPopulation * 200
    store.checkHappinessEvents()
    store.assignPop('farm')
    store.tick()
    expect(store.resources.wheat).toBeCloseTo(53, 5) // 50 + 3×1×1（满意无修正）
  })

  it('增长修正仅作用于盈余：赤字时不受影响', () => {
    store.initNewGame()
    const before = store.foodValue
    store.tick()
    // 默认盈余为负（+2−8=−6），赤字不放大
    expect(store.foodValue).toBe(before - 6)
  })
})

describe('政策转化', () => {
  it('setPolicyRate 按 maxRate 截断并持久化', () => {
    store.initNewGame()
    store.setPolicyRate('wheat', 100)
    expect(store.policyRates.wheat).toBe(50) // 小麦转化 maxRate 50
    store.setPolicyRate('wheat', 0)
    expect(store.policyRates.wheat).toBe(0)
  })

  it('tick 中政策转化：资源按比例转为食物值', () => {
    store.initNewGame()
    store.setResourceAmount('wheat', 100)
    store.setPolicyRate('wheat', 5) // 5 小麦/s → 1 食物值/s
    const foodBefore = store.foodValue
    store.tick()
    expect(store.resources.wheat).toBe(95)
    // 食物值 = 原值 + 转化 1 − 消耗 8 + 被动 2
    expect(store.foodValue).toBe(foodBefore + 1 - 8 + 2)
  })

  it('库存不足时转化受限于库存', () => {
    store.initNewGame()
    store.setResourceAmount('wheat', 3)
    store.setPolicyRate('wheat', 50)
    const foodBefore = store.foodValue
    store.tick()
    expect(store.resources.wheat).toBe(0)
    expect(store.foodValue).toBe(foodBefore + 3 / 5 + 2 - 8)
  })

  it('面包转化未解锁时不计入可用转化', () => {
    store.initNewGame()
    expect(store.availableConversions.map(c => c.input)).toEqual(['wheat']) // bread 需市政厅 Lv2
    store.buildingLevels.townhall = 2
    expect(store.availableConversions.map(c => c.input)).toEqual(['wheat', 'bread'])
  })
})

describe('calculateOffline 离线计算', () => {
  it('离线 100 秒：全额生产（含幸福度倍率）、50% 消耗、弹窗展示收益', () => {
    store.initNewGame()
    store.lastSaveTime = Date.now() - 100 * 1000
    store.assignPop('farm')
    store.calculateOffline()
    // 3×0.95×100 = 285；50+285 = 335
    expect(store.resources.wheat).toBeCloseTo(335, 5)
    expect(store.offlineEarnings.wheat).toBeCloseTo(285, 5)
    expect(store.showOfflineModal).toBe(true)
    // 食物值：110 + 2×100 − 4×2×100×0.5 = 110+200−400 → 0
    expect(store.foodValue).toBe(0)
  })

  it('离线时长不足 10 秒时直接跳过', () => {
    store.initNewGame()
    store.lastSaveTime = Date.now() - 5 * 1000
    store.assignPop('farm')
    store.calculateOffline()
    expect(store.showOfflineModal).toBe(false)
    expect(store.resources.wheat).toBe(50)
  })

  it('超过 12 小时按上限截断', () => {
    store.initNewGame()
    store.lastSaveTime = Date.now() - 20 * 3600 * 1000
    store.assignPop('farm')
    store.calculateOffline()
    // 3×43200=129600 远超容量，wheat 应被容量截断到 1000
    expect(store.resources.wheat).toBe(1000)
    expect(store.offlineSeconds).toBe(12 * 3600)
  })

  it('满仓资源离线收益为 0 且不进弹窗', () => {
    store.initNewGame()
    store.lastSaveTime = Date.now() - 100 * 1000
    store.resources.wheat = 1000 // 满仓
    store.assignPop('farm')
    store.calculateOffline()
    expect(store.offlineEarnings.wheat).toBeUndefined()
  })
})

describe('专精进化', () => {
  it('原建筑满级后进化成功：原建筑消失、进化建筑 Lv1、人口释放', () => {
    store.initNewGame()
    store.buildingLevels.farm = 5
    store.setResourceAmount('wood', 500)
    store.setResourceAmount('plank', 50)
    store.assignPop('farm')
    expect(store.evolveBuilding('farm', 'fertileFarm')).toBe(true)
    expect(store.buildingLevels.farm).toBe(0)
    expect(store.buildingLevels.fertileFarm).toBe(1)
    expect(store.getAssignedPop('farm')).toBe(0)
    expect(store.unassignedPopulation).toBe(4)
  })

  it('未满级 / 目标不匹配 / 分支被占用时拒绝进化', () => {
    store.initNewGame()
    store.setResourceAmount('wood', 500)
    expect(store.evolveBuilding('farm', 'fertileFarm')).toBe(false) // 未满级

    store.buildingLevels.farm = 5
    expect(store.evolveBuilding('farm', 'forest')).toBe(false) // 目标不是进化分支
    expect(store.evolveBuilding('forest', 'fertileFarm')).toBe(false) // evolvedFrom 不匹配

    store.evolveBuilding('farm', 'fertileFarm')
    store.buildingLevels.farm = 5 // 重建（测试环境直接改）
    expect(store.evolveBuilding('farm', 'plantation')).toBe(false) // 已有分支占用
  })

  it('免费回退：进化建筑消失、原建筑回到 Lv1', () => {
    store.initNewGame()
    store.buildingLevels.farm = 5
    store.setResourceAmount('wood', 500)
    store.setResourceAmount('plank', 50)
    store.evolveBuilding('farm', 'fertileFarm')
    expect(store.revertBuilding('fertileFarm')).toBe(true)
    expect(store.buildingLevels.fertileFarm).toBe(0)
    expect(store.buildingLevels.farm).toBe(1)
  })

  it('被进化掉的原建筑不会被 checkUnlocks 重新解锁', () => {
    store.initNewGame()
    store.setResourceAmount('wood', 5000)
    store.setResourceAmount('plank', 500)
    store.buildingLevels.quarry = 5
    store.evolveBuilding('quarry', 'deepQuarry')
    expect(store.buildingLevels.deepQuarry).toBe(1)
    expect(store.isEvolvedAway('quarry')).toBe(true)
    // 市政厅升到 Lv2 触发解锁检查：采石场在解锁列表内，但已被进化 → 不得重新解锁
    store.buildingLevels.townhall = 2
    store.checkUnlocks()
    expect(store.buildingLevels.quarry).toBe(0)
    expect(store.buildingLevels.deepQuarry).toBe(1)
  })
})

describe('存档 save/load 与迁移', () => {
  it('save 后 load 恢复全部状态', () => {
    store.initNewGame()
    store.assignPop('farm')
    store.setPolicyRate('wheat', 10)
    store.save()
    const snapshot = JSON.parse(localStorage.getItem(SAVE_KEY))
    expect(snapshot.version).toBe(6)
    expect(snapshot.totalPopulation).toBe(4)
    expect(snapshot.populationAssigned.farm).toBe(1)
    expect(snapshot.policyRates.wheat).toBe(10)
  })

  it('无存档时 load 返回 false', () => {
    expect(store.load()).toBe(false)
  })

  it('v5 旧存档自动迁移：food→wheat、补湖泊/新资源、清理残留派遣', () => {
    localStorage.setItem('homeland_save_v5', JSON.stringify({
      version: 5,
      resources: { food: 100, wood: 20 },
      refined: {},
      buildingLevels: { farm: 2, townhall: 1 },
      warehouseLevel: 1,
      discoveredBuildings: ['farm', 'townhall'],
      totalPopulation: 4,
      populationAssigned: { farm: 1, brewery: 2 }, // brewery 已删除的建筑
      foodValue: 50,
      policyRates: {},
      processProgress: {},
      lastSaveTime: Date.now(),
    }))
    expect(store.load()).toBe(true)
    expect(store.resources.wheat).toBe(100) // food 迁移为 wheat
    expect(store.resources.food).toBeUndefined()
    expect(store.resources.rice).toBe(0) // 补齐新资源默认值
    expect(store.buildingLevels.lake).toBe(1) // 补湖泊
    expect(store.discoveredBuildings).toContain('lake')
    expect(store.populationAssigned.brewery).toBeUndefined() // 清理残留
    expect(store.populationAssigned.farm).toBe(1)
    expect(store.activeRecipes.farm).toBe('wheat') // 回退默认配方
  })

  it('v4 旧存档同样可迁移', () => {
    localStorage.setItem('homeland_save_v4', JSON.stringify({
      version: 4,
      resources: { wheat: 10, wood: 5 },
      refined: {},
      buildingLevels: { farm: 1 },
      warehouseLevel: 1,
      discoveredBuildings: ['farm'],
      totalPopulation: 2,
      populationAssigned: {},
      foodValue: 10,
      policyRates: {},
      lastSaveTime: Date.now(),
    }))
    expect(store.load()).toBe(true)
    expect(store.buildingLevels.townhall).toBe(1) // 补市政厅
    expect(store.buildingLevels.lake).toBe(1)
  })

  it('损坏存档返回 false', () => {
    localStorage.setItem(SAVE_KEY, 'not-json{{{')
    expect(store.load()).toBe(false)
  })
})

describe('工具函数', () => {
  it('fmt 格式化：<10 两位小数，≥10 一位，≥1000 整数，≥1e6 指数', () => {
    expect(store.fmt(3.14159)).toBe('3.14')
    expect(store.fmt(12.345)).toBe('12.3')
    expect(store.fmt(1234)).toBe('1234')
    expect(store.fmt(2e6)).toBe('2.00e+6')
  })

  it('fillAllResources 将所有资源填到容量上限', () => {
    store.initNewGame()
    store.fillAllResources()
    expect(store.resources.wheat).toBe(store.getResourceCap('wheat'))
    expect(store.refined.plank).toBe(store.getResourceCap('plank'))
  })
})
