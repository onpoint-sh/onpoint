import { useState } from 'react'
import { Download } from 'lucide-react'

type Platform = 'macos' | 'windows' | 'linux' | 'unknown'

interface PlatformInfo {
  platform: Platform
  label: string
  icon: React.JSX.Element
  href: string
}

const APPLE_ICON = (
  <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
  </svg>
)

const WINDOWS_ICON = (
  <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
  </svg>
)

const LINUX_ICON = (
  <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.504 0c-.155 0-.311.015-.466.046-3.024.617-3.042 4.053-2.423 5.926.36 1.093.676 2.045.846 2.872.077.375.126.729.126 1.067 0 .345-.05.688-.163 1.009-.12.344-.3.672-.518.975-.23.315-.498.612-.785.885-.287.273-.587.525-.882.757-.576.455-1.116.882-1.468 1.41-.35.53-.555 1.162-.555 1.94 0 .63.15 1.182.416 1.672.268.49.636.913 1.063 1.265.427.352.907.632 1.396.84.49.206.974.34 1.405.404.212.032.421.05.612.05h.01c.185 0 .388-.016.602-.048.43-.066.914-.2 1.403-.406.49-.208.97-.488 1.396-.84.427-.352.795-.774 1.063-1.265.266-.49.416-1.042.416-1.672 0-.778-.206-1.41-.556-1.94-.352-.528-.892-.955-1.468-1.41-.295-.232-.595-.484-.882-.757-.287-.273-.555-.57-.785-.885-.218-.303-.398-.631-.518-.975-.113-.32-.163-.664-.163-1.009 0-.338.05-.692.126-1.067.17-.827.486-1.779.846-2.872.619-1.873.6-5.309-2.423-5.926-.155-.031-.311-.046-.466-.046zm-1.46 7.7c.45-.026.886.173 1.17.56.285.388.35.887.156 1.327-.236.537-1.045 1.028-1.78.643-.462-.242-.683-.788-.54-1.289.092-.32.328-.594.616-.78.15-.098.32-.156.49-.168zm2.92 0c.17.012.34.07.49.168.288.186.524.46.616.78.143.5-.078 1.047-.54 1.289-.735.385-1.544-.106-1.78-.643-.194-.44-.129-.94.156-1.327.284-.387.72-.586 1.17-.56z" />
  </svg>
)

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
      return {
        platform: 'macos',
        label: 'Download for macOS',
        icon: APPLE_ICON,
        href: '/download'
      }
    case 'windows':
      return {
        platform: 'windows',
        label: 'Download for Windows',
        icon: WINDOWS_ICON,
        href: '/download'
      }
    case 'linux':
      return {
        platform: 'linux',
        label: 'Download for Linux',
        icon: LINUX_ICON,
        href: '/download'
      }
    default:
      return {
        platform: 'unknown',
        label: 'Download',
        icon: <Download className="size-5" />,
        href: '/download'
      }
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
            <span
              className={
                info.platform === 'macos' ? 'text-foreground/70' : 'text-muted-foreground/40'
              }
            >
              {APPLE_ICON}
            </span>
            <span
              className={
                info.platform === 'windows' ? 'text-foreground/70' : 'text-muted-foreground/40'
              }
            >
              {WINDOWS_ICON}
            </span>
            <span
              className={
                info.platform === 'linux' ? 'text-foreground/70' : 'text-muted-foreground/40'
              }
            >
              {LINUX_ICON}
            </span>
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
