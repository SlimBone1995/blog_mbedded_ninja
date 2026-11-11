@echo off
chcp 65001 >nul
cd /d "%~dp0"

if not exist "dist\zh\index.html" (
  echo 未找到构建产物，正在构建，请稍候...
  call npm run build
  if errorlevel 1 (
    echo 构建失败，请查看上面的错误信息。
    pause
    exit /b 1
  )
)

echo 正在启动中文站预览...
start "" "http://localhost:4321/zh/"
call npm run preview
pause
