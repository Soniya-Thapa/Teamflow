'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  User,
  Flag,
  MessageSquare,
  Clock,
  Loader2,
  Send,
  Pencil,
  Check,
  Paperclip,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PriorityBadge } from '@/components/shared/priority-badge';
import { TaskStatusBadge } from '@/components/shared/status-badge';
import { UserAvatar } from '@/components/shared/user-avatar';
import { Task, Comment, TaskStatus, TaskPriority } from '@/types';
import { useOrgApi } from '@/hooks/use-org-api';
import { useAppSelector } from '@/hooks/redux.hooks';
import api from '@/lib/axios';
import { FileUpload } from '@/components/shared/file-upload';

interface TaskDetailProps {
  task: Task;
  onClose: () => void;
  onUpdate: () => void;
}

const STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];
const PRIORITIES: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export function TaskDetail({ task, onClose, onUpdate }: TaskDetailProps) {
  const { orgId, buildUrl } = useOrgApi();
  const { user } = useAppSelector((state) => state.auth);

  const [comments, setComments] = useState<Comment[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [activity, setActivity] = useState<any[]>([]);
  const [editTitle, setEditTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(task.title);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    Promise.all([
      api.get(buildUrl(`/tasks/${task.id}/comments`)),
      api.get(buildUrl(`/tasks/${task.id}/activity`)),
      api.get(buildUrl(`/tasks/${task.id}/attachments`)),
    ])
      .then(([commentsRes, activityRes,attachmentsRes]) => {
        setComments(commentsRes.data.data.comments || []);
        setActivity(activityRes.data.data.activities || []);
        setAttachments(attachmentsRes.data.data.attachments || []);
      })
      .catch(() => {});
  }, [orgId, task.id]);

  const updateTask = async (updates: Partial<Task>) => {
    if (!orgId) return;
    setIsUpdating(true);
    try {
      await api.patch(buildUrl(`/tasks/${task.id}`), updates);
      onUpdate();
    } catch {
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePostComment = async () => {
    if (!newComment.trim() || !orgId) return;
    setIsPostingComment(true);
    try {
      const res = await api.post(buildUrl(`/tasks/${task.id}/comments`), {
        content: newComment,
      });
      setComments((prev) => [
        ...prev,
        { ...res.data.data.comment, user },
      ]);
      setNewComment('');
    } catch {
    } finally {
      setIsPostingComment(false);
    }
  };

  const handleTitleSave = () => {
    if (titleValue.trim() && titleValue !== task.title) {
      updateTask({ title: titleValue });
    }
    setEditTitle(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-full max-w-xl h-full bg-[#fefefe] dark:bg-slate-900 shadow-2xl border-l border-[#dfdfe2] dark:border-slate-700 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-[#f4f4f4] dark:border-slate-800 shrink-0">
          <div className="flex-1 mr-3">
            {editTitle ? (
              <div className="flex items-center gap-2">
                <Input
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  className="border-[#dfdfe2] text-sm font-semibold"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleTitleSave();
                    if (e.key === 'Escape') setEditTitle(false);
                  }}
                />
                <button
                  onClick={handleTitleSave}
                  className="p-1.5 rounded-lg bg-[#476e66] text-white"
                >
                  <Check size={13} />
                </button>
              </div>
            ) : (
              <h2
                className="font-semibold text-slate-900 dark:text-white leading-snug cursor-pointer hover:text-[#476e66] transition-colors group flex items-start gap-2"
                onClick={() => setEditTitle(true)}
              >
                {task.title}
                <Pencil
                  size={12}
                  className="shrink-0 mt-1 opacity-0 group-hover:opacity-100 text-[#708a83] transition-opacity"
                />
              </h2>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#f4f4f4] dark:hover:bg-slate-800 text-[#708a83] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">

          {/* Properties */}
          <div className="px-5 py-4 space-y-4 border-b border-[#f4f4f4] dark:border-slate-800">

            {/* Status */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#708a83] w-20 shrink-0">Status</span>
              <div className="flex flex-wrap gap-1.5">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => updateTask({ status: s })}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
                      task.status === s
                        ? 'bg-[#476e66] text-white border-[#476e66]'
                        : 'border-[#dfdfe2] text-[#708a83] hover:border-[#476e66] hover:text-[#476e66]'
                    }`}
                  >
                    {s.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#708a83] w-20 shrink-0">Priority</span>
              <div className="flex flex-wrap gap-1.5">
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    onClick={() => updateTask({ priority: p })}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
                      task.priority === p
                        ? 'border-[#476e66] bg-[#476e66]/10 text-[#476e66]'
                        : 'border-[#dfdfe2] text-[#708a83] hover:border-[#708a83]'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Assignee */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#708a83] w-20 shrink-0">Assignee</span>
              {task.assignee ? (
                <div className="flex items-center gap-2">
                  <UserAvatar user={task.assignee} size="sm" />
                  <span className="text-sm text-slate-900 dark:text-white">
                    {task.assignee.firstName} {task.assignee.lastName}
                  </span>
                </div>
              ) : (
                <span className="text-sm text-[#bec0bf]">Unassigned</span>
              )}
            </div>

            {/* Due Date */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#708a83] w-20 shrink-0">Due date</span>
              {task.dueDate ? (
                <span
                  className={`text-sm ${
                    isOverdue(task.dueDate, task.status)
                      ? 'text-red-500'
                      : 'text-slate-900 dark:text-white'
                  }`}
                >
                  {new Date(task.dueDate).toLocaleDateString()}
                </span>
              ) : (
                <span className="text-sm text-[#bec0bf]">No due date</span>
              )}
            </div>

            {/* Description */}
            {task.description && (
              <div className="pt-1">
                <p className="text-xs text-[#708a83] mb-2">Description</p>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed bg-[#f4f4f4] dark:bg-slate-800 rounded-lg px-3 py-2.5">
                  {task.description}
                </p>
              </div>
            )}
          </div>

          {/* Comments */}
          <div className="px-5 py-4 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <MessageSquare size={14} className="text-[#708a83]" />
              Comments ({comments.length})
            </h3>

            {/* Comment list */}
            <div className="space-y-3">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-2.5">
                  <UserAvatar user={comment.user} size="sm" className="shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="bg-[#f4f4f4] dark:bg-slate-800 rounded-xl px-3 py-2.5">
                      <p className="text-xs font-medium text-slate-900 dark:text-white mb-1">
                        {comment.user.firstName} {comment.user.lastName}
                      </p>
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                        {comment.content}
                      </p>
                    </div>
                    <p className="text-xs text-[#bec0bf] mt-1 pl-3">
                      {new Date(comment.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* New comment input */}
            <div className="flex gap-2 pt-1">
              <Input
                placeholder="Write a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handlePostComment();
                  }
                }}
                className="border-[#dfdfe2] bg-[#fefefe] text-sm"
              />
              <Button
                onClick={handlePostComment}
                disabled={!newComment.trim() || isPostingComment}
                size="sm"
                className="bg-[#476e66] hover:bg-[#3d6059] text-white shrink-0"
              >
                {isPostingComment ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send size={13} />
                )}
              </Button>
            </div>
          </div>

<div className="px-5 py-4 space-y-3 border-t border-[#f4f4f4] dark:border-slate-800">
  <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
    <Paperclip size={14} className="text-[#708a83]" />
    Attachments ({attachments.length})
  </h3>
  <FileUpload
    taskId={task.id}
    attachments={attachments}
    onUpdate={() => {
      api.get(buildUrl(`/tasks/${task.id}/attachments`))
        .then((res) => setAttachments(res.data.data.attachments || []))
        .catch(() => {});
    }}
  />
</div>

          {/* Activity */}
          {activity.length > 0 && (
            <div className="px-5 pb-6 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock size={14} className="text-[#708a83]" />
                Activity
              </h3>
              <div className="space-y-2.5 border-l-2 border-[#f4f4f4] dark:border-slate-800 pl-4">
                {activity.map((a) => (
                  <div key={a.id} className="relative">
                    <div className="absolute -left-5 top-1 w-2 h-2 rounded-full bg-[#476e66]" />
                    <p className="text-xs text-slate-700 dark:text-slate-300">
                      <span className="font-medium">{a.user?.firstName}</span>{' '}
                      {a.action.toLowerCase().replace(/_/g, ' ')}
                    </p>
                    <p className="text-xs text-[#bec0bf]">
                      {new Date(a.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function isOverdue(dateStr: string | null, status: TaskStatus): boolean {
  if (!dateStr || status === 'DONE') return false;
  return new Date(dateStr) < new Date();
}