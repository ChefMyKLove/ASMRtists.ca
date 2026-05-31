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
    'https://api.printify.com/v1/shops.json',
    headers={'Authorization': f'Bearer {key}'}
)
r.raise_for_status()

for shop in r.json():
    print(f"id={shop['id']}  title={shop['title']}  type={shop.get('sales_channel','')}")
