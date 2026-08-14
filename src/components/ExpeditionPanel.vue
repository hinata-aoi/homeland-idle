<template>
  <div>
    <!-- 队伍总览 -->
    <div class="panel">
      <h2>⚔️ 远征队</h2>
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:1.4em;">⚔️</span>
        <div style="flex:1;">
          <div style="font-size:0.95em;font-weight:600;">
            {{ store.guildTeamName }}
            <span style="color:var(--text-dim);font-weight:400;font-size:0.82em;">
              · 公会 Lv{{ guildLevel }}
            </span>
          </div>
          <div style="font-size:0.82em;color:var(--text-dim);">
            战斗力 <strong style="color:var(--accent);">{{ store.guildTeamPower }}</strong>
            <span v-if="guildLevel < 5" style="margin-left:6px;">
              升级公会至 Lv{{ guildLevel + 1 }} → 战力 {{ teamPowerNext }}
            </span>
          </div>
        </div>
      </div>
      <div v-if="guildLevel < 1" style="font-size:0.78em;color:var(--accent);margin-top:6px;">
        🔒 公会尚未解锁：将市政厅升至 Lv3（关键建筑选项卡内）
      </div>
    </div>

    <!-- 进行中的远征 -->
    <div class="panel" v-if="store.expedition">
      <h2>🚩 远征进行中</h2>
      <div class="resource-row">
        <span class="resource-icon">{{ mapIcon(store.expedition.mapId) }}</span>
        <span class="resource-name">
          {{ mapName(store.expedition.mapId) }}
          <span style="color:var(--text-dim);font-size:0.8em;">
            · {{ tierName(store.expedition.tier) }}
          </span>
        </span>
        <span style="font-size:0.85em;font-weight:600;color:var(--accent);">
          ⏳ {{ fmtRemaining }}
        </span>
      </div>
      <div style="font-size:0.78em;color:var(--text-dim);margin:2px 0;">
        📦 奖励已锁定（出发时结算）：{{ rewardsText(store.expedition.rewards) }}
      </div>
      <button class="btn-sm btn-red" style="margin-top:6px;" @click="store.cancelExpedition()">
        取消远征（无奖励）
      </button>
    </div>

    <!-- 地图列表 -->
    <div class="panel" v-for="m in store.expeditionMaps" :key="m.id">
      <div class="resource-row">
        <span class="resource-icon">{{ m.icon }}</span>
        <span class="resource-name">
          {{ m.name }}
          <span style="color:var(--text-dim);font-size:0.78em;font-weight:400;"> · {{ m.description }}</span>
        </span>
        <span style="font-size:0.82em;color:var(--text-dim);">
          🕐 {{ store.fmtTime(m.durationSec) }}
        </span>
      </div>

      <div style="font-size:0.8em;color:var(--text-dim);margin:2px 0;">
        <span>⚔️ 战力要求 <strong style="color:var(--text);">{{ m.powerRequirement }}</strong></span>
        <span v-if="m.unlocked && store.guildTeamPower > 0" style="margin-left:10px;">
          当前队伍预计：<span :style="{ color: tierColor(m.tier) }">{{ tierName(m.tier) }}</span>
        </span>
      </div>

      <!-- 各档位奖励预览 -->
      <div style="font-size:0.75em;color:var(--text-dim);margin:4px 0;line-height:1.7;">
        <div><span style="opacity:0.7;">📈 低收获（50~75%）：</span>{{ rewardsPreview(m, '50-75') || '—' }}</div>
        <div><span style="opacity:0.7;">📈 中收获（75~100%）：</span>{{ rewardsPreview(m, '75-100') || '—' }}</div>
        <div><span style="opacity:0.7;">🏆 满载（≥100%）：</span>{{ rewardsPreview(m, 'gte100') || '—' }}</div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;">
        <span v-if="!m.unlocked" style="font-size:0.75em;color:var(--text-dim);">
          🔒 全胜「{{ mapName(m.unlockAfter) }}」后解锁
        </span>
        <span v-else-if="store.expedition" style="font-size:0.75em;color:var(--text-dim);">
          远征进行中，待队伍返回
        </span>
        <span v-else-if="store.guildTeamPower <= 0" style="font-size:0.75em;color:var(--text-dim);">
          需先解锁公会
        </span>
        <span v-else style="font-size:0.75em;color:var(--text-dim);">
          战力 {{ store.guildTeamPower }} / 要求 {{ m.powerRequirement }}
        </span>
        <button class="upgrade-btn"
          :disabled="!m.unlocked || !!store.expedition || store.guildTeamPower <= 0"
          @click="store.startExpedition(m.id)">
          派遣
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useGameStore } from '../game/store.js'
import { EXPEDITION_MAPS, GUILD_CONFIG, ALL_RESOURCES } from '../game/config.js'

const store = useGameStore()

const guildLevel = computed(() => store.buildingLevels.guild || 0)
const teamPowerNext = computed(() => {
  const lv = Math.min(guildLevel.value + 1, GUILD_CONFIG.maxLevel)
  return GUILD_CONFIG.teamPowerByLevel[lv] || 0
})

// 倒计时刷新（仅本地显示，不依赖 store）
const now = ref(Date.now())
let timer = null
onMounted(() => { timer = setInterval(() => { now.value = Date.now() }, 1000) })
onUnmounted(() => { if (timer) clearInterval(timer) })

const fmtRemaining = computed(() => {
  const exp = store.expedition
  if (!exp) return ''
  const remainSec = Math.max(0, Math.ceil((exp.startTime + exp.durationSec * 1000 - now.value) / 1000))
  return `剩余 ${store.fmtTime(remainSec)}`
})

function mapName(id) {
  return EXPEDITION_MAPS.find(m => m.id === id)?.name || id
}

function mapIcon(id) {
  return EXPEDITION_MAPS.find(m => m.id === id)?.icon || '🗺️'
}

function tierName(tier) {
  return {
    'lt50': '远征失败',
    '50-75': '低收获',
    '75-100': '中收获',
    'gte100': '满载而归',
  }[tier] || tier
}

function tierColor(tier) {
  return {
    'lt50': 'var(--red)',
    '50-75': 'var(--text-dim)',
    '75-100': 'var(--accent)',
    'gte100': 'var(--green)',
  }[tier] || 'var(--text-dim)'
}

function resName(key) {
  return ALL_RESOURCES[key]?.name || key
}

// 奖励表 → 文本（"木材 200~300 · 石头 100~200"）
function rewardsText(rewards) {
  if (!rewards || Object.keys(rewards).length === 0) return '无'
  return Object.entries(rewards)
    .map(([res, amount]) => `${resName(res)} ${store.fmt(amount)}`)
    .join(' · ')
}

// 档位奖励预览（显示随机范围）
function rewardsPreview(map, tier) {
  const table = map.rewards?.[tier] || {}
  const parts = Object.entries(table).map(([res, [min, max]]) => `${resName(res)} ${min}~${max}`)
  return parts.join(' · ')
}
</script>
