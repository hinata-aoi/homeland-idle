<template>
  <div>
    <!-- 人口总览 -->
    <div class="panel">
      <h2>人口</h2>
      <div style="text-align:center;margin:10px 0;">
        <div style="font-size:2em;font-weight:700;color:var(--accent);">
          {{ store.totalPopulation }} <span style="font-size:0.5em;color:var(--text-dim);">/ {{ store.maxPopulation }}</span>
        </div>
        <div style="font-size:0.85em;color:var(--text-dim);margin-top:4px;">
          🧑 空闲: {{ store.unassignedPopulation }}
          &nbsp;·&nbsp;
          🍞 每秒消耗 {{ store.fmt(store.foodConsumption) }} 食物
        </div>
      </div>

      <!-- 增长进度条 -->
      <div style="margin-top:8px;">
        <div style="display:flex;justify-content:space-between;font-size:0.78em;color:var(--text-dim);">
          <span>📈 人口增长</span>
          <span>{{ store.fmt(store.growthProgress) }} / {{ store.fmt(100) }}</span>
        </div>
        <div class="progress-bar" style="width:100%;margin:4px 0;">
          <div
            class="progress-fill"
            :style="{ width: store.growthPercent + '%', background: growthColor }"
          ></div>
        </div>
        <div style="font-size:0.72em;color:var(--text-dim);text-align:center;">
          {{ growthHint }}
        </div>
      </div>
    </div>

    <!-- 人口分配一览 -->
    <div class="panel">
      <h2>📋 人口分配</h2>
      <div v-if="assignments.length === 0" style="font-size:0.85em;color:var(--text-dim);text-align:center;">
        暂无已分配人口的建筑
      </div>
      <div v-for="a in assignments" :key="a.id" class="resource-row">
        <span class="resource-icon">{{ a.icon }}</span>
        <span class="resource-name" style="flex:1;">{{ a.name }}</span>
        <span style="font-size:0.82em;">
          <span v-for="i in a.slots" :key="i" :style="{ color: i <= a.assigned ? 'var(--accent)' : 'var(--border)', margin:'0 1px' }">👤</span>
          <span style="color:var(--text-dim);margin-left:4px;">{{ a.assigned }}/{{ a.slots }}</span>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useGameStore } from '../game/store.js'
import { BUILDINGS } from '../game/config.js'

const store = useGameStore()

const growthColor = computed(() => {
  const food = store.resources.food || 0
  const cap = store.getResourceCap('food')
  if (cap === 0) return 'var(--red)'
  if (food / cap < 0.1) return 'var(--red)'
  if (food / cap < 0.3) return 'var(--accent)'
  return 'var(--green)'
})

const growthHint = computed(() => {
  const food = store.resources.food || 0
  const cap = store.getResourceCap('food')
  if (cap === 0) return '—'
  const ratio = food / cap
  if (ratio < 0.1) return '⚠️ 食物严重不足，人口正在减少'
  if (ratio < 0.3) return '食物紧张，增长缓慢'
  if (ratio < 0.5) return '食物稳定，人口正在增长'
  if (store.totalPopulation >= store.maxPopulation) return '已达人口上限，升级聚集地以容纳更多'
  return '食物充裕，人口快速增长'
})

const assignments = computed(() => {
  return BUILDINGS
    .filter(b => b.populationSlots && (store.buildingLevels[b.id] || 0) > 0)
    .map(b => ({
      id: b.id,
      name: b.name,
      icon: b.icon,
      assigned: store.getAssignedPop(b.id),
      slots: store.getBuildingSlots(b.id),
    }))
})
</script>
