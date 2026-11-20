import type { Task } from '../../src/types'
import { task } from '../fakeBackend'

export const makeTask = (id: string, patch: Partial<Task> = {}): Task => ({ ...task(id, id, null), steps: [], ...patch }) as Task
