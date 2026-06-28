import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Loader2, Trash2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/pengaturan")({
  ssr: false,
  component: PengaturanPage,
});

function PengaturanPage() {
  const auth = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", username: "", nama_lengkap: "", password: "" });
  const [saving, setSaving] = useState(false);
  const [profil, setProfil] = useState({
    nama: localStorage.getItem("profil_nama") ?? "Perpustakaan Literasi KKN",
    alamat: localStorage.getItem("profil_alamat") ?? "",
  });

  const isAdmin = auth.roles.includes("admin");

const {
data: petugas = [],
isLoading,
error: listError
} = useQuery({

queryKey:[
"petugas-list"
],

enabled:isAdmin,

queryFn: async () => {

const {
data,
error
}
=
await supabase

.from(
"user_roles"
)

.select(`
user_id,
profiles!inner(
id,
email,
username,
nama_lengkap
)
`)

.eq(
"role",
"petugas"
);

if (
error
)
throw error;

return (
data ?? []
)
.map(
(r:any)=>({
user_id:
r.user_id,

email:
r.profiles.email,

username:
r.profiles.username,

nama_lengkap:
r.profiles.nama_lengkap
})
);

}

});        

const onAddPetugas = async (
e: React.FormEvent
) => {

e.preventDefault();

if (
form.password.length < 8
) {
toast.error(
"Password minimal 8 karakter"
);
return;
}

try {

setSaving(
true
);

const {
data,
error
} =
await supabase.functions.invoke(
"create-petugas",
{
body:{
users:[
{
email:
form.email,

password:
form.password,

username:
form.username,

nama_lengkap:
form.nama_lengkap
}
]
}
}
);

if (
error
)
throw error;

/*
JIKA EDGE FUNCTION
SUDAH MENYIMPAN
KE PROFILES +
USER_ROLES
TIDAK PERLU
UPSERT LAGI
*/

toast.success(
"Akun petugas berhasil dibuat"
);

await qc.invalidateQueries({
queryKey:[
"petugas-list"
]
});

setOpen(
false
);

setForm({
email:"",
username:"",
nama_lengkap:"",
password:""
});

}
catch(
err:any
){

console.error(
err
);

toast.error(
err?.message ??
"Gagal membuat petugas"
);

}
finally{

setSaving(
false
);

}

};

  const removeRole = async (user_id: string) => {
    const { error } = await supabase.from("user_roles").delete().eq("user_id", user_id).eq("role", "petugas");
    if (error) return toast.error(error.message);
    toast.success("Role petugas dicabut");
    await qc.invalidateQueries({ queryKey: ["petugas-list"] });
    await qc.refetchQueries({ queryKey: ["petugas-list"], type: "active" });
  };

  const saveProfil = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("profil_nama", profil.nama);
    localStorage.setItem("profil_alamat", profil.alamat);
    toast.success("Profil perpustakaan disimpan");
  };

  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="Pengaturan" />
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <ShieldAlert className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Halaman ini hanya untuk admin.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Pengaturan" description="Kelola akun petugas dan profil perpustakaan." />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Akun Petugas</CardTitle>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Tambah Petugas
          </Button>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : listError ? (
            <p className="text-center py-10 text-sm text-destructive">Gagal memuat: {(listError as Error).message}</p>
          ) :  petugas.length === 0 ? (
            <p className="text-center py-10 text-sm text-muted-foreground">Belum ada petugas.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Nama</th>
                  <th className="text-left px-4 py-3">Username</th>
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-right px-4 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {petugas.map((p) => (
                  <tr key={p.user_id} className="border-t">
                    <td className="px-4 py-3 font-medium">{p.nama_lengkap ?? "-"}</td>
                    <td className="px-4 py-3">{p.username ?? "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.email ?? "-"}</td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => removeRole(p.user_id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profil Perpustakaan</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfil} className="space-y-3 max-w-xl">
            <div className="space-y-2">
              <Label>Nama Perpustakaan</Label>
              <Input value={profil.nama} onChange={(e) => setProfil({ ...profil, nama: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Alamat</Label>
              <Input value={profil.alamat} onChange={(e) => setProfil({ ...profil, alamat: e.target.value })} />
            </div>
            <Button type="submit">Simpan</Button>
          </form>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Akun Petugas</DialogTitle>
          </DialogHeader>
          <form onSubmit={onAddPetugas} className="space-y-3">
            <div className="space-y-2">
              <Label>Nama Lengkap</Label>
              <Input required value={form.nama_lengkap} onChange={(e) => setForm({ ...form, nama_lengkap: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Username</Label>
              <Input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Password (min 8 karakter)</Label>
              <Input type="password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Buat Akun
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
