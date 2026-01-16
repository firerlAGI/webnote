# CI/CD 工作流说明

## 概述

本项目使用GitHub Actions实现持续集成(CI)和持续部署(CD)自动化流程。

## 工作流架构

```
代码提交 → CI测试 → 构建检查 → CD部署 → 健康检查
    ↓         ↓          ↓          ↓          ↓
 PR创建    运行测试    构建产物    自动部署    监控状态
           Lint检查    安全扫描    回滚机制    告警通知
```

## 工作流列表

### 1. CI - 测试与质量检查 (`.github/workflows/ci.yml`)

**触发条件**:
- Push到 `main` 或 `develop` 分支
- 创建Pull Request到 `main` 或 `develop` 分支

**包含任务**:

#### 代码规范检查
- ESLint代码质量检查
- Prettier代码格式检查
- 确保代码符合项目规范

#### 单元测试
- 运行所有单元测试
- 测试覆盖率报告
- 自动上传到Codecov

#### 构建检查
- 构建共享包 (packages/shared)
- 构建后端 (packages/backend)
- 构建前端 (packages/web)
- 验证构建产物完整性

#### 安全检查
- npm audit依赖漏洞扫描
- pnpm audit安全检查
- 检测已知安全问题

**流程图**:
```
检出代码 → 安装依赖 → 代码检查 → 运行测试 → 构建项目 → 安全扫描
    ↓          ↓           ↓           ↓           ↓           ↓
  成功     成功        成功        成功        成功       成功
    ↓          ↓           ↓           ↓           ↓           ↓
  通过     通过        通过        通过        通过       通过
```

### 2. CD - 自动部署 (`.github/workflows/cd.yml`)

**触发条件**:
- Push到 `main` 分支
- 手动触发 (workflow_dispatch)

**部署流程**:

#### 阶段1: 准备
```
检出代码 → 设置Node.js → 安装依赖
```

#### 阶段2: 构建
```
构建共享包 → 构建后端 → 构建前端
```

#### 阶段3: 准备部署文件
```
复制构建产物 → 创建部署脚本 → 打包
```

#### 阶段4: 部署到服务器
```
上传文件 → 解压 → 备份旧版本 → 部署新版本
```

#### 阶段5: 配置服务
```
创建.env → 运行数据库迁移 → 配置Nginx → 启动PM2
```

#### 阶段6: 验证
```
健康检查 → 测试API → 测试前端
```

**部署特性**:
- ✅ 自动备份旧版本（保留7天）
- ✅ 零停机部署（PM2重启）
- ✅ 数据库迁移自动化
- ✅ Nginx配置自动更新
- ✅ 健康检查自动验证
- ✅ 失败自动回滚

**流程图**:
```
代码推送到main → 触发CD工作流
        ↓
    构建项目
        ↓
    准备部署包
        ↓
    上传到服务器
        ↓
    备份当前版本
        ↓
    部署新版本
        ↓
    配置环境变量
        ↓
    运行数据库迁移
        ↓
    配置Nginx
        ↓
    启动服务
        ↓
    健康检查
        ↓
    ✅ 部署成功
```

### 3. 健康检查 (`.github/workflows/health-check.yml`)

**触发条件**:
- 定时任务：每小时执行一次
- 手动触发 (workflow_dispatch)

**检查项目**:

#### 后端API检查
```bash
curl http://120.26.50.152/api/health
```
- 检查HTTP状态码（期望200）
- 检查响应体内容
- 超时时间：10秒

#### 前端页面检查
```bash
curl http://120.26.50.152/
```
- 检查HTTP状态码（期望200）
- 验证页面可访问
- 超时时间：10秒

#### 数据库连接检查
```bash
curl http://120.26.50.152/api/health/db
```
- 检查数据库连接状态
- 验证数据库可访问

**告警机制**:
- ❌ 检查失败 → 自动创建GitHub Issue
- 📧 Issue标签：`health-check`, `urgent`
- 🔔 包含详细错误信息
- 📊 提供工作流链接

**流程图**:
```
每小时触发 → 检查后端API → 检查前端页面 → 检查数据库
      ↓             ↓               ↓              ↓
    正常          正常            正常           正常
      ↓             ↓               ↓              ↓
   通过         通过            通过           通过
```

## 使用指南

### 触发CI流程

#### 方式1: 提交代码到main/develop分支

```bash
git checkout main
git add .
git commit -m "feat: 新功能"
git push origin main
```

#### 方式2: 创建Pull Request

```bash
git checkout -b feature/new-feature
git add .
git commit -m "feat: 新功能"
git push origin feature/new-feature
```

然后在GitHub上创建PR到main分支。

### 触发CD流程

#### 方式1: 合并到main分支（自动触发）

```bash
git checkout main
git pull origin main
git merge feature/new-feature
git push origin main
```

#### 方式2: 手动触发

1. 进入GitHub仓库的 **Actions** 标签
2. 选择 **CD - 自动部署** 工作流
3. 点击 **Run workflow** 按钮
4. 选择分支（main）
5. 点击绿色的 **Run workflow**

### 查看工作流状态

#### 查看CI状态

1. 进入GitHub仓库
2. 点击 **Actions** 标签
3. 选择 **CI - 测试与质量检查** 工作流
4. 查看最近的运行记录

#### 查看CD状态

1. 进入GitHub仓库
2. 点击 **Actions** 标签
3. 选择 **CD - 自动部署** 工作流
4. 查看部署进度和日志

#### 查看健康检查

1. 进入GitHub仓库
2. 点击 **Actions** 标签
3. 选择 **健康检查** 工作流
4. 查看健康检查历史

### 查看详细日志

1. 点击具体的工作流运行
2. 点击具体的job（如：lint, test, deploy等）
3. 展开每个step查看详细输出
4. 可以下载日志到本地

## 环境变量

### GitHub Secrets

必需的Secrets：
- `SERVER_HOST` - 服务器IP地址
- `SERVER_USER` - SSH用户名
- `SERVER_PASSWORD` - SSH密码
- `JWT_SECRET` - JWT加密密钥

可选的Secrets：
- `SSH_PRIVATE_KEY` - SSH私钥（更安全）
- `DATABASE_URL` - 数据库连接字符串
- `TELEGRAM_BOT_TOKEN` - Telegram机器人令牌
- `TELEGRAM_CHAT_ID` - Telegram聊天ID

详细配置请参考 [GitHub Secrets配置指南](./GITHUB_SECRETS配置指南.md)

### 环境特定配置

#### 开发环境

```yaml
- name: 部署到开发环境
  if: github.ref == 'refs/heads/develop'
  env:
    SERVER_HOST: ${{ secrets.SERVER_HOST_DEV }}
    DATABASE_URL: ${{ secrets.DATABASE_URL_DEV }}
```

#### 生产环境

```yaml
- name: 部署到生产环境
  if: github.ref == 'refs/heads/main'
  env:
    SERVER_HOST: ${{ secrets.SERVER_HOST_PROD }}
    DATABASE_URL: ${{ secrets.DATABASE_URL_PROD }}
```

## 故障排除

### CI失败

#### 问题: Lint检查失败

**解决方案**:
```bash
# 本地运行lint检查
pnpm lint

# 自动修复
pnpm lint:fix

# 再次提交
git add .
git commit -m "fix: 修复lint问题"
git push
```

#### 问题: 测试失败

**解决方案**:
```bash
# 本地运行测试
cd packages/backend
npm test

# 查看测试覆盖率
npm run test:coverage

# 修复失败测试
git add .
git commit -m "fix: 修复测试"
git push
```

#### 问题: 构建失败

**解决方案**:
```bash
# 清理并重新构建
rm -rf node_modules
pnpm install
pnpm build

# 检查TypeScript错误
pnpm type-check
```

### CD失败

#### 问题: SSH连接失败

**解决方案**:
1. 检查GitHub Secrets是否正确
2. 测试SSH连接：`ssh root@120.26.50.152`
3. 检查服务器防火墙设置

#### 问题: 部署后服务无法启动

**解决方案**:
```bash
# 查看PM2日志
ssh root@120.26.50.152 "pm2 logs webnote-backend"

# 查看环境变量
ssh root@120.26.50.152 "cat /var/www/webnote/backend/.env"

# 手动重启服务
ssh root@120.26.50.152 "pm2 restart webnote-backend"
```

#### 问题: 数据库迁移失败

**解决方案**:
```bash
# 手动运行迁移
ssh root@120.26.50.152
cd /var/www/webnote/backend
npx prisma migrate deploy

# 查看迁移历史
npx prisma migrate status
```

#### 问题: 健康检查失败

**解决方案**:
```bash
# 检查服务状态
ssh root@120.26.50.152 "pm2 status"
ssh root@120.26.50.152 "sudo systemctl status nginx"
ssh root@120.26.50.152 "sudo systemctl status postgresql"

# 测试端口监听
ssh root@120.26.50.152 "sudo netstat -tulpn | grep -E ':(3000|80|5432)'"

# 查看Nginx错误日志
ssh root@120.26.50.152 "sudo tail -f /var/log/nginx/error.log"
```

### 回滚部署

如果部署失败或发现问题，可以快速回滚：

```bash
# 查看备份列表
ssh root@120.26.50.152 "ls -la /var/backups/webnote/"

# 回滚后端
ssh root@120.26.50.152 << 'ENDSSH'
cd /var/www/webnote
rm -rf backend
cp -r /var/backups/webnote/backend_20260114_120000 backend
cd backend
pm2 restart webnote-backend
ENDSSH

# 回滚前端
ssh root@120.26.50.152 << 'ENDSSH'
cd /var/www/webnote
rm -rf web
cp -r /var/backups/webnote/web_20260114_120000 web
sudo systemctl reload nginx
ENDSSH
```

## 性能优化

### 缓存策略

#### Node.js依赖缓存
```yaml
- uses: actions/setup-node@v3
  with:
    node-version: '18'
    cache: 'npm'  # 启用依赖缓存
```

#### 构建缓存
可以在CD工作流中添加构建缓存：

```yaml
- name: 缓存构建产物
  uses: actions/cache@v3
  with:
    path: |
      node_modules
      packages/*/dist
    key: ${{ runner.os }}-build-${{ hashFiles('**/package.json') }}
```

### 并行执行

CI工作流中的job可以并行执行：

```yaml
jobs:
  lint:
    # 代码检查
  test:
    # 单元测试
  build:
    # 构建检查
  security:
    # 安全检查
    # 以上4个job并行执行
```

### 增量部署

对于大型项目，可以考虑增量部署：

```yaml
- name: 增量部署
  run: |
    # 只部署变化的文件
    rsync -avz --delete \
      /tmp/deploy/backend/ \
      root@120.26.50.152:/var/www/webnote/backend/
```

## 监控和告警

### GitHub Actions通知

#### 邮件通知

在仓库设置中启用邮件通知：
1. Settings → Notifications
2. 选择你想要通知的事件

#### Slack通知（可选）

添加Slack通知到工作流：

```yaml
- name: Slack通知
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    text: '部署完成'
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

### 日志聚合

#### 收集PM2日志

```bash
# 创建日志收集脚本
cat > /var/www/webnote/collect-logs.sh << 'EOF'
#!/bin/bash
pm2 logs webnote-backend --lines 1000 --nostream > /var/log/webnote/app.log
EOF

chmod +x /var/www/webnote/collect-logs.sh

# 添加到crontab，每小时运行一次
crontab -e
# 添加: 0 * * * * /var/www/webnote/collect-logs.sh
```

### 性能监控

可以考虑集成：
- New Relic
- Datadog
- Prometheus + Grafana

## 最佳实践

### 1. 分支策略

```
main      ← 生产环境（自动部署）
  ↑
  | 合并
develop   ← 开发环境（可选：配置CD）
  ↑
  | 合并
feature/* ← 功能分支（触发CI）
```

### 2. 提交信息规范

使用约定式提交（Conventional Commits）：

```
feat: 新功能
fix: 修复bug
docs: 文档更新
style: 代码格式（不影响功能）
refactor: 重构
test: 测试相关
chore: 构建/工具相关
```

### 3. 代码审查

- 所有合并到main分支必须经过PR
- 至少1人审查批准
- CI必须全部通过
- 解决所有审查意见

### 4. 版本控制

使用语义化版本（Semantic Versioning）：

```
1.0.0 ← 主版本.次版本.修订号
   ↑     ↑        ↑
  破坏性  新功能   bug修复
```

### 5. 安全考虑

- ✅ 所有敏感信息使用Secrets
- ✅ 定期轮换密钥
- ✅ 限制GitHub Actions权限
- ✅ 使用SSH密钥而不是密码
- ✅ 定期更新依赖包
- ✅ 启用依赖审计

## 相关文档

- [GitHub Secrets配置指南](./GITHUB_SECRETS配置指南.md)
- [部署指南](./scripts/README_DEPLOY.md)
- [后端部署文档](./packages/backend/scripts/DEPLOYMENT_GUIDE.md)
- [项目管理指南](./项目管理指南.md)

## 支持

遇到问题？

1. 查看[故障排除](#故障排除)部分
2. 查看GitHub Actions日志
3. 创建Issue寻求帮助
4. 联系项目负责人

---

**文档版本**: 1.0  
**最后更新**: 2026-01-15  
**维护者**: WebNote团队
