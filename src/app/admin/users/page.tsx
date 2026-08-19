"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, apiErrorMessage } from "@/lib/client/api";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/state";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { AdminPageHeader } from "@/components/admin/admin-page";

interface UserRow {
  id: string;
  email: string;
  fullName: string;
  roleSlug: string;
  status: string;
  emailVerified: boolean;
}

interface RoleMatrix {
  roles: { id: string; slug: string; name: string; permissions: string[] }[];
  permissions: { id: string; key: string; module: string; description: string }[];
}

export default function AdminUsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [matrix, setMatrix] = useState<RoleMatrix | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [u, m] = await Promise.all([
      apiFetch<{ users: UserRow[] }>("/api/admin/users"),
      apiFetch<RoleMatrix>("/api/admin/roles"),
    ]);
    if (u.success && u.data) setUsers(u.data.users);
    else setError(u.error?.message ?? "Gagal memuat pengguna.");
    if (m.success && m.data) setMatrix(m.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const changeRole = async (user: UserRow, roleSlug: string) => {
    const res = await apiFetch(`/api/admin/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ roleSlug }) });
    if (res.success) {
      toast.push("success", `Role ${user.email} → ${roleSlug}.`);
      load();
    } else toast.push("error", apiErrorMessage(res));
  };

  const togglePermission = async (roleSlug: string, permKey: string, on: boolean) => {
    if (!matrix) return;
    const role = matrix.roles.find((r) => r.slug === roleSlug);
    if (!role) return;
    const next = on ? [...role.permissions, matrix.permissions.find((p) => p.key === permKey)?.id ?? ""] : role.permissions.filter((id) => id !== matrix.permissions.find((p) => p.key === permKey)?.id);
    const res = await apiFetch("/api/admin/roles", {
      method: "PATCH",
      body: JSON.stringify({ roleSlug: roleSlug === "admin" || roleSlug === "staff" ? roleSlug : undefined, permissions: matrix.permissions.filter((p) => next.includes(p.id)).map((p) => p.key) }),
    });
    if (res.success) {
      toast.push("success", `Permission ${permKey} ${on ? "ditambahkan ke" : "dihapus dari"} ${roleSlug}.`);
      load();
    } else toast.push("error", apiErrorMessage(res));
  };

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!users || !matrix) return <LoadingState />;

  const modules = [...new Set(matrix.permissions.map((p) => p.module))];

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Pengguna & Role"
        description="Kelola akun dan permission. Perubahan role dicatat di audit log. Hanya Owner yang dapat mengubah role dan permission."
      />

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">Pengguna</h2>
        <ul className="mt-3 divide-y divide-border">
          {users.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{u.fullName || u.email}</p>
                <p className="truncate text-xs text-muted">{u.email} · {u.emailVerified ? "terverifikasi" : "belum verifikasi"}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={u.status === "active" ? "success" : "error"}>{u.status}</Badge>
                <Select value={u.roleSlug} onChange={(e) => changeRole(u, e.target.value)} className="w-36">
                  {["customer", "staff", "admin", "owner"].map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </Select>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">Matriks Permission</h2>
        <p className="mt-1 text-xs text-muted">
          Owner memiliki semua permission secara permanen. Kelola permission untuk Admin dan Staff di bawah.
        </p>
        <div className="mt-4 space-y-6">
          {modules.map((module) => (
            <div key={module}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{module}</h3>
              <ul className="mt-2 space-y-1.5">
                {matrix.permissions.filter((p) => p.module === module).map((perm) => (
                  <li key={perm.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-medium">{perm.key}</p>
                      <p className="text-xs text-muted">{perm.description}</p>
                    </div>
                    <div className="flex gap-4">
                      {(["admin", "staff"] as const).map((roleSlug) => {
                        const role = matrix.roles.find((r) => r.slug === roleSlug);
                        const on = !!role?.permissions.includes(perm.id);
                        return (
                          <label key={roleSlug} className="flex items-center gap-1.5 text-xs">
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={(e) => togglePermission(roleSlug, perm.key, e.target.checked)}
                              className="h-3.5 w-3.5 accent-accent"
                            />
                            {roleSlug}
                          </label>
                        );
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <Button variant="secondary" size="sm" onClick={load}>Muat Ulang</Button>
    </div>
  );
}
