import { useCallback, useState, useSyncExternalStore } from 'react'

const useMediaQuery = (query: string) => {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mediaQuery = window.matchMedia(query)
      mediaQuery.addEventListener('change', onChange)
      return () => mediaQuery.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches)
}

export const useOverlays = (hasDetail: boolean) => {
  const [rawDrawerOpen, setDrawerOpen] = useState(false)
  const narrow = !useMediaQuery('(min-width: 1024px)')
  const xlUp = useMediaQuery('(min-width: 1280px)')
  const drawerOpen = rawDrawerOpen && narrow
  const detailModal = hasDetail && !xlUp
  return { drawerOpen, setDrawerOpen, detailModal, mainInert: drawerOpen || detailModal }
}
