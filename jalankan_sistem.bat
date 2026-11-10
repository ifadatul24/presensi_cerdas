@echo off
chcp 65001 >nul
title Presensi Cerdas Launcher
color 0b

echo ======================================================================
echo           MEMULAI SISTEM PRESENSI CERDAS (MULTI-PLATFORM)
echo ======================================================================
echo.

:: Pindah ke direktori script ini berada
cd /d "%~dp0"

echo [1/3] Menjalankan Server Backend API (Port 4000)...
start "Presensi Cerdas - Backend API (Port 4000)" cmd /k "cd backend && npm run dev"

echo [2/3] Menunggu Backend siap...
timeout /t 4 /nobreak >nul

echo [3/3] Menjalankan Web Dashboard (Port 3000)...
start "Presensi Cerdas - Web Dashboard (Port 3000)" cmd /k "cd web && npm run dev"

echo.
echo ======================================================================
echo   Membuka Browser ke: http://localhost:3000
echo ======================================================================
timeout /t 3 /nobreak >nul
start http://localhost:3000

echo.
echo Server Backend dan Web Frontend sekarang aktif!
echo JANGAN TUTUP jendela terminal hitam yang baru muncul.
echo.
pause
