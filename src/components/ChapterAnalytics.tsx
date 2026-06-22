import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { SyncedUserProfile } from '../lib/fetchAndSyncData';

interface ChapterAnalyticsProps {
  members: SyncedUserProfile[];
  chapter: string | string[];
}

const COLORS = ['#10b981', '#f59e0b', '#0f2d52', '#f43f5e'];

export default function ChapterAnalytics({ members, chapter }: ChapterAnalyticsProps) {
  const chapterMembers = useMemo(() => {
    if (Array.isArray(chapter)) {
      return members.filter(m => chapter.includes(m.chapter));
    }
    return members.filter(m => m.chapter === chapter);
  }, [members, chapter]);

  const stats = useMemo(() => {
    const active = chapterMembers.filter(m => m.status === 'active').length;
    const pending = chapterMembers.filter(m => m.status === 'pending').length;
    const suspended = chapterMembers.filter(m => m.status === 'suspended').length;
    
    // Mock event attendance for charts
    const attendanceData = [
      { name: 'Jan', attendance: Math.floor(Math.random() * 50) + 10 },
      { name: 'Feb', attendance: Math.floor(Math.random() * 50) + 20 },
      { name: 'Mar', attendance: Math.floor(Math.random() * 50) + 30 },
      { name: 'Apr', attendance: Math.floor(Math.random() * 50) + 40 },
    ];
    
    const feesData = [
      { name: 'Collected', value: active * 50 },
      { name: 'Pending', value: pending * 50 },
    ];

    return { active, pending, suspended, attendanceData, feesData };
  }, [chapterMembers]);

  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-300">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border p-4 rounded-xl shadow-sm text-center">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Members</h4>
          <p className="text-3xl font-black text-[#0f2d52]">{stats.active}</p>
        </div>
        <div className="bg-white border p-4 rounded-xl shadow-sm text-center">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending Approval</h4>
          <p className="text-3xl font-black text-amber-500">{stats.pending}</p>
        </div>
        <div className="bg-white border p-4 rounded-xl shadow-sm text-center">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Suspended</h4>
          <p className="text-3xl font-black text-rose-500">{stats.suspended}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border p-5 rounded-xl shadow-sm">
          <h3 className="text-sm font-black text-[#0f2d52] mb-4">Event Attendance (Monthly)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.attendanceData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip />
                <Area type="monotone" dataKey="attendance" stroke="#0f2d52" fill="#0f2d52" fillOpacity={0.2} strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border p-5 rounded-xl shadow-sm">
          <h3 className="text-sm font-black text-[#0f2d52] mb-4">Fee Collections Activity</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.feesData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats.feesData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-2">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#10b981]"></div><span className="text-xs font-bold text-slate-600">Collected</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#f59e0b]"></div><span className="text-xs font-bold text-slate-600">Pending</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
