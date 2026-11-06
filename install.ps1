[CmdletBinding()]
param([string]$MagpiePath)

$ErrorActionPreference = "Stop"

function Find-Magpie {
    $candidates = [System.Collections.Generic.List[string]]::new()
    $onPath = Get-Command magpie -CommandType Application -ErrorAction SilentlyContinue
    if ($onPath -and $onPath.Source) { $candidates.Add($onPath.Source) }
    Get-Process -ErrorAction SilentlyContinue |
        Where-Object { $_.ProcessName -match '^magpie' -and $_.Path -and $_.Path -match 'magpie.*\.exe$' } |
        Sort-Object StartTime |
        ForEach-Object { $candidates.Add($_.Path) }
    $common = @(
        (Join-Path $env:USERPROFILE "Downloads\magpie-windows-amd64.exe"),
        (Join-Path $env:LOCALAPPDATA "Programs\magpie\magpie.com"),
        (Join-Path $env:LOCALAPPDATA "Programs\magpie\magpie.exe"),
        (Join-Path $env:LOCALAPPDATA "magpie\magpie.exe"),
        (Join-Path $env:ProgramFiles "magpie\magpie.exe")
    )
    foreach ($path in $common) {
        if ($path -and (Test-Path -LiteralPath $path -PathType Leaf)) { $candidates.Add($path) }
    }
    return $candidates | Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Leaf) } | Select-Object -Unique -First 1
}

try {
    $pluginPath = $PSScriptRoot
    foreach ($pluginFile in @("package.json", "middleware.mjs")) {
        if (-not (Test-Path -LiteralPath (Join-Path $pluginPath $pluginFile) -PathType Leaf)) {
            throw "找不到插件文件 $pluginFile。请先解压完整插件目录再安装。"
        }
    }

    if ($MagpiePath) {
        if (-not (Test-Path -LiteralPath $MagpiePath -PathType Leaf)) {
            throw "找不到指定的 Magpie：$MagpiePath"
        }
        $magpie = (Resolve-Path -LiteralPath $MagpiePath).Path
    } else {
        $magpie = Find-Magpie
    }
    if (-not $magpie) { throw "没有找到 Magpie。请先安装或打开一次 Magpie，再重新运行安装。" }

    Write-Host "Magpie: $magpie"
    Write-Host "插件:   $pluginPath"
    Write-Host "正在安装渠道会话修复中间件……"

    & $magpie plugin add $pluginPath | Out-Host
    if ($LASTEXITCODE -ne 0) {
        throw "Magpie 安装命令失败，退出码：$LASTEXITCODE。请查看上面的错误信息。"
    }

    Write-Host ""
    Write-Host "安装成功。" -ForegroundColor Green
    Write-Host "插件页：插件 → 已安装 → 渠道会话修复"
    Write-Host "设置页：左侧“插件”分组中的“渠道会话修复”"
    exit 0
} catch {
    Write-Host ("安装失败：" + $_.Exception.Message) -ForegroundColor Red
    exit 1
}
