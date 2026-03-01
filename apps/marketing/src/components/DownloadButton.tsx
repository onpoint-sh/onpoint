import { Download } from 'lucide-react'

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
  const sizeClasses =
    size === 'lg' ? 'h-12 px-8 text-base gap-2.5' : 'h-10 px-6 text-sm gap-2 sm:h-11 sm:px-8'

  return (
    <div className="flex flex-col items-center gap-2">
      <a
        href="/download"
        onClick={() => {
          window.posthog?.capture('download_button_clicked', {
            platform: 'macos'
          })
        }}
        className={`inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium transition-all bg-primary text-primary-foreground hover:bg-primary/90 ${sizeClasses} ${className}`}
      >
        <Download className="size-5" />
        Download for macOS
      </a>
      {showSubtext && (
        <div className="flex flex-col items-center gap-1.5">
          <p className="text-xs text-muted-foreground">Open source, fully offline, and free.</p>
          <div className="mt-1 flex items-center gap-4">
            <img
              src="/logos/apple.svg"
              alt="macOS"
              className="size-5"
              style={{ opacity: 0.7, filter: 'grayscale(1)' }}
            />
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
