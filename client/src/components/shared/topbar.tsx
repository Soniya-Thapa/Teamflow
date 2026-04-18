'use client';

/**
 * @file topbar.tsx
 * @description Top navigation bar with breadcrumbs and notifications.
 *
 * useSocket() is called here — ONE time at the layout level.
 * This initializes the socket connection and registers all event listeners.
 * Do NOT call useSocket() in individual pages.
 */

import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, CheckCheck, X } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/hooks/redux.hooks';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/store/slices/notification.slice';
import { useSocket } from '@/hooks/use-socket';

// ─────────────────────────────────────────
// BREADCRUMBS
// ─────────────────────────────────────────

function useBreadcrumbs() {
  const pathname = usePathname();
  return pathname
    .split('/')
    .filter(Boolean)
    .map((seg, index, arr) => ({
      label: seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' '),
      href: '/' + arr.slice(0, index + 1).join('/'),
      isLast: index === arr.length - 1,
    }));
}

// ─────────────────────────────────────────
// NOTIFICATION ITEM
// ─────────────────────────────────────────

function NotificationItem({
  notification,
  onRead,
}: {
  notification: any;
  onRead: (id: string) => void;
}) {
  return (
    <div
      onClick={() => !notification.isRead && onRead(notification.id)}
      className={`px-4 py-3 hover:bg-[#f4f4f4] dark:hover:bg-slate-800 transition-colors cursor-pointer border-b border-[#f4f4f4] dark:border-slate-800 last:border-0 ${
        !notification.isRead ? 'bg-[#476e66]/5' : ''
      }`}
    >
      <div className="flex items-start gap-2">
        {!notification.isRead && (
          <div className="w-1.5 h-1.5 rounded-full bg-[#476e66] shrink-0 mt-1.5" />
        )}
        <div className={`flex-1 ${notification.isRead ? 'pl-3.5' : ''}`}>
          <p className="text-xs font-medium text-slate-900 dark:text-white">
            {notification.title}
          </p>
          <p className="text-xs text-[#708a83] mt-0.5 line-clamp-2">
            {notification.message}
          </p>
          <p className="text-xs text-[#bec0bf] mt-1">
            {new Date(notification.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// NOTIFICATIONS DROPDOWN
// ─────────────────────────────────────────

function NotificationsDropdown({ onClose }: { onClose: () => void }) {
  const dispatch = useAppDispatch();
  const { notifications, isLoading } = useAppSelector(
    (state) => state.notifications,
  );

  const handleMarkRead = (id: string) => {
    dispatch(markNotificationRead(id));
  };

  const handleMarkAllRead = () => {
    dispatch(markAllNotificationsRead());
    onClose();
  };

  return (
    <div className="absolute right-0 top-full mt-2 w-80 bg-[#fefefe] dark:bg-slate-900 rounded-xl shadow-2xl border border-[#dfdfe2] dark:border-slate-700 overflow-hidden z-50">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#f4f4f4] dark:border-slate-800">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          Notifications
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={handleMarkAllRead}
            className="p-1.5 rounded-lg hover:bg-[#f4f4f4] dark:hover:bg-slate-800 text-[#708a83] transition-colors"
            title="Mark all as read"
          >
            <CheckCheck size={14} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#f4f4f4] dark:hover:bg-slate-800 text-[#708a83] transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="max-h-80 overflow-y-auto">
        {isLoading ? (
          <p className="text-center text-xs text-[#708a83] py-8">Loading...</p>
        ) : notifications.length === 0 ? (
          <div className="text-center py-8">
            <Bell size={20} className="text-[#bec0bf] mx-auto mb-2" />
            <p className="text-xs text-[#708a83]">No notifications</p>
          </div>
        ) : (
          notifications.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onRead={handleMarkRead}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-[#f4f4f4] dark:border-slate-800 text-center">
        <button
          onClick={() => {
            onClose();
            window.location.href = '/notifications';
          }}
          className="text-xs text-[#476e66] hover:underline font-medium"
        >
          View all notifications →
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// TOPBAR
// ─────────────────────────────────────────

export function Topbar() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const breadcrumbs = useBreadcrumbs();
  const { unreadCount } = useAppSelector((state) => state.notifications);
  const { activeOrg } = useAppSelector((state) => state.organization);
  const [showNotifications, setShowNotifications] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ← This is the ONE place useSocket is called in the entire app
  useSocket();

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (showNotifications) {
      dispatch(fetchNotifications());
    }
  }, [showNotifications, dispatch]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header className="h-14 bg-white dark:bg-slate-900 border-b border-[#dfdfe2] dark:border-slate-800 flex items-center justify-between px-6 shrink-0">

      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-sm ml-10 lg:ml-0">
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb.href} className="flex items-center gap-1.5">
            {i > 0 && (
              <span className="text-[#dfdfe2] dark:text-slate-600">/</span>
            )}
            {crumb.isLast ? (
              <span className="font-medium text-slate-900 dark:text-white">
                {crumb.label}
              </span>
            ) : (
              <button
                onClick={() => router.push(crumb.href)}
                className="text-[#708a83] hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                {crumb.label}
              </button>
            )}
          </span>
        ))}
      </nav>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Notification Bell */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-lg hover:bg-[#f4f4f4] dark:hover:bg-slate-800 transition-colors"
          >
            <Bell size={16} className="text-[#708a83]" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-[#476e66] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <NotificationsDropdown
              onClose={() => setShowNotifications(false)}
            />
          )}
        </div>
      </div>
    </header>
  );
}