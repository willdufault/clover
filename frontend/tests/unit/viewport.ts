export const stubViewport = (width: number) =>
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: width >= Number(/\d+/.exec(query)?.[0]),
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
