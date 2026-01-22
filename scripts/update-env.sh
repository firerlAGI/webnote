#!/usr/bin/env expect

set timeout 300

set PASSWORD "REDACTED_PASSWORD"
set SERVER "root@120.26.50.152"

puts "正在更新服务器环境变量..."

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
        send "cd /var/www/webnote/backend\n"
        expect "*$*"
        send "cat > .env << 'ENVEOF'\n"
        expect "*ENVEOF*"
        send "NODE_ENV=production\n"
        expect "*ENVEOF*"
        send "PORT=3000\n"
        expect "*ENVEOF*"
        send "HOST=0.0.0.0\n"
        expect "*ENVEOF*"
        send "DATABASE_URL=file:./dev.db\n"
        expect "*ENVEOF*"
        send "JWT_SECRET=webnote-production-secret-key-change-in-production-2024\n"
        expect "*ENVEOF*"
        send "ALLOWED_ORIGINS=http://120.26.50.152,http://localhost:5173,http://localhost:3000\n"
        expect "*ENVEOF*"
        send "ENVEOF\n"
        expect "*$*"
        send "echo '环境变量已更新'\n"
        expect "*$*"
        send "cat .env\n"
        expect "*$*"
        send "echo '正在重启服务...'\n"
        expect "*$*"
        send "pm2 restart webnote-backend\n"
        expect "*$*"
        send "exit\n"
        expect eof
    }
    timeout {
        puts "✗ 连接超时"
        exit 1
    }
}
