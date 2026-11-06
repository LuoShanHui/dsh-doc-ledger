# 提交到插件市场

## 主路径：`awesome-dsh-plugin`（社区列表，商店数据源）

`https://github.com/awesome-dsh-plugin/awesome-dsh-plugin` 是社区维护的收录列表，多个市场（含
`dsh-plugin-catalog`、`awesome-dsh-plugin.com`、`dsh-market` 详情页）都从它取数。
提交方式是**一个 YAML 文件一个 PR**，不改 README（README 由脚本生成）：

1. fork `awesome-dsh-plugin/awesome-dsh-plugin`；
2. 新增 `data/plugins/LuoShanHui__dsh-doc-ledger.yml`，内容直接用
   [`docs/awesome-plugin-entry.yml`](awesome-plugin-entry.yml)；
3. 提 PR（一个 PR 最多 3 条）。

它 CI 会依次查：

| 检查 | 本仓库状态 |
|---|---|
| `dsh.bundle` manifest（只声明 `dsh.client` 会被拒） | ✅ `dsh.bundle.patch: ./cordis.patch.yml` |
| 仓库创建满 **1 天** | ⏳ 仓库创建于 2026-11-06 16:20（北京），**11-07 16:20 之后**才能提 |
| `awesome-lint` + README 能重新生成 | ✅ 双语描述、分类合法 |
| `icon` 必须是 **GitHub 托管的位图**（SVG 拒收） | ✅ `docs/icon-512.png` |
| 仓库有 `dsh-plugin` topic | ✅ 已有 |
| 描述属实、不带营销词 | ✅ 只写了功能 |

合并后网站自动重建，不用再动别的。想换截图不用来提 PR：本仓库根目录的
`screenshots.json` 声明了展示用的 7 张图，市场下次构建自动读。

## 可选：发布到 npm

列表收录**不依赖** npm；不发也能装（`github:` spec 已实测 4.3 s 装好）。发 npm 的收益：
市场能显示下载量、安装跳过源码构建的授权步骤。

一次性动作：

1. `package.json`：删掉 `"private": true`（或改 `false`）；
2. `"files"` 里**加 `"docs"`** —— 否则 npm 包里没有截图，README 七张图全裂
   （现在 `npm pack --dry-run` 是 14 个文件，不含 `docs`）；
3. `npm login`（账号需开 2FA）→ `npm publish --access public`；
4. 校验：`npm view dsh-doc-ledger version` 应回 `0.2.0`。

包名 `dsh-doc-ledger` 目前**未被占用**（2026-11-06 查 registry 返回 404）。
`repository` 字段已经指向本仓库，发布后市场会自动把包和仓库关联。

## 不是投稿入口的两个地方

| 看起来像 | 实际 |
|---|---|
| `vlln/plugin-registry` | 是 **vlln 自己的插件清单**（`plugins/*.json` + 脚本生成 `index.json`），不是公共目录，给别人的插件提 PR 没有意义 |
| `dsh-plugin-catalog`（4704 条） | 从上面的 awesome 列表 / npm 生成，全量 `source.type: npm`；它本身不收 YAML |
