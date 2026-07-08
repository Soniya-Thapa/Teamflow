'use client';

import { useState, useEffect } from 'react';
import { Building2, Users, FolderOpen, CheckSquare } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import api from '@/lib/axios';

export default function AdminStatsPage() {
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api
      .get('/admin/stats')
      .then((res) => setStats(res.data.data))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const items = stats
    ? [
        { label: 'Organizations', value: stats.totalOrganizations, icon: Building2 },
        { label: 'Users', value: stats.totalUsers, icon: Users },
        { label: 'Projects', value: stats.totalProjects, icon: FolderOpen },
        { label: 'Tasks', value: stats.totalTasks, icon: CheckSquare },
      ]
    : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Platform Stats</h1>

      {isLoading ? (
        <p className="text-slate-400">Loading...</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {items.map((item) => (
            <Card key={item.label} className="bg-slate-800 border-slate-700">
              <CardContent className="pt-5 pb-4">
                <item.icon size={16} className="text-slate-400 mb-2" />
                <p className="text-3xl font-bold text-white">{item.value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{item.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}