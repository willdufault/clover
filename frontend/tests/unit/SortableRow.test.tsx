import { act, fireEvent, render, screen } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'
import { SortableContext } from '@dnd-kit/sortable'
import { SortableRow } from '../../src/components/SortableRow'
import { RowKind } from '../../src/types'

const renderRow = (onContextMenu = vi.fn()) => {
  render(
    <DndContext>
      <SortableContext items={['a']}>
        <SortableRow
          id="a"
          kind={RowKind.Task}
          text="Row"
          tag="div"
          className=""
          onClick={() => {}}
          onContextMenu={onContextMenu}
        >
          Row
        </SortableRow>
      </SortableContext>
    </DndContext>,
  )
  return screen.getByText('Row')
}

const touch = (x: number, y: number) => ({ touches: [{ clientX: x, clientY: y }] })

describe('SortableRow long press', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  test('shows pressing state during a hold', () => {
    const row = renderRow()
    expect(row).not.toHaveClass('motion-safe:scale-[0.98]')
    fireEvent.touchStart(row, touch(0, 0))
    expect(row).toHaveClass('motion-safe:scale-[0.98]')
  })
  test('clears pressing state when the touch moves away', () => {
    const row = renderRow()
    fireEvent.touchStart(row, touch(0, 0))
    fireEvent.touchMove(row, touch(20, 0))
    expect(row).not.toHaveClass('motion-safe:scale-[0.98]')
  })
  test('clears pressing state when the long press fires', () => {
    const onContextMenu = vi.fn()
    const row = renderRow(onContextMenu)
    fireEvent.touchStart(row, touch(5, 6))
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(onContextMenu).toHaveBeenCalledWith({ clientX: 5, clientY: 6 }, 'Row')
    expect(row).not.toHaveClass('motion-safe:scale-[0.98]')
  })
})
