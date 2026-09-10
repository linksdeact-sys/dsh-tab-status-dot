# 新手上路（不用懂代码）

这个插件只做一件事：**把浏览器标签页上那个小图标变成一个小圆点，用颜色告诉你有没有事要处理。**
你不用一直盯着页面看，瞄一眼标签上的点就知道。

> 英文版：[GETTING-STARTED.md](GETTING-STARTED.md)

## 一、先记住 4 种颜色

| 你看到 | 意思 | 你要做什么 |
|---|---|---|
| ⚪ 小白点 / 小灰点 | 没事，或者任务正在跑 | 不用管 |
| 🟢 淡绿点 | 有对话**在你没看着的时候**跑完了，你还没看结果 | 点开那个对话看一眼，点就变回白色 |
| 🔵 浅蓝点 | 有任务**卡住了，在等你做选择**（例如问你选 A 还是 B） | 必须真的选一个；**光打开看不算**，选完点才消失 |
| 🟢🔵 两个点 | 上面两件事同时都有 | 分开处理：看过的消绿、选完的消蓝 |

三个小提醒：

1. **你正盯着看的那个对话跑完，不会变绿** —— 因为你已经在看了，不用提醒你。
2. 你切去看视频 / 看别的对话时它跑完，**会变绿**，回来就能看到。
3. 绿点不会因为刷新网页而消失，直到你真的看过那个对话。

## 二、装之前要有什么

- 电脑上已经装好 **DeepSeek Harness**，并且**至少打开过一次它的网页**（这样才会生成配置文件所在目录）。
- 能上网。

装插件总共就两步：**① 把文件放到 Harness 的配置目录里；② 在配置文件里加一行登记。**
下面各个系统的命令已经帮你把这两步合在一起做了。

---

## 三、Linux 安装（Ubuntu / Debian / Fedora / Arch 都适用）

### 第 1 步：打开终端

- Ubuntu / Debian 类：按 `Ctrl` + `Alt` + `T` 打开终端；
- 或者在任何文件夹里右键，选「在终端中打开 / Open Terminal Here」。

### 第 2 步：拿到文件

**办法 A：下载压缩包（不需要 git）**

```bash
cd ~/Downloads
# 如果提示 unzip 不存在，先装它：
#   Ubuntu/Debian: sudo apt install -y unzip
#   Fedora:        sudo dnf install -y unzip
#   Arch:          sudo pacman -S unzip
curl -L -o dsh-tab-status-dot.zip \
  https://github.com/linksdeact-sys/dsh-tab-status-dot/releases/latest/download/dsh-tab-status-dot-0.1.1.zip
unzip -o dsh-tab-status-dot.zip
cd dsh-tab-status-dot-0.1.1
```

**办法 B：用 git 克隆（电脑上已装 git 的话更省事）**

```bash
cd ~
git clone https://github.com/linksdeact-sys/dsh-tab-status-dot.git
cd dsh-tab-status-dot
```

### 第 3 步：运行安装脚本

```bash
chmod +x install.sh      # 给它“可执行”权限，只需做一次
./install.sh
```

> 如果提示 `Permission denied` 或 `bad interpreter`，改用这一行：
> ```bash
> sh install.sh
> ```

看到几行带 `ok` 的提示，就装好了。脚本会自动：

1. 把插件复制到 `~/.dsh/profiles/web/node_modules/@pxy/dsh-tab-status-dot`；
2. 在 `~/.dsh/profiles/web/cordis.patch.yml` 里加一行登记（并留一个 `.bak` 备份）。

### 第 4 步：刷新网页

回到 DeepSeek Harness 的网页，按 **Ctrl + F5**（Firefox 用 **Ctrl + Shift + R**）刷新。
标签上的小方块图标就会变成一个小圆点。

### 常用参数

```bash
./install.sh --profile web            # 指定 profile（默认就是 web）
./install.sh --dsh-home /home/你/.dsh  # 配置目录不在默认位置时用
./install.sh --uninstall              # 卸载（网页刷新后恢复原样）
./install.sh --help                   # 看所有参数
```

---

## 四、Windows 安装

1. 打开 <https://github.com/linksdeact-sys/dsh-tab-status-dot/releases/latest>，
   在页面最下方 **Assets** 里下载 `dsh-tab-status-dot-0.1.1.zip`。
2. 右键压缩包 → **全部解压缩**。
3. 进入解压出来的文件夹，在**空白处**右键：
   - Windows 11：选「**在终端中打开**」；
   - Windows 10：按住 **Shift** 再右键，选「**在此处打开 PowerShell 窗口**」。
4. 粘贴下面这一行，按回车：

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\install.ps1
   ```

5. 看到带 `ok` 的提示后，回到 Harness 网页按 **Ctrl + F5** 刷新。

卸载：把上面的命令末尾加上 ` -Uninstall` 再执行一次即可。

---

## 五、macOS 安装

1. 打开「终端」（访达 → 应用程序 → 实用工具 → 终端）。
2. 执行：

   ```bash
   cd ~/Downloads
   curl -L -o dsh-tab-status-dot.zip \
     https://github.com/linksdeact-sys/dsh-tab-status-dot/releases/latest/download/dsh-tab-status-dot-0.1.1.zip
   unzip -o dsh-tab-status-dot.zip
   cd dsh-tab-status-dot-0.1.1
   chmod +x install.sh
   ./install.sh
   ```

3. 回到 Harness 网页，按 **Cmd + Shift + R** 刷新。

卸载：`./install.sh --uninstall`

---

## 六、怎么确认装好了

刷新网页后：

1. **标签页最左边的小图标变成了一个小圆点**（平时是白/灰色）；
2. 发一个任务，然后切去别的网页等它跑完，回来看到小点变**淡绿** —— 说明一切正常；
3. 点开那个对话，绿点变回白色 —— 说明“已读”也正常。

更严格的检查（可选，终端里执行）：

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3080/plugins/@pxy/dsh-tab-status-dot/client.js
```

输出 `200` 表示服务端已经把这个插件提供出来了。

---

## 七、常见问题

| 现象 | 怎么办 |
|---|---|
| 刷新后图标没变化 | 1) 确认 `~/.dsh/profiles/web/cordis.patch.yml` 里有 `tab-status-dot` 那几行；2) 把 DeepSeek Harness 完全关掉再重新打开；3) 再刷新网页。 |
| 提示 `unzip: command not found` | 先装 unzip（见第 2 步注释里的命令）。 |
| 提示 `Permission denied` | 先 `chmod +x install.sh`，或者用 `sh install.sh`。 |
| 提示找不到 profile | 至少打开过一次 Harness 网页，或启动一次 `dsh --profile web --help`，然后再装。 |
| 装完页面看着不对劲 | 跑 `./install.sh --uninstall`（Windows 用 `-Uninstall`），刷新即可完全复原。 |
| 想改颜色 / 大小 | 改 `lib/client.js` 里的两个色值和圆的半径（文件里有注释），保存后刷新网页即可。 |

---

## 八、它到底动了你电脑上的什么？

只动两处，都可一键撤销：

1. 新建了一个文件夹：`<你的配置目录>/profiles/web/node_modules/@pxy/dsh-tab-status-dot/`；
2. 在你的配置目录里的 `profiles/web/cordis.patch.yml` **末尾追加了一段带标记的配置**
   （标记是 `# >>> dsh-tab-status-dot >>>` 到 `# <<< dsh-tab-status-dot <<<`，方便一键移除），
   同时留了一份 `cordis.patch.yml.bak` 备份。

它不会修改 Harness 的程序文件，不会安装任何后台服务，也不联网上传任何数据。
