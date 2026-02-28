import { useState } from 'react'
import { Download } from 'lucide-react'

type Platform = 'macos' | 'windows' | 'linux' | 'unknown'

interface PlatformInfo {
  platform: Platform
  label: string
  href: string
}

const PLATFORM_LOGOS: Record<'macos' | 'windows' | 'linux', string> = {
  macos: '/logos/apple.svg',
  windows: '/logos/windows.svg',
  linux: '/logos/linux.svg'
}

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('mac')) return 'macos'
  if (ua.includes('win')) return 'windows'
  if (ua.includes('linux')) return 'linux'
  return 'unknown'
}

function getPlatformInfo(platform: Platform): PlatformInfo {
  switch (platform) {
    case 'macos':
      return { platform: 'macos', label: 'Download for macOS', href: '/download' }
    case 'windows':
      return { platform: 'windows', label: 'Download for Windows', href: '/download' }
    case 'linux':
      return { platform: 'linux', label: 'Download for Linux', href: '/download' }
    default:
      return { platform: 'unknown', label: 'Download', href: '/download' }
  }
}

interface DownloadButtonProps {
  size?: 'default' | 'lg'
  className?: string
  showSubtext?: boolean
}

export default function DownloadButton({
  size = 'default',
  className = '',
  showSubtext = false
}: DownloadButtonProps): React.JSX.Element {
  const [info] = useState<PlatformInfo>(() => getPlatformInfo(detectPlatform()))

  const sizeClasses =
    size === 'lg' ? 'h-12 px-8 text-base gap-2.5' : 'h-10 px-6 text-sm gap-2 sm:h-11 sm:px-8'

  return (
    <div className="flex flex-col items-center gap-2">
      <a
        href={info.href}
        className={`inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium transition-all bg-primary text-primary-foreground hover:bg-primary/90 ${sizeClasses} ${className}`}
      >
        <Download className="size-5" />
        {info.label}
      </a>
      {showSubtext && (
        <div className="flex flex-col items-center gap-1.5">
          <p className="text-xs text-muted-foreground">Open source, fully offline, and free.</p>
          <div className="mt-1 flex items-center gap-4">
            {(['macos', 'windows', 'linux'] as const).map((p) => (
              <img
                key={p}
                src={PLATFORM_LOGOS[p]}
                alt={p}
                className="size-5"
                style={{
                  opacity: info.platform === p ? 0.7 : 0.25,
                  filter: 'grayscale(1)'
                }}
              />
            ))}
          </div>
          <a
            href="/download"
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
          >
            More download options
          </a>
        </div>
      )}
    </div>
  )
}
