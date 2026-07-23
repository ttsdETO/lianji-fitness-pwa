# 风险与改进方向

## 当前优先级

| 优先级 | 主题 | 现状与影响 | 建议 |
| --- | --- | --- | --- |
| 已缓解 | 自定义 AI Base URL | 端点已固定为 DashScope 官方域名，UI 不再接受自定义地址 | 保留固定端点测试和 CSP `connect-src` 白名单 |
| 已缓解 | API Key 长期持久化 | Key 已从 `localStorage` 迁到 `sessionStorage`，关闭会话后通常需要重新输入 | 浏览器活动会话内仍可能被同源 XSS 读取；生产服务 Key 仍应使用后端代理 |
| 已缓解 | AI 发送过多健康上下文 | 姓名永不发送，默认只发送器械、计划和匿名汇总；详细模式要求主动开启 | 保留最少/详细模式单元测试和发送前说明 |
| 已缓解 | AI 对话长期持久化 | 对话已迁到 `sessionStorage`，旧版持久化记录会在加载配置时删除 | 不要把自由文本对话并入 `AppData` 或 JSON 备份 |
| 中 | 整体状态同步持久化 | `App.tsx` 每次数据变化都序列化完整 `AppData`；历史积累或输入频繁时可能阻塞主线程 | 在数据量达到阈值后做可丢失编辑的防抖，并在隐藏/退出时刷新；或按历史、设置、恢复记录分片 |
| 中 | 大型页面与全局 CSS | `TodayPage`、`SettingsPage`、`CoachPage` 和 `styles.css` 较大，修改容易产生跨功能回归 | 按训练会话、计划编辑、AI 配置/会话拆组件；CSS 按功能文件拆分但保留单一入口顺序 |
| 已缓解 | 缺少安全响应头 | 已加入 Cloudflare Pages `_headers`，限制 API 与 iframe 域名并设置浏览器安全策略 | 正式发布后检查线上响应头确实生效 |
| 已缓解 | 密钥文件忽略规则不足 | `.gitignore` 已覆盖 `.env*`、证书、私钥和常见凭据文件 | 在 CI 中补充 secret scanning 可进一步降低误提交风险 |
| 低 | 自动质量门禁仍可加强 | 已有 GitHub Actions test/build，但无 lint 与覆盖率阈值 | 增加 ESLint、格式检查和最低覆盖率 |

## 已缓解问题

- 非首屏页面已经按需分包，首屏主 JS gzip 约下降 18%。
- 动作库使用稳定 Set 复用、延迟搜索和长列表渲染跳过，降低 93 项列表的重复计算和绘制成本。
- Service Worker 改为读取 Vite manifest，动态分包也会离线缓存。
- 修复带 `Vary` 响应的缓存匹配问题；真实断网刷新和离线打开 AI 教练页已通过。
- 增加全局键盘焦点样式，并修复若干局部样式覆盖。
- AI 请求锁定 DashScope 官方端点，使用会话级 Key，并增加超时、响应大小、重定向、Cookie 与缓存限制。
- AI 姓名永不发送，最少数据模式默认开启，详细健康上下文需要主动选择；AI 对话改为会话级存储。
- 公开副本已移除个人资料、固定身体目标、精确器械重量与个体伤病经历。

## 脆弱区域

- `src/lib/storage.ts`：任何字段变更都要维护旧 schema 迁移、导入校验和历史名称兼容。
- `src/lib/plan.ts`：当前/未来周覆盖、完成历史和撤销快照相互关联，必须保留测试。
- `public/sw.js`：每次壳层资源策略变化都需 bump `CACHE_NAME` 并执行真实离线 smoke。
- `src/lib/coach.ts`：同时处理隐私上下文、网络错误和结构化提案；不能绕过用户确认更新计划。

## 安全审查边界

- 未发现 `dangerouslySetInnerHTML`、生产运行时 `eval`、动态命令执行或高置信度硬编码密钥。
- 生产依赖本地清单只有 React / React DOM；已知高风险包观察表无命中。
- 2026-07-23 已通过官方 npm registry 执行生产依赖审计，结果为 0 个已知漏洞；仍需在后续发布时重新审计。

## 后续产品决定

- `[ASK USER]` 是否允许浏览器手势缩放？当前 `index.html` 禁用了缩放，符合现有全屏体验，但不利于低视力用户。
- `[ASK USER]` 是否需要后端代理来保护服务端 API Key，或继续采用纯前端 BYOK？
- `[ASK USER]` 是否加入 ESLint、格式检查和覆盖率门禁？

## 证据

- `src/App.tsx`
- `src/pages/TodayPage.tsx`
- `src/pages/SettingsPage.tsx`
- `src/pages/CoachPage.tsx`
- `src/lib/storage.ts`
- `src/lib/coach.ts`
- `src/lib/plan.ts`
- `src/styles.css`
- `public/sw.js`
- `.gitignore`
- `index.html`
