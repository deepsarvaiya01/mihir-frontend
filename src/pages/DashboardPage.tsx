import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { FlaskConical, Users, ClipboardList, CheckCircle2, Clock, XCircle, UserCog, Activity } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { StatCard } from '../components/ui/StatCard'
import { Card, CardHeader } from '../components/ui/Card'
import { PageLoader } from '../components/ui/Spinner'
import { useAuthStore } from '../store/authStore'
import { dashboardService } from '../services/dashboard'
import { orderService } from '../services/orders'
import { patientService } from '../services/patients'
import { templateService } from '../services/templates'
import { OrderStatusBadge } from '../components/ui/Badge'

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#94a3b8',
  IN_PROGRESS: '#3b82f6',
  AWAITING_APPROVAL: '#f59e0b',
  APPROVED: '#10b981',
  REJECTED: '#f43f5e',
}

const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#3b82f6']

export default function DashboardPage() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'SUPER_ADMIN'

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: dashboardService.getSummary,
    enabled: isAdmin,
  })

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: orderService.getAll,
  })

  const { data: patients = [] } = useQuery({
    queryKey: ['patients'],
    queryFn: () => patientService.getAll(),
    enabled: !isAdmin,
  })

  const { data: templates = [] } = useQuery({
    queryKey: ['templates'],
    queryFn: templateService.getAll,
  })

  const isLoading = isAdmin ? summaryLoading : ordersLoading

  if (isLoading) return (
    <div>
      <Header title="Dashboard" subtitle={isAdmin ? 'Executive overview' : 'Lab operations overview'} />
      <div className="p-6"><PageLoader /></div>
    </div>
  )

  const statusCounts = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1
    return acc
  }, {})

  const barData = Object.entries(statusCounts).map(([status, count]) => ({
    name: status.replace(/_/g, ' '),
    count,
    fill: STATUS_COLORS[status] || '#6366f1',
  }))

  const pieData = templates.slice(0, 5).map((t, i) => ({
    name: t.name,
    value: orders.filter(o => o.template?.id === t.id).length || 1,
    color: PIE_COLORS[i % PIE_COLORS.length],
  }))

  const recentOrders = [...orders].sort((a, b) =>
    new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  ).slice(0, 5)

  return (
    <div>
      <Header
        title="Dashboard"
        subtitle={isAdmin ? 'Executive overview of laboratory operations' : 'Your lab operations at a glance'}
      />
      <div className="p-6 space-y-6">
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {isAdmin ? (
            <>
              <StatCard title="Test Templates" value={summary?.templates ?? 0} subtitle={`${summary?.activeTemplates ?? 0} active`} icon={<FlaskConical className="h-5 w-5 text-indigo-600" />} iconBg="bg-indigo-100" />
              <StatCard title="Total Patients" value={summary?.patients ?? 0} icon={<Users className="h-5 w-5 text-emerald-600" />} iconBg="bg-emerald-100" />
              <StatCard title="Total Orders" value={summary?.orders ?? 0} subtitle={`${summary?.pendingOrders ?? 0} pending`} icon={<ClipboardList className="h-5 w-5 text-amber-600" />} iconBg="bg-amber-100" />
              <StatCard title="Completed" value={summary?.completedOrders ?? 0} icon={<CheckCircle2 className="h-5 w-5 text-violet-600" />} iconBg="bg-violet-100" />
            </>
          ) : (
            <>
              <StatCard title="Templates" value={templates.length} icon={<FlaskConical className="h-5 w-5 text-indigo-600" />} iconBg="bg-indigo-100" />
              <StatCard title="My Patients" value={patients.length} icon={<Users className="h-5 w-5 text-emerald-600" />} iconBg="bg-emerald-100" />
              <StatCard title="Total Orders" value={orders.length} icon={<ClipboardList className="h-5 w-5 text-amber-600" />} iconBg="bg-amber-100" />
              <StatCard title="Approved" value={orders.filter(o => o.status === 'APPROVED').length} icon={<CheckCircle2 className="h-5 w-5 text-violet-600" />} iconBg="bg-violet-100" />
            </>
          )}
        </div>

        {isAdmin && summary && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard title="Super Admins" value={summary.superAdmins} icon={<UserCog className="h-5 w-5 text-rose-600" />} iconBg="bg-rose-100" />
            <StatCard title="Lab Users" value={summary.labUsers} icon={<Activity className="h-5 w-5 text-blue-600" />} iconBg="bg-blue-100" />
            <StatCard title="Pending Orders" value={summary.pendingOrders} icon={<Clock className="h-5 w-5 text-amber-600" />} iconBg="bg-amber-100" />
            <StatCard title="Completed Orders" value={summary.completedOrders} icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />} iconBg="bg-emerald-100" />
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Bar chart */}
          <Card className="lg:col-span-2">
            <CardHeader title="Orders by Status" subtitle="Distribution of all diagnostic orders" />
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={barData} barSize={36}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                    cursor={{ fill: '#f8fafc' }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {barData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-64 items-center justify-center text-sm text-slate-400">No order data yet</div>
            )}
          </Card>

          {/* Pie chart */}
          <Card>
            <CardHeader title="Tests by Template" subtitle="Order distribution" />
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="45%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-64 items-center justify-center text-sm text-slate-400">No data yet</div>
            )}
          </Card>
        </div>

        {/* Recent orders */}
        <Card>
          <CardHeader title="Recent Orders" subtitle="Latest diagnostic orders" badge={<span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{orders.length} total</span>} />
          {recentOrders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Order</th>
                    <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Patient</th>
                    <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Test</th>
                    <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Status</th>
                    <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {recentOrders.map(order => (
                    <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 font-semibold text-slate-700">#{order.id}</td>
                      <td className="py-3 text-slate-600">{order.patient?.fullName ?? '—'}</td>
                      <td className="py-3 text-slate-500">{order.template?.name ?? '—'}</td>
                      <td className="py-3"><OrderStatusBadge status={order.status} /></td>
                      <td className="py-3 text-slate-400 text-xs">{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex items-center justify-center h-24 text-sm text-slate-400">No orders yet</div>
          )}
        </Card>

        {/* Awaiting approval callout for admins */}
        {isAdmin && orders.filter(o => o.status === 'AWAITING_APPROVAL').length > 0 && (
          <Card className="border-amber-200 bg-amber-50">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-amber-900">
                  {orders.filter(o => o.status === 'AWAITING_APPROVAL').length} order(s) awaiting your approval
                </p>
                <p className="text-sm text-amber-700">Review and approve submitted test results in the Approvals section.</p>
              </div>
              <a href="/approvals" className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition-colors">
                Review Now
              </a>
            </div>
          </Card>
        )}

        {/* Rejected orders info */}
        {orders.filter(o => o.status === 'REJECTED').length > 0 && (
          <Card className="border-rose-200 bg-rose-50">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100">
                <XCircle className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <p className="font-semibold text-rose-900">
                  {orders.filter(o => o.status === 'REJECTED').length} order(s) rejected
                </p>
                <p className="text-sm text-rose-700">Some test results were rejected. Check the Orders section for details.</p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
