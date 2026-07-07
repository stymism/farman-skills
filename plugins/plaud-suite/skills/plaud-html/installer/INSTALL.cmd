@echo off
chcp 65001 >nul
echo ============================================
echo   Plaud-HTML installer (portable, 1-click)
echo ============================================
echo.
echo Installing skill + config + working data...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0INSTALL.ps1"
echo.
echo ============================================
echo   Done. Please RESTART Claude Code,
echo   then run:  /plaud-html
echo ============================================
pause
