# WebNote Cyberpunk 前端

基于 React + TypeScript + Tailwind CSS + Vite 构建的赛博朋克风格笔记应用前端。

## 技术栈

- **React 18** - UI 框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **Tailwind CSS** - 样式框架
- **React Router** - 路由管理
- **Axios** - HTTP 客户端
- **Lucide React** - 图标库
- **Recharts** - 数据可视化

## 项目结构

```
src/
├── api/           # API 调用封装
├── components/     # 可复用组件
│   └── CyberUI.tsx  # 赛博朋克风格UI组件
├── pages/         # 页面组件
│   ├── AuthPage.tsx    # 登录页面
│   ├── Dashboard.tsx   # 仪表盘
│   ├── NotesPage.tsx   # 笔记管理
│   ├── ReviewPage.tsx  # 每日复盘
│   └── SettingsPage.tsx # 设置页面
├── App.tsx        # 主应用组件
├── main.tsx       # 应用入口
├── index.css      # 全局样式
├── types.ts       # 类型定义
└── constants.ts   # 常量定义
```

## 开发指南

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

应用将在 `http://localhost:3000` 启动

### 构建生产版本

```bash
npm run build
```

### 预览生产构建

```bash
npm run preview
```

## 环境变量

创建 `.env` 文件（参考 `.env.example`）：

```env
VITE_API_URL=http://localhost:3001/api
```

## API 集成

前端已配置与后端 API 的完整集成：

- **认证**: 登录、注册、密码重置
- **笔记**: CRUD 操作、搜索、批量操作
- **文件夹**: 文件夹管理
- **复盘**: 每日复盘记录和统计
- **备份**: 备份创建、恢复、下载

## 设计系统

### 配色方案

- `cyber-black`: #0a0a0f - 主背景
- `cyber-dark`: #12121a - 次要背景
- `cyber-cyan`: #00f5ff - 主强调色
- `cyber-pink`: #ff00ff - 次要强调色
- `cyber-yellow`: #ffff00 - 警告/高亮
- `cyber-purple`: #9d4edd - 特殊元素

### 字体

- `Orbitron`: 标题/显示字体
- `Rajdhani`: 正文字体
- `Share Tech Mono`: 代码/数据字体

### UI 组件

所有 UI 组件都封装在 `CyberUI.tsx` 中，包括：
- `CyberCard` - 卡片容器
- `CyberButton` - 按钮（带切角和发光效果）
- `CyberInput` - 输入框
- `CyberBadge` - 徽章标签

## 功能特性

- ✅ JWT 认证和授权
- ✅ 笔记管理（增删改查）
- ✅ 文件夹组织
- ✅ 笔记搜索和过滤
- ✅ 每日复盘记录
- ✅ 数据可视化（图表）
- ✅ 响应式设计
- ✅ 赛博朋克视觉风格
- ✅ 离线支持（通过 API 拦截器）

## 待实现功能

- [ ] WebSocket 实时同步
- [ ] 离线模式（IndexedDB）
- [ ] 导出功能（Markdown/PDF）
- [ ] 拖拽上传图片
- [ ] 主题自定义
- [ ] 多语言支持

## 浏览器支持

- Chrome/Edge (最新版本)
- Firefox (最新版本)
- Safari (最新版本)

## 开发提示

1. **样式**: 所有样式使用 Tailwind CSS，特殊效果在 `index.css` 中定义
2. **类型**: 严格使用 TypeScript，不要使用 `any`
3. **组件**: 优先使用封装的 `CyberUI` 组件保持风格一致性
4. **API**: 使用 `src/api/index.ts` 中的封装方法，不要直接调用 axios
5. **路由**: 使用 HashRouter 以支持静态部署
