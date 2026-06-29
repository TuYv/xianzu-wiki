# 玄鉴仙族 · 人物百科 + 族谱

为网文《玄鉴仙族》(及泛家族流)打造的人物百科 + 族谱站。**单人维护、对外只读**:作者登录后在线编辑,访客只读浏览人物词条与族谱树。

## 这是什么

中文网文圈缺少结构化的人物百科/族谱站。家族流人物多、代际复杂,读者容易被关系绕晕。本项目用一个轻量的自托管小工具填补这个空白。

## 技术栈

| 层 | 选型 |
|---|---|
| 后端 | Python · FastAPI · SQLModel · SQLite(WAL) |
| 前端 | Vite · React · TypeScript |
| 族谱可视化 | `@xyflow/react` v12 + `@dagrejs/dagre` |
| 鉴权 | 单管理员密码(bcrypt)+ JWT,访客只读 |
| 部署 | 自有服务器,`uvicorn --workers 1` + nginx |

## 核心特性(MVP)

- 人物 CRUD + 百科页(Markdown 生平,安全渲染)
- 族谱树:DAG + 婚姻 union 节点布局,以当前人物为中心,移动端降级
- 批量 import / export(JSON/CSV,数据冷启动 & 二级备份)
- 单管理员登录,公开接口只读且脱敏(不泄露作者私人备注)

## 设计文档

完整设计与评审决策见 [`docs/superpowers/specs/2026-06-29-xjxz-character-wiki-design.md`](docs/superpowers/specs/2026-06-29-xjxz-character-wiki-design.md)。

## 状态

🚧 设计完成,实现计划编写中。
