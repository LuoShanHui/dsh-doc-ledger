# Changelog

本项目的版本记录，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。发布时同步 GitHub Releases。

## [Unreleased]

## [0.5.0] - 2026-11-11

### Added

- **文件图标三级降级 A > B > C**：文件行前的小色块换成真实图标。
  **A** 是 DSH 自己的 `FileTypeIcon`（`@deepseek-ai/dsh-client-ui-primitives` 导出，用 `require`
  探测，和 20-assets.js 加载 tab 插画同一套机会式写法）。实测 DSH 0.2.2-rc.1 里该包在构建期被内联、
  未注册为 client 模块，所以这一档通常落空——但探测零成本，将来宿主一旦暴露就自动生效。
  **B** 是 Windows 真实的关联图标：宿主新增 `GET /doc-ledger/fileicon?ext=<ext>`，用 shell32 的
  `SHGetFileInfo` 按扩展名提取，缓存在 `~/.dsh/doc-ledger-fileicons/`（一个 `.md` 提取一次）。
  插件进程拿不到 Electron 的 `app.getFileIcon`（`process.versions.electron` 为 undefined，也没有
  `electron` 模块），这是等效替代。实测已能取到 IntelliJ 的 Java 图标、JSON 大括号、Markdown 的 M。
  **C** 是自绘徽标（扩展名前几位 + 类型色），永远可用，同时兼任 B 的加载占位与 404 兜底。
  踩坑两处：`Add-Type -TypeDefinition` 必须显式 `-ReferencedAssemblies System.Drawing`，
  且 here-string 脚本必须用真实换行拼接——用 `"; "` 拼成一行会让 `@'...'@` 编译失败，而且不留痕迹。
- **四套可切换的视觉主题**：`compact`（原版，默认）/ `airy`（留白分层）/ `table`（表格化对齐）/
  `card`（浮起卡片 + 阴影）。工具栏新增「主题」按钮循环切换，选择写入 `localStorage`。
  `70-styles.js` 从一张常量表重构成 `buildStyles(theme)` 工厂，58 个 key / ~330 处引用不变，
  颜色全部改用宿主主题 token（`--dsw-alias-*`），深浅色都跟随。memo 组件通过 `useStyles()`
  订阅主题，切换时不再需要刷新。
- **行内信息减负 + 三档视觉层级**：每行只显示**一个**时间戳，由所在分区决定（使用过→最近使用、
  修改→更新时间、创建→创建时间），不再重复打印「创建 + 修改」两个几乎相同的时刻。文件名加粗
  为主色（锚点）、路径与读写计数降为 11px 弱灰（背景）、时间固定 72px 右对齐成一列（等宽数字）。
  修掉了面板底部长期存在的横向滚动条，行高从「有的 1 行有的 2 行」统一为 23px。
- **两套完整截图**：英文 README 用 `docs/en-*.png`（7 张，`?locale=en` 实拍），中文 README 用
  `docs/zh-*.png`（7 张）；`screenshots.json` 同时列出 14 张。
- `tools/readme-check.mjs` 再加两条（共 9 项）：两版引用的图片必须真实存在、
  英文版只用 `en-*`、中文版不用 `en-*` —— 改名忘了改引用会立刻被 CI 抓到。

### Added

- **行内显示文件大小**：读写计数后面接 `· 4.2 KB`。大小来自宿主的 `statOf()`——它原先就为
  `exists` 做过一次 `statSync`，现在同一个 stat 顺带返回 `size`，所以**没有新增任何 IO**。
  大小属于「磁盘当前状态」而不是日志，因此和 `exists` 一样按 20 秒 TTL 缓存、不进 ledger 缓存：
  文件长大不会产生新事件，缓存住的大小一写入就是错的。已删除的文件不给大小（没有真实值可报）。
  宽度上它并进 `io` 那格而不是新开一列：380px 面板的行宽预算已经很紧，"读2/写1 · 4.2 KB"
  是同一个事实。

### Changed

- **四套主题按真实设计系统重做**，不再是「同一张表换几个数值」。参考是读过的两个实现：
  shadcn/ui 的 `globals.css`（一个 `--radius` 展开成五档；所有半透明值用 `oklab` 混合，
  这样 6% 的淡底在白底和近黑底上看起来一样浓）和 VS Code 的 `explorerviewlet.css`
  （密集行固定 22px 且 `line-height` 等于行高、`flex-wrap: nowrap`、`min-width: 0` +
  省略号——这三点才是一张窄表能读的原因）。据此：
  - **紧凑**：VS Code 密度，22px 行、发丝分隔线、无装饰；
  - **留白**：去掉所有分隔线，靠留白分组，字号加大一档、靠字重承担层级；
  - **表格**：等宽文件名 + 斑马纹 + 数字右对齐的等宽数字，分区标题大写加字距；
  - **卡片**：浮起的面板，卡片头部有 3px 强调色竖条 + 阴影 + 大圆角 + 浅灰底。

### Fixed

- **客户端诊断通道整条是死的**：`report()` 以 `window.__DOC_LEDGER_DEBUG__ === true` 为前提，
  但整个代码库没有任何地方设置这个全局，因此 17 处 `report()` 调用全部静默返回，宿主日志
  从 11-04 起就没再更新，把 `config.debug` 设成 true 也没用。
  现在宿主新增 `GET /api/config` 暴露 `{ debug, maxSessions }`，客户端在 `applyInner` 最前面
  读取并设置标志。因为 config 是异步拿的，早期报告（`eval`、`apply: enter`、`tab-ok` 这些
  恰恰最有用）会先进入 pending 队列，拿到答案后要么补发（debug 开）要么丢弃（debug 关）。
  修完立刻可用，日志确认了 `apply: tab-ok`、`host-preview:yes`、`session-nav:yes`。
- **上一轮对 A 档的判断是错的**，这里更正：`@deepseek-ai/dsh-client-ui-primitives` 不是
  「构建期内联、插件取不到」，而是**平台 seed 表里的十个模块之一**。模块系统的 require 是
  `if (this.seed.has(spec)) return this.seed.get(spec)`，seed 表由 `function YZ()` 返回，
  里面明确列着 `"@deepseek-ai/dsh-client-ui-primitives": FU`，且 DSH 自己的打包代码直接读
  `_deepseek_ai_dsh_client_ui_primitives.FileTypeIcon`（具名导出、名字未压缩）。
  真机日志已验证 `tier-A: ok`，也就是说文件图标**现在走的就是 DSH 自己那一套**，
  视觉与其他界面完全一致；B 档（shell32 系统图标）只在 A 缺位时才会渲染。
- **FileGlyph 的条件 hook 顺序**：A 命中时提前 return，而 `useState` 原先在那之后，
  两次渲染之间 hook 数量会变（React 会拒绝）。现在所有 hook 都在分支之前无条件调用。

### Fixed

- **未支持语言的兜底**：宿主的 fallback 链终点是英文，所以日/韩/俄等没有字典的语言会显示
  **英文**。此前 `t()` 一律退回中文、复数规则仍按用户所选语言算，会出现「英文句子 +
  中文/日文复数形态」的不一致（如 `1 files`）。现在 `setFallback({ zh, en })` 同时接两份
  字典，`pluralLocale()` 把 zh 以外的语言都按 en 选复数；`readActiveLocale` 读不到宿主
  语言时也返回 en，不再谎报中文。
- 英文界面里三处中文全角标点：分区标题的 `（{count}）`、预览信息行与提示行的 `　·　` 分隔符。
  前两处改成字典项 `section.titleWithCount` / `ui.sep`（中文全角、英文半角）。

### Added

- `docs/release-v0.4.0.md` / `.en.md`：本版 Release 正文双语版；
  `tools/release-notes-check.mjs`（并入 `npm test`）断言每个 release note 都有英文孪生、
  两版 `##` / `###` 数量一致、配图 URL 钉在同一 tag、英文版无中文残留。
- **`npm test` 现共 101 项**：引擎 7 + 解码 10 + 路由/安全 14 + 缓存 8 + 客户端 43
  + i18n 179 个 key 的完整性 + 双语 README 一致性 10 + Release notes 一致性 9。
  `readme-check` 新增一条：两版 README 声明的总数必须一致，且分项相加必须等于该总数。

## [0.4.0] - 2026-11-10

### Added

- **已发布到 npm**：`dsh-doc-ledger@0.3.0`（<https://www.npmjs.com/package/dsh-doc-ledger>），
  装法与 GitHub tag 等价，少一次 clone；README 补了 npm 徽章与 `"dsh-doc-ledger": "0.3.0"` 写法。

### Changed

- 准备 npm 分发：去掉 `private`、`files` 增补 `CHANGELOG.md` / `SECURITY.md` / `docs/overview.png` / `docs/i18n.md`，
  加 `publishConfig.access = public`（代码与 0.3.0 一致，只影响打包内容）。
- **C-3 第一层：客户端源码分片**。`client.js` 拆成 `src/client/*.js` 14 个按职责命名的片段，
  `tools/build-client.mjs` 按固定顺序确定性拼接回产物（SHA256 与原文件一致，零新依赖、无打包器）。
  新增 `npm run build:client` / `npm run check:client`，CI 多一步「产物未漂移」门禁。
- **新增 32 项客户端纯函数回归**（`tools/client-core-check.mjs`，用 `node:vm` 求值真实源码片段）：
  分词 AND、排序、跨会话合并、格式化、高亮区间合并、`dsh-resource://` 地址。
  `npm test` 现共 **71 项断言**。
- 多语言现状与完整补齐路线写入 `docs/i18n-plan.md`；`tools/i18n-extract.mjs` 自动生成
  `docs/i18n-strings.md`（209 处中文串 / 165 条唯一，含首次出现位置）。
- **界面完整双语（zh / en）**：面板全部文案收敛进 `src/client/10-locale.js` 的字典
  （159 个 key，zh/en 一一对应），渲染处统一走 `t("key", params)`；组合句改成整句 +
  `{占位符}`，不依赖宿主是否支持插值。新增 `src/client/05-runtime.js`（`t` 兜底 +
  `setTranslator`）——`apply()` 之前回退中文、绝不显示裸 key。
- 求值期常量表（`CATEGORY_LABEL`、排序键数组）改存 **key** 而非中文，渲染时经 `t()` 解析，
  避免语言切换后中文被冻死。
- 新增 `tools/i18n-check.mjs`（在 `npm test` 与 CI 中）：zh/en 键集合一致、无空值/TODO、
  所有 `t()` 引用有 key、字典无死条目、占位符集合一致。
- `tools/harness/` 支持 `?locale=zh`（默认）/ `?locale=en`，用真实字典渲染，便于双语验收。
- **复数支持**：`t()` 接入 `Intl.PluralRules`，按数字参数选 `<key>_one` / `<key>_other`；
  英文得到 `1 file` / `2 files`，中文两种形态同值、行为不变。多计数句（"filtered N files / M
  sessions"）拆成两个可独立复数的片段，避免一个 count 只驱动一处形态。
- **README 全量双语**：`README.md`（英文，默认）与 `README.zh.md`（中文）互相链接；
  新增 `tools/readme-check.mjs` 断言两版小节数量一致、语言互链、英文版无中文残留、都引用当前版本号。
- **「踩过的坑」按统一骨架重写**（两版一致，4 个三级小节：宿主 API 契约 / 运行时与平台 /
  前端渲染 / 缓存测试其它），每条按**现象 → 根因 → 修法**组织；`readme-check` 增加两条：
  四小节在两版中的位置必须一致、两版所有内部锚点必须能解析。
- **英文界面截图** `docs/en-overview.png`（`?locale=en`），已加入 `screenshots.json`。
- 求值期常量表 `CATEGORY_LABEL`、排序键数组改存 key（见上），未知分类回退到本地化的「其他 / Other」。

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
