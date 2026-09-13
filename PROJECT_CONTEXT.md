# Senti — Project Context and Handoff Notes

This file exists so that any AI assistant (or human developer) picking this project up, with no prior conversation history, can understand what Senti is, how it is built, how it is deployed, what has already been fixed, and what is still broken. Keep this file updated as things change. If you are an AI reading this to help the project owner, please read the "How to work with the project owner" section near the end before doing anything else.

## 1. What Senti is

Senti is a CXM (Customer Experience Management) / brand sentiment monitoring platform. A business signs up, adds a brand or product they want to track, and Senti collects public mentions of that brand from sources like Reddit, Google Reviews, the Play Store, the App Store, and Trustpilot, then scores each mention's sentiment (positive, negative, neutral) using an AI model. The product gives the business owner a dashboard, an inbox of individual mentions they can resolve/tag/assign/reply to, analytics/breakdowns, competitor tracking, team member management, configurable alerts, and an "AI Agent" that can automatically resolve, escalate, or draft replies to mentions based on rules the owner sets.

There is also an admin view (a separate `admin@senti.app` style account) meant for whoever runs Senti itself, showing stats across all customers/businesses.

The currently-configured demo/test business is "Tim Hortons Canada," monitored across Reddit, Google Reviews, and Play Store, with roughly 1,666 real scraped mentions in the database as of this writing.

## 2. Architecture and tech stack

Originally this app ran on a Hetzner VPS. It has since been migrated to:

- **Hosting:** Vercel (serverless functions for the API, static hosting for the React frontend)
- **Database:** Supabase (managed Postgres)

Backend: Python, FastAPI, SQLAlchemy ORM, JWT auth via `python-jose`, password hashing via `passlib` + `bcrypt`, outbound HTTP calls via `httpx`. The FastAPI app lives in `backend/main.py`. On Vercel, `api/index.py` imports that FastAPI app (`from main import app as senti_app` or similar) so it can run as a serverless function. `vercel.json` handles routing so that `/api/*` requests reach the Python function and everything else is served as the React static build.

Frontend: React, built with `create-react-app`. Unusually, essentially the entire frontend UI lives in one large file, `frontend/src/App.js` (over 2,000 lines), containing all the page components (Dashboard, Inbox, Analytics, My Business, AI Analyst, AI Agent, Competitors, Team, Alerts, Settings, Admin, Login/Signup) as functions inside that same file, plus shared UI primitives (Card, MetricCard, PageHead, etc.) and a theme object (`T`). There isn't (as of this writing) a component-per-file structure, so "search `App.js` for X" is usually the right move rather than looking for a separate file.

## 3. Repository layout (on the project owner's Windows machine)

The repo lives at `C:\Users\<username>\senti-app\senti-vercel\` (username was `waxas` at time of writing). Key paths inside it:

- `backend/main.py` — the entire FastAPI backend: models, auth, all API routes.
- `api/index.py` — thin Vercel serverless entry point that imports the FastAPI app from `backend/main.py`.
- `frontend/src/App.js` — the entire React frontend.
- `vercel.json` — Vercel routing/build config.
- `requirements.txt` — Python dependencies for the Vercel Python function.

The project owner is not a developer and has very limited comfort with the command line. All edits so far have been made by having them open files in Notepad, use Find & Replace (Ctrl+H) or paste in new content, save, and then run three `git` commands from PowerShell (`git add`, `git commit -m "..."`, `git push`). Pushing to the connected branch auto-triggers a Vercel production redeploy; there is no separate staging step.

## 4. Data model (SQLAlchemy models in `backend/main.py`)

- **User** — login account (email, hashed password, role, etc.)
- **Business** — a tracked brand/company, owned by a User (e.g. "Tim Hortons Canada")
- **Mention** — a single scraped mention of a business (source, content, author, url, sentiment, sentiment_score, sentiment_reason, suggested_reply, is_resolved, tags, assigned_to, notes, topic, fetched_at, is_spam, etc.)
- **TeamMember** — a team member invited to collaborate on a Business, with a role (Owner / Manager / Agent)
- **AgentSettings** / **AgentAction** — configuration and history for the "AI Agent" automation feature (auto-resolve, auto-escalate, auto-draft-replies)
- **Competitor** / **CompetitorMention** — tracked competitor brands and their own scraped mentions, used on the Competitors page

## 5. Key API endpoints (all under `backend/main.py`, mounted at `/api/...` in production)

Auth: `POST /signup`, `POST /login`, `GET /me`

Businesses: CRUD endpoints for a business's profile, plus `GET /businesses/{business_id}/stats` (returns proper database-level totals: total, positive, negative, neutral, unresolved, sentiment_score, spike info — this one is NOT paginated and is the source of truth for totals)

Mentions: `GET /businesses/{business_id}/mentions` (supports `sentiment`, `is_resolved`, and `limit` query params — see the "limit" bug in section 7, it defaults to `limit=100` if the caller does not pass one), plus resolve/tags/assign/notes update endpoints per mention

AI: `POST /businesses/{business_id}/ai-analyst` (chat with an AI analyst about the business's mentions), `POST /suggest-keywords` — both call the Groq API

Saved replies: CRUD under a business

Admin: `/admin/stats`, `/admin/customers`, `/admin/businesses/{id}`, `/admin/users/{id}`, `/admin/ai-stats`, `/admin/spike-history`

Team: invite/update/remove endpoints (inviting a team member sends a real email via the Resend API)

AI Agent: settings and action-history endpoints

Competitors: CRUD plus mention scraping (`fetch_competitor_mentions`, which scrapes Reddit RSS and does deduplicate via an `existing_urls` set — this dedup logic does NOT currently exist for regular business `Mention` scraping, see section 8)

## 6. External services and environment variables

- **Supabase Postgres** — connection via `DATABASE_URL` env var in Vercel project settings.
- **Groq API** (`https://api.groq.com/openai/v1/chat/completions`) — used for AI Analyst chat, keyword suggestions, and sentiment analysis. Requires a Groq API key (check Vercel env vars for the exact name, likely `GROQ_API_KEY`). IMPORTANT: the model name is currently hardcoded directly in `backend/main.py` in three separate call sites (the AI Analyst endpoint, the suggest-keywords endpoint, and `analyze_sentiment_competitor()`), NOT read from an environment variable, even though a `GROQ_MODEL` env var exists in the Vercel project (it is currently unused by the code — see section 7, issue #1). If you change the model again in the future, you must edit `backend/main.py` in all three places, not just the Vercel env var.
- **Resend API** — used to send real team-invite emails. Check Vercel env vars for the API key name.
- **JWT signing secret** — used by `python-jose` for auth tokens. Check Vercel env vars for the exact name (likely `SECRET_KEY` or similar).

Always check the actual Vercel project's Environment Variables page for the authoritative current list and names; don't assume the names above are exact without verifying.

## 7. Issues found and fixed so far (in the order they were tackled)

**Issue #1 — AI features completely broken (FIXED).** Every AI feature (Ask AI, AI Analyst chat) returned "Could not connect to AI." Root cause: the Groq model `llama-3.3-70b-versatile` was hardcoded in `backend/main.py` and passed its deprecation date (Aug 16, 2026), so Groq started returning `404 Not Found`. Changing the `GROQ_MODEL` Vercel env var did nothing because the code never read that variable. Fix: replaced the hardcoded string with `openai/gpt-oss-120b` (Groq's current non-deprecated model) in all three call sites. Verified working live via the AI Analyst chat and via Vercel runtime logs showing `200 OK` from Groq.

**Issue #2 — Inbox and Analytics stats capped at 100 (FIXED, two-part bug).**
- Part A (backend): `GET /businesses/{business_id}/mentions` did not accept a `limit` query parameter at all in its function signature, so FastAPI silently ignored any `limit` the frontend sent and always used a hardcoded `.limit(100)`. Fixed by adding `limit: int = 100` to the function signature and using `.limit(limit)` in the query. This fixed the Inbox page (which does send an explicit limit when the user picks "Show: All").
- Part B (frontend): Even after the backend fix, the Analytics page (and the Dashboard's `allMentions` data) still showed totals capped at 100. Root cause: in `frontend/src/App.js`, the fetch that populates `allMentions` (`api.get(`/businesses/${business.id}/mentions`)`, no query string at all) sent no `limit` parameter, so it fell back to the backend's default of 100. Fixed by changing that call to `api.get(`/businesses/${business.id}/mentions?limit=10000`)`, matching the value already used elsewhere in the app for "show all." Verified live: Dashboard and Analytics both now show 1,666 total / 739 positive / 559 negative / 924 unresolved, matching the database exactly.
- Lesson for the future: FastAPI silently drops any query parameter a client sends if that parameter isn't declared in the endpoint's function signature. If a filter/limit/sort control in the UI doesn't seem to do anything, check that the backend endpoint actually declares that parameter.

**Issue #3 — Admin login hangs after successful authentication (NOT YET FIXED).** Logging in as `admin@senti.app` succeeds at the API level — Vercel logs confirm `POST /api/auth/login → 200` and `GET /api/auth/me → 200` — but the frontend never issues the follow-up `GET /api/businesses` call that normally happens right after login (confirmed present for the regular `safan` test account, confirmed absent for `admin`). Since the app never learns what businesses the admin owns, it never navigates away from the login screen and shows no error. This is 100% reproducible. Hypothesis: something in the frontend's post-login logic branches on the logged-in user (role, or a stale cached business id) and short-circuits before fetching businesses for this specific account. Needs investigation in `frontend/src/App.js`'s login/auth flow (search for where `/api/auth/me` succeeds and see what happens next, and compare the code path for an admin-flagged user vs. a normal business-owner user).

**Issue #4 — Duplicate Mention rows in the database (NOT YET FIXED).** Spot-checking Tim Hortons Canada's mentions found genuine exact-duplicate rows (same author, content, source, and timestamp, different IDs) — at least 10 confirmed pairs, visible as literal back-to-back duplicate cards in the Inbox and Dashboard feed. Root cause: the regular mention-scraping/ingestion code has no deduplication check, unlike `fetch_competitor_mentions` (used for the Competitors feature), which does dedupe using an `existing_urls` set. This needs (a) a one-time SQL cleanup of existing duplicates in Supabase, and (b) adding the same kind of dedup check to whatever function scrapes/ingests regular business mentions.

**Issue #5 — Some historical mentions show "Could not analyze sentiment" (NOT YET FIXED, likely low effort).** Leftover from when the Groq integration was broken. Once issue #1's fix has been live for a while, consider re-running sentiment analysis on any mention where `sentiment_reason` is "Could not analyze sentiment" or `sentiment` is null, if/when a re-analyze action exists or is added.

## 8. How deploys work / how to check if something broke

Any `git push` to the connected branch triggers an automatic Vercel production redeploy — there is no manual deploy step. To check whether a deploy succeeded or broke something:

1. Go to the Vercel dashboard → the project → Deployments, and check the latest deployment's status and build logs.
2. If the site is up but behaving strangely (e.g. login suddenly fails, or everything 500s), check that deployment's **Runtime Logs** in the Vercel dashboard — this shows real Python tracebacks, which is far more reliable than guessing from frontend symptoms. A full-app crash (e.g. a Python `SyntaxError` in `backend/main.py`) will make *every* endpoint fail, including login, which can look confusingly like a wrong-password error on the frontend when it is actually a 500.

## 9. Known gotchas when editing this codebase

- **FastAPI query parameters:** a parameter the client sends but that isn't declared in the endpoint's function signature is silently ignored, not an error. If a UI control seems to have no effect, check the backend signature first.
- **Editing `backend/main.py` or `frontend/src/App.js` via Notepad's Find & Replace (Ctrl+H):** on at least one occasion, Replace All on a long/complex string silently corrupted the surrounding text (`current_user: User = Depends(get_current_user)` became `currepends(get_current_user)`), which crashed the entire backend with a `SyntaxError` on import. Since then, the practice has been: after any Find & Replace touching a function signature or other syntax-sensitive code, use Ctrl+F to locate the changed line and have the project owner paste back the exact resulting line for verification BEFORE saving and pushing.
- **The Groq model name is hardcoded, not env-driven**, in three places in `backend/main.py` (see section 6). Don't assume changing the `GROQ_MODEL` Vercel env var does anything until the code is changed to actually read it.
- **`frontend/src/App.js` is a single very large file** containing every page. There is no separate file per page/component as of this writing.

## 10. Test/demo credentials note

During QA testing, both `admin@senti.app` and the demo business-owner account (`smartcx.support@gmail.com`, business name "Tim Hortons Canada" / display name "safan") were temporarily set to a shared password for testing purposes. These should be rotated to private passwords once issue #3 (admin login hang) is fixed and the project owner can log in as admin again to manage this properly. Do not treat any password mentioned in prior chat history as still valid without checking with the project owner first.

## 11. How to work with the project owner

The project owner is not a developer and has limited comfort with terminals, code editors, or technical jargon. When helping with this project:

- Give one explicit step at a time (exact PowerShell commands, exact "open this file / press these keys" instructions), not general advice like "just update the config."
- Don't assume they can identify code by description; give them an exact string to Ctrl+F for, or an exact Find/Replace pair to paste into Notepad's Ctrl+H dialog.
- For any risky edit (near a function signature, near syntax-sensitive code), ask them to verify the resulting line via Ctrl+F and paste it back before saving/pushing, to avoid a repeat of the Find & Replace corruption incident described in section 9.
- Prefer diagnosing from logs/data (Vercel runtime logs, direct Supabase SQL queries) over guessing from a described symptom, since the owner may not describe technical symptoms precisely.
- After any fix, verify it actually worked (via logs, direct DB queries, or live testing) rather than trusting "it looks fixed" alone.
- Keep this file updated: when you fix something or find something new, add it here so the next assistant (AI or human) doesn't have to rediscover it from scratch.