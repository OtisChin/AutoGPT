# Docker 部署

本项目部署为两个容器：

- `frontend`: Next.js，默认暴露 `3001`
- `backend`: Express + SQLite，默认暴露 `4000`

## 1. 准备文件

服务器目录需要同时包含：

```text
AutoGPT/
AutoGPT-base/
```

`docker-compose.yml` 放在 `AutoGPT/` 中，并通过 `../AutoGPT-base` 构建后端。

## 2. 配置环境变量

在 `AutoGPT/` 中复制示例文件：

```bash
cp .env.docker.example .env
```

然后编辑 `.env`：

```bash
FRONTEND_ORIGIN=http://服务器IP:3001
NEXT_PUBLIC_BACKEND_API_BASE_URL=http://服务器IP:4000
ADMIN_TOKEN=换成很长的管理员令牌
ICE_UPI_ACCESS_TOKEN=你的 ice token
```

如果使用 HTTPS 域名，把 `FRONTEND_ORIGIN` 和
`NEXT_PUBLIC_BACKEND_API_BASE_URL` 改成真实域名，并把
`SECURE_COOKIES=true`。

## 3. 构建并启动

在 `AutoGPT/` 目录执行：

```bash
docker compose up -d --build
```

查看日志：

```bash
docker compose logs -f backend
docker compose logs -f frontend
```

## 4. 访问

- 前端：`http://服务器IP:3001`
- 后台：`http://服务器IP:4000/admin`
- 健康检查：`http://服务器IP:4000/healthz`

后台页面需要输入 `.env` 里的 `ADMIN_TOKEN`。

## 5. 数据持久化

SQLite 数据库挂载在 Docker volume：

```text
autogpt-backend-data:/app/data
```

重启或升级容器不会丢失用户、登录记录、兑换任务和任务状态。

## 6. 更新部署

拉取或上传新代码后：

```bash
docker compose up -d --build
```

不需要删除 volume。删除 volume 会清空数据库。
