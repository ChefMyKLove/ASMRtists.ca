"""
pipeline_server.py — FastAPI HTTP trigger for the Printify pipeline.

POST /run   { artworkId?: string }   — process one artwork or all pending
GET  /health                         — Railway health check
"""

import os
import requests as req
from fastapi import FastAPI, Header, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

import printify_pipeline as pipeline

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://www.asmrtists.ca", "https://asmrtists.ca"],
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type", "x-pipeline-secret"],
)

SECRET = os.environ.get("PIPELINE_WEBHOOK_SECRET", "")


class TriggerBody(BaseModel):
    artworkId: Optional[str] = None


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/run")
async def trigger(
    body: TriggerBody,
    background_tasks: BackgroundTasks,
    x_pipeline_secret: str = Header(default=""),
):
    if SECRET and x_pipeline_secret != SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")

    if body.artworkId:
        background_tasks.add_task(_process_single, body.artworkId)
        return {"queued": True, "artworkId": body.artworkId}

    background_tasks.add_task(pipeline.run)
    return {"queued": True, "mode": "full"}


def _process_single(artwork_id: str):
    url = (
        f"{pipeline.SUPABASE_URL}/rest/v1/{pipeline.SUPABASE_TABLE}"
        f"?id=eq.{artwork_id}&select=*,artist_profiles(stage_name)"
    )
    r = req.get(url, headers=pipeline.sb_headers())
    rows = r.json() if r.ok else []
    if not rows:
        print(f"[pipeline_server] artwork {artwork_id} not found or DB error")
        return
    pipeline.process_artwork(rows[0])
