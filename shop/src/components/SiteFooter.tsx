import { Link } from "@tanstack/react-router";
import { useEmbedMode } from "@/hooks/useEmbedMode";

export function SiteFooter() {
  const isEmbed = useEmbedMode();
  if (isEmbed) return null;

  return (
    <footer className="border-t border-border/60 mt-24">
      <div className="mx-auto max-w-7xl px-6 py-12 grid gap-8 md:grid-cols-3 text-sm">
        <div>
          <p className="font-display text-xl rainbow-text">ASMRtists</p>
          <p className="mt-2 text-muted-foreground max-w-xs">
            Prints on demand from a growing roster of artists — on paper,
            poster and canvas.
          </p>
        </div>
        <div className="space-y-2">
          <p className="uppercase tracking-[0.18em] text-xs text-muted-foreground">Browse</p>
          <ul className="space-y-1">
            <li><Link to="/" className="hover:underline">Shop prints</Link></li>
            <li><Link to="/collections" className="hover:underline">Collections</Link></li>
            <li><Link to="/artists" className="hover:underline">Artists</Link></li>
            <li><Link to="/about" className="hover:underline">About</Link></li>
          </ul>
        </div>
        <div className="space-y-2">
          <p className="uppercase tracking-[0.18em] text-xs text-muted-foreground">Contact</p>
          <p className="text-muted-foreground">
            <a href="mailto:info@asmrtists.ca" className="hover:underline">
              info@asmrtists.ca
            </a>
          </p>
          <p className="text-muted-foreground">
            <a href="mailto:hello@asmrtists.ca" className="hover:underline">
              hello@asmrtists.ca
            </a>
          </p>
        </div>
      </div>
      <div className="border-t border-border/60 px-6 py-4 mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="uppercase tracking-[0.2em]">
          © {new Date().getFullYear()} ASMRtists · Est. 2025 · All works © their respective artists
        </span>
        {/* TODO: replace href with your ISAT Ordinals ecosystem URL */}
        <a
          href="#"
          className="uppercase tracking-[0.18em] hover:text-foreground transition-colors"
        >
          1/1 Ordinals — The Originals ↗
        </a>
      </div>
    </footer>
  );
}
