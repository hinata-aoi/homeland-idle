<template>
  <div>
    <!-- 顶部：金币 + 每日额度 -->
    <div class="panel">
      <h2>🛒 集市</h2>
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
        <span style="font-size:0.95em;">
          🪙 金币：<strong style="color:var(--accent);">{{ store.fmt(store.gold) }}</strong>
        </span>
        <span style="font-size:0.82em;color:var(--text-dim);">
          今日剩余额度 <strong :style="{ color: quotaLow ? 'var(--red)' : 'var(--text)' }">{{ store.fmt(store.marketQuotaRemaining) }}</strong> / {{ store.fmt(store.MARKET_CONFIG.dailyQuotaGold) }}
        </span>
      </div>
      <div style="font-size:0.75em;color:var(--text-dim);margin-top:6px;">
        💡 卖出资源按 1× 价值换金币；买入资源按 1.5× 溢价（受仓库容量限制）。每日额度本地时间 0:00 刷新。
      </div>

      <!-- 每次交易数量 -->
      <div style="display:flex;align-items:center;gap:6px;margin-top:8px;">
        <span style="font-size:0.8em;color:var(--text-dim);">每次交易</span>
        <button v-for="n in store.MARKET_CONFIG.tradeAmounts" :key="n"
          class="btn-sm"
          :class="{ 'recipe-active': qty === n }"
          @click="qty = n">{{ n }}</button>
      </div>
    </div>

    <!-- 资源交易列表（基础资源） -->
    <div class="panel">
      <h2>📦 基础资源</h2>
      <div v-for="(def, key) in basicRes" :key="key" class="resource-row" style="flex-wrap:wrap;gap:4px;">
        <span class="resource-icon">{{ def.icon }}</span>
        <span class="resource-name">
          {{ def.name }}
          <span style="color:var(--text-dim);font-size:0.75em;">
            · 库存 {{ store.fmt(store.getResourceAmount(key)) }}/{{ store.fmt(store.getResourceCap(key)) }}
          </span>
        </span>
        <span style="font-size:0.75em;color:var(--text-dim);">
          卖 {{ store.getResourceValue(key) }} 🪙 / 买 {{ buyPrice(key) }} 🪙
        </span>
        <div style="display:flex;gap:4px;width:100%;justify-content:flex-end;">
          <button class="btn-sm sell-btn" :disabled="!canSell(key)" @click="store.sellResource(key, qty)">卖出 {{ qty }}</button>
          <button class="btn-sm buy-btn" :disabled="!canBuy(key)" @click="store.buyResource(key, qty)">买入 {{ qty }}</button>
        </div>
      </div>
    </div>

    <!-- 资源交易列表（精炼资源） -->
    <div class="panel">
      <h2>🏭 精炼资源</h2>
      <div v-for="(def, key) in refinedRes" :key="key" class="resource-row" style="flex-wrap:wrap;gap:4px;">
        <span class="resource-icon">{{ def.icon }}</span>
        <span class="resource-name">
          {{ def.name }}
          <span style="color:var(--text-dim);font-size:0.75em;">
            · 库存 {{ store.fmt(store.getResourceAmount(key)) }}/{{ store.fmt(store.getResourceCap(key)) }}
          </span>
        </span>
        <span style="font-size:0.75em;color:var(--text-dim);">
          卖 {{ store.getResourceValue(key) }} 🪙 / 买 {{ buyPrice(key) }} 🪙
        </span>
        <div style="display:flex;gap:4px;width:100%;justify-content:flex-end;">
          <button class="btn-sm sell-btn" :disabled="!canSell(key)" @click="store.sellResource(key, qty)">卖出 {{ qty }}</button>
          <button class="btn-sm buy-btn" :disabled="!canBuy(key)" @click="store.buyResource(key, qty)">买入 {{ qty }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useGameStore } from '../game/store.js'
import { BASIC_RESOURCES, REFINED_RESOURCES } from '../game/config.js'

const store = useGameStore()

const basicRes = BASIC_RESOURCES
const refinedRes = REFINED_RESOURCES

// 每次交易数量（1/10/100）
const qty = ref(1)

const quotaLow = computed(() => store.marketQuotaRemaining <= 0)

// 买入单价：ceil(价值 × 1.5)
function buyPrice(key) {
  return Math.ceil(store.getResourceValue(key) * store.MARKET_CONFIG.buyMarkup)
}

function canSell(key) {
  if ((store.buildingLevels.market || 0) < 1) return false
  if (store.getResourceAmount(key) < qty.value) return false
  const gain = store.getResourceValue(key) * qty.value
  return gain > 0 && store.marketQuotaRemaining >= gain
}

function canBuy(key) {
  if ((store.buildingLevels.market || 0) < 1) return false
  const cost = buyPrice(key) * qty.value
  if (store.gold < cost) return false
  if (store.marketQuotaRemaining < cost) return false
  // 容量：整批买入不超上限
  return store.getResourceAmount(key) + qty.value <= store.getResourceCap(key)
}
</script>

<style scoped>
.sell-btn { background: var(--green); color: #fff; }
.buy-btn { background: var(--accent); color: #1a1a2e; }
</style>
