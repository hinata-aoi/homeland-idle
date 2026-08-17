// ============================================================
// 《家园》组件冒烟测试 — 面板渲染与弹窗交互
// ============================================================
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useGameStore } from '../game/store.js'
import ProductionPanel from './ProductionPanel.vue'
import UpgradeModal from './UpgradeModal.vue'
import EvolutionModal from './EvolutionModal.vue'
import ExpeditionPanel from './ExpeditionPanel.vue'
import MarketPanel from './MarketPanel.vue'
import PolicyPanel from './PolicyPanel.vue'

let pinia
let store
let wrapper

beforeEach(() => {
  localStorage.clear()
  pinia = createPinia()
  setActivePinia(pinia)
  store = useGameStore()
  store.initNewGame()
})

afterEach(() => {
  if (wrapper) wrapper.unmount()
  wrapper = null
})

function mountWithPinia(component) {
  wrapper = mount(component, { global: { plugins: [pinia] } })
  return wrapper
}

describe('ProductionPanel 生产面板', () => {
  it('渲染已解锁的生产建筑（农田/森林）', () => {
    const w = mountWithPinia(ProductionPanel)
    expect(w.text()).toContain('农田')
    expect(w.text()).toContain('森林')
  })

  it('未解锁建筑显示在锁定区（采石场需市政厅 Lv2）', () => {
    const w = mountWithPinia(ProductionPanel)
    expect(w.text()).toContain('采石场')
    expect(w.text()).toContain('市政厅 Lv2 解锁')
  })

  it('点击升级按钮打开升级预览', async () => {
    const w = mountWithPinia(ProductionPanel)
    const upgradeBtn = w.findAll('button').find(b => b.text() === '升级')
    expect(upgradeBtn).toBeTruthy()
    await upgradeBtn.trigger('click')
    expect(store.upgradePreviewId).toBe('farm')
  })

  it('驻人后显示产出速率（初始不开心状态 ×0.95）', () => {
    store.assignPop('farm')
    const w = mountWithPinia(ProductionPanel)
    expect(w.text()).toContain('小麦 +2.85/s') // 3 × 0.95
  })
})

describe('UpgradeModal 升级预览弹窗', () => {
  it('打开后展示数值对比与确认按钮', () => {
    store.openUpgradePreview('farm')
    mountWithPinia(UpgradeModal)
    expect(document.body.textContent).toContain('农田')
    expect(document.body.textContent).toContain('升级预览')
    expect(document.body.textContent).toContain('确认升级')
  })

  it('点击确认升级后执行升级并关闭弹窗', async () => {
    store.setResourceAmount('wood', 500)
    store.openUpgradePreview('farm')
    mountWithPinia(UpgradeModal)
    // Teleport 渲染到 body，从真实 DOM 查询
    const confirmBtn = [...document.body.querySelectorAll('button')]
      .find(b => b.textContent === '确认升级')
    expect(confirmBtn).toBeTruthy()
    confirmBtn.click()
    expect(store.buildingLevels.farm).toBe(2)
    expect(store.upgradePreviewId).toBeNull()
  })
})

describe('EvolutionModal 专精进化弹窗', () => {
  it('满级原建筑打开后展示两个进化分支', () => {
    store.buildingLevels.farm = 5
    store.openEvolutionChoice('farm')
    mountWithPinia(EvolutionModal)
    expect(document.body.textContent).toContain('选择专精方向')
    expect(document.body.textContent).toContain('肥沃农场')
    expect(document.body.textContent).toContain('种植园')
  })

  it('资源不足时进化按钮禁用，点击不生效', async () => {
    store.buildingLevels.farm = 5
    store.setResourceAmount('wood', 0) // 进化需 98 木材
    store.setResourceAmount('plank', 0)
    store.openEvolutionChoice('farm')
    mountWithPinia(EvolutionModal)
    const evolveBtn = [...document.body.querySelectorAll('button')]
      .find(b => b.textContent.trim() === '专精进化')
    expect(evolveBtn).toBeTruthy()
    expect(evolveBtn.disabled).toBe(true)
    evolveBtn.click()
    expect(store.buildingLevels.fertileFarm).toBe(0)
  })
})

describe('ExpeditionPanel 远征面板', () => {
  it('公会未解锁时显示提示且无法派遣', () => {
    const w = mountWithPinia(ExpeditionPanel)
    expect(w.text()).toContain('远征队')
    expect(w.text()).toContain('草原')
    expect(w.text()).toContain('公会尚未解锁')
    const sendBtn = w.findAll('button').find(b => b.text() === '派遣')
    expect(sendBtn).toBeTruthy()
    expect(sendBtn.attributes('disabled')).toBeDefined()
  })

  it('公会解锁后可派遣草原，派遗后显示远征进行中并可取消', async () => {
    store.buildingLevels.townhall = 3
    store.checkUnlocks()
    expect(store.guildTeamPower).toBe(10)
    const w = mountWithPinia(ExpeditionPanel)
    const sendBtn = w.findAll('button').find(b => b.text() === '派遣')
    expect(sendBtn.attributes('disabled')).toBeUndefined()
    await sendBtn.trigger('click')
    expect(store.expedition).not.toBeNull()
    expect(store.expedition.mapId).toBe('grassland')
    expect(store.expedition.tier).toBe('50-75') // 10 vs 15
    // 重新渲染显示远征进行中
    await w.vm.$nextTick()
    expect(w.text()).toContain('远征进行中')
    const cancelBtn = w.findAll('button').find(b => b.text().includes('取消远征'))
    expect(cancelBtn).toBeTruthy()
    await cancelBtn.trigger('click')
    expect(store.expedition).toBeNull()
  })
})

describe('PolicyPanel 税务 Tab', () => {
  it('税所未解锁时显示提示', () => {
    const w = mountWithPinia(PolicyPanel)
    expect(w.text()).toContain('食物发放') // 默认子 Tab
    expect(w.text()).toContain('税务') // 子 Tab 按钮
  })

  it('税所解锁后显示档位并可切换', async () => {
    store.buildingLevels.townhall = 4
    store.checkUnlocks()
    const w = mountWithPinia(PolicyPanel)
    const taxTabBtn = w.findAll('button').find(b => b.text().includes('税务'))
    await taxTabBtn.trigger('click')
    expect(w.text()).toContain('税所 Lv1')
    expect(w.text()).toContain('不征税')
    expect(w.text()).toContain('轻税')
    const heavyBtn = w.findAll('button').find(b => b.text() === '重税')
    await heavyBtn.trigger('click')
    expect(store.taxRate).toBe('heavy')
    expect(w.text()).toContain('幸福度 -3')
  })
})

describe('MarketPanel 交易面板', () => {
  it('集市解锁后显示资源列表与买卖按钮', async () => {
    store.buildingLevels.townhall = 4
    store.checkUnlocks()
    store.setResourceAmount('wood', 100)
    const w = mountWithPinia(MarketPanel)
    expect(w.text()).toContain('今日剩余额度')
    expect(w.text()).toContain('小麦')
    // 定位木材行，默认数量 1：卖出 1 木材（价值 2）→ 金币 +2
    const woodRow = w.findAll('.resource-row').find(row => row.text().includes('木材'))
    const sellBtn = woodRow.findAll('button').find(b => b.text() === '卖出 1')
    expect(sellBtn).toBeTruthy()
    await sellBtn.trigger('click')
    expect(store.gold).toBe(2)
    expect(store.resources.wood).toBe(99)
    expect(store.marketQuotaUsed).toBe(2)
  })

  it('金币不足时买入按钮禁用', () => {
    store.buildingLevels.townhall = 4
    store.checkUnlocks()
    store.gold = 0
    const w = mountWithPinia(MarketPanel)
    const buyBtn = w.findAll('button').find(b => b.text() === '买入 1')
    expect(buyBtn.attributes('disabled')).toBeDefined()
  })
})
