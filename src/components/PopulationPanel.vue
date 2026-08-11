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
          🍞 每秒消耗 {{ store.fmt(store.foodConsumption) }} 食物值
        </div>
      </div>

      <!-- 食物槽进度条 -->
      <div style="margin-top:8px;">
        <div style="display:flex;justify-content:space-between;font-size:0.78em;color:var(--text-dim);">
          <span>📈 人口增长进度</span>
          <span>{{ store.fmt(store.foodValue) }} / {{ store.fmt(store.getGrowthNeeded(store.totalPopulation)) }}</span>
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
  const status = store.foodValueStatus
  if (status === 'deficit') return 'var(--red)'
  if (status === 'balanced') return 'var(--accent)'
  return 'var(--green)'
})

const growthHint = computed(() => {
  const status = store.foodValueStatus
  if (store.totalPopulation >= store.maxPopulation) return '已达人口上限，升级聚集地以容纳更多'
  const surplus = store.foodValueSurplus
  if (status === 'deficit') return `⚠️ 食物短缺 ${store.fmt(Math.abs(surplus))}/s，人口增长暂停，食物充足后恢复增长`
  if (status === 'balanced') return '食物供需平衡，人口稳定'
  return `食物盈余 +${store.fmt(surplus)}/s，人口正在增长`
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
