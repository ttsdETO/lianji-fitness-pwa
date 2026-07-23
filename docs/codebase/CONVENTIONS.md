# 代码约定

## 命名

- React 组件、页面和类型使用 PascalCase，例如 `ExerciseLibrary`、`TodayPage`、`AppData`。
- 函数、变量和模块文件使用 camelCase，例如 `searchExercises`、`weeklyPlanOverrides.ts`。
- 常量使用大写下划线，例如 `STORAGE_KEY`、`CACHE_NAME`。
- CSS 使用语义化 kebab-case 类名，并以页面/功能前缀降低冲突。

## TypeScript 与 React

- `strict`、`noUnusedLocals`、`noUnusedParameters` 已启用。
- 共享领域类型放在 `src/types.ts`，组件局部 props 类型靠近组件定义。
- 状态更新保持不可变；派生数组和集合使用 `useMemo`，高频文本搜索使用 `useDeferredValue`。
- 页面级代码分割只放在非首屏页面，避免 Today 首次交互等待分包。
- 对话框、抽屉和按钮必须具有可访问名称；键盘焦点使用全局 `:focus-visible` 样式。

## 导入与模块

- 使用相对路径直接导入具体模块。
- `import type` 用于纯类型依赖。
- 当前无路径别名和 barrel 文件；新增别名会扩大配置面，除非目录深度明显成为问题。

## 错误处理

- 可预期的用户错误通过返回值或中文 UI 消息展示。
- AI 请求使用 `try/catch`、`AbortController` 和状态映射，避免把原始异常直接展示给用户。
- Service Worker 注册失败仅写 `console.warn`；应用核心功能仍可在线运行。
- 当前没有集中日志或监控服务。

## CSS 与交互

- 全局样式位于 `src/styles.css`，移动端 390×844 是主要验收视口。
- 动画需遵守 `prefers-reduced-motion`；触控目标、底部安全区和 iOS PWA 布局需要保留。
- 长列表卡片可使用 `content-visibility`，但必须设置合理 `contain-intrinsic-size` 防止滚动跳动。

## 测试约定

- 单元测试文件位于 `tests/`，使用 `*.test.ts`。
- 测试重点覆盖存储迁移、动作搜索、历史/恢复计算和周计划覆盖。
- 生产 UI 变更需同时通过 `pnpm build` 与 `pnpm smoke -- <url>`。

## 待补规则

- `[TODO]` 仓库没有 ESLint、Prettier 或 Stylelint 配置；新增前需选定不会与现有格式大面积冲突的最小规则集。
- `[TODO]` 没有提交信息或分支命名的仓库内规范。
- `[TODO]` 没有自动覆盖率阈值。

## 证据

- `tsconfig.app.json`
- `src/App.tsx`
- `src/types.ts`
- `src/components/ExerciseLibrary.tsx`
- `src/styles.css`
- `tests/`
- `scripts/smoke-test.mjs`
