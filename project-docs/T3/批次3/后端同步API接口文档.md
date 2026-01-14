# T3项目后端同步API接口文档

## 概述

T3项目的同步API提供了一套完整的WebSocket和REST接口，用于实现客户端与服务器之间的数据同步。支持笔记、文件夹、复盘等多种数据类型的同步，具备冲突检测和解决机制。

## 目录

1. [WebSocket接口](#websocket接口)
2. [REST API接口](#rest-api接口)
3. [数据模型](#数据模型)
4. [错误处理](#错误处理)
5. [最佳实践](#最佳实践)

---

## WebSocket接口

### 连接端点

```
ws://localhost:3000/api/sync/ws
```

### 消息流程

#### 1. 握手 (Handshake)

**客户端发送:**
```typescript
{
  "type": "handshake",
  "message_id": "msg_123",
  "timestamp": "2024-01-10T10:00:00Z",
  "client_id": "client_abc123",
  "client_info": {
    "device_type": "desktop",
    "os_name": "Windows",
    "os_version": "10",
    "app_version": "1.0.0"
  },
  "protocol_version": "1.0.0"
}
```

**服务器响应:**
```typescript
{
  "type": "handshake",
  "message_id": "msg_123",
  "timestamp": "2024-01-10T10:00:00Z",
  "success": true,
  "server_id": "server-1",
  "protocol_version": "1.0.0",
  "connection_id": "conn_xyz789"
}
```

#### 2. 认证 (Auth)

**客户端发送:**
```typescript
{
  "type": "auth",
  "message_id": "msg_124",
  "timestamp": "2024-01-10T10:00:01Z",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**服务器响应:**
```typescript
{
  "type": "auth",
  "message_id": "msg_124",
  "timestamp": "2024-01-10T10:00:01Z",
  "success": true,
  "user_id": 1,
  "current_state": {
    "client_id": "client_abc123",
    "last_sync_time": "2024-01-09T10:00:00Z",
    "server_version": "1.0.0",
    "pending_operations": 0
  }
}
```

#### 3. 同步 (Sync)

**客户端发送:**
```typescript
{
  "type": "sync",
  "message_id": "msg_125",
  "timestamp": "2024-01-10T10:00:02Z",
  "data": {
    "request_id": "sync_req_001",
    "client_id": "client_abc123",
    "client_state": {
      "client_id": "client_abc123",
      "last_sync_time": "2024-01-09T10:00:00Z",
      "server_version": "1.0.0",
      "pending_operations": 2
    },
    "protocol_version": "1.0.0",
    "operations": [
      {
        "operation_id": "op_001",
        "operation_type": "create",
        "entity_type": "note",
        "data": {
          "title": "新笔记",
          "content": "笔记内容"
        },
        "client_id": "client_abc123",
        "timestamp": "2024-01-10T10:00:00Z"
      },
      {
        "operation_id": "op_002",
        "operation_type": "update",
        "entity_type": "note",
        "entity_id": 123,
        "changes": {
          "title": "更新后的标题"
        },
        "before_version": 1,
        "client_id": "client_abc123",
        "timestamp": "2024-01-10T10:00:01Z"
      }
    ]
  }
}
```

**服务器响应:**
```typescript
{
  "type": "sync_response",
  "message_id": "msg_125",
  "timestamp": "2024-01-10T10:00:02Z",
  "request_id": "sync_req_001",
  "data": {
    "request_id": "sync_req_001",
    "server_time": "2024-01-10T10:00:02Z",
    "protocol_version": "1.0.0",
    "status": "success",
    "operation_results": [
      {
        "operation_id": "op_001",
        "operation_type": "create",
        "entity_type": "note",
        "success": true,
        "entity_id": 124,
        "new_version": 1,
        "data": {
          "id": 124,
          "title": "新笔记",
          "content": "笔记内容"
        }
      },
      {
        "operation_id": "op_002",
        "operation_type": "update",
        "entity_type": "note",
        "success": true,
        "entity_id": 123,
        "new_version": 2,
        "data": {
          "id": 123,
          "title": "更新后的标题"
        }
      }
    ],
    "server_updates": [
      {
        "entity_type": "note",
        "entity_id": 125,
        "operation_type": "create",
        "version": 1,
        "data": {
          "id": 125,
          "title": "服务器创建的笔记"
        },
        "modified_at": "2024-01-10T09:30:00Z",
        "modified_by": 2
      }
    ],
    "conflicts": [],
    "new_client_state": {
      "client_id": "client_abc123",
      "last_sync_time": "2024-01-10T10:00:02Z",
      "server_version": "1.0.0",
      "pending_operations": 0,
      "last_sync_id": "sync_abc123"
    }
  }
}
```

#### 4. 服务器推送 (Server Update)

**服务器推送:**
```typescript
{
  "type": "server_update",
  "message_id": "msg_server_001",
  "timestamp": "2024-01-10T10:05:00Z",
  "update_type": "incremental",
  "entity_type": "note",
  "entity_id": 123,
  "update_data": {
    "operation_type": "update",
    "version": 3,
    "data": {
      "id": 123,
      "title": "其他用户更新的标题"
    },
    "modified_at": "2024-01-10T10:05:00Z",
    "modified_by": 2
  }
}
```

#### 5. 冲突通知 (Conflict Notification)

**服务器推送:**
```typescript
{
  "type": "conflict",
  "message_id": "msg_conflict_001",
  "timestamp": "2024-01-10T10:10:00Z",
  "conflict": {
    "conflict_id": "conflict_001",
    "conflict_type": "content",
    "entity_type": "note",
    "entity_id": 123,
    "operation_id": "op_003",
    "server_data": {
      "version": 3,
      "data": {
        "title": "服务器版本",
        "content": "服务器内容"
      },
      "modified_at": "2024-01-10T10:05:00Z",
      "modified_by": 2
    },
    "client_data": {
      "version": 2,
      "data": {
        "title": "客户端版本",
        "content": "客户端内容"
      },
      "modified_at": "2024-01-10T10:10:00Z",
      "operation_type": "update"
    },
    "conflict_fields": ["title", "content"],
    "suggested_strategy": "latest_wins",
    "timestamp": "2024-01-10T10:10:00Z"
  },
  "requires_manual_resolution": false
}
```

#### 6. 心跳 (Ping/Pong)

**客户端发送:**
```typescript
{
  "type": "ping",
  "timestamp": "2024-01-10T10:00:30Z"
}
```

**服务器响应:**
```typescript
{
  "type": "pong",
  "timestamp": "2024-01-10T10:00:30Z"
}
```

---

## REST API接口

### 基础URL

```
http://localhost:3000/api/sync
```

### 认证

所有REST API请求都需要在Header中携带JWT token:

```
Authorization: Bearer <your_jwt_token>
```

### 1. 执行同步

**端点:** `POST /api/sync/sync`

**请求体:**
```typescript
{
  "request_id": "sync_req_001",
  "client_id": "client_abc123",
  "client_state": {
    "client_id": "client_abc123",
    "last_sync_time": "2024-01-09T10:00:00Z",
    "server_version": "1.0.0",
    "pending_operations": 2
  },
  "protocol_version": "1.0.0",
  "operations": [
    {
      "operation_id": "op_001",
      "operation_type": "create",
      "entity_type": "note",
      "data": {
        "title": "新笔记",
        "content": "笔记内容"
      },
      "client_id": "client_abc123",
      "timestamp": "2024-01-10T10:00:00Z"
    }
  ],
  "default_resolution_strategy": "latest_wins",
  "incremental": true,
  "batch_size": 100,
  "batch_index": 0,
  "is_last_batch": true
}
```

**响应:**
```typescript
{
  "success": true,
  "data": {
    "request_id": "sync_req_001",
    "server_time": "2024-01-10T10:00:02Z",
    "protocol_version": "1.0.0",
    "status": "success",
    "operation_results": [...],
    "server_updates": [...],
    "conflicts": [],
    "new_client_state": {...}
  }
}
```

### 2. 获取同步数据

**端点:** `POST /api/sync/sync-data`

**请求体:**
```typescript
{
  "client_id": "client_abc123",
  "protocol_version": "1.0.0",
  "entity_types": ["note", "folder", "review"],
  "since": "2024-01-09T10:00:00Z",
  "full_sync": false,
  "batch_size": 100,
  "batch_index": 0,
  "is_last_batch": false
}
```

**响应:**
```typescript
{
  "success": true,
  "data": {
    "sync_id": "sync_abc123",
    "entity_type": "note",
    "entities": [
      {
        "id": 1,
        "version": 1,
        "data": {
          "title": "笔记标题",
          "content": "笔记内容"
        },
        "created_at": "2024-01-09T10:00:00Z",
        "updated_at": "2024-01-09T10:00:00Z"
      }
    ],
    "has_more": true,
    "next_batch_index": 1,
    "server_time": "2024-01-10T10:00:00Z"
  }
}
```

### 3. 获取同步状态

**端点:** `GET /api/sync/status`

**查询参数:**
- `client_id` (可选): 客户端ID
- `sync_id` (可选): 同步ID

**请求示例:**
```
GET /api/sync/status?client_id=client_abc123
```

**响应:**
```typescript
{
  "success": true,
  "data": {
    "active_syncs": [
      {
        "sync_id": "sync_abc123",
        "client_id": "client_abc123",
        "user_id": 1,
        "status": "syncing",
        "start_time": "2024-01-10T10:00:00Z",
        "end_time": null,
        "total_operations": 100,
        "completed_operations": 50,
        "successful_operations": 48,
        "failed_operations": 2,
        "conflicts_count": 1,
        "resolved_conflicts": 0,
        "progress": 50,
        "entity_types": ["note", "folder"],
        "error": null
      }
    ],
    "client_state": {
      "client_id": "client_abc123",
      "last_sync_time": "2024-01-09T10:00:00Z",
      "server_version": "1.0.0",
      "pending_operations": 0
    },
    "sync_history": [...]
  }
}
```

### 4. 获取同步队列

**端点:** `GET /api/sync/queue`

**查询参数:**
- `client_id` (可选): 客户端ID
- `queue_type` (可选): `pending`, `processing`, `failed`, `all`
- `entity_type` (可选): `note`, `folder`, `review`
- `page` (可选): 页码，默认1
- `limit` (可选): 每页数量，默认20

**请求示例:**
```
GET /api/sync/queue?queue_type=pending&limit=10
```

**响应:**
```typescript
{
  "success": true,
  "data": {
    "operations": [
      {
        "operation_id": "op_001",
        "sync_id": "sync_abc123",
        "client_id": "client_abc123",
        "user_id": 1,
        "operation_type": "create",
        "entity_type": "note",
        "entity_id": null,
        "data": {
          "title": "新笔记"
        },
        "status": "pending",
        "retry_count": 0,
        "created_at": "2024-01-10T10:00:00Z",
        "estimated_processing_time": "2024-01-10T10:00:05Z",
        "error": null
      }
    ],
    "total": 1,
    "pagination": {
      "page": 1,
      "limit": 10,
      "total_pages": 1
    },
    "stats": {
      "pending": 1,
      "processing": 0,
      "completed": 0,
      "failed": 0
    }
  }
}
```

### 5. 解决冲突

**端点:** `POST /api/sync/resolve-conflict`

**请求体:**
```typescript
{
  "conflict_id": "conflict_001",
  "resolution": {
    "conflict_id": "conflict_001",
    "strategy": "merge",
    "resolved_data": {
      "title": "合并后的标题",
      "content": "合并后的内容"
    },
    "auto_resolve": true
  }
}
```

**响应:**
```typescript
{
  "success": true,
  "data": {
    "conflict_id": "conflict_001",
    "success": true,
    "resolved_data": {
      "title": "合并后的标题",
      "content": "合并后的内容"
    },
    "new_version": 4
  }
}
```

### 6. 批量解决冲突

**端点:** `POST /api/sync/resolve-conflicts`

**请求体:**
```typescript
{
  "resolutions": [
    {
      "conflict_id": "conflict_001",
      "resolution": {
        "conflict_id": "conflict_001",
        "strategy": "server_wins",
        "auto_resolve": true
      }
    },
    {
      "conflict_id": "conflict_002",
      "resolution": {
        "conflict_id": "conflict_002",
        "strategy": "merge",
        "resolved_data": {...},
        "auto_resolve": true
      }
    }
  ]
}
```

**响应:**
```typescript
{
  "success": true,
  "data": [
    {
      "conflict_id": "conflict_001",
      "success": true,
      "new_version": 5
    },
    {
      "conflict_id": "conflict_002",
      "success": true,
      "new_version": 6
    }
  ]
}
```

### 7. 获取数据差异

**端点:** `POST /api/sync/data-diff`

**请求体:**
```typescript
{
  "client_id": "client_abc123",
  "entity_type": "note",
  "entity_id": 123,
  "client_version": 2,
  "server_version": 3
}
```

**响应:**
```typescript
{
  "success": true,
  "data": {
    "diffs": [
      {
        "entity_id": 123,
        "entity_type": "note",
        "client_version": 2,
        "server_version": 3,
        "client_data": {
          "title": "客户端标题",
          "content": "客户端内容"
        },
        "server_data": {
          "title": "服务器标题",
          "content": "服务器内容"
        },
        "field_diffs": [
          {
            "field_name": "title",
            "client_value": "客户端标题",
            "server_value": "服务器标题",
            "diff_type": "modified"
          },
          {
            "field_name": "content",
            "client_value": "客户端内容",
            "server_value": "服务器内容",
            "diff_type": "modified"
          }
        ],
        "diff_type": "conflict",
        "has_conflict": true
      }
    ],
    "total_diffs": 1,
    "conflicts_count": 1,
    "server_time": "2024-01-10T10:00:00Z"
  }
}
```

### 8. 取消同步

**端点:** `POST /api/sync/cancel`

**请求体:**
```typescript
{
  "sync_id": "sync_abc123",
  "reason": "用户取消"
}
```

**响应:**
```typescript
{
  "success": true,
  "sync_id": "sync_abc123"
}
```

### 9. 重试失败的同步

**端点:** `POST /api/sync/retry`

**请求体:**
```typescript
{
  "sync_id": "sync_abc123",
  "operation_ids": ["op_001", "op_002"]
}
```

**响应:**
```typescript
{
  "success": true,
  "sync_id": "sync_abc123",
  "retried_count": 2
}
```

### 10. 清除同步历史

**端点:** `POST /api/sync/clear-history`

**请求体:**
```typescript
{
  "client_id": "client_abc123",
  "retain_days": 30
}
```

**响应:**
```typescript
{
  "success": true,
  "cleared_count": 100
}
```

---

## 数据模型

### 同步状态枚举

```typescript
enum SyncStatus {
  PENDING = 'pending',      // 等待同步
  SYNCING = 'syncing',      // 同步中
  SUCCESS = 'success',      // 同步成功
  FAILED = 'failed',        // 同步失败
  CONFLICT = 'conflict',    // 存在冲突
  CANCELLED = 'cancelled'   // 已取消
}
```

### 操作类型枚举

```typescript
enum SyncOperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  READ = 'read',
  RESOLVE = 'resolve'
}
```

### 冲突类型枚举

```typescript
enum ConflictType {
  CONTENT = 'content',      // 内容冲突
  VERSION = 'version',      // 版本冲突
  DELETE = 'delete',        // 删除冲突
  PARENT = 'parent',        // 父级冲突
  UNIQUE = 'unique'         // 唯一性冲突
}
```

### 冲突解决策略枚举

```typescript
enum ConflictResolutionStrategy {
  SERVER_WINS = 'server_wins',    // 使用服务器版本
  CLIENT_WINS = 'client_wins',    // 使用客户端版本
  MERGE = 'merge',                // 合并版本
  MANUAL = 'manual',              // 手动解决
  LATEST_WINS = 'latest_wins'     // 基于时间戳，最新的版本胜出
}
```

---

## 错误处理

### 错误响应格式

所有API错误都遵循以下格式:

```typescript
{
  "success": false,
  "error": "错误描述信息",
  "error_code": "ERROR_CODE",
  "details": {
    // 额外的错误详情
  }
}
```

### 常见错误代码

| 错误代码 | 描述 |
|---------|------|
| UNAUTHORIZED | 未授权，token无效或过期 |
| FORBIDDEN | 禁止访问，没有权限 |
| NOT_FOUND | 资源不存在 |
| CONFLICT | 数据冲突 |
| VALIDATION_ERROR | 数据验证失败 |
| SYNC_ERROR | 同步错误 |
| NETWORK_ERROR | 网络错误 |
| TIMEOUT | 请求超时 |
| RATE_LIMIT_EXCEEDED | 超过速率限制 |

---

## 最佳实践

### 1. 连接管理

- 建立WebSocket连接后，立即进行握手和认证
- 实现心跳机制，保持连接活跃
- 处理连接断开，实现自动重连

### 2. 数据同步

- 使用增量同步减少数据传输量
- 批量处理操作，提高效率
- 处理同步状态变更，提供用户反馈

### 3. 冲突处理

- 监听冲突通知，及时处理
- 使用合适的解决策略
- 提供手动解决冲突的UI

### 4. 错误处理

- 实现完善的错误处理机制
- 记录错误日志
- 提供友好的错误提示

### 5. 性能优化

- 使用分批处理大数据集
- 实现本地缓存
- 压缩大数据传输

---

## 版本历史

- **v1.0.0** (2024-01-10): 初始版本，支持基本的同步功能
