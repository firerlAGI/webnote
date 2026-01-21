# 🚀 测试执行 - 下一步操作

## 当前状态

✅ **准备工作已完成！**
- 所有测试脚本已创建
- 所有测试工具已就绪
- 配置文件已准备
- 执行指南已完善

⏳ **等待SSH连接**
- 需要输入服务器密码完成连接
- 当前有2个SSH命令正在等待输入

---

## 🔑 SSH连接方式

您提到服务器部署指南中有密钥说明。根据您的SSH配置，有以下几种方式：

### 方式1：使用密码（当前正在等待）
在终端中输入root密码即可继续

### 方式2：使用密钥（如果已配置）
```bash
# 如果您有私钥文件，可以这样连接：
ssh -i /path/to/private/key root@120.26.50.152

# 或者在SSH config中指定IdentityFile
```

### 方式3：检查SSH密钥
```bash
# 查看您本地是否有服务器的SSH密钥
ls -la ~/.ssh/

# 查看SSH配置
cat ~/.ssh/config
```

---

## 📋 测试账号创建步骤

一旦SSH连接成功，执行以下步骤：

### 步骤1：上传脚本到服务器
```bash
# 当前命令正在执行，等待密码输入
scp packages/backend/scripts/setup-test-users.js root@120.26.50.152:/tmp/
```

### 步骤2：SSH登录并执行脚本
```bash
# 连接到服务器
ssh root@120.26.50.152

# 进入后端目录（假设项目在/var/www/webnote）
cd /var/www/webnote/packages/backend

# 执行测试账号创建脚本
node /tmp/setup-test-users.js
```

**预期输出：**
```
🚀 开始创建测试账号...
✅ 创建用户成功: sync-test-user@webnote.test (ID: XXX)
✅ 创建用户成功: sync-test-user2@webnote.test (ID: YYY)
✅ 创建默认文件夹: 用户 XXX
✅ 创建默认文件夹: 用户 YYY

📋 测试账号信息汇总:
============================================================

测试用户 1:
  用户名: sync-test-user
  邮箱: sync-test-user@webnote.test
  密码: TestPassword123!
  用户ID: XXX
  登录命令: ...

测试用户 2:
  用户名: sync-test-user2
  邮箱: sync-test-user2@webnote.test
  密码: TestPassword123!
  用户ID: YYY
  登录命令: ...

============================================================
✨ 测试账号设置完成！
```

---

## 🎯 获取Token并配置

测试账号创建成功后，在本地执行：

```bash
cd packages/backend
node scripts/get-tokens.js
```

这将自动：
1. 登录两个测试账号
2. 获取JWT Token
3. 更新 `tests/config/production-test.config.ts`

---

## 🧪 开始执行测试

配置完成后，按优先级执行测试：

### P0 核心测试（必须全部通过）

#### 1. 冲突解决测试（2-3天）
```bash
pnpm test:sync conflict-resolution
```

#### 2. 离线模式测试（3-4天）
```bash
pnpm test:sync offline-sync
```

#### 3. 边界情况测试（2-3天）
```bash
pnpm test:sync edge-cases
```

### P1 重要测试（通过率≥95%）

#### 4. 性能测试（2-3天）
```bash
pnpm test:sync performance
```

#### 5. 并发测试（2-3天）
```bash
pnpm test:sync concurrency
```

---

## 📊 测试成功标准

### P0 测试（核心功能）
- ✅ 通过率: 100%
- ✅ 失败数: 0
- ✅ 所有冲突场景正确处理
- ✅ 离线模式稳定运行
- ✅ 边界情况无崩溃

### P1 测试（重要功能）
- ✅ 通过率: ≥95%
- ✅ 失败数: ≤2个
- ✅ 性能指标达标
- ✅ 并发处理稳定

---

## 📁 查看详细文档

1. **执行指南**: `packages/backend/tests/TEST_EXECUTION_GUIDE.md`
2. **准备总结**: `packages/backend/tests/TEST_PREPARATION_SUMMARY.md`
3. **测试计划**: `project-docs/T3_数据同步全面测试执行计划_20260119.md`

---

## 💡 重要提示

1. **SSH密码**: 如果您使用密钥认证，请确保密钥已配置
2. **项目路径**: 如果服务器上项目路径不是 `/var/www/webnote`，请相应调整
3. **Token时效**: JWT Token有时效性，过期后需重新获取
4. **测试数据**: 测试数据以 `[TEST]` 前缀标识，便于清理
5. **日志监控**: 密切关注测试日志和错误日志

---

## ⚠️ 当前需要您做的

1. **在终端中输入SSH密码**，让当前命令继续执行
2. 或**提供SSH密钥路径**，我可以更新脚本使用密钥认证

---

**创建时间**: 2026年1月19日 17:43
**状态**: 等待SSH连接
