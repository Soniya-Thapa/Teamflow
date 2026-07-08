'use client';

import { useState, useEffect } from 'react';
import { Search, ShieldOff, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import api from '@/lib/axios';

export default function AdminOrganizationsPage() {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchOrgs = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/admin/organizations');
      setOrgs(res.data.data.organizations || []);
    } catch {
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrgs();
  }, []);

  const handleToggleStatus = async (org: any) => {
    const newStatus = org.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await api.patch(`/admin/organizations/${org.id}/status`, {
        status: newStatus,
      });
      fetchOrgs();
    } catch {}
  };

  const filtered = orgs.filter(
    (o) =>
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.slug.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Organizations</h1>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-56 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
          />
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Name</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Plan</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Members</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-slate-500">
                  Loading...
                </td>
              </tr>
            ) : (
              filtered.map((org) => (
                <tr key={org.id} className="hover:bg-slate-750 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-white">{org.name}</p>
                    <p className="text-xs text-slate-500">{org.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{org.plan}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        org.status === 'ACTIVE'
                          ? 'bg-green-900 text-green-300'
                          : 'bg-red-900 text-red-300'
                      }`}
                    >
                      {org.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {org._count?.members ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleToggleStatus(org)}
                      className={`text-xs ${
                        org.status === 'ACTIVE'
                          ? 'text-red-400 hover:text-red-300 hover:bg-red-900/20'
                          : 'text-green-400 hover:text-green-300 hover:bg-green-900/20'
                      }`}
                    >
                      {org.status === 'ACTIVE' ? (
                        <><ShieldOff size={12} className="mr-1" />Suspend</>
                      ) : (
                        <><ShieldCheck size={12} className="mr-1" />Reactivate</>
                      )}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}