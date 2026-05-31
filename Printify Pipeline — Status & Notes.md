---
type: dev-status
project: A.S.M.R
author: claude
updated: 2026-04-21
---

# Printify Pipeline — Status & Notes

## What This Is

`printify_pipeline.py` is the core automation script that takes artist-uploaded PNGs from Supabase Storage and stocks the ASMR Printify shop with three product types per artwork: Canvas Print, Art Print (Poster), and Photo Print. All products are published under the ASMR shop — the agent model — so individual artists never need their own Printify accounts.

## Related Files

- [[printify_pipeline.py]] — the pipeline script itself
- [[ASMR_Printify_Pipeline_Tutorial.docx]] — step-by-step setup guide including the `curl` commands to look up provider and blueprint IDs

---

## Outstanding Placeholders (fill these before first run)

All placeholders are marked `<<PLACEHOLDER: ...>>` in the script. Here's the complete list:

### Supabase

| Placeholder | Where to find it |
|---|---|
| `SUPABASE_URL` | Supabase dashboard → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_KEY` | Supabase dashboard → Project Settings → API → service_role key (not anon) |
| `SUPABASE_BUCKET` | Name of the Storage bucket you create for artwork originals (e.g. `artwork-originals`) |

### Printify

| Placeholder | Where to find it |
|---|---|
| `PRINTIFY_API_KEY` | Printify → Settings → Connections → API access |
| `PRINTIFY_SHOP_ID` | Visible in the URL when inside your Printify shop |
| Canvas `blueprint_id` | `GET https://api.printify.com/v1/catalog/blueprints.json` — find "Canvas" |
| Canvas `print_provider_id` | `GET /catalog/blueprints/{id}/print_providers.json` |
| Poster `blueprint_id` | Same catalog call — find poster/art print product |
| Poster `print_provider_id` | Same provider lookup |
| Photo `blueprint_id` | Same catalog call — find photo print product |
| Photo `print_provider_id` | Same provider lookup |
| `ASMR_COMMISSION_PCT` | Your decided commission percentage (e.g. `30` for 30%) |

### Artwork Table Column Names (if different from defaults)

| Placeholder | Default expected | Notes |
|---|---|---|
| `artist_name` column | `artist_name` | Display name of the artist |
| `title` column | `title` | Name of the artwork |
| `storage_path` column | `storage_path` | Path to PNG in Supabase Storage |

---

## Ordinal Minting Destination

**Decided: Zoide (phase 1) → ASMR in-house minter (phase 2)**

The `ordinal_prep.py` script (not yet built) will:
1. Pull PNG from Supabase Storage
2. Convert to high-quality JPEG using Pillow (targeting sub-400kb for inscription efficiency)
3. Write JPEG back to Supabase Storage with status `ordinal_ready`
4. **Phase 1:** Zoide is the minting destination — files will be queued/delivered for inscription there
5. **Phase 2:** When the in-house minter is built, step 4 becomes a direct API call replacing the Zoide handoff — no other part of the pipeline changes

This separation means the JPEG prep work is not blocked by the minting destination decision.

---

## Pipeline Status Tracker

| Component | Status | Notes |
|---|---|---|
| `printify_pipeline.py` | ✅ Built — awaiting credentials | Placeholders all marked |
| `ASMR_Printify_Pipeline_Tutorial.docx` | ✅ Written | Includes provider lookup curl commands |
| `ordinal_prep.py` | ✅ Built — awaiting Zoide credentials | Zoide phase 1; Phase 2 swap is one function |
| Supabase `artwork` table schema | ✅ In `schema.sql` | Review column names match placeholders above |
| Artist upload flow (frontend) | 🔲 Not yet built | Will trigger pipeline on upload |
| Terms of service language | 🔲 Draft needed | Required before artist signup goes live |

**Target: testable build by end of May 2026. Hard deadline: June 10, 2026.**

---

## Next Build Steps (in order)

1. **Fill placeholders** — gather Supabase + Printify credentials, run catalog API calls to get blueprint/provider IDs
2. ~~**Build `ordinal_prep.py`**~~ ✅ Done
3. **Contact Zoide** — confirm whether API/batch minting is available; get API key + endpoint docs. Until then, ordinal_prep.py runs in manual mode (logs JPEG URL, you inscribe by hand on Zoide and paste txid back into Supabase).
4. **Test pipeline end-to-end** — use an Ordinal Rainbows piece as test subject (already inscribed, safe to use as dummy data)
5. **Build artist upload frontend** — the trigger that kicks off both pipelines
6. **Draft Terms of Service** — revenue split, IP license, agent authority, payout terms

---

## Revenue Model Reference

- ASMR acts as agent: one Printify shop, ASMR brand, multiple artists represented
- Artists earn a percentage of each print sale paid in MNEE
- Commission percentage set in `ASMR_COMMISSION_PCT` env var — baked into product pricing at creation time
- Ordinal Rainbows Vol. 1 is the proof-of-concept featured collection (Michael's own work)
