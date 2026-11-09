自 `v0.2.0` 起的 10 个提交，全部是面板交互、键盘可用性、性能与工程化；**数据模型与缓存格式没有变化**，升级不需要清 `~/.dsh/doc-ledger-*`。

![overview](https://raw.githubusercontent.com/LuoShanHui/dsh-doc-ledger/v0.3.0/docs/overview.png)

## 新增

- **搜索支持多词 AND**：空格分隔的每个词都必须命中；各词独立高亮、重叠区间合并（`ord` + `order` 只标一层），无结果时提示同时列出所有词。
- **子代理血缘跳转**：会话 payload 新增 `parentSessionId`，子会话卡片菜单多「跳到父会话：<标题>」，父会话卡片列出已加载的子会话（最多 5 个）。
- **行列表 roving tabindex**：每张卡只有一行可 Tab 到，卡内 `↑`/`↓`/`Home`/`End` 逐行走；40 张卡展开时 Tab 停靠点从 400+ 降到 40。
- **窄窗口适配**：面板宽度 < 640 px 时快速查看弹窗的分裂按钮只保留程序图标（文字进 `title`/`aria-label`），文件名不再被挤成三四个字。
- **快速查看弹窗底部路径可点击复制**。
- **「全部展开」按 8 张一批分任务**：40 张卡从「2 个 85 ms 长任务（共 ~170 ms 阻塞）」变成「5 个短任务、总计 78 ms、无 >50 ms 任务」，首批 16 张在 10–30 ms 内出现；展开中按钮变「全部折叠」，点一下即中断。
- **live 会话重放下限（15 s）**：静默轮询在 15 秒内复用上一次折叠结果，`force=1`（刷新按钮）与 `timing=1` 仍然全量重放。
- **私密漏洞报告**：启用 Private vulnerability reporting，并加了自定义表单 `.github/VULNERABILITY_REPORT.yml`（强制填插件/DSH/Windows 版本、复现步骤 ≥100 字、影响面）。

## 工程化

- **新增 39 项回归**（`npm test`，零依赖）：引擎 7 + 解码 10 + **宿主路由/安全 14**（同源 403、台账白名单、`/api/open` POST-only、400/404/405、未知路由 404）+ **缓存决策 8**（精确 stamp / TTL 回退 / live 重放下限）。
- **UI harness 固化进仓库**：`npm run harness` 起一个假 cordis + 合成台账的本地页面，跑真实 `client.js`，不再需要登录 GUI。
- **CI**：Node 18 / 20 / 22 矩阵跑语法检查 + 全部回归；`actions/checkout`、`actions/setup-node` 升到 v7（dependabot 自动 PR）。
- 仓库工程件：`CHANGELOG.md`、`SECURITY.md`、issue 表单、`dependabot.yml`、`.editorconfig`、`.gitattributes`（LF 归一化）。
- 商店素材：`docs/awesome-plugin-entry.yml`、`docs/icon-512.png`（位图，列表拒收 SVG）、`docs/social-preview.png`（1280×640）、`screenshots.json`。

## 安装 / 升级

已有安装改成固定新版本即可（`~/.dsh/profiles/<profile>/package.json`）：

```json
"dsh-doc-ledger": "github:LuoShanHui/dsh-doc-ledger#v0.3.0"
```

```powershell
node <runtime>/dependencies/pnpm/bin/pnpm.mjs install `
  --config.store-dir=<pnpm-store> `
  --config.confirmModulesPurge=false
```

然后刷新页面（客户端 bundle 需要重新注入）。完整步骤见 README 的「安装（插件形态）」。

## 兼容性

- DSH `>=0.2.0-rc.1 <0.3.0-0`；Node `>=18`；仅在 **Windows** 上验证。
- 两个宿主能力仍是可选依赖，缺失时自动降级：`uiWorkspace.openSession`（无则隐藏「跳转」项）、`sidebarRight.openResource`（无则退回自带弹窗）。

## 已知限制

- 会话目录布局是隐式契约；`exists` 有 20 秒缓存；shell 间接产生的文件不算「创建」；混编编码是启发式；快速查看只给前 200 KB。详见 [README 的「已知限制」](https://github.com/LuoShanHui/dsh-doc-ledger#已知限制)。

## 测试

```bash
npm test    # 引擎 7 + 解码 10 + 路由/安全 14 + 缓存 8 = 39 项，无外部依赖
```

完整变更记录见 [CHANGELOG.md](https://github.com/LuoShanHui/dsh-doc-ledger/blob/main/CHANGELOG.md)。
