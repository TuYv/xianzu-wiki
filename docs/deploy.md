# 运行与部署

数据是仓库文件(`frontend/public/data.json`),站点是纯静态的。下面三件事互相独立。

## 1. 发布站点(GitHub Pages,自动)

`.github/workflows/deploy.yml` 已配置:**push 到 `main` 即自动**构建前端并发布到 GitHub Pages。

一次性开启:仓库 **Settings → Pages → Build and deployment → Source 选 "GitHub Actions"**。
之后每次推送(包括只改 `frontend/public/data.json`)都会自动重新部署。

- 站点地址:`https://<用户名>.github.io/xianzu-wiki/`
- 子路径由 workflow 里的 `VITE_BASE: /xianzu-wiki/` 决定;**改仓库名要同步改它**。
- 部署产物含 `data.json` 与 `404.html`(深链回退)。换托管到 Vercel / Netlify 也可:根目录 `frontend`、构建 `npm run build`、产物 `dist`、开启 SPA 回退、`VITE_BASE` 留空。

## 2. 编辑数据

见 [README](../README.md#怎么编辑数据)。最简单是直接改 `frontend/public/data.json` 提交;数据多时用本地编辑器(下一节)。

### 本地编辑器(可选后端)

`backend/` 是仅本地使用的编辑器,帮你有表单地改数据、避免手写 JSON 出错。

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"

# 生成密钥(仅本地编辑用)
export JWT_SECRET="$(openssl rand -hex 32)"
export ADMIN_PASSWORD_HASH="$(python -c "from passlib.hash import bcrypt; print(bcrypt.hash('你设的密码'))")"

uvicorn app.main:app --port 8000        # 本地编辑器后端
```

另起前端 `cd frontend && npm run dev`(dev 模式连后端,改动实时可见),登录后用表单增删改 → 点"导出" → 把得到的 JSON 覆盖 `frontend/public/data.json` → 提交推送。

> 本地编辑器的 SQLite 库(`backend/xjxz.db`)只是编辑过程的临时存储,**不是数据源**,不进 git;真正的数据源始终是 `frontend/public/data.json`。

## 3. (可选,进阶)自托管一个常驻后端

只有当你想要"线上随时在线编辑"(而非本地编辑后提交)时才需要。`deploy/` 下有 `xjxz.service`(systemd)与 `nginx.conf`,`scripts/backup.sh` 做 SQLite 一致性备份。这条路要自己管服务器、鉴权与备份;对单人维护的只读站点通常**不必要**,默认走上面的静态方案即可。
