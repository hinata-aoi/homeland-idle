<template>
  <Teleport to="body">
    <div v-if="choice" class="modal-overlay" @click.self="store.closeEvolutionChoice()">
      <div class="modal">
        <h2 style="margin:0 0 4px;">
          {{ choice.icon }} {{ choice.name }} 已达上限 — 选择专精方向
        </h2>
        <p style="font-size:0.78em;color:var(--text-dim);margin:0 0 10px;">
          原建筑将被替换并消失，人口回到空闲池。进化后可随时免费「回退」到原建筑 Lv1。
        </p>

        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <div class="panel evolve-card" v-for="branch in choice.branches" :key="branch.id">
            <div class="resource-row">
              <span class="resource-icon">{{ branch.icon }}</span>
              <span class="resource-name">{{ branch.name }}</span>
            </div>
            <div style="font-size:0.75em;color:var(--text-dim);margin:2px 0 4px;">{{ branch.description }}</div>
            <div style="font-size:0.78em;">
              <span v-if="branch.type === 'production'" style="color:var(--green);">
                📈 {{ branch.summary }}
              </span>
              <span v-else style="color:var(--green);">
                ⚙️ {{ branch.summary }}
              </span>
            </div>
            <button class="upgrade-btn evolve-btn" style="margin-top:8px;"
              :disabled="!choice.canAfford"
              @click="store.evolveBuilding(choice.id, branch.id)">
              专精进化
            </button>
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;">
          <span style="font-size:0.8em;color:var(--text-dim);">
            专精消耗 {{ choice.cost.primary.amount }} {{ resName(choice.cost.primary.resource) }}
            <template v-if="choice.cost.secondary">
              + {{ choice.cost.secondary.amount }} {{ resName(choice.cost.secondary.resource) }}
            </template>
            <span v-if="!choice.canAfford" style="color:var(--red);">（资源不足）</span>
          </span>
          <button class="upgrade-btn" @click="store.closeEvolutionChoice()">取消</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'
import { useGameStore } from '../game/store.js'
const store = useGameStore()

const choice = computed(() => store.evolutionChoice)

function resName(key) {
  return store.ALL_RESOURCES[key]?.name || key
}
</script>
