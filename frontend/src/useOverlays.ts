import { useEffect, useState } from 'react'

const useMedia = (query: string) => {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const list = window.matchMedia(query)
    const onChange = () => setMatches(list.matches)
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [query])
  return matches
}

// Below lg the lists sidebar is a drawer; below xl task detail overlays the task list.
export const useOverlays = (hasDetail: boolean) => {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const narrow = !useMedia('(min-width: 1024px)')
  const xlUp = useMedia('(min-width: 1280px)')
  const [wasNarrow, setWasNarrow] = useState(narrow)
  if (narrow !== wasNarrow) {
    setWasNarrow(narrow)
    setDrawerOpen(false)
  }
  const detailModal = hasDetail && !xlUp
  return {
    drawerOpen,
    setDrawerOpen,
    detailModal,
    mainInert: drawerOpen || detailModal,
  }
}
