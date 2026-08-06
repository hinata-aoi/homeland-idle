<template>
  <div>
    <div class="panel" v-for="b in store.productionBuildings" :key="b.id">
      <div class="resource-row">
        <span class="resource-icon">{{ b.icon }}</span>
        <span class="resource-name">
          {{ b.name }}
          <span class="milestone-badge" v-if="b.level >= 5">Lv{{ b.level }}</span>
          <span v-else style="color:var(--text-dim);font-size:0.8em;"> Lv{{ b.level }}</span>
          <span class="tag" style="margin-left:4px;">生产</span>
        </span>
        <span class="resource-amount">
          {{ store.fmt(b.resourceAmount) }}
          <span style="font-size:0.7em;color:var(--text-dim);"> / {{ store.fmt(b.resourceCap) }}</span>
        </span>
      </div>

      <!-- 容量条 -->
      <div class="progress-bar" style="width:100%;margin:2px 0;">
        <div class="progress-fill" :style="{ width: b.resourcePct + '%', background: b.resourcePct > 90 ? 'var(--red)' : b.resourcePct > 70 ? 'var(--accent)' : 'var(--green)' }"></div>
      </div>

      <!-- 人口槽位 -->
      <div style="display:flex;align-items:center;gap:6px;font-size:0.78em;margin:2px 0;">
        <span v-for="i in b.slots" :key="i" style="cursor:pointer;" @click="toggleSlot(b.id, i)" :title="i <= b.assigned ? '点击撤出' : '点击派驻'">
          {{ i <= b.assigned ? '👤' : '⚫' }}
        </span>
        <span style="color:var(--text-dim);margin-left:4px;">{{ b.assigned }}/{{ b.slots }}</span>
        <span v-if="b.assigned === 0" style="color:var(--red);">（闲置中）</span>
      </div>

      <div class="resource-row" style="font-size:0.82em; color:var(--text-dim);">
        <span></span>
        <span>{{ b.description }}</span>
        <span class="resource-rate">
          <span v-if="b.assigned === 0" style="color:var(--red);">0/s</span>
          <span v-else>+{{ store.fmt(b.rate) }}/s</span>
        </span>
      </div>

      <div v-if="b.nextMilestone" style="font-size:0.75em;color:var(--text-dim);margin-top:4px;">
        🎯 Lv{{ b.nextMilestone.level }}: {{ b.nextMilestone.desc }}
      </div>

      <div style="margin-top:6px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:0.78em;color:var(--text-dim);">
          升级 {{ b.upgradeCost.amount }} {{ store.BASIC_RESOURCES[b.upgradeCost.resource]?.name }}
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

function toggleSlot(buildingId, slotNum) {
  const assigned = store.getAssignedPop(buildingId)
  if (slotNum <= assigned) {
    store.unassignPop(buildingId)
  } else {
    store.assignPop(buildingId)
  }
}
</script>
