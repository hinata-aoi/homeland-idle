<template>
  <div>
    <div class="panel" v-for="b in store.productionBuildings" :key="b.id">
      <div class="resource-row">
        <span class="resource-icon">{{ b.icon }}</span>
        <span class="resource-name">
          {{ b.name }}
          <span style="color:var(--text-dim);font-size:0.78em;font-weight:400;"> · {{ b.description }}</span>
          <span class="milestone-badge" v-if="b.level >= 5">Lv{{ b.level }}</span>
          <span v-else style="color:var(--text-dim);font-size:0.8em;"> Lv{{ b.level }}</span>
          <span class="tag" style="margin-left:4px;">生产</span>
          <span v-if="b.evolvedOnly" class="tag" style="margin-left:4px;background:var(--accent);color:#1a1a2e;">专精</span>
        </span>
        <span class="resource-amount">
          {{ store.fmt(b.resourceAmount) }}
          <span style="font-size:0.7em;color:var(--text-dim);"> / {{ store.fmt(b.resourceCap) }}</span>
        </span>
      </div>

      <!-- 容量条（主产出物） -->
      <div class="progress-bar" style="width:100%;margin:2px 0;">
        <div class="progress-fill" :style="{ width: b.resourcePct + '%', background: b.resourcePct > 90 ? 'var(--red)' : b.resourcePct > 70 ? 'var(--accent)' : 'var(--green)' }"></div>
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

      <!-- 产出与速度（空闲时速率显示为红色 0） -->
      <div class="resource-row" style="font-size:0.82em; color:var(--text-dim);">
        <span>产出</span>
        <span class="resource-rate" :style="b.assigned === 0 ? 'color:var(--red);' : ''">
          <span v-for="o in b.outputs" :key="o.resource" style="margin-left:6px;">
            {{ resName(o.resource) }} +{{ store.fmt(o.ratePerSec) }}/s
          </span>
        </span>
      </div>

      <!-- 配方选择器（多配方建筑） -->
      <div v-if="b.recipes.length > 1" style="margin-top:4px;display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
        <span style="font-size:0.75em;color:var(--text-dim);">配方:</span>
        <button
          v-for="r in b.recipes" :key="r.id"
          class="btn-sm"
          :class="{ 'recipe-active': r.id === b.recipe.id }"
          :disabled="!recipeAvailable(b, r)"
          :title="recipeAvailable(b, r) ? '' : 'Lv' + r.unlockAt + ' 解锁'"
          style="padding:0 8px;line-height:1.6;font-size:0.78em;"
          @click="store.setActiveRecipe(b.id, r.id)">
          {{ r.name }}
        </button>
      </div>

      <div v-if="b.nextMilestone" style="font-size:0.75em;color:var(--text-dim);margin-top:4px;">
        🎯 Lv{{ b.nextMilestone.level }}: {{ b.nextMilestone.desc }}
      </div>

      <div style="margin-top:6px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;">
        <span v-if="b.maxLevel && b.level >= b.maxLevel && !b.evolvedOnly && b.canEvolve" style="font-size:0.78em;color:var(--accent);">
          已达 Lv{{ b.level }} — 可专精进化
        </span>
        <span v-else-if="b.maxLevel && b.level >= b.maxLevel" style="font-size:0.78em;color:var(--text-dim);">
          已达 Lv{{ b.maxLevel }} 上限
        </span>
        <span v-else style="font-size:0.78em;color:var(--text-dim);">
          升级 {{ b.upgradeCost.primary.amount }} {{ resName(b.upgradeCost.primary.resource) }}
          <template v-if="b.upgradeCost.secondary">
            + {{ b.upgradeCost.secondary.amount }} {{ resName(b.upgradeCost.secondary.resource) }}
          </template>
        </span>
        <!-- 原建筑 Lv5 满级：专精按钮（成本 = 原建筑 Lv5→Lv6） -->
        <button v-if="b.maxLevel && b.level >= b.maxLevel && !b.evolvedOnly && b.canEvolve"
          class="upgrade-btn evolve-btn"
          @click="store.openEvolutionChoice(b.id)">
          专精
        </button>
        <!-- 进化建筑：回退到原建筑 Lv1（免费） -->
        <button v-else-if="b.evolvedOnly && b.evolvedFrom"
          class="upgrade-btn revert-btn"
          title="免费回退到原建筑 Lv1"
          @click="store.revertBuilding(b.id)">
          ↩ 回退
        </button>
        <!-- 进化建筑 Lv10 满级 -->
        <button v-else-if="b.maxLevel && b.level >= b.maxLevel"
          class="upgrade-btn" disabled style="background:#555;color:#999;">已满级</button>
        <button v-else class="upgrade-btn"
          @click="store.openUpgradePreview(b.id)">
          升级
        </button>
      </div>
    </div>

    <!-- 未解锁 -->
    <div class="panel" v-if="store.lockedProductionBuildings.length > 0">
      <h2>🔒 未解锁</h2>
      <div v-for="b in store.lockedProductionBuildings" :key="b.id" style="font-size:0.82em;color:var(--text-dim);padding:3px 0;">
        {{ b.icon }} {{ b.name }} — {{ b.description }}
        <span style="color:var(--accent);">（{{ b.unlockReq }} 解锁）</span>
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

// 配方是否已达解锁等级
function recipeAvailable(b, r) {
  return b.level >= (r.unlockAt || 0)
}
</script>
