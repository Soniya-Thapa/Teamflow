'use client';

import { useState, useEffect } from 'react';
import { useAppSelector } from '@/hooks/redux.hooks';
import { Sparkles, Clock, AlertTriangle, FolderX, ChevronDown } from 'lucide-react';
import api from '@/lib/axios';

interface DigestReport {
  id: string;
  generatedAt: string;
  overdueCount: number;
  estimatedDelayDays: number;
  inactiveProjects: { projectId: string; projectName: string; daysInactive: number }[];
  summaryText: string;
}

function DigestCard({ report, isLatest }: { report: DigestReport; isLatest: boolean }) {
  const [expanded, setExpanded] = useState(isLatest);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#476e66]/20 rounded-lg flex items-center justify-center shrink-0">
            <Sparkles size={14} className="text-[#476e66]" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">
              {new Date(report.generatedAt).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              })}
              {isLatest && (
                <span className="ml-2 text-xs text-[#476e66] font-normal">· Latest</span>
              )}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {report.overdueCount} overdue · {report.inactiveProjects.length} inactive project
              {report.inactiveProjects.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <ChevronDown
          size={16}
          className={`text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-3">
          <div className="bg-slate-800/50 rounded-lg p-4">
            <p className="text-sm text-slate-300 leading-relaxed">{report.summaryText}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 bg-slate-800/30 rounded-lg px-3 py-2">
              <AlertTriangle size={12} className="text-red-400 shrink-0" />
              <span className="text-xs text-slate-400">
                {report.overdueCount} overdue task{report.overdueCount !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2 bg-slate-800/30 rounded-lg px-3 py-2">
              <Clock size={12} className="text-amber-400 shrink-0" />
              <span className="text-xs text-slate-400">
                {report.estimatedDelayDays}d avg overdue duration
              </span>
            </div>
          </div>

          {report.inactiveProjects.length > 0 && (
            <div className="space-y-1.5">
              {report.inactiveProjects.map((p) => (
                <div
                  key={p.projectId}
                  className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800/30 rounded-lg px-3 py-2"
                >
                  <FolderX size={12} className="text-slate-500 shrink-0" />
                  {p.projectName} — no activity for {p.daysInactive} days
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DigestHistoryPage() {
  const { activeOrg } = useAppSelector((state) => state.organization);
  const [reports, setReports] = useState<DigestReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!activeOrg) return;
    api
      .get(`/organizations/${activeOrg.id}/ai-digest/history`)
      .then((res) => setReports(res.data.data || []))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [activeOrg?.id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#476e66] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Weekly AI Digest</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          AI-generated summaries of overdue work, workload, and stalled projects
        </p>
      </div>

      {reports.length === 0 ? (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-xl">
          <Sparkles size={24} className="text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No digests generated yet</p>
          <p className="text-xs text-slate-600 mt-1">
            Digests run automatically every night and appear here
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report, i) => (
            <DigestCard key={report.id} report={report} isLatest={i === 0} />
          ))}
        </div>
      )}
    </div>
  );
}