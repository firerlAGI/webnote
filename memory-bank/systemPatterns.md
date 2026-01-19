# System Patterns - WebNote

## 系统架构概览

### 整体架构

WebNote 采用经典的 Monorepo 架构，分为前端、后端和共享代码三个主要部分。

```
┌─────────────────────────────────────────────────────────┐
│                    WebNote System                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐         ┌──────────────┐            │
│  │   Frontend   │         │   Backend    │            │
│  │   (React)    │◄──────►│  (Fastify)    │            │
│  └──────┬───────┘         └──────┬───────┘            │
│         │                        │                      │
│         │                        │                      │
│         │                        │                      │
│         │                        ▼                      │
│         │               ┌─────────────────┐            │
│         └──────────────►│  PostgreSQL DB  │            │
│                         └─────────────────┘            │
│                                                         │
│  ┌──────────────────────────────────────────┐           │
│  │         Shared Code (TypeScript)        │           │
│  │  ┌──────┐  ┌──────┐  ┌──────┐         │           │
│  │  │Types │  │Utils │  │ API  │         │           │
│  │  └──────┘  └──────┘  └──────┘         │           │
│  └──────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────┘
```

### 分层架构

```
┌─────────────────────────────────────────────────────────┐
│                   Presentation Layer                  │
│   Frontend: React Components + Pages                  │
└─────────────────────────────────────────────────────────┘
                          │
                          │ API Calls (HTTP/WebSocket)
                          │
┌─────────────────────────────────────────────────────────┐
│                    Application Layer                   │
│   Backend: Services + Controllers + Routes            │
└─────────────────────────────────────────────────────────┘
                          │
                          │ Prisma ORM
                          │
┌─────────────────────────────────────────────────────────┐
│                      Data Layer                        │
│   Database: PostgreSQL (Tables, Indexes, Relations)     │
└─────────────────────────────────────────────────────────┘
```

## 关键技术决策

### 1. Monorepo 架构

**决策**: 使用 Turborepo + pnpm 管理 Monorepo

**理由**:
- 提高开发效率，共享代码和配置
- 统一构建和测试流程
- 减少依赖冲突
- 便于版本管理

**实现**:
```json
// package.json
{
  "workspaces": ["packages/*"],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint"
  }
}
```

**包结构**:
```
packages/
├── backend/       # 后端服务
├── web/          # 前端应用
├── shared/       # 共享代码
├── ui-components/# 共享 UI 组件（规划中）
├── config/       # 共享配置（规划中）
└── browser-extension/ # 浏览器插件（规划中）
```

### 2. 前端技术栈

**决策**: React 18 + TypeScript + Vite + TailwindCSS

**理由**:
- React: 成熟稳定，生态丰富
- TypeScript: 类型安全，提高代码质量
- Vite: 快速的构建工具，开发体验好
- TailwindCSS: 实用优先的 CSS 框架，快速开发

**关键组件**:
- **状态管理**: React Context API
- **路由**: React Router
- **Markdown 编辑器**: react-markdown + 自定义工具栏
- **数据同步**: WebSocketClient + HybridCache + SyncManager

### 3. 后端技术栈

**决策**: Node.js + Fastify + PostgreSQL + Prisma

**理由**:
- Node.js: JavaScript 全栈开发，减少语言切换成本
- Fastify: 高性能的 Web 框架，易于扩展
- PostgreSQL: 成熟的关系型数据库，支持复杂查询
- Prisma: 类型安全的 ORM，开发体验好

**关键服务**:
- **用户认证**: JWT + bcrypt
- **笔记管理**: CRUD + 搜索
- **复盘管理**: CRUD + 统计
- **数据同步**: WebSocket + SyncService
- **数据备份**: BackupService + 阿里云 OSS

### 4. 数据同步架构

**决策**: 三层架构（表现层 + 缓存层 + 传输层）

**理由**:
- 职责分离，易于维护
- 支持离线模式
- 高性能，低延迟

**实现**:
```
┌─────────────────────────────────────────────────────────┐
│              Presentation Layer                        │
│         SyncManager (State Machine)                    │
│  - 事件驱动                                          │
│  - 状态转换                                          │
│  - 冲突解决                                          │
└─────────────────────────────────────────────────────────┘
                         │
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│               Cache Layer                              │
│          HybridCache (3-Level)                         │
│  ┌──────────┐  ┌───────────┐  ┌──────────────┐       │
│  │ Memory   │  │IndexedDB │  │LocalStorage  │       │
│  │ (Hot)    │  │ (Warm)   │  │ (Cold)      │       │
│  └──────────┘  └───────────┘  └──────────────┘       │
│         │            │               │                │
│         └────────────┴───────────────┘                │
│                      LRU 淘汰策略                      │
└─────────────────────────────────────────────────────────┘
                         │
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              Transport Layer                           │
│           WebSocketClient                              │
│  - WebSocket 实时通信                                 │
│  - HTTP 降级                                          │
│  - 心跳机制                                           │
│  - 指数退避重连                                       │
└─────────────────────────────────────────────────────────┘
```

**关键特性**:
- **离线优先**: 优先使用本地缓存
- **增量同步**: 只同步变更数据
- **冲突解决**: 5 种策略（LATEST_WINS, SERVER_WINS, CLIENT_WINS, MERGE, MANUAL）
- **心跳机制**: 保持连接活跃
- **指数退避**: 智能重连

## 设计模式

### 1. 服务层模式 (Service Layer)

**应用场景**: 后端业务逻辑封装

**实现**:
```typescript
// SyncService.ts
class SyncService {
  // 公共方法（API 路由调用）
  async fullSync(userId: string) { }
  async incrementalSync(userId: string) { }
  
  // 私有方法
  private async handleSyncRequest() { }
  private async detectConflict() { }
  private async resolveConflict() { }
}
```

**优点**:
- 清晰的职责分离
- 易于测试
- 易于维护

### 2. 状态机模式 (State Machine)

**应用场景**: 同步状态管理

**实现**:
```typescript
// SyncManager.ts
enum SyncState {
  IDLE = 'idle',
  SYNCING = 'syncing',
  CONFLICT = 'conflict',
  OFFLINE = 'offline',
  ERROR = 'error'
}

class SyncManager {
  private state: SyncState = SyncState.IDLE;
  
  private transitionTo(newState: SyncState) {
    // 验证状态转换合法性
    if (!this.canTransition(this.state, newState)) {
      throw new Error(`Invalid state transition: ${this.state} -> ${newState}`);
    }
    
    const oldState = this.state;
    this.state = newState;
    
    // 触发相应事件
    this.emit('stateChange', { oldState, newState });
    
    // 更新 UI 状态
    this.updateUI();
  }
  
  private canTransition(from: SyncState, to: SyncState): boolean {
    const transitions: Record<SyncState, SyncState[]> = {
      IDLE: ['SYNCING', 'OFFLINE', 'ERROR'],
      SYNCING: ['IDLE', 'CONFLICT', 'OFFLINE', 'ERROR'],
      CONFLICT: ['SYNCING', 'IDLE'],
      OFFLINE: ['SYNCING', 'IDLE'],
      ERROR: ['IDLE']
    };
    return transitions[from].includes(to);
  }
}
```

**优点**:
- 清晰的状态管理
- 可预测的行为
- 易于调试

### 3. 策略模式 (Strategy Pattern)

**应用场景**: 冲突解决策略

**实现**:
```typescript
// SyncService.ts
enum ConflictResolutionStrategy {
  LATEST_WINS = 'latest_wins',
  SERVER_WINS = 'server_wins',
  CLIENT_WINS = 'client_wins',
  MERGE = 'merge',
  MANUAL = 'manual'
}

class SyncService {
  async resolveConflict(
    conflict: Conflict,
    strategy: ConflictResolutionStrategy
  ): Promise<ResolvedData> {
    switch (strategy) {
      case ConflictResolutionStrategy.LATEST_WINS:
        return this.resolveLatestWins(conflict);
      case ConflictResolutionStrategy.SERVER_WINS:
        return conflict.serverVersion;
      case ConflictResolutionStrategy.CLIENT_WINS:
        return conflict.clientVersion;
      case ConflictResolutionStrategy.MERGE:
        return this.mergeVersions(conflict);
      case ConflictResolutionStrategy.MANUAL:
        throw new ManualResolutionRequiredError(conflict);
      default:
        throw new Error(`Unknown strategy: ${strategy}`);
    }
  }
  
  private resolveLatestWins(conflict: Conflict): ResolvedData {
    return conflict.clientVersion.updatedAt > conflict.serverVersion.updatedAt
      ? conflict.clientVersion
      : conflict.serverVersion;
  }
  
  private mergeVersions(conflict: Conflict): ResolvedData {
    // 实现合并逻辑
  }
}
```

**优点**:
- 灵活的冲突解决
- 易于扩展新策略
- 用户可自定义策略

### 4. 观察者模式 (Observer Pattern)

**应用场景**: 事件驱动架构

**实现**:
```typescript
// WebSocketClient.ts
class WebSocketClient {
  private listeners: Map<string, Set<Function>> = new Map();
  
  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }
  
  off(event: string, callback: Function) {
    this.listeners.get(event)?.delete(callback);
  }
  
  emit(event: string, data: any) {
    this.listeners.get(event)?.forEach(callback => callback(data));
  }
  
  private handleMessage(message: Message) {
    switch (message.type) {
      case 'sync':
        this.emit('sync', message.data);
        break;
      case 'conflict':
        this.emit('conflict', message.data);
        break;
      case 'heartbeat':
        this.emit('heartbeat', message.data);
        break;
    }
  }
}
```

**优点**:
- 解耦组件
- 易于扩展
- 支持多个监听者

### 5. 单例模式 (Singleton Pattern)

**应用场景**: 全局服务实例

**实现**:
```typescript
// HybridCache.ts
class HybridCache {
  private static instance: HybridCache;
  
  private constructor() {
    // 私有构造函数
  }
  
  static getInstance(): HybridCache {
    if (!HybridCache.instance) {
      HybridCache.instance = new HybridCache();
    }
    return HybridCache.instance;
  }
  
  async get(key: string): Promise<any> { }
  async set(key: string, value: any): Promise<void> { }
  async delete(key: string): Promise<void> { }
}

// 使用
const cache = HybridCache.getInstance();
```

**优点**:
- 确保只有一个实例
- 全局访问点
- 延迟初始化

### 6. 工厂模式 (Factory Pattern)

**应用场景**: API 响应对象创建

**实现**:
```typescript
// ResponseFactory.ts
class ResponseFactory {
  static success<T>(data: T, message?: string): ApiResponse<T> {
    return {
      success: true,
      data,
      message
    };
  }
  
  static error(error: string, code?: number): ApiResponse<null> {
    return {
      success: false,
      error,
      code
    };
  }
}

// 使用
return ResponseFactory.success({ id: 1, title: 'Note' }, '创建成功');
return ResponseFactory.error('用户不存在', 404);
```

**优点**:
- 统一的响应格式
- 易于维护
- 减少重复代码

## 关键实现路径

### 1. 用户认证流程

```
┌─────────────┐     1. 注册/登录      ┌─────────────┐
│   Client    │ ───────────────────► │   Backend    │
└─────────────┘                     └──────┬──────┘
                                           │
                                           │ 2. 验证凭证
                                           ▼
                                    ┌─────────────┐
                                    │ PostgreSQL  │
                                    └──────┬──────┘
                                           │
                                           │ 3. 返回用户信息
                                           ▼
                                    ┌─────────────┐
                                    │   Backend    │
                                    └──────┬──────┘
                                           │
                                           │ 4. 生成 JWT
                                           ▼
┌─────────────┐     5. 返回 Token     ┌─────────────┐
│   Client    │ ◄─────────────────── │   Backend    │
└─────────────┘                     └─────────────┘
       │
       │ 6. 存储 Token
       ▼
┌─────────────┐
│  LocalStore │
└─────────────┘
```

### 2. 笔记 CRUD 流程

```
┌─────────────┐     1. 获取笔记列表    ┌─────────────┐
│   Client    │ ───────────────────► │   Backend    │
└─────────────┘                     └──────┬──────┘
                                           │
                                           │ 2. 查询数据库
                                           ▼
                                    ┌─────────────┐
                                    │ PostgreSQL  │
                                    └──────┬──────┘
                                           │
                                           │ 3. 返回笔记列表
                                           ▼
                                    ┌─────────────┐
                                    │   Backend    │
                                    └──────┬──────┘
                                           │
                                           │ 4. 返回响应
                                           ▼
┌─────────────┐     5. 显示笔记        ┌─────────────┐
│   Client    │ ◄─────────────────── │   Backend    │
└─────────────┘                     └─────────────┘

创建/编辑笔记流程类似，但方向相反
```

### 3. 数据同步流程

```
┌─────────────┐                       ┌─────────────┐
│   Client    │                       │   Backend    │
└──────┬──────┘                       └──────┬──────┘
       │                                     │
       │ 1. 建立连接                          │
       │ ────────────────────────────────────► │
       │                                     │
       │ 2. 认证（发送 JWT）                  │
       │ ────────────────────────────────────► │
       │                                     │
       │ 3. 心跳保活                          │
       │ ◄─────────────────────────────────── │
       │                                     │
       │ 4. 检测到本地变更                    │
       │                                     │
       │ 5. 发送同步请求                      │
       │ ────────────────────────────────────► │
       │                                     │
       │                               6. 检测冲突
       │                                     │
       │ 7. 返回冲突（如有）或确认            │
       │ ◄─────────────────────────────────── │
       │                                     │
       │ 8. 解决冲突（如需要）                │
       │                                     │
       │ 9. 确认最终版本                      │
       │ ────────────────────────────────────► │
       │                                     │
       │                               10. 保存到数据库
       │                                     │
       │ 11. 广播更新                         │
       │ ◄─────────────────────────────────── │
       │                                     │
       │ 12. 更新本地缓存                    │
       │                                     │
       │ 13. 更新 UI                         │
```

### 4. 数据备份流程

```
┌─────────────┐                       ┌─────────────┐
│   Client    │                       │   Backend    │
└──────┬──────┘                       └──────┬──────┘
       │                                     │
       │ 1. 请求创建备份                      │
       │ ────────────────────────────────────► │
       │                                     │
       │                               2. 导出数据
       │                                     │
       │                               3. 加密数据
       │                                     │
       │                               4. 上传到 OSS
       │                                     │
       │ 5. 返回备份信息                      │
       │ ◄─────────────────────────────────── │
       │                                     │
       │ 6. 显示备份列表                      │
```

## 组件关系

### 前端组件层次

```
App.tsx
├── AuthPage.tsx
│   ├── LoginForm
│   └── RegisterForm
├── Dashboard.tsx (主布局)
│   ├── Sidebar.tsx
│   ├── NotesPage.tsx
│   │   ├── NoteList
│   │   ├── NoteEditor (Markdown)
│   │   └── SearchBar
│   ├── ReviewPage.tsx
│   │   ├── ReviewForm
│   │   ├── ReviewList
│   │   └── ReviewCharts
│   └── SettingsPage.tsx
│       ├── ProfileSettings
│       └── SyncSettings (SyncStatus)
└── ContextProvider
    ├── DataContext (数据状态)
    └── AuthContext (认证状态)
```

### 后端服务层次

```
server.ts (入口)
├── Middlewares
│   ├── AuthMiddleware (JWT 验证)
│   ├── ErrorMiddleware (错误处理)
│   └── LoggingMiddleware (日志)
├── Routes
│   ├── authRoutes (认证)
│   ├── noteRoutes (笔记)
│   ├── reviewRoutes (复盘)
│   └── syncRoutes (同步)
├── Services
│   ├── AuthService (认证服务)
│   ├── NoteService (笔记服务)
│   ├── ReviewService (复盘服务)
│   ├── SyncService (同步服务)
│   └── BackupService (备份服务)
├── Models (Prisma)
│   ├── User
│   ├── Note
│   ├── Review
│   └── Backup
└── Utils
    ├── jwt (JWT 工具)
    ├── crypto (加密工具)
    └── oss (OSS 工具)
```

## 性能优化策略

### 1. 前端优化

- **代码分割**: 使用 React.lazy 和 Suspense
- **懒加载**: 路由级别的懒加载
- **虚拟列表**: 大列表使用虚拟滚动
- **缓存**: 三级缓存架构
- **防抖/节流**: 搜索和输入优化
- **图片优化**: 延迟加载、WebP 格式

### 2. 后端优化

- **索引优化**: 数据库索引
- **查询优化**: N+1 查询优化
- **连接池**: PostgreSQL 连接池
- **缓存**: Redis 缓存（规划中）
- **压缩**: 响应数据压缩

### 3. 网络优化

- **增量同步**: 只传输变更数据
- **压缩**: WebSocket 消息压缩
- **CDN**: 静态资源 CDN（规划中）

## 安全措施

### 1. 认证与授权

- JWT Token 认证
- 密码 bcrypt 加密
- Token 过期机制

### 2. 数据安全

- HTTPS 传输加密
- 数据库连接加密
- 敏感数据加密存储

### 3. 防护措施

- SQL 注入防护（Prisma ORM）
- XSS 防护（DOMPurify）
- CSRF 防护（Token 验证）
- 速率限制

## 扩展性设计

### 1. 水平扩展

- 无状态服务设计
- 负载均衡支持
- 数据库读写分离（规划中）

### 2. 功能扩展

- 插件系统（规划中）
- WebHook（规划中）
- API 版本管理（规划中）

### 3. 架构扩展

- 微服务架构（未来考虑）
- 事件驱动架构（未来考虑）

---

**文档版本**: 1.1  
**创建日期**: 2026-01-16  
**最后更新**: 2026-01-18
