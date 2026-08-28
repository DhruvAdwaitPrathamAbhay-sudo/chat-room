# Veil — Google OAuth Setup Guide

This guide details how to configure **Google OAuth** in the Google Cloud Console and Supabase Dashboard for Veil authentication.

---

## 1. Google Cloud Console Setup

### Step 1: Create or Select a Google Cloud Project
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project named **Veil** (or select an existing project).

### Step 2: Configure OAuth Consent Screen
1. Navigate to **APIs & Services > OAuth consent screen**.
2. Select User Type: **External** and click **Create**.
3. Fill in the App Information:
   - **App name**: `Veil`
   - **User support email**: Your email address
   - **Developer contact information**: Your email address
4. Under **Authorized domains**, add:
   - `supabase.co`
   - `vercel.app`
   - `chat-room-tan-gamma.vercel.app`
5. Scopes: Select `.../auth/userinfo.email` and `.../auth/userinfo.profile`.
6. Save and continue.

### Step 3: Create OAuth 2.0 Client Credentials
1. Navigate to **APIs & Services > Credentials**.
2. Click **Create Credentials > OAuth client ID**.
3. Application type: **Web application**.
4. Name: `Veil Web Client`.
5. **Authorized JavaScript origins**:
   - Local: `http://localhost:3000`
   - Production: `https://chat-room-tan-gamma.vercel.app`
   - Supabase project URL: `https://bszconnkzzsnvlauvkga.supabase.co`
6. **Authorized redirect URIs**:
   - Supabase callback URL (found in your Supabase Auth Providers dashboard):
     `https://bszconnkzzsnvlauvkga.supabase.co/auth/v1/callback`
7. Click **Create**.
8. Copy the **Client ID** and **Client Secret**.

---

## 2. Supabase Dashboard Configuration

### Step 1: Enable Google Provider
1. Open your [Supabase Project Dashboard](https://supabase.com/dashboard/project/bszconnkzzsnvlauvkga).
2. Navigate to **Authentication > Providers > Google**.
3. Toggle **Enable Google provider** to ON.
4. Enter the credentials obtained from Google Cloud:
   - **Client ID**: `[YOUR_GOOGLE_CLIENT_ID].apps.googleusercontent.com`
   - **Client Secret**: `[YOUR_GOOGLE_CLIENT_SECRET]`
5. Click **Save**.

### Step 2: Configure URL Configuration & Redirect URLs
1. Navigate to **Authentication > URL Configuration**.
2. Set **Site URL**:
   - For local development: `http://localhost:3000`
   - Or production: `https://chat-room-tan-gamma.vercel.app`
3. Add to **Redirect URLs (Allow list)**:
   - `http://localhost:3000/**`
   - `http://localhost:3000/auth/callback`
   - `https://chat-room-tan-gamma.vercel.app/**`
   - `https://chat-room-tan-gamma.vercel.app/auth/callback`
4. Click **Save**.

---

## 3. Environment Variables

In your local `.env` and Vercel project environment settings:

```env
NEXT_PUBLIC_SUPABASE_URL=https://bszconnkzzsnvlauvkga.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[YOUR_SUPABASE_ANON_KEY]
NEXT_PUBLIC_SITE_URL=http://localhost:3000 # On Vercel: https://chat-room-tan-gamma.vercel.app
```

> [!IMPORTANT]
> Never commit `GOOGLE_CLIENT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, or `DATABASE_URL` to GitHub. The frontend client only requires the public anon key and URL.
