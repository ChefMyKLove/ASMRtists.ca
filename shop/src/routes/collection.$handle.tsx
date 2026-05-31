import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ProductCard } from "@/components/ProductCard";
import {
  storefrontApiRequest,
  COLLECTION_PRODUCTS_QUERY,
  type ShopifyProduct,
} from "@/lib/shopify";
import { Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/collection/$handle")({
  component: CollectionPage,
});

interface CollectionData {
  id: string;
  title: string;
  handle: string;
  description: string;
  image: { url: string; altText: string | null } | null;
  products: { edges: ShopifyProduct[] };
}

function CollectionPage() {
  const { handle } = Route.useParams();
  const [collection, setCollection] = useState<CollectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    (async () => {
      try {
        const data = await storefrontApiRequest(COLLECTION_PRODUCTS_QUERY, {
          handle,
          first: 100,
        });
        const col = data?.data?.collectionByHandle ?? null;
        if (!cancelled) {
          if (col) setCollection(col);
          else setNotFound(true);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [handle]);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 mx-auto max-w-7xl px-6 py-16">
        {loading ? (
          <div className="py-24 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-3" /> Loading…
          </div>
        ) : notFound || !collection ? (
          <div className="py-24 text-center border border-dashed border-border">
            <p className="font-display text-2xl">Collection not found</p>
            <p className="mt-3 text-sm text-muted-foreground">
              This collection doesn't exist or has been removed.
            </p>
            <Link
              to="/collections"
              className="mt-6 inline-block text-xs uppercase tracking-[0.2em] underline underline-offset-4"
            >
              ← All collections
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.28em] text-muted-foreground">
              <Link to="/collections" className="hover:text-foreground transition-colors">
                Collections
              </Link>
              <span>/</span>
              <span className="text-foreground">{collection.title}</span>
            </div>

            <div className="mt-6 md:flex md:items-end md:justify-between md:gap-8">
              <div>
                <h1 className="font-display text-5xl md:text-6xl">{collection.title}</h1>
                {collection.description && (
                  <p className="mt-4 max-w-2xl text-muted-foreground">{collection.description}</p>
                )}
              </div>
              <span className="mt-3 md:mt-0 shrink-0 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                {collection.products.edges.length}{" "}
                {collection.products.edges.length === 1 ? "edition" : "editions"}
              </span>
            </div>

            {collection.image && (
              <div className="mt-10 aspect-[21/6] overflow-hidden border border-border/60">
                <img
                  src={collection.image.url}
                  alt={collection.image.altText || collection.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {collection.products.edges.length === 0 ? (
              <div className="mt-16 py-24 text-center border border-dashed border-border">
                <p className="font-display text-2xl">No editions yet</p>
                <p className="mt-3 text-sm text-muted-foreground max-w-md mx-auto">
                  Add products to this collection in Shopify Admin and they'll appear here.
                </p>
              </div>
            ) : (
              <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-14">
                {collection.products.edges.map((p) => (
                  <ProductCard key={p.node.id} product={p} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
