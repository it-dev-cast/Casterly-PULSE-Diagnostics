import {
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  Package,
  Users,
  BarChart3,
  Activity,
  Cpu,
  Plus,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

const hourlyData = [
  { hour: "08:00", inspections: 4 },
  { hour: "09:00", inspections: 7 },
  { hour: "10:00", inspections: 11 },
  { hour: "11:00", inspections: 9 },
  { hour: "12:00", inspections: 3 },
  { hour: "13:00", inspections: 8 },
  { hour: "14:00", inspections: 12 },
  { hour: "15:00", inspections: 6 },
];

const technicianData = [
  { name: "Ravikiran K.", inspections: 14, passed: 12, failed: 2, avgTime: "18m" },
  { name: "Priya S.", inspections: 11, passed: 10, failed: 1, avgTime: "21m" },
  { name: "Mohamed A.", inspections: 9, passed: 8, failed: 1, avgTime: "22m" },
  { name: "Sarah L.", inspections: 7, passed: 6, failed: 1, avgTime: "19m" },
];

const lotStats = [
  { lot: "CLY-003", total: 48, completed: 32, passed: 28, failed: 4, progress: 67 },
  { lot: "CLY-002", total: 60, completed: 60, passed: 54, failed: 6, progress: 100 },
  { lot: "CLY-001", total: 45, completed: 45, passed: 41, failed: 4, progress: 100 },
];

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
  bg: string;
}

function StatCard({ label, value, sub, icon: Icon, color, bg }: StatCardProps) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
        <Icon size={20} className={color} />
      </div>
      <div>
        <div className="text-2xl text-slate-800 leading-none">{value}</div>
        <div className="text-sm text-slate-500 mt-1">{label}</div>
        {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

interface DashboardProps {
  onStartInspection: () => void;
}

export function Dashboard({ onStartInspection }: DashboardProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-800">Operations Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Today — Sunday, 7 June 2026 · Shift A</p>
        </div>
        <button
          onClick={onStartInspection}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} />
          New Inspection
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Total Inspections Today"
          value="41"
          sub="↑ 8 vs yesterday"
          icon={BarChart3}
          color="text-blue-600"
          bg="bg-blue-50"
        />
        <StatCard
          label="Devices Passed"
          value="35"
          sub="85.4% pass rate"
          icon={CheckCircle2}
          color="text-emerald-600"
          bg="bg-emerald-50"
        />
        <StatCard
          label="Devices Failed"
          value="6"
          sub="14.6% fail rate"
          icon={XCircle}
          color="text-red-500"
          bg="bg-red-50"
        />
        <StatCard
          label="Avg Inspection Time"
          value="19m"
          sub="↓ 2m vs yesterday"
          icon={Clock}
          color="text-orange-500"
          bg="bg-orange-50"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Hourly throughput */}
        <div className="col-span-2 bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-slate-700">Hourly Throughput</h3>
              <p className="text-xs text-slate-400 mt-0.5">Inspections completed per hour</p>
            </div>
            <Activity size={16} className="text-slate-400" />
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={hourlyData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "#1e293b", border: "none", borderRadius: 6, fontSize: 12, color: "#fff" }}
              />
              <Bar dataKey="inspections" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* LOT overview */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-slate-700">Active LOTs</h3>
              <p className="text-xs text-slate-400 mt-0.5">Completion status</p>
            </div>
            <Package size={16} className="text-slate-400" />
          </div>
          <div className="space-y-4">
            {lotStats.map((lot) => (
              <div key={lot.lot}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600 font-medium">{lot.lot}</span>
                  <span className="text-slate-400">{lot.completed}/{lot.total}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${lot.progress === 100 ? "bg-emerald-500" : "bg-blue-500"}`}
                    style={{ width: `${lot.progress}%` }}
                  />
                </div>
                <div className="flex gap-3 mt-1 text-[10px]">
                  <span className="text-emerald-600">{lot.passed} Pass</span>
                  <span className="text-red-500">{lot.failed} Fail</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Technician Performance */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-slate-700">Technician Performance</h3>
            <p className="text-xs text-slate-400 mt-0.5">Today's summary</p>
          </div>
          <Users size={16} className="text-slate-400" />
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              {["Technician", "Inspections", "Passed", "Failed", "Pass Rate", "Avg Time"].map((h) => (
                <th key={h} className="text-left text-xs text-slate-400 pb-2 pr-4">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {technicianData.map((t) => {
              const rate = Math.round((t.passed / t.inspections) * 100);
              return (
                <tr key={t.name} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs">
                        {t.name.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <span className="text-slate-700">{t.name}</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 text-slate-600">{t.inspections}</td>
                  <td className="py-2.5 pr-4 text-emerald-600">{t.passed}</td>
                  <td className="py-2.5 pr-4 text-red-500">{t.failed}</td>
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${rate >= 90 ? "bg-emerald-500" : rate >= 75 ? "bg-amber-500" : "bg-red-500"}`}
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                      <span className="text-slate-600 text-xs">{rate}%</span>
                    </div>
                  </td>
                  <td className="py-2.5 text-slate-500 text-xs">{t.avgTime}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
