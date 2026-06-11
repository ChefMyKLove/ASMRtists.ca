"""
backfill_hummingbow_outpoint.py
One-off backfill: set inscription_outpoint on the existing HummingBow #1 artwork row
so createListingAction() can resolve it for marketplace listing.

The ordinal was minted before the app existed, so inscription_outpoint was never stored.
This script finds the row (by txid or title) and patches it.

Run from the scripts/ directory:
    python backfill_hummingbow_outpoint.py
"""
import os, sys, json, requests
from pathlib import Path
from datetime import datetime, timezone

# Load .env
for line in Path(__file__).parent.joinpath('.env').read_text().splitlines():
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, v = line.split('=', 1)
        os.environ.setdefault(k.strip(), v.strip())

SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_SERVICE_KEY']

FULL_TXID    = 'e681e0e13d14ab786884358330e8e74858758562208411f0416ff77c68bda4ee'
OUTPOINT     = f'{FULL_TXID}_0'

def hdrs():
    return {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
    }

def get(url):
    r = requests.get(url, headers=hdrs())
    r.raise_for_status()
    return r.json()

def patch(artwork_id, payload):
    r = requests.patch(
        f'{SUPABASE_URL}/rest/v1/artwork?id=eq.{artwork_id}',
        headers=hdrs(),
        json=payload,
    )
    return r.ok, r.status_code, r.text

# ── Step 1: Look up by inscription_txid ──────────────────────────────────────
print(f'Looking up artwork by inscription_txid = {FULL_TXID[:12]}...')
rows = get(f'{SUPABASE_URL}/rest/v1/artwork?inscription_txid=eq.{FULL_TXID}'
           '&select=id,title,artist_id,collection_id,inscription_txid,inscription_outpoint,status,storage_path,jpeg_storage_path')

if not rows:
    print('Not found by txid — trying title search (ilike hummingbow)...')
    rows = get(f'{SUPABASE_URL}/rest/v1/artwork?title=ilike.*hummingbow*'
               '&select=id,title,artist_id,collection_id,inscription_txid,inscription_outpoint,status,storage_path,jpeg_storage_path')

if not rows:
    print('Not found by title either — listing ALL artworks from the artist to help identify it...')
    # Try fetching artist profile for chefmyklove
    profiles = get(f'{SUPABASE_URL}/rest/v1/profiles?username=ilike.chefmyklove&select=id')
    if profiles:
        user_id = profiles[0]['id']
        artists = get(f'{SUPABASE_URL}/rest/v1/artist_profiles?user_id=eq.{user_id}&select=id')
        if artists:
            artist_id = artists[0]['id']
            all_art = get(f'{SUPABASE_URL}/rest/v1/artwork?artist_id=eq.{artist_id}'
                          '&select=id,title,inscription_txid,inscription_outpoint,status'
                          '&order=title')
            print(f'Found {len(all_art)} artworks for artist:')
            for a in all_art:
                print(f'  [{a["status"]}] {a["title"]} | txid={a["inscription_txid"]} | outpoint={a["inscription_outpoint"]}')
    print('\nCould not find HummingBow row. Manual insert may be needed.')
    sys.exit(1)

if len(rows) > 1:
    print(f'Found {len(rows)} matching rows — using first:')

row = rows[0]
print(f'\nFound artwork:')
print(f'  id         = {row["id"]}')
print(f'  title      = {row["title"]}')
print(f'  artist_id  = {row["artist_id"]}')
print(f'  collection = {row["collection_id"]}')
print(f'  txid       = {row["inscription_txid"]}')
print(f'  outpoint   = {row["inscription_outpoint"]}  (current)')
print(f'  status     = {row["status"]}')

# ── Step 2: Check if outpoint is already correct ──────────────────────────────
if row['inscription_outpoint'] == OUTPOINT:
    print(f'\ninscription_outpoint is already set to {OUTPOINT}')
    print('Nothing to change. If listing still fails, check createListingAction ownership check.')
    sys.exit(0)

# ── Step 3: Patch the row ─────────────────────────────────────────────────────
payload = {
    'inscription_txid':    FULL_TXID,
    'inscription_outpoint': OUTPOINT,
    'status':              'minted',
    'updated_at':          datetime.now(timezone.utc).isoformat(),
}

print(f'\nPatching artwork {row["id"]}...')
print(f'  inscription_outpoint -> {OUTPOINT}')
print(f'  status               -> minted')

ok, code, text = patch(row['id'], payload)
if ok:
    updated = json.loads(text)
    print(f'\nSUCCESS [{code}]')
    print(f'  outpoint now = {updated[0]["inscription_outpoint"]}')
    print(f'  status  now  = {updated[0]["status"]}')
    print('\nHummingBow is now in the ASMRtists catalog.')
    print('Go to /ordinals and list it through the UI — the catalog lookup will succeed.')
else:
    print(f'\nFAILED [{code}]: {text}')
    sys.exit(1)
