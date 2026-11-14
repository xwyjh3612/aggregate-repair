@echo off
setlocal
chcp 65001 >nul
title 渠道切换修复 · Responses 400
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" %*
set "INSTALL_EXIT_CODE=%errorlevel%"
echo.
pause
exit /b %INSTALL_EXIT_CODE%
