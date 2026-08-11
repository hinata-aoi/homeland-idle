# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

《家园》是一款纯自动化中式放置/增量游戏（idle/incremental game），种田生存主题。Vue 3 + Vite + Pinia，深色 CSS 主题，单页无路由，localStorage 存档。

## 常用命令

```bash
npm run dev       # 启动开发服务器（默认 localhost:5173）
npm run build     # 生产构建（npx vite build）
npm run preview   # 预览生产构建
```

## 架构

```
src/
├── main.js              # 入口：createApp + createPinia
├── style.css            # 全局 CSS 变量（--bg, --panel, --accent, --text 等深色主题）
├── App.vue              # 根组件：header + 7 个 tab 按钮 + v-if 切换面板
├── game/
│   ├── config.js         # 所有游戏数据定义（纯配置，无状态）
│   └── store.js          # Pinia setup store：全部游戏状态和逻辑
└── components/
    ├── ProductionPanel.vue   # 🏭 生产 — 展示 production 类建筑
    ├── ProcessingPanel.vue   # 🔧 加工 — 已解锁/锁定两部分
    ├── KeyPanel.vue          # 🔑 关键 — 聚集地、市政厅等全局建筑
    ├── PopulationPanel.vue   # 👥 人口 — 食物槽进度条 + 分配一览
    ├── PolicyPanel.vue       # 📜 政策 — 食物值总览 + 资源转化滑条
    ├── WarehousePanel.vue    # 📦 仓库 — 每项资源的库存/容量进度条
    ├── SettingsPanel.vue     # ⚙️ 设置 — 存档、重置、调试工具
    └── OfflineModal.vue      # 离线收益弹窗
```

### 数据流（单向）

```
config.js (纯数据)
    ↓ 导入
store.js (Pinia setup store — 状态 + 计算 + 操作)
    ↓ useGameStore()
组件 (.vue) — 只读 computed 或调用 store 方法
```

**核心原则**：组件从不直接修改状态，所有变更通过 store 方法完成。store 内的 `save()` 在每次变更后自动写 localStorage。

> 详细的 config.js 字段约定、store.js 游戏循环/离线计算/解锁机制/配方系统/存档系统、组件模式等，见 [开发文档.md](开发文档.md) 第五章。

## 行为准则

- 始终使用中文回复；代码、标识符、提交信息使用英文
- 只修改当前任务涉及的内容，不顺手重构
- 先查 `开发文档.md` 和现有代码，再决定实现方式
- 完成后 `npx vite build` 验证
- 未经用户授权不推送 git remote
- 详细行为规范见 [AGENTS.md](AGENTS.md)
