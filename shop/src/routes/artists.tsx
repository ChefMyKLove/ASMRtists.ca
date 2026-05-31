import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import {
  storefrontApiRequest,
  PRODUCTS_QUERY,
  type ShopifyProduct,
} from "@/lib/shopify";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/artists")({
  component: ArtistsPage,
  head: () => ({
    meta: [
      { title: "Artists — ASMRtists" },
      {
        name: "description",
        content:
          "Meet the ASMRtists roster. Browse prints by each artist we represent — on paper, poster and canvas, made on demand.",
      },
      { property: "og:title", content: "Artists — ASMRtists" },
      {
        property: "og:description",
        content: "The ASMRtists roster — prints on paper, poster and canvas, made on demand.",
      },
    ],
  }),
});

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function ArtistCard({ vendor, items }: { vendor: string; items: ShopifyProduct[] }) {
  const preview = items.slice(0, 2);
  const totalPrints = items.length;

  return (
    <div className="flex flex-col border border-border/60 overflow-hidden bg-background hover:border-border transition-colors duration-200">
      {/* Profile header */}
      <div className="px-6 pt-8 pb-6 flex items-center gap-4">
        {/* Avatar placeholder — initials until real profile images are added */}
        <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center shrink-0">
          <span className="font-display text-lg text-muted-foreground">
            {initials(vendor)}
          </span>
        </div>
        <div className="min-w-0">
          <h2 className="font-display text-xl leading-tight truncate">{vendor}</h2>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mt-0.5">
            {totalPrints} {totalPrints === 1 ? "print" : "prints"}
          </p>
        </div>
      </div>

      {/* Two product thumbnails */}
      <div className="grid grid-cols-2 gap-px bg-border/40">
        {[0, 1].map((i) => {
          const p = preview[i];
          if (!p) {
            return (
              <div key={i} className="aspect-[4/5] bg-muted" />
            );
          }
          const img = p.node.images.edges[0]?.node;
          return (
            <Link
              key={p.node.id}
              to="/product/$handle"
              params={{ handle: p.node.handle }}
              className="group aspect-[4/5] bg-muted overflow-hidden block"
            >
              {img ? (
                <img
                  src={img.url}
                  alt={img.altText || p.node.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center">
                  <span className="text-xs text-muted-foreground">No image</span>
                </div>
              )}
            </Link>
          );
        })}
      </div>

      {/* Footer link */}
      <div className="px-6 py-4 border-t border-border/40">
        <Link
          to="/"
          className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors"
        >
          View all prints →
        </Link>
      </div>
    </div>
  );
}

function ArtistsPage() {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await storefrontApiRequest(PRODUCTS_QUERY, { first: 100, query: null });
        if (!cancelled) setProducts(data?.data?.products?.edges ?? []);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, ShopifyProduct[]>();
    for (const p of products) {
      const vendor = p.node.vendor?.trim() || "Uncredited";
      if (!map.has(vendor)) map.set(vendor, []);
      map.get(vendor)!.push(p);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [products]);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 mx-auto max-w-7xl px-6 py-16">
        <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
          The Roster · Est. 2025
        </p>
        <h1 className="font-display text-5xl md:text-6xl mt-2">Artists</h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Each artist below is part of the ASMRtists roster. Their work is
          available here as prints on demand — on paper, poster and canvas.
        </p>

        {loading ? (
          <div className="py-24 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-3" /> Loading…
          </div>
        ) : grouped.length === 0 ? (
          <div className="mt-16 py-24 text-center border border-dashed border-border">
            <p className="font-display text-2xl">No artists yet</p>
            <p className="mt-3 text-sm text-muted-foreground max-w-md mx-auto">
              Add prints to your store and assign each to an artist (vendor) — they'll
              be listed here automatically.
            </p>
          </div>
        ) : (
          <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {grouped.map(([vendor, items]) => (
              <ArtistCard key={vendor} vendor={vendor} items={items} />
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
