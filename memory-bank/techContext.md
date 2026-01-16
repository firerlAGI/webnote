# Tech Context - WebNote

## 技术栈概览

### 前端技术栈

| 技术 | 版本 | 用途 | 理由 |
|------|------|------|------|
| React | 18.x | UI 框架 | 成熟稳定，生态丰富 |
| TypeScript | 5.x | 类型系统 | 类型安全，提高代码质量 |
| Vite | 5.x | 构建工具 | 快速的构建速度，优秀的开发体验 |
| TailwindCSS | 3.x | CSS 框架 | 实用优先，快速开发 |
| React Router | 6.x | 路由管理 | 官方推荐，功能完善 |
| react-markdown | 9.x | Markdown 编辑器 | 功能强大，易于扩展 |

### 后端技术栈

| 技术 | 版本 | 用途 | 理由 |
|------|------|------|------|
| Node.js | 18.x | 运行时 | JavaScript 全栈，减少切换成本 |
| Fastify | 4.x | Web 框架 | 高性能，易于扩展 |
| PostgreSQL | 14+ | 数据库 | 成熟稳定，支持复杂查询 |
| Prisma | 5.x | ORM | 类型安全，开发体验好 |
| WebSocket | - | 实时通信 | 原生支持，无需额外依赖 |
| JWT | - | 认证 | 无状态，易于扩展 |
| bcrypt | 5.x | 密码加密 | 安全，行业标准 |

### 工具链

| 工具 | 版本 | 用途 |
|------|------|------|
| pnpm | 8.x | 包管理器 |
| Turborepo | 1.x | Monorepo 管理 |
| ESLint | 8.x | 代码检查 |
| Prettier | 3.x | 代码格式化 |
| Vitest | 1.x | 单元测试 |

## 开发环境

### 系统要求

- **操作系统**: macOS, Linux, Windows
- **Node.js**: 18.x 或更高版本
- **pnpm**: 8.x 或更高版本
- **PostgreSQL**: 14+ (本地开发)

### 环境变量

#### 后端环境变量 (.env)

```bash
# 数据库
DATABASE_URL="postgresql://user:password@localhost:5432/webnote"

# JWT
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="7d"

# 服务器
PORT=3000
HOST="0.0.0.0"

# 阿里云 OSS（可选）
OSS_ACCESS_KEY_ID="your-access-key"
OSS_ACCESS_KEY_SECRET="your-secret"
OSS_BUCKET="your-bucket"
OSS_REGION="oss-cn-hangzhou"

# 日志
LOG_LEVEL="info"
```

#### 前端环境变量 (.env)

```bash
# API 地址
VITE_API_URL="http://localhost:3000"
VITE_WS_URL="ws://localhost:3000"

# 功能开关
VITE_ENABLE_OFFLINE=true
VITE_ENABLE_BACKUP=true
```

## 项目配置

### TypeScript 配置

#### 根目录 tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "moduleResolution": "node",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["packages/*/src/**/*"],
  "exclude": ["node_modules", "dist", "build"]
}
```

### ESLint 配置

```javascript
module.exports = {
  root: true,
  env: {
    node: true,
    browser: true,
    es2021: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  rules: {
    'react/react-in-jsx-scope': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
};
```

### Prettier 配置

```javascript
module.exports = {
  semi: false,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'es5',
  printWidth: 100,
  arrowParens: 'avoid',
  endOfLine: 'lf',
};
```

### Vite 配置

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          markdown: ['react-markdown'],
        },
      },
    },
  },
});
```

### Turborepo 配置

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"],
      "cache": true
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "outputs": []
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"],
      "cache": true
    }
  }
}
```

## 数据库设计

### 数据库表结构

#### User 表

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String
  name      String?
  avatar    String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  notes     Note[]
  reviews   Review[]
  backups   Backup[]
  syncQueue SyncQueue[]
}
```

#### Note 表

```prisma
model Note {
  id          String   @id @default(cuid())
  title       String
  content     String   @db.Text
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  folder      String?
  tags        String[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?
  version     Int      @default(1)

  @@index([userId, deletedAt])
  @@index([createdAt])
  @@index([updatedAt])
}
```

#### Review 表

```prisma
model Review {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  date        DateTime
  mood        Int      // 1-5 情绪评分
  completion  Float    // 0-100 完成度
  reflection  String   @db.Text
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId, date])
  @@index([date])
}
```

#### Backup 表

```prisma
model Backup {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name        String
  description String?
  ossPath     String?
  size        BigInt?
  createdAt   DateTime @default(now())
  expiresAt   DateTime?

  @@index([userId, createdAt])
}
```

#### SyncQueue 表

```prisma
model SyncQueue {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  entityType  String   // 'note', 'review'
  entityId    String
  action      String   // 'create', 'update', 'delete'
  data        Json?
  status      String   @default("pending") // 'pending', 'processing', 'completed', 'failed'
  retries     Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId, status])
  @@index([createdAt])
}
```

### 数据库索引

```sql
-- 用户索引
CREATE INDEX idx_user_email ON "User"(email);

-- 笔记索引
CREATE INDEX idx_note_user_deleted ON "Note"(userId, deletedAt) WHERE deletedAt IS NULL;
CREATE INDEX idx_note_created ON "Note"(createdAt DESC);
CREATE INDEX idx_note_updated ON "Note"(updatedAt DESC);
CREATE INDEX idx_note_folder ON "Note"(userId, folder);

-- 复盘索引
CREATE INDEX idx_review_user_date ON "Review"(userId, date DESC);
CREATE INDEX idx_review_date ON "Review"(date DESC);

-- 备份索引
CREATE INDEX idx_backup_user_created ON "Backup"(userId, createdAt DESC);

-- 同步队列索引
CREATE INDEX idx_sync_queue_status ON "SyncQueue"(userId, status);
CREATE INDEX idx_sync_queue_created ON "SyncQueue"(createdAt);
```

## API 接口规范

### 通用响应格式

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: number;
  message?: string;
}
```

### 认证接口

```typescript
// POST /api/auth/register
interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

// POST /api/auth/login
interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  token: string;
  user: User;
}
```

### 笔记接口

```typescript
// GET /api/notes
interface GetNotesQuery {
  page?: number;
  limit?: number;
  folder?: string;
  search?: string;
}

// POST /api/notes
interface CreateNoteRequest {
  title: string;
  content: string;
  folder?: string;
  tags?: string[];
}

// PUT /api/notes/:id
interface UpdateNoteRequest {
  title?: string;
  content?: string;
  folder?: string;
  tags?: string[];
}
```

### 复盘接口

```typescript
// GET /api/reviews
interface GetReviewsQuery {
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

// POST /api/reviews
interface CreateReviewRequest {
  date: string;
  mood: number;
  completion: number;
  reflection: string;
}
```

### 同步接口

```typescript
// WebSocket /ws
interface SyncMessage {
  type: 'sync' | 'conflict' | 'heartbeat';
  data: any;
}

// POST /api/sync/full
interface FullSyncRequest {
  lastSyncTime?: string;
}

// POST /api/sync/incremental
interface IncrementalSyncRequest {
  changes: SyncChange[];
}
```

### 备份接口

```typescript
// POST /api/backups
interface CreateBackupRequest {
  name: string;
  description?: string;
}

// GET /api/backups
interface GetBackupsQuery {
  page?: number;
  limit?: number;
}
```

## 依赖管理

### 共享依赖 (workspace)

```json
{
  "dependencies": {
    "@webnote/shared": "workspace:*"
  }
}
```

### 前端关键依赖

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "react-markdown": "^9.0.0",
    "zustand": "^4.4.0",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "vite": "^5.0.0",
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.0.0"
  }
}
```

### 后端关键依赖

```json
{
  "dependencies": {
    "fastify": "^4.24.0",
    "@fastify/cors": "^8.4.0",
    "@fastify/websocket": "^8.3.0",
    "@prisma/client": "^5.7.0",
    "jsonwebtoken": "^9.0.0",
    "bcrypt": "^5.1.0",
    "ali-oss": "^6.18.0"
  },
  "devDependencies": {
    "prisma": "^5.7.0",
    "typescript": "^5.3.0",
    "@types/node": "^20.10.0",
    "@types/jsonwebtoken": "^9.0.0",
    "@types/bcrypt": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

## 技术约束

### 编码规范

1. **TypeScript**
   - 必须使用严格模式
   - 不使用 `any` 类型（必要时使用 `unknown`）
   - 函数参数和返回值必须标注类型

2. **命名规范**
   - 变量和函数：camelCase
   - 类和组件：PascalCase
   - 常量：UPPER_SNAKE_CASE
   - 私有成员：前缀 `_`

3. **代码风格**
   - 使用单引号
   - 不使用分号
   - 缩进 2 空格
   - 最大行宽 100 字符

### 性能约束

- 前端页面加载时间 < 2s
- API 响应时间 < 200ms
- 数据库查询时间 < 100ms
- WebSocket 消息延迟 < 50ms

### 安全约束

- 所有 API 必须认证（除登录注册）
- 密码必须 bcrypt 加密
- 敏感数据必须 HTTPS 传输
- SQL 注入防护（使用 Prisma ORM）

### 兼容性约束

- 浏览器：Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- Node.js：18.x+
- PostgreSQL：14+

## 开发工具

### IDE 推荐

- **VS Code**: 推荐使用
  - 插件：ESLint, Prettier, Prisma, TypeScript Vue Plugin (Volar)
- **WebStorm**: 可选
  - 内置 TypeScript 支持
  - 强大的重构功能

### 推荐插件

#### VS Code 插件

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "prisma.prisma",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "vitest.explorer"
  ]
}
```

### Git 配置

```bash
# .gitignore
node_modules/
dist/
build/
.env
.env.local
*.log
coverage/
.turbo/

# Prisma
prisma/migrations/**/migration.sql
```

### Git Hooks

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "pre-push": "pnpm test"
    }
  },
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"]
  }
}
```

## 部署技术栈

### 开发环境

- **本地开发**: Vite 开发服务器
- **后端**: Fastify 开发服务器
- **数据库**: 本地 PostgreSQL

### 生产环境（规划）

- **前端**: Vercel / Netlify
- **后端**: Docker + 云服务器
- **数据库**: 云 PostgreSQL（阿里云 RDS）
- **对象存储**: 阿里云 OSS
- **CDN**: 阿里云 CDN

## 监控与日志

### 日志系统（规划）

- **日志级别**: debug, info, warn, error
- **日志格式**: JSON
- **日志存储**: 本地文件 + 云日志服务

### 监控指标（规划）

- **应用指标**: 请求量、响应时间、错误率
- **系统指标**: CPU、内存、磁盘、网络
- **业务指标**: 用户数、笔记数、同步次数

## 故障排查

### 常见问题

#### 1. 数据库连接失败

```bash
# 检查 PostgreSQL 是否运行
psql -U postgres -c "SELECT 1"

# 检查连接字符串
echo $DATABASE_URL
```

#### 2. WebSocket 连接失败

```bash
# 检查防火墙设置
# 检查 WebSocket URL 配置
echo $VITE_WS_URL
```

#### 3. 依赖安装失败

```bash
# 清理缓存
pnpm store prune

# 重新安装
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

---

**文档版本**: 1.0  
**创建日期**: 2026-01-16  
**最后更新**: 2026-01-16
