# WebNote Cyberpunk - 业务逻辑与模块交互说明文档

**项目版本**: 1.0.0 (Prototype)  
**文档日期**: 2026-01-13  
**适用角色**: 前端开发人员, UI/UX 设计师, 产品经理

---

## 1. 系统概览 (System Overview)

WebNote Cyberpunk 是一个基于 React 的单页应用 (SPA)，旨在提供沉浸式的、未来派风格的笔记管理与个人复盘体验。系统模拟了一个 "赛博朋克" 风格的终端界面，强调高对比度视觉效果、霓虹光影以及“黑客”式的交互体验。

### 1.1 核心技术栈
*   **框架**: React 18 + TypeScript
*   **构建**: Vite (推测)
*   **路由**: `react-router-dom` (HashRouter)
*   **样式**: Tailwind CSS (配合自定义配置)
*   **图标**: Lucide React
*   **字体**: Orbitron (标题), Rajdhani (正文), Share Tech Mono (代码/数据)

---

## 2. 目录结构与模块划分 (Directory & Modules)

```text
src/
├── components/          # 公共组件库
│   ├── CyberUI.tsx      # 核心设计系统 (卡片, 按钮, 输入框, 徽章)
│   └── Sidebar.tsx      # 全局侧边栏导航
├── pages/               # 业务页面视图
│   ├── AuthPage.tsx     # 登录/认证模块
│   ├── Dashboard.tsx    # 主控台 (ChatGPT风格输入)
│   ├── NotesPage.tsx    # 笔记管理 (列表+编辑器)
│   ├── ReviewPage.tsx   # 每日复盘 (可视化统计)
│   └── SettingsPage.tsx # 系统设置
├── constants.ts         # 静态 Mock 数据 (数据库模拟)
├── types.ts             # TypeScript 类型定义
├── App.tsx              # 路由配置与布局入口
└── index.css            # 全局样式 (Tailwind 指令)
```

---

## 3. 核心业务逻辑详解 (Core Business Logic)

### 3.1 身份认证模块 (Authentication)
*   **对应文件**: `pages/AuthPage.tsx`
*   **业务目标**: 模拟用户接入安全终端的过程。
*   **交互流程**:
    1.  用户访问根路径，若未登录(逻辑上)重定向至 `/login`。
    2.  界面展示动态背景光晕和“安全接入终端”表单。
    3.  用户输入 `网络 ID` 和 `访问密钥`。
    4.  点击 "初始化会话" (Login)。
    5.  **逻辑处理**: 调用 `onLogin` 回调，触发 React Router 的 `useNavigate` 跳转至 Dashboard。
*   **视觉特性**: 包含背景模糊光斑、输入框聚焦光效、AES-256 加密状态模拟展示。

### 3.2 主控台模块 (Dashboard / Command Center)
*   **对应文件**: `pages/Dashboard.tsx`
*   **业务目标**: 提供类似 LLM (如 ChatGPT) 的中心化输入体验，作为用户操作的起点。
*   **功能逻辑**:
    1.  **中央指令终端**:
        *   界面核心是一个巨大的输入框，支持文本输入。
        *   **交互**: 用户输入内容 -> 按回车或点击发送 -> 触发 `handleSubmit`。
        *   **反馈**: 目前弹出 `alert` 模拟数据注入云端，并清空输入框。
    2.  **快捷指令 (Quick Actions)**:
        *   提供 "新建笔记" (`/notes`) 和 "每日复盘" (`/review`) 的快速入口。
        *   点击卡片直接触发路由跳转。
    3.  **近期缓存 (Recent Cache)**:
        *   **数据源**: 读取 `constants.ts` 中的 `MOCK_NOTES` 前3条数据。
        *   展示最近更新的笔记摘要（只读），增强“仪表盘”的数据感。
    4.  **状态监控**:
        *   右上角展示 `CORE: ONLINE` 和 `SYNC: ACTIVE`，纯视觉反馈，增强沉浸感。

### 3.3 神经记忆模块 (Notes Management)
*   **对应文件**: `pages/NotesPage.tsx`
*   **业务目标**: 笔记的浏览、检索、查看与编辑。
*   **模块布局**: 经典的 "左侧列表 + 右侧详情" 布局。
*   **交互逻辑**:
    1.  **左侧侧边栏**:
        *   **检索**: 输入框绑定 `searchTerm` 状态，实时过滤 `notes` 列表（匹配标题或内容）。
        *   **文件夹导航**: 横向滚动的文件夹列表（目前仅做 UI 展示，点击无过滤逻辑）。
        *   **笔记列表**: 点击列表项 -> 更新 `selectedNoteId` -> 右侧区域渲染对应笔记。高亮当前选中项。
    2.  **右侧编辑器**:
        *   **空状态**: 未选中笔记时显示 "请选择数据源" 占位符。
        *   **查看模式**: 默认状态。使用自定义样式的 Markdown 模拟渲染（支持 `#` 标题高亮）。
        *   **编辑模式**: 点击 "编辑模式" 按钮 -> `isEditing` 设为 `true` -> 切换为 `textarea` 输入框。
        *   **保存逻辑**: 点击 "保存" -> 更新本地 `notes` 状态 (State) -> 切回查看模式。
        *   **数据流**: 这是一个典型的 CRUD 中的 Read/Update 流程，目前数据存储在组件 State 中，页面刷新会重置。

### 3.4 每日复盘模块 (Daily Review)
*   **对应文件**: `pages/ReviewPage.tsx`
*   **业务目标**: 量化记录用户的精神状态与工作产出。
*   **功能逻辑**:
    1.  **状态可视化**:
        *   展示三个核心指标：精神状态 (Brain)、生产效能 (Activity)、情绪指数 (Smile)。
        *   使用进度条 UI 展示数值（如 80% 宽度），并配以文字评级（极佳、平稳、高昂）。
    2.  **连续记录 (Streak)**:
        *   顶部展示 "连续记录: 42 天"，激励用户持续使用。
    3.  **日志录入**:
        *   提供结构化表单：核心任务、系统阻碍、详细复盘。
        *   点击 "提交协议" 按钮模拟数据提交。

### 3.5 系统配置模块 (Settings)
*   **对应文件**: `pages/SettingsPage.tsx`
*   **业务目标**: 个性化设置与系统状态管理。
*   **功能逻辑**:
    1.  **用户档案**: 展示头像、ID、权限等级。
    2.  **界面设置**:
        *   **主题切换**: 点击 青/粉/黄 色块，更新 `theme` 状态 (目前仅改变选中态 UI)。
        *   **密度控制**: 标准视图 vs 紧凑视图。
        *   **语言选择**: 多语言切换按钮。
    3.  **数据链路**:
        *   **同步开关**: 控制 `syncEnabled` 状态，带有动画效果的 Toggle 按钮。
        *   **带宽/存储**: 滑块控制。
    4.  **通知管理**: 开关各类系统消息推送。

---

## 4. UI 设计系统 (CyberUI System)

为了保证赛博朋克风格的一致性，系统封装了 `components/CyberUI.tsx`。

### 4.1 核心组件规范
| 组件名 | 视觉特征 | 交互状态 |
| :--- | :--- | :--- |
| **CyberCard** | 深色面板背景，青色边框，四角有装饰性切角。顶部可选装饰条。 | 静态容器，部分支持 Hover 发光。 |
| **CyberButton** | 右下角切角设计 (Clip-path)。 | **Hover**: 背景反色或高亮，伴随霓虹阴影 (Box-shadow)。 |
| **CyberInput** | 半透明黑色背景，底部或全边框。 | **Focus**: 边框变色 (青色)，产生外发光。 |
| **CyberBadge** | 极小字号，高对比度背景色/边框。 | 静态标签。 |

### 4.2 动效规范
*   **进入动画**: 使用 `animate-in fade-in slide-in-from-bottom` (Tailwind animate) 实现页面元素的渐入。
*   **呼吸/脉冲**: 关键状态图标（如 Login 页的 CPU）使用 `animate-pulse`。
*   **故障效果**: Logo 文本使用 `glitch` 动画（在 `index.html` 样式中定义）。

---

## 5. 数据流与状态管理 (Data Flow)

目前应用处于 **Prototype (原型)** 阶段，数据流具有以下特征：

1.  **单向数据流**: 父组件通过 props 向子组件传递数据。
2.  **本地状态 (Local State)**:
    *   `NotesPage` 内部维护 `notes` 数组状态。
    *   `Dashboard` 维护 `inputText` 状态。
    *   修改操作（如编辑笔记）仅在当前组件生命周期内有效，刷新页面后重置为 `MOCK_NOTES`。
3.  **路由状态**: 使用 `react-router-dom` 的 `useLocation` 判断当前激活的菜单项，并高亮 Sidebar。
4.  **Mock 数据源**: 所有初始数据来自 `constants.ts`，模拟后端 DB 的响应。

---

## 6. 后续开发建议 (Future Roadmap)

若要将此原型转化为生产级应用，建议执行以下步骤：

1.  **引入全局状态管理**: 使用 React Context 或 Zustand 管理 `User`、`Notes` 和 `Settings`，解决跨页面数据同步问题。
2.  **接入后端 API**:
    *   替换 `MOCK_NOTES` 为真实的 `fetch` / `axios` 请求。
    *   实现 JWT 认证流程，替换模拟登录。
3.  **持久化存储**:
    *   在后端未就绪前，可使用 `localStorage` 保存笔记修改，避免刷新丢失。
4.  **Markdown 渲染增强**:
    *   引入 `react-markdown` 库替换目前的简易模拟渲染，支持代码高亮、图片解析等。
5.  **移动端适配优化**:
    *   目前的 `Sidebar` 在移动端已做响应式处理（变窄），但 `Dashboard` 和 `NotesPage` 的复杂布局在手机端仍需进一步优化（如抽屉式菜单）。

