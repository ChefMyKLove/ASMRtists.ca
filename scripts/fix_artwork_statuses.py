"""
fix_artwork_statuses.py
Repairs artwork rows stuck at 'processing' after a failed pipeline run.
- Artworks that successfully got products in Printify -> set to 'shop_ready'
- Artworks that failed (FishBow 4, ElectraBow 1) -> reset to 'uploaded' for retry
"""
import os, requests
from pathlib import Path
from datetime import datetime, timezone

for line in Path(__file__).parent.joinpath('.env').read_text().splitlines():
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, v = line.split('=', 1)
        os.environ.setdefault(k.strip(), v.strip())

SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_SERVICE_KEY']

def headers():
    return {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
    }

def patch(artwork_id, status):
    r = requests.patch(
        f'{SUPABASE_URL}/rest/v1/artwork?id=eq.{artwork_id}',
        headers=headers(),
        json={'status': status, 'updated_at': datetime.now(timezone.utc).isoformat()},
    )
    return r.ok, r.status_code, r.text

# These two failed to upload to Printify — reset so pipeline retries them
NEEDS_RETRY = {
    'eb0ebe94-8bba-4e51-b533-94f597c4279f': 'FishBow 4',
    '66955c50-be93-4053-aea6-34529042a958': 'ElectraBow 1',
}

# Fetch all artworks currently stuck at 'processing'
r = requests.get(
    f'{SUPABASE_URL}/rest/v1/artwork?status=eq.processing&select=id,title',
    headers=headers(),
)
r.raise_for_status()
stuck = r.json()

if not stuck:
    print('No artworks stuck at processing. Nothing to do.')
else:
    print(f'Found {len(stuck)} artworks at processing status:')
    for row in stuck:
        aid = row['id']
        title = row['title']
        if aid in NEEDS_RETRY:
            ok, code, text = patch(aid, 'uploaded')
            print(f'  RESET -> uploaded  [{code}]  {title}')
        else:
            ok, code, text = patch(aid, 'shop_ready')
            print(f'  SET   -> shop_ready [{code}]  {title}')
        if not ok:
            print(f'    ERROR: {text}')
