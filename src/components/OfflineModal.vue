<template>
  <Teleport to="body">
    <div v-if="store.showOfflineModal" class="modal-overlay" @click.self="store.dismissOfflineModal()">
      <div class="modal">
        <h2>🌙 你离开了 {{ store.fmtTime(store.offlineSeconds) }}</h2>
        <p style="color:var(--text-dim);">你的家园继续运转，收获了：</p>

        <div v-for="(amount, key) in store.offlineEarnings" :key="key" style="margin:4px 0;">
          <span v-if="!key.startsWith('auto_')" style="color:var(--accent);">
            {{ getResourceIcon(key) }} {{ getResourceName(key) }}: +{{ store.fmt(amount) }}
          </span>
          <span v-else style="color:var(--blue);font-size:0.85em;">
            （里程碑自动产出: {{ getRefinedName(key.replace('auto_', '')) }} +{{ store.fmt(amount) }}）
          </span>
        </div>

        <div v-if="hasOverflow" style="color:var(--red);font-size:0.85em;margin-top:8px;">
          ⚠️ 部分物资已达存储上限，超出部分被浪费。考虑升级仓库容量。
        </div>

        <button class="btn-green" style="margin-top:16px;width:100%;padding:12px;" @click="store.dismissOfflineModal()">
          回到家园
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'
import { useGameStore } from '../game/store.js'
import { BASIC_RESOURCES, REFINED_RESOURCES } from '../game/config.js'

const store = useGameStore()

const hasOverflow = computed(() => {
  // 检查是否有资源已满（可能发生了溢出）
  for (const key of Object.keys(store.offlineEarnings)) {
    if (key.startsWith('auto_')) continue
    const cap = store.getResourceCap(key)
    const amt = store.resources[key] ?? 0
    if (cap > 0 && amt >= cap * 0.99) return true
  }
  return false
})

function getResourceIcon(key) {
  return BASIC_RESOURCES[key]?.icon || '📦'
}

function getResourceName(key) {
  return BASIC_RESOURCES[key]?.name || key
}

function getRefinedName(key) {
  return REFINED_RESOURCES[key]?.name || key
}
</script>
