import type { Task } from '../../src/types'
import { TODAY_LIST_ID, tasksInList } from '../../src/smartLists'

const makeTask = (id: string): Task => ({ id, title: id, steps: [], stage: 'open', priority: 'medium', due: null, listId: null, addedToToday: false })

test('Today view shows only tasks added to Today, whatever their due date', () => {
  const tasks: Task[] = [
    { ...makeTask('flag'), addedToToday: true },
    { ...makeTask('due'), due: '2000-01-01' },
    makeTask('plain'),
  ]
  expect(tasksInList(tasks, TODAY_LIST_ID).map((task) => task.id)).toEqual(['flag'])
})
