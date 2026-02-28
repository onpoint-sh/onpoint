import { useCallback, useEffect, useRef, useState } from 'react'
import { AppPreview, AppPreviewProvider } from '@onpoint/app-preview'
import '@onpoint/app-preview/styles/app-preview.css'
import DownloadButton from './DownloadButton'
import RotatingTypewriter from './RotatingTypewriter'
import { MOCK_NOTES } from '../data/mock-notes'

function useResponsiveHeight(): number {
  const [height, setHeight] = useState(
    typeof window !== 'undefined' && window.innerWidth < 640 ? 500 : 1000
  )

  useEffect(() => {
    const update = (): void => setHeight(window.innerWidth < 640 ? 500 : 1000)
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return height
}

function useScrollParallax(ref: React.RefObject<HTMLDivElement | null>): {
  scale: number
  opacity: number
} {
  const [values, setValues] = useState({ scale: 1, opacity: 1 })
  const rafId = useRef(0)

  const update = useCallback(() => {
    const el = ref.current
    if (!el) return

    const rect = el.getBoundingClientRect()
    const viewportH = window.innerHeight

    const start = viewportH * 0.45
    const end = 0
    const progress = Math.min(1, Math.max(0, (start - rect.top) / (start - end)))

    setValues({
      scale: 1 - progress * 0.05,
      opacity: 1 - progress * 0.15
    })
  }, [ref])

  useEffect(() => {
    const onScroll = (): void => {
      cancelAnimationFrame(rafId.current)
      rafId.current = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(rafId.current)
    }
  }, [update])

  return values
}

export default function HeroSection(): React.JSX.Element {
  const demoRef = useRef<HTMLDivElement>(null)
  const previewHeight = useResponsiveHeight()
  const { scale, opacity } = useScrollParallax(demoRef)

  return (
    <div className="flex flex-col items-center pt-12 sm:pt-16 lg:pt-20">
      <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-8 lg:px-[30px]">
        <div className="flex flex-col items-center text-center">
          <h1 className="text-4xl font-medium tracking-tight leading-[1.1] text-foreground sm:text-5xl md:text-6xl lg:text-7xl">
            The Notes App for{' '}
            <span className="inline-block text-left" style={{ minWidth: '7.5em' }}>
              <RotatingTypewriter
                words={[
                  'AI Agents.',
                  'Youtubers.',
                  'Engineers.',
                  'Sales Professionals.',
                  'Power Users.'
                ]}
                colors={['#1e3a8a', '#ff0000', undefined, '#f97316', '#15803d']}
                typingSpeed={60}
                deletingSpeed={30}
                pauseDuration={2000}
                initialDelay={600}
              />
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-4xl text-base font-light text-muted-foreground sm:mt-6 sm:text-lg">
            Your notes, plain Markdown, stored locally, always yours. Ghost Mode for
            screen-invisible teleprompting, a context-engineering-ready CLI for AI agents, and zero
            distractions by default.
          </p>

          <div className="mt-6 flex flex-col items-center gap-3 sm:mt-8 sm:flex-row sm:gap-4">
            <DownloadButton />
            <a
              href="https://github.com/onpoint-sh/onpoint"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-border bg-background px-6 text-sm font-medium text-foreground transition-colors hover:bg-muted sm:h-11 sm:px-8"
            >
              <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              View on GitHub
            </a>
          </div>
        </div>

        <div
          ref={demoRef}
          className="relative mt-12 w-full px-4 pb-12 sm:mt-16 sm:px-6 lg:mt-20 lg:px-8 will-change-transform"
          style={{ transform: `scale(${scale})`, opacity }}
        >
          <AppPreviewProvider notes={MOCK_NOTES}>
            <AppPreview height={previewHeight} defaultNote="Sales/Q1 Pipeline Review.md" />
          </AppPreviewProvider>
        </div>
      </div>
    </div>
  )
}
