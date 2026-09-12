# 安装到 dsh web 的 profile

> **一键安装**：克隆本仓库后直接运行 `install.ps1`（Windows）或 `install.sh`（macOS/Linux），
> 它会自动完成下面「步骤 1 + 步骤 2」并保留 `.bak` 备份；`--uninstall` 可一键卸载。
> 本文保留逐步手动操作，便于理解原理与排错。

运行中的 web profile 位于 `%DSH_HOME%\profiles\web`（本例 `C:\Users\pxy\.dsh\profiles\web`）。
profile 的用户 patch 层 `cordis.patch.yml` 会被运行中的实例**热重载**（`watchUserPatches`），
loader 的 `baseUrl` 就是 profile 目录，模块解析会先查 profile 自己的 `node_modules` ——
所以把插件包放进 profile 的 node_modules、再往 patch 里加一行 insert，就会生效。

> ## ⚠️ 重要：安装/升级后需要重启一次 `dsh web`
>
> patch 行本身是热重载的，但**客户端模块注册表会按 specifier 缓存包元数据，直到进程重启才失效**
> （新版 dsh 源码里的原话是 “cached per Loader specifier and owning-tree base URL until restart”）。
> 因此：
>
> - **首次安装插件**、或**改动过插件的 `package.json`（例如依赖/inject）** → 必须**重启 `dsh web`**，
>   并打开它新打印的（带认证 token 的）URL；
> - 只改了 `lib/client.js` 的内容（不动 package.json） → 刷新页面即可，bundle 以 no-cache 提供。
>
> 另外新版 dsh 的 web 端需要认证：直接访问旧地址会返回
> `401 dsh web authentication required; reopen the URL printed by dsh web.`，属于正常现象。

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

### 3. 重启 dsh web，然后打开它打印的 URL

保存 patch 后，运行中的实例会在 ~1 秒内事务式重放 patch 并创建新插件行，
客户端模块注册表会把它纳入启动图。**但由于元数据缓存到重启才失效，首次安装请重启一次 `dsh web`**，
然后打开它新打印的（带认证 token 的）URL；页面加载时会从
`/plugins/@pxy/dsh-tab-status-dot/client.js` 拿到插件 bundle。

## 验证

- 浏览器端（最可靠）：标签**图标**显示中性圆点；会话在你不在看时跑完 → **淡绿**；
  有提问/审批等你处理 → **浅蓝**（作答后消失）；两者并存 → 图标里两个浅色点。
  绿点在你点开该会话查看后清除；若它本来就是打开的会话，回到页面约 1 秒即视为已读。
- 服务端自检（新版需要认证 Cookie，因此直接 curl 会返回 401，属正常）：若你已用带 token 的
  URL 打开页面，可在浏览器开发者工具里查看 `/plugins/.../client.js` 是否 200；命令行未必可用。

## 迭代改动

修改 `lib/client.js` 后，只要再刷新页面即可（`/plugins/...` 以 no-cache 提供）。

## 卸载

一键卸载（会同时移除 `cordis.patch.yml` 中的注册块，并留 `.bak` 备份）：

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -Uninstall   # Windows
./install.sh --uninstall                                           # macOS / Linux
```

手动卸载：从 `cordis.patch.yml` 删除 insert 行（热重载自动移除该插件），
再删除 `node_modules\@pxy\dsh-tab-status-dot` 目录即可。

## 备注

- 若某天运行实例不在热重载模式（patch 未生效），兜底方案：重启 `dsh web` 进程后再刷新页面。
- 官方安装方式是 `dsh plugin --profile web add <package>`（内部走 pnpm）；本目录结构等价于
  pnpm hoisted 布局下单包落地结果，故直接复制即可。
