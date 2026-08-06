<template>
  <div class="game-container">
    <!-- 顶部标题栏 -->
    <header class="panel header">
      <h1>🏡 家园</h1>
      <div class="header-stats">
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
          <span>人口：{{ store.totalPopulation }}/{{ store.maxPopulation }}</span>
          <span :class="{ warning: store.totalPercent > 80, danger: store.totalPercent >= 99 }">
            📦 {{ store.fmt(store.totalUsed) }}/{{ store.fmt(store.totalCapacity) }}
          </span>
        </div>
        <div class="progress-bar" style="width:100%">
          <div class="progress-fill" :style="{ width: store.totalPercent + '%' }"></div>
        </div>
      </div>
    </header>

    <!-- 标签栏 -->
    <nav class="tab-bar">
      <button :class="{ active: tab === 'production' }" @click="tab = 'production'">🏭 生产</button>
      <button :class="{ active: tab === 'processing' }" @click="tab = 'processing'">
        🔧 加工
        <span v-if="store.unlockedProcessingBuildings.length > 0" class="tag" style="background:var(--accent);color:#1a1a2e;margin-left:4px;">{{ store.unlockedProcessingBuildings.length }}</span>
      </button>
      <button :class="{ active: tab === 'key' }" @click="tab = 'key'">🔑 关键</button>
      <button :class="{ active: tab === 'population' }" @click="tab = 'population'">👥 人口</button>
      <button :class="{ active: tab === 'policy' }" @click="tab = 'policy'">📜 政策</button>
      <button :class="{ active: tab === 'warehouse' }" @click="tab = 'warehouse'">📦 仓库</button>
      <button :class="{ active: tab === 'settings' }" @click="tab = 'settings'">⚙️</button>
    </nav>

    <ProductionPanel v-if="tab === 'production'" />
    <ProcessingPanel v-if="tab === 'processing'" />
    <KeyPanel v-if="tab === 'key'" />
    <PopulationPanel v-if="tab === 'population'" />
    <PolicyPanel v-if="tab === 'policy'" />
    <WarehousePanel v-if="tab === 'warehouse'" />
    <SettingsPanel v-if="tab === 'settings'" />
    <OfflineModal />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useGameStore } from './game/store.js'
import ProductionPanel from './components/ProductionPanel.vue'
import ProcessingPanel from './components/ProcessingPanel.vue'
import PopulationPanel from './components/PopulationPanel.vue'
import KeyPanel from './components/KeyPanel.vue'
import PolicyPanel from './components/PolicyPanel.vue'
import WarehousePanel from './components/WarehousePanel.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import OfflineModal from './components/OfflineModal.vue'

const store = useGameStore()
const tab = ref('production')

onMounted(() => {
  const hasSave = store.load()
  if (!hasSave) {
    store.initNewGame()
  }
  store.startTick()
})
</script>
