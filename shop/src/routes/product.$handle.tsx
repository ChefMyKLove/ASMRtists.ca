import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useCartStore } from "@/stores/cartStore";
import {
  PRODUCT_BY_HANDLE_QUERY,
  storefrontApiRequest,
  type ShopifyProduct,
} from "@/lib/shopify";
import { toast } from "sonner";

export const Route = createFileRoute("/product/$handle")({
  component: ProductPage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="flex-1 flex items-center justify-center p-8 text-center">
          <div>
            <h1 className="font-display text-3xl">Something went wrong</h1>
            <p className="mt-2 text-muted-foreground">{error.message}</p>
            <Button
              className="mt-6 rounded-none"
              onClick={() => {
                router.invalidate();
                reset();
              }}
            >
              Retry
            </Button>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  },
  notFoundComponent: () => (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 flex items-center justify-center p-8 text-center">
        <div>
          <h1 className="font-display text-3xl">Print not found</h1>
          <Link to="/" className="mt-4 inline-block underline underline-offset-4">
            Back to shop
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  ),
});

interface ProductNode {
  id: string;
  title: string;
  description: string;
  handle: string;
  vendor?: string;
  productType?: string;
  tags?: string[];
  priceRange: { minVariantPrice: { amount: string; currencyCode: string } };
  images: { edges: Array<{ node: { url: string; altText: string | null } }> };
  variants: ShopifyProduct["node"]["variants"];
  options: ShopifyProduct["node"]["options"];
}

function ProductPage() {
  const { handle } = Route.useParams();
  const [product, setProduct] = useState<ProductNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const addItem = useCartStore((s) => s.addItem);
  const isLoading = useCartStore((s) => s.isLoading);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await storefrontApiRequest(PRODUCT_BY_HANDLE_QUERY, { handle });
        if (cancelled) return;
        const p = data?.data?.productByHandle ?? null;
        setProduct(p);
        const firstAvailable =
          p?.variants?.edges?.find((v: { node: { availableForSale: boolean; id: string } }) => v.node.availableForSale)?.node?.id ||
          p?.variants?.edges?.[0]?.node?.id ||
          null;
        setSelectedVariantId(firstAvailable);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [handle]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="flex-1 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-3" /> Loading…
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="flex-1 flex items-center justify-center text-center p-8">
          <div>
            <h1 className="font-display text-3xl">Print not found</h1>
            <Link to="/" className="mt-4 inline-block underline underline-offset-4">
              Back to shop
            </Link>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const variant =
    product.variants.edges.find((v) => v.node.id === selectedVariantId)?.node ||
    product.variants.edges[0]?.node;
  const images = product.images.edges;

  const handleAdd = async () => {
    if (!variant) return;
    await addItem({
      product: { node: product as ShopifyProduct["node"] },
      variantId: variant.id,
      variantTitle: variant.title,
      price: variant.price,
      quantity: 1,
      selectedOptions: variant.selectedOptions || [],
    });
    toast.success("Added to cart", { description: product.title, position: "top-center" });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 mx-auto max-w-7xl px-6 py-12 md:py-16">
        <Link
          to="/"
          className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
        >
          ← Back to shop
        </Link>

        <div className="mt-8 grid md:grid-cols-2 gap-12">
          <div className="space-y-4">
            {images.length > 0 ? (
              images.map((img, i) => (
                <div key={i} className="aspect-[4/5] bg-muted overflow-hidden">
                  <img
                    src={img.node.url}
                    alt={img.node.altText || product.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))
            ) : (
              <div className="aspect-[4/5] bg-muted" />
            )}
          </div>

          <div className="md:sticky md:top-24 self-start">
            {product.vendor && (
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                {product.vendor}
              </p>
            )}
            <h1 className="font-display text-4xl md:text-5xl mt-2">{product.title}</h1>
            <p className="mt-4 font-display text-2xl">
              {variant?.price.currencyCode} ${parseFloat(variant?.price.amount ?? "0").toFixed(2)}
            </p>

            {product.description && (
              <p className="mt-6 text-muted-foreground leading-relaxed whitespace-pre-line">
                {product.description}
              </p>
            )}

            {product.variants.edges.length > 1 && (
              <div className="mt-8">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">
                  Edition
                </p>
                <div className="flex flex-wrap gap-2">
                  {product.variants.edges.map((v) => (
                    <button
                      key={v.node.id}
                      onClick={() => setSelectedVariantId(v.node.id)}
                      disabled={!v.node.availableForSale}
                      className={`px-4 py-2 text-sm border transition-colors ${
                        selectedVariantId === v.node.id
                          ? "border-foreground bg-foreground text-background"
                          : "border-border hover:border-foreground"
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      {v.node.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button
              size="lg"
              className="mt-10 w-full rounded-none h-12 text-xs uppercase tracking-[0.2em]"
              onClick={handleAdd}
              disabled={!variant?.availableForSale || isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : variant?.availableForSale ? (
                "Add to cart"
              ) : (
                "Sold out"
              )}
            </Button>

            <ul className="mt-8 space-y-2 text-sm text-muted-foreground">
              <li>· Available on fine-art paper, poster or canvas</li>
              <li>· Printed on demand — never overstocked</li>
              <li>· Part of the ASMRtists open roster</li>
            </ul>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
