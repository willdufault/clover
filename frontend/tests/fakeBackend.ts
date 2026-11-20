import limits from '../../backend/limits.json' with { type: 'json' }

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

const BAD_REQUEST = { status: 400, body: { error: 'Bad request' } }

const batchSizeOk = (size: number) => size >= 1 && size <= limits.batchMax

const update = (items: Item[], patches: Item[]) => {
  if (patches.some((patch) => !items.some((item) => item.id === patch.id)))
    return { status: 404, body: { error: 'Not found' } }
  return {
    status: 200,
    body: patches.flatMap((patch) =>
      items.filter((item) => item.id === patch.id).map((item) => Object.assign(item, patch)),
    ),
  }
}

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
    if (method === 'POST') return create(kind, body)
    // PATCH and DELETE are batch and all-or-nothing.
    const batch = method === 'PATCH' ? body : (body as { ids?: unknown } | undefined)?.ids
    if (!Array.isArray(batch) || !batchSizeOk(batch.length)) return BAD_REQUEST
    const ids = method === 'PATCH' ? batch.map((patch) => patch?.id) : batch
    if (ids.some((id) => typeof id !== 'string')) return BAD_REQUEST
    return method === 'PATCH' ? update(data[kind], batch) : remove(kind, ids)
  }
  const create = (kind: Kind, body: unknown) => {
    const item = { id: `new-${nextId++}`, ...DEFAULTS[kind], ...(body as object) }
    data[kind].push(item)
    return { status: 201, body: item }
  }
  const remove = (kind: Kind, ids: unknown[]) => {
    data[kind] = data[kind].filter((item) => !ids.includes(item.id))
    if (kind === 'lists') data.tasks = data.tasks.filter((t) => !ids.includes(t.listId))
    const taskIds = new Set(data.tasks.map((t) => t.id))
    data.steps = data.steps.filter((step) => taskIds.has(step.taskId as string))
    return { status: 204 }
  }
  return { data, handle }
}
