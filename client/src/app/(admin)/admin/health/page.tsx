'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function SystemHealthPage() {
  const [health, setHealth] = useState<any>(null);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '')}/health`)
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">System Health</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-2">
              {health ? (
                <CheckCircle2 size={16} className="text-green-400" />
              ) : (
                <XCircle size={16} className="text-red-400" />
              )}
              <span className="text-sm font-medium text-white">API Server</span>
            </div>
            <p className="text-xs text-slate-400">
              {health?.message || 'Checking...'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={16} className="text-[#476e66]" />
              <span className="text-sm font-medium text-white">Uptime</span>
            </div>
            <p className="text-xs text-slate-400">
              {health?.uptime
                ? `${Math.round(health.uptime / 60)} minutes`
                : 'N/A'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-white">Environment</span>
            </div>
            <p className="text-xs text-slate-400">
              {health?.environment || 'N/A'}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}