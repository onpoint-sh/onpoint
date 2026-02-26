const params = new URLSearchParams(window.location.search)

export const IS_DETACHED_WINDOW = params.has('detached')

export const WINDOW_ID: string = params.get('windowId') ?? 'main'
