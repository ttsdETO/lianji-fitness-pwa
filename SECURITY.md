# Security Policy

## Supported version

安全修复只针对默认分支上的最新版本。

## Reporting a vulnerability

仓库上传 GitHub 后，请使用仓库的 **Security → Advisories → Report a vulnerability** 私下报告安全问题。不要在公开 Issue 中发布真实密钥、个人数据、可直接利用的攻击载荷或尚未修复的漏洞细节。

报告建议包含：

- 受影响文件与版本
- 最小复现步骤
- 预期与实际行为
- 可能影响的数据或用户
- 可行的缓解建议

## Security model

- 应用是静态前端 PWA，没有自有账号系统、业务后端或数据库。
- 敏感训练与健康数据默认保存在浏览器 `localStorage`。
- AI API Key 和对话仅保存在当前 `sessionStorage` 会话。
- AI 端点固定、禁止重定向、Cookie、缓存和 Referrer。
- Cloudflare Pages 风格的 `_headers` 文件提供 CSP、HSTS、MIME 嗅探防护、权限策略与嵌入限制。
- 导入仅接受不超过 5 MB 的 JSON 备份；导入和清空都需要用户确认。

浏览器存储无法抵御已经获得同源脚本执行能力的攻击。部署者应保持依赖更新、保留 CSP、安全响应头和 HTTPS，并在每次发布前运行测试、构建、依赖审计与密钥扫描。
