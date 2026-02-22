# Tasks

## 阶段 1: 分析失败测试

- [ ] Task 1: 分析测试失败根本原因
  - [ ] SubTask 1.1: 检查 tests/setup.ts 中的 createTestNote 函数
  - [ ] SubTask 1.2: 检查 QueueService 的 dequeue 实现
  - [ ] SubTask 1.3: 检查 BackupService 的 createBackup 实现
  - [ ] SubTask 1.4: 分析外键约束失败的具体原因

## 阶段 2: 修复测试 Setup 问题

- [ ] Task 2: 修复测试数据创建的外键约束问题
  - [ ] SubTask 2.1: 修复 createTestNote 函数，确保 folder_id 正确关联
  - [ ] SubTask 2.2: 修复 createTestData 函数中的文件夹创建逻辑
  - [ ] SubTask 2.3: 验证修复后冲突解决测试通过

## 阶段 3: 修复 QueueService 问题

- [ ] Task 3: 修复 QueueService dequeue 方法
  - [ ] SubTask 3.1: 检查 dequeue 的 SQL 查询逻辑
  - [ ] SubTask 3.2: 修复返回数量不正确的问题
  - [ ] SubTask 3.3: 验证 dequeue 测试通过

- [ ] Task 4: 修复 QueueService clearQueue 和 processQueue 方法
  - [ ] SubTask 4.1: 修复 clearQueue 返回值问题
  - [ ] SubTask 4.2: 修复 processQueue 处理逻辑
  - [ ] SubTask 4.3: 修复 getPerformanceStats 统计问题
  - [ ] SubTask 4.4: 验证队列服务测试通过

## 阶段 4: 修复 BackupService 问题

- [ ] Task 5: 修复 BackupService createBackup 方法
  - [ ] SubTask 5.1: 检查 createBackup 中的错误处理
  - [ ] SubTask 5.2: 修复备份创建失败的问题
  - [ ] SubTask 5.3: 验证备份服务测试通过

## 阶段 5: 修复离线同步测试问题

- [ ] Task 6: 修复离线同步测试数据一致性问题
  - [ ] SubTask 6.1: 修复离线操作同步结果验证
  - [ ] SubTask 6.2: 修复长时间离线后同步测试
  - [ ] SubTask 6.3: 验证离线同步测试通过

## 阶段 6: 验证

- [ ] Task 7: 运行完整测试套件验证
  - [ ] SubTask 7.1: 运行所有后端测试
  - [ ] SubTask 7.2: 确认所有测试通过
  - [ ] SubTask 7.3: 更新测试报告

# Task Dependencies

- [Task 2] depends on [Task 1] - 修复依赖分析
- [Task 3, Task 4] depends on [Task 1] - 队列修复依赖分析
- [Task 5] depends on [Task 1] - 备份修复依赖分析
- [Task 6] depends on [Task 2] - 离线同步修复依赖 setup 修复
- [Task 7] depends on [Task 2, Task 3, Task 4, Task 5, Task 6] - 验证依赖所有修复

# Parallelizable Work

以下任务可以并行执行：
- Task 2, Task 3, Task 4, Task 5 可以在分析完成后并行执行
