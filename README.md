# LearnTrack Pro

A cloud-backed personal learning tracker built for Vercel + Supabase. It imports public YouTube playlists, embeds lessons, tracks actual player time while the tab is visible, and keeps study data in Postgres instead of browser storage.

## Stack
- Next.js App Router
- Supabase Auth + Postgres + Row Level Security
- YouTube Data API v3
- Vercel

## 1. Supabase
Create a Supabase project, open SQL Editor, and run `supabase.sql`.

Enable Email auth. For the easiest personal setup, you can disable email confirmation in Supabase Auth settings. Otherwise sign-up will ask the user to confirm their email.

## 2. Environment variables
Create `.env.local` locally, or add these in Vercel Project Settings → Environment Variables:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
YOUTUBE_API_KEY=...
```

Never commit `.env.local`. Never put a Supabase secret/service-role key in browser code. Supabase recommends the publishable key for client applications with RLS and server-side clients for protected server operations.

## 3. GitHub + Vercel
Push this repository to GitHub. Import the repository into Vercel. Add the three environment variables for Production, Preview, and Development, then deploy.

## 4. Supabase redirect URL
In Supabase Auth → URL Configuration, set:
- Site URL: your Vercel URL
- Redirect URL: `https://YOUR-VERCEL-DOMAIN/auth/callback`

For local development also add `http://localhost:3000/auth/callback`.

## YouTube API
The app does not put the YouTube API key in GitHub. `/api/youtube/import` reads `YOUTUBE_API_KEY` on the server and calls YouTube Data API v3. It imports all playlist pages and then retrieves video durations in batches.

## Verification
Install dependencies with `npm install`, then run `npm run build`. This repository is designed for the current Next.js App Router + Supabase SSR pattern.
