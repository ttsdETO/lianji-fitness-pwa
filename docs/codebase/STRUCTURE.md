# 目录结构

## 顶层目录

| 路径 | 责任 |
| --- | --- |
| `src/` | React 应用源码 |
| `public/` | PWA 图标、manifest、Service Worker 和静态资源 |
| `tests/` | Vitest 领域逻辑测试 |
| `scripts/` | 浏览器 smoke、AI 教练 smoke、动作库导入脚本 |
| `docs/codebase/` | 本代码库知识文档 |
| `dist/` | Vite 生成的生产构建，不应手工修改 |
| `rollback_archive/` | 旧版本回滚材料，不参与当前应用构建 |

## `src/` 模块

- `main.tsx`：应用入口，挂载 React、加载全局 CSS、注册生产 Service Worker。
- `App.tsx`：顶层状态、持久化、主题、休息计时器、底部导航和页面切换。
- `pages/`：Today、Body、Recovery、History、Coach、Settings 六个页面。Today 首屏同步加载，其余页面按需分包。
- `components/`：跨页面 UI，包括动作库、睡眠表盘、训练统计、资料抽屉和计划编辑器。
- `lib/`：存储迁移、动作搜索、训练历史、恢复建议、AI 教练、周计划覆盖等领域逻辑。
- `data/`：默认训练计划、热身/拉伸数据和 93 项动作数据库。
- `types.ts`：共享数据模型和判别联合类型。

## 边界约定

- 页面组件可组合 `components/` 并调用 `lib/`；复杂计算优先留在 `lib/`，避免散落到 JSX。
- `data/` 提供静态事实，不应依赖 UI。
- `lib/` 以纯函数为主；浏览器存储和网络调用集中在 `storage.ts`、`coach.ts` 等明确边界。
- 共享类型统一从 `types.ts` 导入；仓库当前不使用 barrel 导出文件。

## 关键入口

- 浏览器入口：`src/main.tsx`
- UI 根组件：`src/App.tsx`
- 构建配置：`vite.config.ts`
- PWA 缓存：`public/sw.js`
- 单元测试：`tests/*.test.ts`
- 浏览器验收：`scripts/smoke-test.mjs`

## 生成内容

- `dist/`、`vite-manifest.json` 和哈希资源由 `pnpm build` 生成。
- `src/data/exercise-database.zh-CN.json` 是已审查的静态数据；更新时应使用可信来源、校验 schema，并在提交前复核全部文本与关联 ID。

## 证据

- `src/main.tsx`
- `src/App.tsx`
- `src/pages/`
- `src/components/`
- `src/lib/`
- `src/data/`
- `public/sw.js`
- `vite.config.ts`
