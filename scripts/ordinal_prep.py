"""
ordinal_prep.py
ASMR — Art Splash Marketing Resource

Polls Supabase for artwork that has completed Printify processing,
converts the original PNG to an inscription-optimized JPEG, uploads it
back to Supabase Storage, and hands off to Zoide for minting.

Minting target : ASMR in-house minter (lib/bsv/inscribe.ts)
  After this script prepares and uploads the JPEG, the
  /api/mint/inscribe API route handles on-chain inscription.
  Trigger that route via cron or server action after ordinal_prep completes.

PLACEHOLDERS are marked with:  <<PLACEHOLDER: description>>
Replace every placeholder before running.

Shared env vars (already set if printify_pipeline.py is configured):
  SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_BUCKET, SUPABASE_TABLE
"""

import io
import os
import json
import time
import requests
from datetime import datetime
from PIL import Image

# ──────────────────────────────────────────────
#  CONFIGURATION
# ──────────────────────────────────────────────

SUPABASE_URL    = os.getenv("SUPABASE_URL",          "<<PLACEHOLDER: your Supabase project URL, e.g. https://xyzxyz.supabase.co>>")
SUPABASE_KEY    = os.getenv("SUPABASE_SERVICE_KEY",  "<<PLACEHOLDER: your Supabase service role key>>")
SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET",       "<<PLACEHOLDER: your Storage bucket name, e.g. artwork-originals>>")
SUPABASE_TABLE  = os.getenv("SUPABASE_TABLE",        "artwork")

# JPEG quality — 85 is the right starting point for print-quality source files.
# The script steps down automatically if the file is over JPEG_MAX_BYTES.
JPEG_QUALITY  = int(os.getenv("JPEG_QUALITY",   "85"))
JPEG_MAX_BYTES = int(os.getenv("JPEG_MAX_BYTES", str(400 * 1024)))  # 400 kb default

# ──────────────────────────────────────────────
#  MINTING
#  Inscription is handled by the in-house minter at /api/mint/inscribe.
#  This script prepares the JPEG and writes it to Supabase Storage.
#  After this script sets status='ordinal_ready', a cron/trigger calls
#  POST /api/mint/inscribe with the artwork ID to complete inscription.
# ──────────────────────────────────────────────

MINT_ENDPOINT = os.getenv("MINT_ENDPOINT", "<<PLACEHOLDER: e.g. https://asmrtists.ca/api/mint/inscribe>>")
CRON_SECRET   = os.getenv("CRON_SECRET",   "<<PLACEHOLDER: same value as CRON_SECRET in .env.local>>")

# ──────────────────────────────────────────────
#  SUPABASE HELPERS
# ──────────────────────────────────────────────

def sb_headers():
    return {
        "apikey":        SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type":  "application/json",
        "Prefer":        "return=representation",
    }

def get_ready_artwork():
    """
    Fetch artwork that is:
      - status = 'printify_complete'  (Printify pipeline finished)
      - jpeg_storage_path IS NULL     (not yet JPEG-prepped)

    This two-condition query means re-running the script is safe —
    it won't re-process artwork whose JPEG was already uploaded.
    """
    url = (
        f"{SUPABASE_URL}/rest/v1/{SUPABASE_TABLE}"
        f"?status=eq.printify_complete"
        f"&jpeg_storage_path=is.null"
        f"&select=*"
    )
    r = requests.get(url, headers=sb_headers())
    r.raise_for_status()
    return r.json()

def get_jpeg_ready_artwork():
    """
    Separately: fetch artwork that has a JPEG but no inscription yet.
    Useful for a manual retry run after Zoide credentials are added.
    """
    url = (
        f"{SUPABASE_URL}/rest/v1/{SUPABASE_TABLE}"
        f"?status=eq.printify_complete"
        f"&jpeg_storage_path=not.is.null"
        f"&inscription_txid=is.null"
        f"&select=*"
    )
    r = requests.get(url, headers=sb_headers())
    r.raise_for_status()
    return r.json()

def update_artwork(artwork_id, fields):
    """Patch arbitrary fields on an artwork row."""
    fields["updated_at"] = datetime.utcnow().isoformat()
    url = f"{SUPABASE_URL}/rest/v1/{SUPABASE_TABLE}?id=eq.{artwork_id}"
    r = requests.patch(url, headers=sb_headers(), json=fields)
    r.raise_for_status()

def download_png(storage_path):
    """Download the original PNG from Supabase Storage. Returns raw bytes."""
    url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{storage_path}"
    r = requests.get(url, headers=sb_headers())
    r.raise_for_status()
    return r.content

def upload_jpeg(jpeg_bytes, jpeg_path):
    """
    Upload converted JPEG to Supabase Storage.
    Uses x-upsert so re-running the script is safe.
    """
    url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{jpeg_path}"
    r = requests.post(
        url,
        headers={
            "apikey":        SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type":  "image/jpeg",
            "x-upsert":      "true",
        },
        data=jpeg_bytes,
    )
    if not r.ok:
        raise RuntimeError(f"JPEG upload failed: {r.status_code} {r.text}")
    print(f"  ✓ Uploaded JPEG — {len(jpeg_bytes):,} bytes → /{jpeg_path}")

def jpeg_public_url(jpeg_path):
    """Return the public URL for a file in Supabase Storage."""
    return f"{SUPABASE_URL}/storage/v1/object/public/{SUPABASE_BUCKET}/{jpeg_path}"

# ──────────────────────────────────────────────
#  JPEG CONVERSION
# ──────────────────────────────────────────────

def png_to_jpeg(png_bytes, quality=JPEG_QUALITY, max_bytes=JPEG_MAX_BYTES):
    """
    Convert PNG bytes → JPEG bytes optimized for ordinal inscription.

    - Flattens alpha/transparency channel onto white background
      (JPEG format does not support transparency)
    - Iteratively reduces quality in steps of 5 until file is under max_bytes
    - Returns (jpeg_bytes, final_quality, final_size_bytes)
    """
    img = Image.open(io.BytesIO(png_bytes))

    # Flatten alpha onto white background
    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        if img.mode == "P":
            img = img.convert("RGBA")
        background = Image.new("RGB", img.size, (255, 255, 255))
        background.paste(img, mask=img.split()[-1])
        img = background
    elif img.mode != "RGB":
        img = img.convert("RGB")

    # Step down quality until under size target
    for q in range(quality, 49, -5):
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=q, optimize=True, progressive=True)
        data = buf.getvalue()
        if len(data) <= max_bytes:
            print(f"  ✓ JPEG: quality={q}, size={len(data):,} bytes ({len(data)//1024}kb)")
            return data, q, len(data)

    # Last resort: save at quality 50 and warn
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=50, optimize=True, progressive=True)
    data = buf.getvalue()
    print(
        f"  ⚠ JPEG at q=50 is {len(data):,} bytes — over the {max_bytes//1024}kb target.\n"
        f"     Consider downscaling the source PNG before upload.\n"
        f"     Inscription will proceed but may cost more sat/byte."
    )
    return data, 50, len(data)

def jpeg_path_from_png(png_path):
    """
    Derive JPEG storage path from the original PNG path.
    e.g.  artists/uuid/my-rainbow.png
       →  artists/uuid/my-rainbow_ordinal.jpg
    """
    base = png_path.rsplit(".", 1)[0]
    return f"{base}_ordinal.jpg"

# ──────────────────────────────────────────────
#  MINTING TRIGGER — calls in-house /api/mint/inscribe
#  Input:  artwork row dict
#  Output: dict with keys — txid (str|None), outpoint (str|None)
# ──────────────────────────────────────────────

def trigger_in_house_minter(artwork):
    """
    Trigger the in-house BSV minter via the Next.js API route.

    POST /api/mint/inscribe
      { artworkId: "<uuid>" }
      Header: x-cron-secret: <CRON_SECRET>

    The route downloads the JPEG from Supabase Storage, builds the
    1Sat Ordinals inscription script via @bsv/sdk, signs, and broadcasts.
    Returns: { txid, outpoint } on success.

    If MINT_ENDPOINT is not configured, logs the artwork ID and returns None —
    the API route can be triggered manually or via Vercel cron instead.
    """
    artwork_id = artwork["id"]

    if "PLACEHOLDER" in MINT_ENDPOINT or "PLACEHOLDER" in CRON_SECRET:
        print(f"  ⏸  Mint endpoint not configured — JPEG is ready in Supabase Storage.")
        print(f"     Trigger manually: POST {MINT_ENDPOINT} with artworkId={artwork_id}")
        return {"txid": None, "outpoint": None}

    r = requests.post(
        MINT_ENDPOINT,
        headers={
            "x-cron-secret": CRON_SECRET,
            "Content-Type": "application/json",
        },
        json={"artworkId": artwork_id},
        timeout=60,
    )
    if not r.ok:
        raise RuntimeError(f"In-house minter error: {r.status_code} {r.text}")

    data     = r.json()
    txid     = data.get("txid")
    outpoint = data.get("outpoint")

    if not txid:
        raise RuntimeError(f"Minter returned no txid. Full response: {data}")

    print(f"  ✓ Inscribed on-chain — txid: {txid}")
    return {"txid": txid, "outpoint": outpoint}

# ──────────────────────────────────────────────
#  MAIN PIPELINE
# ──────────────────────────────────────────────

def process_artwork(artwork, skip_jpeg=False):
    """
    Full ordinal prep for one artwork row.

    skip_jpeg=True  → artwork already has a JPEG in storage (retry mode),
                      skip straight to the Zoide handoff.
    """
    artwork_id   = artwork["id"]
    storage_path = artwork.get("storage_path")
    title        = artwork.get("title", artwork_id)

    print(f"\n[{artwork_id}] {title}")

    if not storage_path and not skip_jpeg:
        print("  ✗ No storage_path — skipping.")
        update_artwork(artwork_id, {"status": "error", "error_message": "missing storage_path"})
        return

    try:
        if skip_jpeg:
            # JPEG already exists — pull path from DB and go straight to minting
            jpeg_path = artwork.get("jpeg_storage_path")
            if not jpeg_path:
                raise RuntimeError("skip_jpeg=True but jpeg_storage_path is empty in DB")
            print(f"  → Using existing JPEG: {jpeg_path}")
        else:
            # 1. Download PNG
            print("  → Downloading PNG...")
            png_bytes = download_png(storage_path)
            print(f"  ✓ Downloaded {len(png_bytes):,} bytes")

            # 2. Convert
            print("  → Converting PNG → JPEG...")
            jpeg_bytes, quality, jpeg_size = png_to_jpeg(png_bytes)

            # 3. Upload JPEG
            jpeg_path = jpeg_path_from_png(storage_path)
            print(f"  → Uploading JPEG...")
            upload_jpeg(jpeg_bytes, jpeg_path)

            # 4. Save JPEG path to DB now — even if minting fails we won't re-convert
            update_artwork(artwork_id, {
                "jpeg_storage_path": jpeg_path,
                "ordinal_metadata": json.dumps({
                    "jpeg_quality":   quality,
                    "jpeg_size":      jpeg_size,
                    "jpeg_url":       jpeg_public_url(jpeg_path),
                    "minting_target": "in-house",
                }),
            })

        # 5. Trigger in-house minter
        print("  → Triggering in-house BSV minter...")
        result = trigger_in_house_minter(artwork)

        # 6. Write final status
        if result["txid"]:
            # Pull existing ordinal_metadata and add mint result
            existing_meta = json.loads(artwork.get("ordinal_metadata") or "{}")
            existing_meta["mint_result"] = result
            update_artwork(artwork_id, {
                "inscription_txid":     result["txid"],
                "inscription_outpoint": result["outpoint"],
                "status":               "minted",
                "ordinal_metadata":     json.dumps(existing_meta),
            })
            print(f"  ✓ Complete — status set to 'minted'")
        else:
            # JPEG is ready but inscription is manual / pending
            # Status stays 'printify_complete' — jpeg_storage_path is now populated,
            # so get_ready_artwork() won't pick it up again on the next run.
            print(f"  ⏸  JPEG stored. Awaiting manual Zoide inscription.")
            print(f"     Run with --retry-inscriptions to re-attempt once credentials are set.")

    except Exception as e:
        print(f"  ✗ ERROR: {e}")
        update_artwork(artwork_id, {"status": "error", "error_message": str(e)})


def run(retry_inscriptions=False):
    print("=== ASMR Ordinal Prep Pipeline ===")
    print(f"Supabase  : {SUPABASE_URL}")
    print(f"JPEG max  : {JPEG_MAX_BYTES // 1024}kb  |  Starting quality: {JPEG_QUALITY}")
    print(f"Minting   : In-house minter (lib/bsv/inscribe.ts via /api/mint/inscribe)")
    print()

    if retry_inscriptions:
        # Re-attempt inscription for artwork that already has a JPEG but no txid
        print("── Retry mode: attempting inscription for JPEG-ready artwork ──")
        artworks = get_jpeg_ready_artwork()
        if not artworks:
            print("No JPEG-ready artwork awaiting inscription.")
            return
        print(f"Found {len(artworks)} artwork(s) to retry inscription.")
        for artwork in artworks:
            process_artwork(artwork, skip_jpeg=True)
            time.sleep(0.3)
    else:
        # Normal run: convert + inscribe anything that just finished Printify
        artworks = get_ready_artwork()
        if not artworks:
            print("No printify_complete artwork found. Nothing to do.")
            return
        print(f"Found {len(artworks)} artwork(s) ready for ordinal prep.")
        for artwork in artworks:
            process_artwork(artwork)
            time.sleep(0.3)

    print("\n=== Pipeline complete ===")


if __name__ == "__main__":
    import sys
    retry = "--retry-inscriptions" in sys.argv
    run(retry_inscriptions=retry)
