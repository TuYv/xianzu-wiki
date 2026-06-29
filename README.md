# 玄鉴仙族 · 人物百科 + 族谱

为网文《玄鉴仙族》(及泛家族流)打造的人物百科 + 族谱站。**单人维护、对外只读**:数据是仓库里的一个 JSON 文件,改数据 = 改文件并推送;访客在静态站上浏览人物词条与族谱树。

## 架构(重要 — 数据是仓库文件,不是数据库)

> **唯一数据源是 [`frontend/public/data.json`](frontend/public/data.json)**(提交进 git 的普通文件)。
> 部署的站点是**纯静态**的:直接读这个 JSON,**没有后端、没有数据库、没有登录**。
> 每次编辑就是改这个文件 → 提交 → 自动重新部署;git 历史天然就是版本与备份。

| 层 | 选型 |
|---|---|
| 数据 | 仓库里的 `frontend/public/data.json`(`{ characters, relationships }`) |
| 站点 | Vite · React · TypeScript 静态 SPA |
| 族谱可视化 | `@xyflow/react` v12 + `@dagrejs/dagre`(婚姻 union 节点 + dagre TB 布局) |
| 部署 | GitHub Pages(push 到 `main` 自动构建发布,见 `.github/workflows/deploy.yml`) |
| 本地编辑器(可选) | `backend/` 的 FastAPI + SQLite —— 仅本地用于"有表单地"编辑数据,见下 |

## 怎么编辑数据

两种方式,任选:

**A. 直接改 JSON(最简单)**
直接编辑 `frontend/public/data.json`(GitHub 网页或本地皆可),提交推送即更新上线。
形状:`characters[]`(`id/name/aliases/gender/generation/realm/affiliation/status/avatar_url/bio`)+ `relationships[]`(`id/from_id/to_id/type/parent_role/note`,`type` ∈ `parent|spouse|master|sibling`)。

**B. 用本地编辑器(有表单、更省心,推荐数据多时)**
`backend/` 是一个**仅供本地使用**的编辑器(FastAPI + SQLite + 增删改表单),帮你避免手写 JSON 出错:

```bash
# 1) 起本地编辑器后端(详见 docs/deploy.md)
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
JWT_SECRET=<≥32字节随机> ADMIN_PASSWORD_HASH=<bcrypt哈希> uvicorn app.main:app --port 8000
# 2) 起前端(dev 模式连后端,改动实时可见)
cd frontend && npm install && npm run dev
# 3) 登录 → 用表单增删改人物/关系 → 点"导出"得到 data.json
# 4) 用导出的内容覆盖 frontend/public/data.json → 提交推送 → 自动部署
```

> 部署的站点不含后端,因此线上没有登录/编辑入口;编辑只在本地进行。
> `notes`(作者私人备注)默认**不写入** `data.json`,避免公开仓库泄露。

## 本地预览静态站

```bash
cd frontend
npm install
npm run build      # 产物在 dist/,内含 data.json
npm run preview    # 以"线上同款"静态模式预览(读 data.json,不连后端)
```

## 核心特性

- 人物列表:客户端即时搜索 / 按势力·境界·状态筛选
- 人物百科页:属性、Markdown 生平(react-markdown 默认配置,自动转义防 XSS)、关系跳转
- 族谱树:夫妻合成"玉珏"连接节点的 DAG 布局,以当前人物为中心,可展开整族
- 视觉:玄鉴·墨韵仙家主题(玄黑底 + 玉青 + 鎏金,毛笔楷 + 思源宋)

## 设计与历史

设计文档与实现计划见 [`docs/superpowers/`](docs/superpowers/)。
注意:这些是 v1(后端 + SQLite 在线编辑)时期的设计存档;**数据层后来改为静态 `data.json` + 本地编辑器**(以本 README 为准)。
