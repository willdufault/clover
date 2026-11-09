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
    subtasks: [{ id: 'g1a', text: '2% lactose free', done: false }],
  },
  { id: 'g2', text: 'Eggs', stage: 'open', listId: 'groceries', subtasks: [] },
  { id: 'w1', text: 'Reply to emails', stage: 'open', listId: 'work', subtasks: [] },
  { id: 'w2', text: 'Update docs', stage: 'open', listId: 'work', subtasks: [] },
  { id: 'w3', text: 'Review PR', stage: 'open', listId: 'work', subtasks: [] },
]
