import {
  formatDueDate,
  isOverdue,
  nextMonday,
  relativeDayLabel,
  today,
  tomorrow,
} from '../../src/dates'

const now = new Date('2026-11-08T17:00:00Z') // Sunday

test('today and tomorrow', () => {
  expect(today(now)).toBe('2026-11-08')
  expect(tomorrow(now)).toBe('2026-11-09')
})

test('nextMonday is strictly after today', () => {
  expect(nextMonday(now)).toBe('2026-11-09')
  expect(nextMonday(new Date('2026-11-09T17:00:00Z'))).toBe('2026-11-16')
  expect(nextMonday(new Date('2026-11-11T17:00:00Z'))).toBe('2026-11-16')
})

test('formatDueDate', () => {
  expect(formatDueDate('2026-11-07', now)).toBe('Yesterday')
  expect(formatDueDate('2026-11-08', now)).toBe('Today')
  expect(formatDueDate('2026-11-09', now)).toBe('Tomorrow')
  expect(formatDueDate('2026-11-15', now)).toBe('Sun Nov 15')
})

test('isOverdue', () => {
  expect(isOverdue('2026-11-07', now)).toBe(true)
  expect(isOverdue('2026-11-08', now)).toBe(false)
})

test('relativeDayLabel', () => {
  expect(relativeDayLabel('2026-11-07', now)).toBe('Yesterday')
  expect(relativeDayLabel('2026-11-08', now)).toBe('Today')
  expect(relativeDayLabel('2026-11-09', now)).toBe('Tomorrow')
  expect(relativeDayLabel('2026-11-06', now)).toBeUndefined()
  expect(relativeDayLabel('2026-11-10', now)).toBeUndefined()
})
