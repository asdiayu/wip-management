
import React, { useState } from 'react';
import { useUserManagement, AppUser } from '../hooks/useUserManagement';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import { UsersIcon, ShieldCheckIcon, TrashIcon, CheckCircleIcon, PlusIcon, SettingsIcon } from '../constants';

const ROLE_OPTIONS = [
    { value: 'admin', label: 'Admin (Full Access)' },
    { value: 'manager', label: 'Manager (Dashboard, Report, Opname)' },
    { value: 'operator', label: 'Operator (Input/Output/Trf)' },
    { value: 'viewer', label: 'Viewer (View Only)' },
];

// Simple Key Icon for Password
const KeyIcon: React.FC<{className?: string}> = ({className}) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
    </svg>
);

const UserManagement: React.FC = () => {
    const { users, loading, error, isUpdating, updateUserRole, deleteUser, createUser, updateUserPassword } = useUserManagement();
    
    // Modal States
    const [editUser, setEditUser] = useState<AppUser | null>(null);
    const [newRole, setNewRole] = useState('');
    
    const [deleteId, setDeleteId] = useState<string | null>(null);
    
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [createForm, setCreateForm] = useState({ email: '', password: '', role: 'operator' });

    const [passwordUser, setPasswordUser] = useState<AppUser | null>(null);
    const [newPassword, setNewPassword] = useState('');
    
    // SQL Helper State
    const [showSql, setShowSql] = useState(false);

    // -- Handlers --

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (createForm.password.length < 6) {
            alert("Password minimal 6 karakter");
            return;
        }
        const res = await createUser(createForm.email, createForm.password, createForm.role);
        if (res.success) {
            setIsCreateOpen(false);
            setCreateForm({ email: '', password: '', role: 'operator' });
            alert("User berhasil dibuat! Silakan coba login.");
        } else {
            alert(`Gagal membuat user: ${res.message}. \n\nPastikan Anda sudah menjalankan 'SQL Setup' di database.`);
        }
    };

    const handleEditClick = (user: AppUser) => {
        setEditUser(user);
        setNewRole(user.role || 'viewer');
    };

    const handleSaveRole = async () => {
        if (!editUser) return;
        const res = await updateUserRole(editUser.id, newRole);
        if (res.success) {
            setEditUser(null);
        } else {
            alert(`Gagal update role: ${res.message}`);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!passwordUser) return;
        if (newPassword.length < 6) {
            alert("Password minimal 6 karakter");
            return;
        }
        const res = await updateUserPassword(passwordUser.id, newPassword);
        if (res.success) {
            setPasswordUser(null);
            setNewPassword('');
            alert("Password berhasil diubah!");
        } else {
            alert(`Gagal ubah password: ${res.message}`);
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        const res = await deleteUser(deleteId);
        if (res.success) {
            setDeleteId(null);
        } else {
            alert(`Gagal menghapus user: ${res.message}`);
        }
    };

    // SQL Code for Setup
    const sqlCode = `
-- 0. Enable pgcrypto for password hashing
create extension if not exists pgcrypto;

-- 1. Get Users Function
create or replace function get_users_list()
returns table (
  id uuid,
  email varchar,
  role text,
  last_sign_in_at timestamptz,
  created_at timestamptz
) security definer
as $$
begin
  -- Cek admin
  if not exists (
    select 1 from auth.users u 
    where u.id = auth.uid() 
    and (u.raw_app_meta_data->>'role' = 'admin' or u.raw_user_meta_data->>'role' = 'admin')
  ) then
    raise exception 'Access Denied';
  end if;

  return query
  select
    au.id,
    au.email::varchar,
    coalesce(au.raw_app_meta_data->>'role', au.raw_user_meta_data->>'role')::text,
    au.last_sign_in_at,
    au.created_at
  from auth.users au
  order by au.created_at desc;
end;
$$ language plpgsql;

-- 2. Create User Function (FIXED: Adds Identity for Login)
create or replace function create_user_by_admin(email_input text, password_input text, role_input text)
returns void security definer
as $$
declare
  encrypted_pw text;
  new_user_id uuid;
begin
  -- Cek admin
  if not exists (
    select 1 from auth.users u 
    where u.id = auth.uid() 
    and (u.raw_app_meta_data->>'role' = 'admin' or u.raw_user_meta_data->>'role' = 'admin')
  ) then
    raise exception 'Access Denied';
  end if;

  -- Cek email exist
  if exists (select 1 from auth.users where email = email_input) then
    raise exception 'Email already registered';
  end if;

  -- Generate ID & Hash
  new_user_id := gen_random_uuid();
  encrypted_pw := crypt(password_input, gen_salt('bf'));

  -- 1. Insert ke auth.users
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  ) values (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    email_input,
    encrypted_pw,
    now(), 
    jsonb_build_object('provider', 'email', 'providers', array['email'], 'role', role_input),
    jsonb_build_object('role', role_input),
    now(),
    now(),
    '', '', '', ''
  );

  -- 2. Insert ke auth.identities (PENTING AGAR BISA LOGIN)
  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    gen_random_uuid(),
    new_user_id,
    jsonb_build_object('sub', new_user_id, 'email', email_input, 'email_verified', true),
    'email',
    new_user_id::text,
    now(),
    now(),
    now()
  );
end;
$$ language plpgsql;

-- 3. Update Password Function
create or replace function update_password_by_admin(target_user_id uuid, new_password text)
returns void security definer
as $$
begin
  -- Cek admin
  if not exists (
    select 1 from auth.users u 
    where u.id = auth.uid() 
    and (u.raw_app_meta_data->>'role' = 'admin' or u.raw_user_meta_data->>'role' = 'admin')
  ) then
    raise exception 'Access Denied';
  end if;

  update auth.users
  set encrypted_password = crypt(new_password, gen_salt('bf'))
  where id = target_user_id;
end;
$$ language plpgsql;

-- 4. Update Role Function
create or replace function update_user_role(target_user_id uuid, new_role text)
returns void security definer
as $$
begin
  -- Cek admin
  if not exists (
    select 1 from auth.users u 
    where u.id = auth.uid() 
    and (u.raw_app_meta_data->>'role' = 'admin' or u.raw_user_meta_data->>'role' = 'admin')
  ) then
    raise exception 'Access Denied';
  end if;

  update auth.users
  set 
    raw_app_meta_data = jsonb_set(coalesce(raw_app_meta_data, '{}'::jsonb), '{role}', to_jsonb(new_role)),
    raw_user_meta_data = jsonb_set(coalesce(raw_user_meta_data, '{}'::jsonb), '{role}', to_jsonb(new_role))
  where id = target_user_id;
end;
$$ language plpgsql;

-- 5. Delete User Function
create or replace function delete_user_by_admin(target_user_id uuid)
returns void security definer
as $$
begin
  -- Cek admin
  if not exists (
    select 1 from auth.users u 
    where u.id = auth.uid() 
    and (u.raw_app_meta_data->>'role' = 'admin' or u.raw_user_meta_data->>'role' = 'admin')
  ) then
    raise exception 'Access Denied';
  end if;

  -- Hapus identity dulu (cascade biasanya handle, tapi untuk aman)
  delete from auth.identities where user_id = target_user_id;
  delete from auth.users where id = target_user_id;
end;
$$ language plpgsql;

-- Permissions
GRANT EXECUTE ON FUNCTION get_users_list() TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_by_admin(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION update_password_by_admin(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_user_by_admin(uuid) TO authenticated;
    `.trim();

    return (
        <div className="space-y-8 pb-12">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-pink-100 dark:bg-pink-900/50 rounded-lg text-pink-600 dark:text-pink-400">
                        <UsersIcon className="h-8 w-8" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Manajemen User</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Kelola pengguna, password, dan hak akses.</p>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <button onClick={() => setShowSql(!showSql)} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline px-2 py-2">
                        {showSql ? 'Sembunyikan Setup' : 'SQL Setup (Jika Error)'}
                    </button>
                    <Button onClick={() => setIsCreateOpen(true)} className="w-full sm:w-auto">
                        <PlusIcon className="h-5 w-5 mr-2" />
                        Tambah User
                    </Button>
                </div>
            </div>

            {/* SQL Help Box */}
            {(error || showSql) && (
                <div className="bg-slate-900 rounded-lg p-6 shadow-lg border border-slate-700">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-white font-bold flex items-center gap-2">
                            <ShieldCheckIcon className="h-5 w-5 text-green-400" />
                            Setup SQL Diperlukan
                        </h3>
                        <button onClick={() => {navigator.clipboard.writeText(sqlCode); alert('SQL Copied!');}} className="text-xs bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700">Copy SQL</button>
                    </div>
                    
                    {error && (
                        <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm font-mono">
                            ERROR: {error}
                        </div>
                    )}

                    <p className="text-slate-400 text-sm mb-4">
                        <b>PENTING:</b> Fitur Create User diperbarui untuk memperbaiki masalah login. 
                        Salin kode ini dan jalankan di <b>Supabase SQL Editor</b> untuk menimpa fungsi lama.
                    </p>
                    <textarea 
                        readOnly 
                        value={sqlCode} 
                        className="w-full h-48 bg-black text-green-400 text-xs font-mono p-4 rounded border border-slate-700 focus:outline-none"
                    />
                </div>
            )}

            {/* User List */}
            <div className="bg-white dark:bg-slate-800/50 shadow-md rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-700/50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider">Email User</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider">Role</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider">Terakhir Login</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider">Dibuat</th>
                                <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-800/50 divide-y divide-slate-200 dark:divide-slate-700">
                            {loading ? (
                                <tr><td colSpan={5} className="text-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500 mx-auto"></div></td></tr>
                            ) : users.length > 0 ? (
                                users.map((u) => (
                                    <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white">
                                            {u.email}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold capitalize 
                                                ${u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 
                                                  u.role === 'manager' ? 'bg-blue-100 text-blue-800' :
                                                  u.role === 'operator' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'}`}>
                                                {u.role || 'No Role'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                                            {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString('id-ID') : 'Belum pernah'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                                            {new Date(u.created_at).toLocaleDateString('id-ID')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex justify-end gap-3">
                                                <button onClick={() => setPasswordUser(u)} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200" title="Ganti Password">
                                                    <KeyIcon className="h-5 w-5" />
                                                </button>
                                                <button onClick={() => handleEditClick(u)} className="text-primary-600 hover:text-primary-900">Edit Role</button>
                                                <button onClick={() => setDeleteId(u.id)} className="text-red-600 hover:text-red-900">Hapus</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan={5} className="text-center py-10 text-slate-500 dark:text-slate-400">Tidak ada user ditemukan.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create User Modal */}
            {isCreateOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Buat User Baru</h3>
                        </div>
                        <form onSubmit={handleCreateUser} className="p-6 space-y-4">
                            <Input 
                                id="new-email" label="Email" type="email" required 
                                value={createForm.email} onChange={e => setCreateForm({...createForm, email: e.target.value})} 
                            />
                            <Input 
                                id="new-pass" label="Password" type="text" required placeholder="Min 6 karakter"
                                value={createForm.password} onChange={e => setCreateForm({...createForm, password: e.target.value})} 
                            />
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Role</label>
                                <div className="space-y-2">
                                    {ROLE_OPTIONS.map((opt) => (
                                        <label key={opt.value} className={`flex items-center p-3 border rounded-lg cursor-pointer ${createForm.role === opt.value ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-slate-200 dark:border-slate-700'}`}>
                                            <input type="radio" name="create-role" value={opt.value} checked={createForm.role === opt.value} onChange={(e) => setCreateForm({...createForm, role: e.target.value})} className="text-primary-600 focus:ring-primary-500" />
                                            <span className="ml-2 text-sm text-slate-700 dark:text-slate-200">{opt.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={() => setIsCreateOpen(false)} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded text-slate-700 dark:text-slate-300">Batal</button>
                                <Button type="submit" isLoading={isUpdating} className="w-auto">Buat User</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Change Password Modal */}
            {passwordUser && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Ganti Password</h3>
                            <p className="text-sm text-slate-500">User: <b>{passwordUser.email}</b></p>
                        </div>
                        <form onSubmit={handleChangePassword} className="p-6 space-y-4">
                            <Input 
                                id="change-pass" label="Password Baru" type="text" required placeholder="Masukkan password baru"
                                value={newPassword} onChange={e => setNewPassword(e.target.value)} 
                            />
                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={() => setPasswordUser(null)} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded text-slate-700 dark:text-slate-300">Batal</button>
                                <Button type="submit" isLoading={isUpdating} className="w-auto">Simpan</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Role Modal */}
            {editUser && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm p-6">
                        <h3 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Edit Role User</h3>
                        <p className="text-sm text-slate-500 mb-4">User: <b>{editUser.email}</b></p>
                        
                        <div className="space-y-3 mb-6">
                            {ROLE_OPTIONS.map((opt) => (
                                <label key={opt.value} className={`flex items-center p-3 border rounded-lg cursor-pointer ${newRole === opt.value ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-slate-200 dark:border-slate-700'}`}>
                                    <input type="radio" name="role" value={opt.value} checked={newRole === opt.value} onChange={(e) => setNewRole(e.target.value)} className="text-primary-600 focus:ring-primary-500" />
                                    <span className="ml-2 text-sm text-slate-700 dark:text-slate-200">{opt.label}</span>
                                </label>
                            ))}
                        </div>

                        <div className="flex justify-end gap-3">
                            <button onClick={() => setEditUser(null)} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded text-slate-700 dark:text-slate-300">Batal</button>
                            <Button onClick={handleSaveRole} isLoading={isUpdating} className="w-auto">Simpan</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation */}
            <ConfirmationModal 
                isOpen={!!deleteId} 
                onClose={() => setDeleteId(null)} 
                onConfirm={handleDelete}
                title="Hapus User?"
                message="User akan dihapus permanen dari sistem dan tidak bisa login lagi. Data transaksi user tersebut tidak akan hilang."
                confirmLabel="Ya, Hapus User"
                isDanger={true}
                isLoading={isUpdating}
            />
        </div>
    );
};

export default UserManagement;
