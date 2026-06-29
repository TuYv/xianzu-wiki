# 部署与恢复

## 首次部署

1. 后端
   ```bash
   cd /srv/xjxz/backend
   python -m venv .venv && .venv/bin/pip install -e .
   cp .env.example .env       # 填真实值，见文件内生成命令
   chmod 600 .env
   ```
2. 前端
   ```bash
   cd /srv/xjxz/frontend && npm ci && npm run build   # 产物在 dist/
   ```
3. 服务与反代
   ```bash
   sudo cp /srv/xjxz/deploy/xjxz.service /etc/systemd/system/xjxz.service
   sudo cp /srv/xjxz/deploy/nginx.conf /etc/nginx/sites-available/xjxz
   sudo ln -sf /etc/nginx/sites-available/xjxz /etc/nginx/sites-enabled/xjxz
   sudo systemctl daemon-reload && sudo systemctl enable --now xjxz
   sudo nginx -t && sudo systemctl reload nginx
   ```
4. 健康检查：`curl -s http://127.0.0.1:8000/api/health` 应返回 `{"status":"ok"}`。

## 备份

- 定时任务（每日 03:00）：
  ```cron
  0 3 * * * /srv/xjxz/scripts/backup.sh /srv/xjxz/backend/xjxz.db /srv/xjxz/backups >> /var/log/xjxz-backup.log 2>&1
  ```
- 保留最近 7 份；至少一份 `rsync` 异地（取消 `backup.sh` 末尾 rsync 注释并设置 `REMOTE`）。
- `xjxz.db` 是全项目唯一不在 git 的资产，备份是第一道防线。

## 恢复演练（停服务 → 替换 db → 清 WAL → 重启）

> WAL 模式下若只换 `xjxz.db` 而残留旧 `-wal`/`-shm`，会污染数据，必须一并删除。

```bash
# 1. 停服务（释放对 db 的写锁）
sudo systemctl stop xjxz

# 2. 备份当前现场（演练翻车也能回到操作前）
cp /srv/xjxz/backend/xjxz.db /srv/xjxz/backend/xjxz.db.prerestore 2>/dev/null || true

# 3. 用快照替换主库
cp /srv/xjxz/backups/xjxz-<YYYY-MM-DD-HHMMSS>.db /srv/xjxz/backend/xjxz.db

# 4. 清理旧 WAL/SHM 边车文件（关键）
rm -f /srv/xjxz/backend/xjxz.db-wal /srv/xjxz/backend/xjxz.db-shm

# 5. 完整性自检
sqlite3 /srv/xjxz/backend/xjxz.db "PRAGMA integrity_check;"   # 期望 ok

# 6. 重启并验证
sudo systemctl start xjxz
curl -s http://127.0.0.1:8000/api/health                     # {"status":"ok"}
```
确认数据正确后再删除 `xjxz.db.prerestore`。
