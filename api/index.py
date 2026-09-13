"""
Vercel entrypoint for the Senti backend.

This file does not contain any app logic itself. It imports the original,
untouched FastAPI app from backend/main.py and mounts it under /api, which
is the path prefix Vercel routes to this function. Nothing inside
backend/main.py needed to change for this to work.
"""
import os
import sys

# Make backend/ importable (it sits one level up from this file's directory)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from fastapi import FastAPI
from main import app as senti_app  # noqa: E402  (original app, unchanged)

app = FastAPI()
app.mount("/api", senti_app)
