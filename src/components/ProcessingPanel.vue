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
          <span style="color:var(--text-dim);font-size:0.78em;font-weight:400;"> · {{ b.description }}</span>
          <span class="milestone-badge" v-if="b.level >= 5">Lv{{ b.level }}</span>
          <span v-else style="color:var(--text-dim);font-size:0.8em;"> Lv{{ b.level }}</span>
          <span class="tag" style="margin-left:4px;">加工</span>
          <span v-if="b.evolvedOnly" class="tag" style="margin-left:4px;background:var(--accent);color:#1a1a2e;">专精</span>
        </span>
        <span style="font-size:0.82em;color:var(--text-dim);">
          {{ b.inputSummary }} → {{ b.outputSummary }}
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
        <span v-for="(o, idx) in b.outputsAmount" :key="o.resource">
          📤 {{ getResName(o.resource) }}: {{ store.fmt(o.amount) }}/{{ store.fmt(o.cap) }}
          <span v-if="o.amount >= o.cap" style="color:var(--red);">（已满）</span>
          <span v-if="idx < b.outputsAmount.length - 1" style="opacity:0.5;"> · </span>
        </span>
      </div>

      <div v-if="b.nextMilestone" style="font-size:0.75em;color:var(--text-dim);margin-top:2px;">
        🎯 Lv{{ b.nextMilestone.level }}: {{ b.nextMilestone.desc }}
      </div>

      <!-- 加工速度（始终显示；无人值守时为红色 0）+ 批次进度 -->
      <div style="margin-top:4px;">
        <div style="display:flex;justify-content:space-between;font-size:0.72em;color:var(--text-dim);">
          <span>⚙️ 加工速度: <span :style="b.assigned === 0 ? 'color:var(--red);' : ''">{{ store.fmt(b.processRate) }} 批/s</span></span>
          <span v-if="b.assigned > 0">{{ Math.floor(b.progressPct) }}%</span>
        </div>
        <div v-if="b.assigned > 0" class="progress-bar" style="width:100%;margin:2px 0;">
          <div class="progress-fill" :style="{ width: b.progressPct + '%' }"></div>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;flex-wrap:wrap;gap:4px;">
        <span style="font-size:0.78em;">
          <span v-for="(inp, idx) in b.inputsAmount" :key="inp.resource" style="white-space:nowrap;">
            📥 {{ getResName(inp.resource) }}: {{ store.fmt(inp.amount) }}
            <span v-if="b.assigned > 0 && inp.amount < inp.needed" style="color:var(--red);">（需{{ store.fmt(inp.needed) }}）</span>
            <span v-if="idx < b.inputsAmount.length - 1" style="opacity:0.5;"> · </span>
          </span>
          <span v-if="b.assigned === 0" style="color:var(--red);">（无人值守）</span>
          <span v-else-if="!b.allInputsMet" style="color:var(--red);">（原料不足）</span>
          <span v-else-if="b.outputsFull" style="color:var(--red);">（产物已满）</span>
        </span>
        <span v-if="b.maxLevel && b.level >= b.maxLevel && !b.evolvedOnly" style="font-size:0.72em;color:var(--accent);">
          已达 Lv{{ b.level }} — 可专精进化
        </span>
        <span v-else-if="b.maxLevel && b.level >= b.maxLevel" style="font-size:0.72em;color:var(--text-dim);">
          已达 Lv{{ b.maxLevel }} 上限
        </span>
        <span v-else style="font-size:0.72em;color:var(--text-dim);">
          升级 {{ b.upgradeCost.primary.amount }} {{ getResName(b.upgradeCost.primary.resource) }}
          <template v-if="b.upgradeCost.secondary">
            + {{ b.upgradeCost.secondary.amount }} {{ getResName(b.upgradeCost.secondary.resource) }}
          </template>
        </span>
        <!-- 原建筑 Lv5 满级：专精按钮 -->
        <button v-if="b.maxLevel && b.level >= b.maxLevel && !b.evolvedOnly"
          class="upgrade-btn evolve-btn"
          :disabled="!canAfford(b.upgradeCost)"
          @click="store.openEvolutionChoice(b.id)">专精</button>
        <!-- 进化建筑：回退按钮 -->
        <button v-else-if="b.evolvedOnly && b.evolvedFrom"
          class="upgrade-btn revert-btn"
          title="免费回退到原建筑 Lv1"
          @click="store.revertBuilding(b.id)">↩ 回退</button>
        <!-- 进化建筑 Lv10 满级 -->
        <button v-else-if="b.maxLevel && b.level >= b.maxLevel"
          class="upgrade-btn" disabled style="background:#555;color:#999;">已满级</button>
        <button v-else class="upgrade-btn"
          :disabled="!canAfford(b.upgradeCost)"
          @click="store.openUpgradePreview(b.id)">升级</button>
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

function canAfford(cost) {
  if (store.getResourceAmount(cost.primary.resource) < cost.primary.amount) return false
  if (cost.secondary && store.getResourceAmount(cost.secondary.resource) < cost.secondary.amount) return false
  return true
}
</script>
