# Lumiere Patient Feedback System

Bilingual (AR/EN) patient feedback and case-resolution app for 10 clinic branches.
Next.js 14 + Supabase, mobile-first for both the patient form and the admin dashboard.

## Deploy

1. **Supabase** — create a free project at https://supabase.com, then in **SQL Editor**
   paste and run the whole of `supabase/schema.sql`. It creates the tables, the
   `voice-notes` storage bucket, and seeds 10 branches × 3 locations.
2. **Keys** — Supabase → *Project Settings → API*: copy the **Project URL** and the
   **`service_role`** key.
3. **Deploy**

   ```bash
   npm i -g vercel && npm install && vercel --prod
   ```

4. **Environment variables** — in Vercel → *Settings → Environment Variables* add every
   key from `.env.example`: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `ADMIN_USER=admin`, `ADMIN_PASS` (pick a strong one),
   `SESSION_SECRET` (32+ random characters), and `NEXT_PUBLIC_BASE_URL` set to the
   deployed URL. Optional: `RESEND_API_KEY` + `ALERT_EMAIL_TO` for new-case emails.
   Redeploy so the values take effect: `vercel --prod`.
5. **Sign in** — open `https://<your-app>.vercel.app/admin` and log in as
   `admin` and the password you set in step 4.
6. **Print the QR codes** — *QR* tab → **Print all posters** → print to A5, or open a
   single location and use **Download PNG**. Each poster carries its own branch and room.

Patients reach the form at `/f/BR01?loc=REC` — no login. Local development:
`npm install && npm run dev` with the same variables in a `.env.local`.

## Password recovery

The admin password is changed at `/admin/settings` and stored hashed in the
`app_settings` table, which overrides `ADMIN_PASS`. If it is ever lost, delete the
`admin_password_hash` row from `app_settings` in the Supabase table editor — the
`ADMIN_PASS` value from the deployment applies again at once, with no redeploy.
