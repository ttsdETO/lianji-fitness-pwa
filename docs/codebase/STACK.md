# 技术栈

## 运行平台

- 浏览器端单页 PWA；应用运行时不依赖后端或数据库。
- Node.js 用于开发、构建和测试。`README.md` 要求 Node.js `20.19+` 或 `22.13+`，仓库目前没有 `.nvmrc`、`.node-version` 或 Volta 固定版本配置。
- 包管理器为 pnpm；`pnpm-lock.yaml` 的 lockfile 版本为 9，`pnpm-workspace.yaml` 定义工作区。

## 语言与框架

- TypeScript `5.8.3`，`tsconfig.app.json` 采用严格模式并以 ES2022 为目标。
- React / React DOM：`package.json` 声明 `^19.1.0`，当前锁文件解析为 `19.2.7`。
- Vite：声明 `^6.3.5`，当前锁文件解析为 `6.4.3`。
- CSS：单一全局样式入口 `src/styles.css`，无 CSS-in-JS 或组件库。

## 主要工具

- `@vitejs/plugin-react` `4.6.0`：JSX 与 React Fast Refresh。
- Vitest `3.2.7`：领域逻辑单元测试。
- `playwright-core` `1.61.1`：真实浏览器移动端 smoke 测试。
- 动作数据库以已审查的静态 JSON 随源码发布；公开仓库不包含会执行任意外部生成脚本的导入工具。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` | 启动 Vite 开发服务器 |
| `pnpm build` | TypeScript 项目构建后生成生产包 |
| `pnpm preview` | 本地预览生产包 |
| `pnpm test` | 运行 Vitest 单元测试 |
| `pnpm smoke -- <url>` | 对生产预览执行 390×844 UI、PWA、离线 smoke |
| `pnpm smoke:coach -- <url>` | 对 AI 教练流程执行 smoke |

## 配置和环境

- 应用运行时不读取 `import.meta.env`。
- AI 服务地址固定在源码中；模型和隐私模式保存在 `localStorage`，API Key 与对话仅保存在 `sessionStorage`。
- smoke 脚本支持可选环境变量，例如 `SMOKE_BROWSER_PATH`、`SMOKE_HOST`、`SMOKE_PORT`。
- `[TODO]` 增加统一的 `lint` / `format` 命令和对应配置；当前质量门禁主要依赖 TypeScript、Vitest 与 smoke。

## 证据

- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `tsconfig.app.json`
- `vite.config.ts`
- `scripts/smoke-test.mjs`
- `scripts/coach-smoke.mjs`
