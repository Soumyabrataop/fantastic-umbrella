# 🚀 QUICK START - 3 Steps to Fix Everything

## Step 1: Update Google Cloud Console ☁️
1. Go to: https://console.cloud.google.com/apis/credentials
2. Click your OAuth 2.0 Client ID
3. **Add this redirect URI:**
   ```
   http://localhost:8000/auth/google/callback
   ```
4. Save

## Step 2: Restart Backend 🔄
```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

## Step 3: Restart Frontend 🔄
```bash
cd apps/web
npm run dev
```

## ✅ Test It!
1. Go to `http://localhost:3000/auth` → Sign in with Google
2. Go to `http://localhost:3000/create` → Connect Drive
3. Enter prompt → Generate video
4. Video uploaded to your Drive! 🎉

---

## 🔍 What Was Fixed:
- ✅ Routes changed from `/api/auth/google/*` → `/auth/google/*`
- ✅ Frontend updated to call correct endpoints
- ✅ CORS enabled for localhost:3000
- ✅ Environment variables configured
- ✅ All compilation errors resolved

## 📚 Full Docs:
- `FINAL_SETUP_SUMMARY.md` - Complete guide
- `ROUTES_FIXED.md` - Route changes explained
- `READY_TO_TEST.md` - Testing instructions
