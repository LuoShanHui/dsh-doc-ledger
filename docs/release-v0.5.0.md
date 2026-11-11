# v0.5.0 · 主题、真实文件图标、文件大小

[English](release-v0.5.0.en.md) · **中文**

v0.4.0 之后的十六个提交里，有四件用户能直接看到的事：四套可切换的主题、真实文件图标、
行内文件大小，以及一次「整个面板在深色主题下是坏的」的修复。另外顺手修活了一条
从未成功工作过的诊断通道。

## 深色模式之前是完全坏的

这一条排在功能前面，因为它不是观感问题，是失效问题。

面板一直引用三个**不存在**的宿主 token：

| 写的 | 实际存在 |
|---|---|
| `--dsw-alias-accent` | `--dsw-alias-brand-primary` |
| `--dsw-alias-border` | `--dsw-alias-border-l1` / `-l2` |
| `--dsw-alias-label-tertiary` | 不存在（只有 `-primary` / `-secondary`） |

拼错的 `var()` 不会报错，**静默走 fallback 字面量**，而那些字面量全是浅色值。所以深色主题下：
背景是白的、文字是深灰、按钮几乎看不见。

顺带修掉两处：`hoverOff` 把文字色写死成深灰（深色下鼠标移开文字就消失）；hover 用命令式改
`element.style`，切换主题后会残留旧颜色。

现在 14 个 token 全部按 Theme provider 的真实名字，语义色从 token 用 `color-mix(in oklab, …)`
派生。`theme-check` 加了两条断言守着：颜色只能引用真实存在的 token、样式表里禁止写死
hex/rgba。

## 四套主题

工具栏的「主题」下拉列表可选四套，当前生效的打勾，选择跨刷新记住：

| 主题 | 结构 |
|---|---|
| **紧凑** | VS Code 密度：22px 行、发丝分隔线、无装饰（默认） |
| **留白** | 删除所有分隔线，靠留白分组，字号加大、层级全靠字重 |
| **表格** | 等宽文件名 + 斑马纹 + 等宽数字右对齐 + 分区标题大写加字距 |
| **卡片** | 浮起面板 + 卡片头 3px 强调色竖条 + 阴影 + 大圆角 |

这些不是凭感觉调的。参考是读过的两份实现：

- **shadcn/ui `globals.css`**：一个 `--radius` 展开成五档；所有半透明值用 `oklab` 混合——
  这样 6% 的淡底在白底和近黑底上看起来一样浓。
- **VS Code `explorerviewlet.css`**：密集行固定 22px 且 `line-height` 等于行高、
  `flex-wrap: nowrap`、`min-width: 0` + 省略号。**这四点才是一张窄表能读的原因**，不是配色。

## 真实文件图标，三级降级

文件行前的 7×7 色块换成了真实图标，按 A → B → C 取：

- **A** —— DSH 自己的 `FileTypeIcon`。从平台 seed 表经
  `require("@deepseek-ai/dsh-client-ui-primitives")` 拿到；这个包是每个客户端 bundle
  都能按名字 require 的十个模块之一。**真机日志已验证 `tier-A: ok`**，所以图标和 DSH
  界面其余部分完全一致。
- **B** —— Windows 真实的关联图标，由宿主按扩展名用 shell32 的 `SHGetFileInfo` 提取，
  缓存在 `~/.dsh/doc-ledger-fileicons/`。插件进程拿不到 `app.getFileIcon`（它跑在
  Electron 的纯 Node 子进程里），这是等效替代。已在真机取到 IntelliJ 的 Java 图标、
  JSON 大括号、Markdown 的 M。
- **C** —— 自绘徽标（扩展名前几位 + 类型色），永远可用，且垫在 B 的图片下面，
  同时兼任加载占位与 404 兜底——所以切换档位不会让行高跳动。

## 行内文件大小

读写计数后面接 `· 4.2 KB`。

大小来自宿主的 `statOf()`：它原本就为 `exists` 做过一次 `statSync`，现在同一个 stat 顺带
返回 `size`，所以**没有新增任何 IO**。大小属于「磁盘当前状态」而非日志，因此和 `exists`
一样按 20 秒 TTL 缓存、不进 ledger 缓存——文件长大不会产生新事件，缓存住的大小一写入就是错的。
已删除的文件不给大小（没有真实值可报）。

## 顺手修活了一条从未工作的诊断通道

`report()` 以 `window.__DOC_LEDGER_DEBUG__ === true` 为前提，但**整个代码库没有任何地方
设置这个全局**。结果 17 处 `report()` 全部静默返回，宿主日志从 11-04 起就没再更新过，
把 `config.debug` 设成 true 也没用。

现在宿主新增 `GET /api/config` 暴露 `{ debug, maxSessions }`，客户端在 `applyInner` 最前面
读取。因为 config 是异步的，而最有价值的报告（`eval`、`apply: enter`、`tab-ok`）都在响应到达
之前发出，所以加了 pending 队列：拿到答案后 debug 开就补发、关就丢弃。

修完立刻生效，日志确认了 `apply: tab-ok`、`host-preview:yes`、`session-nav:yes`。

## 其它

- **行内信息减负**：每行只显示**一个**时间戳，由所在分区决定（使用过→最近使用、修改→更新时间、
  创建→创建时间）。原来无论哪个分区都印「创建 · 修改」两个几乎相同的时刻，还把行挤到两行。
  同时修掉了底部长期存在的横向滚动条。
- **测试**：101 → 128 项，新增 `theme-check`（9 项）、`row-time-check`（6 项），
  并把 `SessionCard` 里的分区决策抽成 8 个纯函数覆盖（`client-core-check` 43 → 53 项）。
- **宿主重构**：105 行的 `snapshot()` 拆成 `normalizeRecords` / `foldSessions` /
  `shapePayload` 三个职责加编排。

## 升级

```json
"dsh-doc-ledger": "github:LuoShanHui/dsh-doc-ledger#v0.5.0"
```

或 npm：`"dsh-doc-ledger": "0.5.0"`。

升级后刷新页面。主题选择存在 `localStorage`，如果你之前选过某套主题，它会保留。
