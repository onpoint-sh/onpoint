interface FeatureDemoProps {
  colors: [string, string]
  media?: string
  children?: React.ReactNode
}

export default function FeatureDemo({
  colors,
  media,
  children
}: FeatureDemoProps): React.JSX.Element {
  if (media) {
    return (
      <div className="overflow-hidden rounded-xl border border-border">
        <video autoPlay muted loop playsInline className="w-full">
          <source src={media} type="video/quicktime" />
        </video>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card">
      <div
        className="absolute inset-0 opacity-10"
        style={{
          background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`
        }}
      />
      <div className="relative p-6 sm:p-8">
        {children || (
          <div className="flex aspect-video items-center justify-center">
            <div
              className="size-16 rounded-full opacity-20"
              style={{
                background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
