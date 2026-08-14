// ============================================================
// 《家园》config.js 纯函数测试 — 不依赖 DOM 与 store
// ============================================================
import { describe, it, expect } from 'vitest'
import {
  BUILDINGS, ALL_RESOURCES,
  getBuilding, getBuildingRecipes, getGrowthNeeded, getHappinessStatus,
  PRODUCTION_BUILDINGS, PROCESSING_BUILDINGS, KEY_BUILDINGS,
  GUILD_CONFIG, EXPEDITION_MAPS,
} from './config.js'

describe('getGrowthNeeded 人口增长公式', () => {
  it('n=1 需要 75 食物值', () => {
    expect(getGrowthNeeded(1)).toBe(75)
  })

  it('n=2 需要 120 食物值', () => {
    expect(getGrowthNeeded(2)).toBe(120)
  })

  it('n=4 需要约 220.98 食物值（基础公式 ×5）', () => {
    expect(getGrowthNeeded(4)).toBeCloseTo(220.98, 2)
  })

  it('n=5 需要 275 食物值', () => {
    expect(getGrowthNeeded(5)).toBe(275)
  })

  it('n<1 时回退到 n=1 的值', () => {
    expect(getGrowthNeeded(0)).toBe(75)
  })

  it('随人口单调递增', () => {
    for (let n = 1; n < 50; n++) {
      expect(getGrowthNeeded(n + 1)).toBeGreaterThan(getGrowthNeeded(n))
    }
  })
})

describe('getBuildingRecipes 配方推导', () => {
  it('有 recipes 的建筑直接返回自身配方列表', () => {
    const farm = getBuilding('farm')
    const recipes = getBuildingRecipes(farm)
    expect(recipes).toBe(farm.recipes)
    expect(recipes.length).toBe(2)
    expect(recipes[0].id).toBe('wheat')
  })

  it('旧格式建筑（produces/baseRate）自动推导单一配方', () => {
    const forest = getBuilding('forest')
    const recipes = getBuildingRecipes(forest)
    expect(recipes).toEqual([{
      id: 'default',
      name: forest.name,
      outputs: [{ resource: 'wood', rate: 0.8 }],
    }])
  })

  it('多产出配方（湖泊）同时产出鱼与淡水', () => {
    const lake = getBuilding('lake')
    const recipes = getBuildingRecipes(lake)
    const outputs = recipes[0].outputs
    expect(outputs).toContainEqual({ resource: 'fish', rate: 0.25 })
    expect(outputs).toContainEqual({ resource: 'freshWater', rate: 1 })
  })
})

describe('getHappinessStatus 幸福度状态匹配', () => {
  it('净点数 3 及以上为狂喜', () => {
    expect(getHappinessStatus(3).name).toBe('狂喜')
    expect(getHappinessStatus(10).name).toBe('狂喜')
  })

  it('1~2 为高兴，0 为满意', () => {
    expect(getHappinessStatus(1).name).toBe('高兴')
    expect(getHappinessStatus(2).name).toBe('高兴')
    expect(getHappinessStatus(0).name).toBe('满意')
  })

  it('负数逐级下滑：-1~-2 不开心，-3~-4 生气，-5~-6 不安，-7 以下反感', () => {
    expect(getHappinessStatus(-1).name).toBe('不开心')
    expect(getHappinessStatus(-2).name).toBe('不开心')
    expect(getHappinessStatus(-3).name).toBe('生气')
    expect(getHappinessStatus(-4).name).toBe('生气')
    expect(getHappinessStatus(-5).name).toBe('不安')
    expect(getHappinessStatus(-6).name).toBe('不安')
    expect(getHappinessStatus(-7).name).toBe('反感')
    expect(getHappinessStatus(-999).name).toBe('反感')
  })

  it('状态包含人口增长与产出修正系数', () => {
    expect(getHappinessStatus(3).growthMod).toBe(0.20)
    expect(getHappinessStatus(3).outputMod).toBe(0.10)
    expect(getHappinessStatus(-7).growthMod).toBe(-1.00)
    expect(getHappinessStatus(-7).outputMod).toBe(-0.60)
  })
})

describe('BUILDINGS 结构完整性（保护性约束）', () => {
  it('建筑 id 全局唯一', () => {
    const ids = BUILDINGS.map(b => b.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('生产/加工建筑均有 populationSlots 与 maxLevel', () => {
    for (const b of [...PRODUCTION_BUILDINGS, ...PROCESSING_BUILDINGS]) {
      expect(b.populationSlots, `${b.id} 缺 populationSlots`).toBeTruthy()
      expect(b.maxLevel, `${b.id} 缺 maxLevel`).toBeGreaterThan(0)
    }
  })

  it('进化建筑 evolvedFrom 指向存在的原建筑，且原建筑 id 不同', () => {
    for (const b of BUILDINGS) {
      if (!b.evolvedOnly) continue
      expect(getBuilding(b.evolvedFrom), `${b.id} 的 evolvedFrom=${b.evolvedFrom} 不存在`).toBeTruthy()
      expect(b.evolvedFrom).not.toBe(b.id)
    }
  })

  it('所有配方引用的资源均已在 ALL_RESOURCES 中定义', () => {
    for (const b of PRODUCTION_BUILDINGS) {
      for (const r of getBuildingRecipes(b)) {
        for (const o of r.outputs) {
          expect(ALL_RESOURCES[o.resource], `${b.id} 配方产出 ${o.resource} 未定义`).toBeTruthy()
        }
      }
    }
    // 加工建筑原料/产出（不走 recipes，直接读 input/inputs/output/outputs）
    for (const b of PROCESSING_BUILDINGS) {
      for (const inp of (b.inputs || (b.input ? [b.input] : []))) {
        expect(ALL_RESOURCES[inp.resource], `${b.id} 原料 ${inp.resource} 未定义`).toBeTruthy()
      }
      for (const out of (b.outputs || (b.output ? [b.output] : []))) {
        expect(ALL_RESOURCES[out.resource], `${b.id} 产出 ${out.resource} 未定义`).toBeTruthy()
      }
    }
  })

  it('unlockBy 指向存在的建筑', () => {
    for (const b of BUILDINGS) {
      if (!b.unlockBy) continue
      expect(getBuilding(b.unlockBy.building), `${b.id} unlockBy=${b.unlockBy.building} 不存在`).toBeTruthy()
    }
  })

  it('生产建筑类型分类互斥且完整', () => {
    const types = new Set(BUILDINGS.map(b => b.type))
    expect(types.has('production')).toBe(true)
    expect(types.has('processing')).toBe(true)
    expect(types.has('key')).toBe(true)
  })
})

describe('GUILD_CONFIG 公会战力表', () => {
  it('Lv1~5 各有队伍战力且递增', () => {
    expect(GUILD_CONFIG.maxLevel).toBe(5)
    expect(Object.keys(GUILD_CONFIG.teamPowerByLevel).length).toBe(5)
    const powers = [1, 2, 3, 4, 5].map(lv => GUILD_CONFIG.teamPowerByLevel[lv])
    for (let i = 1; i < powers.length; i++) {
      expect(powers[i]).toBeGreaterThan(powers[i - 1])
    }
  })

  it('各等级有队伍名称', () => {
    for (const lv of [1, 2, 3, 4, 5]) {
      expect(GUILD_CONFIG.teamNameByLevel[lv], `Lv${lv} 缺队伍名`).toBeTruthy()
    }
  })

  it('公会建筑存在于关键建筑中，市政厅 Lv3 解锁', () => {
    const guild = getBuilding('guild')
    expect(guild).toBeTruthy()
    expect(guild.type).toBe('key')
    expect(guild.maxLevel).toBe(5)
    expect(guild.unlockBy).toEqual({ building: 'townhall', level: 3 })
  })
})

describe('EXPEDITION_MAPS 远征地图表', () => {
  it('地图 id 唯一，首张图初始开放，后续图 unlockAfter 指向已存在的前置图', () => {
    const ids = EXPEDITION_MAPS.map(m => m.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (let i = 0; i < EXPEDITION_MAPS.length; i++) {
      const m = EXPEDITION_MAPS[i]
      if (i === 0) {
        expect(m.unlockAfter).toBeUndefined()
      } else {
        expect(EXPEDITION_MAPS.find(x => x.id === m.unlockAfter), `${m.id} 前置图 ${m.unlockAfter} 不存在`).toBeTruthy()
        // 前置图必须是前序某张（按进度解锁）
        expect(ids.indexOf(m.unlockAfter)).toBeLessThan(i)
      }
    }
  })

  it('每张图有战力要求、时长与四档奖励表，奖励资源合法且范围有效', () => {
    for (const m of EXPEDITION_MAPS) {
      expect(m.powerRequirement, `${m.id} 缺战力要求`).toBeGreaterThan(0)
      expect(m.durationSec, `${m.id} 缺时长`).toBeGreaterThan(0)
      for (const tier of ['lt50', '50-75', '75-100', 'gte100']) {
        const table = m.rewards[tier]
        expect(table, `${m.id} 缺 ${tier} 档奖励表`).toBeTruthy()
        for (const [res, range] of Object.entries(table)) {
          expect(ALL_RESOURCES[res], `${m.id} ${tier} 奖励 ${res} 未定义`).toBeTruthy()
          expect(range[0], `${m.id} ${tier} ${res} 范围无效`).toBeLessThanOrEqual(range[1])
        }
      }
    }
  })

  it('战力要求随地图进度递增', () => {
    const reqs = EXPEDITION_MAPS.map(m => m.powerRequirement)
    for (let i = 1; i < reqs.length; i++) {
      expect(reqs[i]).toBeGreaterThan(reqs[i - 1])
    }
  })
})
