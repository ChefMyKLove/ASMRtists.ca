import os, requests
from pathlib import Path

for line in Path(__file__).parent.joinpath('.env').read_text().splitlines():
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, v = line.split('=', 1)
        os.environ.setdefault(k.strip(), v.strip())

key = os.environ.get('PRINTIFY_API_KEY', '')
if not key:
    print("ERROR: PRINTIFY_API_KEY not found in scripts/.env")
    exit(1)

r = requests.get(
    'https://api.printify.com/v1/catalog/blueprints.json',
    headers={'Authorization': f'Bearer {key}'}
)
r.raise_for_status()

for b in r.json():
    title = b['title'].lower()
    if any(t in title for t in ('canvas', 'poster', 'print', 'photo', 'fine art', 'fine-art')):
        print(f"  id={b['id']:>4}  {b['title']}")
