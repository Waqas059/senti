# Senti: Hetzner to Vercel + Supabase migration

## What's in this folder

- `backend/` — your original FastAPI code (main.py, listener.py, google_reviews.py, review_sources.py, send_alert.py), untouched except App.js's API base URL (see below)
- `frontend/` — your original React app
- `api/index.py` — thin wrapper that lets Vercel run the FastAPI backend as a serverless function, mounted at `/api`
- `api/cron/listener.py` — replaces the old `scheduler.py` infinite loop with a single-run endpoint that Vercel Cron hits once an hour
- `database/sentidb_backup.sql` — full dump of your production database (5 users, 3 businesses, 3339 mentions, plus competitor/agent data)
- `SECRETS_reference.txt` — your real API keys pulled from the old server, for pasting into Vercel's dashboard. Delete after use, never commit it.
- `.env.example` — same keys, no values, safe to commit

## Step 1: Set up Supabase

1. In your Supabase account, create a new project (or pick an existing empty one).
2. Once it's ready, go to Project Settings -> Database -> Connection string, copy the URI (it looks like `postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres`).
3. Restore your data into it. From a terminal with `psql` installed:
   ```
   psql "postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres" < database/sentidb_backup.sql
   ```
   (Supabase also has a SQL editor in their dashboard if you'd rather paste it there, though for a 2.8MB file the command line is easier.)
4. Keep that connection string, it becomes your `DATABASE_URL`.

## Step 2: Push this code to GitHub

Create a new repo (can be private) and push this whole folder to it. `.gitignore` is already set up to keep `node_modules`, `.env`, and the secrets file out.

## Step 3: Import into Vercel

1. In Vercel, "Add New Project", import the GitHub repo.
2. Vercel should auto-detect the config from `vercel.json` (Create React App build, Python functions under `/api`).
3. Before the first deploy, add environment variables (Project Settings -> Environment Variables). Use `SECRETS_reference.txt` for the values:
   - `DATABASE_URL` (your new Supabase URI from Step 1, NOT the old localhost one)
   - `SECRET_KEY`
   - `GROQ_API_KEY`, `GROQ_MODEL`
   - `RESEND_API_KEY`
   - `GOOGLE_PLACES_API_KEY`
   - `SERPAPI_KEY`
   - `CRON_SECRET` (make one up, any random string, then the cron endpoint is protected)
4. Deploy.

## Step 4: Verify

- Visit your new Vercel URL, the React app should load and hit `/api/...` for data.
- Try logging in with an existing account from the old database.
- Check Vercel's Functions/Logs tab after the top of the next hour to confirm `/api/cron/listener` ran successfully.

## Things worth knowing about this move

**The background scheduler changed shape, not behavior.** The old `scheduler.py` was a process that stayed running forever and re-checked reviews every hour. Vercel doesn't support long-running processes, so that loop is gone. Instead, `vercel.json` configures a Cron Job that hits `/api/cron/listener` once an hour, which runs the exact same `run_listener_with_google()` function from your original `listener.py`, just triggered externally instead of by an internal loop. Net effect for users: identical, still runs hourly.

**Execution time limits are the one real risk.** Vercel serverless functions have a max run time (10s on the free Hobby plan, up to 300s on Pro if you raise it, which `vercel.json` already requests for the cron function). Your listener loops through every business and calls Reddit, Google Places, App Store, Play Store, Trustpilot, and Groq for each one, sequentially. With 3 businesses today this is probably fine, but if you add a lot more businesses later, it's worth checking Vercel's function logs to make sure the cron run finishes before the time limit, and upgrading the plan or splitting the work across more frequent smaller runs if it starts timing out.

**A few `.env` keys were already unused.** `ANTHROPIC_API_KEY`, `REDDIT_CLIENT_ID`/`SECRET`, and `SENDGRID_API_KEY` were sitting in the old `.env` as placeholders or leftovers, the code doesn't actually call Anthropic or SendGrid, and Reddit mentions come from a public RSS feed with no auth needed. Left them out of the required env var list above, add them back if you build something that needs them later.

**Two other projects were on that same Hetzner box** (`food_bot`, `grocery`, `grocery_ua`, `ksa_bot` were sitting in `/opt` alongside `senti`). Those weren't touched or backed up as part of this, since you asked specifically about Senti. Let me know if you want those pulled off the snapshot too before it's forgotten about (the snapshot itself is still sitting safely in your Hetzner account, not deleted, only the temporary server we spun up from it was removed).
