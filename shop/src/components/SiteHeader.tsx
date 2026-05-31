import { Link } from "@tanstack/react-router";
import { CartDrawer } from "@/components/CartDrawer";
import { useEmbedMode } from "@/hooks/useEmbedMode";

const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_URL ?? "http://localhost:3000";

export function SiteHeader() {
  const isEmbed = useEmbedMode();
  if (isEmbed) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/60 relative">
      {/* Aurora accent line at top of header */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px]"
        style={{
          background: 'linear-gradient(90deg, #c4b0ff 0%, #ffb3d1 35%, #ffd6a5 65%, #b3f0c8 85%, #a6d8ff 100%)',
        }}
        aria-hidden
      />
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="font-display text-2xl tracking-tight flex items-baseline gap-2">
          <span className="rainbow-text logo-glow">ASMRtists</span>
          <span className="text-[7px] uppercase tracking-[0.28em] text-muted-foreground font-sans">
            Est. 2025
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm uppercase tracking-[0.18em]">
          <Link
            to="/"
            activeOptions={{ exact: true }}
            activeProps={{ className: "text-foreground" }}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Shop
          </Link>
          <Link
            to="/collections"
            activeProps={{ className: "text-foreground" }}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Collections
          </Link>
          <Link
            to="/artists"
            activeProps={{ className: "text-foreground" }}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Artists
          </Link>
          <Link
            to="/about"
            activeProps={{ className: "text-foreground" }}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            About
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <a
            href={`${DASHBOARD_URL}/login`}
            className="hidden sm:inline-flex items-center text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition-colors"
          >
            Artist Login
          </a>
          <CartDrawer />
        </div>
      </div>
    </header>
  );
}
