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
  const handle = (method: string, url: string, body?: unknown) => {
    const { status, body: response } = route(method, url, body)
    return { status, body: response && structuredClone(response) }
  }
  const route = (method: string, url: string, body?: unknown): { status: number; body?: object } => {
    const kind = new URL(url).pathname.split('/')[1] as Kind | 'data'
    if (kind === 'data') return { status: 200, body: data }
    const items = data[kind]
    if (method === 'POST') {
      const item = { id: `new-${nextId++}`, ...DEFAULTS[kind], ...(body as object) }
      items.push(item)
      return { status: 201, body: item }
    }
    // PATCH and DELETE are batch and all-or-nothing.
    const batch = method === 'PATCH' ? body : (body as { ids?: unknown } | undefined)?.ids
    if (!Array.isArray(batch) || batch.length < 1 || batch.length > 100) return { status: 400, body: { error: 'bad request' } }
    const ids = method === 'PATCH' ? batch.map((patch) => patch?.id) : batch
    if (ids.some((id) => typeof id !== 'string')) return { status: 400, body: { error: 'bad request' } }
    if (ids.some((id) => !items.some((item) => item.id === id))) return { status: 404, body: { error: 'not found' } }
    if (method === 'PATCH') {
      return { status: 200, body: batch.map((patch) => Object.assign(items.find((item) => item.id === patch.id)!, patch)) }
    }
    data[kind] = items.filter((item) => !ids.includes(item.id))
    if (kind === 'lists') data.tasks = data.tasks.filter((task) => !ids.includes(task.listId))
    const taskIds = new Set(data.tasks.map((task) => task.id))
    data.steps = data.steps.filter((step) => taskIds.has(step.taskId as string))
    return { status: 204 }
  }
  return { data, handle }
}
