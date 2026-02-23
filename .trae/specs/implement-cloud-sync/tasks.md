# Tasks

## 阶段 1: 本地缓存层实现

- [x] Task 1: 创建 IndexedDB 数据库和存储结构
  - [x] SubTask 1.1: 创建 `packages/web/src/services/cache/Database.ts` - IndexedDB 数据库初始化
  - [x] SubTask 1.2: 定义 notes、folders、reviews、syncQueue 存储结构
  - [x] SubTask 1.3: 实现数据库版本迁移机制

- [x] Task 2: 实现缓存服务层
  - [x] SubTask 2.1: 创建 `packages/web/src/services/cache/CacheService.ts` - 缓存读写接口
  - [x] SubTask 2.2: 实现笔记缓存操作（CRUD）
  - [x] SubTask 2.3: 实现文件夹缓存操作
  - [x] SubTask 2.4: 实现复盘缓存操作
  - [x] SubTask 2.5: 实现同步队列缓存操作

- [x] Task 3: 实现缓存一致性管理
  - [x] SubTask 3.1: 创建 `packages/web/src/services/cache/CacheConsistency.ts`
  - [x] SubTask 3.2: 实现数据版本比较逻辑
  - [x] SubTask 3.3: 实现增量更新机制

## 阶段 2: 同步客户端实现

- [x] Task 4: 创建 WebSocket 同步客户端
  - [x] SubTask 4.1: 创建 `packages/web/src/services/sync/WebSocketClient.ts`
  - [x] SubTask 4.2: 实现 WebSocket 连接管理（连接、断开、重连）
  - [x] SubTask 4.3: 实现心跳机制
  - [x] SubTask 4.4: 实现消息序列化和反序列化

- [x] Task 5: 创建 HTTP 轮询降级客户端
  - [x] SubTask 5.1: 创建 `packages/web/src/services/sync/HTTPPollingClient.ts`
  - [x] SubTask 5.2: 实现轮询逻辑和间隔调整
  - [x] SubTask 5.3: 实现增量同步请求

- [x] Task 6: 创建同步管理器
  - [x] SubTask 6.1: 创建 `packages/web/src/services/sync/SyncManager.ts`
  - [x] SubTask 6.2: 实现同步状态机（idle/syncing/offline/conflict）
  - [x] SubTask 6.3: 实现 WebSocket 和 HTTP 轮询的自动切换
  - [x] SubTask 6.4: 实现同步队列管理
  - [x] SubTask 6.5: 实现冲突检测和处理

## 阶段 3: 离线支持实现

- [x] Task 7: 实现离线操作队列
  - [x] SubTask 7.1: 创建 `packages/web/src/services/sync/OfflineQueue.ts`
  - [x] SubTask 7.2: 实现离线操作存储
  - [x] SubTask 7.3: 实现操作序列化和去重

- [x] Task 8: 实现网络状态检测
  - [x] SubTask 8.1: 创建 `packages/web/src/services/sync/NetworkMonitor.ts`
  - [x] SubTask 8.2: 监听 online/offline 事件
  - [x] SubTask 8.3: 实现网络质量检测

- [x] Task 9: 实现离线恢复同步
  - [x] SubTask 9.1: 创建 `packages/web/src/services/sync/RecoverySync.ts`
  - [x] SubTask 9.2: 实现离线队列批量上传
  - [x] SubTask 9.3: 实现冲突合并逻辑

## 阶段 4: DataContext 集成

- [x] Task 10: 重构 DataContext 集成同步
  - [x] SubTask 10.1: 修改 `packages/web/src/contexts/DataContext.tsx`
  - [x] SubTask 10.2: 集成 SyncManager 和 CacheService
  - [x] SubTask 10.3: 实现数据读取优先本地缓存
  - [x] SubTask 10.4: 实现数据写入先本地后同步
  - [x] SubTask 10.5: 添加同步状态到 Context

- [x] Task 11: 实现同步状态 Context
  - [x] SubTask 11.1: 创建 `packages/web/src/contexts/SyncContext.tsx`
  - [x] SubTask 11.2: 提供同步状态（isSyncing, isOffline, pendingCount）
  - [x] SubTask 11.3: 提供同步控制方法（forceSync, resolveConflict）

## 阶段 5: UI 组件实现

- [x] Task 12: 创建同步状态指示器
  - [x] SubTask 12.1: 创建 `packages/web/src/components/SyncIndicator.tsx`
  - [x] SubTask 12.2: 显示同步中/已同步/离线状态
  - [x] SubTask 12.3: 显示待同步操作数量

- [x] Task 13: 创建离线提示组件
  - [x] SubTask 13.1: 创建 `packages/web/src/components/OfflineBanner.tsx`
  - [x] SubTask 13.2: 显示离线模式提示
  - [x] SubTask 13.3: 显示数据将在恢复连接后同步

- [x] Task 14: 创建冲突解决对话框
  - [x] SubTask 14.1: 创建 `packages/web/src/components/ConflictDialog.tsx`
  - [x] SubTask 14.2: 显示冲突详情（本地 vs 服务器）
  - [x] SubTask 14.3: 提供解决选项（保留本地/保留服务器/合并）

## 阶段 6: 测试和验证

- [ ] Task 15: 单元测试
  - [ ] SubTask 15.1: 测试 CacheService CRUD 操作
  - [ ] SubTask 15.2: 测试 SyncManager 状态转换
  - [ ] SubTask 15.3: 测试离线队列管理
  - [ ] SubTask 15.4: 测试冲突解决逻辑

- [ ] Task 16: 集成测试
  - [ ] SubTask 16.1: 测试完整的同步流程
  - [ ] SubTask 16.2: 测试离线-恢复场景
  - [ ] SubTask 16.3: 测试多设备同步场景

# Task Dependencies

- [Task 2] depends on [Task 1] - 缓存服务依赖数据库结构
- [Task 3] depends on [Task 2] - 一致性管理依赖缓存服务
- [Task 6] depends on [Task 4, Task 5] - 同步管理器依赖两种客户端
- [Task 7] depends on [Task 2] - 离线队列依赖缓存服务
- [Task 9] depends on [Task 7, Task 8] - 恢复同步依赖离线队列和网络检测
- [Task 10] depends on [Task 6, Task 3] - DataContext 集成依赖同步管理器和缓存
- [Task 11] depends on [Task 10] - 同步状态 Context 依赖 DataContext
- [Task 12, Task 13, Task 14] depend on [Task 11] - UI 组件依赖同步状态
- [Task 15, Task 16] depend on [Task 10, Task 11, Task 12, Task 13, Task 14] - 测试依赖所有功能完成

# Parallelizable Work

以下任务可以并行执行：
- Task 1, Task 4, Task 5 可以并行开始（无依赖）
- Task 7, Task 8 可以并行开始（无依赖）
- Task 12, Task 13, Task 14 可以并行开始（都依赖 Task 11）
- Task 15, Task 16 可以并行执行
