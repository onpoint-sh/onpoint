import { useState } from 'react'
import { Download, ExternalLink } from 'lucide-react'

type Platform = 'macos' | 'windows' | 'linux' | 'unknown'

interface DownloadOption {
  label: string
  arch: string
  href: string
  recommended?: boolean
}

interface PlatformSection {
  platform: Platform
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
  },
  {
    platform: 'windows',
    name: 'Windows',
    logo: '/logos/windows.svg',
    options: [
      {
        label: 'Windows',
        arch: 'x64 — Windows 10+',
        href: '/download/windows-x64',
        recommended: true
      },
      {
        label: 'Windows ARM',
        arch: 'arm64 — Surface Pro X, etc.',
        href: '/download/windows-arm64'
      }
    ]
  },
  {
    platform: 'linux',
    name: 'Linux',
    logo: '/logos/linux.svg',
    options: [
      {
        label: 'AppImage',
        arch: 'x64 — Universal',
        href: '/download/linux-appimage',
        recommended: true
      },
      {
        label: '.deb',
        arch: 'x64 — Ubuntu/Debian',
        href: '/download/linux-deb'
      },
      {
        label: '.rpm',
        arch: 'x64 — Fedora/RHEL',
        href: '/download/linux-rpm'
      }
    ]
  }
]

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('mac')) return 'macos'
  if (ua.includes('win')) return 'windows'
  if (ua.includes('linux')) return 'linux'
  return 'unknown'
}

function PlatformCard({
  section,
  isDetected
}: {
  section: PlatformSection
  isDetected: boolean
}): React.JSX.Element {
  return (
    <div
      className={`rounded-xl border p-6 transition-colors ${
        isDetected ? 'border-primary/50 bg-primary/5' : 'border-border bg-muted/30'
      }`}
    >
      <div className="mb-4 flex items-center gap-3">
        <img src={section.logo} alt={section.name} className="size-6 dark:invert" />
        <div>
          <h2 className="text-lg font-semibold text-foreground">{section.name}</h2>
          {isDetected && <span className="text-xs text-primary font-medium">Detected</span>}
        </div>
      </div>

      <div className="space-y-3">
        {section.options.map((option) => (
          <a
            key={option.href}
            href={option.href}
            className={`flex items-center justify-between rounded-lg border px-4 py-3 transition-all hover:bg-foreground/5 ${
              option.recommended && isDetected ? 'border-primary/30 bg-primary/5' : 'border-border'
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
  const [detectedPlatform] = useState<Platform>(() => detectPlatform())

  const sorted = [...PLATFORMS].sort((a, b) => {
    if (a.platform === detectedPlatform) return -1
    if (b.platform === detectedPlatform) return 1
    return 0
  })

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mb-12 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Download ONPOINT
        </h1>
        <p className="mt-3 text-muted-foreground">
          Available for macOS, Windows, and Linux. Free to use.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-3">
        {sorted.map((section) => (
          <PlatformCard
            key={section.platform}
            section={section}
            isDetected={section.platform === detectedPlatform}
          />
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
