@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo   Git Instructor - 启动开发服务器
echo ========================================
echo.

if not exist "node_modules" (
  echo 正在安装依赖...
  call npm install
  if errorlevel 1 (
    echo.
    echo 依赖安装失败，请检查网络或 Node.js 环境。
    pause
    exit /b 1
  )
  echo.
)

echo 正在启动 Vite 开发服务器...
echo 请在浏览器打开: http://localhost:5173/
echo （若端口被占用，以终端显示的地址为准）
echo 按 Ctrl+C 可停止服务器。
echo.
call npm run dev
pause
