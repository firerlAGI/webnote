# WebNote - 极简网页笔记 + 轻量化日复盘

> 一个专注于核心功能的笔记和复盘工具，采用 Monorepo 架构，极简设计理念。

## 📖 项目简介

WebNote 是一个轻量级的笔记管理和日复盘工具，专注于提供核心功能，避免过度设计。

### 核心特性

- **极简网页笔记**
  - 基础笔记操作（创建、编辑、删除、查看）
  - 笔记分类管理（文件夹系统）
  - 笔记搜索功能
  - Markdown 编辑器支持

- **轻量化日复盘**
  - 每日复盘记录
  - 复盘数据统计（情绪趋势、完成率分析）
  - 复盘历史查询

- **通用功能**
  - 用户认证系统
  - 数据备份
  - 多设备同步

### 技术栈

- **前端**: React + TypeScript + TailwindCSS + Vite
- **后端**: Node.js + Fastify + PostgreSQL + Prisma
- **工具链**: pnpm + Turborepo + ESLint + Prettier
- **架构**: Monorepo（单仓库多包）

## 🏗️ 项目结构

```
webnote/
├── packages/
│   ├── backend/       # 后端服务
│   ├── web/          # 前端网页应用
│   ├── shared/        # 共享类型和工具
│   ├── ui-components/ # 共享UI组件
│   ├── browser-extension/ # 浏览器插件（开发中）
│   └── config/       # 共享配置
├── scripts/          # 部署脚本
├── project-docs/     # 项目文档
├── package.json      # 根项目配置
├── turbo.json        # Turborepo配置
└── README.md         # 项目说明
```

## 🚀 快速开始

### 前置要求

- Node.js 18.x+
- pnpm 8.x+
- PostgreSQL 14+

### 安装依赖

```bash
# 安装 pnpm（如果未安装）
npm install -g pnpm

# 安装项目依赖
pnpm install
```

### 开发环境运行

```bash
# 启动所有服务
pnpm dev

# 或者分别启动各个包
pnpm --filter @webnote/backend dev  # 后端服务
pnpm --filter @webnote/web dev       # 前端应用
```

### 构建项目

```bash
# 构建所有包
pnpm build

# 构建指定包
pnpm --filter @webnote/backend build
pnpm --filter @webnote/web build
```

## 📚 文档导航

### 快速入门

如果您是新加入项目的开发者，建议按以下顺序阅读文档：

1. **[项目文档中心](./project-docs/README.md)** - 查看完整的文档索引
2. **[会议记录](./project-docs/会议记录.md)** - 了解项目背景和技术方案
3. **[架构设计文档](./project-docs/架构设计文档.md)** - 理解项目整体架构
4. **[开发规范](./project-docs/开发规范.md)** - 遵循代码和开发规范
5. **[项目进度追踪](./project-docs/项目进度追踪.md)** - 查看当前开发进度

### 重要文档

- **[部署指南](./scripts/README_DEPLOY.md)** - 部署到生产环境
- **[后端部署指南](./packages/backend/scripts/DEPLOYMENT_GUIDE.md)** - 详细的部署步骤

## 📦 包说明

### @webnote/backend
后端服务，提供 API 接口和数据管理。

- **端口**: 3000
- **技术栈**: Fastify + PostgreSQL + Prisma
- **功能**: 用户认证、笔记管理、复盘管理、数据同步

### @webnote/web
前端网页应用，提供用户界面。

- **技术栈**: React + TypeScript + TailwindCSS + Vite
- **功能**: 用户界面、笔记管理、日复盘、Markdown 编辑器

### @webnote/shared
共享类型定义、工具函数和常量。

- **类型定义**: 前后端共享的 TypeScript 类型
- **工具函数**: 通用工具函数
- **常量**: 项目常量定义

## 🔧 开发指南

### 代码规范

项目遵循以下规范：

- **代码风格**: ESLint + Prettier
- **提交规范**: Conventional Commits
- **命名规范**: 驼峰命名（变量/函数）、帕斯卡命名（组件/类）

详细规范请参考 [开发规范](./project-docs/开发规范.md)。

### 分支管理

- `main` - 生产环境分支
- `develop` - 开发环境分支
- `feature/*` - 功能分支
- `bugfix/*` - 修复分支

### 测试

```bash
# 运行所有测试
pnpm test

# 运行指定包的测试
pnpm --filter @webnote/backend test
pnpm --filter @webnote/web test
```

## 📊 项目进度

当前项目开发进度：

- **T0: 项目初始化与架构搭建** ✅ 已完成
- **T1: 后端核心服务开发** ✅ 已完成
- **T2: 前端网页应用核心功能** 🚧 进行中 (85%)
- **T3: 数据同步与存储优化** 🚧 进行中 (90%)
- **T4: 用户体验打磨** ⏳ 待开始
- **T5: 测试与验证** 🚧 进行中 (10%)
- **T6: 部署与监控** ⏳ 待开始

详细进度请参考 [项目进度追踪](./project-docs/项目进度追踪.md)。

## 🚢 部署

### 部署到生产环境

使用提供的部署脚本：

```bash
# 赋予执行权限
chmod +x scripts/deploy.sh

# 执行部署
./scripts/deploy.sh
```

详细部署步骤请参考 [部署指南](./scripts/README_DEPLOY.md)。

## 🤝 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'feat: Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证。

## 📞 联系方式

- **项目仓库**: https://github.com/firerlAGI/webnote
- **问题反馈**: 请在 GitHub Issues 中提出

---

**最后更新**: 2026-01-14
