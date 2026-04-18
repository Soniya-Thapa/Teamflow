'use client';

import { useEffect } from 'react';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppSelector, useAppDispatch } from '@/hooks/redux.hooks';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  removeNotification,
} from '@/store/slices/notification.slice';
import { SkeletonTable } from '@/components/shared/skeleton';

export default function NotificationsPage() {
  const dispatch = useAppDispatch();
  const { notifications, isLoading } = useAppSelector(
    (state) => state.notifications,
  );

  useEffect(() => {
    dispatch(fetchNotifications());
  }, [dispatch]);

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Notifications
          </h1>
          <p className="text-sm text-[#708a83] mt-0.5">
            {notifications.filter((n) => !n.isRead).length} unread
          </p>
        </div>
        {notifications.some((n) => !n.isRead) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => dispatch(markAllNotificationsRead())}
            className="border-[#dfdfe2] text-[#708a83]"
          >
            <CheckCheck size={13} className="mr-1.5" />
            Mark all read
          </Button>
        )}
      </div>

      {isLoading ? (
        <SkeletonTable rows={5} />
      ) : notifications.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 bg-[#f4f4f4] dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Bell size={24} className="text-[#bec0bf]" />
          </div>
          <p className="font-medium text-slate-700 dark:text-slate-300">
            All caught up
          </p>
          <p className="text-sm text-[#708a83] mt-1">
            No notifications yet
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`flex items-start gap-3 px-4 py-3.5 rounded-xl border transition-colors ${
                !n.isRead
                  ? 'border-[#476e66]/30 bg-[#476e66]/5 dark:bg-[#476e66]/10'
                  : 'border-[#dfdfe2] dark:border-slate-700 bg-[#fefefe] dark:bg-slate-900'
              }`}
            >
              {!n.isRead && (
                <div className="w-2 h-2 rounded-full bg-[#476e66] shrink-0 mt-1.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {n.title}
                </p>
                <p className="text-sm text-[#708a83] mt-0.5 leading-relaxed">
                  {n.message}
                </p>
                <p className="text-xs text-[#bec0bf] mt-1.5">
                  {new Date(n.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!n.isRead && (
                  <button
                    onClick={() => dispatch(markNotificationRead(n.id))}
                    className="p-1.5 rounded-lg hover:bg-[#f4f4f4] dark:hover:bg-slate-800 text-[#708a83] transition-colors"
                    title="Mark as read"
                  >
                    <CheckCheck size={13} />
                  </button>
                )}
                <button
                  onClick={() => dispatch(removeNotification(n.id))}
                  className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 text-[#bec0bf] hover:text-red-500 transition-colors"
                  title="Delete"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}