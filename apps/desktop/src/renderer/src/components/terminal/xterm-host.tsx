import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { X } from 'lucide-react'
import type { Terminal as XTermTerminal } from 'xterm'
import type { FitAddon as XTermFitAddon } from '@xterm/addon-fit'
import type { SearchAddon as XTermSearchAddon } from '@xterm/addon-search'
import type { WebLinksAddon as XTermWebLinksAddon } from '@xterm/addon-web-links'
import type { CanvasAddon as XTermCanvasAddon } from '@xterm/addon-canvas'
import type { Unicode11Addon as XTermUnicode11Addon } from '@xterm/addon-unicode11'
import { useTerminalStore } from '@/stores/terminal-store'
import { useThemeStore } from '@/stores/theme-store'

type XtermHostProps = {
  sessionId: string
  autoFocus?: boolean
  focusRequestToken?: number
}

type LoadedXtermModules = {
  Terminal: typeof XTermTerminal
  FitAddon: typeof XTermFitAddon
  SearchAddon: typeof XTermSearchAddon
  WebLinksAddon: typeof XTermWebLinksAddon
  CanvasAddon: typeof XTermCanvasAddon
  Unicode11Addon: typeof XTermUnicode11Addon
}

let xtermModulesPromise: Promise<LoadedXtermModules> | null = null
let bellAudioContext: AudioContext | null = null

async function loadXtermModules(): Promise<LoadedXtermModules> {
  if (!xtermModulesPromise) {
    xtermModulesPromise = Promise.all([
      import('xterm'),
      import('@xterm/addon-fit'),
      import('@xterm/addon-search'),
      import('@xterm/addon-web-links'),
      import('@xterm/addon-canvas'),
      import('@xterm/addon-unicode11')
    ]).then(([xterm, fit, search, links, canvas, unicode11]) => ({
      Terminal: xterm.Terminal as unknown as typeof XTermTerminal,
      FitAddon: fit.FitAddon as unknown as typeof XTermFitAddon,
      SearchAddon: search.SearchAddon as unknown as typeof XTermSearchAddon,
      WebLinksAddon: links.WebLinksAddon as unknown as typeof XTermWebLinksAddon,
      CanvasAddon: canvas.CanvasAddon as unknown as typeof XTermCanvasAddon,
      Unicode11Addon: unicode11.Unicode11Addon as unknown as typeof XTermUnicode11Addon
    }))
  }
  return xtermModulesPromise
}

function playBellTone(): void {
  if (typeof window === 'undefined') return
  const AudioCtx =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) return

  if (!bellAudioContext) {
    bellAudioContext = new AudioCtx()
  }

  const now = bellAudioContext.currentTime
  const oscillator = bellAudioContext.createOscillator()
  const gainNode = bellAudioContext.createGain()

  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(880, now)
  gainNode.gain.setValueAtTime(0.0001, now)
  gainNode.gain.exponentialRampToValueAtTime(0.03, now + 0.01)
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.09)

  oscillator.connect(gainNode)
  gainNode.connect(bellAudioContext.destination)
  oscillator.start(now)
  oscillator.stop(now + 0.1)
}

function getCssColor(variable: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback

  const probe = document.createElement('span')
  probe.style.color = `var(${variable})`
  probe.style.position = 'absolute'
  probe.style.pointerEvents = 'none'
  probe.style.opacity = '0'
  document.body.appendChild(probe)
  const color = getComputedStyle(probe).color || fallback
  probe.remove()
  return color
}

function subscribeToSystemTheme(callback: () => void): () => void {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', callback)
    return () => mediaQuery.removeEventListener('change', callback)
  }

  const legacy = mediaQuery as MediaQueryList & {
    addListener?: (listener: () => void) => void
    removeListener?: (listener: () => void) => void
  }

  legacy.addListener?.(callback)
  return () => legacy.removeListener?.(callback)
}

function getSystemIsDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function mapKeyboardEventToTerminalData(event: KeyboardEvent): string | null {
  if (event.metaKey || event.ctrlKey) return null
  if (event.altKey) return null

  if (event.key.length === 1) {
    return event.key
  }

  switch (event.key) {
    case 'Enter':
      return '\r'
    case 'Backspace':
      return '\x7f'
    case 'Tab':
      return '\t'
    case 'Escape':
      return '\x1b'
    case 'ArrowUp':
      return '\x1b[A'
    case 'ArrowDown':
      return '\x1b[B'
    case 'ArrowRight':
      return '\x1b[C'
    case 'ArrowLeft':
      return '\x1b[D'
    case 'Delete':
      return '\x1b[3~'
    case 'Home':
      return '\x1b[H'
    case 'End':
      return '\x1b[F'
    case 'PageUp':
      return '\x1b[5~'
    case 'PageDown':
      return '\x1b[6~'
    default:
      return null
  }
}

function XtermHost({
  sessionId,
  autoFocus = false,
  focusRequestToken = 0
}: XtermHostProps): React.JSX.Element {
  const themeMode = useThemeStore((state) => state.mode)
  const lightThemeId = useThemeStore((state) => state.lightThemeId)
  const darkThemeId = useThemeStore((state) => state.darkThemeId)
  const systemIsDark = useSyncExternalStore(subscribeToSystemTheme, getSystemIsDark)

  const settings = useTerminalStore((state) => state.settings)
  const buffer = useTerminalStore((state) => state.getBuffer(sessionId))
  const write = useTerminalStore((state) => state.write)
  const queueResize = useTerminalStore((state) => state.queueResize)
  const clearBuffer = useTerminalStore((state) => state.clearBuffer)
  const setFocusedSession = useTerminalStore((state) => state.setFocusedSession)
  const setTerminalTextFocus = useTerminalStore((state) => state.setTerminalTextFocus)
  const focusedSessionId = useTerminalStore((state) => state.focusedSessionId)
  const updateSessionMeta = useTerminalStore((state) => state.updateSessionMeta)
  const bellVersion = useTerminalStore((state) => state.getBellVersion(sessionId))

  const rootRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const findInputRef = useRef<HTMLInputElement>(null)
  const xtermRef = useRef<XTermTerminal | null>(null)
  const fitAddonRef = useRef<XTermFitAddon | null>(null)
  const searchAddonRef = useRef<XTermSearchAddon | null>(null)
  const renderedBufferRef = useRef('')
  const visualBellTimerRef = useRef<number | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isFindOpen, setIsFindOpen] = useState(false)
  const [findQuery, setFindQuery] = useState('')

  const resolveTerminalTheme = useCallback(
    () => ({
      background: getCssColor('--background', '#10131a'),
      foreground: getCssColor('--foreground', '#f5f7fa'),
      cursor: getCssColor('--ring', '#7aa2f7'),
      cursorAccent: getCssColor('--background', '#10131a'),
      selectionBackground: getCssColor('--accent', 'rgba(255, 255, 255, 0.2)'),
      selectionInactiveBackground: getCssColor('--muted', 'rgba(255, 255, 255, 0.14)')
    }),
    []
  )

  const runFit = useCallback(() => {
    const fitAddon = fitAddonRef.current
    const xterm = xtermRef.current
    if (!fitAddon || !xterm) return

    try {
      fitAddon.fit()
      queueResize(sessionId, xterm.cols, xterm.rows)
    } catch {
      // ignore fit failures during layout transitions
    }
  }, [queueResize, sessionId])

  const focusTerminal = useCallback(() => {
    setFocusedSession(sessionId)
    setTerminalTextFocus(true)
    const xterm = xtermRef.current
    if (!xterm) return

    window.requestAnimationFrame(() => {
      xterm.focus()
    })
  }, [sessionId, setFocusedSession, setTerminalTextFocus])

  useEffect(() => {
    let cancelled = false
    let resizeObserver: ResizeObserver | null = null
    let removeTextFocusListeners: (() => void) | null = null
    let terminal: XTermTerminal | null = null

    void (async () => {
      const hostElement = containerRef.current
      if (!hostElement) return

      const modules = await loadXtermModules()
      if (cancelled) return

      const xterm = new modules.Terminal({
        allowProposedApi: true,
        convertEol: false,
        scrollback: settings.scrollback,
        fontFamily: settings.fontFamily,
        fontSize: settings.fontSize,
        lineHeight: settings.lineHeight,
        letterSpacing: settings.letterSpacing,
        cursorStyle: settings.cursorStyle,
        cursorBlink: settings.cursorBlink,
        theme: resolveTerminalTheme()
      })

      const fitAddon = new modules.FitAddon()
      const searchAddon = new modules.SearchAddon()
      const linksAddon = new modules.WebLinksAddon((_event, uri) => {
        window.open(uri, '_blank', 'noopener,noreferrer')
      })
      const unicode11Addon = new modules.Unicode11Addon()
      const canvasAddon = new modules.CanvasAddon()

      xterm.loadAddon(fitAddon)
      xterm.loadAddon(searchAddon)
      xterm.loadAddon(linksAddon)
      xterm.loadAddon(unicode11Addon)
      if (settings.rendererType === 'canvas' || settings.rendererType === 'auto') {
        try {
          xterm.loadAddon(canvasAddon)
        } catch (error) {
          if (settings.rendererType === 'canvas') {
            console.warn('Canvas renderer unavailable. Falling back to DOM renderer.', error)
          }
        }
      }
      xterm.unicode.activeVersion = '11'

      xterm.onData((data) => {
        void write(sessionId, data).catch((error) => {
          console.warn('Failed to write terminal input.', error)
        })
      })

      xterm.onResize(({ cols, rows }) => {
        queueResize(sessionId, cols, rows)
      })

      xterm.onTitleChange((title) => {
        void updateSessionMeta(sessionId, { title })
      })

      xterm.attachCustomKeyEventHandler((event) => {
        const hasPrimaryModifier = event.metaKey || event.ctrlKey
        if (hasPrimaryModifier && event.key.toLowerCase() === 'f') {
          event.preventDefault()
          setIsFindOpen(true)
          return false
        }

        if (
          hasPrimaryModifier &&
          !event.shiftKey &&
          !event.altKey &&
          event.key.toLowerCase() === 'k'
        ) {
          event.preventDefault()
          xterm.clear()
          void clearBuffer(sessionId)
          return false
        }

        if (hasPrimaryModifier && event.shiftKey && event.key.toLowerCase() === 'c') {
          const selection = xterm.getSelection()
          if (selection) {
            void navigator.clipboard.writeText(selection)
          }
          event.preventDefault()
          return false
        }

        if (hasPrimaryModifier && event.shiftKey && event.key.toLowerCase() === 'v') {
          void navigator.clipboard.readText().then((text) => {
            if (text) {
              xterm.paste(text)
            }
          })
          event.preventDefault()
          return false
        }

        return true
      })

      terminal = xterm
      xtermRef.current = xterm
      fitAddonRef.current = fitAddon
      searchAddonRef.current = searchAddon

      xterm.open(hostElement)
      runFit()
      setIsReady(true)

      if (settings.copyOnSelect) {
        xterm.onSelectionChange(() => {
          const selection = xterm.getSelection()
          if (selection) {
            void navigator.clipboard.writeText(selection)
          }
        })
      }

      const focusTarget = xterm.textarea ?? hostElement
      const onFocus = (): void => {
        setFocusedSession(sessionId)
        setTerminalTextFocus(true)
      }
      const onBlur = (): void => {
        setFocusedSession(null)
        setTerminalTextFocus(false)
      }
      focusTarget.addEventListener('focus', onFocus)
      focusTarget.addEventListener('blur', onBlur)
      removeTextFocusListeners = () => {
        focusTarget.removeEventListener('focus', onFocus)
        focusTarget.removeEventListener('blur', onBlur)
      }

      resizeObserver = new ResizeObserver(() => {
        runFit()
      })
      resizeObserver.observe(hostElement)
    })()

    return () => {
      cancelled = true
      removeTextFocusListeners?.()
      resizeObserver?.disconnect()
      setIsReady(false)
      xtermRef.current?.dispose()
      xtermRef.current = null
      fitAddonRef.current = null
      searchAddonRef.current = null
      renderedBufferRef.current = ''
      if (terminal) {
        terminal = null
      }
    }
  }, [
    focusTerminal,
    queueResize,
    runFit,
    sessionId,
    setFocusedSession,
    setTerminalTextFocus,
    settings.copyOnSelect,
    settings.cursorBlink,
    settings.cursorStyle,
    settings.fontFamily,
    settings.fontSize,
    settings.letterSpacing,
    settings.lineHeight,
    settings.rendererType,
    settings.scrollback,
    resolveTerminalTheme,
    clearBuffer,
    updateSessionMeta,
    write
  ])

  useEffect(() => {
    if (!isReady || !autoFocus) return
    focusTerminal()
  }, [autoFocus, focusTerminal, isReady])

  useEffect(() => {
    if (!isReady || !autoFocus || !focusRequestToken) return
    focusTerminal()
  }, [autoFocus, focusRequestToken, focusTerminal, isReady])

  useEffect(() => {
    if (!isReady) return
    const xterm = xtermRef.current
    if (!xterm) return

    const previous = renderedBufferRef.current
    if (buffer === previous) return

    if (previous.length > 0 && buffer.startsWith(previous)) {
      const delta = buffer.slice(previous.length)
      if (delta.length > 0) {
        xterm.write(delta)
      }
    } else {
      xterm.clear()
      if (buffer.length > 0) {
        xterm.write(buffer)
      }
    }

    renderedBufferRef.current = buffer
  }, [buffer, isReady])

  useEffect(() => {
    if (!isReady) return
    runFit()
  }, [isReady, runFit])

  useEffect(() => {
    if (!isReady) return

    const applyTheme = (): void => {
      const xterm = xtermRef.current
      if (!xterm) return
      xterm.options.theme = resolveTerminalTheme()
    }

    // Apply immediately and on next frame to catch CSS variable updates from app theme transitions.
    applyTheme()
    const frame = window.requestAnimationFrame(() => {
      applyTheme()
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [darkThemeId, isReady, lightThemeId, resolveTerminalTheme, systemIsDark, themeMode])

  useEffect(() => {
    if (!isReady) return

    const handleWindowKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.repeat) return
      if (focusedSessionId !== sessionId) return

      const target = event.target
      if (target instanceof Element) {
        if (target.closest('input, textarea, [contenteditable], [role="textbox"]')) {
          return
        }
      }

      const xterm = xtermRef.current
      if (!xterm) return

      const textarea = xterm.textarea
      if (textarea && document.activeElement === textarea) {
        return
      }

      const payload = mapKeyboardEventToTerminalData(event)
      if (!payload) return

      event.preventDefault()
      void write(sessionId, payload).catch((error) => {
        console.warn('Failed to write keyboard fallback input.', error)
      })
      focusTerminal()
    }

    window.addEventListener('keydown', handleWindowKeyDown, true)

    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown, true)
    }
  }, [focusTerminal, focusedSessionId, isReady, sessionId, write])

  useEffect(() => {
    if (!isReady || bellVersion === 0) return
    if (settings.bellStyle === 'none') return

    if (settings.bellStyle === 'sound') {
      playBellTone()
      return
    }

    const rootElement = rootRef.current
    if (!rootElement) return

    if (visualBellTimerRef.current !== null) {
      window.clearTimeout(visualBellTimerRef.current)
    }

    rootElement.classList.add('terminal-host-root--bell')
    visualBellTimerRef.current = window.setTimeout(() => {
      rootElement.classList.remove('terminal-host-root--bell')
      visualBellTimerRef.current = null
    }, 120)

    return () => {
      if (visualBellTimerRef.current !== null) {
        window.clearTimeout(visualBellTimerRef.current)
        visualBellTimerRef.current = null
      }
      rootElement.classList.remove('terminal-host-root--bell')
    }
  }, [bellVersion, isReady, settings.bellStyle])

  const handleFindNext = useCallback(() => {
    const searchAddon = searchAddonRef.current
    if (!searchAddon || !findQuery) return
    searchAddon.findNext(findQuery, { incremental: true, caseSensitive: false })
  }, [findQuery])

  const handleFindPrevious = useCallback(() => {
    const searchAddon = searchAddonRef.current
    if (!searchAddon || !findQuery) return
    searchAddon.findPrevious(findQuery, { incremental: true, caseSensitive: false })
  }, [findQuery])

  useEffect(() => {
    if (!isFindOpen) return
    const frame = window.requestAnimationFrame(() => {
      findInputRef.current?.focus()
      findInputRef.current?.select()
    })
    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [isFindOpen])

  useEffect(() => {
    if (!isFindOpen || !findQuery) return
    const searchAddon = searchAddonRef.current
    if (!searchAddon) return
    searchAddon.findNext(findQuery, { incremental: true, caseSensitive: false })
  }, [findQuery, isFindOpen])

  return (
    <div
      className="terminal-host-root"
      ref={rootRef}
      onPointerDown={(event) => {
        const target = event.target
        if (
          target instanceof Element &&
          target.closest('.terminal-find-bar, .terminal-find-input, .terminal-find-btn')
        ) {
          return
        }
        focusTerminal()
      }}
    >
      <div
        className="terminal-host-surface"
        ref={containerRef}
        onMouseDown={() => {
          focusTerminal()
        }}
      />

      {isFindOpen ? (
        <div className="terminal-find-bar">
          <input
            ref={findInputRef}
            type="text"
            value={findQuery}
            onChange={(event) => setFindQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                handleFindNext()
              }
              if (event.key === 'Escape') {
                event.preventDefault()
                setIsFindOpen(false)
              }
            }}
            placeholder="Find in terminal"
            className="terminal-find-input"
          />
          <button type="button" className="terminal-find-btn" onClick={handleFindPrevious}>
            Prev
          </button>
          <button type="button" className="terminal-find-btn" onClick={handleFindNext}>
            Next
          </button>
          <button
            type="button"
            className="terminal-find-btn"
            onClick={() => {
              setIsFindOpen(false)
            }}
            aria-label="Close search"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  )
}

export { XtermHost }
export type { XtermHostProps }
