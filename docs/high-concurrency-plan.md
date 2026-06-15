# High-Concurrency Plan

兑换模块后端尚未接入。正式接入时不要把兑换逻辑直接写在同步 HTTP 请求里，避免高峰期拖垮 Web 层。

## 目标

- Web 请求只负责校验、幂等去重、写入任务队列并返回 `jobId`。
- 兑换执行由 worker 异步处理，可水平扩容。
- 记录查询和状态推送与提交入口解耦。
- 在上游接口慢、失败或限流时保护本系统。

## 推荐架构

1. `POST /redeem`
   - 校验 body、用户身份、CDK 数量、token 格式。
   - 读取 `Idempotency-Key`，同一用户同一 key 只创建一个任务。
   - 写入数据库任务表，状态为 `queued`。
   - 将任务 ID 投递到 Redis Stream、BullMQ、SQS 或 Kafka。
   - 返回 `202 Accepted` 和 `jobId`。

2. Worker
   - 消费统一兑换队列，按后端调度策略控制优先级与并发。
   - 每个 CDK 子任务单独记录状态，失败可重试。
   - 使用上游接口熔断、指数退避、超时和并发池。
   - token 只在处理时短暂解密使用，不写入日志。

3. `GET /redeem/:jobId`
   - 读取任务和子任务状态。
   - 设置短 TTL 缓存，避免频繁刷新打到主库。

4. `GET /redeem/:jobId/events`
   - 可选 SSE 推送状态变化。
   - SSE 服务可单独部署，避免占用普通 API 实例连接。

## 数据与幂等

- `redeem_jobs`
  - `id`
  - `user_id`
  - `idempotency_key`
  - `status`
  - `created_at`
  - `updated_at`

- `redeem_items`
  - `id`
  - `job_id`
  - `cdk_hash`
  - `status`
  - `attempt_count`
  - `last_error_code`
  - `created_at`
  - `updated_at`

约束建议：

- `(user_id, idempotency_key)` 唯一索引。
- `(job_id, cdk_hash)` 唯一索引。
- 原始 CDK 和 access token 不落明文日志。CDK 可存 hash，token 使用 KMS 加密后短 TTL 保存，处理完成后清理。

## 限流与削峰

- 边缘层按 IP、账号、设备指纹限流。
- 应用层按账号限制未完成任务数。
- 队列层按上游承载能力设置 worker 并发。
- 上游失败率升高时自动降级：暂停新任务进入 processing，只保持 queued。
- UI 端使用幂等键和禁用重复提交，避免浏览器连点放大流量。

## 可观测性

- 指标：提交 QPS、队列长度、worker 延迟、成功率、重试次数、上游耗时、429/5xx 比例。
- 日志：必须包含 `requestId`、`jobId`、错误码，不包含 token。
- 告警：队列积压、任务超时、上游失败率、数据库慢查询、Redis 延迟。

## 当前代码中的预留点

- `lib/contracts.ts`：请求/响应类型和上游 API 配置。
- `lib/redeem-client.ts`：前端提交边界，默认关闭真实请求。
- `lib/auth-client.ts`：登录、会话和退出接口边界。
- `lib/records-client.ts`：受登录保护的兑换记录接口边界。
