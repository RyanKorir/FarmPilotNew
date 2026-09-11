# FarmPilot

A Kenya-focused farm management web app for small-scale farmers — livestock, health, production, inventory, and finance tracking.

## Stack
React 19 + TypeScript + Vite 6 + Tailwind v4 + Supabase (Postgres + RLS) + Gemini API

## Run locally

**Prerequisites:** Node.js 20+

1. Install dependencies:
   ```
   npm install
   ```
2. Copy `.env.example` to `.env.local` and fill in your Supabase project URL/anon key (and Gemini key for AI features):
   ```
   cp .env.example .env.local
   ```
3. Run the app:
   ```
   npm run dev
   ```

## Deploy on Render

This repo includes a `render.yaml` Blueprint.

1. Push this repo to GitHub.
2. In Render, choose **New → Blueprint**, connect the repo, and Render will read `render.yaml` automatically.
3. When prompted, fill in the environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GEMINI_API_KEY`) — these are marked `sync: false` so they're never stored in the repo.
4. Deploy. Render runs `npm install && npm run build`, then `npm start`.

Alternatively, deploy manually as a Web Service without the Blueprint:
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Add the same three environment variables in the Render dashboard.
