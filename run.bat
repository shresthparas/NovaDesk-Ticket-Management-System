@echo off
echo ===========================================
echo   Ticket Management System - Startup Script
echo ===========================================

echo.
echo [1/2] Starting Backend Services with Docker...
cd backend
docker-compose up -d
cd ..

echo.
echo [2/2] Starting Frontend Server...
cd frontend
start "Frontend Server" cmd /k "npm install && npm run dev"
cd ..

echo.
echo ===========================================
echo Everything is up and running!
echo Frontend Dashboard: http://localhost:5173
echo Backend API Docs: http://localhost:8090/docs
echo ===========================================
echo.
echo Press any key to exit this window...
pause >nul
