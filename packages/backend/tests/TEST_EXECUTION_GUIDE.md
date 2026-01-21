# 数据同步测试执行指南

## 📋 前置准备检查

- [x] ✅ 测试账号创建脚本已创建 (`setup-test-users.js`)
- [x] ✅ Token获取脚本已创建 (`get-tokens.js`)
- [x] ✅ 测试配置文件已创建 (`production-test.config.ts`)
- [x] ✅ 测试数据生成器已创建 (`testDataGenerator.ts`)
- [x] ✅ 测试数据清理器已创建 (`testDataCleaner.ts`)
- [x] ✅ 测试报告生成器已创建 (`testReporter.ts`)

---

## 🚀 执行步骤

### 第一步：在生产服务器上创建测试账号

```bash
# 1. 上传脚本到生产服务器
scp packages/backend/scripts/setup-test-users.js root@120.26.50.152:/tmp/

# 2. SSH登录到生产服务器
ssh root@120.26.50.152

# 3. 进入后端目录并执行脚本
cd /path/to/webnote/packages/backend
node /tmp/setup-test-users.js

# 4. 记录输出的用户ID（后续需要）
```

**预期输出示例：**
```
🚀 开始创建测试账号...
✅ 创建用户成功: sync-test-user@webnote.test (ID: 123)
✅ 创建用户成功: sync-test-user2@webnote.test (ID: 124)
✅ 创建默认文件夹: 用户 123
✅ 创建默认文件夹: 用户 124

📋 测试账号信息汇总:
============================================================

测试用户 1:
  用户名: sync-test-user
  邮箱: sync-test-user@webnote.test
  密码: TestPassword123!
  用户ID: 123
  登录命令:
  curl -X POST http://120.26.50.152/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"sync-test-user@webnote.test","password":"TestPassword123!"}'

测试用户 2:
  用户名: sync-test-user2
  邮箱: sync-test-user2@webnote.test
  密码: TestPassword123!
  用户ID: 124
  登录命令:
  curl -X POST http://120.26.50.152/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"sync-test-user2@webnote.test","password":"TestPassword123!"}'

============================================================
✨ 测试账号设置完成！

下一步:
1. 使用上面的登录命令获取 JWT Token
2. 更新测试配置文件 packages/backend/tests/config/production-test.config.ts
3. 开始执行测试
```

---

### 第二步：获取JWT Token并更新配置

**本地执行：**

```bash
cd packages/backend
node scripts/get-tokens.js
```

**预期输出示例：**
```
🚀 开始获取测试账号Token...

正在登录: sync-test-user@webnote.test...
✅ 登录成功！
   用户ID: 123
   Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

正在登录: sync-test-user2@webnote.test...
✅ 登录成功！
   用户ID: 124
   Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

✅ Token获取成功！
✅ 配置文件已更新: ../tests/config/production-test.config.ts

下一步:
1. 测试账号已配置完成
2. 可以开始执行测试了
3. 运行: pnpm test:sync 或者 npm run test:sync
```

---

### 第三步：执行P0核心测试

#### 3.1 P0 冲突解决测试（2-3天）

```bash
cd packages/backend
pnpm test:sync conflict-resolution
```

**测试内容：**
- 同一笔记双端同时修改
- 文件夹与笔记冲突
- 复盘多字段冲突
- 并发修改同一字段
- 冲突解决策略验证
- 服务器时间戳优先级测试
- 冲突日志记录验证

#### 3.2 P0 离线模式测试（3-4天）

```bash
pnpm test:sync offline-sync
```

**测试内容：**
- 离线创建笔记
- 长时间离线场景
- 离线修改笔记
- 离线删除笔记
- 网络恢复自动同步
- 离线队列管理
- 离线数据持久化

#### 3.3 P0 边界情况测试（2-3天）

```bash
pnpm test:sync edge-cases
```

**测试内容：**
- 空笔记同步
- 超长笔记同步
- 特殊字符处理
- 大数据量场景
- 快速连续操作
- 并发请求极限
- 网络中断恢复

---

### 第四步：执行P1重要测试

#### 4.1 P1 性能测试（2-3天）

```bash
pnpm test:sync performance
```

**测试内容：**
- 小数据量基准测试（100条）
- 中数据量基准测试（500条）
- 大数据量基准测试（1000条）
- 增量同步性能
- 全量同步性能
- 操作延迟测试
- 内存使用监控

#### 4.2 P1 并发测试（2-3天）

```bash
pnpm test:sync concurrency
```

**测试内容：**
- 双用户并发同步
- 多设备并发连接
- 并发操作同一资源
- 并发冲突处理
- 连接池管理
- 速率限制验证
- 并发性能测试

---

### 第五步：生成测试报告

```bash
# 测试完成后，报告会自动生成在：
./test-results/reports/sync-test-report-YYYYMMDD-HHMMSS.md

# 查看报告
cat ./test-results/reports/sync-test-report-*.md
```

---

### 第六步：清理测试数据（可选）

```bash
cd packages/backend

# 预览将要删除的数据
node scripts/cleanup-test-data.js --preview

# 实际删除测试数据
node scripts/cleanup-test-data.js --cleanup
```

---

## 📊 测试结果评估标准

### P0 测试（核心功能）
- **通过率要求**: 100%
- **失败数**: 0
- **优先级**: 必须全部通过才能进入下一阶段

### P1 测试（重要功能）
- **通过率要求**: ≥ 95%
- **失败数**: ≤ 2个
- **优先级**: 高通过率，个别失败需记录

### P2 测试（次要功能）
- **通过率要求**: ≥ 90%
- **失败数**: ≤ 5个
- **优先级**: 可接受部分失败

---

## 🔧 故障排查

### 问题1：无法连接到生产服务器
```
检查项：
1. 确认服务器地址: 120.26.50.152
2. 检查网络连接
3. 验证SSH密钥或密码
4. 确认服务器SSH服务运行中
```

### 问题2：测试账号创建失败
```
检查项：
1. 数据库连接正常
2. bcrypt依赖已安装
3. Prisma Client已生成
4. 数据库schema最新
```

### 问题3：Token获取失败
```
检查项：
1. 测试账号已创建
2. 用户密码正确
3. API服务运行中
4. 网络连接正常
```

### 问题4：测试执行失败
```
检查项：
1. 配置文件正确更新
2. Token有效未过期
3. 依赖包已安装
4. 数据库连接正常
```

---

## 📝 测试报告模板

测试报告包含以下部分：
1. **执行概览**: 执行时间、总耗时
2. **测试统计**: 总数、通过、失败、跳过
3. **优先级分析**: P0/P1/P2测试详情
4. **测试套件详情**: 每个套件的执行情况
5. **问题汇总**: 失败测试的详细信息
6. **结论与建议**: 整体评估和改进建议

---

## 🎯 成功标准

测试执行成功的标志：
- ✅ 所有P0测试通过（100%）
- ✅ P1测试通过率≥95%
- ✅ 无阻塞问题
- ✅ 性能指标达到基准
- ✅ 测试报告完整生成

---

## 📞 需要帮助？

如果遇到问题：
1. 查看测试日志: `./test-results/logs/test-execution.log`
2. 查看错误日志: `./test-results/logs/test-errors.log`
3. 检查配置文件: `./tests/config/production-test.config.ts`
4. 运行诊断命令: `pnpm test:diagnostic`

---

## 📚 相关文档

- [测试计划](../../../project-docs/T3_数据同步全面测试执行计划_20260119.md)
- [测试用例详细说明](./TEST_CASES.md)
- [API文档](../../docs/API.md)
- [同步服务文档](../../src/services/sync/README.md)
