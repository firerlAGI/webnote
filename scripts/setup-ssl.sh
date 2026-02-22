#!/bin/bash

# WebNote SSL 证书配置脚本
# 用于在服务器上安装和配置 Let's Encrypt SSL 证书

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 配置
SERVER="root@120.26.50.152"
DOMAIN="120.26.50.152"
EMAIL="admin@webnote.com"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  WebNote SSL 证书配置${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}域名: $DOMAIN${NC}"
echo -e "${YELLOW}邮箱: $EMAIL${NC}"
echo ""

# 检查expect是否安装
if ! command -v expect &> /dev/null; then
    echo -e "${RED}错误: 未安装expect命令${NC}"
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
    exit 1
fi

PASSWORD="$DEPLOY_PASSWORD"

# 步骤1: 在服务器上安装 Certbot
echo -e "${YELLOW}[1/4] 安装 Certbot...${NC}"
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
    "*$*" {
        send "set -e\n"
        expect "*$*"
        send "echo '更新软件包列表...'\n"
        expect "*$*"
        send "sudo apt update\n"
        expect "*$*"
        send "echo '安装 Certbot 和 Nginx 插件...'\n"
        expect "*$*"
        send "sudo apt install -y certbot python3-certbot-nginx\n"
        expect "*$*"
        send "exit\n"
        expect eof
    }
    timeout {
        puts "安装 Certbot 超时"
        exit 1
    }
}
EOF

echo -e "${GREEN}✓ Certbot 安装完成${NC}"
echo ""

# 步骤2: 创建 Nginx 配置文件（HTTP 版本）
echo -e "${YELLOW}[2/4] 创建临时 HTTP Nginx 配置...${NC}"
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
    "*$*" {
        send "cat > /tmp/webnote-http.conf << 'NGINXCONF'
server {
    listen 80;
    server_name $DOMAIN;

    # 前端静态文件
    location / {
        root /var/www/webnote/web/dist;
        try_files \$uri \$uri/ /index.html;
    }

    # 健康检查
    location /health {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
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
        proxy_cache_bypass \$http_upgrade;
    }

    # WebSocket路由
    location /ws {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    # 上传文件目录
    location /uploads/ {
        root /var/www/webnote/backend;
    }
}
NGINXCONF
\n"
        expect "*$*"
        send "echo '复制配置到 Nginx...'\n"
        expect "*$*"
        send "sudo cp /tmp/webnote-http.conf /etc/nginx/sites-available/webnote\n"
        expect "*$*"
        send "sudo ln -sf /etc/nginx/sites-available/webnote /etc/nginx/sites-enabled/webnote\n"
        expect "*$*"
        send "echo '测试 Nginx 配置...'\n"
        expect "*$*"
        send "sudo nginx -t\n"
        expect "*$*"
        send "echo '重载 Nginx...'\n"
        expect "*$*"
        send "sudo systemctl reload nginx\n"
        expect "*$*"
        send "exit\n"
        expect eof
    }
    timeout {
        puts "配置 Nginx 超时"
        exit 1
    }
}
EOF

echo -e "${GREEN}✓ 临时 HTTP 配置创建完成${NC}"
echo ""

# 步骤3: 获取 SSL 证书
echo -e "${YELLOW}[3/4] 获取 SSL 证书...${NC}"
echo -e "${YELLOW}注意: Certbot 将自动配置 Nginx 使用 HTTPS${NC}"
echo ""

expect << EOF
set timeout 600
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
    "*$*" {
        send "sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email $EMAIL --redirect\n"
        expect {
            "Successfully received certificate" {
                expect "*$*"
                send "exit\n"
                expect eof
            }
            "Certificate not yet due for renewal" {
                expect "*$*"
                send "exit\n"
                expect eof
            }
            timeout {
                puts "获取证书超时"
                exit 1
            }
        }
    }
    timeout {
        puts "SSH 连接超时"
        exit 1
    }
}
EOF

echo -e "${GREEN}✓ SSL 证书获取完成${NC}"
echo ""

# 步骤4: 验证 SSL 配置
echo -e "${YELLOW}[4/4] 验证 SSL 配置...${NC}"
sleep 3

if curl -sk "https://$DOMAIN/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ HTTPS 配置成功！${NC}"
else
    echo -e "${YELLOW}⚠  HTTPS 验证失败，请检查 Nginx 配置${NC}"
fi

echo ""

# 步骤5: 测试自动续期
echo -e "${YELLOW}测试 SSL 证书自动续期...${NC}"
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
    "*$*" {
        send "sudo certbot renew --dry-run\n"
        expect {
            "The dry run was successful" {
                expect "*$*"
                send "exit\n"
                expect eof
            }
            "Cert not yet due for renewal" {
                expect "*$*"
                send "exit\n"
                expect eof
            }
            timeout {
                puts "测试续期超时"
                exit 1
            }
        }
    }
    timeout {
        puts "SSH 连接超时"
        exit 1
    }
}
EOF

echo -e "${GREEN}✓ SSL 证书自动续期测试通过${NC}"
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  SSL 配置完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "访问地址:"
echo "  - HTTPS: https://$DOMAIN"
echo "  - HTTP (自动重定向): http://$DOMAIN"
echo ""
echo "SSL 证书信息:"
echo "  - 证书路径: /etc/letsencrypt/live/$DOMAIN/fullchain.pem"
echo "  - 私钥路径: /etc/letsencrypt/live/$DOMAIN/privkey.pem"
echo ""
echo "自动续期:"
echo "  - Certbot 已自动配置续期任务"
echo "  - 使用 'sudo certbot renew --dry-run' 测试续期"
echo ""
echo "常用命令:"
echo "  - 查看证书: sudo certbot certificates"
echo "  - 续期证书: sudo certbot renew"
echo "  - 撤销证书: sudo certbot revoke"
echo "  - 删除证书: sudo certbot delete"
echo ""
