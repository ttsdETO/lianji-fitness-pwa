# 测试

## 单元测试

- 框架：Vitest `3.2.7`，Node 环境。
- 命令：`pnpm test`。
- 当前共 7 个测试文件、35 个测试。
- 覆盖领域：
  - 存储迁移和导入修复；
  - 动作搜索、筛选和旧名称迁移；
  - 训练历史、统计和补练逻辑；
  - 恢复建议；
  - 周计划覆盖、确认和撤销。

## 构建检查

- `pnpm build` 先运行 `tsc -b`，随后运行 Vite 生产构建。
- 构建同时生成 `dist/vite-manifest.json`，供 Service Worker 收集所有异步分包。
- 单独类型检查可运行 `node node_modules/typescript/bin/tsc -b --pretty false`。

## 浏览器 smoke

- 命令：`pnpm smoke -- http://127.0.0.1:<port>`。
- 默认使用本机 Edge/Chrome，视口为 390×844。
- 检查首屏、导航、弹窗、动作搜索、训练流程、计时器、恢复/设置页、Service Worker 和离线刷新。
- 离线阶段还会打开懒加载的 AI 教练页，验证动态分包已被预缓存。

## AI 教练 smoke

- 命令：`pnpm smoke:coach -- http://127.0.0.1:<port>`。
- 通过浏览器拦截模拟聊天接口，验证设置、上下文发送、提案确认和撤销，不消耗真实 API Key。

## 本轮验证基线

- `pnpm test`：35/35 通过。
- `pnpm build`：通过。
- `pnpm smoke`：移动端交互、Service Worker、断网刷新和离线 AI 教练分包通过。
- 首屏主 JS gzip 从约 131.70 kB 降至 108.06 kB；其余页面按需加载。

## 缺口

- `[TODO]` 未配置覆盖率收集和最低阈值。
- `[TODO]` 未发现 GitHub Actions 或其他 CI 配置，测试依赖本地执行。
- `[TODO]` 没有针对真实 DashScope 网络、限流和长响应的集成测试。
- `[TODO]` smoke 以主力移动端尺寸为中心，平板、桌面和多浏览器矩阵尚未自动化。

## 证据

- `package.json`
- `vite.config.ts`
- `tests/*.test.ts`
- `scripts/smoke-test.mjs`
- `scripts/coach-smoke.mjs`
