import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, FileDown, FileBarChart } from "lucide-react";
import { format, startOfMonth } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/app/laporan")({
  ssr: false,
  component: LaporanPage,
});

function LaporanPage() {
  const [from, setFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data, isLoading } = useQuery({
    queryKey: ["laporan", from, to],
    queryFn: async () => {

    const { data: pinjam, error } =
    await supabase
    .from("peminjaman")
    .select(`*,peminjam:peminjam_id(nama,kode_peminjam)`)
    .gte("crated_at", from + "T00:00:00")
    .lte("created_at", to + "T23:59:59")
    .order("tanggal_pinjam",{ascending:false});
    if (error)
    throw error;

const rows =
pinjam ?? [];

if (!rows.length)
return [];

const ids =
rows.map(
(r)=>r.id
);

const {
data: detail,
error: detailErr
}
=
await supabase
.from(
"detail_peminjaman"
)
.select(`
peminjaman_id,
buku_id,
jumlah
`)
.in(
"peminjaman_id",
ids
);

if (
detailErr
)
throw detailErr;

const bukuIds =
[
...new Set(
(detail??[])
.map(
(d:any)=>
d.buku_id
)
.filter(
Boolean
)
)
];

const {
data:buku,
error:bukuErr
}
=
bukuIds.length
?
await supabase
.from(
"buku"
)
.select(`
id,
judul,
kode_buku
`)
.in(
"id",
bukuIds
)
:
{
data:[]
};

if(
bukuErr
)
throw bukuErr;

const bukuMap =
new Map(
(buku??[])
.map(
(b:any)=>[
b.id,
b
]
)
);
console.log("LAPORAN RAW", rows);
      console.log("DETAIL", detail);
      console.log("BUKU", buku);
      
    const merged =rows.map((r:any)=>({...r,detail_peminjaman:(detail??[])
      .filter((d:any)=>String(d.peminjaman_id)===String(r.id))
      .map((d:any)=>({jumlah:d.jumlah,buku:bukuMap.get(d.buku_id)?? null}))
      })
      );
      console.log("LAPORAN MERGED",merged);
      return merged;

  const exportCSV = () => {
    if (!data || data.length === 0) return toast.error("Tidak ada data");
    const rows = [["Tanggal Pinjam", "Tanggal Kembali", "Peminjam", "Kode Peminjam", "Buku", "Status"]];
    data.forEach((p) => {
      const buku = p.detail_peminjaman?.map((d: { jumlah: number; buku: { judul: string } | null }) => `${d.buku?.judul} x${d.jumlah}`).join("; ") ?? "";
      rows.push([
        p.tanggal_pinjam,
        p.tanggal_kembali,
        p.peminjam?.nama ?? "",
        p.peminjam?.kode_peminjam ?? "",
        buku,
        p.status,
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `laporan-peminjaman-${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Laporan diunduh");
  };

  const exportPDF = () => {
    if (!data || data.length === 0) return toast.error("Tidak ada data");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Laporan Peminjaman</title>
<style>body{font-family:Inter,sans-serif;padding:24px;color:#0f172a}h1{font-size:18px;margin:0 0 4px}p{margin:0 0 16px;color:#64748b;font-size:12px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left}th{background:#eff6ff}</style>
</head><body>
<h1>Laporan Peminjaman Perpustakaan</h1>
<p>Periode ${from} sampai ${to}</p>
<table><thead><tr><th>Tgl Pinjam</th><th>Tgl Kembali</th><th>Peminjam</th><th>Buku</th><th>Status</th></tr></thead>
<tbody>${data
        .map(
          (p) => `<tr><td>${p.tanggal_pinjam}</td><td>${p.tanggal_kembali}</td><td>${p.peminjam?.nama ?? ""} (${p.peminjam?.kode_peminjam ?? ""})</td><td>${
            p.detail_peminjaman?.map((d: { jumlah: number; buku: { judul: string } | null }) => `${d.buku?.judul} x${d.jumlah}`).join("; ") ?? ""
          }</td><td>${p.status}</td></tr>`,
        )
        .join("")}</tbody></table>
<script>window.onload=()=>window.print();</script>
</body></html>`;
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  };

  return (
    <div>
      <PageHeader title="Laporan" description="Rekap aktivitas peminjaman per periode." />
      <Card className="mb-4">
        <CardContent className="pt-6 flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label>Dari Tanggal</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Sampai Tanggal</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={exportCSV}><FileDown className="h-4 w-4" /> Excel/CSV</Button>
            <Button onClick={exportPDF}><FileDown className="h-4 w-4" /> PDF</Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : !data || data.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <FileBarChart className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Belum ada data pada rentang ini.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Tgl Pinjam</th>
                  <th className="text-left px-4 py-3">Tgl Kembali</th>
                  <th className="text-left px-4 py-3">Peminjam</th>
                  <th className="text-left px-4 py-3">Buku</th>
                  <th className="text-left px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-4 py-3">{format(new Date(p.tanggal_pinjam), "dd MMM yyyy")}</td>
                    <td className="px-4 py-3">{format(new Date(p.tanggal_kembali), "dd MMM yyyy")}</td>
                    <td className="px-4 py-3">{p.peminjam?.nama}</td>
                    <td className="px-4 py-3">

{
p.detail_peminjaman?.length
?

p.detail_peminjaman.map(
(
d:any,
i:number
)=>(

<div key={i}>

{
d.buku?.judul
?? "Buku tidak ditemukan"
}

×

{
d.jumlah
}

</div>

)
)

:

"Belum ada buku"

}

</td>
                    <td className="px-4 py-3">

<span
className={
p.status === "Kembali"
? "text-green-600"
: "text-blue-600"
}
>

{p.status}

</span>

</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
