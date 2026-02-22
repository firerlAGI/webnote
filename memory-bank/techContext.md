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
JWT_SECRET="your-secure-random-key-min-32-chars"
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

### 速率限制

后端使用 `@fastify/rate-limit` 插件实现 API 速率限制：

**默认配置**：
- 限制：每个 IP 每分钟最多 100 个请求
- 时间窗口：1 分钟
- 超出限制响应：HTTP 429 Too Many Requests

**响应头**：
```
x-ratelimit-limit: 100        # 时间窗口内允许的最大请求数
x-ratelimit-remaining: 99     # 当前时间窗口内剩余的请求数
x-ratelimit-reset: 1705312345 # 时间窗口重置的时间戳
```

**超出限制时的响应**：
```json
{
  "statusCode": 429,
  "error": "Too Many Requests",
  "message": "Rate limit exceeded, retry in 60 seconds"
}
```

**配置位置**：`packages/backend/src/server.ts`

详细配置请参考：`docs/RateLimitConfig.md`

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

### Git 工作流规范

#### 功能开发流程

**重要：每当有功能变动时，必须使用git进行版本管理**

1. **功能开发前**
   - 从主分支创建新功能分支
   - 分支命名规范：`feature/功能描述` 或 `fix/问题描述`

2. **功能开发中**
   - 定期提交代码（建议每完成一个独立功能点就提交一次）
   - 提交信息遵循约定式提交规范：
     - `feat: 新功能`
     - `fix: 修复bug`
     - `docs: 文档更新`
     - `refactor: 代码重构`
     - `style: 代码格式调整`
     - `test: 测试相关`
     - `chore: 构建或工具配置`

3. **功能开发后**
   - 确保代码通过测试和lint检查
   - 推送到远程仓库
   - 创建Pull Request进行代码审查
   - 合并到主分支前必须通过审查

4. **合并后**
   - 删除已合并的功能分支
   - 更新CHANGELOG.md记录变更

#### 提交规范

```bash
# 格式
<type>(<scope>): <subject>

<body>

<footer>

# 示例
feat(notes): 添加笔记标签功能

- 支持为笔记添加多个标签
- 实现标签搜索功能
- 标签数据存储优化

Closes #123
```

#### 分支策略

- `main`: 主分支，始终保持稳定可部署
- `develop`: 开发分支（如需要）
- `feature/*`: 功能开发分支
- `fix/*`: bug修复分支
- `hotfix/*`: 紧急修复分支

#### 强制要求

⚠️ **所有代码变更必须使用git版本控制，包括小更新和修改**

- **不允许**任何未提交的代码变更（无论大小）
- **即使是**：
  - 简单的文案修改
  - CSS样式调整
  - 配置文件更新
  - 小bug修复
  - 代码格式化
  - 单个文件或单行代码的改动
- **每次**提交都应该是完整、可回滚的功能点或修改
- 提交前必须确保项目可以正常运行
- 敏感信息不得提交到git（已在.gitignore中配置）
- 每日工作结束前必须提交当日所有改动

#### 提交频率建议

- 大功能开发：每完成一个独立模块提交一次
- 小功能/修复：立即提交，不积累
- 配置更新：修改后立即提交
- 文档更新：修改后立即提交
- 代码重构：每完成一个重构步骤提交一次

**记住：没有"太小不值得一提交"的改动，每次改动都有其价值，都应该被记录。**

## 生产环境部署

### 服务器配置

- **IP 地址**: 120.26.50.152
- **SSH 用户**: root
- **SSH 密码**: `REDACTED_PASSWORD`
- **操作系统**: Ubuntu/Debian
- **部署路径**: `/var/www/webnote`

### 数据库配置

- **数据库类型**: SQLite
- **数据库文件**: `/var/www/webnote/backend/dev.db`
- **连接字符串**: `DATABASE_URL=file:./dev.db`
- **注意**: SQLite 不需要密码认证

### JWT 配置

#### 密钥强度要求

**重要安全要求：**

1. **最小长度**: JWT_SECRET 必须至少 32 字符
2. **字符复杂度**: 建议包含大小写字母、数字和特殊字符
3. **随机性**: 必须使用加密安全的随机生成方法
4. **禁止弱密钥**: 不得使用默认值、常见单词或可预测模式

#### 密钥生成方法

```bash
# 方法1 - Node.js (推荐)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# 方法2 - OpenSSL
openssl rand -base64 32

# 方法3 - Python
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

#### 示例密钥格式

```
# 示例 (请勿在生产环境使用此密钥！)
Kx8mP2nQ5vR9wY3zA7bC1dE6fG0hJ4kL+MnOpQrStUvWxYz==
```

#### 生产环境配置

- **JWT_SECRET**: 使用加密安全的随机密钥（至少 32 字符）
- **过期时间**: 7d
- **配置文件**: `/var/www/webnote/backend/.env`
- **配置模板**: `deploy/backend/.env.production.example`

#### 密钥轮换建议

- 建议每 90 天轮换一次 JWT_SECRET
- 轮换时需要通知所有用户重新登录
- 保留旧密钥的过渡期以支持平滑迁移

### 应用端口

- **前端**: 80 (HTTP), 443 (HTTPS)
- **后端 API**: 3000

### 环境变量

**后端环境变量位置**: `/var/www/webnote/backend/.env`

```bash
# 数据库（SQLite）
DATABASE_URL="file:./dev.db"

# JWT (使用加密安全的随机密钥，至少32字符)
JWT_SECRET="YOUR_SECURE_JWT_SECRET_HERE_MIN_32_CHARS"
JWT_EXPIRES_IN="7d"

# 服务器
PORT=3000
NODE_ENV=production
HOST="0.0.0.0"

# CORS
ALLOWED_ORIGINS="http://120.26.50.152,http://localhost:5173,http://localhost:3000"

# 阿里云 OSS（如果使用）
OSS_ACCESS_KEY_ID="your-key"
OSS_ACCESS_KEY_SECRET="your-secret"
OSS_BUCKET="webnote-backups"
OSS_REGION="oss-cn-hangzhou"
```

### 部署流程

#### 快速部署（推荐）

```bash
# 从项目根目录执行
./scripts/deploy.sh
```

#### 手动部署步骤

1. **构建项目**
   ```bash
   pnpm build
   ```

2. **上传到服务器**
   - 前端：`/var/www/webnote/web/dist`
   - 后端：`/var/www/webnote/backend/dist`

3. **运行数据库迁移**
   ```bash
   ssh root@120.26.50.152 "cd /var/www/webnote/backend && npx prisma migrate deploy"
   ```

4. **重启服务**
   ```bash
   ssh root@120.26.50.152 "pm2 restart webnote-backend"
   ```

5. **验证部署**
   ```bash
   curl http://120.26.50.152/api/health
   ```

### 配置文件位置

- **Nginx 配置**: `/etc/nginx/sites-available/webnote`
- **PM2 配置**: `/var/www/webnote/backend/ecosystem.config.js`

### 常用命令

#### SSH 连接

```bash
# 基本连接
ssh root@120.26.50.152

# 执行单条命令
ssh root@120.26.50.152 "命令"

# 传输文件
scp local_file root@120.26.50.152:/path/destination
```

#### 服务管理

```bash
# PM2 服务
ssh root@120.26.50.152 "pm2 status"
ssh root@120.26.50.152 "pm2 restart webnote-backend"
ssh root@120.26.50.152 "pm2 stop webnote-backend"
ssh root@120.26.50.152 "pm2 logs webnote-backend"

# Nginx 服务
ssh root@120.26.50.152 "sudo systemctl status nginx"
ssh root@120.26.50.152 "sudo systemctl restart nginx"
ssh root@120.26.50.152 "sudo nginx -t"
```

#### 查看日志

```bash
# 后端日志
ssh root@120.26.50.152 "tail -f /var/www/webnote/backend/logs/out.log"
ssh root@120.26.50.152 "tail -f /var/www/webnote/backend/logs/err.log"

# Nginx 日志
ssh root@120.26.50.152 "tail -f /var/log/nginx/access.log"
ssh root@120.26.50.152 "tail -f /var/log/nginx/error.log"
```

#### 数据库操作（SQLite）

```bash
# 连接数据库
ssh root@120.26.50.152 "cd /var/www/webnote/backend && sqlite3 dev.db"

# 查看所有表
.tables

# 查看表结构
.schema users

# 查看用户数据
SELECT * FROM users;

# 退出
.quit
```

### 验证部署

```bash
# 测试 API
curl http://120.26.50.152/api/health

# 测试前端
curl http://120.26.50.152

# 检查端口
ssh root@120.26.50.152 "sudo netstat -tulpn | grep -E ':(3000|80|443)'"
```

### 备份

#### 数据库备份

```bash
# 创建备份
ssh root@120.26.50.152 << 'ENDSSH'
mkdir -p /var/backups/webnote
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
cp /var/www/webnote/backend/dev.db /var/backups/webnote/db_$BACKUP_DATE.db
gzip /var/backups/webnote/db_$BACKUP_DATE.db
ENDSSH

# 列出备份
ssh root@120.26.50.152 "ls -lh /var/backups/webnote/"
```

#### 恢复数据库

```bash
ssh root@120.26.50.152 << 'ENDSSH'
gunzip -c /var/backups/webnote/db_20240114_120000.db.gz > /var/www/webnote/backend/dev.db
ENDSSH
```

### 故障排除

#### 后端无法启动

```bash
# 检查端口占用
ssh root@120.26.50.152 "sudo lsof -i :3000"

# 检查环境变量
ssh root@120.26.50.152 "cat /var/www/webnote/backend/.env"

# 查看错误日志
ssh root@120.26.50.152 "pm2 logs webnote-backend --err"
```

#### 数据库连接失败

```bash
# 检查数据库文件是否存在
ssh root@120.26.50.152 "ls -lh /var/www/webnote/backend/dev.db"

# 检查数据库文件权限
ssh root@120.26.50.152 "ls -l /var/www/webnote/backend/dev.db"

# 测试数据库连接
ssh root@120.26.50.152 "cd /var/www/webnote/backend && sqlite3 dev.db '.tables'"
```

#### Nginx 502 错误

```bash
# 检查后端是否运行
ssh root@120.26.50.152 "pm2 status"

# 测试后端端口
curl http://120.26.50.152:3000/api/health

# 检查 Nginx 配置
ssh root@120.26.50.152 "sudo nginx -t"

# 重启 Nginx
ssh root@120.26.50.152 "sudo systemctl restart nginx"
```

#### 前端 404

```bash
# 检查构建目录
ssh root@120.26.50.152 "ls -la /var/www/webnote/web/dist"

# 检查 Nginx 配置的 root 路径
ssh root@120.26.50.152 "grep root /etc/nginx/sites-enabled/webnote"
```

### 性能监控

```bash
# PM2 监控
ssh root@120.26.50.152 "pm2 monit"

# 系统资源
ssh root@120.26.50.152 "htop"

# 磁盘使用
ssh root@120.26.50.152 "df -h"

# 网络连接
ssh root@120.26.50.152 "ss -tulpn"
```

### 安全建议

- **防火墙配置**: 仅开放 22 (SSH)、80 (HTTP)、443 (HTTPS) 端口
- **定期更新**: 执行 `sudo apt update && sudo apt upgrade -y`
- **备份策略**: 定期备份数据库和应用代码
- **日志监控**: 定期检查日志文件大小

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

**文档版本**: 1.1  
**创建日期**: 2026-01-16  
**最后更新**: 2026-01-18
