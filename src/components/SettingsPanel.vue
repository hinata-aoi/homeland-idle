<template>
  <div>
    <!-- 存档管理 -->
    <div class="panel">
      <h2>⚙️ 设置</h2>
      <p style="font-size:0.85em;color:var(--text-dim);margin-bottom:12px;">
        存档自动保存在浏览器中。清除浏览器缓存会丢失存档。
      </p>
      <div style="display:flex;gap:8px;">
        <button class="btn-sm btn-blue" @click="manualSave">💾 手动存档</button>
        <button class="btn-sm btn-red" @click="confirmReset">🗑️ 重置游戏</button>
      </div>
      <p v-if="saveMsg" style="font-size:0.8em;color:var(--green);margin-top:8px;">{{ saveMsg }}</p>

      <div v-if="showResetConfirm" style="margin-top:12px;padding:10px;border:1px solid var(--red);border-radius:var(--radius);">
        <p style="color:var(--red);font-size:0.85em;">确定要删除所有存档并重新开始吗？此操作不可撤销。</p>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button class="btn-sm btn-red" @click="doReset">确认重置</button>
          <button class="btn-sm" style="background:var(--border);color:var(--text);" @click="showResetConfirm = false">取消</button>
        </div>
      </div>
    </div>

    <!-- 测试工具 -->
    <div class="panel">
      <h2 style="cursor:pointer;user-select:none;" @click="showDebug = !showDebug">
        🧪 测试工具 {{ showDebug ? '▾' : '▸' }}
      </h2>
      <div v-if="showDebug">
        <button class="btn-sm" style="background:var(--accent);color:#1a1a2e;margin-bottom:10px;width:100%;" @click="store.fillAllResources()">
          🎯 填满所有资源到上限
        </button>

        <!-- 基础物资滑条 -->
        <div v-for="(def, key) in allRes" :key="key" style="margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;font-size:0.8em;margin-bottom:2px;">
            <span>{{ def.icon }} {{ def.name }}</span>
            <span>{{ store.fmt(store.getResourceAmount(key)) }} / {{ store.fmt(store.getResourceCap(key)) }}</span>
          </div>
          <input
            type="range"
            min="0"
            :max="store.getResourceCap(key)"
            :value="store.getResourceAmount(key)"
            @input="e => store.setResourceAmount(key, parseFloat(e.target.value))"
            class="debug-slider"
          />
        </div>
      </div>
    </div>

    <div class="panel">
      <p style="font-size:0.75em;color:var(--text-dim);">
        《家园》v1.0 · Vue 3 + Pinia
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useGameStore } from '../game/store.js'
import { BASIC_RESOURCES, REFINED_RESOURCES } from '../game/config.js'

const store = useGameStore()
const saveMsg = ref('')
const showResetConfirm = ref(false)
const showDebug = ref(true)

const allRes = { ...BASIC_RESOURCES, ...REFINED_RESOURCES }

function manualSave() {
  store.save()
  saveMsg.value = '✅ 存档成功！'
  setTimeout(() => saveMsg.value = '', 2000)
}

function confirmReset() {
  showResetConfirm.value = true
}

function doReset() {
  store.resetGame()
  showResetConfirm.value = false
  saveMsg.value = ''
}
</script>

<style scoped>
.debug-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 6px;
  background: var(--border);
  border-radius: 3px;
  outline: none;
  cursor: pointer;
}
.debug-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
  border: 2px solid #1a1a2e;
}
.debug-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
  border: 2px solid #1a1a2e;
}
</style>
