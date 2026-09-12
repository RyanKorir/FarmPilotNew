# FarmPilot

A Kenya-focused farm management web app for small-scale farmers — livestock tracking, health records, production, inventory, finance, AI assistant, and weather forecasting.

## Stack

React 19 · TypeScript · Vite 6 · Tailwind v4 · Supabase (Postgres + Auth + Realtime) · Gemini AI · Vercel

## Quick Deploy (Vercel)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/RyanKorir/FarmPilotNew)

1. Click the button above or go to [vercel.com](https://vercel.com) → New Project → Import `FarmPilotNew`
2. Add these environment variables:

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon/public key |
| `VITE_GEMINI_API_KEY` | Your Google Gemini API key |

3. Click **Deploy** — done.

## Run Locally

```bash
npm install
cp .env.example .env.local   # fill in your keys
npm run dev
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_GEMINI_API_KEY=your-gemini-key
```

## Project Structure

```
├── api/
│   └── weather.ts          # Vercel serverless function (weather proxy)
├── src/
│   ├── components/         # All UI components
│   ├── context/            # React context (FarmContext)
│   ├── lib/
│   │   ├── supabaseClient.ts   # Supabase client
│   │   ├── supabaseAuth.ts     # Auth (mirrors Firebase API)
│   │   └── firestoreShim.ts    # Firestore→Supabase query shim
│   ├── services/
│   │   └── weatherService.ts
│   ├── utils/
│   └── types.ts
├── vercel.json             # Vercel configuration
└── vite.config.ts
```

## Supabase Setup

Run the migration SQL in your Supabase SQL Editor to create all required tables with RLS policies. See `supabase_migration.sql`.
