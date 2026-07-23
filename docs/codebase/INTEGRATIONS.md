# 外部集成

## DashScope / Qwen

- 位置：`src/lib/coach.ts`、`src/pages/CoachPage.tsx`、`src/pages/SettingsPage.tsx`。
- 协议：OpenAI 兼容的 `POST /chat/completions`，默认地址为 `https://dashscope.aliyuncs.com/compatible-mode/v1`。
- 端点：固定为 DashScope 官方域名，UI 不允许自定义 Base URL；请求禁止重定向、Cookie、缓存和 Referrer。
- 鉴权：用户提供的 API Key 作为 Bearer Token 从浏览器直接发送。
- 配置：模型与隐私模式保存在 `localStorage`；API Key 和对话只写入 `sessionStorage`，旧版持久化 Key 会在首次加载时迁出。
- 数据：姓名永不发送；默认只发送器械、当前计划和匿名统计汇总，详细身体、恢复、备注和近期训练上下文必须由用户主动开启。
- 失败行为：支持取消请求、60 秒超时、1 MB 响应上限和通用错误映射；不把供应商原始错误直接展示给用户。

## 哔哩哔哩动作视频

- 位置：`src/components/VideoTutorial.tsx`、动作数据库视频字段。
- 只接受可解析的 BV/AV 标识，嵌入地址固定到哔哩哔哩播放器域名。
- 页面不会执行视频字段中的任意 HTML。

## 浏览器存储

- 位置：`src/lib/storage.ts`、`src/lib/coach.ts`。
- `localStorage` 是主数据存储，包含训练历史、资料、恢复记录和非敏感 AI 设置；API Key 与 AI 对话单独存入 `sessionStorage`。
- 数据模式当前为 schema version 3，加载时执行迁移与归一化。
- 用户可导出和导入 JSON；导出前提示备份包含敏感数据，导入限制为不超过 5 MB 的 JSON 并通过结构验证和迁移。
- 无跨设备同步、服务端备份或多用户隔离。

## PWA / Service Worker

- 位置：`src/main.tsx`、`public/manifest.webmanifest`、`public/sw.js`、`vite.config.ts`。
- 仅生产环境注册 Service Worker。
- 构建 manifest 驱动预缓存，覆盖首页入口、CSS、静态资源和懒加载分包。
- 导航在线优先、资源缓存优先；版本通过 `CACHE_NAME` 明确升级。

## 托管和安全头

- 项目目标为静态站点托管；仓库没有服务端运行时。
- `public/_headers` 为 Cloudflare Pages 配置 CSP、HSTS、Referrer-Policy、Permissions-Policy 和 MIME 嗅探保护。
- CSP 的 `connect-src` 只允许同源与 DashScope，`frame-src` 只允许哔哩哔哩播放器；正式发布后仍需检查线上响应头。

## 不存在的集成

- 无支付、邮件、推送、地图、广告或分析 SDK。
- 无数据库、服务端 API、账号登录、OAuth、远程日志或错误监控。
- 无运行时环境变量或仓库内密钥。

## 证据

- `src/lib/coach.ts`
- `src/pages/SettingsPage.tsx`
- `src/components/VideoTutorial.tsx`
- `src/lib/storage.ts`
- `src/main.tsx`
- `public/sw.js`
- `public/manifest.webmanifest`
