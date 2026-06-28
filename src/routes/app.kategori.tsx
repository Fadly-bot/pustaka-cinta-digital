import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Loader2, Pencil, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/kategori")({
  ssr: false,
  component: KategoriPage,
});

function KategoriPage() {
  const qc = useQueryClient();
  const [nama, setNama] = useState("");
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editNama, setEditNama] = useState("");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["kategori_buku"],
    queryFn: async () => {
      const { data, error } = await supabase.from("kategori_buku").select("*").order("nama_kategori");
      if (error) throw error;
      return data;
    },
  });

  const refresh =
async ()=>{

const {
 data,
 error
}=await supabase
.from("kategori")
.select("*")
.order(
 "nama"
);

if(error)
 throw error;

setKategori(
 data ?? []
);

};

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("kategori_buku").insert({ nama_kategori: nama.trim() });
    setSaving(false);
    if (error) return toast.error(error.message);
    setNama("");
    toast.success("Kategori ditambahkan");
    await refresh();
  };

 const onSaveEdit = async () => {
  setSaving(true);

  const { error } =
    editId
      ? await supabase
          .from("kategori")
          .update({
            nama: form.nama,
            deskripsi:
              form.deskripsi,
          })
          .eq(
            "id",
            editId
          )

      : await supabase
          .from("kategori")
          .insert([
            {
              nama:
                form.nama,

              deskripsi:
                form.deskripsi,
            },
          ]);

  setSaving(false);

  if (error)
    return toast.error(
      error.message
    );

  toast.success(
    editId
      ? "Kategori diperbarui"
      : "Kategori ditambahkan"
  );

  setOpen(false);

  setEditId(null);

  setForm({
    nama: "",
    deskripsi: "",
  });

  await refresh();
};

  const onDelete = async (id: string) => {
    const { count } = await supabase
      .from("buku")
      .select("id", { count: "exact", head: true })
      .eq("kategori_id", id);
    if ((count ?? 0) > 0) {
      return toast.error("Tidak bisa hapus: kategori masih dipakai oleh buku");
    }
    const { error } = await supabase.from("kategori_buku").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Kategori dihapus");
    await refresh();
  };

  const filtered = (data ?? []).filter((k) =>
    !search.trim() ? true : k.nama_kategori.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <PageHeader title="Kategori Buku" description="Atur kategori untuk pengelompokan buku." />
      <Card className="mb-4">
        <CardContent className="pt-6">
          <form onSubmit={onAdd} className="flex flex-col sm:flex-row gap-2">
            <Input placeholder="Nama kategori baru..." value={nama} onChange={(e) => setNama(e.target.value)} />
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Tambah
            </Button>
          </form>
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Cari kategori..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length > 0 ? (
            <ul className="divide-y">
              {filtered.map((k) => (
                <li key={k.id} className="flex items-center justify-between px-4 py-3 gap-2">
                  {editId === k.id ? (
                    <>
                      <Input
                        autoFocus
                        value={editNama}
                        onChange={(e) => setEditNama(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") onSaveEdit(k.id);
                          if (e.key === "Escape") setEditId(null);
                        }}
                        className="flex-1"
                      />
                      <Button size="sm" onClick={() => onSaveEdit(k.id)}>Simpan</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>Batal</Button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm flex-1">{k.nama_kategori}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditId(k.id);
                          setEditNama(k.nama_kategori);
                        }}
                        aria-label={`Edit kategori ${k.nama_kategori}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => onDelete(k.id)} aria-label={`Hapus kategori ${k.nama_kategori}`}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-center py-10 text-sm text-muted-foreground">Belum ada kategori.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
