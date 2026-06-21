import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  FlaskConical, Users, ClipboardList, CheckCircle2,
  Clock, XCircle, UserCog, TrendingUp,
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import { StatCard } from '../components/ui/StatCard'
import { Card, CardHeader } from '../components/ui/Card'
import { PageLoader } from '../components/ui/Spinner'
import { OrderStatusBadge } from '../components/ui/Badge'
import { useAuthStore } from '../store/authStore'
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

  return (
    <div>
      <Header
        title="Dashboard"
        subtitle={isAdmin ? 'Overview of laboratory operations' : 'Your lab operations at a glance'}
      />

      <div className="space-y-5 p-6">
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

        {/* Admin secondary stats */}
        {isAdmin && summary && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard title="Super Admins" value={summary.superAdmins} icon={<UserCog className="h-5 w-5" />} color="violet" />
            <StatCard title="Lab Users" value={summary.labUsers} icon={<TrendingUp className="h-5 w-5" />} color="blue" />
            <StatCard title="Pending Orders" value={summary.pendingOrders} icon={<Clock className="h-5 w-5" />} color="amber" />
            <StatCard title="Completed Orders" value={summary.completedOrders} icon={<CheckCircle2 className="h-5 w-5" />} color="emerald" />
          </div>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title="Orders by Status" subtitle="Current distribution of all orders" />
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barData} barSize={32} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    cursor={{ fill: '#F9FAFB' }}
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

          <Card>
            <CardHeader title="Top Tests" subtitle="By order volume" />
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="43%" innerRadius={38} outerRadius={65} paddingAngle={3} dataKey="value">
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} />
                  <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-52 items-center justify-center text-sm text-gray-400">No data yet</div>
            )}
          </Card>
        </div>

        {/* Alert banners */}
        {isAdmin && awaitingCount > 0 && (
          <div className="flex items-center gap-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
            <Clock className="h-5 w-5 shrink-0 text-amber-600" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">{awaitingCount} order{awaitingCount > 1 ? 's' : ''} awaiting approval</p>
              <p className="text-xs text-amber-700 mt-0.5">Review submitted test results in the Approvals section.</p>
            </div>
            <a href="/approvals" className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 transition-colors">
              Review
            </a>
          </div>
        )}

        {rejectedCount > 0 && (
          <div className="flex items-center gap-4 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
            <XCircle className="h-5 w-5 shrink-0 text-red-500" />
            <p className="text-sm font-semibold text-red-800">{rejectedCount} order{rejectedCount > 1 ? 's' : ''} rejected — check the Orders section for details.</p>
          </div>
        )}

        {/* Recent orders table */}
        <Card>
          <CardHeader
            title="Recent Orders"
            subtitle="Latest diagnostic orders"
            badge={<span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">{orders.length} total</span>}
          />
          {recentOrders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-[600px] w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Order', 'Patient', 'Test', 'Status', 'Date'].map(h => (
                      <th key={h} className="pb-3 text-left text-xs font-semibold text-gray-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map(order => (
                    <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-3 font-semibold text-gray-900">#{order.id}</td>
                      <td className="py-3 text-gray-600">{order.patient?.fullName ?? '—'}</td>
                      <td className="py-3 text-gray-500 text-xs">{order.template?.name ?? '—'}</td>
                      <td className="py-3"><OrderStatusBadge status={order.status} /></td>
                      <td className="py-3 text-xs text-gray-400">
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
      </div>
    </div>
  )
}

