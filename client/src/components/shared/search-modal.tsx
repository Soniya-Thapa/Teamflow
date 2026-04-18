'use client';

/**
 * @file search-modal.tsx
 * @description Global search modal triggered by Cmd+K / Ctrl+K.
 *
 * Debounces input by 300ms before hitting the API.
 * Results grouped by type (Projects, Tasks, Members, Teams).
 * Click result → navigate to resource page.
 * Search history stored in localStorage (last 5 searches).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  FolderOpen,
  CheckSquare,
  Users,
  User,
  X,
  Clock,
} from 'lucide-react';
import { useAppSelector } from '@/hooks/redux.hooks';
import api from '@/lib/axios';

const HISTORY_KEY = 'teamflow_search_history';
const MAX_HISTORY = 5;

function getHistory(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

function addToHistory(query: string) {
  const history = getHistory().filter((h) => h !== query);
  const updated = [query, ...history].slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
}

// ─────────────────────────────────────────
// RESULT ITEM
// ─────────────────────────────────────────

function ResultItem({
  icon: Icon,
  label,
  sublabel,
  onClick,
}: {
  icon: any;
  label: string;
  sublabel?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#f4f4f4] dark:hover:bg-slate-800 transition-colors text-left"
    >
      <div className="w-7 h-7 bg-[#f4f4f4] dark:bg-slate-800 rounded-lg flex items-center justify-center shrink-0">
        <Icon size={13} className="text-[#708a83]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
          {label}
        </p>
        {sublabel && (
          <p className="text-xs text-[#708a83] truncate">{sublabel}</p>
        )}
      </div>
    </button>
  );
}

// ─────────────────────────────────────────
// SEARCH MODAL
// ─────────────────────────────────────────

interface SearchModalProps {
  onClose: () => void;
}

export function SearchModal({ onClose }: SearchModalProps) {
  const router = useRouter();
  const { activeOrg } = useAppSelector((state) => state.organization);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<string[]>(getHistory());
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced search
  const doSearch = useCallback(
    async (q: string) => {
      if (!q || q.length < 2 || !activeOrg) {
        setResults(null);
        return;
      }

      setIsLoading(true);
      try {
        const res = await api.get(
          `/organizations/${activeOrg.id}/search?q=${encodeURIComponent(q)}`,
        );
        setResults(res.data.data.results);
      } catch {
        setResults(null);
      } finally {
        setIsLoading(false);
      }
    },
    [activeOrg],
  );

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => doSearch(query), 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, doSearch]);

  const navigate = (path: string) => {
    if (query) addToHistory(query);
    setHistory(getHistory());
    router.push(path);
    onClose();
  };

  const hasResults =
    results &&
    (results.projects?.length ||
      results.tasks?.length ||
      results.members?.length ||
      results.teams?.length);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-xl bg-[#fefefe] dark:bg-slate-900 rounded-2xl shadow-2xl border border-[#dfdfe2] dark:border-slate-700 overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#f4f4f4] dark:border-slate-800">
          <Search size={16} className="text-[#708a83] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search projects, tasks, members, teams..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-[#bec0bf] outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-[#bec0bf] hover:text-[#708a83] transition-colors"
            >
              <X size={14} />
            </button>
          )}
          <kbd className="text-[10px] text-[#bec0bf] border border-[#dfdfe2] dark:border-slate-700 rounded px-1.5 py-0.5">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto py-2">
          {isLoading && (
            <p className="text-center text-xs text-[#708a83] py-6">
              Searching...
            </p>
          )}

          {!query && history.length > 0 && (
            <div>
              <p className="px-4 py-2 text-xs font-semibold text-[#bec0bf] uppercase tracking-wider">
                Recent searches
              </p>
              {history.map((h) => (
                <ResultItem
                  key={h}
                  icon={Clock}
                  label={h}
                  onClick={() => setQuery(h)}
                />
              ))}
            </div>
          )}

          {!isLoading && query.length >= 2 && !hasResults && (
            <p className="text-center text-sm text-[#708a83] py-8">
              No results for &ldquo;{query}&rdquo;
            </p>
          )}

          {hasResults && (
            <>
              {results.projects?.length > 0 && (
                <div>
                  <p className="px-4 py-1.5 text-xs font-semibold text-[#bec0bf] uppercase tracking-wider">
                    Projects
                  </p>
                  {results.projects.map((p: any) => (
                    <ResultItem
                      key={p.id}
                      icon={FolderOpen}
                      label={p.name}
                      sublabel={p.status}
                      onClick={() => navigate(`/projects/${p.id}`)}
                    />
                  ))}
                </div>
              )}

              {results.tasks?.length > 0 && (
                <div>
                  <p className="px-4 py-1.5 text-xs font-semibold text-[#bec0bf] uppercase tracking-wider">
                    Tasks
                  </p>
                  {results.tasks.map((t: any) => (
                    <ResultItem
                      key={t.id}
                      icon={CheckSquare}
                      label={t.title}
                      sublabel={t.project?.name}
                      onClick={() =>
                        navigate(`/projects/${t.projectId}/tasks`)
                      }
                    />
                  ))}
                </div>
              )}

              {results.members?.length > 0 && (
                <div>
                  <p className="px-4 py-1.5 text-xs font-semibold text-[#bec0bf] uppercase tracking-wider">
                    Members
                  </p>
                  {results.members.map((m: any) => (
                    <ResultItem
                      key={m.id}
                      icon={User}
                      label={`${m.user.firstName} ${m.user.lastName}`}
                      sublabel={m.user.email}
                      onClick={() =>
                        navigate(`/settings/members`)
                      }
                    />
                  ))}
                </div>
              )}

              {results.teams?.length > 0 && (
                <div>
                  <p className="px-4 py-1.5 text-xs font-semibold text-[#bec0bf] uppercase tracking-wider">
                    Teams
                  </p>
                  {results.teams.map((t: any) => (
                    <ResultItem
                      key={t.id}
                      icon={Users}
                      label={t.name}
                      sublabel={`${t._count?.members ?? 0} members`}
                      onClick={() => navigate(`/teams/${t.id}`)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2.5 border-t border-[#f4f4f4] dark:border-slate-800 flex items-center gap-4">
          <span className="text-xs text-[#bec0bf]">
            <kbd className="border border-[#dfdfe2] dark:border-slate-700 rounded px-1 py-0.5 text-[10px] mr-1">↑↓</kbd>
            navigate
          </span>
          <span className="text-xs text-[#bec0bf]">
            <kbd className="border border-[#dfdfe2] dark:border-slate-700 rounded px-1 py-0.5 text-[10px] mr-1">↵</kbd>
            select
          </span>
        </div>
      </div>
    </div>
  );
}