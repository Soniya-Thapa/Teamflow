'use client';

/**
 * @file sidebar.tsx
 * @description App sidebar with navigation, org switcher, and user menu.
 *
 * STRUCTURE:
 *   Logo + brand
 *   Org switcher (shows active org, lets user switch)
 *   Navigation links
 *   Bottom: user avatar + logout
 */

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FolderOpen,
  CheckSquare,
  Users,
  UserCircle,
  Settings,
  BarChart3,
  ChevronDown,
  Plus,
  LogOut,
  Building2,
  Menu,
  X,
  Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppDispatch, useAppSelector } from '@/hooks/redux.hooks';
import { logoutUser } from '@/store/slices/auth.slice';
import { setActiveOrg, clearOrganization } from '@/store/slices/organization.slice';
import { Organization } from '@/types';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// ─────────────────────────────────────────
// NAV LINKS
// ─────────────────────────────────────────

const navLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Projects', icon: FolderOpen },
  { href: '/tasks', label: 'My Tasks', icon: CheckSquare },
  { href: '/teams', label: 'Teams', icon: Users },
  { href: '/members', label: 'Members', icon: UserCircle },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

// ─────────────────────────────────────────
// ORG SWITCHER
// ─────────────────────────────────────────

function OrgSwitcher() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { activeOrg, userOrgs } = useAppSelector((state) => state.organization);

  const handleSwitch = (org: Organization) => {
    dispatch(setActiveOrg(org));
    // Reload current page with new org context
    window.location.reload();
  };

  if (!activeOrg) {
    return (
      <Link
        href="/organizations/new"
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors text-sm"
      >
        <Plus size={14} />
        <span>Create organization</span>
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors group">
          <div className="w-6 h-6 bg-indigo-600 rounded-md flex items-center justify-center shrink-0">
            <Building2 size={12} className="text-white" />
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
              {activeOrg.name}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {activeOrg.plan}
            </p>
          </div>
          <ChevronDown
            size={14}
            className="text-slate-400 shrink-0 group-hover:text-gray-600 dark:group-hover:text-slate-300"
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs text-slate-500 font-normal">
          Your organizations
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {userOrgs.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => handleSwitch(org)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div className="w-5 h-5 bg-indigo-600 rounded flex items-center justify-center">
              <Building2 size={10} className="text-white" />
            </div>
            <span className="flex-1 truncate">{org.name}</span>
            {activeOrg.id === org.id && (
              <Badge variant="secondary" className="text-xs">Active</Badge>
            )}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => router.push('/organizations/new')}
          className="flex items-center gap-2 cursor-pointer text-indigo-600"
        >
          <Plus size={14} />
          <span>New organization</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─────────────────────────────────────────
// USER MENU
// ─────────────────────────────────────────

function UserMenu() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);

  const handleLogout = async () => {
    await dispatch(logoutUser());
    dispatch(clearOrganization());
    router.push('/login');
  };

  const initials = user
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : '??';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-xs bg-indigo-600 text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 text-left min-w-0">
            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {user?.email}
            </p>
          </div>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="font-medium text-sm">{user?.firstName} {user?.lastName}</p>
          <p className="text-xs text-slate-500">{user?.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => router.push('/settings/profile')}
          className="cursor-pointer"
        >
          <Settings size={14} className="mr-2" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="cursor-pointer text-red-600 focus:text-red-600"
        >
          <LogOut size={14} className="mr-2" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─────────────────────────────────────────
// NAV LINK ITEM
// ─────────────────────────────────────────

function NavItem({
  href,
  label,
  icon: Icon,
  onClick,
}: {
  href: string;
  label: string;
  icon: any;
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + '/');

  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
        isActive
          ? 'bg-[#f4f4f4] dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white',
      )}
    >
      <Icon
        size={16}
        className={cn(
          isActive
            ? 'text-indigo-600 dark:text-indigo-400'
            : 'text-slate-400 dark:text-slate-500',
        )}
      />
      {label}
    </Link>
  );
}

// ─────────────────────────────────────────
// SIDEBAR CONTENT (shared between desktop + mobile)
// ─────────────────────────────────────────

function SidebarContent({ onNavClick }: { onNavClick?: () => void }) {
  return (
    <div className="flex flex-col h-full">

      {/* Logo */}
      <div className="px-4 py-5 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xs">TF</span>
          </div>
          <span className="font-bold text-slate-900 dark:text-white">
            Team<span className="text-indigo-600">Flow</span>
          </span>
        </div>
      </div>

      {/* Org Switcher */}
      <div className="px-3 py-3 border-b border-slate-200 dark:border-slate-800">
        <OrgSwitcher />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
        {navLinks.map((link) => (
          <NavItem
            key={link.href}
            {...link}
            onClick={onNavClick}
          />
        ))}
      </nav>

      {/* User Menu */}
      <div className="px-3 py-3 border-t border-slate-200 dark:border-slate-800">
        <UserMenu />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// MAIN SIDEBAR EXPORT
// Handles desktop (fixed) + mobile (drawer)
// ─────────────────────────────────────────

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 h-screen sticky top-0">
        <SidebarContent />
      </aside>

      {/* ── MOBILE MENU BUTTON ── */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm"
      >
        <Menu size={18} className="text-slate-600 dark:text-slate-400" />
      </button>

      {/* ── MOBILE OVERLAY ── */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── MOBILE DRAWER ── */}
      <aside
        className={cn(
          'lg:hidden fixed top-0 left-0 z-50 w-72 h-screen bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-transform duration-200',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X size={16} className="text-slate-500" />
        </button>
        <SidebarContent onNavClick={() => setMobileOpen(false)} />
      </aside>
    </>
  );
}