/**
 * Admin Users — List users, manage roles, view order history
 * Also allows creating/managing staff accounts with username/password login.
 */
import React, { useState } from 'react';
import { Search, Users, Shield, User, ChevronDown, ChevronUp, Loader2, ShoppingBag, Plus, Key, X } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

/** Dialog to create or reset a staff user's password */
function StaffPasswordDialog({
  onClose,
  existingUsername,
  existingRole,
  existingName,
}: {
  onClose: () => void;
  existingUsername?: string;
  existingRole?: 'admin' | 'pos' | 'orders';
  existingName?: string;
}) {
  const [username, setUsername] = useState(existingUsername || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState(existingName || '');
  const [role, setRole] = useState<'admin' | 'pos' | 'orders'>(existingRole || 'pos');
  const utils = trpc.useUtils();

  const setPasswordMutation = trpc.auth.setStaffPassword.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      toast.success(existingUsername ? `Password updated for ${username}` : `Staff user "${username}" created`);
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) { toast.error('Username is required'); return; }
    if (!/^[a-z0-9_]+$/.test(username)) { toast.error('Username must be lowercase letters, numbers, or underscores'); return; }
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (password !== confirmPassword) { toast.error('Passwords do not match'); return; }
    setPasswordMutation.mutate({ username, password, name: name || undefined, role });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6" style={{ borderTop: '3px solid #9D7D39' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-light" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}>
            {existingUsername ? `Reset Password — ${existingUsername}` : 'Create Staff Account'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username (locked if editing) */}
          <div>
            <label className="block text-xs font-semibold tracking-wider uppercase mb-1.5" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              disabled={!!existingUsername}
              placeholder="e.g. john_pos"
              className="w-full px-4 py-2.5 text-sm border outline-none focus:border-[#9D7D39] transition-colors disabled:bg-gray-50 disabled:text-gray-400"
              style={{ borderColor: '#E8E4DC', fontFamily: 'Montserrat, sans-serif', color: '#242424' }}
            />
          </div>

          {/* Display name */}
          {!existingUsername && (
            <div>
              <label className="block text-xs font-semibold tracking-wider uppercase mb-1.5" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                Display Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Smith"
                className="w-full px-4 py-2.5 text-sm border outline-none focus:border-[#9D7D39] transition-colors"
                style={{ borderColor: '#E8E4DC', fontFamily: 'Montserrat, sans-serif', color: '#242424' }}
              />
            </div>
          )}

          {/* Role */}
          {!existingUsername && (
            <div>
              <label className="block text-xs font-semibold tracking-wider uppercase mb-1.5" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full px-4 py-2.5 text-sm border outline-none focus:border-[#9D7D39] transition-colors bg-white"
                style={{ borderColor: '#E8E4DC', fontFamily: 'Montserrat, sans-serif', color: '#242424' }}
              >
                <option value="admin">Admin</option>
                <option value="pos">POS Staff</option>
                <option value="orders">Orders Staff</option>
              </select>
            </div>
          )}

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold tracking-wider uppercase mb-1.5" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
              {existingUsername ? 'New Password' : 'Password'}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              className="w-full px-4 py-2.5 text-sm border outline-none focus:border-[#9D7D39] transition-colors"
              style={{ borderColor: '#E8E4DC', fontFamily: 'Montserrat, sans-serif', color: '#242424' }}
            />
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-semibold tracking-wider uppercase mb-1.5" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat password"
              className="w-full px-4 py-2.5 text-sm border outline-none focus:border-[#9D7D39] transition-colors"
              style={{ borderColor: '#E8E4DC', fontFamily: 'Montserrat, sans-serif', color: '#242424' }}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-xs font-semibold tracking-wider uppercase border transition-colors hover:bg-gray-50"
              style={{ borderColor: '#E8E4DC', color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={setPasswordMutation.isPending}
              className="flex-1 py-2.5 text-xs font-semibold tracking-wider uppercase transition-colors flex items-center justify-center gap-2"
              style={{ backgroundColor: '#9D7D39', color: '#FAFAF8', fontFamily: 'Montserrat, sans-serif', opacity: setPasswordMutation.isPending ? 0.7 : 1 }}
            >
              {setPasswordMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : null}
              {existingUsername ? 'Update Password' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminUsers() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'admin' | 'pos' | 'orders'>('all');
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);
  const [showCreateStaff, setShowCreateStaff] = useState(false);
  const [resetPasswordFor, setResetPasswordFor] = useState<{ username: string; role: 'admin' | 'pos' | 'orders'; name: string } | null>(null);
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.users.list.useQuery({
    search: search || undefined,
    role: roleFilter,
    limit: 50,
  });

  const updateRoleMutation = trpc.users.updateRole.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      toast.success('Role updated');
    },
    onError: (err) => toast.error(err.message),
  });

  const { data: orderHistory, isLoading: historyLoading } = trpc.users.orderHistory.useQuery(
    { userId: expandedUserId! },
    { enabled: expandedUserId !== null }
  );

  const users = data?.users || [];
  const total = data?.total || 0;

  const formatDate = (d: any) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  /** Extract username from openId for staff users */
  const getUsername = (openId: string) => {
    if (openId.startsWith('staff:')) return openId.replace('staff:', '');
    return null;
  };

  return (
    <AdminLayout>
      <div className="p-6 md:p-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-1" style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>
              Management
            </p>
            <h1 className="text-3xl font-light" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}>
              Users
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
              <Users size={14} className="inline mr-1" />{total} total
            </span>
            <button
              onClick={() => setShowCreateStaff(true)}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold tracking-wider uppercase transition-colors"
              style={{ backgroundColor: '#9D7D39', color: '#FAFAF8', fontFamily: 'Montserrat, sans-serif' }}
            >
              <Plus size={14} />
              Add Staff
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#8A8A82' }} />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 text-sm border bg-white outline-none focus:border-[#9D7D39] transition-colors"
              style={{ borderColor: '#E8E4DC', fontFamily: 'Montserrat, sans-serif', color: '#242424' }}
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="px-4 py-3 text-xs font-semibold tracking-wider uppercase border bg-white outline-none focus:border-[#9D7D39] transition-colors"
            style={{ borderColor: '#E8E4DC', fontFamily: 'Montserrat, sans-serif', color: '#242424' }}
          >
            <option value="all">All Roles</option>
            <option value="user">Customers</option>
            <option value="admin">Admins</option>
            <option value="pos">POS Staff</option>
            <option value="orders">Orders Staff</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden" style={{ borderColor: '#E8E4DC' }}>
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="animate-spin" size={28} style={{ color: '#9D7D39' }} />
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Users size={40} className="mb-4" style={{ color: '#D4C9B8' }} />
              <p className="text-sm" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                No users found
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid #E8E4DC' }}>
                    {['User', 'Login', 'Role', 'Joined', 'Last Sign In', 'Orders', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold tracking-wider uppercase"
                        style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u: any) => {
                    const username = getUsername(u.openId);
                    const isStaff = !!username;
                    return (
                      <React.Fragment key={u.id}>
                        <tr className="border-b hover:bg-gray-50 transition-colors" style={{ borderColor: '#F0EDE8' }}>
                          {/* User */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                                style={{ backgroundColor: u.role === 'admin' ? '#9D7D39' : u.role === 'pos' ? '#2563EB' : u.role === 'orders' ? '#7C3AED' : '#E8E4DC', color: u.role === 'admin' || u.role === 'pos' || u.role === 'orders' ? '#FAFAF8' : '#8A8A82' }}>
                                {(u.name || u.email || 'U').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-xs" style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>
                                  {u.name || '(no name)'}
                                </p>
                                <p className="text-[10px]" style={{ color: '#8A8A82' }}>ID: {u.id}</p>
                              </div>
                            </div>
                          </td>
                          {/* Login method */}
                          <td className="px-4 py-3 text-xs" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                            {isStaff ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-full bg-slate-100 text-slate-600">
                                <Key size={9} /> {username}
                              </span>
                            ) : (
                              u.email || u.loginMethod || '—'
                            )}
                          </td>
                          {/* Role */}
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold tracking-wider uppercase rounded-full ${
                              u.role === 'admin' ? 'bg-amber-100 text-amber-800' : u.role === 'pos' ? 'bg-blue-100 text-blue-800' : u.role === 'orders' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {u.role === 'admin' ? <Shield size={10} /> : <User size={10} />}
                              {u.role}
                            </span>
                          </td>
                          {/* Joined */}
                          <td className="px-4 py-3 text-xs" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                            {formatDate(u.createdAt)}
                          </td>
                          {/* Last Sign In */}
                          <td className="px-4 py-3 text-xs" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                            {formatDate(u.lastSignedIn)}
                          </td>
                          {/* Orders */}
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setExpandedUserId(expandedUserId === u.id ? null : u.id)}
                              className="flex items-center gap-1 text-xs hover:text-[#9D7D39] transition-colors"
                              style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}
                            >
                              <ShoppingBag size={12} />
                              History
                              {expandedUserId === u.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>
                          </td>
                          {/* Actions */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <select
                                value={u.role}
                                onChange={(e) => updateRoleMutation.mutate({ id: u.id, role: e.target.value as 'user' | 'admin' | 'pos' | 'orders' })}
                                disabled={updateRoleMutation.isPending}
                                className="px-2 py-1 text-[10px] font-semibold tracking-wider uppercase border outline-none focus:border-[#9D7D39] transition-colors bg-white"
                                style={{ borderColor: '#E8E4DC', fontFamily: 'Montserrat, sans-serif', color: '#242424' }}
                              >
                                <option value="user">Customer</option>
                                <option value="admin">Admin</option>
                                <option value="pos">POS Staff</option>
                                <option value="orders">Orders Staff</option>
                              </select>
                              {isStaff && (
                                <button
                                  onClick={() => setResetPasswordFor({ username: username!, role: u.role, name: u.name || '' })}
                                  title="Reset password"
                                  className="p-1.5 rounded hover:bg-amber-50 transition-colors"
                                  style={{ color: '#9D7D39' }}
                                >
                                  <Key size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {/* Order History Expansion */}
                        {expandedUserId === u.id && (
                          <tr key={`${u.id}-history`} style={{ backgroundColor: '#FAFAF8' }}>
                            <td colSpan={7} className="px-6 py-4">
                              {historyLoading ? (
                                <div className="flex items-center gap-2 text-xs" style={{ color: '#8A8A82' }}>
                                  <Loader2 size={12} className="animate-spin" /> Loading order history...
                                </div>
                              ) : !orderHistory || orderHistory.length === 0 ? (
                                <p className="text-xs" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                                  No orders found for this user.
                                </p>
                              ) : (
                                <div>
                                  <p className="text-xs font-semibold tracking-wider uppercase mb-3" style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>
                                    Order History ({orderHistory.length})
                                  </p>
                                  <div className="space-y-2">
                                    {orderHistory.map((order: any) => (
                                      <div key={order.id} className="flex items-center justify-between py-2 px-3 bg-white rounded border" style={{ borderColor: '#E8E4DC' }}>
                                        <div className="flex items-center gap-4">
                                          <span className="text-xs font-semibold" style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>
                                            #{order.orderNumber}
                                          </span>
                                          <span className="text-xs" style={{ color: '#8A8A82' }}>{formatDate(order.createdAt)}</span>
                                          <span className={`text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full ${
                                            order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                                            order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                            order.status === 'shipped' ? 'bg-blue-100 text-blue-700' :
                                            'bg-amber-100 text-amber-700'
                                          }`}>
                                            {order.status}
                                          </span>
                                        </div>
                                        <span className="text-xs font-semibold italic" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#9D7D39' }}>
                                          {parseFloat(String(order.total || 0)).toFixed(3)} KWD
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create Staff Dialog */}
      {showCreateStaff && (
        <StaffPasswordDialog onClose={() => setShowCreateStaff(false)} />
      )}

      {/* Reset Password Dialog */}
      {resetPasswordFor && (
        <StaffPasswordDialog
          existingUsername={resetPasswordFor.username}
          existingRole={resetPasswordFor.role}
          existingName={resetPasswordFor.name}
          onClose={() => setResetPasswordFor(null)}
        />
      )}
    </AdminLayout>
  );
}
