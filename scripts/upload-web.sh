#!/usr/bin/env expect

set timeout 300

set PASSWORD "REDACTED_PASSWORD"
set SERVER "root@120.26.50.152"
set LOCAL_DIST [lindex $argv 0]

if {$argc != 1} {
    puts "Usage: $argv0 <dist_path>"
    exit 1
}

puts "正在上传前端文件到服务器..."

spawn scp -r "$LOCAL_DIST" "$SERVER:/var/www/webnote/web/"

expect {
    "password:" {
        send "$PASSWORD\r"
        exp_continue
    }
    "Password:" {
        send "$PASSWORD\r"
        exp_continue
    }
    "100%" {
        expect eof
        puts "✓ 上传完成"
    }
    timeout {
        puts "✗ 上传超时"
        exit 1
    }
    eof {
        puts "✓ 上传完成"
    }
}
