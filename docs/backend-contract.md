# Backend Contract

前端通过 `NEXT_PUBLIC_BACKEND_API_BASE_URL` 调用独立业务后端，并携带 `credentials: include`。生产环境建议后端使用 HttpOnly、Secure、SameSite Cookie 管理会话。

## Authentication

### POST /auth/register

请求：

```json
{
  "displayName": "User",
  "email": "user@example.com",
  "password": "password"
}
```

响应与登录接口一致。建议注册成功后直接建立会话，也可以返回 `201` 后要求用户登录。

### POST /auth/login

请求：

```json
{
  "email": "user@example.com",
  "password": "password"
}
```

响应：

```json
{
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "displayName": "User"
  }
}
```

### GET /auth/me

有会话时返回与登录接口相同的用户结构；未登录返回 `401`。

### POST /auth/logout

清除服务端会话并返回 `204` 或空 JSON。

## Redeem

### POST /redeem

请求头必须包含 `Idempotency-Key`。

```json
{
  "idempotencyKey": "uuid",
  "items": [
    {
      "cdk": "CDK-AAAA-BBBB",
      "accessToken": "eyJ..."
    }
  ]
}
```

成功时返回 `202`：

```json
{
  "jobId": "job-id",
  "status": "queued",
  "acceptedAt": "2026-06-15T00:00:00.000Z"
}
```

### GET /redeem/records

必须验证登录会话，只返回当前用户数据：

```json
{
  "records": [
    {
      "id": "job-id",
      "status": "processing",
      "itemCount": 2,
      "createdAt": "2026-06-15T00:00:00.000Z",
      "updatedAt": "2026-06-15T00:01:00.000Z"
    }
  ]
}
```

后端必须再次执行身份认证和数据权限检查，不能只依赖前端路由守卫。
