# 🔐 Supabase Google OAuth Setup Guide

## Step-by-Step Instructions

### **1. Get Google OAuth Credentials**

#### A. Go to Google Cloud Console
1. Visit: https://console.cloud.google.com/
2. Select your project (or create new one)
3. Go to **APIs & Services** → **Credentials**

#### B. Create OAuth 2.0 Client ID
1. Click **"Create Credentials"** → **"OAuth client ID"**
2. Application type: **"Web application"**
3. Name: `InstaVEO - Supabase Auth`

#### C. Add Authorized Redirect URIs

**For Production**:
```
https://<your-project-ref>.supabase.co/auth/v1/callback
```

**For Local Development**:
```
http://localhost:54321/auth/v1/callback
```

**Example**:
```
https://abcdefghijklmn.supabase.co/auth/v1/callback
http://localhost:54321/auth/v1/callback
```

4. Click **"Create"**
5. **Copy the Client ID and Client Secret** (you'll need these next)

---

### **2. Configure Supabase**

#### A. Go to Supabase Dashboard
1. Visit: https://supabase.com/dashboard
2. Select your project
3. Go to **Authentication** → **Providers** (left sidebar)

#### B. Enable Google Provider
1. Scroll to **Google** provider
2. Toggle it **ON** (enable)

#### C. Add Credentials
1. Paste **Client ID** from Google Console
2. Paste **Client Secret** from Google Console
3. Click **"Save"**

#### D. (Optional) Add Scopes
By default, Supabase requests:
- `openid`
- `email`
- `profile`

If you want additional Google scopes, add them in the **"Scopes"** field:
```
openid email profile https://www.googleapis.com/auth/userinfo.email
```

---

### **3. Update Frontend Environment Variables**

Create or update `apps/web/.env.local`:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>

# Backend API
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**Where to find Supabase credentials**:
1. Supabase Dashboard → **Settings** → **API**
2. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Project API keys** → **anon/public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

### **4. Test the Setup**

#### A. Start Frontend
```bash
cd apps/web
npm run dev
```

#### B. Test Sign-In
1. Visit: `http://localhost:3000/auth`
2. Click **"Continue with Google"**
3. Should redirect to Google sign-in
4. Complete sign-in
5. Should redirect back to `/feed`

#### C. Verify User Created
1. Go to Supabase Dashboard
2. **Authentication** → **Users**
3. Should see new user with Google provider

---

### **5. Common Issues & Solutions**

#### **Error: "redirect_uri_mismatch"**
**Problem**: Redirect URI doesn't match Google Console

**Solution**:
1. Check Supabase project URL is correct
2. Ensure `/auth/v1/callback` is added in Google Console
3. URI must match **exactly** (case-sensitive, no trailing slash)

**Example Error**:
```
Error 400: redirect_uri_mismatch
The redirect URI in the request: https://xyz.supabase.co/auth/v1/callback
does not match the ones authorized for the OAuth client.
```

**Fix**: Add the exact URI shown in error to Google Console

---

#### **Error: "invalid_request" or "unauthorized_client"**
**Problem**: Client ID or Secret is incorrect

**Solution**:
1. Double-check Client ID in Supabase matches Google Console
2. Verify Client Secret (no extra spaces)
3. Make sure you're using the **Web Application** OAuth client

---

#### **Sign-in works but user not in Supabase**
**Problem**: Supabase not creating user records

**Solution**:
1. Check **Authentication** → **Providers** → Google is **enabled**
2. Verify email confirmation is disabled (Settings → Authentication)
3. Check browser console for errors

---

#### **Infinite redirect loop**
**Problem**: OAuth callback not handling session correctly

**Solution**:
1. Clear browser cookies for `localhost`
2. Check frontend `.env.local` has correct Supabase URL
3. Verify `apps/web/src/app/auth/callback/page.tsx` exists
4. Restart Next.js dev server

---

### **6. Security Best Practices**

#### A. Environment Variables
- ✅ **Never commit** `.env.local` to git
- ✅ Add `.env*.local` to `.gitignore`
- ✅ Use different credentials for dev/prod

#### B. OAuth Consent Screen
1. Go to Google Console → **OAuth consent screen**
2. Set **User type**: External
3. Add your app name, logo, privacy policy
4. Add test users (during development)

#### C. Scopes
- ✅ Only request scopes you need
- ✅ Explain why you need each scope
- ✅ Users can revoke access anytime

---

## 📋 Quick Checklist

### **Google Cloud Console**:
- [ ] OAuth 2.0 Client ID created
- [ ] Redirect URI added: `https://<project>.supabase.co/auth/v1/callback`
- [ ] Local redirect URI added: `http://localhost:54321/auth/v1/callback`
- [ ] Client ID and Secret copied

### **Supabase Dashboard**:
- [ ] Google provider enabled
- [ ] Client ID pasted
- [ ] Client Secret pasted
- [ ] Configuration saved

### **Frontend**:
- [ ] `NEXT_PUBLIC_SUPABASE_URL` set in `.env.local`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` set in `.env.local`
- [ ] `NEXT_PUBLIC_API_URL` set to backend URL
- [ ] Dev server restarted

### **Testing**:
- [ ] Sign-in button appears on `/auth`
- [ ] Google OAuth flow works
- [ ] User created in Supabase
- [ ] Redirects to `/feed` after sign-in

---

## 🎯 Architecture Diagram

```
User clicks "Continue with Google"
           ↓
Frontend: signInWithGoogle()
           ↓
Supabase: Initiates OAuth flow
           ↓
Google: Shows consent screen
           ↓
User: Authorizes
           ↓
Google: Redirects to Supabase callback
           ↓
Supabase: Creates session + user record
           ↓
Frontend: /auth/callback receives code
           ↓
Frontend: exchangeCodeForSession()
           ↓
Supabase: Returns session tokens
           ↓
Frontend: Stores session in localStorage
           ↓
Frontend: Redirects to /feed
           ↓
Backend: Creates Profile on first API call
```

---

## 🔗 Useful Links

- **Supabase Auth Docs**: https://supabase.com/docs/guides/auth
- **Google OAuth Setup**: https://support.google.com/cloud/answer/6158849
- **Supabase Google Auth Guide**: https://supabase.com/docs/guides/auth/social-login/auth-google

---

## ✨ Done!

Your Google authentication is now set up! Users can sign in with one click and get a unique user ID automatically. 🎉
