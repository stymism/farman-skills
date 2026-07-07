@echo off
chcp 65001 >nul
echo ============================================
echo   plaud new-PC setup (one click / safe to re-run)
echo ============================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-newpc.ps1"
echo.
pause
