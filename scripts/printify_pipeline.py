"""
printify_pipeline.py
ASMRtists.ca — Polls Supabase for pending artwork, uploads to Printify image
library, creates Canvas / Giclee / Fine-Art Poster products, and logs results.
"""

import os
import sys
import json
import time
import base64
import requests
from datetime import datetime
from pathlib import Path

# Load .env from the same directory as this script
_env_path = Path(__file__).parent / ".env"
if _env_path.exists():
    for _line in _env_path.read_text().splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _v = _line.split("=", 1)
            os.environ.setdefault(_k.strip(), _v.strip())

# ──────────────────────────────────────────────
#  CONFIGURATION — loaded from scripts/.env
# ──────────────────────────────────────────────

SUPABASE_URL     = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY     = os.environ.get("SUPABASE_SERVICE_KEY", "")
SUPABASE_BUCKET  = os.environ.get("SUPABASE_BUCKET", "artwork-originals")
SUPABASE_TABLE   = os.environ.get("SUPABASE_TABLE", "artwork")
PRINTIFY_API_KEY  = os.environ.get("PRINTIFY_API_KEY", "")
# Support a single PRINTIFY_SHOP_ID or a comma-separated PRINTIFY_SHOP_IDS
_shop_ids_raw = os.environ.get("PRINTIFY_SHOP_IDS") or os.environ.get("PRINTIFY_SHOP_ID", "")
PRINTIFY_SHOP_IDS = [s.strip() for s in _shop_ids_raw.split(",") if s.strip()]

# ──────────────────────────────────────────────
#  PRINT PROVIDER IDs (resolved via catalog API)
# ──────────────────────────────────────────────

PROVIDERS = {
    "canvas": {
        "blueprint_id":      555,   # Stretched Canvas
        "print_provider_id": 69,    # Prodigi
    },
    "poster": {
        "blueprint_id":      804,   # Fine Art Posters
        "print_provider_id": 72,    # Print Clever
    },
    "photo": {
        "blueprint_id":      494,   # Giclee Art Print
        "print_provider_id": 36,    # Print Pigeons
    },
}

ASMR_COMMISSION_PCT = float(os.environ.get("ASMR_COMMISSION_PCT", "30"))

# ──────────────────────────────────────────────
#  HELPERS — Supabase
# ──────────────────────────────────────────────

def sb_headers():
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }

def get_pending_artwork():
    """Fetch artwork rows ready for pipeline: uploaded or stalled mid-run."""
    url = (
        f"{SUPABASE_URL}/rest/v1/{SUPABASE_TABLE}"
        f"?status=in.(uploaded,shop_pending)"
        f"&select=*,artist_profiles(stage_name)"
    )
    r = requests.get(url, headers=sb_headers())
    r.raise_for_status()
    return r.json()

def update_artwork_status(artwork_id, status, extra_fields=None):
    from datetime import timezone
    payload = {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}
    if extra_fields:
        payload.update(extra_fields)
    url = f"{SUPABASE_URL}/rest/v1/{SUPABASE_TABLE}?id=eq.{artwork_id}"
    r = requests.patch(url, headers=sb_headers(), json=payload)
    if not r.ok:
        print(f"  ! Status update failed ({r.status_code}): {r.text}")

def get_shopify_handle(shop_id, printify_product_id):
    """Fetch the Shopify product handle (slug only) from Printify after publish."""
    import time as _time
    # Printify needs a moment to sync the handle back from Shopify
    _time.sleep(3)
    r = requests.get(
        f"{PRINTIFY_BASE}/shops/{shop_id}/products/{printify_product_id}.json",
        headers=pfy_headers(),
    )
    if not r.ok:
        print(f"  ! Could not fetch product {printify_product_id}: {r.status_code}")
        return None
    data = r.json()
    raw = (data.get("external") or {}).get("handle")
    if not raw:
        print(f"  ! No Shopify handle yet for {printify_product_id} — will be null")
        return None
    # Printify returns the full URL or just the slug depending on version — normalise to slug only
    handle = raw.rstrip("/").split("/")[-1]
    print(f"  + Shopify handle: {handle}")
    return handle

def save_print_product(artwork_id, product_type, printify_product_id, printify_image_id, shopify_handle=None):
    """Save a Printify product record to the print_products table."""
    from datetime import timezone
    payload = {
        "artwork_id":            artwork_id,
        "product_type":          product_type,
        "printify_product_id":   printify_product_id,
        "printify_image_id":     printify_image_id,
        "status":                "published",
        "published_at":          datetime.now(timezone.utc).isoformat(),
    }
    if shopify_handle:
        payload["shopify_product_handle"] = shopify_handle
    url = f"{SUPABASE_URL}/rest/v1/print_products"
    headers = {**sb_headers(), "Prefer": "resolution=merge-duplicates,return=minimal"}
    r = requests.post(url, headers=headers, json=payload)
    if not r.ok:
        print(f"  ! Failed to save print_product ({product_type}): {r.status_code} {r.text}")

def download_from_supabase(file_path):
    """Download a file from Supabase Storage. file_path = artwork.storage_path"""
    url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{file_path}"
    r = requests.get(url, headers=sb_headers())
    r.raise_for_status()
    return r.content

# ──────────────────────────────────────────────
#  HELPERS — Printify
# ──────────────────────────────────────────────

PRINTIFY_BASE = "https://api.printify.com/v1"

def pfy_headers():
    return {
        "Authorization": f"Bearer {PRINTIFY_API_KEY}",
        "Content-Type": "application/json",
    }

PRINTIFY_MAX_BYTES = 20 * 1024 * 1024  # 20 MB safe limit

def compress_image(image_bytes, filename):
    """Compress image to JPEG if it exceeds the Printify upload limit."""
    try:
        from PIL import Image as PILImage
        import io
        img = PILImage.open(io.BytesIO(image_bytes)).convert("RGB")
        # Scale down if very large
        max_dim = 8000
        if max(img.size) > max_dim:
            img.thumbnail((max_dim, max_dim), PILImage.LANCZOS)
        out = io.BytesIO()
        quality = 92
        while True:
            out.seek(0); out.truncate()
            img.save(out, format="JPEG", quality=quality, optimize=True)
            if out.tell() <= PRINTIFY_MAX_BYTES or quality < 60:
                break
            quality -= 5
        compressed = out.getvalue()
        print(f"  * Compressed {len(image_bytes):,} -> {len(compressed):,} bytes (q={quality})")
        return compressed, filename.rsplit('.', 1)[0] + '.jpg'
    except ImportError:
        raise RuntimeError("Pillow is required to compress large images: pip install Pillow")

def upload_image_to_printify(image_bytes, filename):
    if len(image_bytes) > PRINTIFY_MAX_BYTES:
        print(f"  * Image is {len(image_bytes):,} bytes — compressing before upload...")
        image_bytes, filename = compress_image(image_bytes, filename)

    b64 = base64.b64encode(image_bytes).decode("utf-8")
    r = requests.post(
        f"{PRINTIFY_BASE}/uploads/images.json",
        headers=pfy_headers(),
        json={"file_name": filename, "contents": b64},
    )
    if not r.ok:
        raise RuntimeError(f"Printify image upload failed: {r.status_code} {r.text}")
    data = r.json()
    print(f"  + Uploaded to Printify image library — id: {data['id']}")
    return data["id"]

def get_variants(blueprint_id, print_provider_id):
    url = (
        f"{PRINTIFY_BASE}/catalog/blueprints/{blueprint_id}"
        f"/print_providers/{print_provider_id}/variants.json"
    )
    r = requests.get(url, headers=pfy_headers())
    r.raise_for_status()
    return r.json().get("variants", [])

def build_product_payload(artwork, product_type, printify_image_id):
    cfg = PROVIDERS[product_type]
    blueprint_id      = cfg["blueprint_id"]
    print_provider_id = cfg["print_provider_id"]

    artist_info  = artwork.get("artist_profiles") or {}
    artist_name  = artist_info.get("stage_name") or "Unknown Artist"
    title        = artwork.get("title") or "Untitled"
    description  = artwork.get("description") or ""

    type_label = {"canvas": "Canvas Print", "poster": "Fine Art Poster", "photo": "Giclee Print"}[product_type]

    all_variants = get_variants(blueprint_id, print_provider_id)
    variants = [
        {
            "id": v["id"],
            "price": v.get("cost", 2000) + int(v.get("cost", 2000) * ASMR_COMMISSION_PCT / 100),
            "is_enabled": True,
        }
        for v in all_variants
        if v.get("is_available", True)
    ]

    if not variants:
        raise RuntimeError(f"No available variants for {product_type} blueprint {blueprint_id}")

    print_areas = [
        {
            "variant_ids": [v["id"] for v in variants],
            "placeholders": [
                {
                    "position": "front",
                    "images": [
                        {
                            "id": printify_image_id,
                            "x": 0.5,
                            "y": 0.5,
                            "scale": 1.0,
                            "angle": 0,
                        }
                    ],
                }
            ],
        }
    ]

    return {
        "title":             f"{title} - {type_label} by {artist_name}",
        "description":       (
            f"{description}\n\n"
            f"Original artwork by {artist_name}. "
            f"Fulfilled by ASMRtists.ca. "
            f"A portion of every sale is paid directly to the artist in MNEE."
        ),
        "blueprint_id":      int(blueprint_id),
        "print_provider_id": int(print_provider_id),
        "variants":          variants,
        "print_areas":       print_areas,
    }

def create_printify_product(shop_id, artwork, product_type, printify_image_id):
    payload = build_product_payload(artwork, product_type, printify_image_id)
    r = requests.post(
        f"{PRINTIFY_BASE}/shops/{shop_id}/products.json",
        headers=pfy_headers(),
        json=payload,
    )
    if not r.ok:
        raise RuntimeError(f"Printify product creation failed ({product_type}): {r.status_code} {r.text}")
    product_id = r.json()["id"]
    print(f"  + Created {product_type} product in shop {shop_id} — Printify id: {product_id}")
    return product_id

def publish_product(shop_id, product_id):
    r = requests.post(
        f"{PRINTIFY_BASE}/shops/{shop_id}/products/{product_id}/publish.json",
        headers=pfy_headers(),
        json={
            "title":       True,
            "description": True,
            "images":      True,
            "variants":    True,
            "tags":        True,
        },
    )
    if not r.ok:
        print(f"  ! Publish returned {r.status_code}: {r.text} (may need manual publish in Printify)")
    else:
        print(f"  + Published product {product_id} in shop {shop_id}")

# ──────────────────────────────────────────────
#  MAIN PIPELINE
# ──────────────────────────────────────────────

def process_artwork(artwork):
    artwork_id   = artwork["id"]
    storage_path = artwork.get("storage_path")
    title        = artwork.get("title", artwork_id)

    print(f"\n[{artwork_id}] Processing: {title}")

    if not storage_path:
        print("  ! No storage_path — skipping")
        update_artwork_status(artwork_id, "error", {"error_message": "No storage_path"})
        return

    try:
        update_artwork_status(artwork_id, "shop_pending")

        print("  -> Downloading from Supabase Storage...")
        image_bytes = download_from_supabase(storage_path)
        filename    = storage_path.split("/")[-1]
        print(f"  + Downloaded {len(image_bytes):,} bytes")

        print("  -> Uploading to Printify image library...")
        printify_image_id = upload_image_to_printify(image_bytes, filename)

        # The Shopify shop ID (last in the list) is the canonical one for print_products
        shopify_shop_id = PRINTIFY_SHOP_IDS[-1]

        for shop_id in PRINTIFY_SHOP_IDS:
            print(f"\n  [shop {shop_id}]")
            for product_type in ("canvas", "poster", "photo"):
                print(f"  -> Creating {product_type} product...")
                pid = create_printify_product(shop_id, artwork, product_type, printify_image_id)
                publish_product(shop_id, pid)
                # Save to print_products using the Shopify shop as the canonical record
                if shop_id == shopify_shop_id:
                    shopify_handle = get_shopify_handle(shop_id, pid)
                    save_print_product(artwork_id, product_type, pid, printify_image_id, shopify_handle)
                time.sleep(0.5)

        update_artwork_status(artwork_id, "shop_ready", {"printify_image_id": printify_image_id})
        print(f"  + All done for: {title}")

    except Exception as e:
        print(f"  ! ERROR: {e}")
        update_artwork_status(artwork_id, "error", {"error_message": str(e)[:500]})


def run():
    print("=== ASMRtists Printify Pipeline ===")
    print(f"Supabase: {SUPABASE_URL}")
    print()

    if not PRINTIFY_SHOP_IDS:
        print("ERROR: PRINTIFY_SHOP_ID is not set in scripts/.env")
        sys.exit(1)

    print(f"Shops   : {', '.join(PRINTIFY_SHOP_IDS)}")

    artworks = get_pending_artwork()
    if not artworks:
        print("No pending artwork found (status='uploaded'). Nothing to do.")
        return

    print(f"Found {len(artworks)} pending artwork(s).")
    for artwork in artworks:
        process_artwork(artwork)

    print("\n=== Pipeline complete ===")


def sync_handles_from_printify():
    """
    Fetch every product from Printify, match to artwork by title, and upsert
    print_products rows with the correct shopify_product_handle.
    Run with:  python printify_pipeline.py --sync
    """
    if not PRINTIFY_SHOP_IDS:
        print("ERROR: PRINTIFY_SHOP_ID not set"); return
    shop_id = PRINTIFY_SHOP_IDS[-1]

    # 1. Fetch all artwork rows from Supabase (we need title + id)
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/artwork?select=id,title,collection_id&order=title",
        headers=sb_headers(),
    )
    r.raise_for_status()
    artworks = {a["title"].lower(): a for a in r.json()}
    print(f"Loaded {len(artworks)} artwork(s) from Supabase")

    # 2. Page through all Printify products
    page, per_page, matched = 1, 100, 0
    type_map = {
        "canvas print": "canvas",
        "fine art poster": "poster",
        "giclee print": "photo",
    }

    while True:
        resp = requests.get(
            f"{PRINTIFY_BASE}/shops/{shop_id}/products.json?page={page}",
            headers=pfy_headers(),
        )
        resp.raise_for_status()
        data = resp.json()
        products = data.get("data", [])
        if not products:
            break

        for product in products:
            raw_handle = (product.get("external") or {}).get("handle") or ""
            printify_id = product.get("id", "")
            title_full = product.get("title", "")

            # Normalise handle to slug only
            handle = raw_handle.rstrip("/").split("/")[-1] if raw_handle else ""
            if not handle:
                continue

            # Match product type from title  e.g. "AlchemyBow #1 - Canvas Print by Chef MyKLove"
            product_type = None
            for label, ptype in type_map.items():
                if f"- {label.title()}" in title_full or f"- {label}" in title_full.lower():
                    product_type = ptype
                    break
            if not product_type:
                continue

            # Extract artwork title  (everything before " - Canvas Print …")
            artwork_title_raw = title_full.split(" - ")[0].strip().lower()
            artwork = artworks.get(artwork_title_raw)
            if not artwork:
                print(f"  ? No artwork match for: {title_full!r}")
                continue

            # Upsert print_products row
            payload = {
                "artwork_id":            artwork["id"],
                "product_type":          product_type,
                "printify_product_id":   printify_id,
                "printify_image_id":     None,
                "status":                "published",
                "shopify_product_handle": handle,
            }
            patch_r = requests.post(
                f"{SUPABASE_URL}/rest/v1/print_products",
                headers={**sb_headers(), "Prefer": "resolution=merge-duplicates,return=minimal", "on-conflict": "artwork_id,product_type"},
                json=payload,
            )
            if patch_r.ok:
                print(f"  + {product_type:8} → {handle}  ({artwork['title']})")
                matched += 1
            else:
                print(f"  ! Upsert failed for {title_full!r}: {patch_r.status_code} {patch_r.text[:120]}")

        if len(products) < per_page:
            break
        page += 1
        time.sleep(0.3)

    print(f"\nSync complete — {matched} print_products row(s) upserted.")


def backfill_shopify_handles():
    """
    One-time backfill: fetch the Shopify handle from Printify for every
    print_products row that has a printify_product_id but no shopify_product_handle.
    Run with:  python printify_pipeline.py --backfill
    """
    import time as _time
    if not PRINTIFY_SHOP_IDS:
        print("ERROR: PRINTIFY_SHOP_ID not set"); return
    shop_id = PRINTIFY_SHOP_IDS[-1]

    # Fetch rows missing the handle
    url = (
        f"{SUPABASE_URL}/rest/v1/print_products"
        f"?shopify_product_handle=is.null"
        f"&printify_product_id=not.is.null"
        f"&select=id,artwork_id,product_type,printify_product_id"
    )
    r = requests.get(url, headers=sb_headers())
    r.raise_for_status()
    rows = r.json()
    print(f"Found {len(rows)} print_products row(s) missing shopify_product_handle")

    for row in rows:
        pid = row["printify_product_id"]
        print(f"  -> Fetching handle for printify product {pid} ({row['product_type']})...")
        resp = requests.get(
            f"{PRINTIFY_BASE}/shops/{shop_id}/products/{pid}.json",
            headers=pfy_headers(),
        )
        if not resp.ok:
            print(f"  ! {resp.status_code} — skipping"); _time.sleep(0.5); continue
        handle = (resp.json().get("external") or {}).get("handle")
        if not handle:
            print(f"  ! No handle returned — skipping"); _time.sleep(0.5); continue
        # Normalise: Printify may return full URL or just the slug
        handle = handle.rstrip("/").split("/")[-1]
        # Patch the row
        patch = requests.patch(
            f"{SUPABASE_URL}/rest/v1/print_products?id=eq.{row['id']}",
            headers=sb_headers(),
            json={"shopify_product_handle": handle},
        )
        if patch.ok:
            print(f"  + Updated → {handle}")
        else:
            print(f"  ! Patch failed: {patch.status_code} {patch.text}")
        _time.sleep(0.5)

    print("Backfill complete.")


if __name__ == "__main__":
    import sys
    if "--sync" in sys.argv:
        sync_handles_from_printify()
    elif "--backfill" in sys.argv:
        backfill_shopify_handles()
    else:
        run()
