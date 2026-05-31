"""
seed_or_vol1.py — Seed Ordinal Rainbows Vol. 1 into Supabase

Seeds 64 artwork rows and 63 reward_allocation rows for
chefmyklove's ordinalrainbows collection.

Requirements:
  pip install supabase python-dotenv

Usage:
  python scripts/seed_or_vol1.py

Env vars (from .env or environment):
  SUPABASE_URL
  SUPABASE_SERVICE_KEY     (service-role key, not anon)
  CHEF_USERNAME            (default: chefmyklove)

What this script does:
  1. Looks up the artist_profiles row for CHEF_USERNAME
  2. Looks up (or creates) the 'ordinalrainbows' collection
  3. Upserts 64 artwork rows (one per ordinal)
  4. Upserts 63 reward_allocations rows (EclipseBow#3 has no inscription)

Safe to re-run — all operations are upserts.
"""

import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', 'web', '.env.local'))
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

SUPABASE_URL = os.environ.get('SUPABASE_URL') or os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY') or os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
CHEF_USERNAME = os.environ.get('CHEF_USERNAME', 'chefmyklove')

if not SUPABASE_URL or not SUPABASE_KEY:
    sys.exit('ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_KEY in env')

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Ordinal Rainbows Vol. 1 — full catalogue ──────────────────────────────────
# inscription_id is the BSV txid (outpoint = txid_0)
# EclipseBow#3 has no inscription yet — row created with null txid
OR_VOL1 = [
    {"id": "AlchemyBow",    "title": "AlchemyBow",    "subtitle": "Magical Transformation of Light Into Gold",      "rarity": "Exotic",    "inscription_id": "704a7653a4d8c4d7bf356e1d2aeb0f0349b91c7a34c6b7eee4b4b0f5ae054a33"},
    {"id": "AuroraBow#1",   "title": "AuroraBow #1",  "subtitle": "First Whisper of the Polar Veil",               "rarity": "Common",    "inscription_id": "868d6443ccb191aee5211c64273beb140bdbbe9e7293a70189acf6a46263f6f6"},
    {"id": "AuroraBow#2",   "title": "AuroraBow #2",  "subtitle": "At Peace in an Optical Embrace",                "rarity": "Common",    "inscription_id": "424cce2ffaffef15bb75ad2ff0f5db3c436363b9d2a56a2f7443ae088bd5f466"},
    {"id": "AuroraBow#3",   "title": "AuroraBow #3",  "subtitle": "Heavenly Dreams in Electric Motion",            "rarity": "Common",    "inscription_id": "b6ddeeaf1a9b81645522f0dab614a528e06be9675c9bc7d73e4fce1012619e0e"},
    {"id": "CometBow#1",    "title": "CometBow #1",   "subtitle": "Streak Across the Void",                        "rarity": "Rare",      "inscription_id": "5176ddd8cd3442390610a15b61ce14179bb9f3d1095b0948ebf851b02dd61b6f"},
    {"id": "CometBow#2",    "title": "CometBow #2",   "subtitle": "Ripples Through Space and Time",                "rarity": "Rare",      "inscription_id": "bd6d6afe40e8fb6433157de8fbc0e7621778f0ade01a828d0463af02aaef2e3f"},
    {"id": "CometBow#3",    "title": "CometBow #3",   "subtitle": "Slash Splits the Darkness",                     "rarity": "Rare",      "inscription_id": "06614b83002f72520337085d41be2bdc87082e9d551cc1c5ff46f527a5dad55f"},
    {"id": "CosmicBow#1",   "title": "CosmicBow #1",  "subtitle": "Smiling Deep Space Into a Whirl",               "rarity": "Common",    "inscription_id": "40747e9e6f8e09294660ce2f529911ac7d50c596bb52ce89af6af98c00deeeb1"},
    {"id": "CosmicBow#2",   "title": "CosmicBow #2",  "subtitle": "Transmissions of the Satellite Heart",          "rarity": "Common",    "inscription_id": "8f966e873f5afd0a8712c83207d6d43ffaba7eabfe5c36dbdd6d702102f3fb8a"},
    {"id": "CosmicBow#3",   "title": "CosmicBow #3",  "subtitle": "A Comet Disappears",                            "rarity": "Common",    "inscription_id": "87aa51ecda149cb5449a2ae0524a5dca6ce280adcd22b82bff18c352f1f81a80"},
    {"id": "Do-ItBow#1",    "title": "Do-ItBow #1",   "subtitle": "Soft Focus, Bold Swoosh",                       "rarity": "Common",    "inscription_id": "3e3b8082610574a01eeefedbceb8da0b29742cc4358392c9ebe7372b06171cb4"},
    {"id": "Do-ItBow#2",    "title": "Do-ItBow #2",   "subtitle": "Swoosh the Prismatic Moment",                   "rarity": "Common",    "inscription_id": "bd8a04d8da3bfab3a956bb8997a121408a45267543854ef2bf2f16b3de88a279"},
    {"id": "Do-ItBow#3",    "title": "Do-ItBow #3",   "subtitle": "Swoosh Like Nike",                              "rarity": "Common",    "inscription_id": "338b7e14c29ca471bd7b3fa8a0b05a73e6631e8331805fbd73141995a3404af8"},
    {"id": "DreamyBow#1",   "title": "DreamyBow #1",  "subtitle": "Float Through Liquid Reverie",                  "rarity": "Common",    "inscription_id": "d8ae13f6b2917a0b342734ff402ea79a5a88634f8f6ffda468db2926cf14326a"},
    {"id": "DreamyBow#2",   "title": "DreamyBow #2",  "subtitle": "Twin Portals to Elsewhere Dimensions",          "rarity": "Common",    "inscription_id": "eda2953ca6035933baed5d01ee49e64a47fcb49af833da5c6db194dd0cc0f8c2"},
    {"id": "DreamyBow#3",   "title": "DreamyBow #3",  "subtitle": "Tumbling Towards Ecstacy",                      "rarity": "Common",    "inscription_id": "3db6fe8da41b899cf9c0835a2aa8ad52cad034f811ea60e040a660ad3b792370"},
    {"id": "EclipseBow#1",  "title": "EclipseBow #1", "subtitle": "Light Surrenders to Shadow",                    "rarity": "Rare",      "inscription_id": "2f44447d38039c3b428bf99aea49eb0fd6c6ca1802941adaebf936bb665df238"},
    {"id": "EclipseBow#2",  "title": "EclipseBow #2", "subtitle": "The Edge of the Diamond Ring",                  "rarity": "Rare",      "inscription_id": "5845539bca4fa413f1bf3cb487c4f55c1c3c8881c6eb5dbb70088ff59adcae97"},
    {"id": "EclipseBow#3",  "title": "EclipseBow #3", "subtitle": "Totality in the Valley of Shadows",             "rarity": "Rare",      "inscription_id": None},  # not yet inscribed
    {"id": "ElectraBow#1",  "title": "ElectraBow #1", "subtitle": "Lightning Meets Rainbow",                       "rarity": "Common",    "inscription_id": "8c927450f64f216f9d334ddcf4314ef637c651d627a507dbd893774e747f5184"},
    {"id": "ElectraBow#2",  "title": "ElectraBow #2", "subtitle": "Charged Atmosphere",                            "rarity": "Common",    "inscription_id": "0874b7ace03c44299b0a0e4f32631b30c74e84ed6200fa97408685751d9ff223"},
    {"id": "ElectraBow#3",  "title": "ElectraBow #3", "subtitle": "The Spark Before the Storm",                    "rarity": "Common",    "inscription_id": "601386e283d90039576afceef08a8cc4f1c198ba68039e416250bface86b9c17"},
    {"id": "EyeBow#1",      "title": "EyeBow #1",     "subtitle": "The All-Seeing Chromatic Eye",                  "rarity": "Common",    "inscription_id": "a0d7ece47a892a986bf7f86aee23aeb1fc860d8c7eb0c0123421d9222fbe13d6"},
    {"id": "EyeBow#2",      "title": "EyeBow #2",     "subtitle": "Iris of the Universe",                          "rarity": "Common",    "inscription_id": "cd17d1f904c65ad67abcf183d3a098969a5692af9ceadd27fbcdf0fdead665e6"},
    {"id": "FishBow#1",     "title": "FishBow #1",    "subtitle": "Scales of the Spectrum",                        "rarity": "Uncommon",  "inscription_id": "5523845b52b4adcabfc610f7dc339a8fd2eb227806e959e25ee4ea5bcf1cc4e4"},
    {"id": "FishBow#2",     "title": "FishBow #2",    "subtitle": "Deep Dive Into Colour",                         "rarity": "Uncommon",  "inscription_id": "127e1fda223d75f09def4cc65950311206cc41cd77fbbdd98790644813534ea6"},
    {"id": "FishBow#3",     "title": "FishBow #3",    "subtitle": "Swimming Through Prisms",                       "rarity": "Uncommon",  "inscription_id": "e75c7f265941dde250f1cec7d4f55e4d6984b72e757a57e8ca9de088b383f48a"},
    {"id": "FishBow#4",     "title": "FishBow #4",    "subtitle": "The Final Leap",                                "rarity": "Uncommon",  "inscription_id": "536c740ebb2b73602946d3372a85aa1238d260b785696ffaa69f2d4817f0f502"},
    {"id": "FlowBow#1",     "title": "FlowBow #1",    "subtitle": "Current of Colour in Motion",                   "rarity": "Uncommon",  "inscription_id": "dff3186d06960555da07543bf4741a41febd39c614249a605b43f62f364f2a27"},
    {"id": "FlowBow#2",     "title": "FlowBow #2",    "subtitle": "Downstream Into the Spectrum",                  "rarity": "Uncommon",  "inscription_id": "a2a5c43d25471df04c210a8c1083ec9f80a6d72dd9f0df0cb6bb76a4fe4b27bb"},
    {"id": "FlowBow#3",     "title": "FlowBow #3",    "subtitle": "Ribbons of Living Light",                       "rarity": "Uncommon",  "inscription_id": "bf780dcd1a56d77f76a4631d7cfe90108bfa6c1d180633396fc6151d734bd0dd"},
    {"id": "FlowBow#4",     "title": "FlowBow #4",    "subtitle": "The Delta Dissolves",                           "rarity": "Uncommon",  "inscription_id": "1a6cb972cb0cd30fa8a30ec63b550f11719add091b6bcc54f77730c58cbf247c"},
    {"id": "GhostyBow#1",   "title": "GhostyBow #1",  "subtitle": "Specter in the Spectrum",                       "rarity": "Uncommon",  "inscription_id": "7d8fb85b90c267287a7c106b51abe6d156029e5a7e041d74a9fe5bf75565ab37"},
    {"id": "GhostyBow#2",   "title": "GhostyBow #2",  "subtitle": "Translucent Visitor",                           "rarity": "Uncommon",  "inscription_id": "d2e9dea19f43dae8f89b37525259710c5ef84260a8746beded8e4f0d8f8cac9a"},
    {"id": "GhostyBow#3",   "title": "GhostyBow #3",  "subtitle": "The Haunted Prism",                             "rarity": "Uncommon",  "inscription_id": "d4eea2459e0227a7a027b59568abfa831b933cc4ca593cb8a16dded97bfe008b"},
    {"id": "GhostyBow#4",   "title": "GhostyBow #4",  "subtitle": "Fading Into the Light",                        "rarity": "Uncommon",  "inscription_id": "78e6ca0d142042a368b7bd20080c2bc224d6233a944a2d8dab15763589ee4346"},
    {"id": "HazeBow#1",     "title": "HazeBow #1",    "subtitle": "Morning Mist Through Prisms",                   "rarity": "Common",    "inscription_id": "cea8bc77e6b94d77510407cb1d0bab887248a84eda6a463de30d4ee56d69e283"},
    {"id": "HazeBow#2",     "title": "HazeBow #2",    "subtitle": "Smoke and Chromatic Light",                     "rarity": "Common",    "inscription_id": "f6e664cfbebf03d99e8568a45f2d310815a8dc2124922c6fd376f0452da4a2ae"},
    {"id": "HazeBow#3",     "title": "HazeBow #3",    "subtitle": "Diffused in the Atmosphere",                    "rarity": "Common",    "inscription_id": "92386fa66c0272f5b32eec44c5e3136f6c7550c622ddb1cf3fbee22d56b42bef"},
    {"id": "HeartBow",      "title": "HeartBow",      "subtitle": "Love Painted in Light",                         "rarity": "Legendary", "inscription_id": "19a1e5047dcb0b91991007863b9112e121e374f2e24710bd7d06571706cb5182"},
    {"id": "HummingBow#1",  "title": "HummingBow #1", "subtitle": "Nectar of Spectral Gardens",                    "rarity": "Common",    "inscription_id": "e681e0e13d14ab786884358330e8e74858758562208411f0416ff77c68bda4ee"},
    {"id": "HummingBow#2",  "title": "HummingBow #2", "subtitle": "Wings Blur Into Rainbow",                       "rarity": "Common",    "inscription_id": "ec486ff5a307932e6efb5cabefdd64effcbedcd6f6334e8849c5059bc127b815"},
    {"id": "MirrorBow#1",   "title": "MirrorBow #1",  "subtitle": "Reflection of Infinite Light",                  "rarity": "Uncommon",  "inscription_id": "573bea88ee8a4b906ac64a01a2c49ff020130ef87005bd1c5019454710d0f1fa"},
    {"id": "MirrorBow#2",   "title": "MirrorBow #2",  "subtitle": "The Double Vision",                             "rarity": "Uncommon",  "inscription_id": "d4c9ceac64108b39a04f5f0c792ebb2ac163156f88f541023df13c557b6f00b0"},
    {"id": "MirrorBow#3",   "title": "MirrorBow #3",  "subtitle": "Symmetry of the Spectrum",                      "rarity": "Uncommon",  "inscription_id": "7e64760635f1526de060b327d11ca303c71fa53f630d0635694117f42c723d23"},
    {"id": "MirrorBow#4",   "title": "MirrorBow #4",  "subtitle": "Infinite Regress of Colour",                    "rarity": "Uncommon",  "inscription_id": "683bbd4c5aeb7e2ba121fec1289abb60e34263bc7d2ff55509a0801024a750fe"},
    {"id": "NebulaBow#1",   "title": "NebulaBow #1",  "subtitle": "Birth of a Chromatic Star",                     "rarity": "Epic",      "inscription_id": "2056d7e53ca9eef2526cca04dc84695e195ab23f9edb8e58ae94a296a04f2f4b"},
    {"id": "NebulaBow#2",   "title": "NebulaBow #2",  "subtitle": "Supernova of the Spectrum",                     "rarity": "Epic",      "inscription_id": "dc70aed2f7fc88695d100846b3f6e6273f82fc51c9e64b69b4ce59f5f07bd243"},
    {"id": "NebulaBow#3",   "title": "NebulaBow #3",  "subtitle": "The Cosmic Dust Settles",                       "rarity": "Epic",      "inscription_id": "88ef3f60165d06c5ef5810567d754714eeb4ff7039763b5b2af39e2a17903d22"},
    {"id": "NebulaBow#4",   "title": "NebulaBow #4",  "subtitle": "Interstellar Medium",                           "rarity": "Epic",      "inscription_id": "c2b9364a967649a6faf5a63a391fbf80438dfbf3b2de1f58eea15a7143de7f55"},
    {"id": "NebulaBow#5",   "title": "NebulaBow #5",  "subtitle": "Event Horizon of Light",                        "rarity": "Epic",      "inscription_id": "50184e4be6267bc2c00ce72efe51cafad535dfea05b25232fef64dd4367369e2"},
    {"id": "NebulaBow#6",   "title": "NebulaBow #6",  "subtitle": "The Final Collapse",                            "rarity": "Epic",      "inscription_id": "edab0ea4344d09ecffe22be1eab95d65850f19f26469b2768bc09576139f7e09"},
    {"id": "RoadBow#1",     "title": "RoadBow #1",    "subtitle": "The Open Road Shines",                          "rarity": "Common",    "inscription_id": "5e7b3681ccae9c1e08ce3aebecf476f99b1d1e911f295b8afca3619f9647496f"},
    {"id": "RoadBow#2",     "title": "RoadBow #2",    "subtitle": "Miles of Spectrum",                             "rarity": "Common",    "inscription_id": "d8999dc285d71c54013bf6915323c28eb2157c8cf41d3f47388c52ac29d1e6bd"},
    {"id": "RoadBow#3",     "title": "RoadBow #3",    "subtitle": "Vanishing Point in Colour",                     "rarity": "Common",    "inscription_id": "ae744a42863d6b4cfdb097c61e169a6b3ef8c540226532a52e261ec96ceb4caa"},
    {"id": "SkyBow#1",      "title": "SkyBow #1",     "subtitle": "Heaven Streaks Across the Blue",                "rarity": "Rare",      "inscription_id": "71243868d8a334ac2df558e017e59bcf5a9c3042195ae0ece8852c6e0682f37a"},
    {"id": "SkyBow#2",      "title": "SkyBow #2",     "subtitle": "Cirrus Painted in Light",                       "rarity": "Rare",      "inscription_id": "eb684aecec0a8073989030eeefc34b208981ec97d746e434d988b7b5a8266590"},
    {"id": "TieDyeBow#1",   "title": "TieDyeBow #1",  "subtitle": "Festival of Colour Soaked in Time",             "rarity": "Legendary", "inscription_id": "7def583d3dad15f9343f3189c7a8837a13e7615d6310453cf6268803b3704342"},
    {"id": "TieDyeBow#2",   "title": "TieDyeBow #2",  "subtitle": "Hand-Dyed by the Rainbow",                     "rarity": "Legendary", "inscription_id": "0a4d806faa2e0ca230c41283ad38519ef8efe6c7287d407762852605ca29ebff"},
    {"id": "TunnelBow#1",   "title": "TunnelBow #1",  "subtitle": "Enter the Chromatic Portal",                    "rarity": "Common",    "inscription_id": "22141ab40840b31ba0c2a96fe452d97c0457f288a427e7f8bf54d55cc674fad2"},
    {"id": "TunnelBow#2",   "title": "TunnelBow #2",  "subtitle": "The Light at the End",                          "rarity": "Common",    "inscription_id": "33e25defc213d9f5d28547080df83bd2b39482197b399af79b3b0d62ce961249"},
    {"id": "TunnelBow#3",   "title": "TunnelBow #3",  "subtitle": "Spiralling Into Colour",                        "rarity": "Common",    "inscription_id": "8405acc073776a2bd41d0623495cb932ab477c66be6500a62c4324fc9d9016a7"},
    {"id": "UniverseBow",   "title": "UniverseBow",   "subtitle": "All Colours at Once",                           "rarity": "Legendary", "inscription_id": "93f79b45ac8f5d1ef218bb67426aefe53458081010119a620a7bc77f220c74d3"},
    {"id": "ZippyBow",      "title": "ZippyBow",      "subtitle": "Fast as Light, Bright as Sound",                "rarity": "Exotic",    "inscription_id": "d6dc7d95528657302d7fb1473002358323987dc468f833f53a34d0276c24b2d4"},
]

RARITY_MULTIPLIER = {
    "Exotic":    0.50,
    "Legendary": 0.40,
    "Epic":      0.30,
    "Rare":      0.20,
    "Uncommon":  0.10,
    "Common":    0.05,
}

def main():
    print(f"Seeding OR Vol.1 ({len(OR_VOL1)} pieces) for artist: {CHEF_USERNAME}")

    # 1. Resolve artist profile
    resp = supabase.from_('profiles').select('id').eq('username', CHEF_USERNAME).maybe_single().execute()
    if not resp.data:
        sys.exit(f'ERROR: No profile found for username "{CHEF_USERNAME}"')
    profile_id = resp.data['id']
    print(f'  Profile: {profile_id}')

    resp = supabase.from_('artist_profiles').select('user_id').eq('user_id', profile_id).maybe_single().execute()
    if not resp.data:
        sys.exit(f'ERROR: No artist_profile for user {profile_id}. Create one first.')
    artist_id = resp.data['user_id']
    print(f'  Artist:  {artist_id}')

    # 2. Resolve or create the collection
    resp = supabase.from_('collections') \
        .select('id') \
        .eq('artist_id', artist_id) \
        .eq('slug', 'ordinalrainbows') \
        .maybe_single() \
        .execute()

    if resp.data:
        collection_id = resp.data['id']
        print(f'  Collection (existing): {collection_id}')
    else:
        insert = supabase.from_('collections').insert({
            'artist_id': artist_id,
            'slug': 'ordinalrainbows',
            'title': 'Ordinal Rainbows Vol. 1',
            'status': 'active',
            'piece_count': len(OR_VOL1),
        }).execute()
        collection_id = insert.data[0]['id']
        print(f'  Collection (created):  {collection_id}')

    # 3. Upsert artwork rows
    print(f'\nUpserting {len(OR_VOL1)} artwork rows...')
    artwork_map = {}  # nft_id → artwork_id

    for i, nft in enumerate(OR_VOL1, start=1):
        outpoint = f"{nft['inscription_id']}_0" if nft['inscription_id'] else None

        # Check if artwork already exists by inscription_outpoint or position
        existing = supabase.from_('artwork') \
            .select('id') \
            .eq('collection_id', collection_id) \
            .eq('position', i) \
            .maybe_single() \
            .execute()

        if existing.data:
            artwork_id = existing.data['id']
            # Update inscription fields if we have them
            if outpoint:
                supabase.from_('artwork').update({
                    'inscription_txid': nft['inscription_id'],
                    'inscription_outpoint': outpoint,
                    'status': 'minted',
                }).eq('id', artwork_id).execute()
            print(f'  [{i:2d}] {nft["title"]:<22} updated  ({artwork_id})')
        else:
            row = {
                'collection_id': collection_id,
                'position': i,
                'title': nft['title'],
                'description': nft['subtitle'],
                'status': 'minted' if nft['inscription_id'] else 'uploaded',
            }
            if outpoint:
                row['inscription_txid'] = nft['inscription_id']
                row['inscription_outpoint'] = outpoint

            insert = supabase.from_('artwork').insert(row).execute()
            artwork_id = insert.data[0]['id']
            print(f'  [{i:2d}] {nft["title"]:<22} created  ({artwork_id})')

        artwork_map[nft['id']] = artwork_id

    # 4. Upsert reward_allocations for inscribed pieces
    inscribed = [n for n in OR_VOL1 if n['inscription_id']]
    print(f'\nUpserting {len(inscribed)} reward_allocation rows...')

    for nft in inscribed:
        outpoint = f"{nft['inscription_id']}_0"
        artwork_id = artwork_map[nft['id']]
        multiplier = RARITY_MULTIPLIER.get(nft['rarity'], 0.05)

        supabase.from_('reward_allocations').upsert({
            'artwork_id': artwork_id,
            'inscription_outpoint': outpoint,
            'rarity': nft['rarity'],
            'rarity_multiplier': multiplier,
            'mnee_claimable': 0,
            'bsv_claimable': 0,
            'bsv21_claimable': 0,
            'total_earned_usd': 0,
        }, on_conflict='inscription_outpoint').execute()
        print(f'  {nft["title"]:<22} [{nft["rarity"]:<9}] outpoint={outpoint[:16]}...')

    print(f'\nDone. {len(OR_VOL1)} artworks, {len(inscribed)} allocations seeded.')
    print(f'Collection URL: https://asmrtists.ca/c/{CHEF_USERNAME}/ordinalrainbows')

if __name__ == '__main__':
    main()
