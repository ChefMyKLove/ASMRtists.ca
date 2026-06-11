"""
migrate_ordinal_listings.py
Creates the public.ordinal_listings table in Supabase.

Requires DATABASE_URL in scripts/.env  (postgres://... connection string)
If you don't have psycopg2, paste migrations/001_create_ordinal_listings.sql
directly into the Supabase dashboard → SQL Editor instead.

Run from the scripts/ directory:
    pip install psycopg2-binary
    python migrate_ordinal_listings.py
"""
import os, sys
from pathlib import Path

# Load .env
for line in Path(__file__).parent.joinpath('.env').read_text().splitlines():
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, v = line.split('=', 1)
        os.environ.setdefault(k.strip(), v.strip())

DATABASE_URL = os.environ.get('DATABASE_URL') or os.environ.get('SUPABASE_DB_URL')

if not DATABASE_URL:
    print('DATABASE_URL not found in .env')
    print('→ Paste scripts/migrations/001_create_ordinal_listings.sql into')
    print('  the Supabase dashboard SQL Editor instead.')
    sys.exit(1)

try:
    import psycopg2
except ImportError:
    print('psycopg2 not installed. Run: pip install psycopg2-binary')
    print('→ Or paste scripts/migrations/001_create_ordinal_listings.sql into')
    print('  the Supabase dashboard SQL Editor.')
    sys.exit(1)

SQL = Path(__file__).parent / 'migrations' / '001_create_ordinal_listings.sql'
sql = SQL.read_text()

print('Connecting to database...')
conn = psycopg2.connect(DATABASE_URL)
conn.autocommit = True
cur = conn.cursor()

print('Running migration...')
try:
    cur.execute(sql)
    print('SUCCESS — ordinal_listings table created.')
    print('PostgREST schema cache notified.')
except Exception as e:
    print(f'ERROR: {e}')
    conn.close()
    sys.exit(1)

# Verify
cur.execute("""
    select count(*) from information_schema.tables
    where table_schema = 'public' and table_name = 'ordinal_listings'
""")
exists = cur.fetchone()[0]
conn.close()

if exists:
    print('\nVerified: public.ordinal_listings exists in the database.')
    print('Go to /ordinals and list HummingBow #1 — it should work now.')
else:
    print('\nWARNING: Table not found after migration. Check Supabase logs.')
    sys.exit(1)
