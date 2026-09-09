# dsh-tab-status-dot

DeepSeek Harness Web GUI 的浏览器侧小插件：用**浏览器标签页图标（favicon）里的状态圆点**，随时提醒你——
“有会话跑完你没看”或“有会话在等你做选择”。

不修改页面标题文字，指示全部放在标签图标里（那里的大小与颜色完全可控）。

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
- 订阅共享客户端运行时的 `sessions` 服务（`ctx.get("sessions").list`）的可观察快照，内含每个会话的
  `running`、`pendingInteraction`、`completed` 以及当前打开会话 `current`。
- 完成信号三重保险：运行时自带 `completed` 标志 + 插件自己的 `running→idle` 边沿检测 + “自上次可见观察以来页面曾被隐藏”标记
  ——即使浏览器对后台标签页做了计时节流、只能在你切回后才发现状态迁移，提醒也能正确点亮。
- 后台适配：浏览器会挂起后台标签页的 `requestAnimationFrame`（和部分事件投递），因此插件还做了
  - 每秒轮询（读取缓存的快照，代价极低）、
  - 除 rAF 外再挂一个短超时兜底刷新、
  - `visibilitychange` / 窗口 `focus` 时立即刷新。
- 渲染做了合帧与变更检查：每帧最多一次 DOM 写入；favicon 用“我们写入的原始字符串”比较（避免 data-URI 规范化导致反复重写）。
- “接管”favicon（`<link rel=icon>`），避免浏览器选中原品牌图标；卸载时还原原图标。

## 环境要求

- DeepSeek Harness 且使用 `web` profile；任意现代浏览器。

## 安装（DeepSeek Harness web profile）

Profile 目录：`%DSH_HOME%/profiles/web`（例如 `C:\Users\<你>\.dsh\profiles\web`）。

1. 把本包复制进 profile 的模块树：

   ```
   <profile>/node_modules/@pxy/dsh-tab-status-dot/
   ├── package.json
   └── lib/
       ├── index.js
       └── client.js
   ```

   （无需 pnpm/npm 安装：loader 会从 profile 自身的 `node_modules` 解析包。）

2. 在 `<profile>/cordis.patch.yml`（用户 patch 层）末尾追加：

   ```yaml
   - insert:
       - id: tab-status-dot
         name: '@pxy/dsh-tab-status-dot'
   ```

3. 运行中的实例会热重载用户 patch（约 1 秒）并提供新的客户端 bundle；**刷新浏览器页面**即可
   （若旧 bundle 有缓存请硬刷新）。若你的实例不热重载 patch，则重启一次 `dsh web`。

详见 [`INSTALL.md`](INSTALL.md) 的操作细节与排错。

## 开发

```
├── package.json          # dsh.client 声明（platform=web，注入 client-runtime）
├── lib/
│   ├── index.js          # host 半边：空 apply（纯 UI 插件惯例）
│   └── client.js         # 浏览器 bundle：module-loader 工厂 + 状态机 + 渲染
├── docs/
│   └── states.svg        # 状态示意图
└── test/
    └── core.test.mjs     # 纯逻辑 + 浏览器沙箱冒烟测试（node:vm，无 CJS 全局）
```

跑测试：

```sh
node test/core.test.mjs
```

测试用 `node:vm` 沙箱执行 `client.js`，只提供浏览器类全局（`window`/`document`/`localStorage`）——
与 DSH module loader 的真实执行环境一致，因此“缺 CommonJS 包装（exports is not defined）”之类
的加载期崩溃在进入真实页面前就会被抓住。

改 `lib/client.js` 后刷新页面即可验证（bundle 以 `no-cache` 提供）。

## 说明与限制

- 浏览器标签**标题是纯文本**：彩色圆点只能靠 emoji，字号颜色固定。因此状态色放在 favicon 里，页面标题保持原样。
- 提醒按浏览器存放（`localStorage`）；同一 profile 的两个标签页共享存储，语义为后写覆盖。

## License

[MIT](LICENSE)
