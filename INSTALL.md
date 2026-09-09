# 安装到运行中的 dsh web（免重启方案）

运行中的 web profile 位于 `%DSH_HOME%\profiles\web`（本例 `C:\Users\pxy\.dsh\profiles\web`）。
profile 的用户 patch 层 `cordis.patch.yml` 会被运行中的实例**热重载**（`watchUserPatches`），
loader 的 `baseUrl` 就是 profile 目录，模块解析会先查 profile 自己的 `node_modules` ——
所以把插件包放进 profile 的 node_modules、再往 patch 里加一行 insert，即可生效，**无需重启服务**。

## 步骤

### 1. 把插件包放进 profile 的 node_modules

```
C:\Users\pxy\.dsh\profiles\web\node_modules\@pxy\dsh-tab-status-dot\
├── package.json
└── lib\
    ├── index.js
    └── client.js
```

把本目录（`dsh-tab-status-dot`）的 `package.json`、`lib/` 复制过去即可（无需 pnpm/npm 安装：
loader 按 Node 解析规则在 profile 目录的 node_modules 找到它）。

### 2. 在 cordis.patch.yml 末尾追加一行 insert

`C:\Users\pxy\.dsh\profiles\web\cordis.patch.yml` 原内容为顶层空数组 `[]`，改为：

```yaml
# Your patch layer for this dsh profile, applied after every bundle layer:
# a top-level YAML array of loader patch entries (id-targeted config
# overrides, disables, and insert lists; `!!js` expressions allowed).
- insert:
    - id: tab-status-dot
      name: '@pxy/dsh-tab-status-dot'
```

### 3. 让热重载落盘，然后刷新浏览器页面

保存 patch 后，运行中的实例会在 ~1 秒内事务式重放 patch 并创建新插件行，
客户端模块注册表会把它纳入启动图。此时**刷新一次浏览器页面**（F5），
新的 `__DSH_BOOT__` 会包含本插件并从 `/plugins/@pxy/dsh-tab-status-dot/client.js` 加载它。

## 验证

- 服务端已生效：`GET /plugins/@pxy/dsh-tab-status-dot/client.js` 返回 200（内容是插件 bundle）；
  主页 HTML 的 `window.__DSH_BOOT__` 里包含 `@pxy/dsh-tab-status-dot`。
- 浏览器端：页面刷新后标签页标题前出现圆点；跑一个会话、任务完成后圆点变绿，
  点进该会话查看后变白；多任务同理需逐个查看。

## 迭代改动

修改 `lib/client.js` 后，只要再刷新页面即可（`/plugins/...` 以 no-cache 提供）。
如需彻底卸载：从 `cordis.patch.yml` 删除 insert 行（热重载自动移除），
再删除 `node_modules\@pxy\dsh-tab-status-dot` 目录即可。

## 备注

- 若某天运行实例不在热重载模式（patch 未生效），兜底方案：重启 `dsh web` 进程后再刷新页面。
- 官方安装方式是 `dsh plugin --profile web add <package>`（内部走 pnpm）；本目录结构等价于
  pnpm hoisted 布局下单包落地结果，故直接复制即可。
