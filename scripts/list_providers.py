import os, requests
from pathlib import Path

for line in Path(__file__).parent.joinpath('.env').read_text().splitlines():
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, v = line.split('=', 1)
        os.environ.setdefault(k.strip(), v.strip())

key = os.environ.get('PRINTIFY_API_KEY', '')
headers = {'Authorization': f'Bearer {key}'}

for blueprint_id, label in [(555, 'Stretched Canvas'), (494, 'Giclee Art Print'), (804, 'Fine Art Posters')]:
    print(f"\n-- {label} (blueprint {blueprint_id}) --")
    r = requests.get(
        f'https://api.printify.com/v1/catalog/blueprints/{blueprint_id}/print_providers.json',
        headers=headers
    )
    r.raise_for_status()
    for p in r.json():
        print(f"  provider_id={p['id']:>4}  {p['title']}")
