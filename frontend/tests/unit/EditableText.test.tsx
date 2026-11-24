import { fireEvent, render, screen } from '@testing-library/react'
import { EditableText } from '../../src/components/EditableText'

test('committing an unchanged value does not call onCommit', () => {
  const onCommit = vi.fn()
  render(<EditableText tag="span" text="Name" maxLength={50} className="" inputClassName="" onCommit={onCommit} />)
  fireEvent.click(screen.getByText('Name'))
  const input = screen.getByRole('textbox')
  fireEvent.change(input, { target: { value: ' Name ' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(onCommit).not.toHaveBeenCalled()
})
