// ============================================================
// 《家园》游戏状态管理 (Pinia Store)
// 统一建筑系统 + 人口系统
// ============================================================
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  BUILDINGS, PRODUCTION_BUILDINGS, PROCESSING_BUILDINGS, KEY_BUILDINGS,
  BASIC_RESOURCES, REFINED_RESOURCES, ALL_RESOURCES, getBuilding, getBuildingRecipes, getGrowthNeeded,
  POPULATION_CONFIG, DEMAND_CONFIG, POLICY_CONFIG,
  WAREHOUSE_CONFIG, OFFLINE_CONFIG, UPGRADE_COST_CONFIG,
  HAPPINESS_CONFIG, getHappinessStatus,
  GUILD_CONFIG, EXPEDITION_MAPS, getExpeditionMap
} from './config.js'

const SAVE_KEY = 'homeland_save_v7'

export const useGameStore = defineStore('game', () => {
  // ==================== 状态 ====================

  const resources = ref({})
  const refined = ref({})
  const buildingLevels = ref({})
  const warehouseLevel = ref(1)
  const discoveredBuildings = ref([])
  const lastSaveTime = ref(Date.now())

  // 配方系统：各生产建筑当前活跃的配方 id
  const activeRecipes = ref({})

  // 人口系统
  const totalPopulation = ref(0)         // 独立状态：总人口数
  const populationAssigned = ref({})   // { buildingId: count }

  // 需求系统（食物值 = 食物槽，既是存量也是进度条）
  const foodValue = ref(0)

  // 政策系统
  const policyRates = ref({})           // { resourceId: ratePerSec }

  // 加工系统：加工建筑累积进度（秒）
  const processProgress = ref({})       // { buildingId: progressInSec }

  // 升级预览弹窗：正在预览升级的建筑 id（null = 关闭）
  const upgradePreviewId = ref(null)

  // 专精进化选择弹窗：正在选择进化方向的建筑 id（null = 关闭）
  const evolutionChoiceId = ref(null)

  // 离线弹窗
  const showOfflineModal = ref(false)
  const offlineEarnings = ref({})
  const offlineSeconds = ref(0)

  // 幸福度系统
  const activeHappinessEvents = ref([])       // string[] — 当前激活的事件 id 列表
  const happinessEventCheckCounter = ref(0)   // 距下次事件检查的 tick 计数

  // 远征系统
  const expedition = ref(null)                // 当前远征 { mapId, startTime, power, tier, rewards, durationSec } 或 null（唯一队伍）
  const completedMaps = ref([])               // string[] — 全胜（gte100 档）结算过的地图 id，用于解锁下一张

  // ==================== 初始化 ====================

  function initNewGame() {
    for (const [key, def] of Object.entries(BASIC_RESOURCES)) {
      resources.value[key] = def.starting
    }
    for (const [key, def] of Object.entries(REFINED_RESOURCES)) {
      refined.value[key] = def.starting
    }
    for (const b of BUILDINGS) {
      if (b.type === 'production') buildingLevels.value[b.id] = (b.unlockBy || b.evolvedOnly) ? 0 : 1 // 有 unlockBy 或进化专用(evolvedOnly)的生产建筑初始未解锁
      else if (b.type === 'key') buildingLevels.value[b.id] = b.unlockBy ? 0 : 1 // 有 unlockBy 的关键建筑（如公会）初始未解锁，由市政厅里程碑解锁
      else buildingLevels.value[b.id] = 0 // 加工建筑未解锁
    }
    warehouseLevel.value = 1
    discoveredBuildings.value = [
      ...PRODUCTION_BUILDINGS.filter(b => !b.unlockBy && !b.evolvedOnly).map(b => b.id),
      ...KEY_BUILDINGS.map(b => b.id),
    ]

    // 初始化人口（不自动派遣，由玩家手动分配到建筑）
    totalPopulation.value = POPULATION_CONFIG.initialPopulation
    populationAssigned.value = {}

    // 初始化配方：默认第一个配方
    activeRecipes.value = {}
    for (const b of PRODUCTION_BUILDINGS) {
      const recipes = getBuildingRecipes(b)
      if (recipes.length > 0) activeRecipes.value[b.id] = recipes[0].id
    }

    foodValue.value = Math.floor(getGrowthNeeded(POPULATION_CONFIG.initialPopulation) / 2)
    policyRates.value = {}
    for (const c of POLICY_CONFIG.conversions) {
      policyRates.value[c.input] = POLICY_CONFIG.defaultRate
    }

    // 初始化幸福度（立即检查一次事件，设置初始激活状态）
    activeHappinessEvents.value = []
    happinessEventCheckCounter.value = 0
    checkHappinessEvents()

    // 初始化远征
    expedition.value = null
    completedMaps.value = []

    lastSaveTime.value = Date.now()
    checkUnlocks()
  }

  // ==================== 人口计算 ====================

  // 人口上限（由关键建筑叠加）
  const maxPopulation = computed(() => {
    let total = 0
    for (const b of KEY_BUILDINGS) {
      const lv = buildingLevels.value[b.id] || 0
      if (lv <= 0 || !b.maxPopBase) continue
      total += b.maxPopBase + (lv - 1) * b.maxPopPerLevel
      // 聚集地10级额外+10
      if (b.id === 'settlement' && lv >= 10 && b.milestones[10]) total += 10
    }
    return total || 10
  })

  // 未分配人口
  const unassignedPopulation = computed(() => {
    return Math.max(0, totalPopulation.value - getTotalAssigned())
  })

  function getTotalAssigned() {
    let total = 0
    for (const count of Object.values(populationAssigned.value)) total += count
    return total
  }

  // 食物槽进度百分比（食物值 / 增长所需）
  const growthPercent = computed(() => {
    const needed = getGrowthNeeded(totalPopulation.value)
    if (needed <= 0) return 0
    return Math.min(100, (foodValue.value / needed) * 100)
  })

  // 食物值消耗速率（每秒）
  const foodConsumption = computed(() => {
    return totalPopulation.value * DEMAND_CONFIG.foodValuePerPersonPerSec
  })

  // 被动食物产出（每秒，来自建筑的 passiveFood 字段）
  const passiveFoodPerSec = computed(() => {
    let total = 0
    for (const b of BUILDINGS) {
      if (b.passiveFood && (buildingLevels.value[b.id] || 0) >= 1) {
        total += b.passiveFood
      }
    }
    return total
  })

  // 已解锁的政策转化（按建筑等级过滤 unlockBy）
  const availableConversions = computed(() => {
    return POLICY_CONFIG.conversions.filter(c => {
      if (!c.unlockBy) return true
      return (buildingLevels.value[c.unlockBy.building] || 0) >= c.unlockBy.level
    })
  })

  // 食物值净变化（每秒）
  const foodValueSurplus = computed(() => {
    let totalConversion = 0
    for (const c of availableConversions.value) {
      const rate = policyRates.value[c.input] || 0
      const available = getResourceAmount(c.input)
      totalConversion += Math.min(rate, available) / c.ratio
    }
    return totalConversion + passiveFoodPerSec.value - foodConsumption.value
  })

  // 食物值状态
  const foodValueStatus = computed(() => {
    const surplus = foodValueSurplus.value
    if (surplus > 0.01) return 'surplus'
    if (surplus < -0.01) return 'deficit'
    return 'balanced'
  })

  // ==================== 幸福度系统 ====================

  // 幸福度点数：当前激活事件的点数总和 + 建筑被动加成（常驻，不经过事件检查）
  const happinessPoints = computed(() => {
    let total = 0
    for (const eventId of activeHappinessEvents.value) {
      const ev = HAPPINESS_CONFIG.events.find(e => e.id === eventId)
      if (ev) total += ev.points
    }
    for (const bonus of HAPPINESS_CONFIG.passiveBonuses || []) {
      if ((buildingLevels.value[bonus.building] || 0) >= bonus.level) total += bonus.points
    }
    return total
  })

  // 实际生效的建筑被动幸福度（当前等级满足条件；供 UI 展示点数来源）
  const passiveHappinessBonuses = computed(() => {
    return (HAPPINESS_CONFIG.passiveBonuses || []).filter(bonus =>
      (buildingLevels.value[bonus.building] || 0) >= bonus.level
    )
  })

  // 幸福度需求：每 2 人需要 1 点（1人0点，2人1点，3人1点，4人2点）
  const happinessDemand = computed(() => Math.floor(totalPopulation.value / 2))

  // 净幸福度 = 点数 - 需求
  const happinessNetPoints = computed(() => happinessPoints.value - happinessDemand.value)

  // 当前幸福度状态等级
  const happinessStatus = computed(() => getHappinessStatus(happinessNetPoints.value))

  // 人口增长倍率（如 狂喜 1.20，不开心 0.85）
  const happinessGrowthMultiplier = computed(() => 1 + happinessStatus.value.growthMod)

  // 建筑产出倍率（如 狂喜 1.10，反感 0.40）
  const happinessOutputMultiplier = computed(() => 1 + happinessStatus.value.outputMod)

  // 获取某建筑的槽位数
  // 槽位 = base + floor((level-1)/perLevel)，Lv5 后不再增长
  // 个别建筑可通过 populationSlots.maxLevel 覆盖默认上限 5
  function getBuildingSlots(buildingId) {
    const b = getBuilding(buildingId)
    if (!b || !b.populationSlots) return 0
    const level = buildingLevels.value[buildingId] || 0
    if (level < 1) return 0
    const maxLevel = b.populationSlots.maxLevel ?? 5
    const effectiveLevel = Math.min(level, maxLevel)
    return b.populationSlots.base + Math.floor((effectiveLevel - 1) / b.populationSlots.perLevel)
  }

  // 获取某建筑已分配人口
  function getAssignedPop(buildingId) {
    return populationAssigned.value[buildingId] || 0
  }

  // ==================== 配方系统 ====================

  // 获取建筑当前活跃配方（未设置时回退到第一个）
  function getActiveRecipe(buildingId) {
    const building = getBuilding(buildingId)
    if (!building) return null
    const recipes = getBuildingRecipes(building)
    const activeId = activeRecipes.value[buildingId]
    return recipes.find(r => r.id === activeId) || recipes[0]
  }

  // 获取建筑当前可用的配方列表（过滤未达解锁等级 unlockAt 的配方）
  function getAvailableRecipes(buildingId) {
    const building = getBuilding(buildingId)
    if (!building) return []
    const level = buildingLevels.value[buildingId] || 0
    return getBuildingRecipes(building).filter(r => !r.unlockAt || level >= r.unlockAt)
  }

  // 切换建筑活跃配方
  function setActiveRecipe(buildingId, recipeId) {
    const available = getAvailableRecipes(buildingId)
    if (!available.find(r => r.id === recipeId)) return false
    activeRecipes.value[buildingId] = recipeId
    save()
    return true
  }

  // ==================== 容量 ====================

  function getResourceCap(key) {
    const def = ALL_RESOURCES[key]
    if (!def) return 100
    return def.baseCapacity + (warehouseLevel.value - 1) * WAREHOUSE_CONFIG.capacityPerLevel
  }

  function getResourceAmount(key) {
    if (resources.value[key] !== undefined) return resources.value[key]
    if (refined.value[key] !== undefined) return refined.value[key]
    return 0
  }

  const totalCapacity = computed(() => {
    let sum = 0
    for (const key of Object.keys(ALL_RESOURCES)) sum += getResourceCap(key)
    return sum
  })

  const totalUsed = computed(() => {
    let sum = 0
    for (const v of Object.values(resources.value)) sum += v
    for (const v of Object.values(refined.value)) sum += v
    return sum
  })

  const totalPercent = computed(() => {
    if (totalCapacity.value === 0) return 0
    return Math.min(100, (totalUsed.value / totalCapacity.value) * 100)
  })

  // ==================== 建筑列表 ====================

  const productionBuildings = computed(() => {
    return PRODUCTION_BUILDINGS
      .filter(b => (buildingLevels.value[b.id] || 0) > 0)
      .map(b => {
        const level = buildingLevels.value[b.id] || 1
        const assigned = getAssignedPop(b.id)
        const slots = getBuildingSlots(b.id)
        const recipes = getBuildingRecipes(b)  // 所有建筑都有配方列表（旧字段自动推导）
        const recipe = getActiveRecipe(b.id)
        const outputs = getProductionRate(b, level, assigned, recipe, happinessOutputMultiplier.value)
        // 空闲时 getProductionRate 返回空数组，这里补上产出物（速率为 0），
        // 让面板在无人值守时也能看出该建筑产出什么
        const displayOutputs = outputs.length > 0
          ? outputs
          : recipe.outputs.map(o => ({ resource: o.resource, ratePerSec: 0 }))
        const rate = displayOutputs.reduce((sum, o) => sum + o.ratePerSec, 0)
        const upgradeCost = getUpgradeCost(b, level)
        const nextMilestone = getNextMilestone(b, level)
        const availableRecipes = getAvailableRecipes(b.id)
        // 容量条显示主产出物
        const primaryResource = recipe?.outputs?.[0]?.resource || b.produces
        const cap = getResourceCap(primaryResource)
        const amount = getResourceAmount(primaryResource)
        const pct = cap > 0 ? (amount / cap) * 100 : 0
        return {
          ...b, level, assigned, slots, rate, upgradeCost, nextMilestone,
          recipes, recipe, outputs: displayOutputs, availableRecipes,
          hasRecipeSwitch: availableRecipes.length > 1,
          primaryResource,
          resourceAmount: amount, resourceCap: cap, resourcePct: pct,
          isManned: assigned > 0,
        }
      })
  })

  // 未解锁的生产建筑（展示解锁条件）
  // 排除：进化专用建筑（不可直接建造）、已被进化掉的原建筑（不可重建）
  const lockedProductionBuildings = computed(() => {
    return PRODUCTION_BUILDINGS
      .filter(b => (buildingLevels.value[b.id] || 0) === 0 && !b.evolvedOnly && !isEvolvedAway(b.id))
      .map(b => ({
        ...b,
        unlockReq: b.unlockBy
          ? `${getBuilding(b.unlockBy.building)?.name || '?'} Lv${b.unlockBy.level}`
          : '未知条件'
      }))
  })

  const unlockedProcessingBuildings = computed(() => {
    return PROCESSING_BUILDINGS
      .filter(b => (buildingLevels.value[b.id] || 0) > 0)
      .map(b => {
        const level = buildingLevels.value[b.id] || 1
        const assigned = getAssignedPop(b.id)
        const slots = getBuildingSlots(b.id)
        const upgradeCost = getUpgradeCost(b, level)
        const nextMilestone = getNextMilestone(b, level)
        const inputs = getInputs(b)
        const inputAmt = getEffectiveInput(b, level)
        const effectiveOutputs = getEffectiveOutputs(b, level)
        const progress = processProgress.value[b.id] || 0
        // 各原料的库存与有效消耗量（多原料建筑用，单原料也兼容）
        const inputsAmount = inputs.map(inp => ({
          resource: inp.resource,
          needed: getEffectiveInputAmount(b, level, inp),
          amount: resources.value[inp.resource] || 0,
        }))
        const allInputsMet = inputsAmount.every(inp => inp.amount >= inp.needed)
        const inputSummary = inputsAmount.map(inp => `${inp.needed}${getResName(inp.resource)}`).join(' + ')
        // 各产出的库存与容量（多产出建筑如锯木厂b 兼容单产出）
        const outputsAmount = effectiveOutputs.map(o => ({
          resource: o.resource,
          amount: getResourceAmount(o.resource),
          cap: getResourceCap(o.resource),
        }))
        const outputsFull = outputsAmount.length > 0 && outputsAmount.every(o => o.amount >= o.cap)
        const outputSummary = effectiveOutputs.map(o => `${fmtClean(o.amount)}${getResName(o.resource)}`).join(' + ')
        return {
          ...b, level, assigned, slots, upgradeCost, nextMilestone,
          effectiveInput: inputAmt,
          effectiveOutputs, outputSummary,
          inputs, inputsAmount, allInputsMet, inputSummary,
          outputsAmount, outputsFull,
          processRate: assigned > 0 ? assigned * (1 + (level - 1) * b.ratePerLevel) / b.processTime * happinessOutputMultiplier.value : 0,  // 批/s，1人=1倍速，每级+ratePerLevel，乘幸福度产出倍率
          progress,                                                  // 累积进度（秒）
          progressPct: Math.min(100, (progress % 1) * 100),          // 当前批次完成百分比
          isManned: assigned > 0,
        }
      })
  })

  const lockedProcessingBuildings = computed(() => {
    return PROCESSING_BUILDINGS
      .filter(b => (buildingLevels.value[b.id] || 0) === 0 && !b.evolvedOnly && !isEvolvedAway(b.id))
      .map(b => ({
        ...b,
        unlockReq: b.unlockBy
          ? `${getBuilding(b.unlockBy.building)?.name || '?'} Lv${b.unlockBy.level}`
          : '未知条件'
      }))
  })

  const keyBuildings = computed(() => {
    return KEY_BUILDINGS
      .filter(b => (buildingLevels.value[b.id] || 0) > 0)
      .map(b => {
        const level = buildingLevels.value[b.id] || 1
        const upgradeCost = getUpgradeCost(b, level)
        const nextMilestone = getNextMilestone(b, level)
        // 公会：附加唯一远征队伍的当前/下一级战力（供关键面板展示）
        const extra = b.id === 'guild' ? {
          teamName: guildTeamName.value,
          teamPower: guildTeamPower.value,
          teamPowerNext: GUILD_CONFIG.teamPowerByLevel[Math.min(level + 1, GUILD_CONFIG.maxLevel)] || 0,
        } : {}
        return { ...b, level, upgradeCost, nextMilestone, ...extra }
      })
  })

  // 未解锁的关键建筑（如公会：市政厅 Lv3 解锁）
  const lockedKeyBuildings = computed(() => {
    return KEY_BUILDINGS
      .filter(b => (buildingLevels.value[b.id] || 0) === 0)
      .map(b => ({
        ...b,
        unlockReq: b.unlockBy
          ? `${getBuilding(b.unlockBy.building)?.name || '?'} Lv${b.unlockBy.level}`
          : '未知条件'
      }))
  })

  // ==================== 核心计算 ====================

  // 计算生产建筑各产出物的每秒产量
  // 返回 [{ resource, ratePerSec }]；无人口或未设置配方时返回空数组
  // happinessMult: 幸福度产出倍率（默认 1 = 无影响）
  function getProductionRate(building, level, assigned, recipe, happinessMult = 1) {
    if (assigned < 1 || !recipe) return []
    const levelMultiplier = 1 + (level - 1) * building.ratePerLevel
    const multiplier = assigned * levelMultiplier * happinessMult
    return recipe.outputs.map(o => ({
      resource: o.resource,
      ratePerSec: o.rate * multiplier
    }))
  }

  // 获取建筑的原料列表（兼容旧单原料字段 input；新格式用 inputs 数组支持多原料）
  function getInputs(building) {
    return building.inputs || [building.input]
  }

  // 获取建筑的产出列表（兼容旧单产出字段 output；新格式用 outputs 数组支持多产出）
  function getOutputs(building) {
    return building.outputs || [building.output]
  }

  // 单个原料的有效消耗量（等级提升 → 消耗比例逐级下降）
  function getEffectiveInputAmount(building, level, inputDef) {
    let ratio = 1
    ratio -= (level - 1) * (building.levelUpBonus || 0)
    ratio = Math.max(0.3, ratio)
    return Math.max(1, Math.floor(inputDef.amount * ratio))
  }

  // 兼容旧接口：单原料建筑的有效消耗量（多原料建筑返回 0，用 inputsAmount 代替）
  function getEffectiveInput(building, level) {
    if (!building.input) return 0
    return getEffectiveInputAmount(building, level, building.input)
  }

  // 各产出的每批产出量（兼容单 output 与多 outputs 数组）
  function getEffectiveOutputs(building, level) {
    return getOutputs(building).map(o => ({
      resource: o.resource,
      amount: o.amount
    }))
  }

  // 升级成本：Lv5 前只用主资源（木材/石头），Lv5+ multiplier 额外 +0.1
  // 且引入精炼资源二级成本（生产建筑→木板，加工建筑→石材）
  function getUpgradeCost(building, level) {
    const effectiveMultiplier = level >= UPGRADE_COST_CONFIG.levelThreshold
      ? building.costMultiplier + UPGRADE_COST_CONFIG.multiplierIncrease
      : building.costMultiplier
    const primaryAmount = Math.floor(building.baseCost * Math.pow(effectiveMultiplier, level - 1))
    const primary = { resource: building.costResource, amount: primaryAmount }

    let secondary = null
    if (level >= UPGRADE_COST_CONFIG.levelThreshold) {
      let secResource = null
      if (building.type === 'production') secResource = UPGRADE_COST_CONFIG.productionSecondary
      else if (building.type === 'processing') secResource = UPGRADE_COST_CONFIG.processingSecondary
      if (secResource) {
        const secAmount = Math.floor(building.baseCost * UPGRADE_COST_CONFIG.secondaryRatio
          * Math.pow(effectiveMultiplier, level - UPGRADE_COST_CONFIG.levelThreshold))
        secondary = { resource: secResource, amount: secAmount }
      }
    }
    return { primary, secondary }
  }

  function getNextMilestone(building, level) {
    if (!building.milestones) return null
    const milestones = Object.keys(building.milestones).map(Number).sort((a, b) => a - b)
    for (const m of milestones) {
      if (m > level) return { level: m, ...building.milestones[m] }
    }
    return null
  }

  // ==================== 升级预览 ====================

  // 升级预览数据：当前等级 → 下一等级的差异对比（供 UpgradeModal 展示）
  const upgradePreview = computed(() => {
    const id = upgradePreviewId.value
    if (!id) return null
    const building = getBuilding(id)
    if (!building) return null
    const currentLevel = buildingLevels.value[id] || 0
    if (currentLevel < 1) return null
    const nextLevel = currentLevel + 1

    const cost = getUpgradeCost(building, currentLevel)
    const canAfford = getResourceAmount(cost.primary.resource) >= cost.primary.amount &&
      (!cost.secondary || getResourceAmount(cost.secondary.resource) >= cost.secondary.amount)

    const rows = []
    // 添加一行对比；升级后无变化的属性不展示
    function addRow(label, current, next, improved) {
      if (current === next) return
      rows.push({ label, current, next, improved })
    }
    // 下一等级槽位：getBuildingSlots 读的是实时等级，故这里手动按目标等级计算
    function slotsAt(level) {
      const b = getBuilding(id)
      const maxLevel = b.populationSlots?.maxLevel ?? 5
      const eff = Math.min(level, maxLevel)
      return b.populationSlots.base + Math.floor((eff - 1) / b.populationSlots.perLevel)
    }

    if (building.type === 'production') {
      // 速率按 1 人口展示（升级提升的是每人速率，与进驻人数无关，避免玩家困惑）
      const recipe = getActiveRecipe(id)
      if (recipe) {
        const rateNow = getProductionRate(building, currentLevel, 1, recipe, happinessOutputMultiplier.value)
        const rateNext = getProductionRate(building, nextLevel, 1, recipe, happinessOutputMultiplier.value)
        rateNow.forEach((o, i) => {
          const nextRate = rateNext[i]?.ratePerSec || 0
          addRow(`每人产出 ${getResName(o.resource)}`, `+${fmt(o.ratePerSec)}/s`, `+${fmt(nextRate)}/s`, nextRate >= o.ratePerSec)
        })
      }
      addRow('人口槽位', String(slotsAt(currentLevel)), String(slotsAt(nextLevel)), slotsAt(nextLevel) > slotsAt(currentLevel))
    } else if (building.type === 'processing') {
      // 速率按 1 人口展示（升级提升的是每人速率，与进驻人数无关，避免玩家困惑）
      const rateNow = (1 + (currentLevel - 1) * building.ratePerLevel) / building.processTime * happinessOutputMultiplier.value
      const rateNext = (1 + (nextLevel - 1) * building.ratePerLevel) / building.processTime * happinessOutputMultiplier.value
      addRow('每人加工', `${fmt(rateNow)} 批/s`, `${fmt(rateNext)} 批/s`, rateNext >= rateNow)
      const inputs = getInputs(building)
      const inputNow = inputs.map(inp => `${getEffectiveInputAmount(building, currentLevel, inp)} ${getResName(inp.resource)}`).join(' + ')
      const inputNext = inputs.map(inp => `${getEffectiveInputAmount(building, nextLevel, inp)} ${getResName(inp.resource)}`).join(' + ')
      const inputTotalNow = inputs.reduce((sum, inp) => sum + getEffectiveInputAmount(building, currentLevel, inp), 0)
      const inputTotalNext = inputs.reduce((sum, inp) => sum + getEffectiveInputAmount(building, nextLevel, inp), 0)
      addRow('原料消耗', inputNow, inputNext, inputTotalNext <= inputTotalNow)
      const outputsNow = getEffectiveOutputs(building, currentLevel)
      const outputsNext = getEffectiveOutputs(building, nextLevel)
      const outNowStr = outputsNow.map(o => `${fmtClean(o.amount)} ${getResName(o.resource)}`).join(' + ')
      const outNextStr = outputsNext.map(o => `${fmtClean(o.amount)} ${getResName(o.resource)}`).join(' + ')
      addRow('每次产出', outNowStr, outNextStr, true)
      addRow('人口槽位', String(slotsAt(currentLevel)), String(slotsAt(nextLevel)), slotsAt(nextLevel) > slotsAt(currentLevel))
    } else if (building.type === 'key') {
      if (building.maxPopBase) {
        const popNow = building.maxPopBase + (currentLevel - 1) * building.maxPopPerLevel
        const popNext = building.maxPopBase + (nextLevel - 1) * building.maxPopPerLevel
        addRow('人口上限', `+${popNow}`, `+${popNext}`, popNext > popNow)
      }
      // townhall：无随等级变化的数值，里程碑即为主要收益，无需数值行
    }

    // 本次升级解锁的里程碑
    const unlockedMilestones = []
    for (const [mlv, ml] of Object.entries(building.milestones || {})) {
      if (parseInt(mlv) === nextLevel) unlockedMilestones.push({ level: nextLevel, desc: ml.desc })
    }
    // 本次升级解锁的新配方（如农田 Lv5 解锁水稻）
    if (building.type === 'production') {
      const recipes = getBuildingRecipes(building)
      for (const r of recipes) {
        if (r.unlockAt === nextLevel) {
          unlockedMilestones.push({ level: nextLevel, desc: `解锁配方「${r.name}」` })
        }
      }
    }

    return {
      id, name: building.name, icon: building.icon, type: building.type,
      currentLevel, nextLevel, cost, canAfford, rows, unlockedMilestones,
    }
  })

  function openUpgradePreview(buildingId) {
    upgradePreviewId.value = buildingId
  }

  function closeUpgradePreview() {
    upgradePreviewId.value = null
  }

  const warehouseUpgradeCost = computed(() => {
    const amount = Math.floor(
      WAREHOUSE_CONFIG.baseUpgradeCost.amount *
      Math.pow(WAREHOUSE_CONFIG.costMultiplier, warehouseLevel.value - 1)
    )
    return { resource: WAREHOUSE_CONFIG.baseUpgradeCost.resource, amount }
  })

  // ==================== 操作 ====================

  function upgradeBuilding(buildingId) {
    const building = getBuilding(buildingId)
    if (!building) return false
    const level = buildingLevels.value[buildingId] || 0
    if (level < 0) return false
    // maxLevel 封顶：达到后禁止再升级
    if (building.maxLevel && level >= building.maxLevel) return false

    const cost = getUpgradeCost(building, level)
    // 主成本（基础资源）
    if ((resources.value[cost.primary.resource] || 0) < cost.primary.amount) return false
    // 二级成本（精炼资源，Lv5+）
    if (cost.secondary && (refined.value[cost.secondary.resource] || 0) < cost.secondary.amount) return false

    resources.value[cost.primary.resource] -= cost.primary.amount
    if (cost.secondary) refined.value[cost.secondary.resource] -= cost.secondary.amount
    buildingLevels.value[buildingId] = level + 1
    checkUnlocks()
    save()
    return true
  }

  // ==================== 专精进化 ====================

  // 进化选择弹窗数据：原建筑信息 + 进化成本 + 两个分支的展示信息
  const evolutionChoice = computed(() => {
    const id = evolutionChoiceId.value
    if (!id) return null
    const from = getBuilding(id)
    if (!from) return null
    const level = buildingLevels.value[id] || 0
    if (!from.maxLevel || level < from.maxLevel) return null
    const branches = BUILDINGS.filter(b => b.evolvedFrom === id)
    if (branches.length === 0) return null
    // 进化成本 = 原建筑 Lv5→Lv6 的升级成本
    const cost = getUpgradeCost(from, from.maxLevel)
    const canAfford = getResourceAmount(cost.primary.resource) >= cost.primary.amount &&
      (!cost.secondary || getResourceAmount(cost.secondary.resource) >= cost.secondary.amount)
    return {
      id, name: from.name, icon: from.icon, cost, canAfford,
      branches: branches.map(b => ({
        id: b.id, name: b.name, icon: b.icon, description: b.description, type: b.type,
        processTime: b.processTime,
        // 生产建筑：展示 Lv1 的各产出速率；加工建筑：展示原料 → 产出
        summary: b.type === 'production'
          ? getBuildingRecipes(b)[0].outputs
              .map(o => `${fmtClean(o.rate)}${getResName(o.resource)}/s`)
              .join(' + ')
          : `${getInputs(b).map(inp => `${fmtClean(inp.amount)}${getResName(inp.resource)}`).join(' + ')} → ${
              getEffectiveOutputs(b, 1).map(o => `${fmtClean(o.amount)}${getResName(o.resource)}`).join(' + ')
            } · 每${b.processTime}s一批`,
      }))
    }
  })

  function openEvolutionChoice(buildingId) {
    evolutionChoiceId.value = buildingId
  }

  function closeEvolutionChoice() {
    evolutionChoiceId.value = null
  }

  // 专精进化：原建筑 Lv5 → 目标进化建筑 Lv1（替换，原建筑消失）
  function evolveBuilding(fromBuildingId, toBuildingId) {
    const from = getBuilding(fromBuildingId)
    const to = getBuilding(toBuildingId)
    if (!from || !to) return false
    if (to.evolvedFrom !== fromBuildingId) return false
    const level = buildingLevels.value[fromBuildingId] || 0
    if (!from.maxLevel || level < from.maxLevel) return false
    // 该原建筑已有其他进化分支存在 → 拒绝（每个原建筑只能拥有一份进化版）
    for (const [id, lv] of Object.entries(buildingLevels.value)) {
      if (lv > 0 && id !== toBuildingId) {
        const b = getBuilding(id)
        if (b?.evolvedFrom === fromBuildingId) return false
      }
    }
    // 扣费：原建筑 Lv5→Lv6 成本
    const cost = getUpgradeCost(from, from.maxLevel)
    if ((resources.value[cost.primary.resource] || 0) < cost.primary.amount) return false
    if (cost.secondary && (refined.value[cost.secondary.resource] || 0) < cost.secondary.amount) return false
    resources.value[cost.primary.resource] -= cost.primary.amount
    if (cost.secondary) refined.value[cost.secondary.resource] -= cost.secondary.amount

    // 释放人口回到空闲池，清除加工进度
    populationAssigned.value[fromBuildingId] = 0
    processProgress.value[fromBuildingId] = 0
    // 原建筑消失，进化建筑出现（Lv1）
    buildingLevels.value[fromBuildingId] = 0
    buildingLevels.value[toBuildingId] = 1
    if (!discoveredBuildings.value.includes(toBuildingId)) {
      discoveredBuildings.value.push(toBuildingId)
    }
    // 默认活跃配方
    const recipes = getBuildingRecipes(to)
    if (recipes.length > 0) activeRecipes.value[toBuildingId] = recipes[0].id
    closeEvolutionChoice()
    checkUnlocks()
    save()
    return true
  }

  // 回退：进化建筑 → 原建筑 Lv1（免费）
  function revertBuilding(evolvedBuildingId) {
    const evolved = getBuilding(evolvedBuildingId)
    if (!evolved || !evolved.evolvedFrom) return false
    if ((buildingLevels.value[evolvedBuildingId] || 0) < 1) return false
    const originalId = evolved.evolvedFrom
    // 原建筑必须处于消失状态（level 0）
    if ((buildingLevels.value[originalId] || 0) !== 0) return false
    // 释放人口回到空闲池，清除加工进度
    populationAssigned.value[evolvedBuildingId] = 0
    processProgress.value[evolvedBuildingId] = 0
    // 进化建筑消失，原建筑回到 Lv1
    buildingLevels.value[evolvedBuildingId] = 0
    buildingLevels.value[originalId] = 1
    save()
    return true
  }

  function upgradeWarehouse() {
    const cost = warehouseUpgradeCost.value
    if ((resources.value[cost.resource] || 0) < cost.amount) return false
    resources.value[cost.resource] -= cost.amount
    warehouseLevel.value++
    save()
    return true
  }

  // 加工建筑自动加工（每秒执行一次，与生产建筑对齐）
  // 需进驻人口；1人 = 1倍速，2人 = 2倍速；任一原料不足或产物已满时进度暂停
  function processBuildingPerSecond(buildingId) {
    const building = getBuilding(buildingId)
    if (!building || building.type !== 'processing') return
    const level = buildingLevels.value[buildingId] || 0
    if (level < 1) return
    const assigned = getAssignedPop(buildingId)
    if (assigned < 1) return

    const inputs = getInputs(building)
    const outputs = getEffectiveOutputs(building, level)

    // 原料不足：进度暂停（不累积也不清零）
    for (const inp of inputs) {
      const needed = getEffectiveInputAmount(building, level, inp)
      if ((resources.value[inp.resource] || 0) < needed) return
    }

    // 累积进度：人数越多越快，且每级 +ratePerLevel 速度，乘幸福度产出倍率
    const rate = assigned * (1 + (level - 1) * building.ratePerLevel) / building.processTime * happinessOutputMultiplier.value
    processProgress.value[buildingId] = (processProgress.value[buildingId] || 0) + rate

    // 完成批次（每批检查所有原料与所有产物容量，任一不足则暂停）
    while ((processProgress.value[buildingId] || 0) >= 1) {
      let blocked = false
      for (const inp of inputs) {
        const needed = getEffectiveInputAmount(building, level, inp)
        if ((resources.value[inp.resource] || 0) < needed) { blocked = true; break }
      }
      if (blocked) break
      for (const o of outputs) {
        const outCap = getResourceCap(o.resource)
        const outAmt = getResourceAmount(o.resource)
        if (outAmt + o.amount > outCap) { blocked = true; break }
      }
      if (blocked) break
      for (const inp of inputs) {
        resources.value[inp.resource] -= getEffectiveInputAmount(building, level, inp)
      }
      for (const o of outputs) {
        const current = getResourceAmount(o.resource)
        if (refined.value[o.resource] !== undefined) refined.value[o.resource] = current + o.amount
        else resources.value[o.resource] = current + o.amount
      }
      processProgress.value[buildingId] -= 1
    }
  }

  // --- 人口分配 ---

  function assignPop(buildingId) {
    const slots = getBuildingSlots(buildingId)
    const current = getAssignedPop(buildingId)
    if (current >= slots) return false
    // 严格要求有空闲人口才能派驻
    if (unassignedPopulation.value <= 0) return false
    populationAssigned.value[buildingId] = current + 1
    save()
    return true
  }

  function unassignPop(buildingId) {
    const current = getAssignedPop(buildingId)
    if (current <= 0) return false
    populationAssigned.value[buildingId] = current - 1
    save()
    return true
  }

  // --- 政策 ---

  function setPolicyRate(resourceId, rate) {
    const conv = POLICY_CONFIG.conversions.find(c => c.input === resourceId)
    if (!conv) return false
    const clamped = Math.max(0, Math.min(rate, conv.maxRate))
    policyRates.value[resourceId] = clamped
    save()
    return true
  }

  // --- 解锁 ---

  // 检查某建筑是否已被进化掉（原建筑消失，不可重建）
  // 若存在任一已建造(level>0)的进化建筑 evolvedFrom 指向它，即视为已进化
  function isEvolvedAway(buildingId) {
    for (const [id, level] of Object.entries(buildingLevels.value)) {
      if (level > 0) {
        const b = getBuilding(id)
        if (b?.evolvedFrom === buildingId) return true
      }
    }
    return false
  }

  function checkUnlocks() {
    for (const b of [...PRODUCTION_BUILDINGS, ...KEY_BUILDINGS]) {
      const level = buildingLevels.value[b.id] || 0
      if (level < 1) continue
      for (const [mlv, ml] of Object.entries(b.milestones || {})) {
        if (level >= parseInt(mlv)) {
          const targets = ml.unlockBuildings || (ml.unlockBuilding ? [ml.unlockBuilding] : [])
          for (const targetId of targets) {
            // 已被进化掉的原建筑不可重新解锁
            if ((buildingLevels.value[targetId] || 0) === 0 && !isEvolvedAway(targetId)) {
              buildingLevels.value[targetId] = 1
              if (!discoveredBuildings.value.includes(targetId)) {
                discoveredBuildings.value.push(targetId)
              }
            }
          }
        }
      }
    }
  }

  // --- 幸福度 ---

  // 检查所有幸福度事件：满足条件的事件激活（获得点数），不再满足的从激活列表移除（收回点数）
  function checkHappinessEvents() {
    const state = {
      resources: resources.value,
      refined: refined.value,
      totalPopulation: totalPopulation.value,
    }
    const newActive = []
    for (const ev of HAPPINESS_CONFIG.events) {
      try {
        if (ev.check(state)) newActive.push(ev.id)
      } catch (e) {
        // 事件检查函数异常不应导致游戏崩溃，跳过该事件
        console.warn(`Happiness event "${ev.id}" check threw:`, e)
      }
    }
    activeHappinessEvents.value = newActive
  }

  // ==================== 远征系统 ====================

  // 唯一远征队伍的当前战力与名称（由公会等级决定）
  const guildTeamPower = computed(() => {
    const lv = buildingLevels.value.guild || 0
    return GUILD_CONFIG.teamPowerByLevel[lv] || 0
  })

  const guildTeamName = computed(() => {
    const lv = buildingLevels.value.guild || 0
    return GUILD_CONFIG.teamNameByLevel[lv] || '未训练'
  })

  // 战力对比档位：队伍战力 ÷ 地图要求
  // <50% 失败；[50%,75%) 低档；[75%,100%) 中档；>=100% 全胜
  function getExpeditionTier(power, requirement) {
    if (requirement <= 0) return 'gte100'
    const ratio = power / requirement
    if (ratio < 0.5) return 'lt50'
    if (ratio < 0.75) return '50-75'
    if (ratio < 1) return '75-100'
    return 'gte100'
  }

  // 按档位随机生成奖励（出发时锁定）：{ resource: amount }
  function rollExpeditionRewards(map, tier) {
    const table = map.rewards[tier] || {}
    const out = {}
    for (const [res, [min, max]] of Object.entries(table)) {
      out[res] = Math.floor(min + Math.random() * (max - min + 1))
    }
    return out
  }

  // 地图是否已解锁：首张图初始开放；其余需全胜前置地图
  function isMapUnlocked(mapId) {
    const map = getExpeditionMap(mapId)
    if (!map) return false
    if (!map.unlockAfter) return true
    return completedMaps.value.includes(map.unlockAfter)
  }

  // 远征地图列表（供 UI）：附解锁状态与当前队伍在该图的预估档位
  const expeditionMaps = computed(() => {
    return EXPEDITION_MAPS.map(m => ({
      ...m,
      unlocked: isMapUnlocked(m.id),
      tier: getExpeditionTier(guildTeamPower.value, m.powerRequirement),
    }))
  })

  // 派遣远征：唯一队伍空闲时方可出发；出发即锁定战力/档位/奖励
  function startExpedition(mapId) {
    if (expedition.value) return false // 已有远征进行中
    const map = getExpeditionMap(mapId)
    if (!map) return false
    if (!isMapUnlocked(mapId)) return false
    const power = guildTeamPower.value
    if (power <= 0) return false // 公会未解锁/未训练
    const tier = getExpeditionTier(power, map.powerRequirement)
    const rewards = rollExpeditionRewards(map, tier)
    expedition.value = {
      mapId: map.id,
      startTime: Date.now(),
      power,        // 出发时战力（锁档）
      tier,
      rewards,      // 出发时锁定的奖励
      durationSec: map.durationSec,
    }
    save()
    return true
  }

  // 取消远征：队伍返回，无任何奖励
  function cancelExpedition() {
    if (!expedition.value) return false
    expedition.value = null
    save()
    return true
  }

  // 远征结算检查：到期自动发奖；全胜（gte100）记录完成用于解锁下一张
  function checkExpeditionCompletion() {
    const exp = expedition.value
    if (!exp) return
    if (Date.now() - exp.startTime < exp.durationSec * 1000) return
    for (const [res, amount] of Object.entries(exp.rewards)) {
      addResource(res, amount)
    }
    if (exp.tier === 'gte100' && !completedMaps.value.includes(exp.mapId)) {
      completedMaps.value.push(exp.mapId)
    }
    expedition.value = null
    save()
  }

  // ==================== 游戏循环 ====================

  let tickInterval = null

  function startTick() {
    if (tickInterval) return
    tickInterval = setInterval(tick, 1000)
  }

  function stopTick() {
    if (tickInterval) {
      clearInterval(tickInterval)
      tickInterval = null
    }
  }

  function addResource(key, amount) {
    const cap = getResourceCap(key)
    const current = getResourceAmount(key)
    const space = Math.max(0, cap - current)
    const actual = Math.min(amount, space)
    if (resources.value[key] !== undefined) {
      resources.value[key] = current + actual
    } else if (refined.value[key] !== undefined) {
      refined.value[key] = current + actual
    } else if (BASIC_RESOURCES[key]) {
      // 基本资源尚未初始化（如旧存档迁移），初始化后写入
      resources.value[key] = current + actual
    } else if (REFINED_RESOURCES[key]) {
      refined.value[key] = current + actual
    }
    return actual
  }

  function tick() {
    // 0. 远征结算：到期自动发奖（真实时间倒计时）
    checkExpeditionCompletion()

    // 幸福度增长修正用：记录本 tick 食物值变化的起点
    const foodBeforeHappiness = foodValue.value

    // 1. 政策转化：消耗资源 → 产生食物值（支持基础/精炼资源）
    for (const c of availableConversions.value) {
      const rate = policyRates.value[c.input] || 0
      if (rate > 0) {
        const available = getResourceAmount(c.input)
        const actual = Math.min(rate, available)
        if (actual > 0) {
          if (resources.value[c.input] !== undefined) resources.value[c.input] = available - actual
          else if (refined.value[c.input] !== undefined) refined.value[c.input] = available - actual
          foodValue.value += actual / c.ratio
        }
      }
    }

    // 2. 生产建筑产出（有人口才工作，按活跃配方产出）
    for (const b of PRODUCTION_BUILDINGS) {
      const level = buildingLevels.value[b.id] || 1
      if (level < 1) continue
      const assigned = getAssignedPop(b.id)
      if (assigned < 1) continue
      const recipe = getActiveRecipe(b.id)
      const outputs = getProductionRate(b, level, assigned, recipe, happinessOutputMultiplier.value)
      for (const o of outputs) {
        addResource(o.resource, o.ratePerSec)
      }
    }

    // 3. 加工建筑自动加工（需人口，1人=1倍速）
    for (const b of PROCESSING_BUILDINGS) {
      processBuildingPerSecond(b.id)
    }

    // 4. 被动食物产出（市政厅等，防止最后人口被饿死）
    foodValue.value += passiveFoodPerSec.value

    // 5. 食物值消耗（每人每秒2点）
    foodValue.value -= totalPopulation.value * DEMAND_CONFIG.foodValuePerPersonPerSec
    // 食物值最低为0，不会变成负数（人口不再饿死）
    if (foodValue.value < 0) foodValue.value = 0

    // 5.5 幸福度人口增长修正：对净食物值盈余应用增长倍率
    // 如食物盈余 +4.00/s、增长 +10% 时，等效增长速度为 +4.40/s
    // 仅修正盈余（正净变化），赤字不受影响（避免放大亏损）
    const netFoodChange = foodValue.value - foodBeforeHappiness
    if (netFoodChange > 0 && happinessGrowthMultiplier.value !== 1) {
      foodValue.value += netFoodChange * (happinessGrowthMultiplier.value - 1)
      if (foodValue.value < 0) foodValue.value = 0
    }

    // 6. 人口增长：食物槽满 → 涨人口
    while (foodValue.value >= getGrowthNeeded(totalPopulation.value) &&
           totalPopulation.value < maxPopulation.value) {
      foodValue.value -= getGrowthNeeded(totalPopulation.value)
      totalPopulation.value++
    }

    // 6.5 幸福度事件检查（每 N 秒一次）
    happinessEventCheckCounter.value++
    if (happinessEventCheckCounter.value >= HAPPINESS_CONFIG.eventCheckInterval) {
      happinessEventCheckCounter.value = 0
      checkHappinessEvents()
    }

    if (Math.floor(Date.now() / 1000) % 30 === 0) save()
    lastSaveTime.value = Date.now()
  }

  function removeOnePopulation() {
    if (totalPopulation.value <= 0) return
    totalPopulation.value--
    // 已分配人数 > 总人口 → 没有空闲人口，必须从建筑移除
    const totalAssigned = getTotalAssigned()
    if (totalAssigned > totalPopulation.value) {
      let maxBuilding = null
      let maxCount = 0
      for (const [bid, count] of Object.entries(populationAssigned.value)) {
        if (count > maxCount) { maxCount = count; maxBuilding = bid }
      }
      if (maxBuilding && maxCount > 0) {
        populationAssigned.value[maxBuilding] = maxCount - 1
      }
    }
  }

  // ==================== 离线计算 ====================

  function calculateOffline() {
    const now = Date.now()
    const elapsed = Math.floor((now - lastSaveTime.value) / 1000)
    if (elapsed < 10) return

    const cappedElapsed = Math.min(elapsed, OFFLINE_CONFIG.maxOfflineHours * 3600)
    const earnings = {}

    // 幸福度增长修正用：记录离线食物值变化的起点
    const offlineFoodBefore = foodValue.value

    // 离线政策转化
    for (const c of availableConversions.value) {
      const rate = policyRates.value[c.input] || 0
      if (rate > 0) {
        const available = getResourceAmount(c.input)
        const totalConvert = Math.min(rate * cappedElapsed, available)
        if (totalConvert > 0) {
          if (resources.value[c.input] !== undefined) resources.value[c.input] = available - totalConvert
          else if (refined.value[c.input] !== undefined) refined.value[c.input] = available - totalConvert
          foodValue.value += totalConvert / c.ratio
        }
      }
    }

    // 离线被动食物产出（市政厅等）
    foodValue.value += passiveFoodPerSec.value * cappedElapsed

    // 离线食物值消耗（50%速率）
    const offlineConsumption = totalPopulation.value * DEMAND_CONFIG.foodValuePerPersonPerSec * cappedElapsed * DEMAND_CONFIG.offlineConsumptionRate
    foodValue.value -= offlineConsumption
    // 食物值最低为0，不会变成负数（人口不再饿死）
    if (foodValue.value < 0) foodValue.value = 0

    // 幸福度人口增长修正（离线）：对净食物值盈余应用增长倍率（赤字不受影响）
    const offlineNetFoodChange = foodValue.value - offlineFoodBefore
    if (offlineNetFoodChange > 0 && happinessGrowthMultiplier.value !== 1) {
      foodValue.value += offlineNetFoodChange * (happinessGrowthMultiplier.value - 1)
      if (foodValue.value < 0) foodValue.value = 0
    }

    // 离线生产（按活跃配方产出）
    for (const b of PRODUCTION_BUILDINGS) {
      const level = buildingLevels.value[b.id] || 1
      if (level < 1) continue
      const assigned = getAssignedPop(b.id)
      if (assigned < 1) continue
      const recipe = getActiveRecipe(b.id)
      const outputs = getProductionRate(b, level, assigned, recipe, happinessOutputMultiplier.value)
      for (const o of outputs) {
        const produced = o.ratePerSec * OFFLINE_CONFIG.offlineRateMultiplier * cappedElapsed
        const actual = addResource(o.resource, produced)
        if (actual > 0.01) {
          earnings[o.resource] = (earnings[o.resource] || 0) + actual
        }
      }
    }

    // 离线加工（逐秒模拟，与实时行为一致）
    for (let s = 0; s < cappedElapsed; s++) {
      for (const b of PROCESSING_BUILDINGS) {
        processBuildingPerSecond(b.id)
      }
    }

    // 离线人口变化（完整模拟增长）
    // 增长：食物槽满 → 涨人口
    while (foodValue.value >= getGrowthNeeded(totalPopulation.value) &&
           totalPopulation.value < maxPopulation.value) {
      foodValue.value -= getGrowthNeeded(totalPopulation.value)
      totalPopulation.value++
    }

    if (Object.keys(earnings).length > 0) {
      offlineEarnings.value = earnings
      offlineSeconds.value = cappedElapsed
      showOfflineModal.value = true
    }

    lastSaveTime.value = now
    save()
  }

  function dismissOfflineModal() {
    showOfflineModal.value = false
  }

  // ==================== 存档 ====================

  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        resources: resources.value,
        refined: refined.value,
        buildingLevels: buildingLevels.value,
        warehouseLevel: warehouseLevel.value,
        discoveredBuildings: discoveredBuildings.value,
        totalPopulation: totalPopulation.value,
        populationAssigned: populationAssigned.value,
        foodValue: foodValue.value,
        policyRates: policyRates.value,
        processProgress: processProgress.value,
        activeRecipes: activeRecipes.value,
        activeHappinessEvents: activeHappinessEvents.value,
        happinessEventCheckCounter: happinessEventCheckCounter.value,
        expedition: expedition.value,
        completedMaps: completedMaps.value,
        lastSaveTime: lastSaveTime.value,
        version: 7,
      }))
    } catch (e) { /* ignore */ }
  }

  function load() {
    try {
      // 优先读取新版存档，缺失时回退到旧版 v6/v5/v4 存档（自动迁移）
      let raw = localStorage.getItem(SAVE_KEY)
      if (!raw) raw = localStorage.getItem('homeland_save_v6')
      if (!raw) raw = localStorage.getItem('homeland_save_v5')
      if (!raw) raw = localStorage.getItem('homeland_save_v4')
      if (!raw) return false
      // 从旧版键读到数据 → 写入新版键，后续 save 以 v7 覆盖
      if (localStorage.getItem(SAVE_KEY) !== raw) {
        localStorage.setItem(SAVE_KEY, raw)
      }
      const data = JSON.parse(raw)
      if (data.version !== 4 && data.version !== 5 && data.version !== 6 && data.version !== 7) return false

      resources.value = data.resources || {}
      refined.value = data.refined || {}
      // 迁移：旧存档的 food → wheat
      if (resources.value.food !== undefined && resources.value.wheat === undefined) {
        resources.value.wheat = resources.value.food
        delete resources.value.food
      }
      // 迁移：v5 新增资源（鱼/淡水/水稻）初始化为默认值
      for (const [key, def] of Object.entries(BASIC_RESOURCES)) {
        if (resources.value[key] === undefined) resources.value[key] = def.starting
      }
      for (const [key, def] of Object.entries(REFINED_RESOURCES)) {
        if (refined.value[key] === undefined) refined.value[key] = def.starting
      }
      buildingLevels.value = data.buildingLevels || {}
      // 迁移：旧存档缺少市政厅
      if (buildingLevels.value['townhall'] === undefined) {
        buildingLevels.value['townhall'] = 1
      }
      // 迁移：旧存档缺少湖泊 → 初始可用 Lv1
      if (buildingLevels.value['lake'] === undefined) {
        buildingLevels.value['lake'] = 1
      }
      warehouseLevel.value = data.warehouseLevel || 1
      discoveredBuildings.value = data.discoveredBuildings || []
      // 迁移：旧存档缺湖泊 → 加入已发现列表
      if (!discoveredBuildings.value.includes('lake')) {
        discoveredBuildings.value.push('lake')
      }
      totalPopulation.value = data.totalPopulation ?? POPULATION_CONFIG.initialPopulation
      populationAssigned.value = data.populationAssigned || {}
      // 迁移：清理已删除建筑（如早期版本的 brewery 酿酒坊）残留的派遣人口
      // 否则该人口不可见地占用派遣名额，导致 空闲=0、所有 + 按钮失效
      const validBuildingIds = new Set(BUILDINGS.map(b => b.id))
      for (const id of Object.keys(populationAssigned.value)) {
        if (!validBuildingIds.has(id)) delete populationAssigned.value[id]
      }
      // 保险：清理后若派遣数仍超过总人口，从派遣最多的建筑收回（与 removeOnePopulation 同逻辑）
      while (getTotalAssigned() > totalPopulation.value) {
        let maxId = null
        let maxCount = 0
        for (const [id, count] of Object.entries(populationAssigned.value)) {
          if (count > maxCount) { maxCount = count; maxId = id }
        }
        if (!maxId || maxCount <= 0) break
        populationAssigned.value[maxId] = maxCount - 1
      }
      foodValue.value = data.foodValue ?? 0
      policyRates.value = data.policyRates || {}
      processProgress.value = data.processProgress || {}
      // 迁移：v5 配方状态——旧存档没有 activeRecipes，回退到各建筑第一个配方
      activeRecipes.value = data.activeRecipes || {}
      for (const b of PRODUCTION_BUILDINGS) {
        const recipes = getBuildingRecipes(b)
        if (recipes.length > 0 && activeRecipes.value[b.id] === undefined) {
          activeRecipes.value[b.id] = recipes[0].id
        }
      }
      // 确保所有转化项都有默认值
      for (const c of POLICY_CONFIG.conversions) {
        if (policyRates.value[c.input] === undefined) {
          policyRates.value[c.input] = POLICY_CONFIG.defaultRate
        }
      }
      // 迁移：旧存档无幸福度状态 → 初始化为空；有新存档则恢复
      activeHappinessEvents.value = data.activeHappinessEvents || []
      happinessEventCheckCounter.value = data.happinessEventCheckCounter || 0
      // 迁移：v7 远征状态（旧存档无 → 空闲，未全胜过任何地图）
      expedition.value = data.expedition || null
      completedMaps.value = data.completedMaps || []
      lastSaveTime.value = data.lastSaveTime || Date.now()
      calculateOffline()
      // 离线模拟可能改变了资源/人口，重新检查事件确保激活状态正确
      checkHappinessEvents()
      checkUnlocks()
      // 远征为真实时间倒计时：加载时若已超时立即结算（离线期间照常计时）
      checkExpeditionCompletion()
      return true
    } catch (e) {
      return false
    }
  }

  function resetGame() {
    stopTick()
    localStorage.removeItem(SAVE_KEY)
    initNewGame()
    startTick()
  }

  // ==================== 调试 ====================

  function setResourceAmount(key, amount) {
    const cap = getResourceCap(key)
    const clamped = Math.max(0, Math.min(amount, cap))
    if (resources.value[key] !== undefined) resources.value[key] = clamped
    else if (refined.value[key] !== undefined) refined.value[key] = clamped
    save()
  }

  function fillAllResources() {
    for (const key of Object.keys(ALL_RESOURCES)) {
      const cap = getResourceCap(key)
      if (resources.value[key] !== undefined) resources.value[key] = cap
      else if (refined.value[key] !== undefined) refined.value[key] = cap
    }
    save()
  }

  // ==================== 工具 ====================

  function getResName(key) {
    return ALL_RESOURCES[key]?.name || key
  }

  function fmt(n) {
    if (n == null || isNaN(n)) return '0'
    if (n >= 1e6) return n.toExponential(2)
    if (n >= 1000) return n.toFixed(0)
    if (n >= 10) return n.toFixed(1)
    return n.toFixed(2)
  }

  // 干净数字格式：去掉多余的小数尾零（如 0.50 → 0.5，2.00 → 2）
  function fmtClean(n) {
    if (n == null || isNaN(n)) return '0'
    return String(parseFloat(n.toFixed(3)))
  }

  function fmtTime(seconds) {
    if (seconds < 60) return `${Math.floor(seconds)}秒`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分${Math.floor(seconds % 60)}秒`
    return `${Math.floor(seconds / 3600)}小时${Math.floor((seconds % 3600) / 60)}分`
  }

  return {
    // 状态
    resources, refined, buildingLevels, warehouseLevel,
    discoveredBuildings, lastSaveTime,
    populationAssigned, activeRecipes,
    showOfflineModal, offlineEarnings, offlineSeconds,
    // 人口计算
    totalPopulation, maxPopulation, unassignedPopulation,
    growthPercent, foodConsumption, foodValue, foodValueSurplus, foodValueStatus,
    getGrowthNeeded,
    getBuildingSlots, getAssignedPop,
    // 容量
    totalCapacity, totalUsed, totalPercent,
    warehouseUpgradeCost,
    // 建筑列表
    productionBuildings, lockedProductionBuildings,
    unlockedProcessingBuildings, lockedProcessingBuildings,
    keyBuildings, lockedKeyBuildings,
    getResourceCap, getResourceAmount,
    // 配方系统
    getActiveRecipe, getAvailableRecipes, setActiveRecipe,
    // 操作
    initNewGame, upgradeBuilding, upgradeWarehouse,
    assignPop, unassignPop, setPolicyRate,
    policyRates, POLICY_CONFIG, processProgress, availableConversions,
    upgradePreviewId, upgradePreview, openUpgradePreview, closeUpgradePreview,
    evolutionChoiceId, evolutionChoice, openEvolutionChoice, closeEvolutionChoice,
    evolveBuilding, revertBuilding,
    // 幸福度系统
    activeHappinessEvents, happinessPoints, happinessDemand,
    happinessNetPoints, happinessStatus,
    happinessGrowthMultiplier, happinessOutputMultiplier,
    passiveHappinessBonuses,
    checkHappinessEvents, HAPPINESS_CONFIG, getHappinessStatus,
    // 远征系统
    expedition, completedMaps,
    guildTeamPower, guildTeamName,
    expeditionMaps, isMapUnlocked, getExpeditionTier,
    startExpedition, cancelExpedition, checkExpeditionCompletion,
    EXPEDITION_MAPS, GUILD_CONFIG,
    // 加工与进化（供测试与调试直接调用）
    processBuildingPerSecond, checkUnlocks, isEvolvedAway,
    startTick, stopTick, tick, calculateOffline, dismissOfflineModal,
    save, load, resetGame,
    setResourceAmount, fillAllResources,
    // 工具
    fmt, fmtTime,
    BASIC_RESOURCES, REFINED_RESOURCES, ALL_RESOURCES, getBuildingRecipes,
  }
})
