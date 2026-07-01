import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2, ArrowLeftRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format, addDays } from "date-fns";

export const Route = createFileRoute("/app/peminjaman")({
  ssr: false,
  component: PeminjamanPage,
});

type Item = { buku_id: string; judul: string; jumlah: number; max: number };

function PeminjamanPage() {
  const qc = useQueryClient();
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [peminjamId, setPeminjamId] = useState("");
  const [bukuId, setBukuId] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [tglPinjam, setTglPinjam] = useState(format(new Date(), "yyyy-MM-dd"));
  const [tglKembali, setTglKembali] = useState(format(addDays(new Date(), 7), "yyyy-MM-dd"));
  const [catatan, setCatatan] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: list, isLoading } = useQuery({
    queryKey: ["peminjaman-list"],
    queryFn: async () => {
      // STEP 1: Fetch peminjaman list
      const { data: pinj, error } = await supabase
        .from("peminjaman")
        .select("*, peminjam:peminjam_id(nama, kode_peminjam)")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      const rows = (pinj as any[]) ?? [];
      console.log("PEMINJAMAN RAW:", rows);
      
      if (rows.length === 0) return rows;
      
      const ids = rows.map((r) => r.id);
      
      // STEP 2: Fetch detail_peminjaman
      const { data: details } = await supabase
        .from("detail_peminjaman")
        .select("peminjaman_id, buku_id, jumlah")
        .in("peminjaman_id", ids);
      
      console.log("DETAIL RAW:", details);
      
      const bukuIds = Array.from(new Set((details ?? []).map((d: any) => d.buku_id)));
      
      // STEP 3: Fetch buku
      const { data: bukus } = bukuIds.length
        ? await supabase.from("buku").select("id, judul, kode_buku").in("id", bukuIds)
        : { data: [] as any[] };
      
      console.log("BUKU FETCHED:", bukus);
      
      // STEP 4: Merge manual
      const bukuMap = new Map((bukus ?? []).map((b: any) => [b.id, b]));
      const detailMap = new Map<string, any[]>();
      
      (details ?? []).forEach((d: any) => {
        const arr = detailMap.get(d.peminjaman_id) ?? [];
        const bukuData = bukuMap.get(d.buku_id);
        console.log(`Mapping buku_id ${d.buku_id}:`, bukuData);
        arr.push({ jumlah: d.jumlah, buku: bukuData ?? null });
        detailMap.set(d.peminjaman_id, arr);
      });
      
      const merged = rows.map((r) => ({
        ...r,
        detail_peminjaman: detailMap.get(r.id) ?? [],
      }));
      
      console.log("MERGED PEMINJAMAN:", merged);
      return merged;
    },
  });

  const { data: peminjamOpts = [] } = useQuery({
    queryKey: ["peminjam-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("peminjam")
        .select("*")
        .order("nama");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: bukuOpts } = useQuery({
    queryKey: ["buku-options"],
    queryFn: async () =>
      (await supabase.from("buku").select("id, judul, jumlah_tersedia").gt("jumlah_tersedia", 0).order("judul")).data ?? [],
  });

  const addItem = () => {
    if (!bukuId) return;
    const b = bukuOpts?.find((x) => x.id === bukuId);
    if (!b) return;
    if (items.find((i) => i.buku_id === bukuId)) return toast.error("Buku sudah ditambahkan");
    setItems([...items, { buku_id: b.id, judul: b.judul, jumlah: 1, max: b.jumlah_tersedia }]);
    setBukuId("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!peminjamId) return toast.error("Pilih peminjam");

    if (items.length === 0) return toast.error("Tambahkan minimal 1 buku");

    setSaving(true);

    const payload = {
      peminjam_id: peminjamId,
      petugas_id: auth.user?.id ?? null,
      tanggal_pinjam: tglPinjam,
      tanggal_kembali: tglKembali,
      status: "dipinjam" as const,
      catatan: catatan || null,
    };

    const { data: pinj, error } = await supabase
      .from("peminjaman")
      .insert(payload)
      .select("id")
      .single();

    if (error || !pinj) {
      setSaving(false);
      return toast.error(error?.message ?? "Gagal");
    }

    const { error: dErr } = await supabase
      .from("detail_peminjaman")
      .insert(items.map((i) => ({ peminjaman_id: pinj.id, buku_id: i.buku_id, jumlah: i.jumlah })) as never);

    setSaving(false);
    if (dErr) {
      await supabase.from("peminjaman").delete().eq("id", pinj.id);
      return toast.error("Gagal menyimpan detail: " + dErr.message);
    }

    toast.success("Peminjaman berhasil dicatat");
    setOpen(false);
    setPeminjamId("");
    setItems([]);
    setCatatan("");
    await qc.invalidateQueries({ queryKey: ["peminjaman-list"] });
    await qc.refetchQueries({ queryKey: ["peminjaman-list"], type: "active" });
    qc.invalidateQueries({ queryKey: ["buku-options"] });
    qc.invalidateQueries({ queryKey: ["buku"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <PageHeader
        title="Transaksi Peminjaman"
        description="Catat peminjaman buku baru."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Peminjaman Baru
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !list || list.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <ArrowLeftRight className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Belum ada transaksi.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Peminjam</th>
                  <th className="text-left px-4 py-3">Buku</th>
                  <th className="text-left px-4 py-3">Tgl Pinjam</th>
                  <th className="text-left px-4 py-3">Tgl Kembali</th>
                  <th className="text-left px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => {
                  const overdue = p.status !== "dikembalikan" && p.tanggal_kembali < today;
                  return (
                    <tr key={p.id} className="border-t hover:bg-secondary/30">
                      <td className="px-4 py-3">
                        <div className="font-medium">{p.peminjam?.nama}</div>
                        <div className="text-xs font-mono text-muted-foreground">{p.peminjam?.kode_peminjam}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {p.detail_peminjaman?.length
                          ? p.detail_peminjaman.map((d: any, i: number) => (
                              <div key={i}>
                                {d.buku?.judul ?? "-"} × {d.jumlah}
                              </div>
                            ))
                          : "-"}
                      </td>

                      <td className="px-4 py-3">{format(new Date(p.tanggal_pinjam), "dd MMM yyyy")}</td>
                      <td className="px-4 py-3">{format(new Date(p.tanggal_kembali), "dd MMM yyyy")}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs capitalize ${
                            p.status === "dikembalikan"
                              ? "bg-secondary text-secondary-foreground"
                              : overdue
                                ? "bg-destructive/10 text-destructive"
                                : "bg-primary/10 text-primary"
                          }`}
                        >
                          {overdue && p.status !== "dikembalikan" ? "terlambat" : p.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Peminjaman Baru</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>Peminjam</Label>
              <Select value={peminjamId} onValueChange={setPeminjamId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih peminjam" />
                </SelectTrigger>
                <SelectContent>
                  {peminjamOpts?.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.nama} ({p.kode_peminjam})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tambah Buku</Label>
              <div className="flex gap-2">
                <Select value={bukuId} onValueChange={setBukuId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih buku tersedia" />
                  </SelectTrigger>
                  <SelectContent>
                    {bukuOpts?.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.judul} (stok {b.jumlah_tersedia})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" onClick={addItem}>
                  Tambah
                </Button>
              </div>
              {items.length > 0 && (
                <ul className="border rounded-lg divide-y mt-2">
                  {items.map((it, idx) => (
                    <li key={it.buku_id} className="flex items-center gap-2 px-3 py-2">
                      <span className="flex-1 text-sm">{it.judul}</span>
                      <Input
                        type="number"
                        min={1}
                        max={it.max}
                        value={it.jumlah}
                        onChange={(e) => {
                          const v = Math.max(1, Math.min(it.max, parseInt(e.target.value || "1")));
                          setItems(items.map((x, i) => (i === idx ? { ...x, jumlah: v } : x)));
                        }}
                        className="w-20"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Hapus buku dari daftar"
                        onClick={() => setItems(items.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tanggal Pinjam</Label>
                <Input type="date" value={tglPinjam} onChange={(e) => setTglPinjam(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Tanggal Kembali</Label>
                <Input type="date" value={tglKembali} onChange={(e) => setTglKembali(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea rows={2} value={catatan} onChange={(e) => setCatatan(e.target.value)} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Simpan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
