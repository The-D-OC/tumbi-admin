# Tumbi Admin

A small **local-only** web tool for adding and editing baby classes in the Tumbi
Supabase database, with full field validation so bad data can't get in.

- ✅ Every field validated (required fields, UK postcode, phone, email, URLs, age
  ranges, coordinate ranges, schedule times). The form won't save until it's all valid.
- 📍 "Find coordinates" button geocodes the address via OpenStreetMap — no
  hand-typing latitude/longitude.
- ✏️ Add, edit, delete, and search existing classes.

## Setup (one time)

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy the env template and fill it in:
   ```bash
   cp .env.example .env
   ```
   From the Supabase dashboard → **Project Settings → API**, copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **`service_role`** secret key → `VITE_SUPABASE_SERVICE_KEY`

3. Run it:
   ```bash
   npm run dev
   ```
   Open the printed `http://127.0.0.1:5177` in your browser.

## ⚠️ Security — local use only

This tool uses the Supabase **service_role** key, which **bypasses all Row Level
Security**. That's what lets it write to the `classes` table with no login. It is
safe *only* because it runs on your machine.

- **Never deploy this** to a public host.
- **Never commit `.env`** (it's gitignored) or share the key.
- If you ever want a hosted version, switch to a login + an admin RLS policy and
  use the anon key instead.

## How it maps to the app

Writes go straight to the same `classes` table the Tumbi mobile app reads. New
classes appear in the app once `is_active` is on (and on the home rail if
`is_featured`). Categories and schedule day names match what the app expects.
