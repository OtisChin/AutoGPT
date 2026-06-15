# AutoGPT REDEEM

前后端分离的 CDK 兑换与账号查询前端，采用黑、白、绿配色。

## 功能范围

- `/redeem` 三阶段兑换流程：CDK 校验、access token 提交、队列处理。
- 单次最多 20 个 CDK，支持换行、空格、逗号、分号分隔并自动去重。
- `/login` 登录、`/register` 注册界面和会话状态，等待独立后端实现认证接口。
- `/records` 登录保护的兑换记录页。
- `/eligibility` 调用 `/api/v1/check` 检测账号资格。
- `/subscription` 调用 `/api/v1/subscription` 查询订阅。
- 前端不包含兑换和登录后端实现，接口契约见 [docs/backend-contract.md](docs/backend-contract.md)。

## 本地运行

```bash
npm install
npm run dev
```

打开 `http://localhost:3000/redeem`。

## 预览

- [桌面端](docs/redeem-desktop.png)
- [移动端](docs/redeem-mobile.png)
- [资格检测](docs/eligibility-desktop.png)
- [登录页](docs/login-desktop.png)
- [注册页](docs/register-desktop.png)

## 环境变量

复制 `.env.example` 并按环境调整：

```bash
NEXT_PUBLIC_UPSTREAM_API_BASE_URL=https://cha.nerver.cc
NEXT_PUBLIC_BACKEND_API_BASE_URL=https://api.example.com
NEXT_PUBLIC_REDEEM_API_ENABLED=false
```

`NEXT_PUBLIC_BACKEND_API_BASE_URL` 是独立业务后端地址。未配置时，登录、注册、兑换和兑换记录会明确显示后端待接入。

`NEXT_PUBLIC_REDEEM_API_ENABLED=false` 时，前端不会发起真实兑换请求。

## 高并发接入

后端落地前先阅读 [docs/high-concurrency-plan.md](docs/high-concurrency-plan.md)。核心原则是入口轻量化、任务队列化、幂等提交、状态异步查询和分层限流。
