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

    <!-- 各物资容量详情：小方框网格展示 -->
    <div class="panel">
      <h2>📋 物资容量</h2>
      <div class="resource-grid">
        <div
          v-for="(def, key) in allRes"
          :key="key"
          class="resource-box"
          :class="boxClass(key)"
        >
          <span class="box-icon">{{ def.icon }}</span>
          <span class="box-name">{{ def.name }}</span>
          <span class="box-amount">{{ store.fmt(getAmt(key)) }}/<span class="box-cap">{{ store.fmt(store.getResourceCap(key)) }}</span></span>
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

// 存量比例 → 警示等级：>90% 已满(红)，>70% 接近满(金)，否则正常
function boxClass(key) {
  const cap = store.getResourceCap(key)
  if (cap <= 0) return 'normal'
  const pct = (getAmt(key) / cap) * 100
  if (pct > 90) return 'full'
  if (pct > 70) return 'high'
  return 'normal'
}
</script>

<style scoped>
.resource-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
  gap: 8px;
}

.resource-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 10px 4px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  transition: border-color 0.15s;
}

.resource-box.high {
  border-color: var(--accent);
}

.resource-box.full {
  border-color: var(--red);
}

.box-icon {
  font-size: 1.5em;
  line-height: 1.2;
}

.box-name {
  font-size: 0.75em;
  color: var(--text-dim);
  white-space: nowrap;
}

.box-amount {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  font-family: "SF Mono", "Consolas", "Microsoft YaHei", monospace;
  font-size: 0.82em;
}

.box-cap {
  font-size: 0.78em;
  color: var(--text-dim);
  font-weight: 400;
}
</style>
