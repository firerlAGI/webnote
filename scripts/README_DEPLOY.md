# WebNote 部署指南

## 快速开始

### 一键部署（推荐）

```bash
# 赋予执行权限
chmod +x scripts/deploy.sh

# 执行部署
./scripts/deploy.sh
```

部署脚本会自动完成以下步骤：
1. 本地构建项目
2. 打包必要文件
3. 上传到服务器 (120.26.50.152)
4. 在服务器上执行部署
5. 运行数据库迁移
6. 重启服务
7. 健康检查
8. 显示服务日志

### 手动部署

如果需要手动部署，请参考 `packages/backend/scripts/DEPLOYMENT_GUIDE.md`

## 前置要求

### 本地环境
- Node.js 18.x+
- pnpm 包管理器
- SSH 访问权限

### 服务器环境
需要以下软件已安装：
- Node.js 18.x+
- PostgreSQL 14+
- Nginx
- PM2

首次部署前，需要在服务器上运行初始化：

```bash
ssh root@120.26.50.152

# 安装必要软件
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs postgresql postgresql-contrib nginx git
npm install -g pm2 pnpm

# 配置PostgreSQL
sudo -u postgres psql
CREATE DATABASE webnote;
CREATE USER webnote_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE webnote TO webnote_user;
\q
```

## 配置文件

### 1. 后端环境变量

在服务器上创建 `/var/www/webnote/backend/.env`：

```bash
ssh root@120.26.50.152

cd /var/www/webnote/backend
cat > .env << EOF
# 数据库配置
DATABASE_URL="postgresql://webnote_user:your_secure_password@localhost:5432/webnote"

# JWT密钥
JWT_SECRET="$(openssl rand -base64 32)"

# 服务器配置
PORT=3000
NODE_ENV=production

# CORS配置
ALLOWED_ORIGINS="http://120.26.50.152,https://120.26.50.152"
EOF

chmod 600 .env
```

### 2. Nginx 配置

```bash
# 创建Nginx配置
sudo nano /etc/nginx/sites-available/webnote
```

添加以下内容：

```nginx
server {
    listen 80;
    server_name 120.26.50.152;

    # 前端静态文件
    location / {
        root /var/www/webnote/web/dist;
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "public, max-age=3600";
    }

    # 后端API代理
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    client_max_body_size 10M;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/webnote /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 3. PM2 配置

在服务器上创建 `/var/www/webnote/backend/ecosystem.config.js`：

```javascript
module.exports = {
  apps: [{
    name: 'webnote-backend',
    script: 'dist/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};
```

## 部署流程

### 使用一键部署脚本

```bash
# 1. 确保所有更改已提交
git add .
git commit -m "准备部署"
git push

# 2. 执行部署脚本
./scripts/deploy.sh

# 3. 脚本会自动：
#    - 构建所有包
#    - 打并上传到服务器
#    - 备份现有版本
#    - 部署新版本
#    - 运行数据库迁移
#    - 重启服务
#    - 健康检查
```

### 部署脚本选项

```bash
# 部署到开发环境（默认）
./scripts/deploy.sh dev

# 部署到生产环境
./scripts/deploy.sh prod
```

## 验证部署

### 1. 检查服务状态

```bash
# SSH到服务器
ssh root@120.26.50.152

# 检查PM2服务
pm2 status

# 检查Nginx服务
sudo systemctl status nginx

# 检查PostgreSQL服务
sudo systemctl status postgresql

# 检查端口监听
sudo netstat -tulpn | grep -E ':(3000|80|443|5432)'
```

### 2. 测试API

```bash
# 测试健康检查
curl http://120.26.50.152/api/health

# 测试注册
curl -X POST http://120.26.50.152/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@example.com","password":"password123"}'

# 测试登录
curl -X POST http://120.26.50.152/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### 3. 访问应用

- **前端**: http://120.26.50.152
- **后端API**: http://120.26.50.152/api

## 常用命令

### 查看日志

```bash
# PM2日志
ssh root@120.26.50.152 "pm2 logs webnote-backend --lines 100"

# 实时日志
ssh root@120.26.50.152 "pm2 logs webnote-backend"

# Nginx日志
ssh root@120.26.50.152 "tail -f /var/log/nginx/access.log"
ssh root@120.26.50.152 "tail -f /var/log/nginx/error.log"
```

### 服务管理

```bash
# 重启后端
ssh root@120.26.50.152 "pm2 restart webnote-backend"

# 停止后端
ssh root@120.26.50.152 "pm2 stop webnote-backend"

# 重载Nginx
ssh root@120.26.50.152 "sudo systemctl reload nginx"

# 重启PostgreSQL
ssh root@120.26.50.152 "sudo systemctl restart postgresql"
```

### 数据库操作

```bash
# 连接到数据库
ssh root@120.26.50.152
sudo -u postgres psql -d webnote

# 查看所有表
\dt

# 查看用户
SELECT * FROM users;

# 退出
\q
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
```

### 数据库连接失败

```bash
# 测试数据库连接
ssh root@120.26.50.152 "sudo -u postgres psql -h localhost -U webnote_user -d webnote"

# 检查PostgreSQL状态
ssh root@120.26.50.152 "sudo systemctl status postgresql"

# 查看PostgreSQL日志
ssh root@120.26.50.152 "sudo tail -f /var/log/postgresql/postgresql-14-main.log"
```

### Nginx 502错误

```bash
# 检查后端是否运行
ssh root@120.26.50.152 "pm2 status"

# 测试后端端口
curl http://120.26.50.152:3000/api/health

# 检查Nginx配置
ssh root@120.26.50.152 "sudo nginx -t"
```

### 前端页面404

```bash
# 检查构建目录
ssh root@120.26.50.152 "ls -la /var/www/webnote/web/dist"

# 检查Nginx配置的root路径
ssh root@120.26.50.152 "grep root /etc/nginx/sites-enabled/webnote"
```

## 备份和恢复

### 数据库备份

```bash
ssh root@120.26.50.152 << 'ENDSSH'
mkdir -p /var/backups/webnote
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
PGPASSWORD='your_password' pg_dump -h localhost -U webnote_user -d webnote | gzip > /var/backups/webnote/db_$BACKUP_DATE.sql.gz
find /var/backups/webnote -name "db_*.sql.gz" -mtime +7 -delete
ENDSSH
```

### 恢复数据库

```bash
ssh root@120.26.50.152 << 'ENDSSH'
gunzip -c /var/backups/webnote/db_20240114_120000.sql.gz | sudo -u postgres psql -d webnote
ENDSSH
```

### 应用备份

```bash
ssh root@120.26.50.152 << 'ENDSSH'
mkdir -p /var/backups/webnote
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
tar -czf /var/backups/webnote/app_$BACKUP_DATE.tar.gz -C /var/www webnote --exclude=node_modules --exclude=uploads
ENDSSH
```

## SSL证书（可选）

如果需要HTTPS，使用Let's Encrypt：

```bash
ssh root@120.26.50.152

# 安装Certbot
sudo apt install -y certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d 120.26.50.152

# 测试自动续期
sudo certbot renew --dry-run
```

## 监控

### 系统监控

```bash
# CPU和内存
ssh root@120.26.50.152 "htop"

# 磁盘使用
ssh root@120.26.50.152 "df -h"

# 网络连接
ssh root@120.26.50.152 "ss -tulpn"
```

### 日志监控

```bash
# 应用日志
ssh root@120.26.50.152 "pm2 logs webnote-backend"

# 系统日志
ssh root@120.26.50.152 "journalctl -u nginx -f"
```

## 更新应用

当需要更新应用时：

```bash
# 方法1: 使用部署脚本
./scripts/deploy.sh

# 方法2: 手动更新
git pull origin main
pnpm install
./scripts/deploy.sh
```

## 性能优化

### 后端优化

```bash
# 在ecosystem.config.js中增加实例数
module.exports = {
  apps: [{
    instances: 'max', // 使用所有CPU核心
    exec_mode: 'cluster'
  }]
};
```

### 前端优化

```bash
# 构建时启用生产模式优化
cd packages/web
NODE_ENV=production npm run build
```

### Nginx优化

```nginx
# 在Nginx配置中添加
gzip on;
gzip_min_length 1024;
gzip_comp_level 6;
gzip_types text/plain text/css application/json application/javascript;
```

## 安全建议

1. **防火墙配置**
```bash
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable
```

2. **SSH密钥认证**
```bash
# 在服务器上禁用密码登录
sudo nano /etc/ssh/sshd_config
# 设置: PasswordAuthentication no
sudo systemctl restart sshd
```

3. **数据库安全**
```bash
# 只允许本地连接
sudo nano /etc/postgresql/14/main/pg_hba.conf
# 只保留本地和localhost连接
```

4. **定期更新**
```bash
sudo apt update && sudo apt upgrade -y
```

## 支持

如遇问题，请检查：
1. 服务器日志：`/var/log/`
2. 应用日志：`/var/www/webnote/backend/logs/`
3. PM2日志：`pm2 logs webnote-backend`

详细文档请参考 `packages/backend/scripts/DEPLOYMENT_GUIDE.md`
