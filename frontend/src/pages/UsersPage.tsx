import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { apiGet, apiPost, apiPut, apiDelete } from '@/utils/fetchInterceptor';
import type { User, UserStats } from '@/types';

const UsersPage: React.FC = () => {
  const navigate = useNavigate();
  const { auth } = useAuth();
  const { showToast } = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [systemStats, setSystemStats] = useState({ servers: 0, groups: 0, endpoints: 0 });

  // Modal state
  const [showCreate, setShowCreate] = useState(false);
  const [showBatchAdd, setShowBatchAdd] = useState(false);
  const [showBatchPerm, setShowBatchPerm] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [showBatchDelete, setShowBatchDelete] = useState(false);

  // Single user form
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formIsAdmin, setFormIsAdmin] = useState(false);
  const [formNewPassword, setFormNewPassword] = useState('');
  const [formCanAccessMarket, setFormCanAccessMarket] = useState(false);
  const [formCanCreateServer, setFormCanCreateServer] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Batch add form
  const [batchText, setBatchText] = useState('');
  const [batchIsAdmin, setBatchIsAdmin] = useState(false);

  // Batch permissions form
  const [batchPermMarket, setBatchPermMarket] = useState(false);
  const [batchPermCreate, setBatchPermCreate] = useState(false);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiGet<{ success: boolean; data: User[] }>('/users');
      if (res.success) setUsers(res.data);
    } finally { setIsLoading(false); }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await apiGet<{ success: boolean; data: UserStats }>('/users-stats');
      if (res.success) setStats(res.data);
    } catch {}
  }, []);

  const fetchSystemStats = useCallback(async () => {
    try {
      const [sr, gr, er] = await Promise.all([
        apiGet<{ success: boolean; data: any[] }>('/servers'),
        apiGet<{ success: boolean; data: any[] }>('/groups'),
        apiGet<{ success: boolean; data: any[] }>('/xiaozhi/endpoints'),
      ]);
      setSystemStats({
        servers: sr.success ? (sr.data || []).length : 0,
        groups: gr.success ? (gr.data || []).length : 0,
        endpoints: er.success ? (er.data || []).length : 0,
      });
    } catch {}
  }, []);

  useEffect(() => { fetchUsers(); fetchStats(); fetchSystemStats(); }, [fetchUsers, fetchStats, fetchSystemStats]);

  const resetForm = () => {
    setFormUsername(''); setFormPassword(''); setFormIsAdmin(false);
    setFormNewPassword(''); setFormCanAccessMarket(false); setFormCanCreateServer(false);
  };

  const formatDate = (d?: string | null) => {
    if (!d) return '-';
    return new Date(d).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  // Toggle selection
  const toggleSelect = (username: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(username)) next.delete(username); else next.add(username);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selected.size === users.length) setSelected(new Set());
    else setSelected(new Set(users.map(u => u.username)));
  };

  // Single create
  const handleCreate = async () => {
    if (!formUsername || !formPassword) { showToast('用户名和密码必填', 'error'); return; }
    if (formPassword.length < 6) { showToast('密码至少6位', 'error'); return; }
    setIsSubmitting(true);
    try {
      const res = await apiPost<{ success: boolean; message?: string }>('/users', {
        username: formUsername, password: formPassword, isAdmin: formIsAdmin,
        canAccessMarket: formCanAccessMarket, canCreateServer: formCanCreateServer,
      });
      if (res.success) { showToast('创建成功', 'success'); setShowCreate(false); resetForm(); fetchUsers(); fetchStats(); }
      else showToast(res.message || '创建失败', 'error');
    } catch { showToast('创建失败', 'error'); }
    finally { setIsSubmitting(false); }
  };

  // Batch create
  const handleBatchCreate = async () => {
    const lines = batchText.trim().split('\n').filter(l => l.trim());
    const userList = lines.map(line => {
      const [username, password] = line.trim().split(/[,\t]/).map(s => s.trim());
      return { username, password, isAdmin: batchIsAdmin };
    }).filter(u => u.username && u.password);
    if (userList.length === 0) { showToast('请输入用户名和密码（每行一个，逗号分隔）', 'error'); return; }
    setIsSubmitting(true);
    try {
      const res = await apiPost<{ success: boolean; data: any }>('/users/batch', { users: userList });
      if (res.success) {
        const { created, failed } = res.data;
        showToast(`成功 ${created.length} 个${failed.length ? `，失败 ${failed.length} 个` : ''}`, 'success');
        setShowBatchAdd(false); setBatchText(''); setBatchIsAdmin(false);
        fetchUsers(); fetchStats();
      } else showToast('批量创建失败', 'error');
    } catch { showToast('批量创建失败', 'error'); }
    finally { setIsSubmitting(false); }
  };

  // Single update
  const handleUpdate = async () => {
    if (!editUser) return;
    setIsSubmitting(true);
    try {
      const body: any = {};
      if (editUser.isAdmin !== formIsAdmin) body.isAdmin = formIsAdmin;
      if (formNewPassword) body.newPassword = formNewPassword;
      body.canAccessMarket = formCanAccessMarket;
      body.canCreateServer = formCanCreateServer;
      const res = await apiPut<{ success: boolean }>(`/users/${editUser.username}`, body);
      if (res.success) { showToast('更新成功', 'success'); setEditUser(null); resetForm(); fetchUsers(); fetchStats(); }
      else showToast('更新失败', 'error');
    } catch { showToast('更新失败', 'error'); }
    finally { setIsSubmitting(false); }
  };

  // Batch permissions
  const handleBatchPerm = async () => {
    setIsSubmitting(true);
    try {
      const res = await apiPut<{ success: boolean; data: any }>('/users/batch/permissions', {
        usernames: Array.from(selected), permissions: { canAccessMarket: batchPermMarket, canCreateServer: batchPermCreate },
      });
      if (res.success) {
        showToast(`已更新 ${res.data.updated.length} 个用户权限`, 'success');
        setShowBatchPerm(false); setSelected(new Set()); fetchUsers();
      } else showToast('批量设置失败', 'error');
    } catch { showToast('批量设置失败', 'error'); }
    finally { setIsSubmitting(false); }
  };

  // Single delete
  const handleDelete = async () => {
    if (!deleteUser) return;
    setIsSubmitting(true);
    try {
      const res = await apiDelete<{ success: boolean }>(`/users/${deleteUser.username}`);
      if (res.success) { showToast('删除成功', 'success'); setDeleteUser(null); fetchUsers(); fetchStats(); }
      else showToast('删除失败', 'error');
    } catch { showToast('删除失败', 'error'); }
    finally { setIsSubmitting(false); }
  };

  // Batch delete
  const handleBatchDelete = async () => {
    setIsSubmitting(true);
    try {
      const res = await apiDelete<{ success: boolean; data: any }>('/users/batch', {
        body: JSON.stringify({ usernames: Array.from(selected) }),
        headers: { 'Content-Type': 'application/json' },
      } as any);
      if (res.success) {
        showToast(`已删除 ${res.data.deleted.length} 个用户`, 'success');
        setShowBatchDelete(false); setSelected(new Set()); fetchUsers(); fetchStats();
      } else showToast('批量删除失败', 'error');
    } catch { showToast('批量删除失败', 'error'); }
    finally { setIsSubmitting(false); }
  };

  const openEdit = (user: User) => {
    setEditUser(user);
    setFormIsAdmin(user.isAdmin);
    setFormCanAccessMarket(user.canAccessMarket !== false);
    setFormCanCreateServer(user.canCreateServer !== false);
    setFormNewPassword('');
  };

  const isCurrentUser = (username: string) => auth.user?.username === username;

  // Share toggle
  const [servers, setServers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [endpoints, setEndpoints] = useState<any[]>([]);
  const fetchAllData = useCallback(async () => {
    try {
      const [sr, gr, er] = await Promise.all([
        apiGet<{ success: boolean; data: any[] }>('/servers'),
        apiGet<{ success: boolean; data: any[] }>('/groups'),
        apiGet<{ success: boolean; data: any[] }>('/xiaozhi/endpoints'),
      ]);
      if (sr.success) setServers(sr.data || []);
      if (gr.success) setGroups(gr.data || []);
      if (er.success) setEndpoints(er.data || []);
    } catch {}
  }, []);
  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  const toggleShare = async (type: string, id: string, current: boolean) => {
    const url = type === 'server' ? `/servers/${id}/share` : type === 'group' ? `/groups/${id}/share` : `/xiaozhi/endpoints/${id}/share`;
    const res = await apiPut<{ success: boolean }>(url, { shared: !current });
    if (res.success) { showToast('已更新', 'success'); fetchAllData(); fetchSystemStats(); }
    else showToast('失败', 'error');
  };

  const myServers = servers.filter((s: any) => s.owner === auth.user?.username || auth.user?.isAdmin);
  const myGroups = groups.filter((g: any) => g.owner === auth.user?.username || auth.user?.isAdmin);

  if (isLoading) {
    return <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">超管中心</h1>
          <p className="text-sm text-gray-500 mt-1">
            共 {stats?.totalUsers || 0} 用户 · {stats?.adminUsers || 0} 管理员 · {stats?.regularUsers || 0} 普通用户
          </p>
        </div>
        <div className="flex space-x-2">
          <button onClick={() => { setBatchText(''); setShowBatchAdd(true); }}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-1">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07z"/></svg>
            <span>批量添加</span>
          </button>
          <button onClick={() => { resetForm(); setShowCreate(true); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-1">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
            <span>添加用户</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[{ l: '用户总数', v: stats?.totalUsers || 0, c: 'bg-blue-100 text-blue-600' },
          { l: '服务器', v: systemStats.servers, c: 'bg-green-100 text-green-600' },
          { l: '分组', v: systemStats.groups, c: 'bg-indigo-100 text-indigo-600' },
          { l: '小智端点', v: systemStats.endpoints, c: 'bg-purple-100 text-purple-600' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center space-x-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${s.c}`}><span className="text-xl font-bold">{s.v}</span></div>
            <div><p className="text-sm text-gray-500">{s.l}</p><p className="text-2xl font-semibold">{s.v}</p></div>
          </div>
        ))}
      </div>

      {/* Batch toolbar */}
      {selected.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-blue-700">已选中 {selected.size} 个用户</span>
          <div className="flex space-x-3">
            <button onClick={() => { setBatchPermMarket(false); setBatchPermCreate(false); setShowBatchPerm(true); }}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">批量设置权限</button>
            <button onClick={() => setShowBatchDelete(true)}
              className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700">批量删除</button>
            <button onClick={() => setSelected(new Set())}
              className="px-3 py-1.5 text-gray-600 text-sm hover:text-gray-800">取消</button>
          </div>
        </div>
      )}

      {/* User Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">用户管理</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 w-10">
                  <input type="checkbox" checked={selected.size === users.length && users.length > 0} onChange={toggleSelectAll} className="h-4 w-4 rounded" />
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">用户名</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">角色</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">登录次数</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">最后登录</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">市场</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">加服务器</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.username} className={`hover:bg-gray-50 ${selected.has(user.username) ? 'bg-blue-50' : ''}`}>
                  <td className="px-3 py-3">
                    <input type="checkbox" checked={selected.has(user.username)} onChange={() => toggleSelect(user.username)} className="h-4 w-4 rounded" />
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold text-sm">{user.username.charAt(0).toUpperCase()}</div>
                      <span className="ml-2 font-medium">{user.username}{isCurrentUser(user.username) && <span className="ml-1 text-xs text-blue-500">(我)</span>}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    {user.isAdmin ? <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-800">管理员</span> : <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">普通</span>}
                  </td>
                  <td className="px-3 py-3 text-center text-sm">{user.loginCount ?? 0}</td>
                  <td className="px-3 py-3 text-center text-sm text-gray-500">{formatDate(user.lastLoginAt)}</td>
                  <td className="px-3 py-3 text-center">{user.canAccessMarket !== false ? <span className="text-green-500 text-xs">✓</span> : <span className="text-red-400 text-xs">✗</span>}</td>
                  <td className="px-3 py-3 text-center">{user.canCreateServer !== false ? <span className="text-green-500 text-xs">✓</span> : <span className="text-red-400 text-xs">✗</span>}</td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    <button onClick={() => openEdit(user)} className="text-blue-600 hover:text-blue-800 mr-3 text-sm">编辑</button>
                    {!isCurrentUser(user.username) && <button onClick={() => setDeleteUser(user)} className="text-red-600 hover:text-red-800 text-sm">删除</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Share Management */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">共享管理</h2>
          <p className="text-sm text-gray-500 mt-1">共享后普通用户可见并可启用，但不能查看/修改配置</p>
        </div>
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">服务器</h3>
          <div className="space-y-2">
            {myServers.length === 0 ? <p className="text-sm text-gray-400">暂无</p> : myServers.map((s: any) => (
              <div key={s.name} className="flex items-center justify-between py-1.5 px-3 bg-gray-50 rounded">
                <div><span className="text-sm font-medium">{s.name}</span></div>
                <label className="flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={s.shared === true} onChange={() => toggleShare('server', s.name, s.shared === true)} />
                  <div className="w-9 h-5 bg-gray-300 rounded-full peer peer-checked:bg-blue-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full relative"></div>
                  <span className="ml-2 text-xs text-gray-500">{s.shared ? '已共享' : '未共享'}</span>
                </label>
              </div>
            ))}
          </div>
        </div>
        <div className="px-5 py-3">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">分组</h3>
          <div className="space-y-2">
            {myGroups.length === 0 ? <p className="text-sm text-gray-400">暂无</p> : myGroups.map((g: any) => (
              <div key={g.id} className="flex items-center justify-between py-1.5 px-3 bg-gray-50 rounded">
                <span className="text-sm font-medium">{g.name}</span>
                <label className="flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={g.shared === true} onChange={() => toggleShare('group', g.id, g.shared === true)} />
                  <div className="w-9 h-5 bg-gray-300 rounded-full peer peer-checked:bg-indigo-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full relative"></div>
                  <span className="ml-2 text-xs text-gray-500">{g.shared ? '已共享' : '未共享'}</span>
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <Modal title="添加用户" onClose={() => { setShowCreate(false); resetForm(); }}>
          <div className="space-y-4">
            <Input label="用户名" value={formUsername} onChange={setFormUsername} />
            <Input label="密码" value={formPassword} onChange={setFormPassword} type="password" />
            <Checkbox label="管理员" checked={formIsAdmin} onChange={setFormIsAdmin} />
            <div className="border-t pt-3 space-y-2">
              <p className="text-sm font-medium text-gray-600">权限设置</p>
              <Checkbox label="可访问市场" checked={formCanAccessMarket} onChange={setFormCanAccessMarket} />
              <Checkbox label="可自行添加服务器" checked={formCanCreateServer} onChange={setFormCanCreateServer} />
            </div>
          </div>
          <ModalFooter onCancel={() => { setShowCreate(false); resetForm(); }} onOk={handleCreate} okText="创建" loading={isSubmitting} />
        </Modal>
      )}

      {/* Batch Add Modal */}
      {showBatchAdd && (
        <Modal title="批量添加用户" onClose={() => setShowBatchAdd(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">用户列表</label>
              <p className="text-xs text-gray-400 mb-2">每行一个，格式：用户名,密码（逗号或制表符分隔）</p>
              <textarea value={batchText} onChange={e => setBatchText(e.target.value)} rows={8}
                placeholder="user1,pass123&#10;user2,pass456&#10;user3,pass789"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 font-mono text-sm" />
            </div>
            <Checkbox label="全部设为管理员" checked={batchIsAdmin} onChange={setBatchIsAdmin} />
            <div className="bg-gray-50 p-3 rounded-lg text-xs text-gray-500">
              新用户默认权限：市场=关，添加服务器=关（可在创建后用「批量设置权限」调整）
            </div>
          </div>
          <ModalFooter onCancel={() => setShowBatchAdd(false)} onOk={handleBatchCreate} okText="批量创建" loading={isSubmitting} okColor="green" />
        </Modal>
      )}

      {/* Batch Permissions Modal */}
      {showBatchPerm && (
        <Modal title={`批量设置权限（${selected.size}个用户）`} onClose={() => setShowBatchPerm(false)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-500">统一设置选中用户的权限：</p>
            <Checkbox label="可访问市场" checked={batchPermMarket} onChange={setBatchPermMarket} />
            <Checkbox label="可自行添加服务器" checked={batchPermCreate} onChange={setBatchPermCreate} />
          </div>
          <ModalFooter onCancel={() => setShowBatchPerm(false)} onOk={handleBatchPerm} okText="应用" loading={isSubmitting} />
        </Modal>
      )}

      {/* Edit Modal */}
      {editUser && (
        <Modal title={`编辑: ${editUser.username}`} onClose={() => { setEditUser(null); resetForm(); }}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm bg-gray-50 p-3 rounded-lg">
              <div><span className="text-gray-500">登录次数</span><br /><span className="font-semibold">{editUser.loginCount ?? 0}</span></div>
              <div><span className="text-gray-500">最后登录</span><br /><span className="font-semibold">{formatDate(editUser.lastLoginAt)}</span></div>
            </div>
            <Checkbox label="管理员" checked={formIsAdmin} onChange={setFormIsAdmin} />
            <div className="border-t pt-3 space-y-2">
              <p className="text-sm font-medium text-gray-600">权限控制</p>
              <Checkbox label="可访问市场" checked={formCanAccessMarket} onChange={setFormCanAccessMarket} />
              <Checkbox label="可自行添加服务器" checked={formCanCreateServer} onChange={setFormCanCreateServer} />
            </div>
            <div className="border-t pt-3">
              <label className="block text-sm font-medium mb-1">重置密码（留空不修改）</label>
              <input type="password" value={formNewPassword} onChange={e => setFormNewPassword(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <ModalFooter onCancel={() => { setEditUser(null); resetForm(); }} onOk={handleUpdate} okText="保存" loading={isSubmitting} />
        </Modal>
      )}

      {/* Single Delete */}
      {deleteUser && (
        <Modal title="确认删除" onClose={() => setDeleteUser(null)}>
          <p className="text-gray-600">确定删除用户「{deleteUser.username}」？此操作不可撤销。</p>
          <ModalFooter onCancel={() => setDeleteUser(null)} onOk={handleDelete} okText="删除" loading={isSubmitting} okColor="red" />
        </Modal>
      )}

      {/* Batch Delete */}
      {showBatchDelete && (
        <Modal title="批量删除" onClose={() => setShowBatchDelete(false)}>
          <p className="text-gray-600">确定删除选中的 {selected.size} 个用户？此操作不可撤销。</p>
          <div className="mt-3 max-h-32 overflow-y-auto bg-gray-50 p-2 rounded text-sm">
            {Array.from(selected).map(u => <div key={u} className="py-0.5">• {u}</div>)}
          </div>
          <ModalFooter onCancel={() => setShowBatchDelete(false)} onOk={handleBatchDelete} okText="全部删除" loading={isSubmitting} okColor="red" />
        </Modal>
      )}
    </div>
  );
};

// Helper components
const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
      <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <h3 className="text-lg font-semibold">{title}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg></button>
      </div>
      <div className="px-6 py-4">{children}</div>
    </div>
  </div>
);

const Input: React.FC<{ label: string; value: string; onChange: (v: string) => void; type?: string }> = ({ label, value, onChange, type = 'text' }) => (
  <div><label className="block text-sm font-medium mb-1">{label}</label><input type={type} value={value} onChange={e => onChange(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" /></div>
);

const Checkbox: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void }> = ({ label, checked, onChange }) => (
  <div className="flex items-center space-x-3"><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="h-4 w-4 rounded" /><label className="text-sm">{label}</label></div>
);

const ModalFooter: React.FC<{ onCancel: () => void; onOk: () => void; okText: string; loading: boolean; okColor?: string }> = ({ onCancel, onOk, okText, loading, okColor = 'blue' }) => {
  const colors: Record<string, string> = { blue: 'bg-blue-600 hover:bg-blue-700', green: 'bg-green-600 hover:bg-green-700', red: 'bg-red-600 hover:bg-red-700' };
  return (
    <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3 mt-4">
      <button onClick={onCancel} className="px-4 py-2 text-gray-600 hover:text-gray-800">取消</button>
      <button onClick={onOk} disabled={loading} className={`px-4 py-2 text-white rounded-lg disabled:opacity-50 ${colors[okColor] || colors.blue}`}>{loading ? '...' : okText}</button>
    </div>
  );
};

export default UsersPage;
