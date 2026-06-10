import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { useEmbedMode } from "@/hooks/useEmbedMode";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, Minus, Plus, Trash2, ShoppingBag, ArrowLeft } from "lucide-react";
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
  const isEmbed = useEmbedMode();
  const [product, setProduct] = useState<ProductNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [showEmbedCart, setShowEmbedCart] = useState(false);
  const { addItem, items, isLoading, isSyncing, updateQuantity, removeItem, getCheckoutUrl } =
    useCartStore();

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

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + parseFloat(i.price.amount) * i.quantity, 0);
  const currency = items[0]?.price.currencyCode || "CAD";

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
    if (isEmbed) {
      setShowEmbedCart(true);
    } else {
      toast.success("Added to cart", { description: product.title, position: "top-center" });
    }
  };

  const handleCheckout = () => {
    const url = getCheckoutUrl();
    if (url) window.open(url, "_blank");
  };

  const firstImage = images[0];

  if (isEmbed && showEmbedCart) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <div className="flex-1 flex flex-col px-4 py-4 max-w-lg mx-auto w-full">
          <button
            type="button"
            onClick={() => setShowEmbedCart(false)}
            className="flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground mb-6 self-start"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to product
          </button>

          <h2 className="font-display text-2xl mb-6">Your Cart</h2>

          {items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center py-12">
              <ShoppingBag className="h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">Your cart is empty</p>
              <button
                type="button"
                onClick={() => setShowEmbedCart(false)}
                className="text-sm underline underline-offset-4"
              >
                Continue shopping
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-6 flex-1">
                {items.map((item) => (
                  <div key={item.variantId} className="flex gap-4">
                    <div className="w-20 h-24 bg-muted overflow-hidden flex-shrink-0">
                      {item.product.node.images?.edges?.[0]?.node && (
                        <img
                          src={item.product.node.images.edges[0].node.url}
                          alt={item.product.node.title}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-base leading-tight">{item.product.node.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.selectedOptions.map((o) => o.value).join(" · ")}
                      </p>
                      <p className="text-sm font-medium mt-1">
                        {item.price.currencyCode} ${parseFloat(item.price.amount).toFixed(2)}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          type="button"
                          aria-label="Decrease quantity"
                          className="h-7 w-7 border border-border flex items-center justify-center hover:border-foreground transition-colors"
                          onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                          disabled={isLoading}
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center text-sm">{item.quantity}</span>
                        <button
                          type="button"
                          aria-label="Increase quantity"
                          className="h-7 w-7 border border-border flex items-center justify-center hover:border-foreground transition-colors"
                          onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                          disabled={isLoading}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          aria-label="Remove item"
                          className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors ml-auto"
                          onClick={() => removeItem(item.variantId)}
                          disabled={isLoading}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-border pt-6 mt-6 space-y-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">
                    Subtotal ({totalItems} {totalItems === 1 ? "item" : "items"})
                  </span>
                  <span className="font-display text-xl">
                    {currency} ${totalPrice.toFixed(2)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Shipping and taxes calculated at checkout.
                </p>
                <Button
                  size="lg"
                  className="w-full rounded-none h-12 text-xs uppercase tracking-[0.2em]"
                  onClick={handleCheckout}
                  disabled={isLoading || isSyncing}
                >
                  {isLoading || isSyncing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Proceed to Checkout
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className={`flex-1 mx-auto w-full max-w-7xl px-4 md:px-6 ${isEmbed ? "py-4 md:py-6" : "py-12 md:py-16"}`}>
        {!isEmbed && (
          <Link
            to="/"
            className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
          >
            ← Back to shop
          </Link>
        )}

        <div className={`${isEmbed ? "" : "mt-8"} grid md:grid-cols-2 gap-6 md:gap-12`}>
          <div className="space-y-4">
            {isEmbed ? (
              firstImage ? (
                <div className="aspect-[4/3] bg-muted overflow-hidden">
                  <img
                    src={firstImage.node.url}
                    alt={firstImage.node.altText || product.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="aspect-[4/3] bg-muted" />
              )
            ) : images.length > 0 ? (
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

          <div className={`${isEmbed ? "self-start" : "md:sticky md:top-24 self-start"}`}>
            {product.vendor && (
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                {product.vendor}
              </p>
            )}
            <h1 className={`font-display mt-2 ${isEmbed ? "text-2xl md:text-3xl" : "text-4xl md:text-5xl"}`}>{product.title}</h1>
            <p className="mt-3 font-display text-xl">
              {variant?.price.currencyCode} ${parseFloat(variant?.price.amount ?? "0").toFixed(2)}
            </p>

            {!isEmbed && product.description && (
              <p className="mt-6 text-muted-foreground leading-relaxed whitespace-pre-line">
                {product.description}
              </p>
            )}

            {product.variants.edges.length > 1 && (
              <div className="mt-6">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">
                  Edition
                </p>
                <div className="flex flex-wrap gap-2">
                  {product.variants.edges.map((v) => (
                    <button
                      type="button"
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
              className="mt-6 w-full rounded-none h-12 text-xs uppercase tracking-[0.2em]"
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

            {!isEmbed && (
              <ul className="mt-8 space-y-2 text-sm text-muted-foreground">
                <li>· Available on fine-art paper, poster or canvas</li>
                <li>· Printed on demand — never overstocked</li>
                <li>· Part of the ASMRtists open roster</li>
              </ul>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
