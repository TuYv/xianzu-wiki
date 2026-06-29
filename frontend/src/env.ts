/**
 * 站点模式标志(编译期常量,Vite 会据此 tree-shake 掉未走的分支)。
 * - true:生产构建 = 部署的只读静态站(读 data.json,无后端、无登录)。
 * - false:本地开发 = 连后端编辑器。
 * 放在中立模块,供数据层与 UI 共用,避免 UI 反向依赖 API 层。
 */
export const STATIC_DATA = import.meta.env.PROD;
