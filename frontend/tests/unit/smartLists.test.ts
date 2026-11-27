import type { Task } from '../../src/types'
import { ALL_LIST_ID, TODAY_LIST_ID, neighborListId, tasksInList } from '../../src/smartLists'
import { makeTask } from './makeTask'

test('Today view shows only tasks added to Today, whatever their due date', () => {
  const tasks: Task[] = [
    makeTask('flag', { addedToToday: true }),
    makeTask('due', { due: '2000-01-01' }),
    makeTask('plain'),
  ]
  expect(tasksInList(tasks, TODAY_LIST_ID).map((task) => task.id)).toEqual(['flag'])
})

test('deleting lists selects the nearest surviving list before them, else the first, else All', () => {
  const lists = ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id, order: 0 }))
  expect(neighborListId(lists, ['c'])).toBe('b')
  expect(neighborListId(lists, ['b', 'c'])).toBe('a')
  expect(neighborListId(lists, ['a', 'b'])).toBe('c')
  expect(neighborListId(lists, ['a', 'b', 'c', 'd'])).toBe(ALL_LIST_ID)
})
