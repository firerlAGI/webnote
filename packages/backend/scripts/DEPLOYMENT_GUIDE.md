# WebNote 生产环境部署指南

## 服务器信息
- **服务器IP**: 120.26.50.152
- **端口**: 3000 (后端), 80/443 (前端Nginx)
- **系统**: Linux (假设)

## 前置要求

### 1. 安装必要软件

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装Node.js (18.x+)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 安装PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# 安装Nginx
sudo apt install -y nginx

# 安装Git
sudo apt install -y git

# 安装PM2 (进程管理)
sudo npm install -g pm2
```

### 2. 配置PostgreSQL

```bash
# 切换到postgres用户
sudo -u postgres psql

# 创建数据库和用户
CREATE DATABASE webnote;
CREATE USER webnote_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE webnote TO webnote_user;
\q

# 修改postgresql.conf允许远程连接
sudo nano /etc/postgresql/14/main/postgresql.conf

# 添加以下行：
listen_addresses = '*'

# 修改pg_hba.conf
sudo nano /etc/postgresql/14/main/pg_hba.conf

# 添加：
host all all 0.0.0.0/0 md5

# 重启PostgreSQL
sudo systemctl restart postgresql
```

### 3. 配置防火墙

```bash
# 开放必要端口
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw allow 5432  # PostgreSQL (可选，建议限制IP)
sudo ufw enable
```

## 部署步骤

### 1. 克隆或上传代码

```bash
# 方式1: 克隆Git仓库
cd /var/www
sudo git clone https://github.com/firerlAGI/webnote.git
sudo chown -R $USER:$USER /var/www/webnote

# 方式2: 上传压缩包（本地执行）
cd /Users/fire/Projects/webnote
tar -czf webnote.tar.gz --exclude=node_modules --exclude=dist .
scp webnote.tar.gz user@120.26.50.152:/tmp/
# 在服务器上：
cd /var/www
tar -xzf /tmp/webnote.tar.gz
```

### 2. 安装依赖

```bash
cd /var/www/webnote

# 安装项目依赖
npm install -g pnpm
pnpm install

# 构建共享包
cd packages/shared
npm run build
```

### 3. 配置环境变量

```bash
cd /var/www/webnote/packages/backend

# 创建.env文件
cat > .env << EOF
# 数据库配置
DATABASE_URL="postgresql://webnote_user:your_secure_password@localhost:5432/webnote"

# JWT密钥（生成一个随机密钥）
JWT_SECRET="$(openssl rand -base64 32)"

# 服务器配置
PORT=3000
NODE_ENV=production

# CORS配置
ALLOWED_ORIGINS="http://120.26.50.152,https://120.26.50.152"

# OSS配置（阿里云，可选）
OSS_REGION="your-region"
OSS_ACCESS_KEY_ID="your-access-key"
OSS_ACCESS_KEY_SECRET="your-secret-key"
OSS_BUCKET="your-bucket"
EOF

# 设置权限
chmod 600 .env
```

### 4. 运行数据库迁移

```bash
cd /var/www/webnote/packages/backend

# 生成Prisma客户端
npx prisma generate

# 运行迁移
npx prisma migrate deploy

# 或者在开发环境
npx prisma migrate dev
```

### 5. 构建后端

```bash
cd /var/www/webnote/packages/backend

# TypeScript编译
npm run build

# 创建uploads目录
mkdir -p uploads
chmod 755 uploads
```

### 6. 构建前端

```bash
cd /var/www/webnote/packages/web

# 安装依赖
pnpm install

# 构建
npm run build

# 构建产物在dist目录
```

### 7. 配置Nginx

```bash
# 创建Nginx配置
sudo nano /etc/nginx/sites-available/webnote
```

添加以下配置：

```nginx
server {
    listen 80;
    server_name 120.26.50.152;

    # 前端静态文件
    location / {
        root /var/www/webnote/packages/web/dist;
        try_files $uri $uri/ /index.html;
        
        # 缓存配置
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

    # 上传文件大小限制
    client_max_body_size 10M;

    # Gzip压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

启用配置：

```bash
# 创建符号链接
sudo ln -s /etc/nginx/sites-available/webnote /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启Nginx
sudo systemctl restart nginx
```

### 8. 使用PM2管理后端服务

```bash
cd /var/www/webnote/packages/backend

# 创建PM2配置文件
cat > ecosystem.config.js << EOF
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
EOF

# 创建日志目录
mkdir -p logs

# 启动服务
pm2 start ecosystem.config.js

# 设置开机自启
pm2 startup
pm2 save

# 查看日志
pm2 logs webnote-backend
```

## 验证部署

### 1. 检查服务状态

```bash
# 检查PM2服务
pm2 status

# 检查Nginx服务
sudo systemctl status nginx

# 检查PostgreSQL服务
sudo systemctl status postgresql

# 查看端口监听
sudo netstat -tulpn | grep -E ':(3000|80|443|5432)'
```

### 2. 测试API

```bash
# 测试健康检查
curl http://120.26.50.152/health

# 测试API（如果已注册用户）
curl -X POST http://120.26.50.152/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

### 3. 访问应用

- **前端**: http://120.26.50.152
- **后端API**: http://120.26.50.152/api

## 安全加固

### 1. 配置SSL证书（Let's Encrypt）

```bash
# 安装Certbot
sudo apt install -y certbot python3-certbot-nginx

# 获取SSL证书
sudo certbot --nginx -d 120.26.50.152

# 自动续期
sudo certbot renew --dry-run
```

更新Nginx配置使用HTTPS：

```nginx
server {
    listen 443 ssl http2;
    server_name 120.26.50.152;

    ssl_certificate /etc/letsencrypt/live/120.26.50.152/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/120.26.50.152/privkey.pem;
    
    # 其余配置保持不变...
}

# HTTP重定向到HTTPS
server {
    listen 80;
    server_name 120.26.50.152;
    return 301 https://$server_name$request_uri;
}
```

### 2. 数据库安全

```bash
# 只允许本地连接到PostgreSQL
sudo nano /etc/postgresql/14/main/pg_hba.conf

# 注释掉允许所有IP的行，只保留：
local   all             all                                     md5
host    all             all             127.0.0.1/32            md5
```

### 3. 限制SSH访问

```bash
# 禁用密码登录，使用密钥
sudo nano /etc/ssh/sshd_config

# 设置：
PasswordAuthentication no
PubkeyAuthentication yes

# 重启SSH
sudo systemctl restart sshd
```

## 监控和日志

### 查看后端日志

```bash
# PM2日志
pm2 logs webnote-backend --lines 100

# 应用日志
tail -f /var/www/webnote/packages/backend/logs/out.log
```

### 查看Nginx日志

```bash
# 访问日志
sudo tail -f /var/log/nginx/access.log

# 错误日志
sudo tail -f /var/log/nginx/error.log
```

### 系统监控

```bash
# CPU和内存
htop

# 磁盘使用
df -h

# 网络连接
ss -tulpn
```

## 更新部署

当需要更新应用时：

```bash
cd /var/www/webnote

# 拉取最新代码
git pull origin main

# 安装依赖
pnpm install

# 构建共享包
cd packages/shared
npm run build
cd ../..

# 构建后端
cd packages/backend
npm run build

# 构建前端
cd ../web
npm run build

# 运行数据库迁移（如果有）
cd ../backend
npx prisma migrate deploy

# 重启PM2服务
pm2 restart webnote-backend

# 重载Nginx
sudo systemctl reload nginx
```

## 故障排除

### 问题：后端无法启动

```bash
# 检查端口占用
sudo lsof -i :3000

# 检查环境变量
cat .env

# 检查日志
pm2 logs webnote-backend --err
```

### 问题：数据库连接失败

```bash
# 测试数据库连接
psql -h localhost -U webnote_user -d webnote

# 检查PostgreSQL状态
sudo systemctl status postgresql

# 查看PostgreSQL日志
sudo tail -f /var/log/postgresql/postgresql-14-main.log
```

### 问题：Nginx 502错误

```bash
# 检查后端是否运行
pm2 status

# 测试后端端口
curl http://localhost:3000/health

# 检查Nginx配置
sudo nginx -t
```

### 问题：前端静态文件404

```bash
# 检查构建目录
ls -la /var/www/webnote/packages/web/dist

# 检查Nginx配置的root路径
grep "root" /etc/nginx/sites-enabled/webnote

# 检查文件权限
ls -la /var/www/webnote/packages/web/dist
```

## 备份策略

### 数据库备份

```bash
# 创建备份脚本
cat > /var/www/webnote/scripts/backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/webnote"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# 备份数据库
PGPASSWORD="your_password" pg_dump -h localhost -U webnote_user -d webnote | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# 保留最近7天的备份
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +7 -delete

echo "Backup completed: db_$DATE.sql.gz"
EOF

chmod +x /var/www/webnote/scripts/backup-db.sh

# 添加到crontab（每天凌晨2点）
(crontab -l 2>/dev/null; echo "0 2 * * * /var/www/webnote/scripts/backup-db.sh") | crontab -
```

### 应用备份

```bash
# 创建备份脚本
cat > /var/www/webnote/scripts/backup-app.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/webnote"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# 备份应用文件
tar -czf $BACKUP_DIR/app_$DATE.tar.gz -C /var/www webnote --exclude=node_modules --exclude=uploads

echo "Backup completed: app_$DATE.tar.gz"
EOF

chmod +x /var/www/webnote/scripts/backup-app.sh

# 添加到crontab（每周日凌晨3点）
(crontab -l 2>/dev/null; echo "0 3 * * 0 /var/www/webnote/scripts/backup-app.sh") | crontab -
```

## 联系支持

如遇到部署问题，请检查：
1. 服务器日志：`/var/log/`
2. 应用日志：`/var/www/webnote/packages/backend/logs/`
3. PM2日志：`pm2 logs webnote-backend`

## 附录：快速部署脚本

```bash
#!/bin/bash
# deploy.sh - 一键部署脚本

set -e

echo "开始部署 WebNote..."

# 停止PM2服务
pm2 stop webnote-backend

# 拉取最新代码
git pull origin main

# 安装依赖
pnpm install

# 构建共享包
cd packages/shared && npm run build && cd ../..

# 构建后端
cd packages/backend && npm run build && cd ../..

# 构建前端
cd packages/web && npm run build && cd ../..

# 运行迁移
cd packages/backend && npx prisma migrate deploy && cd ../..

# 重启PM2
pm2 restart webnote-backend

# 重载Nginx
sudo systemctl reload nginx

echo "部署完成！"
```

使用方法：
```bash
chmod +x deploy.sh
./deploy.sh
