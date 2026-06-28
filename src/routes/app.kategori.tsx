import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Loader2, Pencil, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/kategori")({
  ssr: false,
  component: KategoriPage,
});

function KategoriPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nama, setNama] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["kategori_buku"],
    queryFn: async () => {
      const { data, error } = await supabase.from("kategori_buku").select("*").order("nama_kategori");
      if (error) throw error;
      return data;
    },
  });

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["kategori_buku"] });
    await qc.refetchQueries({ queryKey: ["kategori_buku"] });
  };

  const openCreate = () => {
    setEditId(null);
    setNama("");
    setOpen(true);
  };

  const openEdit = (id: string, currentNama: string) => {
    setEditId(id);
    setNama(currentNama);
    setOpen(true);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama.trim()) {
      toast.error("Nama kategori wajib diisi");
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        const { error } = await supabase
          .from("kategori_buku")
          .update({ nama_kategori: nama.trim() })
          .eq("id", editId);
        if (error) throw error;
        toast.success("Kategori diperbarui");
      } else {
        const { error } = await supabase
          .from("kategori_buku")
          .insert([{ nama_kategori: nama.trim() }]);
        if (error) throw error;
        toast.success("Kategori ditambahkan");
      }
      setOpen(false);
      setEditId(null);
      setNama("");
      await refresh();
    } catch (err: any) {
      toast.error(err.message ?? "Gagal menyimpan kategori");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: string) => {
    const { count } = await supabase
      .from("buku")
      .select("id", { count: "exact", head: true })
      .eq("kategori_id", id);
    if ((count ?? 0) > 0) {
      setDeleteId(null);
      return toast.error("Tidak bisa hapus: kategori masih dipakai oleh buku");
    }
    const { error } = await supabase.from("kategori_buku").delete().eq("id", id);
    setDeleteId(null);
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
        <CardContent className="pt-6 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari kategori..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Tambah
          </Button>
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
                  <span className="text-sm flex-1">{k.nama_kategori}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEdit(k.id, k.nama_kategori)}
                    aria-label={`Edit kategori ${k.nama_kategori}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeleteId(k.id)}
                    aria-label={`Hapus kategori ${k.nama_kategori}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-10 text-sm text-muted-foreground">
              <p>Belum ada kategori.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-1" /> Tambah kategori pertama
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(o) => { if (!saving) setOpen(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Kategori" : "Tambah Kategori"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nama_kategori">Nama Kategori</Label>
              <Input
                id="nama_kategori"
                autoFocus
                placeholder="contoh: Fiksi, Sejarah, Pelajaran..."
                value={nama}
                onChange={(e) => setNama(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
                Batal
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                Simpan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus kategori?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak bisa dibatalkan. Kategori yang masih dipakai oleh buku tidak akan dihapus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && onDelete(deleteId)}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
