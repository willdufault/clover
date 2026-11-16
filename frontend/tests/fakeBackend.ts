// In-memory stand-in for the backend API, shared by unit and e2e tests.
type Item = Record<string, unknown> & { id: string }
type Kind = 'lists' | 'tasks' | 'steps'

const DEFAULTS: Record<Kind, Record<string, unknown>> = {
  lists: {},
  tasks: { stage: 'open', due: null, priority: 'medium', addedToToday: false, listId: null },
  steps: { completed: false },
}

export const task = (id: string, title: string, listId: string | null) => ({ ...DEFAULTS.tasks, id, title, listId })

export const seed = () => ({
  lists: [
    { id: 'groceries', name: 'Groceries' },
    { id: 'work', name: 'Work' },
    { id: 'home', name: 'Home' },
  ] as Item[],
  tasks: [
    task('g1', 'Milk', 'groceries'),
    task('g2', 'Eggs', 'groceries'),
    task('w1', 'Reply to emails', 'work'),
    task('w2', 'Update docs', 'work'),
    task('w3', 'Review PR', 'work'),
  ] as Item[],
  steps: [{ id: 'g1a', taskId: 'g1', title: '2% lactose free', completed: false }] as Item[],
})

export const createFakeBackend = (data = seed()) => {
  let nextId = 1
  // Responses are copies, like JSON over the wire.
  const handle = (method: string, url: string, body?: Record<string, unknown>) => {
    const { status, body: response } = route(method, url, body)
    return { status, body: response && structuredClone(response) }
  }
  const route = (method: string, url: string, body?: Record<string, unknown>): { status: number; body?: object } => {
    const [, kind, id] = new URL(url).pathname.split('/') as [string, Kind | 'data', string?]
    if (kind === 'data') return { status: 200, body: data }
    const items = data[kind]
    if (method === 'POST') {
      const item = { id: `new-${nextId++}`, ...DEFAULTS[kind], ...body }
      items.push(item)
      return { status: 201, body: item }
    }
    const item = items.find((other) => other.id === id)
    if (!item) return { status: 404, body: { error: 'not found' } }
    if (method === 'PATCH') {
      Object.assign(item, body)
      return { status: 200, body: item }
    }
    data[kind] = items.filter((other) => other !== item)
    if (kind === 'lists') data.tasks = data.tasks.filter((other) => other.listId !== id)
    const taskIds = new Set(data.tasks.map((other) => other.id))
    data.steps = data.steps.filter((step) => taskIds.has(step.taskId as string))
    return { status: 204 }
  }
  return { data, handle }
}
