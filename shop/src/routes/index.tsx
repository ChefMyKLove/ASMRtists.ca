import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ProductCard } from "@/components/ProductCard";
import { storefrontApiRequest, PRODUCTS_QUERY, FEATURED_QUERY, type ShopifyProduct } from "@/lib/shopify";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "ASMRtists — Prints, Posters, Canvas. Est. 2025" },
      {
        name: "description",
        content:
          "ASMRtists — prints on paper, poster and canvas from a growing roster of artists. Printed on demand, made only when you order one.",
      },
      { property: "og:title", content: "ASMRtists — Prints, Posters, Canvas" },
      {
        property: "og:description",
        content: "Prints on paper, poster and canvas from a growing artist roster. Est. 2025.",
      },
    ],
  }),
});

const TICKER_ITEMS = [
  "Paper",
  "Poster",
  "Canvas",
  "Printed on demand",
  "Open editions",
  "Est. 2025",
];

interface FeaturedProduct {
  id: string;
  title: string;
  handle: string;
  vendor: string;
  priceRange: { minVariantPrice: { amount: string; currencyCode: string } };
  images: { edges: Array<{ node: { url: string; altText: string | null } }> };
}

function FeaturedCarousel({ items }: { items: FeaturedProduct[] }) {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (items.length < 2) return;
    timerRef.current = setInterval(() => {
      setCurrent((c) => (c + 1) % items.length);
    }, 3500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [items.length]);

  if (items.length === 0) {
    // Fallback: static aurora placeholder while collection is empty
    return (
      <div className="aspect-[3/4] relative overflow-hidden border border-[#c4b0ff]/30">
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(196,176,255,0.45) 0%, rgba(255,179,209,0.35) 40%, rgba(255,214,165,0.30) 70%, rgba(163,230,196,0.25) 100%)" }} />
        <div aria-hidden className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: "linear-gradient(to right, rgba(30,20,50,1) 1px, transparent 1px), linear-gradient(to bottom, rgba(30,20,50,1) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-[10px] uppercase tracking-[0.28em] text-foreground/60">
          <span>Vol. I</span><span>№ 001</span>
        </div>
        <div className="absolute bottom-4 left-4 right-4 text-[10px] uppercase tracking-[0.28em] text-foreground/60 flex items-center justify-between">
          <span>Spring Edition</span><span>2025</span>
        </div>
      </div>
    );
  }

  const p = items[current];
  const img = p.images.edges[0]?.node;
  const price = parseFloat(p.priceRange.minVariantPrice.amount).toFixed(2);
  const currency = p.priceRange.minVariantPrice.currencyCode;

  return (
    <div className="aspect-[3/4] relative overflow-hidden border border-[#c4b0ff]/30 group">
      {items.map((item, i) => {
        const itemImg = item.images.edges[0]?.node;
        return (
          <div
            key={item.id}
            className="absolute inset-0 transition-opacity duration-700"
            style={{ opacity: i === current ? 1 : 0 }}
          >
            {itemImg ? (
              <img
                src={itemImg.url}
                alt={itemImg.altText || item.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-muted" />
            )}
          </div>
        );
      })}

      {/* Overlay: product info */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-4 pt-8 pb-4">
        <p className="text-[10px] uppercase tracking-[0.28em] text-white/70">{p.vendor}</p>
        <p className="text-sm font-display text-white leading-snug mt-0.5 line-clamp-2">{p.title}</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-white/80">{currency} ${price}</span>
          <Link
            to="/product/$handle"
            params={{ handle: p.handle }}
            className="text-[10px] uppercase tracking-[0.22em] text-white/90 hover:text-white border border-white/40 px-3 py-1 hover:border-white transition-colors"
          >
            View
          </Link>
        </div>
      </div>

      {/* Dot indicators */}
      {items.length > 1 && (
        <div className="absolute top-3 right-3 flex gap-1.5">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-1.5 h-1.5 rounded-full transition-all ${i === current ? "bg-white scale-125" : "bg-white/40"}`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function HomePage() {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [featured, setFeatured] = useState<FeaturedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [productsData, featuredData] = await Promise.all([
          storefrontApiRequest(PRODUCTS_QUERY, { first: 24, query: null }),
          storefrontApiRequest(FEATURED_QUERY, {}),
        ]);
        if (!cancelled) {
          setProducts(productsData?.data?.products?.edges ?? []);
          setFeatured(
            featuredData?.data?.collectionByHandle?.products?.edges?.map(
              (e: { node: FeaturedProduct }) => e.node
            ) ?? []
          );
        }
      } catch (err) {
        console.error("Failed to load products", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative border-b border-border/60 overflow-hidden">
          {/* Aurora backdrop — real colors, actually visible */}
          <div
            aria-hidden
            className="absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(65% 55% at 85% 5%, rgba(196,176,255,0.28) 0%, transparent 65%), radial-gradient(55% 45% at 5% 95%, rgba(255,179,209,0.24) 0%, transparent 65%), radial-gradient(40% 35% at 50% 50%, rgba(163,230,196,0.10) 0%, transparent 70%)",
            }}
          />
          <div className="mx-auto max-w-7xl px-6 pt-20 pb-24 md:pt-28 md:pb-32 grid md:grid-cols-12 gap-10 items-end">
            <div className="md:col-span-8">
              <div className="flex items-center gap-3 mb-8">
                <span className="inline-block h-px w-8 bg-foreground/40" />
                <p className="text-[11px] uppercase tracking-[0.34em] text-muted-foreground">
                  ASMRtists · Est. 2025
                </p>
              </div>
              <h1 className="font-display text-5xl md:text-7xl lg:text-8xl leading-[1.02] tracking-tight">
                Prints, Posters,
                <br />
                <span className="italic" style={{ color: '#b89aff' }}>Canvas.</span>
              </h1>
              <p className="mt-8 max-w-xl text-base md:text-lg text-muted-foreground leading-relaxed">
                A growing roster of artists. Fine-art paper, poster or canvas —
                each piece part of an ecosystem where collectors, artists and
                curators all have skin in the game.
              </p>
              <div className="mt-10 flex flex-wrap gap-3">
                <a
                  href="#shop"
                  className="inline-flex items-center justify-center bg-foreground text-background px-7 py-3 text-xs uppercase tracking-[0.22em] hover:bg-foreground/90 transition-colors"
                >
                  Browse the collection
                </a>
                <Link
                  to="/artists"
                  className="inline-flex items-center justify-center border border-border px-7 py-3 text-xs uppercase tracking-[0.22em] hover:bg-muted transition-colors"
                >
                  Meet the roster
                </Link>
              </div>

              {/* Format chips — each with its own accent color */}
              <div className="mt-10 flex flex-wrap gap-2">
                {[
                  { label: "Fine-art paper", dot: "#c4b0ff" },
                  { label: "Poster",         dot: "#ffb3d1" },
                  { label: "Canvas",         dot: "#b3f0c8" },
                ].map((f) => (
                  <span
                    key={f.label}
                    className="inline-flex items-center gap-2 px-3 py-1.5 border text-[11px] uppercase tracking-[0.2em] text-muted-foreground"
                    style={{ borderColor: f.dot + '60' }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: f.dot }} />
                    {f.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="md:col-span-4 hidden md:block">
              <FeaturedCarousel items={featured} />
            </div>
          </div>

          {/* Marquee ticker */}
          <div className="border-t border-border/60 bg-background/60 overflow-hidden">
            <div className="flex gap-12 py-3 whitespace-nowrap animate-[marquee_40s_linear_infinite]">
              {[...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS].map((t, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-12 text-[11px] uppercase tracking-[0.32em] text-muted-foreground"
                >
                  {t}
                  <span aria-hidden className="text-accent">◆</span>
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Shop grid */}
        <section id="shop" className="mx-auto max-w-7xl px-6 py-20">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                The Collection
              </p>
              <h2 className="font-display text-4xl md:text-5xl mt-2">All prints</h2>
            </div>
            <Link
              to="/artists"
              className="hidden sm:inline text-sm uppercase tracking-[0.18em] hover:underline underline-offset-4"
            >
              Browse by artist →
            </Link>
          </div>

          {loading ? (
            <div className="py-24 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-3" />
              Loading prints…
            </div>
          ) : products.length === 0 ? (
            <div className="py-24 text-center border border-dashed border-border">
              <p className="font-display text-2xl">No prints yet</p>
              <p className="mt-3 text-sm text-muted-foreground max-w-md mx-auto">
                Add products to your Shopify store and they'll appear here
                automatically — no code changes needed.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-14">
              {products.map((p) => (
                <ProductCard key={p.node.id} product={p} />
              ))}
            </div>
          )}
        </section>

        {/* What we make */}
        <section
          className="border-y border-[#c4b0ff]/20"
          style={{
            background: "linear-gradient(135deg, rgba(196,176,255,0.07) 0%, rgba(255,179,209,0.05) 50%, rgba(163,230,196,0.06) 100%)",
          }}
        >
          <div className="mx-auto max-w-6xl px-6 py-20">
            <div className="grid md:grid-cols-3 gap-10">
              {[
                {
                  k: "01",
                  t: "Paper",
                  d: "Archival fine-art paper. Numbered, signed, made to outlive the trend.",
                  accent: "#c4b0ff",
                },
                {
                  k: "02",
                  t: "Poster",
                  d: "Heavier matte stock. The everyday format — for walls that change often.",
                  accent: "#ffb3d1",
                },
                {
                  k: "03",
                  t: "Canvas",
                  d: "Stretched and ready to hang. Texture that asks to be looked at twice.",
                  accent: "#b3f0c8",
                },
              ].map((f) => (
                <div key={f.k} className="border-t-2 pt-6" style={{ borderColor: f.accent + '80' }}>
                  <p className="text-[11px] uppercase tracking-[0.32em]" style={{ color: f.accent }}>
                    {f.k}
                  </p>
                  <h3 className="font-display text-3xl mt-3">{f.t}</h3>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                    {f.d}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Editorial note */}
        <section className="mx-auto max-w-5xl px-6 py-24 text-center">
          <p className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
            From the studio
          </p>
          <p className="mt-6 font-display text-2xl md:text-3xl leading-snug text-balance">
            "ASMRtists exists to give the artists we represent a direct,
            honest way to share their work — one print at a time, made only
            when you ask."
          </p>
          <div className="mt-8 inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
            <span className="h-px w-8 bg-foreground/40" />
            <span>The ASMRtists Studio</span>
            <span className="h-px w-8 bg-foreground/40" />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
