import {
  formatDue,
  isOverdue,
  nextMonday,
  relativeDay,
  today,
  tomorrow,
} from '../src/due'

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

test('formatDue', () => {
  expect(formatDue('2026-11-07', now)).toBe('Yesterday')
  expect(formatDue('2026-11-08', now)).toBe('Today')
  expect(formatDue('2026-11-09', now)).toBe('Tomorrow')
  expect(formatDue('2026-11-15', now)).toBe('Sun Nov 15')
})

test('isOverdue', () => {
  expect(isOverdue('2026-11-07', now)).toBe(true)
  expect(isOverdue('2026-11-08', now)).toBe(false)
})

test('relativeDay', () => {
  expect(relativeDay('2026-11-07', now)).toBe('Yesterday')
  expect(relativeDay('2026-11-08', now)).toBe('Today')
  expect(relativeDay('2026-11-09', now)).toBe('Tomorrow')
  expect(relativeDay('2026-11-06', now)).toBeUndefined()
  expect(relativeDay('2026-11-10', now)).toBeUndefined()
})
