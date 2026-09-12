#Requires -Version 5.1
<#
.SYNOPSIS
  Install (or uninstall) the dsh-tab-status-dot plugin for DeepSeek Harness.

.DESCRIPTION
  Copies this package into the target profile's node_modules and registers a
  loader row in the profile's cordis.patch.yml (idempotent: safe to re-run).

  Typical use from a cloned repository:

      powershell -ExecutionPolicy Bypass -File .\install.ps1

  Uninstall:

      powershell -ExecutionPolicy Bypass -File .\install.ps1 -Uninstall

.PARAMETER Profile
  Harness profile name. Default: web

.PARAMETER DshHome
  Harness home directory. Default: $env:DSH_HOME, else ~/.dsh

.PARAMETER Source
  Directory holding package.json + lib/ to install. Default: this script's folder.

.PARAMETER Uninstall
  Remove the package and its cordis.patch.yml registration.

.PARAMETER Force
  Overwrite an existing installed copy without prompting.
#>
[CmdletBinding()]
param(
    [string]$Profile = 'web',
    [string]$DshHome = $env:DSH_HOME,
    [string]$Source = '',
    [switch]$Uninstall,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
# $PSScriptRoot is not always populated during parameter binding (e.g. under
# `powershell -File`), so resolve the default source directory here instead.
if ([string]::IsNullOrWhiteSpace($Source)) {
    if ($PSScriptRoot) { $Source = $PSScriptRoot }
    elseif ($MyInvocation.MyCommand.Path) { $Source = Split-Path -Parent $MyInvocation.MyCommand.Path }
    else { $Source = (Get-Location).Path }
}
$PackageName = '@pxy/dsh-tab-status-dot'
$PackageLeaf = 'dsh-tab-status-dot'
$ScopeLeaf = '@pxy'
$RowId = 'tab-status-dot'

$startMarker = '# >>> dsh-tab-status-dot >>>'
$endMarker = '# <<< dsh-tab-status-dot <<<'
$block = @"
$startMarker
# Tab status dot plugin: light green = session finished while you were away,
# light blue = a session is waiting for your choice.
- insert:
    - id: $RowId
      name: '$PackageName'
$endMarker
"@

function Write-Step($text) { Write-Host "==> $text" -ForegroundColor Cyan }
function Write-Ok($text)   { Write-Host "  ok  $text" -ForegroundColor Green }
function Write-Warn2($text) { Write-Host "  !   $text" -ForegroundColor Yellow }

# ── resolve locations ────────────────────────────────────────────────────────
if ([string]::IsNullOrWhiteSpace($DshHome)) {
    $DshHome = Join-Path $HOME '.dsh'
}
if (-not (Test-Path -LiteralPath $DshHome)) {
    throw "Harness home not found: $DshHome (set DSH_HOME or pass -DshHome)"
}
$profileDir = Join-Path (Join-Path $DshHome 'profiles') $Profile
if (-not (Test-Path -LiteralPath $profileDir)) {
    throw "Profile '$Profile' not found at $profileDir. Start it once ('dsh --profile $Profile --help') or pass -Profile <name>."
}
$patchPath = Join-Path $profileDir 'cordis.patch.yml'
$destDir = Join-Path (Join-Path (Join-Path $profileDir 'node_modules') $ScopeLeaf) $PackageLeaf

function Get-EntryText([string]$text) {
    # Everything that is not a comment line or blank space — i.e. the actual
    # YAML entries. A file whose entries collapse to '' or '[]' has no real
    # patch entries, which matters when deciding how to write the file.
    $lines = $text -split "`r?`n"
    $kept = foreach ($line in $lines) {
        $t = $line.Trim()
        if ($t -ne '' -and -not $t.StartsWith('#')) { $t }
    }
    return (($kept -join '') -replace '\s', '')
}

function Get-CommentHeader([string]$text) {
    $lines = $text -split "`r?`n"
    $kept = foreach ($line in $lines) {
        if ($line.TrimStart().StartsWith('#')) { $line.TrimEnd() }
    }
    return ($kept -join "`r`n")
}

# ── uninstall ────────────────────────────────────────────────────────────────
if ($Uninstall) {
    Write-Step "Uninstalling $PackageName from profile '$Profile'"
    if (Test-Path -LiteralPath $destDir) {
        Remove-Item -LiteralPath $destDir -Recurse -Force
        Write-Ok "removed $destDir"
    } else {
        Write-Warn2 "package not installed at $destDir"
    }
    if (Test-Path -LiteralPath $patchPath) {
        $raw = Get-Content -LiteralPath $patchPath -Raw
        $updated = $raw
        # 1) marker-delimited block (written by this script)
        $pattern = "(?ms)^\s*" + [regex]::Escape($startMarker) + ".*?" + [regex]::Escape($endMarker) + "\s*\r?\n?"
        $updated = [regex]::Replace($updated, $pattern, '')
        # 2) hand-written block (no markers)
        $plain = "(?ms)^# Tab status dot plugin.*?\r?\n- insert:\r?\n\s+- id: $RowId\r?\n\s+name: '$([regex]::Escape($PackageName))'\s*\r?\n?"
        $updated = [regex]::Replace($updated, $plain, '')
        if ($updated -ne $raw) {
            Copy-Item -LiteralPath $patchPath -Destination "$patchPath.bak" -Force
            $entryText = Get-EntryText $updated
            if ($entryText -eq '' -or $entryText -eq '[]') {
                # A comments-only file is not a valid patch list: keep the
                # comment header but make sure a real `[]` token survives.
                $comments = Get-CommentHeader $updated
                $updated = if ($comments -ne '') { $comments + "`r`n`r`n[]`r`n" } else { "[]`r`n" }
            }
            Set-Content -LiteralPath $patchPath -Value $updated -NoNewline
            Write-Ok "registration removed from $patchPath (backup: cordis.patch.yml.bak)"
        } else {
            Write-Warn2 "no registration found in $patchPath"
        }
    }
    Write-Host ''
    Write-Host 'Uninstalled. Refresh the Harness page (restart dsh web if the instance does not hot-reload patches).'
    exit 0
}

# ── install: copy the package ────────────────────────────────────────────────
$manifest = Join-Path $Source 'package.json'
$libDir = Join-Path $Source 'lib'
if (-not (Test-Path -LiteralPath $manifest)) { throw "package.json not found in $Source (pass -Source <path to the plugin folder>)" }
if (-not (Test-Path -LiteralPath $libDir)) { throw "lib/ not found in $Source" }

Write-Step "Installing $PackageName into profile '$Profile'"
if (Test-Path -LiteralPath $destDir) {
    if (-not $Force) {
        Write-Warn2 "already present at $destDir — overwriting (use -Force to silence)"
    }
    Remove-Item -LiteralPath $destDir -Recurse -Force
}
New-Item -ItemType Directory -Force -Path (Join-Path $destDir 'lib') | Out-Null
Copy-Item -LiteralPath $manifest -Destination (Join-Path $destDir 'package.json') -Force
Copy-Item -LiteralPath (Join-Path $libDir 'index.js') -Destination (Join-Path $destDir 'lib\index.js') -Force
Copy-Item -LiteralPath (Join-Path $libDir 'client.js') -Destination (Join-Path $destDir 'lib\client.js') -Force
Write-Ok "package copied to $destDir"

# ── install: register the loader row ─────────────────────────────────────────
if (-not (Test-Path -LiteralPath $patchPath)) {
    Write-Warn2 "cordis.patch.yml missing; creating $patchPath"
    New-Item -ItemType File -Force -Path $patchPath | Out-Null
}
$patch = Get-Content -LiteralPath $patchPath -Raw
if ($patch -match [regex]::Escape($RowId)) {
    Write-Ok "already registered in cordis.patch.yml (id: $RowId)"
} else {
    Copy-Item -LiteralPath $patchPath -Destination "$patchPath.bak" -Force
    # The template shipped by dsh is a comment header followed by a bare `[]`
    # (and no trailing newline). Appending after that `[]` would produce TWO
    # YAML root nodes, which the loader rejects — rewrite it in that case,
    # keeping the original comment header.
    $entryText = Get-EntryText $patch
    if ($entryText -eq '' -or $entryText -eq '[]') {
        $comments = Get-CommentHeader $patch
        $new = if ($comments -ne '') { $comments + "`r`n`r`n" + $block + "`r`n" } else { $block + "`r`n" }
    } else {
        $new = $patch
        if (-not $new.EndsWith("`n")) { $new += "`r`n" }
        $new += "`r`n" + $block + "`r`n"
    }
    Set-Content -LiteralPath $patchPath -Value $new -NoNewline
    Write-Ok "registered row '$RowId' in $patchPath (backup: cordis.patch.yml.bak)"
}

Write-Host ''
Write-Host 'Done. Next steps:' -ForegroundColor Cyan
Write-Host '  1. Open (or refresh: Ctrl+F5) the Harness web page.'
Write-Host '  2. The tab favicon shows a neutral dot; it turns light green when a'
Write-Host '     session finished while you were away, and light blue while a'
Write-Host '     session waits for your choice.'
Write-Host '  If the instance does not hot-reload user patches, restart `dsh web` once.'
