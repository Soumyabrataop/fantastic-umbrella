@echo off
REM Quick API Test Script using curl (Windows)
REM Usage: test_api.bat [endpoint]

set BACKEND_URL=http://localhost:8001
set FRONTEND_URL=http://localhost:3000

echo [CHECK] InstaVEO API Quick Test
echo ==========================

REM Default endpoint
if "%1"=="" (
    set ENDPOINT=api/v1/videos/feed
) else (
    set ENDPOINT=%1
)

echo Testing backend endpoint: %ENDPOINT%
echo URL: %BACKEND_URL%/%ENDPOINT%
echo.

REM Test backend
curl -s -w "\nStatus: %%{http_code}\nTime: %%{time_total}s\n" ^
     -H "Accept: application/json" ^
     "%BACKEND_URL%/%ENDPOINT%"

echo.
echo ==========================

REM Test frontend if no specific endpoint requested
if "%1"=="" (
    echo Testing frontend...
    curl -s -w "Status: %%{http_code}\nTime: %%{time_total}s\n" ^
         -H "Accept: text/html" ^
         "%FRONTEND_URL%" | findstr /c:"<title>"
)