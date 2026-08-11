<template>
  <Teleport to="body">
    <div v-if="preview" class="modal-overlay" @click.self="store.closeUpgradePreview()">
      <div class="modal" style="text-align:left;">
        <!-- 标题 + 等级变化 -->
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <span style="font-size:1.6em;">{{ preview.icon }}</span>
          <div>
            <h2 style="margin:0;font-size:1.05em;">{{ preview.name }} 升级预览</h2>
            <div style="font-size:0.82em;color:var(--text-dim);">
              等级 <strong style="color:var(--text);">{{ preview.currentLevel }}</strong>
              <span style="margin:0 6px;">→</span>
              <strong style="color:var(--accent);">{{ preview.nextLevel }}</strong>
            </div>
          </div>
        </div>

        <!-- 效果对比表 -->
        <table style="width:100%;border-collapse:collapse;font-size:0.85em;margin-bottom:10px;">
          <tbody>
            <tr v-for="row in preview.rows" :key="row.label" style="border-bottom:1px solid var(--border);">
              <td style="padding:6px 4px;color:var(--text-dim);width:38%;">{{ row.label }}</td>
              <td style="padding:6px 4px;text-align:right;text-decoration:line-through;opacity:0.5;">
                {{ row.current }}
              </td>
              <td style="padding:6px 4px;text-align:center;width:20px;color:var(--text-dim);">→</td>
              <td style="padding:6px 4px;text-align:right;font-weight:700;"
                :style="{ color: row.improved ? 'var(--green)' : 'var(--red)' }">
                {{ row.next }}
                <span v-if="row.improved">▲</span>
                <span v-else>▼</span>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- 里程碑预告 -->
        <div v-if="preview.unlockedMilestones.length > 0"
          style="background:rgba(226,160,63,0.1);border:1px solid var(--accent);border-radius:6px;padding:8px 10px;font-size:0.82em;margin-bottom:10px;">
          <div v-for="ms in preview.unlockedMilestones" :key="ms.level" style="color:var(--accent);">
            🎯 升级至 Lv{{ ms.level }} 解锁：{{ ms.desc }}
          </div>
        </div>

        <!-- 升级成本 -->
        <div style="font-size:0.82em;margin-bottom:14px;">
          <div style="color:var(--text-dim);margin-bottom:4px;">升级成本</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            <span :style="{ color: affordPrimary ? 'var(--text)' : 'var(--red)' }">
              {{ preview.cost.primary.amount }} {{ resName(preview.cost.primary.resource) }}
              <span v-if="!affordPrimary" style="font-size:0.78em;">（不足）</span>
            </span>
            <template v-if="preview.cost.secondary">
              <span :style="{ color: affordSecondary ? 'var(--text)' : 'var(--red)' }">
                + {{ preview.cost.secondary.amount }} {{ resName(preview.cost.secondary.resource) }}
                <span v-if="!affordSecondary" style="font-size:0.78em;">（不足）</span>
              </span>
            </template>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div style="display:flex;gap:8px;">
          <button class="upgrade-btn" style="flex:1;padding:10px;font-size:0.95em;"
            :disabled="!preview.canAfford"
            @click="confirm">确认升级</button>
          <button class="btn-sm" style="flex:1;padding:10px;font-size:0.95em;background:var(--border);color:var(--text);"
            @click="store.closeUpgradePreview()">取消</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'
import { useGameStore } from '../game/store.js'
const store = useGameStore()

const preview = computed(() => store.upgradePreview)

const affordPrimary = computed(() => {
  if (!preview.value) return false
  return store.getResourceAmount(preview.value.cost.primary.resource) >= preview.value.cost.primary.amount
})

const affordSecondary = computed(() => {
  if (!preview.value?.cost.secondary) return true
  return store.getResourceAmount(preview.value.cost.secondary.resource) >= preview.value.cost.secondary.amount
})

function resName(key) {
  return store.ALL_RESOURCES[key]?.name || key
}

function confirm() {
  if (store.upgradeBuilding(preview.value.id)) {
    store.closeUpgradePreview()
  }
}
</script>
