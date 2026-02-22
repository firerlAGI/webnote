# Checklist

## 测试 Setup 检查

- [ ] createTestNote 函数正确处理 folder_id 外键约束
- [ ] createTestData 函数正确创建文件夹和笔记的关联
- [ ] 冲突解决测试不再出现外键约束错误

## QueueService 检查

- [ ] dequeue 方法返回正确数量的操作
- [ ] clearQueue 方法返回正确的删除数量
- [ ] processQueue 方法正确处理队列操作
- [ ] getPerformanceStats 返回正确的统计数据
- [ ] recoverQueue 方法正确处理超时操作
- [ ] cleanupOldOperations 方法正确清理旧操作

## BackupService 检查

- [ ] createBackup 方法成功创建完整备份
- [ ] createBackup 方法成功创建增量备份
- [ ] getBackupList 正确返回备份列表
- [ ] getBackupDetail 正确返回备份详情
- [ ] deleteBackup 正确删除备份
- [ ] downloadBackup 正确返回备份数据

## 离线同步检查

- [ ] 离线操作同步结果正确反映操作状态
- [ ] 长时间离线后同步至少 50% 操作成功
- [ ] 队列操作处理结果 success 字段正确

## 最终验证

- [ ] 所有后端测试通过（154/154）
- [ ] 无新增测试失败
- [ ] 测试报告已更新
