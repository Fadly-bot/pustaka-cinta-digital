import { createFileRoute } from "@tanstack/react-router";

const DEFAULT_ADMINS = [
  { email: "pishiup052@gmail.com", username: "admin", password: "Admin123!", nama: "Administrator Utama" },
  { email: "gandalf0001@gmail.com", username: "admi", password: "Admin128!", nama: "Administrator Kedua" },
];

export const Route = createFileRoute("/api/public/seed-admin")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const results: Array<{ email: string; status: string; id?: string }> = [];

        for (const a of DEFAULT_ADMINS) {
          // check existence by listing (small project) - use admin.listUsers
          const { data: list } = await supabaseAdmin.auth.admin.listUsers();
          const existing = list?.users.find((u) => u.email === a.email);
          let userId = existing?.id;

          if (!existing) {
            const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
              email: a.email,
              password: a.password,
              email_confirm: true,
              user_metadata: { username: a.username, nama_lengkap: a.nama },
            });
            if (error) {
              results.push({ email: a.email, status: `error: ${error.message}` });
              continue;
            }
            userId = created.user?.id;
          }

          if (userId) {
            // ensure profile
            await supabaseAdmin.from("profiles").upsert({
              id: userId,
              username: a.username,
              nama_lengkap: a.nama,
              email: a.email,
            });
            // ensure role
            await supabaseAdmin
              .from("user_roles")
              .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
            results.push({ email: a.email, status: existing ? "exists+ensured" : "created", id: userId });
          }
        }

        return Response.json({ ok: true, results });
      },
    },
  },
});