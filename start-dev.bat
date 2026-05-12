@echo off
powershell -ExecutionPolicy Bypass -File "%~dp0start-dev.ps1"
if errorlevel 1 pause
