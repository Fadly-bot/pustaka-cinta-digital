// deno-lint-ignore-file no-explicit-any
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface NewUser {
  email: string;
  password: string;
  username: string;
  nama_lengkap: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is admin
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isAdmin } = await userClient.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const users: NewUser[] = body.users ?? [];
    if (!Array.isArray(users) || users.length === 0) {
      return new Response(JSON.stringify({ error: "users[] required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const results: any[] = [];

    for (const u of users) {
      if (!u.email || !u.password || !u.username || !u.nama_lengkap) {
        results.push({ email: u.email, ok: false, error: "Field tidak lengkap" });
        continue;
      }
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { username: u.username, nama_lengkap: u.nama_lengkap },
      });
      if (createErr || !created.user) {
        results.push({ email: u.email, ok: false, error: createErr?.message ?? "Gagal membuat user" });
        continue;
      }
      const uid = created.user.id;
      // Upsert profile (trigger may already create it)
      await admin.from("profiles").upsert({
        id: uid,
        username: u.username,
        nama_lengkap: u.nama_lengkap,
        email: u.email,
      });
      // Assign role
      const { error: roleErr } = await admin
        .from("user_roles")
        .upsert({ user_id: uid, role: "petugas" }, { onConflict: "user_id,role" });
      if (roleErr) {
        results.push({ email: u.email, ok: false, error: roleErr.message });
        continue;
      }
      results.push({ email: u.email, ok: true, user_id: uid });
    }

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});