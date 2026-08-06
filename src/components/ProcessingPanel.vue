<template>
  <div>
    <div v-if="store.unlockedProcessingBuildings.length === 0" class="panel" style="text-align:center;color:var(--text-dim);">
      <p>🔒 尚无可用加工建筑</p>
      <p style="font-size:0.8em;">将生产建筑升至对应等级以解锁加工建筑</p>
    </div>

    <div class="panel" v-for="b in store.unlockedProcessingBuildings" :key="b.id">
      <div class="resource-row">
        <span class="resource-icon">{{ b.icon }}</span>
        <span class="resource-name">
          {{ b.name }}
          <span class="milestone-badge" v-if="b.level >= 5">Lv{{ b.level }}</span>
          <span v-else style="color:var(--text-dim);font-size:0.8em;"> Lv{{ b.level }}</span>
          <span class="tag" style="margin-left:4px;">加工</span>
        </span>
        <span style="font-size:0.82em;color:var(--text-dim);">
          {{ b.effectiveInput }}{{ getResName(b.input.resource) }} → {{ b.effectiveOutput }}{{ getResName(b.output.resource) }}
        </span>
      </div>

      <!-- 人口槽位 -->
      <div style="display:flex;align-items:center;gap:6px;font-size:0.78em;margin:2px 0;">
        <button class="btn-sm" style="padding:0 6px;line-height:1.4;"
          :disabled="b.assigned <= 0"
          @click="store.unassignPop(b.id)">-</button>
        <span style="font-weight:600;min-width:1.5em;text-align:center;">{{ b.assigned }}</span>
        <button class="btn-sm" style="padding:0 6px;line-height:1.4;"
          :disabled="b.assigned >= b.slots || store.unassignedPopulation <= 0"
          @click="store.assignPop(b.id)">+</button>
        <span style="color:var(--text-dim);margin-left:4px;">/ {{ b.slots }}</span>
        <span v-if="b.assigned === 0" style="color:var(--red);">（闲置中）</span>
      </div>

      <div style="font-size:0.75em;color:var(--text-dim);margin:2px 0;">
        📤 {{ getResName(b.output.resource) }} 库存: {{ store.fmt(b.outputAmount) }}/{{ store.fmt(b.outputCap) }}
        <span v-if="b.outputAmount >= b.outputCap" style="color:var(--red);">（已满）</span>
      </div>

      <div v-if="b.nextMilestone" style="font-size:0.75em;color:var(--text-dim);margin-top:2px;">
        🎯 Lv{{ b.nextMilestone.level }}: {{ b.nextMilestone.desc }}
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;flex-wrap:wrap;gap:4px;">
        <span style="font-size:0.78em;">
          📥 {{ getResName(b.input.resource) }}: {{ store.fmt(b.inputAmount) }}
          <span v-if="b.assigned === 0" style="color:var(--red);">（无人值守）</span>
          <span v-else-if="b.inputAmount < b.effectiveInput" style="color:var(--red);">（还需 {{ store.fmt(b.effectiveInput - b.inputAmount) }}）</span>
          <span v-else-if="b.outputAmount >= b.outputCap" style="color:var(--red);">（产物已满）</span>
        </span>
        <div style="display:flex;gap:4px;">
          <button class="btn-sm btn-green" :disabled="!b.canProcess" @click="store.processBuilding(b.id)">加工</button>
          <button class="upgrade-btn"
            :disabled="(store.resources[b.upgradeCost.resource] || 0) < b.upgradeCost.amount"
            @click="store.upgradeBuilding(b.id)">升级 {{ b.upgradeCost.amount }}</button>
        </div>
      </div>
    </div>

    <!-- 未解锁 -->
    <div class="panel" v-if="store.lockedProcessingBuildings.length > 0">
      <h2>🔒 未解锁</h2>
      <div v-for="b in store.lockedProcessingBuildings" :key="b.id" style="font-size:0.82em;color:var(--text-dim);padding:3px 0;">
        {{ b.icon }} {{ b.name }} — {{ b.description }}
        <span style="color:var(--accent);">（{{ b.unlockReq }} 解锁）</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useGameStore } from '../game/store.js'
const store = useGameStore()

function getResName(key) {
  return store.ALL_RESOURCES[key]?.name || key
}
</script>
