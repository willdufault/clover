import { moveAfterIncomplete } from '../../src/stages'

type Item = { id: string; open: boolean }
const isCompleted = (item: Item) => !item.open
const ids = (items: Item[]) => items.map((item) => item.id)

test('moves a closed item right after the last open one, above earlier closed items', () => {
  const items = [
    { id: 'a', open: false },
    { id: 'b', open: true },
    { id: 'c', open: true },
    { id: 'd', open: false },
  ]
  expect(ids(moveAfterIncomplete(items, 'a', isCompleted))).toEqual(['b', 'c', 'a', 'd'])
})

test('moves a reopened item to the bottom of the open items', () => {
  const items = [
    { id: 'a', open: true },
    { id: 'b', open: false },
    { id: 'c', open: true },
    { id: 'd', open: false },
  ]
  expect(ids(moveAfterIncomplete(items, 'c', isCompleted))).toEqual(['a', 'c', 'b', 'd'])
})

test('returns the same array for an unknown id', () => {
  const items = [{ id: 'a', open: true }]
  expect(moveAfterIncomplete(items, 'zzz', isCompleted)).toBe(items)
})
