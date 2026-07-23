# 架构

## 总体形态

这是一个前端本地优先的 React PWA：

1. 页面和组件收集训练、身体、恢复与设置输入。
2. `App.tsx` 持有规范化后的 `AppData`，通过回调向下分发更新。
3. 数据变化后由 `saveData()` 写入 `localStorage`。
4. `storage.ts` 在启动时加载、迁移并修复旧版本数据。
5. Service Worker 预缓存构建清单中的入口和异步分包，支持安装后离线使用。

## 状态与数据流

- `AppData` 是应用主状态，包括资料、训练计划、训练历史、恢复记录和偏好。
- UI 更新采用不可变对象写法，由 `setData` 触发重新渲染和持久化。
- 动作名称变化通过稳定 `exerciseId` 与 `nameSnapshot` 兼容历史记录。
- 周计划变更使用覆盖记录和快照撤销，避免直接破坏默认计划或已完成历史。
- AI 会话和 API Key 使用独立 `sessionStorage` Key；模型与隐私模式使用 `localStorage`，均不并入 `AppData`。

## AI 教练流程

1. `CoachPage` 默认构造不含姓名、身体数据、恢复记录和备注的最少上下文；详细上下文必须由用户主动开启。
2. `lib/coach.ts` 调用 DashScope OpenAI 兼容接口。
3. 返回内容被解析为普通建议或结构化计划提案。
4. 计划提案必须先展示差异并由用户确认，随后才更新当前/未来周计划。
5. 更新前保留快照，可在 UI 中撤销。

AI 不具备直接、无确认修改训练数据的路径。

## UI 组织模式

- 页面级路由由 `App.tsx` 的本地 tab 状态实现，不使用 URL 路由器。
- Today 作为首屏同步加载；Body、Recovery、History、Coach、Settings 使用 `React.lazy` 与 `Suspense`。
- 抽屉和对话框主要通过 portal 渲染到 `document.body`。
- 搜索、统计、恢复建议和历史处理放在领域函数中，组件负责交互与展示。

## PWA 缓存

- Vite 生成 `vite-manifest.json`。
- Service Worker 安装时读取 manifest，收集所有入口、CSS、静态资源和动态分包。
- 导航请求采用 network-first；静态同源资源采用 cache-first。
- 离线验收会刷新首页并打开异步加载的 AI 教练页，验证动态分包确实可用。

## 重要架构约束

- 无服务端账号、同步、数据库或权限系统；所有核心数据保存在当前浏览器。
- 整体状态每次变化都同步序列化到 `localStorage`，历史量增长后可能需要节流或分片存储。
- AI API Key 只在当前浏览器会话中存在，但仍不能视为服务端秘密。
- 页面和全局样式文件偏大，后续拆分应保持现有领域边界和移动端行为。

## 证据

- `src/App.tsx`
- `src/lib/storage.ts`
- `src/lib/coach.ts`
- `src/lib/plan.ts`
- `src/components/ExerciseLibrary.tsx`
- `src/main.tsx`
- `public/sw.js`
- `vite.config.ts`
