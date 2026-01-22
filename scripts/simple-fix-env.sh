#!/usr/bin/env expect

set timeout 300

set PASSWORD "REDACTED_PASSWORD"
set SERVER "root@120.26.50.152"

puts "正在连接服务器..."

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
    "*#" {
        send "cd /var/www/webnote/backend\r"
        expect "*#"
        send "echo 'NODE_ENV=production' > .env\r"
        expect "*#"
        send "echo 'PORT=3000' >> .env\r"
        expect "*#"
        send "echo 'HOST=0.0.0.0' >> .env\r"
        expect "*#"
        send "echo 'DATABASE_URL=file:./dev.db' >> .env\r"
        expect "*#"
        send "echo 'JWT_SECRET=webnote-production-secret-key-change-in-production-2024' >> .env\r"
        expect "*#"
        send "echo 'ALLOWED_ORIGINS=http://120.26.50.152,http://localhost:5173,http://localhost:3000' >> .env\r"
        expect "*#"
        send "cat .env\r"
        expect "*#"
        send "pm2 restart webnote-backend\r"
        expect "*#"
        send "pm2 logs webnote-backend --lines 10\r"
        expect "*#"
        send "exit\r"
        expect eof
        puts "✓ 环境变量已更新，服务已重启"
    }
    timeout {
        puts "✗ 连接超时"
        exit 1
    }
}
