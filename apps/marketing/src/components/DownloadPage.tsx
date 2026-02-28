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
  icon: React.JSX.Element
  options: DownloadOption[]
}

const APPLE_ICON = (
  <svg className="size-6" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
  </svg>
)

const WINDOWS_ICON = (
  <svg className="size-6" viewBox="0 0 24 24" fill="currentColor">
    <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
  </svg>
)

const LINUX_ICON = (
  <svg className="size-6" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.504 0c-.155 0-.311.015-.466.046-3.024.617-3.042 4.053-2.423 5.926.36 1.093.676 2.045.846 2.872.077.375.126.729.126 1.067 0 .345-.05.688-.163 1.009-.12.344-.3.672-.518.975-.23.315-.498.612-.785.885-.287.273-.587.525-.882.757-.576.455-1.116.882-1.468 1.41-.35.53-.555 1.162-.555 1.94 0 .63.15 1.182.416 1.672.268.49.636.913 1.063 1.265.427.352.907.632 1.396.84.49.206.974.34 1.405.404.212.032.421.05.612.05h.01c.185 0 .388-.016.602-.048.43-.066.914-.2 1.403-.406.49-.208.97-.488 1.396-.84.427-.352.795-.774 1.063-1.265.266-.49.416-1.042.416-1.672 0-.778-.206-1.41-.556-1.94-.352-.528-.892-.955-1.468-1.41-.295-.232-.595-.484-.882-.757-.287-.273-.555-.57-.785-.885-.218-.303-.398-.631-.518-.975-.113-.32-.163-.664-.163-1.009 0-.338.05-.692.126-1.067.17-.827.486-1.779.846-2.872.619-1.873.6-5.309-2.423-5.926-.155-.031-.311-.046-.466-.046zm-1.46 7.7c.45-.026.886.173 1.17.56.285.388.35.887.156 1.327-.236.537-1.045 1.028-1.78.643-.462-.242-.683-.788-.54-1.289.092-.32.328-.594.616-.78.15-.098.32-.156.49-.168zm2.92 0c.17.012.34.07.49.168.288.186.524.46.616.78.143.5-.078 1.047-.54 1.289-.735.385-1.544-.106-1.78-.643-.194-.44-.129-.94.156-1.327.284-.387.72-.586 1.17-.56z" />
  </svg>
)

const PLATFORMS: PlatformSection[] = [
  {
    platform: 'macos',
    name: 'macOS',
    icon: APPLE_ICON,
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
    icon: WINDOWS_ICON,
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
    icon: LINUX_ICON,
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
        <span className="text-foreground">{section.icon}</span>
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
