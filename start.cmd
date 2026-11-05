@echo off
setlocal
cd /d %~dp0
set NODE=%~dp0..\runtime\node-v24.22.2-win-x64\node.exe
if not exist "%NODE%" set NODE=node
"%NODE%" index.js
echo.
echo Bot to'xtadi. Xato xabarini yuqoridan o'qing.
pause
