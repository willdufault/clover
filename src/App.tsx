import { useState } from 'react'

type Todo = { id: string; text: string; done: boolean; subitems: Todo[] }
type TodoList = { id: string; name: string; todos: Todo[] }

const seedLists: TodoList[] = [
  {
    id: 'groceries',
    name: 'Groceries',
    todos: [
      {
        id: 'g1',
        text: 'Milk',
        done: false,
        subitems: [
          { id: 'g1a', text: '2% lactose free', done: false, subitems: [] },
        ],
      },
      { id: 'g2', text: 'Eggs', done: false, subitems: [] },
    ],
  },
  {
    id: 'work',
    name: 'Work',
    todos: [
      { id: 'w1', text: 'Reply to emails', done: false, subitems: [] },
      { id: 'w2', text: 'Update docs', done: false, subitems: [] },
      { id: 'w3', text: 'Review PR', done: false, subitems: [] },
    ],
  },
  { id: 'home', name: 'Home', todos: [] },
]

export default function App() {
  const [lists, setLists] = useState(seedLists)
  const [selectedId, setSelectedId] = useState(seedLists[0].id)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [subText, setSubText] = useState('')

  const list = lists.find((l) => l.id === selectedId)
  if (!list) return null
  const selectedItem = list.todos.find((t) => t.id === selectedItemId)

  const updateTodos = (listId: string, fn: (todos: Todo[]) => Todo[]) => {
    setLists(lists.map((l) => (l.id === listId ? { ...l, todos: fn(l.todos) } : l)))
  }

  // Swap the selected item's subitems through fn.
  const updateSubitems = (fn: (subitems: Todo[]) => Todo[]) => {
    updateTodos(selectedId, (todos) =>
      todos.map((t) => (t.id === selectedItemId ? { ...t, subitems: fn(t.subitems) } : t)),
    )
  }

  const addTodo = () => {
    if (!text.trim()) return
    updateTodos(selectedId, (todos) => [
      { id: crypto.randomUUID(), text, done: false, subitems: [] },
      ...todos,
    ])
    setText('')
  }

  const addSubitem = () => {
    if (!subText.trim() || !selectedItem) return
    updateSubitems((subitems) => [
      { id: crypto.randomUUID(), text: subText, done: false, subitems: [] },
      ...subitems,
    ])
    setSubText('')
  }

  // Move an item right after the last open (unchecked) item:
  // checked items land at the top of the done section,
  // unchecked items land at the bottom of the open section.
  const moveAfterLastOpen = (todos: Todo[], id: string): Todo[] => {
    const item = todos.find((t) => t.id === id)
    if (!item) return todos
    const rest = todos.filter((t) => t.id !== id)
    const lastOpen = rest.reduce((acc, t, i) => (!t.done ? i : acc), -1)
    return [
      ...rest.slice(0, lastOpen + 1),
      item,
      ...rest.slice(lastOpen + 1),
    ]
  }

  const toggleTodo = (id: string) => {
    updateTodos(selectedId, (todos) => {
      const flipped = todos.map((t) =>
        t.id === id ? { ...t, done: !t.done } : t,
      )
      return moveAfterLastOpen(flipped, id)
    })
  }

  const toggleSubitem = (id: string) => {
    updateSubitems((subitems) => {
      const flipped = subitems.map((t) =>
        t.id === id ? { ...t, done: !t.done } : t,
      )
      return moveAfterLastOpen(flipped, id)
    })
  }

  const deleteTodo = (id: string) => {
    updateTodos(selectedId, (todos) => todos.filter((t) => t.id !== id))
  }

  const deleteSubitem = (id: string) => {
    updateSubitems((subitems) => subitems.filter((t) => t.id !== id))
  }

  return (
    <div className="flex min-h-screen flex-col font-sans">
      <header className="flex h-12 shrink-0 items-center bg-gray-200 px-4">
        <span className="font-semibold text-gray-800">todo</span>
      </header>

      <div className="flex flex-1">
        <nav className="flex w-64 shrink-0 flex-col gap-1 border-r border-gray-200 bg-gray-100 p-3">
          {lists.map((l) => (
            <button
              key={l.id}
              onClick={() => {
                setSelectedId(l.id)
                setSelectedItemId(null)
              }}
              className={
                l.id === selectedId
                  ? 'rounded-md bg-gray-200 px-3 py-1.5 text-left text-sm font-medium text-gray-800'
                  : 'rounded-md px-3 py-1.5 text-left text-sm text-gray-600 hover:bg-gray-200/60'
              }
            >
              {l.name}
            </button>
          ))}
        </nav>

        <main className="flex-1 p-6">
          <h1 className="font-semibold text-gray-800">{list.name}</h1>

          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTodo()}
            placeholder="Add a todo and press Enter"
            className="mt-4 w-full rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:border-blue-500"
          />

          <ul className="mt-4 w-full">
            {list.todos.map((todo) => (
              <li
                key={todo.id}
                onClick={() => setSelectedItemId(todo.id)}
                className="group flex cursor-pointer items-center gap-3 border-b border-gray-100 py-2"
              >
                <input
                  type="checkbox"
                  checked={todo.done}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggleTodo(todo.id)}
                  className="size-4 accent-blue-500"
                />
                <span
                  className={
                    todo.done ? 'text-gray-400 line-through' : 'text-gray-800'
                  }
                >
                  {todo.text}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteTodo(todo.id)
                  }}
                  className="ml-auto rounded text-gray-400 opacity-0 transition hover:text-red-500 group-hover:opacity-100"
                  aria-label={`Delete ${todo.text}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>

          {list.todos.length === 0 && (
            <p className="mt-4 text-sm text-gray-400">No todos yet</p>
          )}
        </main>

        {selectedItem && (
          <aside className="w-72 shrink-0 border-l border-gray-200 bg-gray-100 p-3">
            <div className="flex items-center">
              <h2 className="font-semibold text-gray-800">{selectedItem.text}</h2>
              <button
                onClick={() => setSelectedItemId(null)}
                className="ml-auto rounded text-gray-400 hover:text-gray-600"
                aria-label="Close panel"
              >
                ✕
              </button>
            </div>

            <input
              value={subText}
              onChange={(e) => setSubText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSubitem()}
              placeholder="Add a subitem and press Enter"
              className="mt-4 w-full rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:border-blue-500"
            />

            <ul className="mt-4 w-full">
              {selectedItem.subitems.map((item) => (
                <li
                  key={item.id}
                  className="group flex items-center gap-3 border-b border-gray-200 py-2"
                >
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() => toggleSubitem(item.id)}
                    className="size-4 accent-blue-500"
                  />
                  <span
                    className={
                      item.done ? 'text-gray-400 line-through' : 'text-gray-800'
                    }
                  >
                    {item.text}
                  </span>
                  <button
                    onClick={() => deleteSubitem(item.id)}
                    className="ml-auto rounded text-gray-400 opacity-0 transition hover:text-red-500 group-hover:opacity-100"
                    aria-label={`Delete ${item.text}`}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>

            {selectedItem.subitems.length === 0 && (
              <p className="mt-4 text-sm text-gray-400">No subitems yet</p>
            )}
          </aside>
        )}
      </div>
    </div>
  )
}
