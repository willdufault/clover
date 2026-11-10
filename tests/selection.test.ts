import { nextSelection } from '../src/selection'

const order = ['a', 'b', 'c', 'd']
const plain = { ctrl: false, shift: false }

describe('nextSelection', () => {
  test('plain click selects only the clicked id', () => {
    expect(nextSelection(['a', 'b'], order, 'b', plain)).toEqual(['b'])
  })
  test('ctrl-click appends or removes', () => {
    const ctrl = { ctrl: true, shift: false }
    expect(nextSelection(['a'], order, 'c', ctrl)).toEqual(['a', 'c'])
    expect(nextSelection(['a', 'c'], order, 'a', ctrl)).toEqual(['c'])
  })
  test('shift-click appends the range from the last item, skipping duplicates', () => {
    const shift = { ctrl: false, shift: true }
    expect(nextSelection(['b'], order, 'd', shift)).toEqual(['b', 'c', 'd'])
    expect(nextSelection(['d', 'b'], order, 'a', shift)).toEqual(['d', 'b', 'a'])
    expect(nextSelection(['a', 'c'], order, 'a', shift)).toEqual(['a', 'c', 'b'])
  })
  test('shift-click without a last item acts as a plain click', () => {
    expect(nextSelection([], order, 'c', { ctrl: false, shift: true })).toEqual(['c'])
  })
})
