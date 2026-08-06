// ============================================================
// 《家园》游戏状态管理 (Pinia Store)
// 统一建筑系统：生产建筑 + 加工建筑
// ============================================================
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  BUILDINGS, PRODUCTION_BUILDINGS, PROCESSING_BUILDINGS,
  BASIC_RESOURCES, REFINED_RESOURCES, ALL_RESOURCES, getBuilding,
  WAREHOUSE_CONFIG, OFFLINE_CONFIG
} from './config.js'

const SAVE_KEY = 'homeland_save_v3'

export const useGameStore = defineStore('game', () => {
  // ==================== 状态 ====================

  const resources = ref({})           // 基础物资数量
  const refined = ref({})             // 高级物资数量
  const buildingLevels = ref({})      // 所有建筑的等级 { farm: 1, sawmill: 0, ... } — 加工建筑0=未解锁
  const warehouseLevel = ref(1)       // 仓库等级
  const discoveredBuildings = ref([]) // 已发现的建筑 ID（用于 UI 显示）
  const lastSaveTime = ref(Date.now())
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
      // 生产建筑从1级开始，加工建筑0级=未解锁
      buildingLevels.value[b.id] = b.type === 'production' ? 1 : 0
    }
    warehouseLevel.value = 1
    discoveredBuildings.value = PRODUCTION_BUILDINGS.map(b => b.id)
    lastSaveTime.value = Date.now()
    checkUnlocks()
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

  // ==================== 建筑列表（计算属性）====================

  // 生产建筑列表
  const productionBuildings = computed(() => {
    return PRODUCTION_BUILDINGS.map(b => {
      const level = buildingLevels.value[b.id] || 1
      const rate = getProductionRate(b, level)
      const upgradeCost = getUpgradeCost(b, level)
      const nextMilestone = getNextMilestone(b, level)
      const cap = getResourceCap(b.produces)
      const amount = getResourceAmount(b.produces)
      const pct = cap > 0 ? (amount / cap) * 100 : 0
      return {
        ...b,
        level,
        rate,
        upgradeCost,
        nextMilestone,
        resourceAmount: amount,
        resourceCap: cap,
        resourcePct: pct,
      }
    })
  })

  // 已解锁的加工建筑列表
  const unlockedProcessingBuildings = computed(() => {
    return PROCESSING_BUILDINGS
      .filter(b => (buildingLevels.value[b.id] || 0) > 0)
      .map(b => {
        const level = buildingLevels.value[b.id] || 1
        const upgradeCost = getUpgradeCost(b, level)
        const nextMilestone = getNextMilestone(b, level)
        // 计算加工消耗（考虑等级加成）
        const inputAmount = getEffectiveInput(b, level)
        const outputAmount = getEffectiveOutput(b, level)
        const haveInput = (resources.value[b.input.resource] || 0) >= inputAmount
        const outCap = getResourceCap(b.output.resource)
        const outAmt = getResourceAmount(b.output.resource)
        const outSpace = outCap - outAmt >= outputAmount
        return {
          ...b,
          level,
          upgradeCost,
          nextMilestone,
          effectiveInput: inputAmount,
          effectiveOutput: outputAmount,
          inputAmount: resources.value[b.input.resource] || 0,
          outputAmount: outAmt,
          outputCap: outCap,
          canProcess: haveInput && outSpace,
        }
      })
  })

  // 尚未解锁的加工建筑
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

  // ==================== 核心计算 ====================

  // 生产建筑的当前产出速率
  function getProductionRate(building, level) {
    let rate = building.baseRate * (1 + (level - 1) * building.ratePerLevel)
    for (const [mlv, ml] of Object.entries(building.milestones || {})) {
      if (level >= parseInt(mlv)) {
        rate *= (1 + (ml.bonus || 0))
      }
    }
    return rate
  }

  // 加工建筑的实际输入需求（随等级降低）
  function getEffectiveInput(building, level) {
    let ratio = 1
    // 每级减少 levelUpBonus 的需求
    ratio -= (level - 1) * (building.levelUpBonus || 0)
    // 里程碑加成
    for (const [mlv, ml] of Object.entries(building.milestones || {})) {
      if (level >= parseInt(mlv)) {
        ratio -= (ml.bonus || 0)
      }
    }
    ratio = Math.max(0.3, ratio) // 最低30%
    return Math.max(1, Math.floor(building.input.amount * ratio))
  }

  // 加工建筑的实际产出数量（随等级可能增加）
  function getEffectiveOutput(building, level) {
    let extra = 0
    for (const [mlv, ml] of Object.entries(building.milestones || {})) {
      if (level >= parseInt(mlv)) {
        extra += (ml.extraOutput || 0)
      }
    }
    return building.output.amount + extra
  }

  // 通用升级成本
  function getUpgradeCost(building, level) {
    const amount = Math.floor(building.baseCost * Math.pow(building.costMultiplier, level - 1))
    return { resource: building.costResource, amount }
  }

  // 下一个里程碑
  function getNextMilestone(building, level) {
    if (!building.milestones) return null
    const milestones = Object.keys(building.milestones).map(Number).sort((a, b) => a - b)
    for (const m of milestones) {
      if (m > level) return { level: m, ...building.milestones[m] }
    }
    return null
  }

  // 仓库升级成本
  const warehouseUpgradeCost = computed(() => {
    const amount = Math.floor(
      WAREHOUSE_CONFIG.baseUpgradeCost.amount *
      Math.pow(WAREHOUSE_CONFIG.costMultiplier, warehouseLevel.value - 1)
    )
    return { resource: WAREHOUSE_CONFIG.baseUpgradeCost.resource, amount }
  })

  // ==================== 操作 ====================

  // 升级任意建筑
  function upgradeBuilding(buildingId) {
    const building = getBuilding(buildingId)
    if (!building) return false
    const level = buildingLevels.value[buildingId] || 0
    if (level < 0) return false // 未解锁的加工建筑

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

  // 升级仓库
  function upgradeWarehouse() {
    const cost = warehouseUpgradeCost.value
    if ((resources.value[cost.resource] || 0) < cost.amount) return false
    resources.value[cost.resource] -= cost.amount
    warehouseLevel.value++
    save()
    return true
  }

  // 加工（执行一次加工建筑的操作）
  function processBuilding(buildingId) {
    const building = getBuilding(buildingId)
    if (!building || building.type !== 'processing') return false
    const level = buildingLevels.value[buildingId] || 0
    if (level < 1) return false // 未解锁

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

  // 检查解锁（生产建筑里程碑解锁加工建筑）
  function checkUnlocks() {
    for (const b of PRODUCTION_BUILDINGS) {
      const level = buildingLevels.value[b.id] || 1
      for (const [mlv, ml] of Object.entries(b.milestones || {})) {
        if (level >= parseInt(mlv) && ml.unlockBuilding) {
          const targetId = ml.unlockBuilding
          if ((buildingLevels.value[targetId] || 0) === 0) {
            buildingLevels.value[targetId] = 1 // 解锁为1级
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

  // 向某种物资添加数量（受独立容量限制），返回实际添加量
  function addResource(key, amount) {
    const cap = getResourceCap(key)
    const current = getResourceAmount(key)
    const space = Math.max(0, cap - current)
    const actual = Math.min(amount, space)

    if (resources.value[key] !== undefined) {
      resources.value[key] = current + actual
    } else if (refined.value[key] !== undefined) {
      refined.value[key] = current + actual
    }
    return actual
  }

  function tick() {
    // 只有生产建筑在 tick 中自动产出
    for (const b of PRODUCTION_BUILDINGS) {
      const level = buildingLevels.value[b.id] || 1
      if (level < 1) continue
      const rate = getProductionRate(b, level)
      addResource(b.produces, rate)

      // 里程碑15：自动产出高级物资（5%产能）
      if (level >= 15 && b.milestones[15]?.autoProduce) {
        addResource(b.milestones[15].autoProduce, rate * 0.05)
      }
    }

    if (Math.floor(Date.now() / 1000) % 30 === 0) save()
    lastSaveTime.value = Date.now()
  }

  // ==================== 离线计算 ====================

  function calculateOffline() {
    const now = Date.now()
    const elapsed = Math.floor((now - lastSaveTime.value) / 1000)
    if (elapsed < 10) return

    const cappedElapsed = Math.min(elapsed, OFFLINE_CONFIG.maxOfflineHours * 3600)
    const earnings = {}

    for (const b of PRODUCTION_BUILDINGS) {
      const level = buildingLevels.value[b.id] || 1
      if (level < 1) continue
      const rate = getProductionRate(b, level) * OFFLINE_CONFIG.offlineRateMultiplier
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
        lastSaveTime: lastSaveTime.value,
        version: 3,
      }))
    } catch (e) { /* ignore */ }
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (!raw) return false
      const data = JSON.parse(raw)
      if (data.version === 3) {
        resources.value = data.resources || {}
        refined.value = data.refined || {}
        buildingLevels.value = data.buildingLevels || {}
        warehouseLevel.value = data.warehouseLevel || 1
        discoveredBuildings.value = data.discoveredBuildings || []
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

  // 调试：直接设置资源数量
  function setResourceAmount(key, amount) {
    const cap = getResourceCap(key)
    const clamped = Math.max(0, Math.min(amount, cap))
    if (resources.value[key] !== undefined) {
      resources.value[key] = clamped
    } else if (refined.value[key] !== undefined) {
      refined.value[key] = clamped
    }
    save()
  }

  // 调试：填满所有资源到上限
  function fillAllResources() {
    for (const key of Object.keys(ALL_RESOURCES)) {
      const cap = getResourceCap(key)
      if (resources.value[key] !== undefined) {
        resources.value[key] = cap
      } else if (refined.value[key] !== undefined) {
        refined.value[key] = cap
      }
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
    showOfflineModal, offlineEarnings, offlineSeconds,
    // 计算
    totalCapacity, totalUsed, totalPercent,
    warehouseUpgradeCost,
    productionBuildings, unlockedProcessingBuildings, lockedProcessingBuildings,
    getResourceCap, getResourceAmount,
    // 操作
    initNewGame, upgradeBuilding, upgradeWarehouse, processBuilding,
    startTick, stopTick, tick, calculateOffline, dismissOfflineModal,
    save, load, resetGame, setResourceAmount, fillAllResources,
    // 工具
    fmt, fmtTime,
    // 常量引用
    BASIC_RESOURCES, REFINED_RESOURCES, ALL_RESOURCES,
  }
})
