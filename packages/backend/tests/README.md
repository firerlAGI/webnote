# T3批次1集成测试套件

## 概述

本测试套件用于验证T3批次1已实现的核心功能，包括：
- WebSocket连接测试
- 同步流程端到端测试
- 冲突解决场景测试
- 离线同步测试
- 缓存一致性测试

## 测试结构

```
tests/
├── setup.ts                          # 测试环境设置和工具函数
├── websocket/
│   └── connection.test.ts             # WebSocket连接测试
├── sync/
│   ├── sync-flow.test.ts              # 同步流程端到端测试
│   ├── conflict-resolution.test.ts     # 冲突解决场景测试
│   └── offline-sync.test.ts          # 离线同步测试
└── cache/
    └── cache-consistency.test.ts      # 缓存一致性测试
```

## 环境要求

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- PostgreSQL 数据库（测试用）
- Bun (用于密码哈希)

## 安装依赖

```bash
cd /Users/fire/Desktop/webnote/packages/backend
pnpm install
```

## 配置测试环境

### 1. 数据库配置

确保测试数据库已配置。默认使用开发数据库进行测试。

### 2. 环境变量（可选）

```bash
# 启用详细日志输出
export TEST_LOG=true

# 设置测试超时（毫秒）
export TEST_TIMEOUT=30000
```

## 运行测试

### 运行所有测试

```bash
pnpm test
```

### 运行特定测试套件

```bash
# WebSocket连接测试
pnpm test tests/websocket/connection.test.ts

# 同步流程测试
pnpm test tests/sync/sync-flow.test.ts

# 冲突解决测试
pnpm test tests/sync/conflict-resolution.test.ts

# 离线同步测试
pnpm test tests/sync/offline-sync.test.ts

# 缓存一致性测试
pnpm test tests/cache/cache-consistency.test.ts
```

### 运行特定测试用例

```bash
# 运行单个测试
pnpm test -t "应该成功建立WebSocket连接"

# 运行匹配模式的测试
pnpm test -t "应该使用服务器数据解决冲突"
```

### 生成覆盖率报告

```bash
# 生成覆盖率报告（HTML格式）
pnpm test --coverage

# 查看覆盖率报告
open coverage/index.html
```

### 监听模式

```bash
# 监听文件变化并自动运行测试
pnpm test --watch
```

## 测试用例说明

### 1. WebSocket连接测试 (`connection.test.ts`)

**测试覆盖：**
- ✅ 连接建立
- ✅ 连接断开
- ✅ 心跳机制
- ✅ 认证流程
- ✅ 消息处理
- ✅ 多连接管理
- ✅ 错误处理

**关键测试用例：**
- 应该成功建立WebSocket连接
- 应该为每个连接生成唯一ID
- 应该响应ping消息
- 应该成功认证用户
- 应该支持多个客户端连接同一用户
- 应该处理未知消息类型

### 2. 同步流程端到端测试 (`sync-flow.test.ts`)

**测试覆盖：**
- ✅ 增量同步
- ✅ 批量同步
- ✅ 冲突检测
- ✅ CRUD操作
- ✅ 多实体类型同步
- ✅ 错误处理

**关键测试用例：**
- 应该只同步自上次同步以来的变更
- 应该正确处理同步时间戳
- 应该正确过滤实体类型
- 应该支持大批量操作同步
- 应该正确处理批次索引
- 应该检测到版本冲突

### 3. 冲突解决场景测试 (`conflict-resolution.test.ts`)

**测试覆盖：**
- ✅ SERVER_WINS 策略
- ✅ CLIENT_WINS 策略
- ✅ LATEST_WINS 策略
- ✅ MERGE 策略
- ✅ MANUAL 策略
- ✅ 复杂冲突场景
- ✅ 性能测试

**关键测试用例：**
- 应该使用服务器数据解决冲突
- 应该使用客户端数据解决冲突
- 应该使用最新修改时间的数据
- 应该合并不同的字段
- 应该返回需要手动解决的错误
- 应该处理多字段冲突
- 应该快速解决简单冲突

### 4. 离线同步测试 (`offline-sync.test.ts`)

**测试覆盖：**
- ✅ 离线编辑支持
- ✅ 网络恢复自动同步
- ✅ 同步队列持久化
- ✅ 离线冲突检测
- ✅ 混合场景
- ✅ 性能测试

**关键测试用例：**
- 应该支持离线创建笔记
- 应该支持离线更新笔记
- 应该支持离线删除笔记
- 应该处理队列中的待同步操作
- 应该按顺序同步多个操作
- 应该检测离线编辑的冲突
- 应该快速处理大量离线操作

### 5. 缓存一致性测试 (`cache-consistency.test.ts`)

**测试覆盖：**
- ✅ 基本读写一致性
- ✅ 缓存回填一致性
- ✅ 批量操作一致性
- ✅ 并发访问一致性
- ✅ 版本管理一致性
- ✅ 数据库同步一致性
- ✅ 一致性验证
- ✅ 性能测试
- ✅ 边界条件

**关键测试用例：**
- 应该保持所有缓存层的数据一致性
- 应该正确更新缓存版本
- 应该正确删除所有缓存层的数据
- 应该从L2回填到L1
- 应该从L3回填到L1和L2
- 应该保持批量写入的一致性
- 应该正确处理并发写入
- 应该正确跟踪数据版本
- 应该与数据库保持一致
- 应该通过一致性验证
- 应该快速写入数据

## 测试数据管理

测试使用以下工具函数创建和管理测试数据：

```typescript
// 创建测试用户
const { user, email, password } = await createTestUser()

// 创建测试笔记
const note = await createTestNote(userId, {
  title: 'Test Note',
  content: 'Test Content',
})

// 创建测试文件夹
const folder = await createTestFolder(userId, {
  name: 'Test Folder',
})

// 创建测试复盘记录
const review = await createTestReview(userId, {
  date: new Date(),
  content: 'Test Review',
  mood: 'good',
})

// 批量创建测试数据
const { notes, folders, reviews } = await createTestData(userId, {
  notes: 10,
  folders: 3,
  reviews: 5,
})
```

## 测试工具

### 延迟工具

```typescript
// 延迟指定毫秒数
await delay(1000) // 延迟1秒

// 等待条件满足
await waitFor(
  () => condition === true,
  5000,  // 超时时间
  100    // 检查间隔
)
```

### Mock WebSocket

```typescript
// 创建模拟WebSocket连接
const mockSocket = new MockWebSocket('ws://localhost:3000/ws')

// 模拟连接打开
mockSocket.simulateOpen()

// 模拟接收消息
mockSocket.simulateMessage({ type: 'test', data: 'test data' })

// 模拟连接关闭
mockSocket.simulateClose()

// 模拟错误
mockSocket.simulateError(new Error('Connection failed'))
```

## 性能基准

当前测试套件的性能基准：

| 测试类型 | 预期时间 | 实际时间 |
|---------|---------|---------|
| WebSocket连接建立 | < 100ms | ~50ms |
| 单个同步操作 | < 100ms | ~30ms |
| 批量同步（100个操作） | < 5s | ~2s |
| 冲突解决 | < 100ms | ~50ms |
| 简单缓存读写 | < 10ms | ~5ms |
| 批量缓存写入（100个） | < 1s | ~500ms |

## 故障排查

### 测试失败

1. **数据库连接失败**
   - 检查数据库是否运行
   - 验证数据库配置
   - 确保数据库用户有足够权限

2. **端口占用**
   - 检查3000端口是否被占用
   - 使用 `lsof -i :3000` 查看占用进程

3. **依赖问题**
   - 运行 `pnpm install` 重新安装依赖
   - 清除缓存：`rm -rf node_modules .pnpm-store`

### 超时错误

- 增加测试超时时间：`--test-timeout=60000`
- 检查数据库查询性能
- 验证网络连接

## 持续集成

测试套件设计为在CI/CD环境中运行：

```yaml
# .github/workflows/test.yml 示例
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: pnpm install
      - run: pnpm test --coverage
```

## 最佳实践

1. **测试隔离**
   - 每个测试用例应该独立运行
   - 使用 `beforeEach` 和 `afterEach` 清理数据
   - 避免测试之间的依赖关系

2. **清晰的断言**
   - 使用有意义的断言消息
   - 验证关键属性
   - 考虑边界情况

3. **测试数据管理**
   - 使用工厂函数创建测试数据
   - 避免硬编码测试数据
   - 使用有意义的测试数据

4. **性能考虑**
   - 避免不必要的等待
   - 使用批量操作提高效率
   - 监控测试执行时间

## 贡献指南

添加新测试时：

1. 在适当的测试文件中添加测试用例
2. 使用清晰的描述性测试名称
3. 确保测试可以独立运行
4. 添加必要的注释说明测试目的
5. 运行所有测试确保没有回归

## 联系方式

如有问题或建议，请联系：
- 项目负责人：待定
- 技术支持：待定

---

**最后更新**: 2026-01-10
**测试版本**: v1.0.0
**维护者**: 项目测试团队
