# MarkWeave 轻量服务器部署

这套配置用于把 MarkWeave 落地页和三个后台服务部署到一台 Ubuntu + Docker 服务器上，并和服务器上已有的系统共存。

## 服务与域名

| 服务 | 子域名 | 容器内端口 | 服务器本地端口 |
| --- | --- | --- | --- |
| 落地页 | markweave.cloud / www.markweave.cloud | 3000 | 13000 |
| 认证服务 | auth.markweave.cloud | 3230 | 13230 |
| 授权服务 | lic.markweave.cloud | 3210 | 13210 |
| 支付服务 | pay.markweave.cloud | 3220 | 13220 |

所有服务只绑定 `127.0.0.1` 的本地端口，不会占用 80/443，也不会和已有系统的端口冲突。

## 部署步骤

1. 把项目代码上传到服务器，并进入 `deploy` 目录：

   ```bash
   cd deploy
   cp .env.example .env
   ```

2. 编辑 `.env`，至少填写：

   - `JWT_SECRET`
   - `AUTH_ADMIN_KEY`
   - `LICENSE_ADMIN_KEY`
   - 支付宝、微信或 Creem 的支付配置（按需）

3. 构建并启动：

   ```bash
   docker compose --env-file .env up -d --build
   ```

4. 在域名解析里添加 A 记录，全部指向服务器公网 IP：

   - `markweave.cloud`
   - `www.markweave.cloud`
   - `auth.markweave.cloud`
   - `lic.markweave.cloud`
   - `pay.markweave.cloud`

5. 把 `nginx-markweave.cloud.conf` 放到 Nginx 配置目录并启用：

   ```bash
   sudo cp nginx-markweave.cloud.conf /etc/nginx/sites-available/markweave.cloud
   sudo ln -s /etc/nginx/sites-available/markweave.cloud /etc/nginx/sites-enabled/markweave.cloud
   sudo nginx -t
   sudo systemctl reload nginx
   ```

6. 开启 HTTPS：

   ```bash
   sudo certbot --nginx -d markweave.cloud -d www.markweave.cloud \
     -d auth.markweave.cloud -d lic.markweave.cloud -d pay.markweave.cloud
   ```

## 支付回调

支付宝和微信支付回调地址默认使用：

- `https://pay.markweave.cloud/v1/webhooks/alipay`
- `https://pay.markweave.cloud/v1/webhooks/wechat`

如果使用其他域名，需要同步修改 `.env` 中的 `ALIPAY_NOTIFY_URL` 和 `WECHAT_NOTIFY_URL`，并重新启动支付服务。

## OAuth 回调

如果启用 Google / GitHub 登录，OAuth 回调地址填写：

- `https://auth.markweave.cloud/v1/oauth/callback`

## 数据备份

认证、授权、支付的数据都保存在 Docker 卷中：

```bash
docker volume ls | grep markweave
```

备份时直接备份对应的卷目录即可。

## 与已有系统共存

- 本套服务只监听 `127.0.0.1:13000/13210/13220/13230`。
- Nginx 通过不同 `server_name` 分流到不同服务，不修改已有站点配置。
- 如果这些本地端口已经被占用，修改 `deploy/docker-compose.yml` 里的 `ports` 和 `deploy/nginx-markweave.cloud.conf` 里的 `proxy_pass`。
