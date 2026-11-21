import * as fc from 'fast-check'
import { formatDueDate, isOverdue, nextMonday, relativeDayLabel, today, tomorrow } from '../../src/dates'

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
  expect(formatDueDate('2026-11-08', now)).toBe('Today')
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

const utc = (date: string) => Date.parse(`${date}T00:00:00Z`)
const iso = (time: number) => new Date(time).toISOString().slice(0, 10)
const daysBetween = (from: string, to: string) => (utc(to) - utc(from)) / 86_400_000
const labels: Record<number, string> = { [-1]: 'Yesterday', 0: 'Today', 1: 'Tomorrow' }

const range = { min: new Date('1970-01-01T00:00:00Z'), max: new Date('2100-12-31T23:59:59Z'), noInvalidDate: true }
const nowArb = fc.date(range)
const dateArb = fc.oneof(
  fc.date(range).map((date) => iso(date.getTime())),
  fc.constantFrom('2000-02-29', '2024-02-29', '2100-02-28', '2100-03-01', '1999-12-31', '2000-01-01', '2026-01-31'),
)

test('today matches YYYY-MM-DD', () => {
  fc.assert(
    fc.property(nowArb, (instant) => {
      expect(today(instant)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }),
  )
})

test('tomorrow is one day after today', () => {
  fc.assert(
    fc.property(nowArb, (instant) => {
      expect(daysBetween(today(instant), tomorrow(instant))).toBe(1)
    }),
  )
})

test('nextMonday is a Monday within 1 to 7 days after today', () => {
  fc.assert(
    fc.property(nowArb, (instant) => {
      const monday = nextMonday(instant)
      const days = daysBetween(today(instant), monday)
      expect(new Date(utc(monday)).getUTCDay()).toBe(1)
      expect(days).toBeGreaterThanOrEqual(1)
      expect(days).toBeLessThanOrEqual(7)
    }),
  )
})

test('formatDueDate labels exactly yesterday, today and tomorrow', () => {
  fc.assert(
    fc.property(dateArb, fc.integer({ min: -3, max: 3 }), nowArb, (date, offset, instant) => {
      const todayDate = today(instant)
      for (const due of [date, iso(utc(todayDate) + offset * 86_400_000)]) {
        const result = formatDueDate(due, instant)
        expect(Object.values(labels).find((label) => label === result)).toBe(labels[daysBetween(todayDate, due)])
      }
    }),
  )
})

test('isOverdue iff due is before today', () => {
  fc.assert(
    fc.property(dateArb, nowArb, (due, instant) => {
      expect(isOverdue(due, instant)).toBe(daysBetween(today(instant), due) < 0)
    }),
  )
})
