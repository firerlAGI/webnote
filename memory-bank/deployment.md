# Deployment - WebNote 生产服务器部署指南

## 服务器信息

### 服务器配置

- **IP 地址**: 120.26.50.152
- **SSH 用户**: root
- **SSH 密码**: (在本地密码管理器中，安全起见不记录在此文件中)
- **操作系统**: Ubuntu/Debian
- **部署路径**: `/var/www/webnote`

### 数据库配置

- **数据库名**: webnote
- **数据库用户**: webnote_user
- **数据库密码**: (在本地密码管理器中，安全起见不记录在此文件中)
- **端口**: 5432
- **连接地址**: localhost:5432

### 应用端口

- **前端**: 80 (HTTP), 443 (HTTPS)
- **后端 API**: 3000
- **PostgreSQL**: 5432

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
# 数据库
DATABASE_URL="postgresql://webnote_user:密码@localhost:5432/webnote"

# JWT
JWT_SECRET="生成的密钥"
JWT_EXPIRES_IN="7d"

# 服务器
PORT=3000
NODE_ENV=production
HOST="0.0.0.0"

# CORS
ALLOWED_ORIGINS="http://120.26.50.152,https://120.26.50.152"

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

# PostgreSQL 服务
ssh root@120.26.50.152 "sudo systemctl status postgresql"
ssh root@120.26.50.152 "sudo systemctl restart postgresql"
```

### 查看日志

```bash
# 后端日志
ssh root@120.26.50.152 "tail -f /var/www/webnote/backend/logs/out.log"
ssh root@120.26.50.152 "tail -f /var/www/webnote/backend/logs/err.log"

# Nginx 日志
ssh root@120.26.50.152 "tail -f /var/log/nginx/access.log"
ssh root@120.26.50.152 "tail -f /var/log/nginx/error.log"

# PostgreSQL 日志
ssh root@120.26.50.152 "tail -f /var/log/postgresql/postgresql-14-main.log"
```

### 数据库操作

```bash
# 连接数据库
ssh root@120.26.50.152 "sudo -u postgres psql -d webnote"

# 查看所有表
\dt

# 查看用户
SELECT * FROM users;

# 退出
\q
```

## 验证部署

### 健康检查

```bash
# 测试 API
curl http://120.26.50.152/api/health

# 测试前端
curl http://120.26.50.152

# 检查端口
ssh root@120.26.50.152 "sudo netstat -tulpn | grep -E ':(3000|80|443|5432)'"
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

### 数据库配置

- **PostgreSQL 配置**: `/etc/postgresql/14/main/postgresql.conf`
- **访问控制**: `/etc/postgresql/14/main/pg_hba.conf`

## 备份

### 数据库备份

```bash
# 创建备份
ssh root@120.26.50.152 << 'ENDSSH'
mkdir -p /var/backups/webnote
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -h localhost -U webnote_user -d webnote | gzip > /var/backups/webnote/db_$BACKUP_DATE.sql.gz
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

### 恢复数据库

```bash
ssh root@120.26.50.152 << 'ENDSSH'
gunzip -c /var/backups/webnote/db_20240114_120000.sql.gz | sudo -u postgres psql -d webnote
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

### 数据库连接失败

```bash
# 测试数据库连接
ssh root@120.26.50.152 "sudo -u postgres psql -h localhost -U webnote_user -d webnote"

# 检查 PostgreSQL 状态
ssh root@120.26.50.152 "sudo systemctl status postgresql"

# 重启 PostgreSQL
ssh root@120.26.50.152 "sudo systemctl restart postgresql"
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
