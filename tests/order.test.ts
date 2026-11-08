import { moveAfterLastOpen } from '../src/order'

type Item = { id: string; open: boolean }
const isOpen = (item: Item) => item.open
const ids = (items: Item[]) => items.map((item) => item.id)

test('moves a closed item right after the last open one, above earlier closed items', () => {
  const items = [
    { id: 'a', open: false },
    { id: 'b', open: true },
    { id: 'c', open: true },
    { id: 'd', open: false },
  ]
  expect(ids(moveAfterLastOpen(items, 'a', isOpen))).toEqual(['b', 'c', 'a', 'd'])
})

test('moves a reopened item to the bottom of the open items', () => {
  const items = [
    { id: 'a', open: true },
    { id: 'b', open: false },
    { id: 'c', open: true },
    { id: 'd', open: false },
  ]
  expect(ids(moveAfterLastOpen(items, 'c', isOpen))).toEqual(['a', 'c', 'b', 'd'])
})

test('returns the same array for an unknown id', () => {
  const items = [{ id: 'a', open: true }]
  expect(moveAfterLastOpen(items, 'zzz', isOpen)).toBe(items)
})
