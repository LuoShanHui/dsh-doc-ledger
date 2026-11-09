# Changelog

本项目的版本记录，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。发布时同步 GitHub Releases。

## [Unreleased]

_（暂无）_

## [0.3.0] - 2026-11-09

### Added

- `tools/route-check.mjs`：宿主路由与安全回归（14 项，真 HTTP server 打到真实 handler），
  并入 `npm test` 与 CI。
- `tools/harness/`：可提交的 UI 验证工具（真 `client.js` + 假 cordis ctx + 合成台账），
  `npm run harness` 起本地页，fixture 覆盖多词搜索 / 已删除 / 子代理会话 / roving tabindex。
- `tools/cache-check.mjs`：缓存决策回归（8 项：精确 stamp / TTL 回退 / 闭包限制），
  `ledgerReusable()` 从 `replay()` 里提出来导出，便于脱离宿主测试。
- 「全部折叠」时清空已挂载卡片集合，下次展开只挂视口附近，减少一次性重建的行数。
- **live 会话重放下限**（`LIVE_REPLAY_FLOOR_MS = 15 s`）：静默轮询在 15 秒内直接复用上一次折叠结果，
  `force=1`（刷新按钮）与 `timing=1` 仍然全量重放。
- **搜索支持多词 AND**：空格分隔的每个词都必须命中，各词独立高亮、重叠区间合并；无结果文案同时列出所有词。
- **子代理血缘跳转**：会话 payload 新增 `parentSessionId`，卡片菜单多出「跳到父会话 / 跳到子会话：<标题>」。
- **行列表用 roving tabindex**：每张卡只有一行可 Tab 到，卡内 ↑/↓/Home/End 移动（40 卡展开从 400+ 停靠点降到 40）。
- 快速查看弹窗底部路径可点击复制。
- `.github/ISSUE_TEMPLATE/bug.yml`：问题模板要求填 DSH 版本、平台与 `timings`。
- `SECURITY.md`、`.editorconfig`、`.github/dependabot.yml`（自动升级 Actions 版本）。
- `docs/plugin-registry-entry.json` + `docs/market-submission.md`：插件市场索引的提交素材与步骤。

### Changed

- README 顶部加徽章、英文摘要、首屏截图与「30 秒上手」；安装步骤改为 `github:` 托管依赖。
- `package.json` 补 `author` / `repository` / `homepage` / `bugs`；`check` 覆盖全部 9 个源文件。
- `LICENSE` 版权人改为 LuoShanHui。
- 新增 `.gitattributes`：`* text=auto eol=lf`，二进制不入行尾转换。

### Fixed

- 窄窗口（<640 px）下快速查看弹窗的分裂按钮只保留程序图标，文件名不再被挤成三四个字。
- roving tabindex 只统计真正渲染出来的行：此前第一段折叠时整张卡没有可 Tab 的行，方向键也会跳错行。

### Dependencies

- `actions/checkout` 4 → 7、`actions/setup-node` 4 → 7（dependabot）。

## [0.2.0] - 2026-11-06

首个公开版本。

### Added

- **引擎**：从 DSH 会话事件折叠每个会话的文档台账，三条写入通道（`write`/`edit` 工具、PTC 程序内
  `fs.writeFileSync`、绝对路径字面量），失败调用回滚，工作目录随 `working_directory` 切换。
- **面板**：右侧 Sidebar tab；当前会话 / 全部会话两种视图；类型 chip + 「已删除」筛选；
  `✕ 清除筛选`；搜索（防抖 150 ms、命中高亮）；每分区独立排序；拆分「创建 / 修改」；
  每行建/改时间；懒挂载 +「全部展开」分片提交；导出 Markdown / CSV / 路径 / 摘要；
  8 秒静默轮询（`rev` 不变时零重渲染）；偏好写 `localStorage`。
- **预览**：默认交给宿主文档预览（`sidebarRight.openResource`，8 种渲染器）；
  `Shift+回车` 走自带弹窗（BOM / UTF-8 / 按行 GB18030 解码、200 KB 上限、截断与解码提示、ETag 304）。
- **打开与定位**：注册表枚举该扩展名全部关联程序 + 真实图标（PowerShell 批量抽取、磁盘缓存、
  LRU）；`explorer.exe /select` 定位并把窗口提到前台；系统「打开方式」对话框。
- **会话导航**：右键会话卡片复制名称 / ID，或跳转到该会话（`uiWorkspace.openSession`，
  可选依赖，缺失时自动隐藏该项）。
- **静态报告**：`node tools/report.mjs` 生成自包含 `report.html`。
- **安全**：同源校验（`Sec-Fetch-Site` / `Origin` / `Referer`）、台账路径白名单、启动程序 POST-only。
- **测试**：`npm test` —— 引擎 7 项 + 解码 10 项。

### Notes

- 仅在 Windows、DSH `>=0.2.0-rc.1 <0.3.0-0` 上验证；依赖宿主内部 API，宿主改接口时需要跟进。
