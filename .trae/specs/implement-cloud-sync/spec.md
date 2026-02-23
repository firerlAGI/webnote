# 云端数据同步功能实现 Spec

## Why

当前笔记内容没有实现云端同步功能。虽然后端已经实现了完整的 SyncService（WebSocket + HTTP 轮询降级），但前端完全没有使用这些同步能力：
- 前端没有本地数据缓存（无 IndexedDB/LocalStorage）
- 前端没有同步客户端连接后端 WebSocket
- 数据只存在于后端数据库，每次都重新获取
- 没有离线支持，断网后无法使用

这导致用户无法在多设备间同步数据，也无法在离线状态下使用应用。

## What Changes

### 前端新增

- **新增 SyncManager 同步管理器**：管理 WebSocket 连接、同步状态、冲突处理
- **新增 IndexedDB 缓存层**：本地存储笔记、文件夹、复盘数据
- **新增离线支持**：离线时操作存储到本地队列，恢复后自动同步
- **新增同步状态 UI**：显示同步状态、离线模式、冲突提示

### 后端已有（无需修改）

- SyncService 已完整实现
- WebSocket 同步已实现
- HTTP 轮询降级已实现
- 冲突检测和解决已实现

## Impact

- Affected specs: 数据同步能力
- Affected code:
  - `packages/web/src/contexts/DataContext.tsx` - 需要集成同步管理器
  - `packages/web/src/` - 新增同步相关模块
  - `packages/web/src/api/` - 新增同步 API 调用

## ADDED Requirements

### Requirement: 前端同步客户端

系统 SHALL 提供前端同步客户端，连接后端 WebSocket 同步服务。

#### Scenario: 成功连接同步服务
- **WHEN** 用户登录成功
- **THEN** 自动建立 WebSocket 连接
- **AND** 连接成功后开始同步数据

#### Scenario: WebSocket 连接失败降级
- **WHEN** WebSocket 连接失败
- **THEN** 自动降级到 HTTP 轮询
- **AND** 每 5 秒轮询一次更新

#### Scenario: 断线重连
- **WHEN** 网络断开后恢复
- **THEN** 自动重新建立连接
- **AND** 同步断线期间的变更

### Requirement: 本地数据缓存

系统 SHALL 使用 IndexedDB 存储用户数据，实现离线优先策略。

#### Scenario: 数据读取优先本地
- **WHEN** 用户查看笔记列表
- **THEN** 优先从本地缓存读取数据
- **AND** 后台同步最新数据

#### Scenario: 数据写入先本地后同步
- **WHEN** 用户创建或修改笔记
- **THEN** 先写入本地缓存
- **AND** 立即同步到服务器
- **AND** 更新 UI 显示同步状态

#### Scenario: 缓存数据版本管理
- **WHEN** 检测到服务器数据版本更新
- **THEN** 比较本地和服务器版本
- **AND** 合并或覆盖本地数据

### Requirement: 离线操作支持

系统 SHALL 支持离线操作，并在恢复连接后自动同步。

#### Scenario: 离线时创建笔记
- **WHEN** 用户在离线状态下创建笔记
- **THEN** 数据保存到本地缓存
- **AND** 操作记录到同步队列
- **AND** UI 显示"待同步"状态

#### Scenario: 离线时修改笔记
- **WHEN** 用户在离线状态下修改笔记
- **THEN** 更新本地缓存
- **AND** 操作记录到同步队列

#### Scenario: 恢复连接后自动同步
- **WHEN** 网络恢复连接
- **THEN** 自动上传同步队列中的操作
- **AND** 下载服务器端的更新
- **AND** 解决可能的冲突

### Requirement: 同步状态 UI

系统 SHALL 提供同步状态的可视化反馈。

#### Scenario: 显示同步状态
- **WHEN** 数据正在同步
- **THEN** 显示同步动画图标
- **AND** 同步完成后图标消失

#### Scenario: 显示离线模式
- **WHEN** 检测到网络断开
- **THEN** 显示"离线模式"提示
- **AND** 显示待同步操作数量

#### Scenario: 显示冲突提示
- **WHEN** 检测到数据冲突
- **THEN** 显示冲突解决对话框
- **AND** 提供冲突解决选项

### Requirement: 冲突处理

系统 SHALL 提供数据冲突检测和解决机制。

#### Scenario: 自动解决冲突
- **WHEN** 检测到版本冲突
- **THEN** 使用"最新修改优先"策略自动解决
- **AND** 记录冲突日志

#### Scenario: 手动解决冲突
- **WHEN** 自动解决失败或用户选择手动
- **THEN** 显示冲突详情
- **AND** 让用户选择保留哪个版本

## MODIFIED Requirements

### Requirement: DataContext 数据管理

DataContext SHALL 集成同步管理器，实现本地缓存和云端同步。

**原有行为**：
- 直接从 API 获取数据
- 无本地缓存
- 无离线支持

**新增行为**：
- 优先从本地缓存读取
- 后台同步最新数据
- 支持离线操作
- 同步状态管理

## REMOVED Requirements

无移除的需求。
