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

    <!-- 主布局：左侧标签栏 + 右侧内容区 -->
    <div class="main-layout">
      <nav class="tab-bar">
        <button :class="{ active: tab === 'production' }" @click="tab = 'production'">🏭<br>生产</button>
        <button :class="{ active: tab === 'processing' }" @click="tab = 'processing'">
          🔧<br>加工
          <span v-if="store.unlockedProcessingBuildings.length > 0" class="tag" style="background:var(--accent);color:#1a1a2e;margin-left:2px;">{{ store.unlockedProcessingBuildings.length }}</span>
        </button>
        <button :class="{ active: tab === 'key' }" @click="tab = 'key'">🔑<br>关键</button>
        <button :class="{ active: tab === 'expedition' }" @click="tab = 'expedition'">⚔️<br>远征</button>
        <button :class="{ active: tab === 'population' }" @click="tab = 'population'">👥<br>人口</button>
        <button :class="{ active: tab === 'policy' }" @click="tab = 'policy'">📜<br>政策</button>
        <button :class="{ active: tab === 'warehouse' }" @click="tab = 'warehouse'">📦<br>仓库</button>
        <button :class="{ active: tab === 'settings' }" @click="tab = 'settings'">⚙️<br>设置</button>
      </nav>

      <div class="content-area">
        <ProductionPanel v-if="tab === 'production'" />
        <ProcessingPanel v-if="tab === 'processing'" />
        <KeyPanel v-if="tab === 'key'" />
        <ExpeditionPanel v-if="tab === 'expedition'" />
        <PopulationPanel v-if="tab === 'population'" />
        <PolicyPanel v-if="tab === 'policy'" />
        <WarehousePanel v-if="tab === 'warehouse'" />
        <SettingsPanel v-if="tab === 'settings'" />
      </div>
    </div>
    <OfflineModal />
    <UpgradeModal />
    <EvolutionModal />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useGameStore } from './game/store.js'
import ProductionPanel from './components/ProductionPanel.vue'
import ProcessingPanel from './components/ProcessingPanel.vue'
import PopulationPanel from './components/PopulationPanel.vue'
import KeyPanel from './components/KeyPanel.vue'
import ExpeditionPanel from './components/ExpeditionPanel.vue'
import PolicyPanel from './components/PolicyPanel.vue'
import WarehousePanel from './components/WarehousePanel.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import OfflineModal from './components/OfflineModal.vue'
import UpgradeModal from './components/UpgradeModal.vue'
import EvolutionModal from './components/EvolutionModal.vue'

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
