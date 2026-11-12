import type { Task, TaskList } from './types'

export const SEED_LISTS: TaskList[] = [
  { id: 'groceries', name: 'Groceries' },
  { id: 'work', name: 'Work' },
  { id: 'home', name: 'Home' },
]

export const SEED_TASKS: Task[] = [
  {
    id: 'g1',
    text: 'Milk',
    stage: 'open',
    listId: 'groceries',
    steps: [{ id: 'g1a', text: '2% lactose free', completed: false }],
  },
  { id: 'g2', text: 'Eggs', stage: 'open', listId: 'groceries', steps: [] },
  { id: 'w1', text: 'Reply to emails', stage: 'open', listId: 'work', steps: [] },
  { id: 'w2', text: 'Update docs', stage: 'open', listId: 'work', steps: [] },
  { id: 'w3', text: 'Review PR', stage: 'open', listId: 'work', steps: [] },
]
