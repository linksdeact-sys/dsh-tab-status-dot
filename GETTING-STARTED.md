# Getting started (no coding required)

This plugin does exactly one thing: it turns the little icon in your browser tab (the favicon) into a
**status dot**, so its colour tells you whether anything needs your attention — without staring at the page.

> 中文版：[GETTING-STARTED.zh-CN.md](GETTING-STARTED.zh-CN.md)

## The four colours

| What you see | What it means | What to do |
|---|---|---|
| ⚪ neutral dot | Nothing pending, or a task is running | Nothing |
| 🟢 light green | A conversation **finished while you were not looking** and you have not read the result yet | Open that conversation — the dot goes back to neutral |
| 🔵 light blue | A task is **waiting for a choice from you** (e.g. "A or B?") | You must actually answer; merely opening the page does **not** clear it |
| 🟢🔵 two dots | Both of the above at once | Handle each: reading clears green, answering clears blue |

Three things worth knowing:

1. A session finishing **while you are looking at it** does not turn green — no reminder needed.
2. A session finishing while you are on another page/tab **does** turn green.
3. Green reminders survive a page reload until you actually open that conversation.

## Before you start

- DeepSeek Harness is installed and you have **opened its web page at least once** (that creates the config directory).
- You have internet access.

Installing = **① put the plugin files into the Harness config directory** and **② register one line in a config file**.
The commands below do both for you.

> ## ⚠️ The one thing people get wrong: restart Harness afterwards
>
> **After installing (and after every later upgrade of the plugin) you must restart DeepSeek Harness once** —
> a page refresh alone is not enough. Harness caches the plugin registry information until it restarts.
>
> How to restart:
> 1. Close the DeepSeek Harness browser window.
> 2. In the terminal that runs it, press **Ctrl + C** to stop it.
> 3. Start it again exactly the way you normally do.
> 4. **Open the URL it prints this time** (current Harness prints an authenticated URL; opening the old
>    address shows an "authentication required" error).
> 5. The tab icon shows the status dot.
>
> The last step of each OS section below means exactly this.

---

## Linux (Ubuntu / Debian / Fedora / Arch …)

### 1. Open a terminal

`Ctrl` + `Alt` + `T` on Ubuntu/Debian, or right-click a folder → "Open Terminal Here".

### 2. Get the files

**Option A — download the release zip (no git needed)**

```bash
cd ~/Downloads
# if unzip is missing:
#   Ubuntu/Debian: sudo apt install -y unzip
#   Fedora:        sudo dnf install -y unzip
#   Arch:          sudo pacman -S unzip
curl -L -o dsh-tab-status-dot.zip \
  https://github.com/linksdeact-sys/dsh-tab-status-dot/releases/latest/download/dsh-tab-status-dot-0.1.3.zip
unzip -o dsh-tab-status-dot.zip
cd dsh-tab-status-dot-0.1.3
```

**Option B — clone with git**

```bash
cd ~
git clone https://github.com/linksdeact-sys/dsh-tab-status-dot.git
cd dsh-tab-status-dot
```

### 3. Run the installer

```bash
chmod +x install.sh      # once
./install.sh
```

> If you get `Permission denied` or a bad-interpreter error, use `sh install.sh` instead.

It copies the plugin into `~/.dsh/profiles/web/node_modules/@pxy/dsh-tab-status-dot` and appends a marked
registration block to `~/.dsh/profiles/web/cordis.patch.yml` (keeping a `.bak` backup).

### 4. Restart Harness and open the new URL

After the ok lines, restart DeepSeek Harness as described in the warning above and open the URL it prints.
The tab icon becomes a small dot (neutral while idle).

### Useful flags

```bash
./install.sh --profile web             # target profile (default: web)
./install.sh --dsh-home /home/you/.dsh # custom Harness home
./install.sh --uninstall               # remove everything (restart Harness afterwards)
./install.sh --help
```

---

## Windows

1. Open <https://github.com/linksdeact-sys/dsh-tab-status-dot/releases/latest> and download
   `dsh-tab-status-dot-0.1.3.zip` from **Assets**.
2. Right-click the zip → **Extract All**.
3. In the extracted folder, right-click empty space → **Open in Terminal** (Windows 11) or
   **Open PowerShell window here** (Shift + right-click on Windows 10).
4. Paste and press Enter:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\install.ps1
   ```

5. **Restart DeepSeek Harness and open the URL it prints** (see the warning above).

Uninstall: run the same command with ` -Uninstall` appended.

---

## macOS

```bash
cd ~/Downloads
curl -L -o dsh-tab-status-dot.zip \
  https://github.com/linksdeact-sys/dsh-tab-status-dot/releases/latest/download/dsh-tab-status-dot-0.1.3.zip
unzip -o dsh-tab-status-dot.zip
cd dsh-tab-status-dot-0.1.3
chmod +x install.sh
./install.sh
```

Then **restart DeepSeek Harness and open the URL it prints**. Uninstall with `./install.sh --uninstall` (restart again afterwards).

---

## Did it work?

1. The tab icon is now a small dot (neutral when idle).
2. Start a task, switch to another page, let it finish: back in the Harness tab the dot is **light green**.
3. Open that conversation: the dot returns to neutral.
4. When a question waits for your choice, the dot is **light blue** and only clears once you answer.

> Current Harness serves its web surface behind cookie authentication, so a plain `curl` against
> `http://127.0.0.1:3080/` (or the plugin endpoint) answers `401 authentication required`. Watching the icon
> in the steps above is the reliable check.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Nothing changes after installing | **Restart DeepSeek Harness and open the URL it prints** — a page refresh is not enough (Harness caches plugin metadata until restart). Also check that `cordis.patch.yml` contains the `tab-status-dot` block. |
| `401 authentication required` when opening the page | Use the authenticated URL Harness printed at startup (it contains a token), not an older bookmark. |
| Page looks wrong after installing | `./install.sh --uninstall` (Windows: `-Uninstall`), restart Harness — everything is restored. |
| `unzip: command not found` | Install unzip (see the note in step 2). |
| `Permission denied` | `chmod +x install.sh`, or run `sh install.sh`. |
| "Profile not found" | Open the Harness page once (or run `dsh --profile web --help`) and retry. |
| Page looks wrong after installing | `./install.sh --uninstall` (Windows: `-Uninstall`), then refresh — everything is restored. |
| Want different colours/size | Edit the two colour values and the circle radius in `lib/client.js` (commented), then refresh the page. |

---

## What it touches on your machine

Only two things, both reversible in one command:

1. a new folder `<Harness home>/profiles/web/node_modules/@pxy/dsh-tab-status-dot/`;
2. a marked block appended to `profiles/web/cordis.patch.yml`
   (`# >>> dsh-tab-status-dot >>>` … `# <<< dsh-tab-status-dot <<<`), with a `.bak` backup kept.

It does not modify Harness program files, install background services, or upload any data.
