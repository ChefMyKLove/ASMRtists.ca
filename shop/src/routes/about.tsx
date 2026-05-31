import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

const AUDIENCE = [
  {
    role: "For Collectors",
    hook: "Are you ready for the ultimate gamified art-owning experience?",
  },
  {
    role: "For Artists",
    hook: "Are you ready to have your patrons become your marketing team?",
  },
  {
    role: "For Curators",
    hook: "Are you ready to be the first to spot the next big wave?",
  },
  {
    role: "Get Started",
    hook: "",
  },
];

function AudienceCarousel() {
  const [current, setCurrent] = useState(0);
  const [animating, setAnimating] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const advance = (next: number) => {
    setAnimating(true);
    setTimeout(() => {
      setCurrent(next);
      setAnimating(false);
    }, 300);
  };

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCurrent((c) => {
        const next = (c + 1) % AUDIENCE.length;
        setAnimating(true);
        setTimeout(() => {
          setCurrent(next);
          setAnimating(false);
        }, 300);
        return c;
      });
    }, 4500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const item = AUDIENCE[current];

  return (
    <div className="mt-12 bg-foreground text-background overflow-hidden">
      {/* Role tabs */}
      <div className="flex border-b border-background/10">
        {AUDIENCE.map((a, i) => (
          <button
            key={a.role}
            onClick={() => { if (timerRef.current) clearInterval(timerRef.current); advance(i); }}
            className={`flex-1 px-4 py-4 text-[12px] uppercase tracking-[0.22em] font-medium transition-colors duration-200 ${
              i === current
                ? "bg-background/15 text-background"
                : "text-background/35 hover:text-background/65"
            }`}
          >
            {a.role}
          </button>
        ))}
      </div>

      {/* Content */}
      <div
        className="px-8 py-10 transition-opacity duration-300"
        style={{ opacity: animating ? 0 : 1 }}
      >
        {item.hook ? (
          <p className="font-display text-3xl md:text-4xl leading-snug">
            {item.hook}
          </p>
        ) : (
          <a
            href="https://asmrtists.ca"
            className="block font-display text-4xl md:text-6xl leading-tight underline underline-offset-8 decoration-background/30 hover:decoration-background transition-all"
          >
            ASMRtists.ca
          </a>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-px bg-background/10 relative overflow-hidden">
        <div
          key={current}
          className="absolute inset-y-0 left-0 bg-background/40"
          style={{
            animation: "progress 4.5s linear forwards",
            width: "0%",
          }}
        />
      </div>

      <style>{`
        @keyframes progress { from { width: 0% } to { width: 100% } }
      `}</style>
    </div>
  );
}

export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () => ({
    meta: [
      { title: "About — ASMRtists" },
      {
        name: "description",
        content:
          "ASMRtists is a print house representing a growing roster of artists — on paper, poster and canvas, printed on demand for every order.",
      },
      { property: "og:title", content: "About — ASMRtists" },
      {
        property: "og:description",
        content: "A curated print house for the artists we represent.",
      },
    ],
  }),
});

function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 mx-auto max-w-3xl px-6 py-20 md:py-28">
        <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
          About · Est. 2025
        </p>
        <h1 className="font-display text-5xl md:text-6xl mt-3">
          Your collectors are your biggest promoters.
        </h1>

        <div className="mt-12 space-y-6 text-lg leading-relaxed text-foreground/90 font-light">
          <p>
            ASMRtists is built around a novel concept: the people who collect your
            work are also the best people to promote it — especially when they're
            rewarded every time it sells.
          </p>
          <p>
            Introducing our <strong className="font-medium">Proof-of-Patron</strong> rewards
            model. When a digital collector mints the 1Sat Ordinal of one of your
            pieces, they become invested in its success. Holders of these on-chain
            digital artifacts are compensated every time a physical print of that
            piece sells — and can cash in their rewards at any time, or keep them
            attached to the Ordinal, increasing its resale value.
          </p>
          <p>
            Throughout all of this, the artist is fairly compensated for every sale
            of their physical work through the ASMRtists portal, and earns royalties
            on every resale of their digital artifacts. The work keeps paying.
          </p>

          <AudienceCarousel />

          <p className="pt-2">
            Get in touch at{" "}
            <a className="underline underline-offset-4" href="mailto:hello@asmrtists.ca">
              hello@asmrtists.ca
            </a>{" "}
            if you think you have what it takes. To get started,{" "}
            <a className="underline underline-offset-4" href="https://asmrtists.ca">
              sign up at ASMRtists.ca
            </a>
            .
          </p>
        </div>

        <div className="mt-20 grid md:grid-cols-3 gap-10 border-t border-border/60 pt-10">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Formats
            </p>
            <p className="mt-2 font-display text-xl">Paper · Poster · Canvas</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Print runs
            </p>
            <p className="mt-2 font-display text-xl">Open & on-demand</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Digital
            </p>
            <p className="mt-2 font-display text-xl">1Sat Ordinals on BSV</p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
