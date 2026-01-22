#!/bin/bash

PASSWORD="REDACTED_PASSWORD"
SERVER="root@120.26.50.152"

echo "正在更新服务器环境变量..."

sshpass -p "$PASSWORD" ssh "$SERVER" << 'EOF'
cd /var/www/webnote/backend
cat > .env << 'ENVEOF'
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
DATABASE_URL=file:./dev.db
JWT_SECRET=webnote-production-secret-key-change-in-production-2024
ALLOWED_ORIGINS=http://120.26.50.152,http://localhost:5173,http://localhost:3000
ENVEOF
echo "环境变量已更新"
cat .env
echo "正在重启服务..."
pm2 restart webnote-backend
pm2 logs webnote-backend --lines 20
EOF
