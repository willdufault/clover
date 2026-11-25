import { useState } from 'react'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircle, faSun as faSunRegular, faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { faChevronDown, faCircleCheck, faListUl, faSun, faXmark } from '@fortawesome/free-solid-svg-icons'
import { formatDueDate, isOverdue } from '../dates'
import { dueIcon, PRIORITIES, priorityLabel, STAGES, stageLabel, type Label } from '../labels'
import {
  PROPERTY_ROW_CLASS,
  ICON_SLOT_CLASS,
  RENAME_CLASS,
  SAFE_AREA_CLASS,
  ICON_BUTTON_CLASS,
  TITLE_RENAME_CLASS,
  TRAILING_ICON_CLASS,
} from '../styles'
import { RowKind, type Step, type Task, type TaskList, type TaskPatch } from '../types'
import { AddInput } from './AddInput'
import limits from '../shared/limits.json'
import { EditableText } from './EditableText'
import { Picker } from './Picker'
import { SortableRow } from './SortableRow'
import { ignoreRowEvents } from './ignoreRowEvents'
import { useModalFocus } from '../useModalFocus'

const LabelIcon = ({ label }: { label: Label }) => (
  <span className={ICON_SLOT_CLASS + ' ' + label.color}>
    <FontAwesomeIcon icon={label.icon} />
  </span>
)

const REMOVE_BUTTON_CLASS = ICON_BUTTON_CLASS + ' relative ' + TRAILING_ICON_CLASS

const Chevron = () => (
  <span className={'ml-auto flex shrink-0 items-center justify-center ' + TRAILING_ICON_CLASS}>
    <FontAwesomeIcon icon={faChevronDown} />
  </span>
)

const dueText = (due: string | null) => {
  if (!due) return { text: 'No due date', color: 'text-moss/80' }
  if (isOverdue(due)) return { text: `${formatDueDate(due)}, overdue`, color: 'text-rosehip' }
  return { text: formatDueDate(due), color: 'text-moss' }
}

function DueDateField({ task, onUpdate }: { task: Task; onUpdate: (patch: TaskPatch) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const due = draft ?? task.due
  const icon = dueIcon(due)
  const text = dueText(due)
  return (
    <div className={PROPERTY_ROW_CLASS + ' relative has-focus-visible:outline-2 has-focus-visible:outline-clover'}>
      <span className={ICON_SLOT_CLASS + ' ' + icon.color}>
        <FontAwesomeIcon icon={icon.icon} title={due ? icon.text : undefined} />
      </span>
      <span className={'flex-1 ' + text.color}>{text.text}</span>
      <input
        type="date"
        aria-label="Due date"
        key={task.id + (task.due ?? '')}
        defaultValue={task.due ?? ''}
        onChange={(event) => setDraft(event.target.validity.badInput ? null : event.target.value)}
        onBlur={(event) => {
          const { value } = event.target
          const partial = event.target.validity.badInput
          event.target.value = task.due ?? ''
          setDraft(null)
          if (!partial && value !== (task.due ?? '')) onUpdate({ due: value || null })
        }}
        onClick={(event) => event.currentTarget.showPicker()}
        onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
      {task.due && (
        <button onClick={() => onUpdate({ due: null })} aria-label="Clear due date" className={REMOVE_BUTTON_CLASS}>
          <FontAwesomeIcon icon={faXmark} />
        </button>
      )}
      <Chevron />
    </div>
  )
}

function TodayField({ task, onUpdate }: { task: Task; onUpdate: (patch: TaskPatch) => void }) {
  return (
    <button onClick={() => onUpdate({ addedToToday: !task.addedToToday })} className={PROPERTY_ROW_CLASS}>
      <span className={ICON_SLOT_CLASS + (task.addedToToday ? ' text-clover' : ' text-lichen')}>
        <FontAwesomeIcon icon={task.addedToToday ? faSun : faSunRegular} />
      </span>
      {task.addedToToday ? 'Remove from Today' : 'Add to Today'}
    </button>
  )
}

export default function TaskDetailPane({
  task,
  onClose,
  onDeleteTask,
  onAddStep,
  onToggleStep,
  onDeleteStep,
  onUpdateTask,
  onRenameStep,
  lists,
  modal,
}: {
  task: Task
  onClose: () => void
  onDeleteTask: () => void
  onAddStep: (text: string) => void
  onToggleStep: (id: string, completed: boolean) => void
  onDeleteStep: (id: string) => void
  onUpdateTask: (patch: TaskPatch) => void
  onRenameStep: (id: string, text: string) => void
  lists: TaskList[]
  modal: boolean
}) {
  const closeRef = useModalFocus<HTMLButtonElement>(modal)
  const listLabel = (id: string): Label => ({
    icon: faListUl,
    color: 'text-lichen',
    text: lists.find((list) => list.id === id)?.name ?? 'No list',
  })
  const stepRow = (step: Step) => (
    <SortableRow
      key={step.id}
      id={step.id}
      kind={RowKind.Step}
      tag="li"
      className="group flex select-none items-start gap-3 rounded-lg px-2 py-2 text-base hover:bg-moss/5"
    >
      <label
        {...ignoreRowEvents}
        className={
          'touch-hit relative h-6 rounded-full has-focus-visible:outline-2 has-focus-visible:outline-clover ' +
          ICON_SLOT_CLASS +
          (step.completed ? ' text-clover' : ' text-lichen')
        }
      >
        <input
          type="checkbox"
          checked={step.completed}
          onChange={() => onToggleStep(step.id, !step.completed)}
          className="absolute inset-0 cursor-pointer appearance-none rounded-full outline-none"
        />
        <FontAwesomeIcon icon={step.completed ? faCircleCheck : faCircle} />
      </label>
      <EditableText
        tag="span"
        text={step.title}
        maxLength={limits.titleMax}
        onCommit={(title) => onRenameStep(step.id, title)}
        className={
          'min-w-0 flex-1 break-words ' +
          (step.completed ? 'text-moss/75 line-through decoration-moss/40' : 'text-moss')
        }
        inputClassName={RENAME_CLASS + ' min-w-0 flex-1 px-1 text-base'}
      />
      <button
        {...ignoreRowEvents}
        onClick={() => onDeleteStep(step.id)}
        aria-label={`Delete step: ${step.title}`}
        className={
          ICON_BUTTON_CLASS +
          ' ' +
          TRAILING_ICON_CLASS +
          ' hover:text-rosehip! pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100'
        }
      >
        <FontAwesomeIcon icon={faTrashCan} />
      </button>
    </SortableRow>
  )

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-30 hidden bg-moss/20 sm:block xl:hidden" />
      <aside
        role={modal ? 'dialog' : undefined}
        aria-modal={modal || undefined}
        aria-label={task.title}
        className={
          'pane-in fixed inset-0 z-30 flex shrink-0 flex-col bg-parchment sm:left-auto sm:w-100 sm:border-l sm:border-fieldstone sm:shadow-md xl:static xl:z-auto xl:shadow-none ' +
          SAFE_AREA_CLASS
        }
      >
        <div className="flex select-none items-start gap-3 px-4 pt-5 pb-3 sm:px-6 lg:pt-9">
          <div className="min-w-0 flex-1">
            <EditableText
              key={task.id}
              tag="h2"
              text={task.title}
              maxLength={limits.titleMax}
              onCommit={(title) => onUpdateTask({ title })}
              className="-mx-1.5 w-fit max-w-full rounded-md px-1.5 font-serif text-2xl font-medium break-words text-moss transition hover:bg-moss/5"
              inputClassName={TITLE_RENAME_CLASS + ' text-2xl'}
            />
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close panel"
            className={ICON_BUTTON_CLASS + ' -mr-1.5 size-8 text-lg text-lichen'}
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        <div className="min-w-0 flex-1 overflow-x-clip overflow-y-auto [scrollbar-gutter:stable] px-2 pb-16 sm:px-4">
          <SortableContext items={task.steps} strategy={verticalListSortingStrategy}>
            <ul className="w-full">{task.steps.map(stepRow)}</ul>
          </SortableContext>
          <AddInput placeholder="Add a step" maxLength={limits.titleMax} onAdd={onAddStep} />
          <hr className="mx-2 my-3 border-fieldstone" />
          <Picker
            name="Stage"
            value={task.stage}
            options={STAGES}
            labelOf={stageLabel}
            onChange={(stage) => onUpdateTask({ stage })}
            className={PROPERTY_ROW_CLASS}
          >
            <LabelIcon label={stageLabel(task.stage)} />
            {stageLabel(task.stage).text}
            <Chevron />
          </Picker>
          <Picker
            name="Priority"
            value={task.priority}
            options={PRIORITIES}
            labelOf={priorityLabel}
            onChange={(priority) => onUpdateTask({ priority })}
            className={PROPERTY_ROW_CLASS}
          >
            <LabelIcon label={priorityLabel(task.priority)} />
            {priorityLabel(task.priority).text} priority
            <Chevron />
          </Picker>
          <DueDateField task={task} onUpdate={onUpdateTask} />
          <TodayField task={task} onUpdate={onUpdateTask} />
          {lists.length > 0 && (
            <Picker
              name="List"
              title="Move to list"
              value={task.listId ?? ''}
              options={lists.map((list) => list.id)}
              labelOf={listLabel}
              showIcons={false}
              onChange={(listId) => onUpdateTask({ listId })}
              className={PROPERTY_ROW_CLASS}
            >
              <LabelIcon label={listLabel(task.listId ?? '')} />
              <span className="min-w-0 truncate">{listLabel(task.listId ?? '').text}</span>
              <Chevron />
            </Picker>
          )}
          <button
            onClick={onDeleteTask}
            className="mt-6 flex h-11 cursor-pointer items-center gap-3 rounded-lg px-2 text-base text-rosehip transition hover:bg-rosehip/5 pointer-fine:h-10"
          >
            <span className={ICON_SLOT_CLASS}>
              <FontAwesomeIcon icon={faTrashCan} />
            </span>
            Delete task
          </button>
        </div>
      </aside>
    </>
  )
}
