const LOGOS = [
  { name: 'Vercel', width: 100 },
  { name: 'Stripe', width: 80 },
  { name: 'GitHub', width: 90 },
  { name: 'Linear', width: 85 },
  { name: 'Supabase', width: 110 },
  { name: 'Railway', width: 95 }
]

export default function TrustedBySection(): React.JSX.Element {
  return (
    <section className="relative border-y border-border py-12">
      <div className="mx-auto max-w-7xl px-8">
        <p className="mb-8 text-center text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Trusted by developers at
        </p>
      </div>

      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-32 bg-gradient-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-32 bg-gradient-to-l from-background to-transparent" />

        <div className="flex w-max animate-marquee hover:[animation-play-state:paused]">
          {[...LOGOS, ...LOGOS].map((logo, i) => (
            <div
              key={`${logo.name}-${i}`}
              className="mx-12 flex items-center justify-center"
              style={{ minWidth: logo.width }}
            >
              <span className="text-lg font-medium text-muted-foreground/50">{logo.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
