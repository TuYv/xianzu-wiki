# 玄鉴仙族 人物百科 + 族谱 · 设计文档 (v2)

> ⚠️ **架构已变更——本文档为 v1/v2 设计存档,不代表当前实现。**
> 数据层已从「方案 B:后端 + SQLite 在线编辑」改为 **静态 `frontend/public/data.json` + 可选本地编辑器**。
> 因此下文中「SQLite 作为数据源 / 自有服务器部署 / 在线鉴权编辑 / 备份脚本」等已不适用。
> 当前架构以根目录 [README](../../../README.md) 与 [docs/deploy.md](../../deploy.md) 为准;后端代码现仅作为可选的本地编辑器保留。

- 日期:2026-06-29
- 状态:已过对抗评审(5 视角 + 综合),待用户最终确认
- 目标:为网文《玄鉴仙族》(及泛家族流)做一个可在线编辑、对外只读的人物百科 + 族谱站。

> v2 变更:并入 5 视角对抗评审的结论。详见文末「§13 评审决策记录」。

## 1. 背景与动机

中文网文圈缺少结构化的人物百科/族谱站(受众规模、维护成本、版权、缺工具等多重原因)。
家族流人物多、代际复杂,读者容易被关系绕晕,但又没有现成好用的协作族谱工具。
本项目做一个**单人维护、对外只读**的小工具填补这个空白。

## 2. 核心决策(已与用户确认)

| 维度 | 决策 |
|---|---|
| 部署形态 | 方案 B:轻后端 + SQLite,在线随时编辑,访客只读。跑在用户自有服务器 |
| 后端 | Python FastAPI + SQLModel + SQLite(`uvicorn --workers 1`) |
| 前端 | Vite + React + TypeScript SPA;可视化用 `@xyflow/react` v12 + `@dagrejs/dagre` |
| 数据存储 | SQLite 单文件,WAL 模式 |
| 编辑权限 | 仅作者一人:`ADMIN_PASSWORD_HASH`(bcrypt)+ JWT;访客全部只读 |
| 核心形态 | 人物百科 + 族谱树(关系图谱后置) |
| 数据录入 | 在线表单(日常增改)+ **批量 import/export(冷启动,纳入 MVP)** |
| 剧透控制 | **明确不做**(全展示,不加章节字段);trade-off 见 §13 |

## 3. 架构总览

```
访客浏览器 ──只读──┐
                  ├─► nginx/caddy ─┬─ 静态 SPA(npm run build 产物,同域)
作者浏览器 ──编辑──┘                └─ /api 反代 ─► uvicorn --workers 1(FastAPI)─► xjxz.db (SQLite, WAL)
```

- 后端单进程、**单 worker**(SQLite 写并发限制 + WAL + busy_timeout 即可,避免 `database is locked`)。
- 前端构建为静态文件,nginx 直接托管;`/api/*` 反代到 FastAPI。**前后端同域**,默认不启用 CORS(仅本地开发放开 `http://localhost:5173`)。
- 备份:见 §9,`xjxz.db` 是全项目唯一不在 git 的资产。

## 4. 数据模型

### 4.1 `characters` 人物表

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | int PK | |
| `name` | str | 本名(必填,建唯一性以外的普通索引便于搜索) |
| `aliases` | JSON 列 `list[str]` | 别名/道号/绰号;`Field(default_factory=list, sa_column=Column(JSON))`,默认空数组 |
| `gender` | enum | `male` / `female` / `unknown`(**仅展示用,不参与族谱父母判定**) |
| `generation` | str? | 辈分/字辈或代数(自由文本,可空) |
| `realm` | str? | 境界(练气/筑基/金丹…,自由文本) |
| `affiliation` | str? | 所属势力/家族/宗门(MVP 用文本,后续规范化) |
| `status` | enum | `alive` / `dead` / `unknown` |
| `avatar_url` | str? | 头像图 URL(MVP 外链图床;渲染前校验协议为 http(s)) |
| `bio` | text? | 生平/事迹(Markdown) |
| `notes` | text? | **作者私人备注**(剧透/未公开设定/吐槽)——**仅编辑态可见,公开接口不返回** |
| `created_at` | datetime(UTC, tz-aware) | |
| `updated_at` | datetime(UTC, tz-aware) | 配 `onupdate` 或 PUT 路由显式刷新 |

> 不设章节字段(剧透控制明确不做,§13)。

### 4.2 `relationships` 关系表

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | int PK | |
| `from_id` | int FK→characters(ON DELETE CASCADE,建索引) | |
| `to_id` | int FK→characters(ON DELETE CASCADE,建索引) | |
| `type` | str enum | MVP:`parent` / `spouse` / `master` / `sibling`(`ally`/`enemy`/`same_as`/`other` 后置) |
| `parent_role` | enum? | 仅 `type=parent` 用:`father` / `mother` / `adoptive` / `unknown`。**族谱直接读这列,不靠人物性别反推** |
| `note` | str? | 备注 |

**约束与索引:**
- `UNIQUE(from_id, to_id, type)`,避免重复边。
- `from_id`、`to_id` 各建索引。
- 方向语义:`parent` = from(父/母)→ to(子/女);`master` = from(师)→ to(徒)。
- **对称类型规范化**:`spouse` / `sibling`(及后置的对称类型)写入时强制 `from_id < to_id`,保证唯一序;查询某人关系一律 `WHERE from_id=:id OR to_id=:id`(双向可见)。

### 4.3 视图派生(渲染层,不进数据库)

- **族谱树**:`parent` 边构成 DAG,`@dagrejs/dagre` `rankdir=TB`;层级 = 从根的最长路径深度。`spouse` 不参与分层,只做同层对齐。**母系不降级为配偶**。
- **union(婚姻)节点**:渲染时为一对/一组配偶生成一个不可见 union 节点——配偶连 union、子女从 union 引出,使 dagre 把父母排同层、孩子挂正下方;一夫多妻/多道侣据此收敛。**这是族谱可读性的关键,不做则父母会被拆到屏幕两端、连线交叉**。
- **默认视图以当前人物为中心**:BFS 截断,只渲染上下各 2-3 代,提供「展开更多代 / 查看整族」。布局结果 memoize,仅数据变化时重算。
- **sibling**:默认不入库,由「存在共同 parent」实时推导(可区分全 / 半);仅当两人无任何已知 parent 但确知是兄弟时才显式存。
- **收养**:复用 `parent_role=adoptive`,族谱用虚线/异色区分;血缘计算(直系后代等)过滤掉 adoptive。

### 4.4 建模约束与校验(写接口)

- `from_id != to_id`(不能自连)。
- `POST parent` 做**环检测**:从 `to_id` 沿 parent DFS 若能到达 `from_id` 则返回 400(近亲联姻/录入错误会成环,导致 dagre 与递归遍历死循环)。
- 对称类型自动归一为 `from_id < to_id` 再落库。
- 违反 `UNIQUE` 约束返回 409。

### 4.5 SQLite 引擎配置

`db.py` 用 SQLAlchemy `connect` 事件,对**每个连接**执行:
```sql
PRAGMA foreign_keys = ON;     -- 默认 OFF,不开级联删除静默失效
PRAGMA journal_mode = WAL;    -- 读写不互锁
PRAGMA busy_timeout = 5000;   -- 避免瞬时锁冲突直接报错
```
部署固定 `uvicorn --workers 1`。

## 5. 后端 API

| 方法 | 路径 | 鉴权 | 响应 schema | 说明 |
|---|---|---|---|---|
| GET | `/api/characters` | 公开 | `PublicCharacter[]` | 一次性全量(MVP 不分页),`limit` 默认 500 兜底 |
| GET | `/api/characters/{id}` | 公开 | `PublicCharacter` + 其关系 | **不含 notes** |
| GET | `/api/relationships` | 公开 | 白名单 | 供前端建图。`relationships.note` 是公开的关系标注;真正私密内容只放 `characters.notes`(不公开) |
| POST | `/api/characters` | 需登录 | `AdminCharacter` | 新建 |
| PUT | `/api/characters/{id}` | 需登录 | `AdminCharacter` | 更新(刷新 `updated_at`) |
| DELETE | `/api/characters/{id}` | 需登录 | — | 同事务级联删 `WHERE from_id=:id OR to_id=:id` 的关系 |
| POST | `/api/relationships` | 需登录 | | 加关系(走 §4.4 校验) |
| DELETE | `/api/relationships/{id}` | 需登录 | — | 删关系 |
| POST | `/api/import` | 需登录 | | 批量导入 JSON/CSV(characters 一批 + relationships 一批;关系用 name 引用,导入时解析为 id) |
| GET | `/api/export` | 需登录 | | 全量导出 JSON/CSV(对称于 import,兼作人类可读二级备份) |
| POST | `/api/login` | 公开(限流) | `{token}` | 校验密码 → 返回 JWT |

- **响应白名单**:公开读用独立 `PublicCharacter`(`name/aliases/gender/generation/realm/affiliation/status/avatar_url/bio`),**显式排除 `notes`**;不把 ORM 模型直接当 `response_model`。
- **搜索/筛选/排序**:MVP 全量拉到前端,**客户端内存做**(即时、无 loading)。后端 `search` 参数后置;若保留服务端 `LIKE`,需转义用户输入的 `%`/`_`。
- **校验**:Pydantic 入参校验;错误响应格式统一(`{detail}`),状态码语义化(401/404/409/400)。

## 6. 前端页面

- **人物列表**:客户端搜索 + 按势力/境界/状态筛选,卡片或表格。
- **人物详情(百科页)**:头像(渲染前校验 `http(s)` 协议,拒 `javascript:` 伪协议)、属性、Markdown 生平、关联人物快捷跳转。
  - **Markdown 用 `react-markdown` 默认配置,不安装 `rehype-raw`**——原始 HTML 自动转义即阻断存储型 XSS;**不引 DOMPurify**(过度设计)。
- **族谱树**:`@xyflow/react` v12 + dagre,union 节点算法(§4.3),默认以当前人物为中心,点节点跳百科页。移动端 `panOnScroll=false` + `fitView`,窄屏给「全屏查看族谱」入口或降级为可折叠纵向缩进列表。
- **(后置)关系图谱**:力导向视图,复用同一份关系数据。
- **编辑态**:登录后出现增删改按钮 + 人物表单 + 加关系面板 + 导入/导出入口;访客全部不可见。

## 7. 鉴权

- **密码**:`ADMIN_PASSWORD_HASH` 存 bcrypt 哈希值(文档给出生成命令),后端**永不接触明文**;要求原始密码 ≥16 位随机。
- **JWT**:`HS256`;签名密钥从独立环境变量 `JWT_SECRET` 读(与密码哈希分开,≥32 字节随机),**进程启动缺失即 fail-fast 退出,禁止代码内默认值**;`exp` = 7 天,过期重登录,**单管理员不做 refresh token**;`PyJWT` 解码显式传 `algorithms=['HS256']`。
- **token 存储**:前端存 `localStorage`,请求头 `Authorization: Bearer <token>`;一个 fetch 拦截器注入 token、`401` 清 token 跳登录。
  - 理由:读接口全公开、唯一富文本是作者自己的 Markdown 且已转义,httpOnly cookie 的 CSRF/SameSite 配置纯属负担;localStorage+Bearer 是最小闭环,且免掉 CORS+credentials 冲突。
- **登录限流**:`/api/login` 按源 IP 限流(如 5 次/分钟 + 连续失败指数退避),单机内存计数即可(`slowapi` 或自写),**不引 Redis**;失败统一返回 401 不区分原因。
- **CORS**:同域部署默认不启用 `CORSMiddleware`;仅本地开发受环境开关控制放开 localhost。

## 8. 项目结构

```
xjxz/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app + 路由挂载 + 静态托管(可选)
│   │   ├── db.py            # engine/session + PRAGMA connect 事件
│   │   ├── models.py        # SQLModel 模型
│   │   ├── schemas.py       # PublicCharacter / AdminCharacter 等响应 schema
│   │   ├── auth.py          # bcrypt 校验 + JWT 签发/校验 + 限流
│   │   └── routers/         # characters.py / relationships.py / auth.py / io.py(import/export)
│   ├── migrations/          # 一次性 ALTER TABLE 脚本(按日期命名),不用 alembic
│   ├── tests/
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── api/             # fetch 封装 + token 拦截器
│   │   ├── components/      # 族谱(union 布局)/ 人物卡 / 表单 / 关系面板
│   │   └── pages/           # 列表 / 详情 / 族谱 / 登录
│   ├── package.json
│   └── vite.config.ts
├── docs/superpowers/specs/
└── .gitignore               # xjxz.db / xjxz.db-wal / xjxz.db-shm / .env / node_modules / dist / backups
```

> **不用 alembic**:初始化用 `SQLModel.metadata.create_all`;后续 schema 变更走 `migrations/` 下一次性 `ALTER TABLE` 脚本(改表前先 `.backup`)。`create_all` 只建新表、不给已存在表加列,故加字段必须走脚本。

## 9. 部署与备份

- **后端**:`uvicorn --workers 1` + systemd 服务。
- **前端**:`npm run build` 出静态文件交 nginx;`/api` 反代到 uvicorn。
- **备份**(WAL 下 `cp` 会拷出撕裂文件,禁用):
  ```bash
  sqlite3 /path/xjxz.db ".backup /backups/xjxz-$(date +%F).db"   # 一致性快照
  ```
  - 保留最近 7 份轮转;至少一份 `rsync` 到异地;备份文件 `chmod 600` 且不落在 web 可访问路径。
  - **恢复步骤**:停服务 → 替换 `xjxz.db`(并清理 `-wal`/`-shm`)→ 重启。
- **密钥**:`.env` 存 `JWT_SECRET` / `ADMIN_PASSWORD_HASH`,权限收紧,绝不进 git。

## 10. 测试

- 后端 pytest:
  - CRUD 正常路径。
  - 鉴权:未登录访问写接口 → 401;过期/伪造 token → 401。
  - **级联删除**:删人物后断言无残留关系行(验证 FK pragma 生效)。
  - **对称关系双向可见**:A 录 spouse 后,查 B 能看到。
  - **环检测**:`POST parent` 构成环 → 400。
  - **公开接口脱敏**:匿名 GET 详情断言响应**不含 `notes` 键**。
  - **import/export 往返**:export 后 import 回去数据等价。
- 前端:核心交互冒烟(列表渲染、登录后出现编辑按钮、族谱节点跳转)。

## 11. MVP 范围

**纳入 MVP**:
- 人物 CRUD + 百科页(Markdown 安全渲染)。
- 族谱树(union 节点布局 + 以当前人物为中心 + 移动端降级)。
- 单管理员登录(JWT + 限流)。
- **批量 import / export**(冷启动)。
- SQLite 工程基线(FK/WAL/备份)+ 部署。

**后置(YAGNI)**:
- 关系图谱(力导向)及 `ally`/`enemy`/`other`/`same_as` 关系类型。
- 剧透控制(明确不做,§13)。
- 势力表规范化、服务端搜索/分页、多人协作、图片上传、版本/审计、SEO/预渲染。

## 12. 主要风险与回退

- 数据库是唯一不在 git 的资产 → §9 备份策略是第一道防线。
- 族谱 union 布局是技术难点 → 先用小数据集打通布局,再灌全量。
- import 解析 name→id 可能有重名 → 导入时重名报错并要求消歧(用 id 或唯一别名)。

## 13. 评审决策记录(5 视角对抗评审结论)

**已采纳并写入本文档:** SQLite FK/WAL/busy_timeout/workers=1、`.backup` 轮转异地、`parent_role` 显式化、唯一索引 + 对称归一、环检测、union 渲染节点、ego-centric 默认视图 + 移动端降级、`PublicCharacter` 白名单排除 `notes`、react-markdown 默认转义不开 rehype-raw、JWT/`JWT_SECRET`/bcrypt/fail-fast、登录限流、localStorage+Bearer、aliases JSON 列、`updated_at` onupdate、sibling 推导、adoptive 复用 parent_role、import/export 进 MVP。

**已砍 / 后置(YAGNI):** alembic(改 ALTER 脚本)、服务端分页(客户端搜索)、`ally`/`enemy`/`other`/`same_as`、DOMPurify、httpOnly cookie + CSRF、SEO/预渲染、版本/审计表。

**用户明确决策(覆盖评审建议):**
- **剧透控制 = 不做**。评审建议至少把章节字段(`first_appear_chapter` / `as_of_chapter`)纳入 MVP schema。用户选择完全不做。
  - ⚠️ **记录的 trade-off**:日后若想加剧透分级,需回头给已录入的数百人物逐个补章节字段,成本不低。这是用户知情下的取舍。
