# 修复测试失败问题 Spec

## Why

项目后端测试存在 23 个失败的测试用例，主要集中在备份服务、队列服务和同步流程测试中。失败原因包括外键约束违反、队列操作返回数据不正确、备份创建失败等问题。需要修复这些问题以确保测试全部通过。

## What Changes

- 修复测试 setup 中的外键约束问题（Note 创建时 folder_id 关联）
- 修复 QueueService 的 dequeue 方法返回数量问题
- 修复 BackupService 的 createBackup 方法
- 修复离线同步和冲突解决测试中的数据一致性问题

## Impact

- Affected specs: 测试覆盖、数据同步
- Affected code:
  - `packages/backend/tests/setup.ts` - 测试数据创建
  - `packages/backend/src/services/sync/QueueService.ts` - 队列服务
  - `packages/backend/src/services/backup/BackupService.ts` - 备份服务
  - `packages/backend/tests/sync/*.test.ts` - 同步相关测试

## ADDED Requirements

### Requirement: 测试数据 Setup 正确性

测试 setup SHALL 正确创建测试数据，确保外键约束满足。

#### Scenario: 创建 Note 时 folder_id 关联
- **WHEN** 测试创建 Note 记录
- **THEN** folder_id 应关联到已存在的 Folder 记录，或为 null

#### Scenario: 测试用户和文件夹创建顺序
- **WHEN** 创建测试数据
- **THEN** 应先创建 User，再创建 Folder，最后创建 Note

### Requirement: QueueService 队列操作正确性

QueueService SHALL 正确执行队列操作。

#### Scenario: dequeue 返回正确数量
- **WHEN** 调用 dequeue(userId, limit) 且队列中有足够操作
- **THEN** 应返回指定数量的操作

#### Scenario: clearQueue 返回正确删除数量
- **WHEN** 调用 clearQueue(userId)
- **THEN** 应返回实际删除的操作数量

#### Scenario: processQueue 正确处理操作
- **WHEN** 调用 processQueue(userId)
- **THEN** 应正确处理队列中的操作并返回结果

### Requirement: BackupService 备份创建

BackupService SHALL 能够成功创建备份。

#### Scenario: 创建完整备份
- **WHEN** 调用 createBackup(userId, 'full')
- **THEN** 应成功创建备份并返回备份信息

#### Scenario: 创建增量备份
- **WHEN** 调用 createBackup(userId, 'incremental')
- **THEN** 应成功创建增量备份

### Requirement: 离线同步测试数据一致性

离线同步测试 SHALL 正确处理数据一致性。

#### Scenario: 队列操作同步成功
- **WHEN** 离线操作同步到服务器
- **THEN** operation_results 应正确反映操作结果

#### Scenario: 长时间离线后同步
- **WHEN** 长时间离线后进行同步
- **THEN** 至少 50% 的操作应成功

## MODIFIED Requirements

无修改的需求。

## REMOVED Requirements

无移除的需求。
