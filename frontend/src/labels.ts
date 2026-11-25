import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { faCalendar, faCalendarXmark, faCircle } from '@fortawesome/free-regular-svg-icons'
import {
  faChevronDown,
  faChevronUp,
  faCircleCheck,
  faCircleHalfStroke,
  faCircleXmark,
  faClock,
  faMinus,
} from '@fortawesome/free-solid-svg-icons'
import { isOverdue } from './dates'
import enums from './shared/enums.json'

export type Label = { icon: IconDefinition; color: string; text: string }

const STAGE_LABELS: Record<string, Label> = {
  open: { icon: faCircle, color: 'text-lichen', text: 'Open' },
  inProgress: { icon: faCircleHalfStroke, color: 'text-clover', text: 'In progress' },
  waiting: { icon: faClock, color: 'text-clover', text: 'Waiting' },
  done: { icon: faCircleCheck, color: 'text-clover', text: 'Done' },
  cancelled: { icon: faCircleXmark, color: 'text-lichen', text: 'Cancelled' },
}

export const STAGES = enums.stages

export const isCompleted = (stage: string) => stage === 'done' || stage === 'cancelled'

export const stageLabel = (stage: string) =>
  STAGE_LABELS[stage] ?? { icon: faCircle, color: 'text-lichen', text: stage }

const PRIORITY_LABELS: Record<string, Label> = {
  high: { icon: faChevronUp, color: 'text-rosehip', text: 'High' },
  medium: { icon: faMinus, color: 'text-lichen', text: 'Medium' },
  low: { icon: faChevronDown, color: 'text-cornflower', text: 'Low' },
}

export const PRIORITIES = enums.priorities

export const priorityLabel = (priority: string) =>
  PRIORITY_LABELS[priority] ?? { icon: faMinus, color: 'text-lichen', text: priority }

export const dueIcon = (due: string | null): Label =>
  due && isOverdue(due)
    ? { icon: faCalendarXmark, color: 'text-rosehip', text: 'Overdue' }
    : { icon: faCalendar, color: 'text-lichen', text: 'Due' }
