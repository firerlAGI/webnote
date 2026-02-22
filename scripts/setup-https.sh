#!/bin/bash

# WebNote HTTPS 配置脚本
# 用于在服务器上配置 HTTPS（自签名证书方案）
# 
# 注意：由于使用 IP 地址访问，Let's Encrypt 不支持 IP 地址证书
# 本脚本使用自签名证书方案，适用于：
# - 内部测试环境
# - 开发环境
# - 不需要公开信任的场景
#
# 对于生产环境，建议使用域名 + Let's Encrypt

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置
SERVER="root@120.26.50.152"
SERVER_IP="120.26.50.152"
CERT_DIR="/etc/ssl/webnote"
CERT_FILE="$CERT_DIR/webnote.crt"
KEY_FILE="$CERT_DIR/webnote.key"
NGINX_CONF="/etc/nginx/sites-available/webnote"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  WebNote HTTPS 配置脚本${NC}"
echo -e "${GREEN}  (自签名证书方案)${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}服务器 IP: $SERVER_IP${NC}"
echo -e "${YELLOW}证书目录: $CERT_DIR${NC}"
echo ""

# 检查 expect 是否安装
if ! command -v expect &> /dev/null; then
    echo -e "${RED}错误: 未安装 expect 命令${NC}"
    echo -e "${YELLOW}请运行: brew install expect${NC}"
    exit 1
fi

# 尝试从本地 secrets 文件加载密码
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [ -f "$PROJECT_ROOT/scripts/.secrets" ]; then
    source "$PROJECT_ROOT/scripts/.secrets"
fi

# 检查密码是否设置
if [ -z "$DEPLOY_PASSWORD" ]; then
    echo -e "${RED}错误: 未设置 DEPLOY_PASSWORD${NC}"
    echo -e "${YELLOW}请在 scripts/.secrets 文件中设置 DEPLOY_PASSWORD 或导出环境变量${NC}"
    echo -e "${YELLOW}示例: export DEPLOY_PASSWORD='your_password'${NC}"
    exit 1
fi

PASSWORD="$DEPLOY_PASSWORD"

# 函数：执行远程命令
execute_remote() {
    local description="$1"
    local command="$2"
    local timeout="${3:-300}"
    
    echo -e "${YELLOW}$description${NC}"
    
    expect << EOF
set timeout $timeout
spawn ssh $SERVER
expect {
    "password:" {
        send "$PASSWORD\r"
        exp_continue
    }
    "Password:" {
        send "$PASSWORD\r"
        exp_continue
    }
    "*\$*" {
        send "$command\n"
        expect "*\$*"
        send "exit\n"
        expect eof
    }
    timeout {
        puts "命令执行超时"
        exit 1
    }
}
EOF
}

# 函数：检查命令执行结果
check_result() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        echo -e "${RED}✗ 操作失败${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ 操作成功${NC}"
}

# ============================================
# 步骤 1: 检查并安装 OpenSSL
# ============================================
echo -e "${BLUE}[1/6] 检查 OpenSSL...${NC}"

execute_remote "检查 OpenSSL 是否已安装" "which openssl || sudo apt install -y openssl"
check_result

# ============================================
# 步骤 2: 创建证书目录
# ============================================
echo ""
echo -e "${BLUE}[2/6] 创建证书目录...${NC}"

execute_remote "创建 SSL 证书目录" "sudo mkdir -p $CERT_DIR && sudo chmod 700 $CERT_DIR"
check_result

# ============================================
# 步骤 3: 生成自签名 SSL 证书
# ============================================
echo ""
echo -e "${BLUE}[3/6] 生成自签名 SSL 证书...${NC}"
echo -e "${YELLOW}注意: 自签名证书会导致浏览器显示安全警告${NC}"
echo -e "${YELLOW}这是正常现象，可以继续访问${NC}"
echo ""

# 检查证书是否已存在
CERT_EXISTS=$(expect << EOF 2>/dev/null
set timeout 60
spawn ssh $SERVER
expect {
    "password:" {
        send "$PASSWORD\r"
        exp_continue
    }
    "Password:" {
        send "$PASSWORD\r"
        exp_continue
    }
    "*\$*" {
        send "test -f $CERT_FILE && echo 'exists' || echo 'not_exists'\n"
        expect "*\$*"
        send "exit\n"
        expect eof
    }
}
EOF
)

if echo "$CERT_EXISTS" | grep -q "exists"; then
    echo -e "${YELLOW}证书已存在，跳过生成步骤${NC}"
    echo -e "${YELLOW}如需重新生成，请先删除: sudo rm -rf $CERT_DIR${NC}"
else
    # 生成自签名证书
    expect << EOF
set timeout 120
spawn ssh $SERVER
expect {
    "password:" {
        send "$PASSWORD\r"
        exp_continue
    }
    "Password:" {
        send "$PASSWORD\r"
        exp_continue
    }
    "*\$*" {
        send "sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \\\n"
        expect "*\$*"
        send "  -keyout $KEY_FILE \\\n"
        expect "*\$*"
        send "  -out $CERT_FILE \\\n"
        expect "*\$*"
        send "  -subj \"/C=CN/ST=Shanghai/L=Shanghai/O=WebNote/OU=IT/CN=$SERVER_IP\"\n"
        expect "*\$*"
        send "sudo chmod 600 $KEY_FILE\n"
        expect "*\$*"
        send "sudo chmod 644 $CERT_FILE\n"
        expect "*\$*"
        send "ls -la $CERT_DIR\n"
        expect "*\$*"
        send "exit\n"
        expect eof
    }
    timeout {
        puts "生成证书超时"
        exit 1
    }
}
EOF
    check_result
    echo -e "${GREEN}✓ 自签名证书生成成功${NC}"
fi

# ============================================
# 步骤 4: 创建 HTTPS Nginx 配置
# ============================================
echo ""
echo -e "${BLUE}[4/6] 配置 Nginx HTTPS...${NC}"

# 创建 HTTPS Nginx 配置
expect << EOF
set timeout 300
spawn ssh $SERVER
expect {
    "password:" {
        send "$PASSWORD\r"
        exp_continue
    }
    "Password:" {
        send "$PASSWORD\r"
        exp_continue
    }
    "*\$*" {
        send "cat > /tmp/webnote-https.conf << 'NGINXCONF'
# HTTP 重定向到 HTTPS
server {
    listen 80;
    server_name $SERVER_IP;
    
    # 将 HTTP 重定向到 HTTPS
    return 301 https://\$server_name\$request_uri;
}

# HTTPS 服务器
server {
    listen 443 ssl http2;
    server_name $SERVER_IP;
    
    # SSL 证书配置（自签名证书）
    ssl_certificate $CERT_FILE;
    ssl_certificate_key $KEY_FILE;
    
    # SSL 安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # HSTS (强制使用 HTTPS)
    # 注意: 对于自签名证书，HSTS 可能导致问题，首次部署建议注释掉
    # add_header Strict-Transport-Security \"max-age=31536000; includeSubDomains\" always;
    
    # 安全头部
    add_header X-Frame-Options \"SAMEORIGIN\" always;
    add_header X-Content-Type-Options \"nosniff\" always;
    add_header X-XSS-Protection \"1; mode=block\" always;
    add_header Referrer-Policy \"strict-origin-when-cross-origin\" always;
    
    # 前端静态文件
    location / {
        root /var/www/webnote/web/dist;
        try_files \$uri \$uri/ /index.html;
        add_header Cache-Control \"no-cache, no-store, must-revalidate\";
        add_header Pragma \"no-cache\";
        add_header Expires \"0\";
    }
    
    # 健康检查
    location /health {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
    
    # API代理到后端
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Authorization \$http_authorization;
        proxy_cache_bypass \$http_upgrade;
        
        # WebSocket支持
        proxy_set_header Connection \$http_connection;
        proxy_set_header Upgrade \$http_upgrade;
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # WebSocket路由
    location /ws {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \"Upgrade\";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # 上传文件目录
    location /uploads/ {
        root /var/www/webnote/backend;
        add_header Cache-Control \"public, max-age=31536000\";
    }
    
    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/rss+xml font/truetype font/opentype application/vnd.ms-fontobject image/svg+xml;
}
NGINXCONF
\n"
        expect "*\$*"
        send "sudo cp /tmp/webnote-https.conf $NGINX_CONF\n"
        expect "*\$*"
        send "sudo ln -sf $NGINX_CONF /etc/nginx/sites-enabled/webnote\n"
        expect "*\$*"
        send "echo '测试 Nginx 配置...'\n"
        expect "*\$*"
        send "sudo nginx -t\n"
        expect "*\$*"
        send "exit\n"
        expect eof
    }
    timeout {
        puts "配置 Nginx 超时"
        exit 1
    }
}
EOF

check_result
echo -e "${GREEN}✓ Nginx HTTPS 配置完成${NC}"

# ============================================
# 步骤 5: 重启 Nginx 服务
# ============================================
echo ""
echo -e "${BLUE}[5/6] 重启 Nginx 服务...${NC}"

execute_remote "重启 Nginx" "sudo systemctl restart nginx && sudo systemctl status nginx --no-pager"
check_result

# ============================================
# 步骤 6: 验证 HTTPS 配置
# ============================================
echo ""
echo -e "${BLUE}[6/6] 验证 HTTPS 配置...${NC}"
sleep 3

# 测试 HTTPS 连接
echo -e "${YELLOW}测试 HTTPS 连接...${NC}"
if curl -sk "https://$SERVER_IP/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ HTTPS 配置成功！${NC}"
else
    echo -e "${YELLOW}⚠  HTTPS 验证失败，请检查 Nginx 配置${NC}"
fi

# 测试 HTTP 重定向
echo -e "${YELLOW}测试 HTTP 重定向...${NC}"
REDIRECT_TEST=$(curl -sI "http://$SERVER_IP" 2>/dev/null | grep -i "301\|302" || true)
if [ -n "$REDIRECT_TEST" ]; then
    echo -e "${GREEN}✓ HTTP 到 HTTPS 重定向正常${NC}"
else
    echo -e "${YELLOW}⚠  HTTP 重定向可能未生效${NC}"
fi

# ============================================
# 完成
# ============================================
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  HTTPS 配置完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}访问地址:${NC}"
echo "  - HTTPS: https://$SERVER_IP"
echo "  - HTTP (自动重定向): http://$SERVER_IP"
echo ""
echo -e "${BLUE}证书信息:${NC}"
echo "  - 证书路径: $CERT_FILE"
echo "  - 私钥路径: $KEY_FILE"
echo "  - 有效期: 365 天"
echo "  - 类型: 自签名证书"
echo ""
echo -e "${YELLOW}重要提示:${NC}"
echo "  1. 自签名证书会导致浏览器显示安全警告"
echo "  2. 这是正常现象，点击\"高级\"->\"继续访问\"即可"
echo "  3. 如需公开信任的证书，请使用域名 + Let's Encrypt"
echo "  4. 证书到期前需要重新生成（运行此脚本即可）"
echo ""
echo -e "${BLUE}常用命令:${NC}"
echo "  - 查看证书: openssl x509 -in $CERT_FILE -text -noout"
echo "  - 测试 HTTPS: curl -k https://$SERVER_IP/health"
echo "  - 查看 Nginx 日志: tail -f /var/log/nginx/error.log"
echo "  - 重启 Nginx: sudo systemctl restart nginx"
echo ""
echo -e "${BLUE}更新后端环境变量:${NC}"
echo "  需要在后端 .env 文件中添加 HTTPS 地址到 ALLOWED_ORIGINS:"
echo "  ALLOWED_ORIGINS=\"http://$SERVER_IP,https://$SERVER_IP\""
echo ""
