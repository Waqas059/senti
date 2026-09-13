"""
Vercel Cron entrypoint that replaces the old scheduler.py infinite loop.

The original server ran scheduler.py as a permanently-running process that
called listener.run_listener_with_google() once at startup, then again every
hour, forever. Vercel has no long-running processes, so instead Vercel Cron
hits this endpoint once an hour (configured in vercel.json), and each hit
runs the listener exactly once, then the function exits.

The actual review-fetching / sentiment-analysis logic in backend/listener.py
was NOT changed, only how it gets triggered.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "backend"))

from fastapi import FastAPI, Header, HTTPException  # noqa: E402

app = FastAPI()


@app.get("/")
@app.get("")
def run_cron(authorization: str = Header(default="")):
    # Vercel Cron can be configured to send a secret bearer token so this
    # endpoint can't be triggered by anyone who finds the URL. Set CRON_SECRET
    # as a Vercel environment variable to turn this check on; leave it unset
    # during initial testing if you'd rather skip it for now.
    secret = os.getenv("CRON_SECRET")
    if secret and authorization != f"Bearer {secret}":
        raise HTTPException(status_code=401, detail="Unauthorized")

    from listener import run_listener_with_google

    run_listener_with_google()
    return {"status": "ok"}
