import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useCartStore } from "@/stores/cartStore";
import type { ShopifyProduct } from "@/lib/shopify";
import { toast } from "sonner";

export function ProductCard({ product }: { product: ShopifyProduct }) {
  const addItem = useCartStore((s) => s.addItem);
  const isLoading = useCartStore((s) => s.isLoading);

  const variant = product.node.variants.edges[0]?.node;
  const image = product.node.images.edges[0]?.node;
  const price = product.node.priceRange.minVariantPrice;

  const handleAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!variant) return;
    await addItem({
      product,
      variantId: variant.id,
      variantTitle: variant.title,
      price: variant.price,
      quantity: 1,
      selectedOptions: variant.selectedOptions || [],
    });
    toast.success("Added to cart", { description: product.node.title, position: "top-center" });
  };

  return (
    <Link
      to="/product/$handle"
      params={{ handle: product.node.handle }}
      className="group block"
    >
      <div className="aspect-[4/5] bg-secondary overflow-hidden transition-shadow duration-300 group-hover:shadow-[0_0_0_1px_oklch(0.70_0.12_315/0.25)]">
        {image ? (
          <img
            src={image.url}
            alt={image.altText || product.node.title}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-muted-foreground text-sm">
            No image
          </div>
        )}
      </div>
      <div className="pt-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          {product.node.vendor && (
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              {product.node.vendor}
            </p>
          )}
          <h3 className="font-display text-lg leading-snug truncate">{product.node.title}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {price.currencyCode} ${parseFloat(price.amount).toFixed(2)}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-none shrink-0 opacity-0 group-hover:opacity-100 transition-all hover:bg-accent/10 hover:border-accent/50 hover:text-accent"
          onClick={handleAdd}
          disabled={isLoading || !variant}
        >
          {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
        </Button>
      </div>
    </Link>
  );
}
