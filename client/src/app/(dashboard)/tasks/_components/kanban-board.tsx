'use client';

/**
 * @file kanban-board.tsx
 * @description Drag-and-drop Kanban board using @hello-pangea/dnd.
 *
 * HOW DRAG AND DROP WORKS:
 * 1. DragDropContext — wraps everything, gets notified when a drop happens
 * 2. Droppable — a column that can receive dropped items
 * 3. Draggable — a task card that can be dragged
 *
 * On drop:
 *   → onDragEnd called with source column + destination column
 *   → If different columns → PATCH /tasks/:id with new status
 *   → Optimistic update: UI updates immediately, API call happens after
 */

import { useState, useCallback } from 'react';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from '@hello-pangea/dnd';
import { Plus } from 'lucide-react';
import { Task, TaskStatus } from '@/types';
import { TaskCard } from './task-card';
import { Modal } from '@/components/shared/modal';
import { TaskForm } from './task-form';
import api from '@/lib/axios';

// ─────────────────────────────────────────
// COLUMN CONFIG
// ─────────────────────────────────────────

interface Column {
  id: TaskStatus;
  label: string;
  color: string;
  bg: string;
}

const COLUMNS: Column[] = [
  {
    id: 'TODO',
    label: 'To Do',
    color: 'text-slate-600 dark:text-slate-400',
    bg: 'bg-slate-100 dark:bg-slate-800',
  },
  {
    id: 'IN_PROGRESS',
    label: 'In Progress',
    color: 'text-[#476e66]',
    bg: 'bg-[#476e66]/10 dark:bg-[#476e66]/20',
  },
  {
    id: 'REVIEW',
    label: 'Review',
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-50 dark:bg-purple-950',
  },
  {
    id: 'DONE',
    label: 'Done',
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-50 dark:bg-green-950',
  },
];

// ─────────────────────────────────────────
// BOARD COLUMN
// ─────────────────────────────────────────

function KanbanColumn({
  column,
  tasks,
  onTaskClick,
  onAddTask,
}: {
  column: Column;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onAddTask: (status: TaskStatus) => void;
}) {
  return (
    <div className="flex flex-col w-72 shrink-0">
      {/* Column header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-semibold uppercase tracking-wider ${column.color}`}
          >
            {column.label}
          </span>
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${column.bg} ${column.color}`}
          >
            {tasks.length}
          </span>
        </div>
        <button
          onClick={() => onAddTask(column.id)}
          className="p-1 rounded-lg hover:bg-[#f4f4f4] dark:hover:bg-slate-800 text-[#bec0bf] hover:text-[#476e66] transition-colors"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Drop zone */}
      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 space-y-2 min-h-[100px] rounded-xl p-2 transition-colors duration-150 ${
              snapshot.isDraggingOver
                ? 'bg-[#476e66]/5 dark:bg-[#476e66]/10 border-2 border-dashed border-[#476e66]/30'
                : 'bg-[#f4f4f4]/50 dark:bg-slate-800/30'
            }`}
          >
            {tasks.map((task, index) => (
              <Draggable key={task.id} draggableId={task.id} index={index}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                  >
                    <TaskCard
                      task={task}
                      dragging={snapshot.isDragging}
                      onClick={onTaskClick}
                    />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}

            {tasks.length === 0 && !snapshot.isDraggingOver && (
              <div className="text-center py-6">
                <p className="text-xs text-[#bec0bf]">Drop tasks here</p>
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}

// ─────────────────────────────────────────
// KANBAN BOARD
// ─────────────────────────────────────────

interface KanbanBoardProps {
  tasks: Task[];
  orgId: string;
  projectId?: string;
  onTaskClick: (task: Task) => void;
  onRefresh: () => void;
}

export function KanbanBoard({
  tasks,
  orgId,
  projectId,
  onTaskClick,
  onRefresh,
}: KanbanBoardProps) {
  const [showCreateFor, setShowCreateFor] = useState<TaskStatus | null>(null);

  // Group tasks by status
  const tasksByStatus = COLUMNS.reduce(
    (acc, col) => {
      acc[col.id] = tasks.filter((t) => t.status === col.id);
      return acc;
    },
    {} as Record<TaskStatus, Task[]>,
  );

  const onDragEnd = useCallback(
    async (result: DropResult) => {
      const { destination, source, draggableId } = result;

      if (!destination) return;
      if (
        destination.droppableId === source.droppableId &&
        destination.index === source.index
      )
        return;

      const newStatus = destination.droppableId as TaskStatus;

      if (newStatus === source.droppableId) return;

      // Optimistic update — UI changes immediately
      onRefresh();

      // API call
      try {
        await api.patch(`/organizations/${orgId}/tasks/${draggableId}`, {
          status: newStatus,
        });
        onRefresh(); // Refresh again to confirm
      } catch {
        onRefresh(); // Revert on error
      }
    },
    [orgId, onRefresh],
  );

  return (
    <>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              tasks={tasksByStatus[column.id]}
              onTaskClick={onTaskClick}
              onAddTask={setShowCreateFor}
            />
          ))}
        </div>
      </DragDropContext>

      {showCreateFor && (
        <Modal
          title="Create task"
          onClose={() => setShowCreateFor(null)}
        >
          <TaskForm
            orgId={orgId}
            defaultProjectId={projectId}
            onSuccess={() => {
              setShowCreateFor(null);
              onRefresh();
            }}
            onCancel={() => setShowCreateFor(null)}
          />
        </Modal>
      )}
    </>
  );
}