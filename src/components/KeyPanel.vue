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
          <span class="milestone-badge" v-if="b.level >= 5">Lv{{ b.level }}</span>
          <span v-else style="color:var(--text-dim);font-size:0.8em;"> Lv{{ b.level }}</span>
          <span class="tag" style="margin-left:4px;">关键</span>
        </span>
        <span style="font-size:0.82em;color:var(--text-dim);">
          +{{ b.maxPopBase + (b.level - 1) * b.maxPopPerLevel }} 人口上限
        </span>
      </div>

      <div style="font-size:0.82em;color:var(--text-dim);margin:2px 0;">
        {{ b.description }}
      </div>

      <div v-if="b.nextMilestone" style="font-size:0.75em;color:var(--text-dim);margin-top:2px;">
        🎯 Lv{{ b.nextMilestone.level }}: {{ b.nextMilestone.desc }}
      </div>

      <div style="margin-top:6px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:0.78em;color:var(--text-dim);">
          升级消耗 {{ b.upgradeCost.amount }} {{ store.BASIC_RESOURCES[b.upgradeCost.resource]?.name }}
        </span>
        <button class="upgrade-btn"
          :disabled="(store.resources[b.upgradeCost.resource] || 0) < b.upgradeCost.amount"
          @click="store.upgradeBuilding(b.id)">
          升级
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useGameStore } from '../game/store.js'
const store = useGameStore()
</script>
