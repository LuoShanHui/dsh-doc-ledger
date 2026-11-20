# UI harness

给面板做浏览器验证用的小工具：它把**真实的 `client.js`** 挂到一个**假的 cordis 上下文**上，
数据来自 `server.mjs` 里的合成台账，所以不需要登录 GUI、也不会碰到真实会话。

## 跑起来

```bash
node tools/harness/server.mjs          # 或 npm run harness
# 然后打开 http://127.0.0.1:8899
# 换会话：http://127.0.0.1:8899/?session=session-child
```

端口可以用 `DOC_LEDGER_HARNESS_PORT` 改。

## React 从哪来

页面需要 React 18 的 UMD 构建，服务端按顺序找：

1. **`tools/harness/vendor/`（已随仓库提供）**——离线可用，这是默认路径；
2. `DOC_LEDGER_REACT_DIR` 指向的目录（形如 `…/node_modules`）；
3. 仓库自己的 `node_modules`；
4. 都没有时 `/react.js` 会 **302 到 unpkg**（最后兜底，需要联网）。

vendor 里的两个文件是 React 18.3.1 的 UMD 开发版，附各自的 LICENSE，从这里来：

```bash
pnpm add react@18 react-dom@18 --dir <临时目录>
# 取 node_modules/react/umd/react.development.js 与 react-dom/umd/react-dom.development.js
```

先前的顺序把 vendor 排在最后，导致无网机器上 harness 直接白屏——而 harness 是验证 UI 的**唯一**手段。

**vendor 只存在于 git，不进 npm 包。** `package.json` 的 `files` 逐个列出了 `tools` 下的内容而不是
整个目录，正是为了排除这 1.2 MB 的 React——它占了打包体积的 80%，而装插件读台账的人从不跑
harness。注意 `files` 白名单存在时 `.npmignore` 会被忽略，所以排除只能写在这里（实测过：
加 `.npmignore` 后 `npm pack --dry-run` 里 vendor 依然在）。

从 npm 装的用户想跑 harness，按上面第 2、3 档准备 React 即可（设 `DOC_LEDGER_REACT_DIR`
或装 `react`/`react-dom` 到 `node_modules`）。

## 假的东西有哪些

| 真实运行时 | harness 里 |
|---|---|
| 宿主 `sessionQuery` | `/doc-ledger/api/all` 返回 3 个固定会话（其中 `session-child` 的父会话是 `session-a`） |
| 文件读取 | `/doc-ledger/api/file` 永远返回同一段「截断 + 3 个无法解码字符」的正文，用来验证提示行 |
| `openwith` | 两个假程序（VS Code 默认 / 记事本） |
| `sidebarRight.openResource` | 记录到 `window.__calls`，不真的开 tab |
| `uiWorkspace.openSession` | 记录到 `window.__calls`，不真的切会话 |
| `sidebarRightTabs.register` | 空实现 |

## fixture 是故意这么造的

- `order-notes.md` + `OrderService.java` + `OrderServiceTest.java`：用来验证多词搜索
  （`order` 命中三个，`order md` 只命中 `order-notes.md`）；
- `旧版设计稿.md` 的 `exists: false`：验证「已删除」标记与「走弹窗而不是宿主预览」；
- `session-child` 的 `parentSessionId`：验证右键菜单里的「跳到父会话 / 跳到子会话」；
- 6 个文件分布在 4 个分区：行够多，能验证 roving tabindex（每卡只有 1 个 Tab 停靠点）。

## 可以自动化的断言

页面把服务调用记在 `window.__calls`，把根节点标成 `data-doc-ledger-root`，所以用 Playwright 之类
驱动时可以这样断言（本地验证用，没进 CI）：

```js
const root = await page.locator('[data-doc-ledger-root]');
await page.locator('[data-row-index]').first().focus();
await page.keyboard.press('ArrowDown');                       // 行内移动
await root.getByText('全部会话').click();                       // 视图切换
await page.locator('[data-row-index]').first().click();        // 宿主预览：__calls 里应出现 openResource
```

## 覆盖不到的东西

- 宿主半侧的路由与安全（用 `tools/route-check.mjs`，那是真 HTTP server）；
- 缓存决策（`tools/cache-check.mjs`）；
- 真实 DSH 的 slot 生命周期、locale 切换、主题变量——这些只能在真窗口里看。
