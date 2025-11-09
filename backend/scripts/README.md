# InstaVEO Health Check Scripts

This directory contains scripts to test and verify that InstaVEO services are running correctly.

## Scripts Overview

### Python Scripts

- **`health_check.py`** - Tests backend API endpoints
  - Video feed API
  - API documentation
  - Basic connectivity

- **`check_db.py`** - Tests database connectivity and schema
  - Connection test
  - Table existence check
  - Video count query

- **`check_frontend.py`** - Tests Next.js frontend accessibility
  - HTTP connectivity
  - Response validation

- **`check_all.py`** - Runs all health checks
  - Comprehensive service validation
  - Summary report

### Shell Scripts

- **`test_api.sh`** (Linux/Mac) - Quick curl-based API testing
- **`test_api.bat`** (Windows) - Quick curl-based API testing

## Usage

### Quick Test
```bash
# Test all services
python scripts/check_all.py

# Test specific service
python scripts/health_check.py
python scripts/check_db.py
python scripts/check_frontend.py

# Quick API test
./scripts/test_api.sh
./scripts/test_api.bat
```

### Manual Testing
```bash
# Test backend feed API
curl http://localhost:8001/api/v1/videos/feed

# Test frontend
curl http://localhost:3000
```

## Exit Codes

- `0` - All tests passed
- `1` - Some tests failed

## Configuration

Scripts use these default URLs:
- Backend: `http://localhost:8001`
- Frontend: `http://localhost:3000`

Modify the scripts if your services run on different ports.