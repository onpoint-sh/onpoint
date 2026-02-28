import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { NAV_LINKS } from '../data/navigation'
import DownloadButton from './DownloadButton'

export default function Header(): React.JSX.Element {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <motion.a
            href="/"
            className="text-foreground hover:text-foreground/80 transition-colors"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <span className="text-lg font-semibold tracking-wide uppercase font-brand">
              ONPOINT
            </span>
          </motion.a>

          <motion.div
            className="hidden md:flex items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <nav className="flex items-center">
              {NAV_LINKS.map((link, i) => (
                <div key={link.href} className="flex items-center">
                  {i > 0 && <div className="mx-1 h-4 w-px bg-border" />}
                  <a
                    href={link.href}
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
          </motion.div>

          <motion.button
            type="button"
            className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMenuOpen}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            {isMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </motion.button>
        </div>

        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              className="md:hidden border-t border-border"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex flex-col gap-1 py-4">
                {NAV_LINKS.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="px-2 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </a>
                ))}
                <div className="mt-2 flex flex-col gap-2 border-t border-border pt-2">
                  <DownloadButton className="w-full" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  )
}
