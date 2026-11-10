# 多语言 UI 实施方案

> 分析结论：这个插件**可以做完整多语言**，但成本不在翻译，而在「把 165 条散落的字符串
> 全部收敛到字典」。本文给出可执行的路线、架构改动、校验方式和成本估算。

## 1. 现状

| 项 | 值 |
|---|---|
| `ctx.locale.register(NS, { zh, en })` | 已注册，`applyInner` 里有 `var t = ctx.locale.bind(NS)` |
| 字典条数 | **3 条**（`tab.title` / `guide.title` / `guide.description`） |
| UI 中文串 | **209 处字面量 / 165 条唯一**（由 `node tools/i18n-extract.mjs` 统计，清单见 `docs/i18n-strings.md`） |
| 用法范围 | 按钮、菜单项、空态、提示行、toast、`aria-label`、`title`、组合句（`" · 使用 "`、`"（共 "`…） |
| 实际效果 | 切到英文环境，只有 tab 标题和引导卡变英文，面板内部**仍是中文** → 承诺与现实不符 |

`docs/i18n.md` 里已经记了「先对齐承诺」的 B 方案（删掉 `en`、README 写明仅中文）。
本轮 C-3 拆分后，A 方案的前置条件（文案集中、可测）已经具备，下面是完整做法。

## 2. 关键架构约束（必须先理解）

宿主把客户端插件加载成**一个工厂函数**：

```js
window.__ModuleLoader__.load({ id, factory: function (require) { /* 全部代码在这里 */ } });
```

- `require` 由宿主注入，**只保证 `react`**；相对路径 `require`/ESM `import` 不可靠；
- 因此 `client.js` 是**单一闭包**，所有函数共享 `S`、`t`、常量；
- `ctx.locale.bind(NS)` 得到的 `t` **在 `apply()` 里才存在**，而渲染组件（`FrameInner`、
  `Section`、`Menu`…）定义在工厂顶层、在 apply 之后才被调用。

**推论**：不能把 `t` 作为模块级 import 注入；必须在运行时把它传给组件。三种做法：

| 做法 | 说明 | 取舍 |
|---|---|---|
| A. 模块级 `var t` + `setTranslator()` | `apply` 里 `t = ctx.locale.bind(NS)`；顶层 `t` 初始为一个「返回 key / 中文兜底」的函数 | **改动最小**，与现架构一致；缺点：全局可变状态（但一个 tab 只有一个实例） |
| B. React Context | `Frame` 上挂 Provider，组件 `useContext` 取 `t` | 最规范，但要给所有组件加 hook，改动面大 |
| C. 每个组件显式 prop `t` | 从 `Frame` 一路透传 | 最啰嗦，`render props` 链会很长 |

**推荐 A**：在 `src/client/05-runtime.js`（新增片段）里放

```js
var t = function (key) { return ZH_FALLBACK[key] || key; };  // 防止 apply 前渲染
function setTranslator(fn) { t = fn; }
```

`apply()` 开头 `setTranslator(ctx.locale.bind(NS))`。这样 165 处替换只需
`"文档"` → `t("category.doc")`，不用动任何组件签名。

## 3. 目标结构

```
src/client/
  10-locale.js        zh / en 字典（165+ 条，按功能分组）
  05-runtime.js       t 兜底 + setTranslator（新增）
  ...其余片段          渲染处统一改成 t("key", params)
```

字典按功能分组，避免 165 条平铺：

```
tab.*  guide.*  toolbar.*  filter.*  summary.*  card.*  row.*
section.*  sort.*  menu.*  sessionMenu.*  preview.*  toast.*
empty.*  error.*  category.*  aria.*
```

## 4. 五类字符串的处理方式（最容易出错的地方）

1. **纯标签**（`"全部展开"`、`"清除筛选"`）：`t("toolbar.expandAll")`。
2. **带数字的组合句**：现在是 `"（共 " + n + " 个会话）"` 这种拼接。
   改成 `t("summary.sessionCount", { n })`，字典里写 `"（共 {n} 个会话）"` /
   `"({n} sessions)"`。**不要**把数字单独留在外面拼，英文语序会不对。
3. **复数/单复数**：英文要 `1 file` / `2 files`。两种方案：
   - 键后缀 `_one` / `_other` + `Intl.PluralRules`；
   - 或简化为 `"Files: {n}"`（避免复数，成本最低）。**建议先用简化式**。
4. **aria-label / title**：同样要翻译，否则英文用户用读屏软件听到中文。
   清单里约 20 条属于这类。
5. **来自数据的中文**（会话标题、文件路径、程序名）：**不翻译**，保持原样。

## 5. 插值函数（宿主 `t` 是否支持参数？）

`ctx.locale.bind(NS)` 的签名需要确认（Cordis Inspect 的 `locale` provider 或直接看
宿主实现）。若**不支持参数**，就在本插件里包一层：

```js
function t(key, params) {
  var text = rawT(key);
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, function (_, k) {
    return params[k] === undefined ? "{" + k + "}" : String(params[k]);
  });
}
```

这样字典和组件都不依赖宿主的插值能力，将来换宿主也不受影响。

## 6. 验证方案（这是能不能做的关键）

1. **字典完整性**：`tools/i18n-check.mjs` 断言
   - `Object.keys(zh)` 与 `Object.keys(en)` 完全相等；
   - 每条值非空、无 `TODO`；
   - 所有 `t("...")` 引用的 key 都在两个字典里存在；
   - 所有字典 key 都被引用（防止残留死条目）；
   - 两种字典的 `{占位符}` 集合一致。
   接入 `npm test` 与 CI。
2. **UI 回归**：`tools/harness/` 的假 ctx 增加 `locale.bind` 返回 `en`，
   用 Playwright 断言关键节点**没有汉字**、没有把 key 直接显示出来
   （正则 `[\u4e00-\u9fff]` 和 `/^[a-z]+\.[a-zA-Z]+$/`）。
   再跑一遍 `zh` 作为对照。
3. **截图**：`docs/` 里可以加一张英文界面截图给市场详情页。

## 7. 实施顺序（分 4 个提交，每步可独立验证）

| 步 | 内容 | 风险 |
|---|---|---|
| 1 | 新增 `05-runtime.js`（`t` 兜底 + `setTranslator` + 插值包装），`apply` 里绑定；`10-locale.js` 先只放现有 3 条 | 极低，行为不变 |
| 2 | **机械替换**：按 `docs/i18n-strings.md` 把 165 条改成 `t("key")`；字典同步补齐 zh/en；`tools/i18n-check.mjs` 上线 | 中，纯文本替换，harness 兜底 |
| 3 | 组合句/复数/aria 专项整理（第 4 节 2–4 类） | 中 |
| 4 | harness 双 locale 断言 + README/CHANGELOG/市场描述更新（去掉「Chinese UI」字样） | 低 |

## 8. 成本与收益

| 项 | 估算 |
|---|---|
| 工作量 | 165 条替换 + 双字典 + 校验，约 **350–450 行改动**，4 个提交 |
| 风险 | 全部是字符串；有 `i18n-check` + harness 双 locale 兜底后可控 |
| 收益 | 英文用户可用；npm / awesome 列表的覆盖面变大；`docs/i18n.md` 里 A 方案落地 |
| 不做的话 | 就按 B 方案删 `en`，诚实标注「仅中文」，10 分钟收尾 |

## 9. 一个现实建议

C-3 只做了「第一层」拆分（源码分片 + 纯函数可测 + 构建一致性），`FrameInner` 仍是
1254 行的单函数。**建议先完成第 7 节的第 1–2 步**（字典 + 机械替换），此时文案已经
集中在 `10-locale.js`，再考虑是否继续拆 `FrameInner` 的渲染——那时每个组件拿到的
就是干净的 `t("key")` 调用，拆起来更容易，也不会把中文串一起搬来搬去。

## 附：本轮已产出的工具

| 文件 | 用途 |
|---|---|
| `tools/i18n-extract.mjs` | 从源码片段抽中文串，生成 `docs/i18n-strings.md` |
| `docs/i18n-strings.md` | 165 条唯一文案 + 首次出现位置 + 出现次数（自动生成，勿手改） |
| `tools/build-client.mjs` | 分片 → `client.js` 的确定性构建 |
| `tools/client-core-check.mjs` | 32 项纯函数断言（含 `sortFiles`/`highlight`/`hostFileAddress`） |
