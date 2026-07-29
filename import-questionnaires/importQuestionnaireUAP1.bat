@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Import du questionnaire UAP 1 (fichier UAP1.xlsx)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0import_questionnaire.ps1" -Uap 1
echo.
pause
