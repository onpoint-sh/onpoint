import { Download, ExternalLink } from 'lucide-react'

interface DownloadOption {
  label: string
  arch: string
  href: string
  recommended?: boolean
}

interface PlatformSection {
  platform: string
  name: string
  logo: string
  options: DownloadOption[]
}

const PLATFORMS: PlatformSection[] = [
  {
    platform: 'macos',
    name: 'macOS',
    logo: '/logos/apple.svg',
    options: [
      {
        label: 'Apple Silicon',
        arch: 'arm64 — M1/M2/M3/M4',
        href: '/download/macos-arm64',
        recommended: true
      },
      {
        label: 'Intel',
        arch: 'x64 — Intel Macs',
        href: '/download/macos-x64'
      }
    ]
  }
]

function PlatformCard({ section }: { section: PlatformSection }): React.JSX.Element {
  return (
    <div className="rounded-xl border border-primary/50 bg-primary/5 p-6 transition-colors">
      <div className="mb-4 flex items-center gap-3">
        <img src={section.logo} alt={section.name} className="size-6 dark:invert" />
        <div>
          <h2 className="text-lg font-semibold text-foreground">{section.name}</h2>
        </div>
      </div>

      <div className="space-y-3">
        {section.options.map((option) => (
          <a
            key={option.href}
            href={option.href}
            onClick={() => {
              window.posthog?.capture('download_started', {
                platform: section.platform,
                label: option.label,
                arch: option.arch
              })
            }}
            className={`flex items-center justify-between rounded-lg border px-4 py-3 transition-all hover:bg-foreground/5 ${
              option.recommended ? 'border-primary/30 bg-primary/5' : 'border-border'
            }`}
          >
            <div>
              <span className="text-sm font-medium text-foreground">{option.label}</span>
              <span className="ml-2 text-xs text-muted-foreground">{option.arch}</span>
            </div>
            <Download className="size-4 text-muted-foreground" />
          </a>
        ))}
      </div>
    </div>
  )
}

export default function DownloadPage(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mb-12 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Download ONPOINT
        </h1>
        <p className="mt-3 text-muted-foreground">Available for macOS. Free to use.</p>
      </div>

      <div className="mx-auto max-w-md">
        {PLATFORMS.map((section) => (
          <PlatformCard key={section.platform} section={section} />
        ))}
      </div>

      <div className="mt-12 text-center">
        <a
          href="https://github.com/onpoint-sh/onpoint/releases"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink className="size-3.5" />
          View all versions on GitHub
        </a>
      </div>
    </div>
  )
}
