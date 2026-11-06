[CmdletBinding()]
param([string]$MagpiePath)

& (Join-Path $PSScriptRoot "install.ps1") @PSBoundParameters
exit $LASTEXITCODE
