// ============================================================
// 《家园》游戏状态管理 (Pinia Store)
// 统一建筑系统 + 人口系统
// ============================================================
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  BUILDINGS, PRODUCTION_BUILDINGS, PROCESSING_BUILDINGS, KEY_BUILDINGS,
  BASIC_RESOURCES, REFINED_RESOURCES, ALL_RESOURCES, getBuilding,
  POPULATION_CONFIG, DEMAND_CONFIG, POLICY_CONFIG,
  WAREHOUSE_CONFIG, OFFLINE_CONFIG
} from './config.js'

const SAVE_KEY = 'homeland_save_v4'

export const useGameStore = defineStore('game', () => {
  // ==================== 状态 ====================

  const resources = ref({})
  const refined = ref({})
  const buildingLevels = ref({})
  const warehouseLevel = ref(1)
  const discoveredBuildings = ref([])
  const lastSaveTime = ref(Date.now())

  // 人口系统
  const totalPopulation = ref(0)         // 独立状态：总人口数
  const populationAssigned = ref({})   // { buildingId: count }
  const growthProgress = ref(0)         // 0 → growthThreshold

  // 需求系统（食物值）
  const foodValue = ref(0)              // 独立于仓库的食物值

  // 政策系统
  const policyRates = ref({})           // { resourceId: ratePerSec }

  // 离线弹窗
  const showOfflineModal = ref(false)
  const offlineEarnings = ref({})
  const offlineSeconds = ref(0)

  // ==================== 初始化 ====================

  function initNewGame() {
    for (const [key, def] of Object.entries(BASIC_RESOURCES)) {
      resources.value[key] = def.starting
    }
    for (const [key, def] of Object.entries(REFINED_RESOURCES)) {
      refined.value[key] = def.starting
    }
    for (const b of BUILDINGS) {
      if (b.type === 'production') buildingLevels.value[b.id] = 1
      else if (b.type === 'key') buildingLevels.value[b.id] = 1
      else buildingLevels.value[b.id] = 0 // 加工建筑未解锁
    }
    warehouseLevel.value = 1
    discoveredBuildings.value = [
      ...PRODUCTION_BUILDINGS.map(b => b.id),
      ...KEY_BUILDINGS.map(b => b.id),
    ]

    // 初始化人口
    totalPopulation.value = POPULATION_CONFIG.initialPopulation
    // 每个生产建筑自动分1人
    for (const b of PRODUCTION_BUILDINGS) {
      populationAssigned.value[b.id] = 1
    }

    growthProgress.value = 0
    foodValue.value = 0
    policyRates.value = {}
    for (const c of POLICY_CONFIG.conversions) {
      policyRates.value[c.input] = POLICY_CONFIG.defaultRate
    }
    lastSaveTime.value = Date.now()
    checkUnlocks()
  }

  // ==================== 人口计算 ====================

  // 人口上限（由聚集地建筑决定）
  const maxPopulation = computed(() => {
    const lv = buildingLevels.value['settlement'] || 1
    const b = getBuilding('settlement')
    if (!b) return 10
    // 里程碑10级额外+10
    let bonus = 0
    if (lv >= 10 && b.milestones[10]) bonus = 10
    return b.maxPopBase + (lv - 1) * b.maxPopPerLevel + bonus
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

  // 增长进度百分比
  const growthPercent = computed(() => {
    return Math.min(100, (growthProgress.value / POPULATION_CONFIG.growthThreshold) * 100)
  })

  // 食物值消耗速率（每秒）
  const foodConsumption = computed(() => {
    return totalPopulation.value * DEMAND_CONFIG.foodValuePerPersonPerSec
  })

  // 食物值状态
  const foodValueStatus = computed(() => {
    if (foodValue.value >= DEMAND_CONFIG.feastThreshold) return 'feast'
    if (foodValue.value > DEMAND_CONFIG.starveThreshold) return 'normal'
    return 'starve'
  })

  // 获取某建筑的槽位数
  function getBuildingSlots(buildingId) {
    const b = getBuilding(buildingId)
    if (!b || !b.populationSlots) return 0
    const level = buildingLevels.value[buildingId] || 0
    if (level < 1) return 0
    return b.populationSlots.base + Math.floor((level - 1) / b.populationSlots.perLevel)
  }

  // 获取某建筑已分配人口
  function getAssignedPop(buildingId) {
    return populationAssigned.value[buildingId] || 0
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
    return PRODUCTION_BUILDINGS.map(b => {
      const level = buildingLevels.value[b.id] || 1
      const assigned = getAssignedPop(b.id)
      const slots = getBuildingSlots(b.id)
      const rate = getProductionRate(b, level, assigned)
      const upgradeCost = getUpgradeCost(b, level)
      const nextMilestone = getNextMilestone(b, level)
      const cap = getResourceCap(b.produces)
      const amount = getResourceAmount(b.produces)
      const pct = cap > 0 ? (amount / cap) * 100 : 0
      return {
        ...b, level, assigned, slots, rate, upgradeCost, nextMilestone,
        resourceAmount: amount, resourceCap: cap, resourcePct: pct,
        isManned: assigned > 0,
      }
    })
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
        const inputAmt = getEffectiveInput(b, level)
        const outputAmt = getEffectiveOutput(b, level)
        const haveInput = (resources.value[b.input.resource] || 0) >= inputAmt
        const outCap = getResourceCap(b.output.resource)
        const outAmt = getResourceAmount(b.output.resource)
        return {
          ...b, level, assigned, slots, upgradeCost, nextMilestone,
          effectiveInput: inputAmt, effectiveOutput: outputAmt,
          inputAmount: resources.value[b.input.resource] || 0,
          outputAmount: outAmt, outputCap: outCap,
          canProcess: assigned > 0 && haveInput && (outAmt + outputAmt <= outCap),
          isManned: assigned > 0,
        }
      })
  })

  const lockedProcessingBuildings = computed(() => {
    return PROCESSING_BUILDINGS
      .filter(b => (buildingLevels.value[b.id] || 0) === 0)
      .map(b => ({
        ...b,
        unlockReq: b.unlockBy
          ? `${getBuilding(b.unlockBy.building)?.name || '?'} Lv${b.unlockBy.level}`
          : '未知条件'
      }))
  })

  const keyBuildings = computed(() => {
    return KEY_BUILDINGS.map(b => {
      const level = buildingLevels.value[b.id] || 1
      const upgradeCost = getUpgradeCost(b, level)
      const nextMilestone = getNextMilestone(b, level)
      return { ...b, level, upgradeCost, nextMilestone }
    })
  })

  // ==================== 核心计算 ====================

  function getProductionRate(building, level, assigned) {
    if (assigned < 1) return 0
    let rate = building.baseRate * assigned  // 每人口提供1倍基础产量
    rate *= (1 + (level - 1) * building.ratePerLevel)
    for (const [mlv, ml] of Object.entries(building.milestones || {})) {
      if (level >= parseInt(mlv)) rate *= (1 + (ml.bonus || 0))
    }
    return rate
  }

  function getEffectiveInput(building, level) {
    let ratio = 1
    ratio -= (level - 1) * (building.levelUpBonus || 0)
    for (const [mlv, ml] of Object.entries(building.milestones || {})) {
      if (level >= parseInt(mlv)) ratio -= (ml.bonus || 0)
    }
    ratio = Math.max(0.3, ratio)
    return Math.max(1, Math.floor(building.input.amount * ratio))
  }

  function getEffectiveOutput(building, level) {
    let extra = 0
    for (const [mlv, ml] of Object.entries(building.milestones || {})) {
      if (level >= parseInt(mlv)) extra += (ml.extraOutput || 0)
    }
    return building.output.amount + extra
  }

  function getUpgradeCost(building, level) {
    const amount = Math.floor(building.baseCost * Math.pow(building.costMultiplier, level - 1))
    return { resource: building.costResource, amount }
  }

  function getNextMilestone(building, level) {
    if (!building.milestones) return null
    const milestones = Object.keys(building.milestones).map(Number).sort((a, b) => a - b)
    for (const m of milestones) {
      if (m > level) return { level: m, ...building.milestones[m] }
    }
    return null
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

    const cost = getUpgradeCost(building, level)
    const costKey = cost.resource
    const wallet = resources.value[costKey] !== undefined ? resources.value : refined.value
    if ((wallet[costKey] || 0) < cost.amount) return false

    wallet[costKey] -= cost.amount
    buildingLevels.value[buildingId] = level + 1
    checkUnlocks()
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

  function processBuilding(buildingId) {
    const building = getBuilding(buildingId)
    if (!building || building.type !== 'processing') return false
    const level = buildingLevels.value[buildingId] || 0
    if (level < 1) return false

    const assigned = getAssignedPop(buildingId)
    if (assigned < 1) return false

    const inputNeeded = getEffectiveInput(building, level)
    const outputGain = getEffectiveOutput(building, level)

    if ((resources.value[building.input.resource] || 0) < inputNeeded) return false
    const outCap = getResourceCap(building.output.resource)
    const outAmt = getResourceAmount(building.output.resource)
    if (outAmt + outputGain > outCap) return false

    resources.value[building.input.resource] -= inputNeeded
    refined.value[building.output.resource] = outAmt + outputGain
    save()
    return true
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

  function checkUnlocks() {
    for (const b of PRODUCTION_BUILDINGS) {
      const level = buildingLevels.value[b.id] || 1
      for (const [mlv, ml] of Object.entries(b.milestones || {})) {
        if (level >= parseInt(mlv) && ml.unlockBuilding) {
          const targetId = ml.unlockBuilding
          if ((buildingLevels.value[targetId] || 0) === 0) {
            buildingLevels.value[targetId] = 1
            if (!discoveredBuildings.value.includes(targetId)) {
              discoveredBuildings.value.push(targetId)
            }
          }
        }
      }
    }
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
    // 1. 政策转化：消耗资源 → 产生食物值
    for (const c of POLICY_CONFIG.conversions) {
      const rate = policyRates.value[c.input] || 0
      if (rate > 0) {
        const available = resources.value[c.input] || 0
        const actual = Math.min(rate, available)
        if (actual > 0) {
          resources.value[c.input] = available - actual
          foodValue.value += actual / c.ratio
        }
      }
    }

    // 2. 食物值消耗
    const consumed = foodConsumption.value
    foodValue.value = Math.max(0, foodValue.value - consumed)

    // 3. 生产建筑产出（有人口才工作）
    for (const b of PRODUCTION_BUILDINGS) {
      const level = buildingLevels.value[b.id] || 1
      if (level < 1) continue
      const assigned = getAssignedPop(b.id)
      if (assigned < 1) continue
      const rate = getProductionRate(b, level, assigned)
      addResource(b.produces, rate)

      if (level >= 15 && b.milestones[15]?.autoProduce) {
        addResource(b.milestones[15].autoProduce, rate * 0.05)
      }
    }

    // 4. 人口增长/衰减（基于食物值）
    if (foodValue.value > DEMAND_CONFIG.starveThreshold) {
      // 有食物值 → 增长
      let speed = POPULATION_CONFIG.growthRate
      if (foodValue.value >= DEMAND_CONFIG.feastThreshold) speed *= 2
      // 食物值越多越快（cap at 2x from food value abundance）
      const abundanceBonus = Math.min(2, 0.5 + foodValue.value / Math.max(1, DEMAND_CONFIG.feastThreshold))
      speed *= abundanceBonus

      growthProgress.value += speed

      while (growthProgress.value >= POPULATION_CONFIG.growthThreshold) {
        growthProgress.value -= POPULATION_CONFIG.growthThreshold
        if (totalPopulation.value < maxPopulation.value) {
          totalPopulation.value++
        }
      }
    } else {
      // 食物值不足 → 衰减
      let speed = POPULATION_CONFIG.declineRate
      // 食物值越低衰减越快（0时最快）
      if (foodValue.value <= 0) {
        speed *= 1.5
      } else {
        speed *= (1 - foodValue.value / DEMAND_CONFIG.starveThreshold)
      }

      growthProgress.value -= speed

      while (growthProgress.value < 0 && totalPopulation.value > 0) {
        growthProgress.value += POPULATION_CONFIG.growthThreshold
        removeOnePopulation()
      }
    }

    // 限制进度条范围
    growthProgress.value = Math.max(0, Math.min(
      growthProgress.value,
      POPULATION_CONFIG.growthThreshold * 2
    ))

    // 防止人口降为负数
    if (totalPopulation.value <= 0) {
      growthProgress.value = Math.max(0, growthProgress.value)
    }

    if (Math.floor(Date.now() / 1000) % 30 === 0) save()
    lastSaveTime.value = Date.now()
  }

  function removeOnePopulation() {
    // 优先扣未分配人口；全部分配则从最多人的建筑扣
    totalPopulation.value = Math.max(0, totalPopulation.value - 1)
    // 从分配最多人的建筑减员
    let maxBuilding = null
    let maxCount = 0
    for (const [bid, count] of Object.entries(populationAssigned.value)) {
      if (count > maxCount) { maxCount = count; maxBuilding = bid }
    }
    if (maxBuilding && maxCount > 0) {
      populationAssigned.value[maxBuilding] = maxCount - 1
    }
  }

  // ==================== 离线计算 ====================

  function calculateOffline() {
    const now = Date.now()
    const elapsed = Math.floor((now - lastSaveTime.value) / 1000)
    if (elapsed < 10) return

    const cappedElapsed = Math.min(elapsed, OFFLINE_CONFIG.maxOfflineHours * 3600)
    const earnings = {}

    // 离线政策转化
    for (const c of POLICY_CONFIG.conversions) {
      const rate = policyRates.value[c.input] || 0
      if (rate > 0) {
        const available = resources.value[c.input] || 0
        const totalConvert = Math.min(rate * cappedElapsed, available)
        if (totalConvert > 0) {
          resources.value[c.input] = available - totalConvert
          foodValue.value += totalConvert / c.ratio
        }
      }
    }

    // 离线食物值消耗（50%速率）
    const offlineConsumption = foodConsumption.value * cappedElapsed * 0.5
    foodValue.value = Math.max(0, foodValue.value - offlineConsumption)

    // 离线生产
    for (const b of PRODUCTION_BUILDINGS) {
      const level = buildingLevels.value[b.id] || 1
      if (level < 1) continue
      const assigned = getAssignedPop(b.id)
      if (assigned < 1) continue
      const rate = getProductionRate(b, level, assigned) * OFFLINE_CONFIG.offlineRateMultiplier
      const produced = rate * cappedElapsed

      const actual = addResource(b.produces, produced)
      if (actual > 0.01) {
        earnings[b.produces] = (earnings[b.produces] || 0) + actual
      }

      if (level >= 15 && b.milestones[15]?.autoProduce) {
        const autoRes = b.milestones[15].autoProduce
        const autoActual = addResource(autoRes, rate * 0.05 * cappedElapsed)
        if (autoActual > 0.01) {
          earnings['auto_' + autoRes] = (earnings['auto_' + autoRes] || 0) + autoActual
        }
      }
    }

    // 离线人口增长（仅当食物值>0时缓慢增长，不衰减）
    if (foodValue.value > 0 && totalPopulation.value < maxPopulation.value) {
      const offlineGrowth = POPULATION_CONFIG.growthRate * 0.3 * cappedElapsed
      growthProgress.value += offlineGrowth
      while (growthProgress.value >= POPULATION_CONFIG.growthThreshold &&
             totalPopulation.value < maxPopulation.value) {
        growthProgress.value -= POPULATION_CONFIG.growthThreshold
        totalPopulation.value++
      }
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
        growthProgress: growthProgress.value,
        foodValue: foodValue.value,
        policyRates: policyRates.value,
        lastSaveTime: lastSaveTime.value,
        version: 4,
      }))
    } catch (e) { /* ignore */ }
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (!raw) return false
      const data = JSON.parse(raw)
      if (data.version === 4) {
        resources.value = data.resources || {}
        refined.value = data.refined || {}
        // 迁移：旧存档的 food → wheat
        if (resources.value.food !== undefined && resources.value.wheat === undefined) {
          resources.value.wheat = resources.value.food
          delete resources.value.food
        }
        buildingLevels.value = data.buildingLevels || {}
        warehouseLevel.value = data.warehouseLevel || 1
        discoveredBuildings.value = data.discoveredBuildings || []
        totalPopulation.value = data.totalPopulation ?? POPULATION_CONFIG.initialPopulation
        populationAssigned.value = data.populationAssigned || {}
        growthProgress.value = data.growthProgress || 0
        foodValue.value = data.foodValue ?? 0
        policyRates.value = data.policyRates || {}
        // 确保所有转化项都有默认值
        for (const c of POLICY_CONFIG.conversions) {
          if (policyRates.value[c.input] === undefined) {
            policyRates.value[c.input] = POLICY_CONFIG.defaultRate
          }
        }
        lastSaveTime.value = data.lastSaveTime || Date.now()
        calculateOffline()
        checkUnlocks()
        return true
      }
      return false
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

  function fmt(n) {
    if (n == null || isNaN(n)) return '0'
    if (n >= 1e6) return n.toExponential(2)
    if (n >= 1000) return n.toFixed(0)
    if (n >= 10) return n.toFixed(1)
    return n.toFixed(2)
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
    populationAssigned, growthProgress,
    showOfflineModal, offlineEarnings, offlineSeconds,
    // 人口计算
    totalPopulation, maxPopulation, unassignedPopulation,
    growthPercent, foodConsumption, foodValue, foodValueStatus,
    getBuildingSlots, getAssignedPop,
    // 容量
    totalCapacity, totalUsed, totalPercent,
    warehouseUpgradeCost,
    // 建筑列表
    productionBuildings, unlockedProcessingBuildings, lockedProcessingBuildings,
    keyBuildings,
    getResourceCap, getResourceAmount,
    // 操作
    initNewGame, upgradeBuilding, upgradeWarehouse, processBuilding,
    assignPop, unassignPop, setPolicyRate,
    policyRates, POLICY_CONFIG,
    startTick, stopTick, tick, calculateOffline, dismissOfflineModal,
    save, load, resetGame,
    setResourceAmount, fillAllResources,
    // 工具
    fmt, fmtTime,
    BASIC_RESOURCES, REFINED_RESOURCES, ALL_RESOURCES,
  }
})
