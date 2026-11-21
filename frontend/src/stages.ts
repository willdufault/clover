import type { Stage } from './types'

export const isCompleted = (stage: Stage) => stage === 'done' || stage === 'cancelled'
