# dsh-tab-status-dot

[![test](https://github.com/linksdeact-sys/dsh-tab-status-dot/actions/workflows/ci.yml/badge.svg)](https://github.com/linksdeact-sys/dsh-tab-status-dot/actions/workflows/ci.yml)
[![release](https://img.shields.io/github/v/release/linksdeact-sys/dsh-tab-status-dot)](https://github.com/linksdeact-sys/dsh-tab-status-dot/releases/latest)
[![license](https://img.shields.io/github/license/linksdeact-sys/dsh-tab-status-dot)](LICENSE)

DeepSeek Harness Web GUI 的浏览器侧小插件：用**浏览器标签页图标（favicon）里的状态圆点**，随时提醒你——
“有会话跑完你没看”或“有会话在等你做选择”。

不修改页面标题文字，指示全部放在标签图标里（那里的大小与颜色完全可控）。

> **第一次用？** 看 **[新手上路（不用懂代码）](GETTING-STARTED.zh-CN.md)**（[English](GETTING-STARTED.md)）——
> Windows / Linux / macOS 都有一步步的图文式命令，复制粘贴即可。

![states](docs/states.svg)

## 圆点含义

| 标签图标 | 含义 | 什么时候恢复为中性 |
|---|---|---|
| 中性小点 | 默认状态（亮色系统深灰、暗色系统近白）；有任务正在跑时也是中性 | — |
| 淡绿小点 | 至少一个会话跑完，而且它跑完时你**不在看**（页面在后台 / 你在看别的会话） | 你**点开该会话查看**；若本来就是打开的会话，回到页面停留约 1 秒视为已读。多个未看会话需逐个处理完才回中性 |
| 浅蓝小点 | 有会话正停住等你做选择/审批（还没答） | **点开看不算**；必须真正完成选项选择、任务重新开始进行后，蓝色才消失 |
| 两个浅色小点 | 上述两种情况同时存在 | 绿色按“查看过”清除；蓝色按“做出选择”清除 |

补充规则：
- 你**正看着页面、且打开的正是这个会话**时它跑完，不亮绿（你本来就在看结果）。
- 页面处于后台时跑完的会话**也会亮绿**（哪怕它就是当前打开的会话）——因为那一刻你并没有在看它。
- 会话再次开跑或会话被删除，会取代/移除旧的“完成未看”提醒。
- “未查看的完成”存在浏览器 `localStorage` 里，**刷新/重开页面不丢**，直到你处理完。

## 为什么需要它

运行时内建的模型把“会话被选中”当作“已查看”——于是**当前打开的会话**在标签页后台跑完时永远不会产生提醒。
本插件把“你不在看”重新定义为 *会话没被选中 或 页面处于后台*，更贴合真实使用方式（发任务 → 切走 → 回来）。

## 原理

- 注册为**双面 cordis 插件**（`dsh.client`, `platform: web`）：宿主半边 `lib/index.js` 是空 `apply`；浏览器半边
  （`exports["./client"]` → `lib/client.js`）是 module-loader 格式的 classic-script bundle。
- 订阅 **`sessions` 服务**（`ctx.get("sessions").list`）的可观察快照，内含每个会话的 `running`、`completed`
  以及当前打开会话 `current`。
- “等待操作”（蓝灯）取自运行时自己的数据源：**DSH 0.1.5-rc.1+** 用 `uiSession.pendingInteractions`
  （可观察的 `Map<SessionId, 交互>`）；旧版则回退扫描会话摘要上的 `pendingInteraction` 字段。两条路径都支持。
- 完成信号三重保险：运行时自带 `completed` 标志 + 插件自己的 `running→idle` 边沿检测 + “自上次可见观察以来页面曾被隐藏”标记
  ——即使浏览器对后台标签页做了计时节流、只能在你切回后才发现状态迁移，提醒也能正确点亮。
- 后台适配：浏览器会挂起后台标签页的 `requestAnimationFrame`（和部分事件投递），因此插件还做了
  - 每秒轮询（读取缓存的快照，代价极低）、
  - 除 rAF 外再挂一个短超时兜底刷新、
  - `visibilitychange` / 窗口 `focus` 时立即刷新。
- 渲染做了合帧与变更检查：每帧最多一次 DOM 写入；favicon 用“我们写入的原始字符串”比较（避免 data-URI 规范化导致反复重写）。
- “接管”favicon（`<link rel=icon>`），避免浏览器选中原品牌图标；卸载时还原原图标。

## 版本兼容

| DSH 版本 | 状态 |
|---|---|
| 0.1.5-rc.1（当前） | 支持 —— 会话来自 `@deepseek-ai/dsh-api-session-controller`，“等待操作”来自 `uiSession.pendingInteractions`。 |
| ≤ 0.1.0-rc.x | 支持 —— 会话来自当时的运行时，“等待操作”回退扫描会话摘要字段。 |

插件**刻意不声明任何“包名注入边”**（`dsh.client.inject`），只声明它需要的**服务名**
（`exports.inject = ["sessions"]`）。原因是包名会随 DSH 版本搬家（本次会话运行时就从
`dsh-client-runtime` 换到了 `dsh-api-session-controller`），而**指向不存在包的注入边会让插件行永远无法实例化**
—— 这正是这次“指示灯失效”的原因。等待服务名则在各版本间都稳定。

> **安装或升级插件后请重启 `dsh web`**（并重新打开它打印的 URL）。客户端模块注册表会**按 specifier 缓存包元数据直到重启**，
> 因此只刷新页面并不能让改动后的 `package.json` 生效。

## 环境要求

- DeepSeek Harness 且使用 `web` profile；任意现代浏览器。

## 安装

### DeepSeek Harness 的插件是怎么部署的

每个 DSH 界面都是一个 *profile* 目录（`$DSH_HOME/profiles/<名称>`，例如 `~/.dsh/profiles/web`）。插件只需满足两件事：

1. **包能被该 profile 解析到** —— 即位于 `<profile>/node_modules/<包名>`（pnpm 会装到这里，直接复制文件同样有效）；
2. **该 profile 注册了对应的 loader 行** —— 既可以由**包自带的 bundle 补丁层**注册（见下），也可以在 `<profile>/cordis.patch.yml` 里手写一条 `insert`。

之后实例会把这一行组合进插件树并提供客户端 bundle。注意：当前版本的 DSH 会**按 specifier 缓存包元数据直到进程重启**，因此**安装插件或改动 `package.json` 后必须重启 `dsh web`**，并打开它打印的（带认证的）URL；只有改 `lib/client.js` 内容时才只需刷新页面。

### 本包就是一个官方形态的插件（同时是一个 bundle）

按 DSH 官方说明：**这个 harness 里每个能力都是 `cordis.yml` 里的一行插件**，而一个包可以自带**组合包补丁层（bundle patch）**来注册自己那一行：

```
dsh: {
  bundle: { patch: "./cordis.patch.yml" },   // 本包自己的插件行写在这里
  client: { platform: "web" }                // 双面客户端插件（./client 导出）
}
```

于是有两条等价路线 —— **只选其一**：

| 路线 | 做法 | 前提 |
|---|---|---|
| **A. 组合包（官方 CLI 路线）** | `dsh plugin --profile web add github:linksdeact-sys/dsh-tab-status-dot`，再把 `"@pxy/dsh-tab-status-dot"` 加进 `<profile>/package.json` 的 `dsh.profile.bundles` 列表 | 需要 pnpm（`dsh plugin` 会转发给它） |
| **B. 脚本 / 手动复制** | 跑 `install.ps1` / `install.sh`（或直接把文件复制进 `node_modules`）+ 在 `<profile>/cordis.patch.yml` 写入 insert 行 | 什么都不需要 |

> **为什么不用“动态 Cordis 插件”？** DSH 还提供通过 `cordis_*` 工具在运行时定义的插件，但官方开发指引**明确禁止**它们直接操作页面
> （原文：*"Do not manipulate `document.body`, `window`, or hard-coded product DOM selectors."*）。
> 标签页图标指示灯本质上必须这么做，所以它只能是**打包客户端插件**，也就是本项目的形态。

> **安装脚本已通过真机 CI 验证**：在 `ubuntu-latest`（`sh` 即 dash）、`macos-latest`（BSD 工具链）、Alpine/BusyBox `sh`、`windows-latest`（Windows PowerShell 5.1）四种真实环境中，均按“出厂模板形态（注释头 + 裸 `[]`、无行尾换行）”安装，并用 `js-yaml` 校验生成的配置，覆盖重复安装、追加已有条目、卸载等路径。另有独立任务校验本包的插件约定（`test/bundle.test.mjs`），避免元数据回归再次“悄悄让插件失效”。

### 方式一：安装脚本（推荐）

```powershell
# Windows（PowerShell）
git clone https://github.com/linksdeact-sys/dsh-tab-status-dot.git
cd dsh-tab-status-dot
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

```sh
# macOS / Linux
git clone https://github.com/linksdeact-sys/dsh-tab-status-dot.git
cd dsh-tab-status-dot
./install.sh
```

脚本会把包复制进 `web` profile、把注册块追加到 `cordis.patch.yml`（可重复执行、自动留 `.bak` 备份），并打印后续步骤。
可选参数：`-Profile <名称>` / `--profile <名称>`、`-DshHome <路径>` / `--dsh-home <路径>`、`--uninstall`。

### 方式二：包管理器（`dsh plugin`）

如果环境里有 pnpm，官方路线可直接从 GitHub 装进 profile：

```sh
dsh plugin --profile web add github:linksdeact-sys/dsh-tab-status-dot
```

然后在 `~/.dsh/profiles/web/cordis.patch.yml` 追加注册行：

```yaml
# >>> dsh-tab-status-dot >>>
- insert:
    - id: tab-status-dot
      name: '@pxy/dsh-tab-status-dot'
# <<< dsh-tab-status-dot <<<
```

### 方式三：手动复制

下载 Release 里的 zip（或从 clone 复制）使 profile 目录变为：

```
<profile>/node_modules/@pxy/dsh-tab-status-dot/
├── package.json
└── lib/
    ├── index.js
    └── client.js
```

并把方式二里相同的 `insert` 块加进 `<profile>/cordis.patch.yml`。

### 验证

1. 刷新 Harness 页面（若旧 bundle 有缓存请 `Ctrl+F5` 硬刷新）；
2. 标签图标显示中性点。发一个任务后切去别的页面：它在你不在时跑完 → 变**淡绿**；有提问/审批等你处理 → 变**浅蓝**；
3. 可选的服务端自检：`GET http://127.0.0.1:3080/plugins/@pxy/dsh-tab-status-dot/client.js` 返回 `200`。

### 卸载

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -Uninstall   # Windows
./install.sh --uninstall                                           # macOS / Linux
```

或手动删除 `<profile>/node_modules/@pxy/dsh-tab-status-dot` 与 `cordis.patch.yml` 里的 `insert` 块。

### 排错

| 现象 | 处理 |
|---|---|
| 刷新后毫无变化 | 确认 `cordis.patch.yml` 里的 `insert` 行包名完全正确，然后硬刷新；若实例不热重载 patch，重启一次 `dsh web`。 |
| `GET /plugins/.../client.js` 返回 404 | 运行实例没有注册该行（patch 未应用），或包不在 profile 的 `node_modules` 里。 |
| `dsh plugin … add` 失败 | 环境缺 pnpm —— 改用方式一或方式三，两者都不需要包管理器。 |
| 装上后页面异常 | 从 `cordis.patch.yml` 移除该行（或跑卸载脚本）再刷新：插件会完整卸载，包括它接管的 favicon。 |

详见 [`INSTALL.md`](INSTALL.md) 的逐步操作与排错记录。

## 开发

```
├── package.json          # dsh.client 声明（platform=web，注入 client-runtime）
├── lib/
│   ├── index.js          # host 半边：空 apply（纯 UI 插件惯例）
│   └── client.js         # 浏览器 bundle：module-loader 工厂 + 状态机 + 渲染
├── docs/
│   └── states.svg        # 状态示意图
└── test/
    ├── core.test.mjs         # 纯逻辑 + node:vm 沙箱冒烟测试（无 CJS 全局）
    └── browser.e2e.mjs       # 真浏览器 E2E（Playwright）+ browser/fixture.html 内核替身
```

### 单元测试（零依赖）

```sh
node test/core.test.mjs        # 或：npm test
```

用 `node:vm` 沙箱执行 `client.js`，只提供浏览器类全局（`window`/`document`/`localStorage`）——
与 DSH module loader 的真实执行环境一致，因此“缺 CommonJS 包装（exports is not defined）”之类
的加载期崩溃在进入真实页面前就会被抓住。

### 真浏览器 E2E（Playwright）

```sh
# 本地：复用已安装的 Chrome/Edge（不下载浏览器）
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-save --no-package-lock playwright
PW_CHANNEL=msedge node test/browser.e2e.mjs

# 或用 Playwright 自带的 Chromium：
npm install --no-save --no-package-lock playwright
npx playwright install --with-deps chromium
node test/browser.e2e.mjs      # 或：npm run test:e2e
```

`test/browser/fixture.html` 是 DSH 浏览器内核的替身：捕获 bundle 的 `__ModuleLoader__` 注册，
并提供一个可编程的假 `sessions` 服务。测试会驱动真实会话状态，并断言**浏览器实际解析出的 favicon**：
中性 → 淡绿（你不在时跑完）→ 点开后清除；**隐藏标签页里当前会话跑完也亮绿**，以及回到页面约 1 秒的
自动已读；等待选择时浅蓝、作答后清除；两种情况并存显示双点；刷新后提醒仍在；卸载时完整复原。
任何 page error / console error 都会让测试失败。

改 `lib/client.js` 后刷新页面即可实时验证（bundle 以 `no-cache` 提供）。

## 说明与限制

- 浏览器标签**标题是纯文本**：彩色圆点只能靠 emoji，字号颜色固定。因此状态色放在 favicon 里，页面标题保持原样。
- 提醒按浏览器存放（`localStorage`）；同一 profile 的两个标签页共享存储，语义为后写覆盖。

## License

[MIT](LICENSE)
