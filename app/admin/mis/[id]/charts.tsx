"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart as RPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS = ["#E85D04", "#F47B1F", "#0D1B2A", "#33495F", "#5C7187", "#8E9DAE", "#FFB97A"];

export function MISCharts({ data }: { data: any }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card title="Hours by Client">
        <ResponsiveContainer width="100%" height={280}>
          <RPieChart>
            <Pie
              data={data.byClient.map((c: any) => ({ name: c.clientCode, value: Number(c.hours) }))}
              dataKey="value"
              nameKey="name"
              outerRadius={90}
              label
            >
              {data.byClient.map((_: any, i: number) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </RPieChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Hours by Type">
        <ResponsiveContainer width="100%" height={280}>
          <RPieChart>
            <Pie
              data={data.byType.map((t: any) => ({ name: t.type, value: Number(t.hours) }))}
              dataKey="value"
              nameKey="name"
              innerRadius={50}
              outerRadius={90}
              label
            >
              {data.byType.map((_: any, i: number) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </RPieChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Hours by Week" wide>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data.byWeek}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="weekLabel" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="hours" fill="#E85D04" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Hours by Employee" wide>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data.byEmployee.map((e: any) => ({ name: e.employee, hours: Number(e.hours) }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="hours" fill="#0D1B2A" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

function Card({ title, children, wide }: { title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-white p-4 ${wide ? "md:col-span-2" : ""}`}>
      <h4 className="text-sm font-semibold text-slate-700 mb-3">{title}</h4>
      {children}
    </div>
  );
}
