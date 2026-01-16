# GitHub Secrets 配置指南

## 概述

为了启用CI/CD自动化部署，需要在GitHub仓库中配置以下Secrets。

## 配置步骤

### 1. 进入GitHub仓库设置

1. 打开你的GitHub仓库
2. 点击 **Settings** 标签
3. 在左侧菜单中选择 **Secrets and variables** → **Actions**
4. 点击 **New repository secret** 按钮添加每个Secret

### 2. 配置必需的Secrets

#### `SERVER_HOST`

- **名称**: `SERVER_HOST`
- **值**: `120.26.50.152`
- **描述**: 生产服务器IP地址

#### `SERVER_USER`

- **名称**: `SERVER_USER`
- **值**: `root`
- **描述**: SSH登录用户名

#### `SERVER_PASSWORD`

- **名称**: `SERVER_PASSWORD`
- **值**: `REDACTED_PASSWORD`
- **描述**: SSH登录密码
- **安全提示**: 建议使用SSH密钥而不是密码（见下方优化建议）

#### `JWT_SECRET`

- **名称**: `JWT_SECRET`
- **值**: 生成一个安全的随机字符串
- **描述**: JWT token加密密钥

生成JWT_SECRET的方法：

```bash
# 方法1: 使用openssl生成（推荐）
openssl rand -base64 32

# 方法2: 使用node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# 方法3: 在线生成器
# https://www.random.org/strings/
```

**重要**: JWT_SECRET必须保密，不要在代码中硬编码！

### 3. 可选Secrets（用于优化部署）

#### `SSH_PRIVATE_KEY`（推荐使用）

如果你想要更安全的SSH连接，可以配置SSH密钥：

```bash
# 在服务器上生成SSH密钥对
ssh-keygen -t rsa -b 4096 -C "github-actions" -f ~/.ssh/github_actions

# 将公钥添加到authorized_keys
cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys

# 将私钥复制到GitHub Secrets
cat ~/.ssh/github_actions
```

- **名称**: `SSH_PRIVATE_KEY`
- **值**: 上面生成的私钥内容
- **描述**: 用于SSH连接的私钥

#### `DATABASE_URL`

如果你不想在部署脚本中硬编码数据库连接字符串：

- **名称**: `DATABASE_URL`
- **值**: `postgresql://webnote_user:REDACTED_PASSWORD@localhost:5432/webnote_db`
- **描述**: 生产数据库连接字符串

#### `TELEGRAM_BOT_TOKEN`（用于通知）

如果你想要通过Telegram接收部署通知：

- **名称**: `TELEGRAM_BOT_TOKEN`
- **值**: 你的Telegram Bot Token
- **描述**: Telegram机器人令牌

#### `TELEGRAM_CHAT_ID`

- **名称**: `TELEGRAM_CHAT_ID`
- **值**: 接收通知的Telegram聊天ID
- **描述**: Telegram聊天ID

### 4. 验证配置

配置完成后，验证所有Secrets：

1. 在 **Secrets and variables** → **Actions** 页面
2. 确认以下Secrets都已配置：
   - ✅ `SERVER_HOST`
   - ✅ `SERVER_USER`
   - ✅ `SERVER_PASSWORD`
   - ✅ `JWT_SECRET`

### 5. 测试CI/CD

#### 测试CI流程

```bash
# 创建一个测试分支
git checkout -b test-ci

# 做一个小修改
echo "test" > test.txt
git add test.txt
git commit -m "test: CI workflow test"

# 推送到GitHub
git push origin test-ci

# 创建Pull Request到main分支
# 在GitHub上观察CI工作流是否正常运行
```

#### 测试CD流程

```bash
# 切换到main分支
git checkout main

# 合并测试分支
git merge test-ci

# 推送到GitHub
git push origin main

# 在GitHub上观察CD工作流是否自动触发并部署
```

#### 手动触发部署

1. 进入GitHub仓库的 **Actions** 标签
2. 选择 **CD - 自动部署** 工作流
3. 点击 **Run workflow** 按钮
4. 选择分支（通常是main）
5. 点击 **Run workflow** 开始手动部署

### 6. 监控部署

#### 查看工作流日志

1. 进入GitHub仓库的 **Actions** 标签
2. 点击最近的工作流运行
3. 点击具体的job查看详细日志

#### 查看健康检查

健康检查工作流每小时自动运行一次，也可以手动触发：

1. 进入 **Actions** 标签
2. 选择 **健康检查** 工作流
3. 点击 **Run workflow** 手动触发

如果健康检查失败，会自动创建一个GitHub Issue提醒你。

## 安全最佳实践

### 1. 使用SSH密钥而不是密码

```bash
# 生成SSH密钥对
ssh-keygen -t rsa -b 4096 -C "github-actions" -f ~/.ssh/github_actions

# 将公钥添加到服务器
cat ~/.ssh/github_actions.pub | ssh root@120.26.50.152 "cat >> ~/.ssh/authorized_keys"

# 限制SSH密钥权限
chmod 600 ~/.ssh/github_actions
chmod 700 ~/.ssh
```

### 2. 定期轮换Secrets

建议每3-6个月更换一次：
- JWT_SECRET
- SERVER_PASSWORD（如果使用密码）
- SSH_PRIVATE_KEY（如果使用密钥）

### 3. 使用环境特定的Secrets

如果需要支持多环境部署：

```
- SERVER_HOST_DEV
- SERVER_HOST_PROD
- DATABASE_URL_DEV
- DATABASE_URL_PROD
- JWT_SECRET_DEV
- JWT_SECRET_PROD
```

然后在工作流中使用条件判断：

```yaml
- name: 部署到开发环境
  if: github.ref == 'refs/heads/develop'
  env:
    SERVER_HOST: ${{ secrets.SERVER_HOST_DEV }}
    DATABASE_URL: ${{ secrets.DATABASE_URL_DEV }}

- name: 部署到生产环境
  if: github.ref == 'refs/heads/main'
  env:
    SERVER_HOST: ${{ secrets.SERVER_HOST_PROD }}
    DATABASE_URL: ${{ secrets.DATABASE_URL_PROD }}
```

### 4. 限制GitHub Actions权限

在仓库设置中：
1. Settings → Actions → General
2. **Workflow permissions** → 选择 **Read and write permissions**
3. 可以限制哪些工作流有写权限

## 故障排除

### 问题1: 部署失败，提示SSH连接错误

**解决方案**:
1. 检查Secrets是否正确配置
2. 确认服务器IP和端口正确
3. 测试SSH连接：`ssh root@120.26.50.152`

### 问题2: 健康检查失败但应用实际正常

**解决方案**:
1. 检查服务器防火墙设置
2. 确认80和3000端口对外开放
3. 检查Nginx配置是否正确

### 问题3: 数据库迁移失败

**解决方案**:
1. 检查DATABASE_URL是否正确
2. 确认数据库用户有足够权限
3. 手动在服务器上运行：`npx prisma migrate deploy`

### 问题4: JWT_SECRET配置后应用无法启动

**解决方案**:
1. 确保JWT_SECRET是有效的base64字符串
2. 检查.env文件是否正确生成
3. 查看PM2日志：`pm2 logs webnote-backend`

## 相关文档

- [部署指南](./scripts/README_DEPLOY.md)
- [CI/CD工作流说明](./CICD工作流说明.md)
- [后端部署文档](./packages/backend/scripts/DEPLOYMENT_GUIDE.md)

## 支持

如果遇到问题：

1. 查看GitHub Actions日志
2. 检查服务器状态
3. 查看PM2日志：`ssh root@120.26.50.152 "pm2 logs webnote-backend"`
4. 查看Nginx日志：`ssh root@120.26.50.152 "sudo tail -f /var/log/nginx/error.log"`
