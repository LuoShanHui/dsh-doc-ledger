# 安全说明

## 这个插件会做什么

`dsh-doc-ledger` 是 DSH 的本地插件：宿主半侧在**回环端口**上注册一组 `/doc-ledger/*` 路由
（读会话日志、读预览文件、启动本机程序、抽程序图标），客户端半侧在右侧 Sidebar 渲染一个面板。
它不联网、不上报、不写用户目录以外的文件（缓存文件只有 `~/.dsh/doc-ledger-*` 几个）。

## 威胁模型

回环端口不等于安全：浏览器里任何网页都能向 `http://127.0.0.1:<port>/doc-ledger/api/...` 发请求。
所以宿主侧只认三条（都写在 README 的「安全模型」里）：

1. **同源校验**：`Sec-Fetch-Site: cross-site/same-site`、外部 `Origin`/`Referer`、`Origin: null` → 403；
2. **台账白名单**：`/api/file`、`/api/open`、`/api/openwith` 只接受当前台账里出现过的路径；
   `/icon` 只接受已存在的 `.exe/.ico/.lnk`；
3. **启动程序必须 POST**：`/api/open` 拒绝 GET，`<img>`、链接、预取都拉不起程序；
   且 `app` 必须出现在该扩展名的注册表枚举结果里。

这三条由 `tools/route-check.mjs`（14 项断言）在 CI 里守着，改动不会静默失效。

## 报告漏洞

请**不要**开公开 Issue。用 GitHub 的私密通道：
<https://github.com/LuoShanHui/dsh-doc-ledger/security/advisories/new>
（若仓库设置里尚未启用 Security Advisories，请先在 Settings → Code security 打开。）

报告走的是仓库里的自定义表单 [`.github/VULNERABILITY_REPORT.yml`](../.github/VULNERABILITY_REPORT.yml)：
表单会要求填插件版本、DSH 版本、Windows 版本、复现步骤（≥100 字）和影响面，直接进私密公告。
预计 7 天内答复。
