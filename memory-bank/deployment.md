# Deployment - WebNote 生产服务器部署指南

## 服务器信息

### 服务器配置

- **IP 地址**: 120.26.50.152
- **SSH 用户**: root
- **SSH 密码**: `REDACTED_PASSWORD`
- **操作系统**: Ubuntu/Debian
- **部署路径**: `/var/www/webnote`

### 数据库配置

- **数据库类型**: SQLite
- **数据库文件**: `/var/www/webnote/backend/dev.db`
- **连接字符串**: `DATABASE_URL=file:./dev.db`
- **注意**: SQLite 不需要密码认证

### JWT 配置

- **JWT_SECRET**: `webnote-production-secret-key-change-in-production-2024`
- **过期时间**: 7d

### 应用端口

- **前端**: 80 (HTTP), 443 (HTTPS)
- **后端 API**: 3000

## 快速部署

### 一键部署（推荐）

```bash
# 从项目根目录执行
./scripts/deploy.sh
```

### 部署步骤

1. **构建项目**
   ```bash
   pnpm build
   ```

2. **上传到服务器**
   - 前端：`/var/www/webnote/web/dist`
   - 后端：`/var/www/webnote/backend/dist`

3. **运行数据库迁移**
   ```bash
   ssh root@120.26.50.152 "cd /var/www/webnote/backend && npx prisma migrate deploy"
   ```

4. **重启服务**
   ```bash
   ssh root@120.26.50.152 "pm2 restart webnote-backend"
   ```

5. **验证部署**
   ```bash
   curl http://120.26.50.152/api/health
   ```

## 环境变量

### 后端环境变量位置

- **服务器路径**: `/var/www/webnote/backend/.env`
- **本地参考**: `packages/backend/.env.example`

### 关键配置项

```bash
# 数据库（SQLite）
DATABASE_URL="file:./dev.db"

# JWT
JWT_SECRET="webnote-production-secret-key-change-in-production-2024"
JWT_EXPIRES_IN="7d"

# 服务器
PORT=3000
NODE_ENV=production
HOST="0.0.0.0"

# CORS
ALLOWED_ORIGINS="http://120.26.50.152,http://localhost:5173,http://localhost:3000"

# 阿里云 OSS（如果使用）
OSS_ACCESS_KEY_ID="your-key"
OSS_ACCESS_KEY_SECRET="your-secret"
OSS_BUCKET="webnote-backups"
OSS_REGION="oss-cn-hangzhou"
```

## 常用命令

### SSH 连接

```bash
# 基本连接
ssh root@120.26.50.152

# 执行单条命令
ssh root@120.26.50.152 "命令"

# 传输文件
scp local_file root@120.26.50.152:/path/destination
```

### 服务管理

```bash
# PM2 服务
ssh root@120.26.50.152 "pm2 status"
ssh root@120.26.50.152 "pm2 restart webnote-backend"
ssh root@120.26.50.152 "pm2 stop webnote-backend"
ssh root@120.26.50.152 "pm2 logs webnote-backend"

# Nginx 服务
ssh root@120.26.50.152 "sudo systemctl status nginx"
ssh root@120.26.50.152 "sudo systemctl restart nginx"
ssh root@120.26.50.152 "sudo nginx -t"

```

### 查看日志

```bash
# 后端日志
ssh root@120.26.50.152 "tail -f /var/www/webnote/backend/logs/out.log"
ssh root@120.26.50.152 "tail -f /var/www/webnote/backend/logs/err.log"

# Nginx 日志
ssh root@120.26.50.152 "tail -f /var/log/nginx/access.log"
ssh root@120.26.50.152 "tail -f /var/log/nginx/error.log"

```

### 数据库操作（SQLite）

```bash
# 连接数据库
ssh root@120.26.50.152 "cd /var/www/webnote/backend && sqlite3 dev.db"

# 查看所有表
.tables

# 查看表结构
.schema users

# 查看用户数据
SELECT * FROM users;

# 退出
.quit
```

## 验证部署

### 健康检查

```bash
# 测试 API
curl http://120.26.50.152/api/health

# 测试前端
curl http://120.26.50.152

# 检查端口
ssh root@120.26.50.152 "sudo netstat -tulpn | grep -E ':(3000|80|443)'"
```

### 功能测试

```bash
# 测试注册
curl -X POST http://120.26.50.152/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@example.com","password":"password123"}'

# 测试登录
curl -X POST http://120.26.50.152/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

## 配置文件位置

### Nginx 配置

- **配置文件**: `/etc/nginx/sites-available/webnote`
- **启用链接**: `/etc/nginx/sites-enabled/webnote`

### PM2 配置

- **配置文件**: `/var/www/webnote/backend/ecosystem.config.js`


## 备份

### 数据库备份（SQLite）

```bash
# 创建备份
ssh root@120.26.50.152 << 'ENDSSH'
mkdir -p /var/backups/webnote
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
cp /var/www/webnote/backend/dev.db /var/backups/webnote/db_$BACKUP_DATE.db
gzip /var/backups/webnote/db_$BACKUP_DATE.db
ENDSSH

# 列出备份
ssh root@120.26.50.152 "ls -lh /var/backups/webnote/"
```

### 应用备份

```bash
# 备份应用代码
ssh root@120.26.50.152 << 'ENDSSH'
mkdir -p /var/backups/webnote
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
tar -czf /var/backups/webnote/app_$BACKUP_DATE.tar.gz -C /var/www webnote --exclude=node_modules --exclude=uploads
ENDSSH
```

### 恢复数据库（SQLite）

```bash
ssh root@120.26.50.152 << 'ENDSSH'
gunzip -c /var/backups/webnote/db_20240114_120000.db.gz > /var/www/webnote/backend/dev.db
ENDSSH
```

## 故障排除

### 后端无法启动

```bash
# 检查端口占用
ssh root@120.26.50.152 "sudo lsof -i :3000"

# 检查环境变量
ssh root@120.26.50.152 "cat /var/www/webnote/backend/.env"

# 查看错误日志
ssh root@120.26.50.152 "pm2 logs webnote-backend --err"

# 手动启动测试
ssh root@120.26.50.152 "cd /var/www/webnote/backend && node dist/server.js"
```

### 数据库连接失败（SQLite）

```bash
# 检查数据库文件是否存在
ssh root@120.26.50.152 "ls -lh /var/www/webnote/backend/dev.db"

# 检查数据库文件权限
ssh root@120.26.50.152 "ls -l /var/www/webnote/backend/dev.db"

# 测试数据库连接
ssh root@120.26.50.152 "cd /var/www/webnote/backend && sqlite3 dev.db '.tables'"
```

### Nginx 502 错误

```bash
# 检查后端是否运行
ssh root@120.26.50.152 "pm2 status"

# 测试后端端口
curl http://120.26.50.152:3000/api/health

# 检查 Nginx 配置
ssh root@120.26.50.152 "sudo nginx -t"

# 重启 Nginx
ssh root@120.26.50.152 "sudo systemctl restart nginx"
```

### 前端 404

```bash
# 检查构建目录
ssh root@120.26.50.152 "ls -la /var/www/webnote/web/dist"

# 检查 Nginx 配置的 root 路径
ssh root@120.26.50.152 "grep root /etc/nginx/sites-enabled/webnote"
```

## 安全建议

### 防火墙

```bash
ssh root@120.26.50.152 "sudo ufw status"
ssh root@120.26.50.152 "sudo ufw allow 22"    # SSH
ssh root@120.26.50.152 "sudo ufw allow 80"    # HTTP
ssh root@120.26.50.152 "sudo ufw allow 443"   # HTTPS
ssh root@120.26.50.152 "sudo ufw enable"
```

### 定期更新

```bash
ssh root@120.26.50.152 "sudo apt update && sudo apt upgrade -y"
```

### SSL 证书（可选）

```bash
# 安装 Certbot
ssh root@120.26.50.152 "sudo apt install -y certbot python3-certbot-nginx"

# 获取证书
ssh root@120.26.50.152 "sudo certbot --nginx -d 120.26.50.152"

# 测试自动续期
ssh root@120.26.50.152 "sudo certbot renew --dry-run"
```

## 性能监控

### 系统资源

```bash
# CPU 和内存
ssh root@120.26.50.152 "htop"

# 磁盘使用
ssh root@120.26.50.152 "df -h"

# 网络连接
ssh root@120.26.50.152 "ss -tulpn"
```

### PM2 监控

```bash
ssh root@120.26.50.152 "pm2 monit"
```

## 关键提示

⚠️ **重要提醒**

1. **密码安全**: 敏感密码（数据库、SSH、JWT）不要提交到 Git
2. **环境变量**: 确保 `.env` 文件权限为 600
3. **备份**: 定期备份数据库和应用代码
4. **日志**: 定期检查日志文件大小，避免磁盘占满
5. **更新**: 定期更新系统和依赖包
6. **监控**: 使用 PM2 监控后端服务状态

## 扩展阅读

详细部署文档：`scripts/README_DEPLOY.md`  
Nginx 配置：`deploy/nginx.conf`  
部署脚本：`scripts/deploy.sh`

---

**文档版本**: 1.0  
**创建日期**: 2026-01-22  
**最后更新**: 2026-01-22
