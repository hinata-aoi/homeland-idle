<template>
  <div>
    <!-- 食物值总览 -->
    <div class="panel">
      <h2>📜 政策</h2>
      <div style="text-align:center;margin:10px 0;">
        <div style="font-size:2em;font-weight:700;color:var(--accent);">
          {{ store.fmt(store.foodValue) }}
        </div>
        <div style="font-size:0.85em;color:var(--text-dim);margin-top:4px;">
          当前食物值
          &nbsp;·&nbsp;
          🍞 每秒消耗 {{ store.fmt(store.foodConsumption) }}
          &nbsp;·&nbsp;
          净变化:
          <span :style="{ color: netChange >= 0 ? 'var(--green)' : 'var(--red)' }">
            {{ netChange >= 0 ? '+' : '' }}{{ store.fmt(netChange) }}/s
          </span>
        </div>
      </div>
    </div>

    <!-- 转化政策 -->
    <div class="panel" v-for="c in store.POLICY_CONFIG.conversions" :key="c.input">
      <div class="resource-row">
        <span class="resource-icon">{{ getResIcon(c.input) }}</span>
        <span class="resource-name">{{ c.name || (getResName(c.input) + '转化') }}</span>
        <span class="tag">政策</span>
      </div>

      <div style="font-size:0.82em;color:var(--text-dim);margin:4px 0;">
        {{ c.ratio }} {{ getResName(c.input) }} → 1 食物值
      </div>

      <!-- 滑条 -->
      <div style="margin:8px 0;">
        <div style="display:flex;justify-content:space-between;font-size:0.75em;color:var(--text-dim);">
          <span>转化速率</span>
          <span>{{ currentRate(c.input) }} / 秒（上限 {{ c.maxRate }}）</span>
        </div>
        <input type="range" min="0" :max="c.maxRate" :value="currentRate(c.input)"
          class="slider" style="width:100%;margin:4px 0;"
          @input="setRate(c.input, $event)" />
        <div style="display:flex;justify-content:space-between;font-size:0.72em;color:var(--text-dim);">
          <span>0</span>
          <span>{{ c.maxRate }}</span>
        </div>
      </div>

      <div style="font-size:0.78em;color:var(--text-dim);">
        📥 每秒消耗 {{ store.fmt(currentRate(c.input)) }} {{ getResName(c.input) }}
        → 📤 每秒产出 {{ store.fmt(currentRate(c.input) / c.ratio) }} 食物值
      </div>

      <div v-if="currentRate(c.input) > (store.resources[c.input] || 0)" style="font-size:0.72em;color:var(--red);margin-top:2px;">
        ⚠️ {{ getResName(c.input) }} 库存不足，实际转化受限于库存
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useGameStore } from '../game/store.js'
const store = useGameStore()

function getResName(key) {
  return store.ALL_RESOURCES[key]?.name || key
}

function getResIcon(key) {
  return store.ALL_RESOURCES[key]?.icon || '📦'
}

function currentRate(input) {
  return store.policyRates?.[input] || 0
}

function setRate(input, event) {
  store.setPolicyRate(input, parseInt(event.target.value))
}

const netChange = computed(() => store.foodValueSurplus)
</script>

<style scoped>
.slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 6px;
  background: var(--border);
  border-radius: 3px;
  outline: none;
  cursor: pointer;
}
.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
  border: 2px solid #1a1a2e;
}
.slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
  border: 2px solid #1a1a2e;
}
</style>
