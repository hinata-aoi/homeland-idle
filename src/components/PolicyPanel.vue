<template>
  <div>
    <!-- 内部子 Tab 栏 -->
    <nav class="tab-bar tab-bar--inline">
      <button :class="{ active: subTab === 'food' }" @click="subTab = 'food'">📤 食物发放</button>
      <button :class="{ active: subTab === 'tax' }" @click="subTab = 'tax'">💰 税务</button>
      <button :class="{ active: subTab === 'happiness' }" @click="subTab = 'happiness'">😊 幸福度</button>
    </nav>

    <!-- ============ 食物发放 Tab ============ -->
    <div v-if="subTab === 'food'">
      <!-- 食物发放（合并所有转化项） -->
      <div class="panel">
        <h2>📤 食物发放</h2>

        <div v-for="(c, idx) in store.availableConversions" :key="c.input"
          :style="{ padding: '8px 0', borderTop: idx > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }">
          <!-- 行首：图标 + 名称 + 比例 -->
          <div class="resource-row">
            <span class="resource-icon">{{ getResIcon(c.input) }}</span>
            <span class="resource-name">
              {{ getResName(c.input) }}
              <span style="color:var(--text-dim);font-size:0.78em;font-weight:400;">
                · {{ c.ratio }} {{ getResName(c.input) }} → 1 食物值
              </span>
            </span>
          </div>

          <!-- 滑条 -->
          <div style="margin:4px 0;">
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

          <div v-if="currentRate(c.input) > store.getResourceAmount(c.input)" style="font-size:0.72em;color:var(--red);margin-top:2px;">
            ⚠️ {{ getResName(c.input) }} 库存不足，实际转化受限于库存
          </div>
        </div>

        <!-- 合计产出汇总 -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding-top:8px;border-top:1px solid var(--border);">
          <span style="font-size:0.85em;color:var(--text-dim);">合计产出</span>
          <span style="font-size:0.85em;font-weight:600;color:var(--accent);">
            {{ store.fmt(totalFoodOutput) }} 食物值/s
          </span>
        </div>
      </div>
    </div>

    <!-- ============ 税务 Tab ============ -->
    <div v-if="subTab === 'tax'">
      <!-- 税所未解锁 -->
      <div class="panel" v-if="(store.buildingLevels.taxOffice || 0) < 1">
        <h2>🏦 税务</h2>
        <p style="font-size:0.85em;color:var(--text-dim);margin:0;">
          🔒 税所尚未解锁：将市政厅升至 Lv4（关键建筑选项卡内建造）。
        </p>
      </div>

      <!-- 已解锁：档位选择 -->
      <div class="panel" v-else>
        <h2>🏦 税务 · 税所 Lv{{ store.buildingLevels.taxOffice }}</h2>
        <div style="font-size:0.8em;color:var(--text-dim);margin-bottom:8px;">
          🪙 当前金币：<strong style="color:var(--accent);">{{ store.fmt(store.gold) }}</strong>
          &nbsp;·&nbsp; 按总人口（含空闲）征税，每 30 分钟结算一轮
        </div>

        <div v-for="tier in store.taxTiers" :key="tier.id"
          style="padding:8px 0;border-top:1px solid rgba(255,255,255,0.04);display:flex;align-items:center;gap:8px;">
          <button class="btn-sm"
            :class="{ 'recipe-active': tier.id === store.taxRate }"
            style="min-width:76px;"
            @click="store.setTaxRate(tier.id)">
            {{ tier.name }}
          </button>
          <div style="flex:1;font-size:0.8em;color:var(--text-dim);">
            每轮每人 <strong style="color:var(--text);">{{ tier.goldPerPerson }}</strong> 金币
            <span style="opacity:0.6;">（当前 {{ store.totalPopulation }} 人 → {{ tier.goldPerPerson * store.totalPopulation }} 金币/轮）</span>
          </div>
          <span style="font-size:0.8em;" :style="{ color: happinessColor(tier.happiness) }">
            {{ happinessText(tier.happiness) }}
          </span>
        </div>

        <div style="font-size:0.75em;color:var(--text-dim);padding-top:6px;border-top:1px solid rgba(255,255,255,0.04);">
          ⏳ 下一轮结算：{{ fmtNextCollect }}
          <span v-if="!isTaxing" style="color:var(--text-dim);">（当前不征税）</span>
          <div style="margin-top:2px;">
            💡 档位幸福度修正常驻生效（换档立即生效）；金币按真实时间结算，离线期间照常累计。
          </div>
        </div>
      </div>
    </div>

    <!-- ============ 幸福度 Tab ============ -->
    <div v-if="subTab === 'happiness'">
      <!-- 状态总览 -->
      <div class="panel">
        <h2>😊 幸福度</h2>

        <!-- 当前状态 -->
        <div style="text-align:center;padding:12px 0;">
          <div style="font-size:3em;">{{ store.happinessStatus.icon }}</div>
          <div style="font-size:1.3em;font-weight:700;margin:4px 0;"
            :style="{ color: store.happinessNetPoints >= 0 ? 'var(--green)' : 'var(--red)' }">
            {{ store.happinessStatus.name }}
          </div>
          <div style="font-size:0.85em;color:var(--text-dim);">
            幸福度 {{ store.happinessPoints }} 点 · 需求 {{ store.happinessDemand }} 点
            <span v-if="store.happinessNetPoints > 0" style="color:var(--green);font-weight:600;">（+{{ store.happinessNetPoints }}）</span>
            <span v-else-if="store.happinessNetPoints < 0" style="color:var(--red);font-weight:600;">（{{ store.happinessNetPoints }}）</span>
            <span v-else>（±0）</span>
          </div>
        </div>

        <!-- 当前全局效果 -->
        <div style="border-top:1px solid var(--border);padding-top:10px;">
          <h3 style="font-size:0.9em;margin-bottom:6px;">📊 当前效果</h3>
          <div style="font-size:0.85em;color:var(--text-dim);line-height:1.8;">
            <div>
              👥 人口增长速度：
              <span :style="{ color: happinessColor(store.happinessStatus.growthMod) }">
                {{ signedPercent(store.happinessStatus.growthMod) }}
              </span>
            </div>
            <div>
              🏭 所有建筑产出：
              <span :style="{ color: happinessColor(store.happinessStatus.outputMod) }">
                {{ signedPercent(store.happinessStatus.outputMod) }}
              </span>
            </div>
            <div v-if="store.happinessStatus.growthMod === 0 && store.happinessStatus.outputMod === 0"
              style="color:var(--text-dim);">
              中立状态，无任何影响
            </div>
          </div>
        </div>
      </div>

      <!-- 幸福度来源（事件表） -->
      <div class="panel" style="margin-top:8px;">
        <h3 style="font-size:0.9em;margin-bottom:8px;">
          📋 幸福度来源（{{ store.activeHappinessEvents.length }}/{{ store.HAPPINESS_CONFIG.events.length }}）
        </h3>
        <div v-for="event in store.HAPPINESS_CONFIG.events" :key="event.id"
          style="padding:8px 0;border-top:1px solid rgba(255,255,255,0.04);display:flex;align-items:center;gap:8px;">
          <span style="font-size:1.1em;"
            :style="{ opacity: isEventActive(event.id) ? 1 : 0.3 }">
            {{ isEventActive(event.id) ? '✅' : '⬜' }}
          </span>
          <span style="font-size:1.2em;" :style="{ opacity: isEventActive(event.id) ? 1 : 0.4 }">
            {{ event.icon }}
          </span>
          <div style="flex:1;">
            <div style="font-size:0.85em;" :style="{ opacity: isEventActive(event.id) ? 1 : 0.5 }">
              {{ event.name }}
              <span style="color:var(--green);font-size:0.85em;">(+{{ event.points }})</span>
            </div>
            <div style="font-size:0.72em;color:var(--text-dim);">
              {{ event.description }}
            </div>
          </div>
        </div>
        <!-- 建筑被动加成（常驻，不走事件表） -->
        <div v-if="store.passiveHappinessBonuses.length > 0"
          style="padding:8px 0;border-top:1px solid rgba(255,255,255,0.04);">
          <div v-for="bonus in store.passiveHappinessBonuses" :key="bonus.building"
            style="font-size:0.85em;color:var(--green);">
            {{ buildingInfo(bonus.building).icon }} {{ buildingInfo(bonus.building).name }} Lv{{ bonus.level }}+：常驻 +{{ bonus.points }}
          </div>
          <div style="font-size:0.72em;color:var(--text-dim);padding-top:2px;">
            🏛️ 建筑被动加成：等级满足即生效，等级回退后收回（不经过事件检查）。
          </div>
        </div>
        <div style="font-size:0.72em;color:var(--text-dim);padding-top:6px;border-top:1px solid rgba(255,255,255,0.04);">
          💡 事件满足条件时获得幸福度，条件不再满足时收回。
        </div>
      </div>

      <!-- 状态等级参考表 -->
      <div class="panel" style="margin-top:8px;">
        <h3 style="font-size:0.9em;margin-bottom:8px;">📈 状态等级说明</h3>
        <div v-for="lv in store.HAPPINESS_CONFIG.statusLevels" :key="lv.name"
          style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:0.78em;"
          :style="lv.name === store.happinessStatus.name
            ? { fontWeight: 700, color: 'var(--accent)' }
            : { color: 'var(--text-dim)' }">
          <span>{{ lv.icon }}</span>
          <span>{{ lv.name }}</span>
          <span v-if="lv === store.happinessStatus" style="background:var(--accent);color:#1a1a2e;font-size:0.75em;padding:1px 6px;border-radius:3px;">当前</span>
          <span style="margin-left:auto;">
            增长{{ signedPercent(lv.growthMod) }} · 产出{{ signedPercent(lv.outputMod) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useGameStore } from '../game/store.js'
import { getBuilding } from '../game/config.js'
const store = useGameStore()

// 政策面板内部子 Tab
const subTab = ref('food')

// --- 税务 UI 辅助 ---

// 幸福度修正 → 文本（如 +1 / -3 / 不变）
function happinessText(mod) {
  if (mod > 0) return `幸福度 +${mod}`
  if (mod < 0) return `幸福度 ${mod}`
  return '幸福度不变'
}

// 当前是否在征税（金币 > 0 的档位）
const isTaxing = computed(() => (store.currentTaxTier?.goldPerPerson || 0) > 0)

// 下一轮结算倒计时（本地 1s 刷新，不依赖 store）
const nowTax = ref(Date.now())
let taxTimer = null
onMounted(() => { taxTimer = setInterval(() => { nowTax.value = Date.now() }, 1000) })
onUnmounted(() => { if (taxTimer) clearInterval(taxTimer) })

const fmtNextCollect = computed(() => {
  const tier = store.currentTaxTier
  if (!tier || tier.goldPerPerson <= 0) return '—'
  const remain = Math.max(0, store.TAX_CONFIG.settlementIntervalSec - Math.floor((nowTax.value - store.lastTaxCollectTime) / 1000))
  return store.fmtTime(remain)
})

function buildingInfo(id) {
  const b = getBuilding(id)
  return { icon: b?.icon || '🏛️', name: b?.name || id }
}

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

// 所有发放项的实际食物值产出总和（受库存限制）
const totalFoodOutput = computed(() => {
  let total = 0
  for (const c of store.availableConversions) {
    const rate = store.policyRates?.[c.input] || 0
    const available = store.getResourceAmount(c.input)
    total += Math.min(rate, available) / c.ratio
  }
  return total
})

// --- 幸福度 UI 辅助 ---

function isEventActive(eventId) {
  return store.activeHappinessEvents.includes(eventId)
}

// 倍率值 → 带符号百分比字符串（如 0.10 → +10%，-0.15 → -15%）
function signedPercent(mod) {
  const sign = mod > 0 ? '+' : ''
  return `${sign}${(mod * 100).toFixed(0)}%`
}

// 正负值对应颜色：正=绿，负=红，0=中性
function happinessColor(mod) {
  if (mod > 0) return 'var(--green)'
  if (mod < 0) return 'var(--red)'
  return 'var(--text-dim)'
}
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
