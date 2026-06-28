import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts'
import {
  FlaskConical, Users, ClipboardList, CheckCircle2,
  Clock, XCircle, Download,
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Button } from '../components/ui/Button'
import { StatCard } from '../components/ui/StatCard'
import { Card, CardHeader } from '../components/ui/Card'
import { PageLoader } from '../components/ui/Spinner'
import { PageContent } from '../components/ui/PageContent'
import { OrderStatusBadge } from '../components/ui/Badge'
import { useAuthStore } from '../store/authStore'
import { useThemeStore } from '../store/themeStore'
import { dashboardService } from '../services/dashboard'
import { orderService } from '../services/orders'
import { patientService } from '../services/patients'
import { templateService } from '../services/templates'

const STATUS_COLORS: Record<string, string> = {
  PENDING:           '#9CA3AF',
  IN_PROGRESS:       '#3B82F6',
  AWAITING_APPROVAL: '#F59E0B',
  APPROVED:          '#10B981',
  REJECTED:          '#EF4444',
}

const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']

export default function DashboardPage() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'SUPER_ADMIN'
  const { theme } = useThemeStore()

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

  const { data: trends = [] } = useQuery({
    queryKey: ['dashboard-trends'],
    queryFn: dashboardService.getTrends,
    enabled: isAdmin,
  })

  const isLoading = isAdmin ? summaryLoading : ordersLoading

  if (isLoading) return (
    <div>
      <Header title="Dashboard" />
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
    fill: STATUS_COLORS[status] || '#6B7280',
  }))

  const pieData = templates.slice(0, 5).map((t, i) => ({
    name: t.name,
    value: orders.filter(o => o.template?.id === t.id).length || 1,
    color: PIE_COLORS[i % PIE_COLORS.length],
  }))

  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 5)

  const awaitingCount = orders.filter(o => o.status === 'AWAITING_APPROVAL').length
  const rejectedCount = orders.filter(o => o.status === 'REJECTED').length

  const exportCsv = () => {
    if (!trends.length) return
    const rows = [
      ['Month', 'Orders', 'Approved', 'Revenue (₹)'],
      ...trends.map(t => [t.month, String(t.orders), String(t.approved), String(t.revenue)]),
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'lab-revenue-report.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <Header
        title="Dashboard"
        subtitle={isAdmin ? 'Overview of laboratory operations' : 'Your lab operations at a glance'}
        action={isAdmin && trends.length > 0 ? (
          <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={exportCsv} size="sm">
            Export CSV
          </Button>
        ) : undefined}
      />

      <PageContent className="space-y-5">
        {/* Primary stats */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {isAdmin ? (
            <>
              <StatCard title="Test Templates" value={summary?.templates ?? 0} subtitle={`${summary?.activeTemplates ?? 0} active`} icon={<FlaskConical className="h-5 w-5" />} color="blue" />
              <StatCard title="Total Patients" value={summary?.patients ?? 0} icon={<Users className="h-5 w-5" />} color="emerald" />
              <StatCard title="Total Orders" value={summary?.orders ?? 0} subtitle={`${summary?.pendingOrders ?? 0} pending`} icon={<ClipboardList className="h-5 w-5" />} color="amber" />
              <StatCard title="Completed" value={summary?.completedOrders ?? 0} icon={<CheckCircle2 className="h-5 w-5" />} color="emerald" />
            </>
          ) : (
            <>
              <StatCard title="Templates" value={templates.length} icon={<FlaskConical className="h-5 w-5" />} color="blue" />
              <StatCard title="Patients" value={patients.length} icon={<Users className="h-5 w-5" />} color="emerald" />
              <StatCard title="Total Orders" value={orders.length} icon={<ClipboardList className="h-5 w-5" />} color="amber" />
              <StatCard title="Approved" value={orders.filter(o => o.status === 'APPROVED').length} icon={<CheckCircle2 className="h-5 w-5" />} color="emerald" />
            </>
          )}
        </div>

        {/* Charts row 1: Orders trend + Pie */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title="Monthly Orders Trend" subtitle="Order volume over the last months" />
            {trends.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={trends} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="ordersGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#374151' : '#F3F4F6'} vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: theme === 'dark' ? '#6B7280' : '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: theme === 'dark' ? '#6B7280' : '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: `1px solid ${theme === 'dark' ? '#374151' : '#E5E7EB'}`, fontSize: 12, background: theme === 'dark' ? '#1F2937' : '#fff', color: theme === 'dark' ? '#F9FAFB' : '#111' }} />
                  <Area type="monotone" dataKey="orders" stroke="#3B82F6" strokeWidth={2} fill="url(#ordersGrad)" dot={{ r: 3, fill: '#3B82F6' }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-52 items-center justify-center text-sm text-gray-400">No trend data yet</div>
            )}
          </Card>

          <Card>
            <CardHeader title="Top Tests" subtitle="By order volume" />
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="43%" innerRadius={38} outerRadius={65} paddingAngle={3} dataKey="value">
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: `1px solid ${theme === 'dark' ? '#374151' : '#E5E7EB'}`, fontSize: 12, background: theme === 'dark' ? '#1F2937' : '#fff', color: theme === 'dark' ? '#F9FAFB' : '#111' }} />
                  <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-52 items-center justify-center text-sm text-gray-400">No data yet</div>
            )}
          </Card>
        </div>

        {/* Charts row 2: Revenue trend + Orders by status */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title="Monthly Revenue Trend" subtitle="Revenue generated over the last months" />
            {trends.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={trends} barSize={28} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#374151' : '#F3F4F6'} vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: theme === 'dark' ? '#6B7280' : '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: theme === 'dark' ? '#6B7280' : '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false}
                    tickFormatter={(v) => v >= 1000 ? `₹${(v/1000).toFixed(0)}k` : `₹${v}`} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: `1px solid ${theme === 'dark' ? '#374151' : '#E5E7EB'}`, fontSize: 12, background: theme === 'dark' ? '#1F2937' : '#fff', color: theme === 'dark' ? '#F9FAFB' : '#111' }}
                    formatter={(value: number) => [`₹${value.toLocaleString()}`, 'Revenue']}
                  />
                  <Bar dataKey="revenue" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-52 items-center justify-center text-sm text-gray-400">No revenue data yet</div>
            )}
          </Card>

          <Card>
            <CardHeader title="Orders by Status" subtitle="Current distribution" />
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barData} barSize={24} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#374151' : '#F3F4F6'} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: theme === 'dark' ? '#6B7280' : '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: theme === 'dark' ? '#6B7280' : '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: `1px solid ${theme === 'dark' ? '#374151' : '#E5E7EB'}`, fontSize: 12, background: theme === 'dark' ? '#1F2937' : '#fff', color: theme === 'dark' ? '#F9FAFB' : '#111' }}
                    cursor={{ fill: theme === 'dark' ? '#374151' : '#F9FAFB' }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {barData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-52 items-center justify-center text-sm text-gray-400">No orders yet</div>
            )}
          </Card>
        </div>

        {/* Alert banners */}
        {isAdmin && awaitingCount > 0 && (
          <div className="flex items-center gap-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 dark:border-amber-800/50 dark:bg-amber-900/20">
            <Clock className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">{awaitingCount} order{awaitingCount > 1 ? 's' : ''} awaiting approval</p>
              <p className="text-xs text-amber-700 mt-0.5 dark:text-amber-400">Review submitted test results in the Approvals section.</p>
            </div>
            <Link to="/approvals" className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 transition-colors">
              Review
            </Link>
          </div>
        )}

        {rejectedCount > 0 && (
          <div className="flex items-center gap-4 rounded-xl border border-red-200 bg-red-50 px-5 py-4 dark:border-red-800/50 dark:bg-red-900/20">
            <XCircle className="h-5 w-5 shrink-0 text-red-500 dark:text-red-400" />
            <p className="text-sm font-semibold text-red-800 dark:text-red-300">{rejectedCount} order{rejectedCount > 1 ? 's' : ''} rejected — check the Orders section for details.</p>
          </div>
        )}

        {/* Recent orders table */}
        <Card>
          <CardHeader
            title="Recent Orders"
            subtitle="Latest diagnostic orders"
            badge={<span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">{orders.length} total</span>}
          />
          {recentOrders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-[600px] w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    {['Order', 'Patient', 'Test', 'Status', 'Date'].map(h => (
                      <th key={h} className="pb-3 text-left text-xs font-semibold text-gray-400 dark:text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map(order => (
                    <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors dark:border-gray-700/50 dark:hover:bg-gray-700/30">
                      <td className="py-3 font-semibold text-gray-900 dark:text-gray-200">#{order.id}</td>
                      <td className="py-3 text-gray-600 dark:text-gray-300">{order.patient?.fullName ?? '—'}</td>
                      <td className="py-3 text-gray-500 text-xs dark:text-gray-400">{order.template?.name ?? '—'}</td>
                      <td className="py-3"><OrderStatusBadge status={order.status} /></td>
                      <td className="py-3 text-xs text-gray-400 dark:text-gray-500">
                        {order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-gray-400">No orders yet</p>
          )}
        </Card>
      </PageContent>
    </div>
  )
}

