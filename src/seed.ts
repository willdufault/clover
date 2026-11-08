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
    listId: 'groceries',
    subtasks: [{ id: 'g1a', text: '2% lactose free', done: false }],
  },
  { id: 'g2', text: 'Eggs', listId: 'groceries', subtasks: [] },
  { id: 'w1', text: 'Reply to emails', listId: 'work', subtasks: [] },
  { id: 'w2', text: 'Update docs', listId: 'work', subtasks: [] },
  { id: 'w3', text: 'Review PR', listId: 'work', subtasks: [] },
]
