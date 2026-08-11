<template>
  <div>
    <div v-if="store.keyBuildings.length === 0" class="panel" style="text-align:center;color:var(--text-dim);">
      暂无关键建筑
    </div>

    <div class="panel" v-for="b in store.keyBuildings" :key="b.id">
      <div class="resource-row">
        <span class="resource-icon">{{ b.icon }}</span>
        <span class="resource-name">
          {{ b.name }}
          <span style="color:var(--text-dim);font-size:0.78em;font-weight:400;"> · {{ b.description }}</span>
          <span class="milestone-badge" v-if="b.level >= 5">Lv{{ b.level }}</span>
          <span v-else style="color:var(--text-dim);font-size:0.8em;"> Lv{{ b.level }}</span>
          <span class="tag" style="margin-left:4px;">关键</span>
        </span>
        <span v-if="b.maxPopBase" style="font-size:0.82em;color:var(--text-dim);">
          +{{ b.maxPopBase + (b.level - 1) * b.maxPopPerLevel }} 人口上限
        </span>
        <span v-else-if="b.passiveFood" style="font-size:0.82em;color:var(--text-dim);">
          食物 +{{ b.passiveFood }}/s
        </span>
      </div>

      <div v-if="b.nextMilestone" style="font-size:0.75em;color:var(--text-dim);margin-top:2px;">
        🎯 Lv{{ b.nextMilestone.level }}: {{ b.nextMilestone.desc }}
      </div>

      <div style="margin-top:6px;display:flex;justify-content:space-between;align-items:center;">
        <span v-if="b.maxLevel && b.level >= b.maxLevel" style="font-size:0.78em;color:var(--text-dim);">
          已达 Lv{{ b.maxLevel }} 上限
        </span>
        <span v-else style="font-size:0.78em;color:var(--text-dim);">
          升级消耗 {{ b.upgradeCost.primary.amount }} {{ resName(b.upgradeCost.primary.resource) }}
          <template v-if="b.upgradeCost.secondary">
            + {{ b.upgradeCost.secondary.amount }} {{ resName(b.upgradeCost.secondary.resource) }}
          </template>
        </span>
        <button v-if="b.maxLevel && b.level >= b.maxLevel"
          class="upgrade-btn" disabled style="background:#555;color:#999;">已满级</button>
        <button v-else class="upgrade-btn"
          :disabled="!canAfford(b.upgradeCost)"
          @click="store.openUpgradePreview(b.id)">
          升级
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useGameStore } from '../game/store.js'
const store = useGameStore()

function resName(key) {
  return store.ALL_RESOURCES[key]?.name || key
}

function canAfford(cost) {
  if (store.getResourceAmount(cost.primary.resource) < cost.primary.amount) return false
  if (cost.secondary && store.getResourceAmount(cost.secondary.resource) < cost.secondary.amount) return false
  return true
}
</script>
