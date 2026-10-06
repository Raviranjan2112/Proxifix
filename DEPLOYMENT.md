# ProxiFix Deployment Guide

ProxiFix consists of three parts:
1. **Frontend:** React 19 + Vite SPA (located in `frontend/location-app`)
2. **Backend:** Express API + Socket.io (located in `backend`)
3. **Database:** PostgreSQL with the **PostGIS** spatial extension (scripts in `database/init`)

---

## 🌟 Option 1: Cloud Deployment (Recommended & Free)

Deploy your database, backend, and frontend to cloud providers so your app is online 24/7.

### Step 1: Push Code to GitHub

In your PowerShell terminal from `D:\certificate\proxifix`:

```powershell
git init
git add .
git commit -m "Initial commit for online deployment"
git branch -M main
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/proxifix.git
git push -u origin main
```

*(Note: `.env` files are automatically ignored and will not be pushed to GitHub.)*

---

### Step 2: Create Free PostGIS Database (Supabase or Neon)

Because ProxiFix uses PostGIS spatial queries (`CREATE EXTENSION postgis`), you need a PostgreSQL provider that supports PostGIS. Both have generous free tiers:

#### Recommended: Supabase (Free Tier includes PostGIS)
1. Sign up at [supabase.com](https://supabase.com) and create a **New Project**.
2. Set a database password and select your closest region.
3. In your Supabase Project:
   - Go to **Project Settings** > **Database**.
   - Under **Connection String**, copy the **URI** (or Pooled URI on port 5432/6543).
   - Go to **Database** > **Extensions**, search for `postgis` and toggle it **ON** (or run `CREATE EXTENSION IF NOT EXISTS postgis;` in the SQL Editor).

---

### Step 3: Deploy the Backend API on Render

1. Sign up at [render.com](https://render.com) and click **New +** > **Web Service**.
2. Connect your GitHub repository (`proxifix`).
3. Fill in the service details:
   - **Name:** `proxifix-api`
   - **Root Directory:** `backend`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free
4. Add the **Environment Variables**:
   - `NODE_ENV`: `production`
   - `DATABASE_URL`: *(Paste your Supabase or PostgreSQL connection string)*
   - `DATABASE_SSL`: `true`
   - `JWT_ACCESS_SECRET`: *(A random 32+ character string)*
   - `JWT_ACCESS_EXPIRES_IN`: `7d`
   - `CORS_ORIGIN`: `*` *(or your Vercel URL once deployed)*
5. Click **Create Web Service**.
6. **Run Migrations & Setup**: Once deployed, open the Render **Shell** tab for `proxifix-api` and run:
   ```bash
   npm run migrate
   ```
   *(Creates tables, enum types, and spatial indexes)*

   *Optional: Seed demo workers to test searching immediately:*
   ```bash
   npm run seed
   ```

   *Optional: Create a production admin account:*
   ```bash
   npm run create-admin
   # Creates admin@proxifix.com with password Admin@12345
   ```
7. Note down your API URL (e.g., `https://proxifix-api.onrender.com`).

---

### Step 4: Deploy the Frontend on Vercel

1. Sign up at [vercel.com](https://vercel.com) and click **Add New** > **Project**.
2. Import your GitHub repository (`proxifix`).
3. In the project settings:
   - **Framework Preset:** `Vite`
   - **Root Directory:** Click "Edit" and choose `frontend/location-app`.
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Expand **Environment Variables** and add:
   - `VITE_API_URL`: `https://proxifix-api.onrender.com/api` *(replace with your actual Render API URL)*
5. Click **Deploy**.
6. When deployment finishes, Vercel gives you your live URL (e.g. `https://proxifix.vercel.app`).

---

### Step 5: Secure CORS on the Backend

1. In Render, go to `proxifix-api` > **Environment**.
2. Update `CORS_ORIGIN`:
   ```text
   CORS_ORIGIN=https://proxifix.vercel.app
   ```
3. Save changes (Render will automatically redeploy).

---

## ⚡ Option 2: Instant Public URL from Localhost (Cloudflare Tunnel)

If you just want to immediately share the app running on your machine with others via a public HTTPS link:

1. Start your local database and backend:
   ```powershell
   # In backend directory
   npm run start:public
   ```
   *(This builds the React app and serves both frontend and API on http://localhost:4000)*
2. In a separate terminal, run Cloudflare Tunnel or ngrok:
   ```powershell
   # Using npx without installing anything permanently:
   npx cloudflared tunnel --url http://localhost:4000
   ```
   or using ngrok:
   ```powershell
   npx ngrok http 4000
   ```
3. The command outputs a live public URL (e.g. `https://random-words.trycloudflare.com`) accessible from anywhere!
