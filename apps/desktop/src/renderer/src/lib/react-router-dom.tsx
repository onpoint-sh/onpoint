/* eslint-disable react-refresh/only-export-components */
import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'

type RouterLocation = {
  pathname: string
}

type NavigateOptions = {
  replace?: boolean
}

type RouterContextValue = {
  location: RouterLocation
  navigate: (to: string, options?: NavigateOptions) => void
}

type RouteProps = {
  path: string
  element: ReactNode
}

type NavigateProps = {
  to: string
  replace?: boolean
}

const RouterContext = createContext<RouterContextValue | null>(null)

function normalizePathname(pathname: string): string {
  if (!pathname) return '/'
  if (pathname === '#') return '/'

  let normalizedPathname = pathname

  if (normalizedPathname.startsWith('#')) {
    normalizedPathname = normalizedPathname.slice(1)
  }

  if (!normalizedPathname.startsWith('/')) {
    normalizedPathname = `/${normalizedPathname}`
  }

  if (normalizedPathname.length > 1 && normalizedPathname.endsWith('/')) {
    normalizedPathname = normalizedPathname.slice(0, -1)
  }

  return normalizedPathname
}

function getHashPathname(): string {
  return normalizePathname(window.location.hash)
}

function writeHashPathname(pathname: string, options?: NavigateOptions): void {
  const normalizedPathname = normalizePathname(pathname)
  const hashValue = `#${normalizedPathname}`

  if (options?.replace) {
    const currentUrl = new URL(window.location.href)
    currentUrl.hash = hashValue
    window.history.replaceState(null, '', currentUrl)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    return
  }

  window.location.hash = hashValue
}

function HashRouter({ children }: { children: ReactNode }): React.JSX.Element {
  const [location, setLocation] = useState<RouterLocation>(() => ({ pathname: getHashPathname() }))

  useEffect(() => {
    if (!window.location.hash) {
      writeHashPathname('/', { replace: true })
    }

    const handleHashChange = (): void => {
      setLocation({ pathname: getHashPathname() })
    }

    window.addEventListener('hashchange', handleHashChange)

    return () => {
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [])

  const navigate = useCallback((to: string, options?: NavigateOptions) => {
    writeHashPathname(to, options)
  }, [])

  const value = useMemo<RouterContextValue>(() => ({ location, navigate }), [location, navigate])

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
}

function useRouterContext(): RouterContextValue {
  const context = useContext(RouterContext)

  if (!context) {
    throw new Error('Router hooks must be used inside <HashRouter>.')
  }

  return context
}

function useLocation(): RouterLocation {
  return useRouterContext().location
}

function useNavigate(): RouterContextValue['navigate'] {
  return useRouterContext().navigate
}

function Route(props: RouteProps): null {
  void props
  return null
}

function isRouteMatch(routePath: string, pathname: string): boolean {
  if (routePath === '*') return true
  return normalizePathname(routePath) === normalizePathname(pathname)
}

function Routes({ children }: { children: ReactNode }): React.JSX.Element | null {
  const { pathname } = useLocation()
  const routeChildren = Children.toArray(children)

  for (const child of routeChildren) {
    if (!isValidElement<RouteProps>(child)) continue
    if (child.type !== Route) continue

    if (isRouteMatch(child.props.path, pathname)) {
      return <>{child.props.element}</>
    }
  }

  return null
}

function Navigate({ to, replace = false }: NavigateProps): null {
  const navigate = useNavigate()

  useEffect(() => {
    navigate(to, { replace })
  }, [navigate, replace, to])

  return null
}

export { HashRouter, Navigate, Route, Routes, useLocation, useNavigate }
