#!/usr/bin/env expect

set timeout 30
set PASSWORD "REDACTED_PASSWORD"
set SERVER "root@120.26.50.152"
set CMD [lindex $argv 0]

if {$argc != 1} {
    puts "Usage: $argv0 <command>"
    exit 1
}

spawn ssh $SERVER $CMD

expect {
    "yes/no" {
        send "yes\r"
        exp_continue
    }
    "password:" {
        send "$PASSWORD\r"
        exp_continue
    }
    "Password:" {
        send "$PASSWORD\r"
        exp_continue
    }
    eof
}
