# 提交到插件市场索引

DSH 的 `plugin_market` 会读若干公开索引。它们的 schema 不完全一样，分两类：

| 索引 | 条目数 | version.source | 本插件能否直接进 |
|---|---|---|---|
| `vlln/plugin-registry`（raw.githubusercontent.com/vlln/plugin-registry） | 少（`plugins[]`） | `{ "type": "git", "url", "commit" }` | ✅ 不用发 npm |
| `dsh-plugin-catalog`（cdn.jsdelivr.net/npm/dsh-plugin-catalog） | 4700+ | `{ "type": "npm" }` | ❌ 先 `npm publish` |
| `dsh.store` / `Open Plugin Market` / `Bruce's Plugin Picks` | — | 未核实，多半也要求 npm | 视索引而定 |

## 方案 A：`vlln/plugin-registry`（推荐先做，不需要 npm）

1. fork `https://github.com/vlln/plugin-registry`；
2. 把 `docs/icon.svg` 拷成 `icons/dsh-doc-ledger.svg`；
3. 在 `index.json` 的 `plugins[]` 末尾追加 `docs/plugin-registry-entry.json` 的内容
   （已经按它的字段写好了：`name/title/description/icon/author/homepage/repository/metadata/versions`）；
4. `versions[0].source.commit` 是 `ff122d8418e79d3b695c3f5628872be485f247fd`（= `v0.2.0` 那个提交），
   发新版本时改成新 tag 的提交；
5. 提 PR。合并后，在 DSH 的插件市场里就能搜到，安装走 `github:LuoShanHui/dsh-doc-ledger#v0.2.0`。

## 方案 B：npm 系索引（`dsh-plugin-catalog` 4700+ 条）

前置动作（一次性）：

1. `package.json`：`"private": true` → **删掉或改成 `false`**；
2. `"files"` 里**加上 `"docs"`** —— 否则 npm 包不含截图，README 里七张图会全裂
   （现在 `npm pack --dry-run` 只打包 14 个文件，不含 `docs`）；
3. `npm login`（账号需开 2FA）→ `npm publish --access public`；
4. 按该索引的模板提 PR/issue 加入口，`versions[].source.type` 用 `"npm"`。

要不要发 npm 是产品决定：发了能被 4700+ 条目录搜到，但从此要维护 npm 版本号与 tag 一致。

## 已备好的素材

| 文件 | 用途 |
|---|---|
| `docs/plugin-registry-entry.json` | 可直接粘贴的索引条目（git source，指向 v0.2.0） |
| `docs/icon.svg` | 索引要求的图标（64×64，浅/深色都可读） |
| `SECURITY.md` | 报告漏洞的私密通道说明，市场审核也看这个 |
