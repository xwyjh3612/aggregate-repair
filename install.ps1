$ErrorActionPreference = "Stop"

if ($PSVersionTable.PSVersion.Major -lt 7) {
    $pwsh = Get-Command pwsh.exe -ErrorAction SilentlyContinue
    if ($pwsh -and $pwsh.Source) {
        & $pwsh.Source -NoProfile -ExecutionPolicy Bypass -File $PSCommandPath
        exit $LASTEXITCODE
    }
}

$pluginPath = $PSScriptRoot
if (-not (Test-Path -LiteralPath (Join-Path $pluginPath "middleware.mjs") -PathType Leaf)) {
    throw "找不到插件文件：$pluginPath"
}

function Find-Magpie {
    $candidates = [System.Collections.Generic.List[string]]::new()
    Get-Process -ErrorAction SilentlyContinue |
        Where-Object { $_.ProcessName -match '^magpie' -and $_.Path -and $_.Path -match 'magpie.*\.exe$' } |
        Sort-Object StartTime |
        ForEach-Object { $candidates.Add($_.Path) }
    $onPath = Get-Command magpie -ErrorAction SilentlyContinue
    if ($onPath -and $onPath.Source) { $candidates.Add($onPath.Source) }
    $common = @(
        "D:\Users\Administrator\Downloads\magpie-windows-amd64.exe",
        (Join-Path $env:USERPROFILE "Downloads\magpie-windows-amd64.exe"),
        (Join-Path $env:LOCALAPPDATA "Programs\magpie\magpie.exe"),
        (Join-Path $env:LOCALAPPDATA "magpie\magpie.exe"),
        (Join-Path $env:ProgramFiles "magpie\magpie.exe")
    )
    foreach ($path in $common) {
        if ($path -and (Test-Path -LiteralPath $path -PathType Leaf)) { $candidates.Add($path) }
    }
    return $candidates | Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Leaf) } | Select-Object -Unique -First 1
}

$magpie = Find-Magpie
if (-not $magpie) { throw "没有找到 Magpie。请先打开一次 Magpie。" }

Write-Host "Magpie: $magpie"
Write-Host "插件:   $pluginPath"
Write-Host "正在安装渠道会话修复中间件……"

& $magpie plugin add $pluginPath | Out-Host

$options = @{
    middleware = @{
        enabled = $true
        providers = @("*")
        models = @()
        mode = "safe"
        dropItemReferences = $false
        stripPreviousResponseId = $false
        stripConversation = $false
    }
} | ConvertTo-Json -Compress -Depth 8

& $magpie plugin options $pluginPath $options | Out-Host
Start-Sleep -Milliseconds 500
& $magpie plugin add $pluginPath | Out-Host
Start-Sleep -Seconds 1

Write-Host ""
Write-Host "安装成功。" -ForegroundColor Green
Write-Host "插件页：插件 → 已安装 → 渠道会话修复"
Write-Host "设置页：左侧“插件”分组中的“渠道会话修复”"
Write-Host "Codex、PPBind 和现有渠道配置均未修改。"
