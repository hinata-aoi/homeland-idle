<template>
  <div>
    <!-- 仓库升级 -->
    <div class="panel">
      <h2>📦 仓库 Lv{{ store.warehouseLevel }}</h2>
      <p style="font-size:0.82em;color:var(--text-dim);margin-bottom:6px;">
        每种物资独立存储上限 · 升级为所有物资 +{{ store.fmt(250) }} 容量
      </p>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;">
        <span style="font-size:0.82em;color:var(--text-dim);">
          消耗 {{ store.fmt(store.warehouseUpgradeCost.amount) }} 木材
        </span>
        <button
          class="upgrade-btn"
          :disabled="(store.resources[store.warehouseUpgradeCost.resource] || 0) < store.warehouseUpgradeCost.amount"
          @click="store.upgradeWarehouse()"
        >
          扩建
        </button>
      </div>
    </div>

    <!-- 各物资容量详情 -->
    <div class="panel">
      <h2>📋 物资容量</h2>
      <div v-for="(def, key) in allRes" :key="key">
        <div class="resource-row">
          <span class="resource-icon">{{ def.icon }}</span>
          <span class="resource-name" style="flex:1;">{{ def.name }}</span>
          <span class="resource-amount" style="font-size:0.85em;">
            {{ store.fmt(getAmt(key)) }} / {{ store.fmt(store.getResourceCap(key)) }}
          </span>
        </div>
        <div class="progress-bar" style="width:100%;margin:1px 0 6px;">
          <div
            class="progress-fill"
            :style="{ width: getPct(key) + '%', background: getPct(key) > 90 ? 'var(--red)' : getPct(key) > 70 ? 'var(--accent)' : 'var(--green)' }"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useGameStore } from '../game/store.js'
import { BASIC_RESOURCES, REFINED_RESOURCES } from '../game/config.js'

const store = useGameStore()
const allRes = { ...BASIC_RESOURCES, ...REFINED_RESOURCES }

function getAmt(key) {
  return store.resources[key] ?? store.refined[key] ?? 0
}

function getPct(key) {
  const cap = store.getResourceCap(key)
  if (cap === 0) return 0
  return Math.min(100, (getAmt(key) / cap) * 100)
}
</script>
