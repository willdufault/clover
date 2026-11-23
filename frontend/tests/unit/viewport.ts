export const stubViewport = (width: number, coarse = false) =>
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('coarse') ? coarse : width >= Number(/\d+/.exec(query)?.[0]),
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
