import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { NAV_LINKS } from '../data/navigation'
import DownloadButton from './DownloadButton'

export default function Header(): React.JSX.Element {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <a
            href="/"
            className="flex items-center text-foreground hover:text-foreground/80 transition-colors animate-fade-in"
          >
            <img src="/logo.png" alt="ONPOINT" className="h-7 w-7 rounded-full dark:hidden" />
            <img
              src="/logo-dark.png"
              alt="ONPOINT"
              className="h-7 w-7 rounded-full hidden dark:block"
            />
            <span className="text-lg font-semibold tracking-wide uppercase font-brand ml-2">
              ONPOINT
            </span>
          </a>

          <div className="hidden md:flex items-center animate-fade-in [animation-delay:100ms]">
            <nav className="flex items-center">
              {NAV_LINKS.map((link, i) => (
                <div key={link.href} className="flex items-center">
                  {i > 0 && <div className="mx-1 h-4 w-px bg-border" />}
                  <a
                    href={link.href}
                    onClick={() => {
                      window.posthog?.capture('nav_link_clicked', {
                        label: link.label,
                        href: link.href
                      })
                    }}
                    className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </a>
                </div>
              ))}
            </nav>
            <div className="ml-4 flex items-center gap-2">
              <DownloadButton />
            </div>
          </div>

          <button
            type="button"
            className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors animate-fade-in [animation-delay:100ms]"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMenuOpen}
          >
            {isMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>

        <div
          className="md:hidden border-t border-border overflow-hidden transition-[max-height,opacity] duration-200 ease-in-out"
          style={{
            maxHeight: isMenuOpen ? 300 : 0,
            opacity: isMenuOpen ? 1 : 0,
            borderTopWidth: isMenuOpen ? 1 : 0
          }}
        >
          <div className="flex flex-col gap-1 py-4">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => {
                  window.posthog?.capture('nav_link_clicked', {
                    label: link.label,
                    href: link.href
                  })
                }}
                className="px-2 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-border pt-2">
              <DownloadButton className="w-full" />
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
