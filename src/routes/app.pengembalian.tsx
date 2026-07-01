import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { differenceInDays, format } from "date-fns";

export const Route = createFileRoute("/app/pengembalian")({
  ssr: false,
  component: PengembalianPage,
});

function PengembalianPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

const { data, isLoading } = useQuery({
  queryKey: ["pengembalian-list", search],

  queryFn: async () => {
    const { data: pinjam, error } = await supabase
      .from("peminjaman")
      .select(`
        *,
        peminjam:peminjam_id(
          nama,
          kode_peminjam
        )
      `)
      .neq("status", "Dikembalikan")
      .order("tanggal_kembali");

    if (error) throw error;

    if (!pinjam?.length) return [];

    const ids = pinjam.map((p) => p.id);

    const {
      data: detail,
      error: detailErr,
    } = await supabase
      .from("detail_peminjaman")
      .select(`
        peminjaman_id,
        jumlah,
        buku:buku_id(
          judul
        )
      `)
      .in("peminjaman_id", ids);

    if (detailErr) throw detailErr;

    const merged = pinjam.map((p) => ({
      ...p,
      detail_peminjaman:
        (detail ?? []).filter(
          (d:any) =>
            d.peminjaman_id === p.id
        ),
    }));

    return merged.filter((p:any) => {
      if (!search.trim()) return true;

      const s = search.toLowerCase();

      return (
        p.peminjam?.nama
          ?.toLowerCase()
          .includes(s) ||

        p.peminjam?.kode_peminjam
          ?.toLowerCase()
          .includes(s) ||

        p.detail_peminjaman?.some(
          (d:any)=>
            d.buku?.judul
              ?.toLowerCase()
              ?.includes(s)
        )
      );
    });
  },
});

 const kembalikan = async (id: string) => {

  const { error } = await supabase
    .from("peminjaman")
    .update({
      status: "Dikembalikan"
    })
    .eq("id", id);

  if (error) {
    toast.error(error.message);
    return;
  }

  toast.success("Buku berhasil dikembalikan");

  await qc.invalidateQueries({
    queryKey: ["pengembalian-list"]
  });

  await qc.invalidateQueries({
    queryKey: ["peminjaman-list"]
  });

  await qc.refetchQueries({
    queryKey: ["pengembalian-list"]
  });

  await qc.refetchQueries({
    queryKey: ["peminjaman-list"]
  });
};
    

  return (
    <div>
      <PageHeader
        title="Pengembalian Buku"
        description="Daftar peminjaman aktif. Klik kembalikan untuk memproses pengembalian."
      />
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari kode buku, kode peminjam, atau nama..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !data || data.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Undo2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Tidak ada peminjaman aktif.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Peminjam</th>
                  <th className="text-left px-4 py-3">Buku</th>
                  <th className="text-left px-4 py-3">Tgl Kembali</th>
                  <th className="text-left px-4 py-3">Keterlambatan</th>
                  <th className="text-right px-4 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {data.map((p) => {
                  const days = differenceInDays(new Date(), new Date(p.tanggal_kembali));
                  return (
                    <tr key={p.id} className="border-t hover:bg-secondary/30">
                      <td className="px-4 py-3">
                        <div className="font-medium">{p.peminjam?.nama}</div>
                        <div className="text-xs font-mono text-muted-foreground">
                          {p.peminjam?.kode_peminjam}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                      {p.detail_peminjaman?.length ? p.detail_peminjaman.map((d:any,i:number)=>(
                        <div key={i}>{d.buku?.judul || "Data buku lama"} × {d.jumlah}</div>
                         ) ) : "Belum ada buku"
                        }      
                       </td>          

                      <td className="px-4 py-3">{format(new Date(p.tanggal_kembali), "dd MMM yyyy")}</td>
                      <td className="px-4 py-3">
                        {days > 0 ? (
                          <span className="text-destructive font-medium">{days} hari</span>
                        ) : (
                          <span className="text-muted-foreground">Tepat waktu</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" onClick={() => kembalikan(p.id)}>
                          <Undo2 className="h-4 w-4" /> Kembalikan
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
