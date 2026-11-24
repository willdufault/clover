import { useState, useSyncExternalStore } from 'react'

const useMedia = (query: string) =>
  useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
  )

export const useOverlays = (hasDetail: boolean) => {
  const [rawDrawerOpen, setDrawerOpen] = useState(false)
  const narrow = !useMedia('(min-width: 1024px)')
  const xlUp = useMedia('(min-width: 1280px)')
  const drawerOpen = rawDrawerOpen && narrow
  const detailModal = hasDetail && !xlUp
  return { drawerOpen, setDrawerOpen, detailModal, mainInert: drawerOpen || detailModal }
}
