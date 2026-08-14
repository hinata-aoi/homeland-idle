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
