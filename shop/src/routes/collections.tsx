import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import {
  storefrontApiRequest,
  COLLECTIONS_QUERY,
  type ShopifyCollection,
} from "@/lib/shopify";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/collections")({
  component: CollectionsPage,
  head: () => ({
    meta: [
      { title: "Collections — ASMRprints" },
      {
        name: "description",
        content: "Browse curated collections of limited-edition prints, posters and canvas works.",
      },
      { property: "og:title", content: "Collections — ASMRprints" },
      {
        property: "og:description",
        content: "Curated collections of limited-edition prints on paper, poster and canvas.",
      },
    ],
  }),
});

function CollectionsPage() {
  const [collections, setCollections] = useState<ShopifyCollection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await storefrontApiRequest(COLLECTIONS_QUERY, { first: 50 });
        if (!cancelled) setCollections(data?.data?.collections?.edges ?? []);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 mx-auto max-w-7xl px-6 py-16">
        <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
          The Catalogue · Est. 2025
        </p>
        <h1 className="font-display text-5xl md:text-6xl mt-2">Collections</h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Each collection groups related editions by theme, series or medium.
          New collections drop alongside each artist release.
        </p>

        {loading ? (
          <div className="py-24 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-3" /> Loading…
          </div>
        ) : collections.length === 0 ? (
          <div className="mt-16 py-24 text-center border border-dashed border-border">
            <p className="font-display text-2xl">No collections yet</p>
            <p className="mt-3 text-sm text-muted-foreground max-w-md mx-auto">
              Create collections in Shopify Admin → Products → Collections and
              assign products to them — they'll appear here automatically.
            </p>
          </div>
        ) : (
          <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {collections.map((c) => {
              const { handle, title, description, image, products } = c.node;
              const thumbs = products?.edges?.slice(0, 2) ?? [];
              const count = products?.edges?.length ?? 0;
              return (
                <Link
                  key={c.node.id}
                  to="/collection/$handle"
                  params={{ handle }}
                  className="group flex flex-col border border-border/60 overflow-hidden bg-background hover:border-border transition-colors duration-200"
                >
                  {/* Cover image — or 2-up product mosaic if no collection image */}
                  {image ? (
                    <div className="aspect-[4/3] overflow-hidden">
                      <img
                        src={image.url}
                        alt={image.altText || title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                        loading="lazy"
                      />
                    </div>
                  ) : thumbs.length > 0 ? (
                    <div className="aspect-[4/3] grid grid-cols-2 gap-px bg-border/40 overflow-hidden">
                      {[0, 1].map((i) => {
                        const p = thumbs[i];
                        const img = p?.node.images.edges[0]?.node;
                        return img ? (
                          <img
                            key={i}
                            src={img.url}
                            alt={img.altText || ""}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div key={i} className="bg-muted" />
                        );
                      })}
                    </div>
                  ) : (
                    <div className="aspect-[4/3] bg-muted flex items-center justify-center text-muted-foreground text-sm">
                      No image
                    </div>
                  )}

                  {/* Footer */}
                  <div className="px-5 py-4 border-t border-border/40 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-display text-lg leading-snug truncate">{title}</h2>
                      {description && (
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                          {description}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs uppercase tracking-[0.2em] text-muted-foreground mt-0.5">
                      {count > 0 ? `${count}` : "—"}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
