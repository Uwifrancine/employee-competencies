import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let p = "";
  const buf = new Uint32Array(12);
  crypto.getRandomValues(buf);
  for (let i = 0; i < 12; i++) p += chars[buf[i] % chars.length];
  // ensure complexity
  return p + "!9";
}

async function ensureAdmin(supabaseAdmin: any, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

export const inviteEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        fullName: z.string().trim().min(1).max(120),
        role: z.enum(["admin", "employee"]).default("employee"),
        jobTitleId: z.string().uuid().nullable().optional(),
        supervisorId: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await ensureAdmin(supabaseAdmin, context.userId);

    const tempPassword = generatePassword();

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (createErr || !created?.user) throw new Error(createErr?.message ?? "Failed to create user");

    const newUserId = created.user.id;

    const { error: profErr } = await supabaseAdmin.from("profiles").insert({
      id: newUserId,
      email: data.email,
      full_name: data.fullName,
      job_title_id: data.jobTitleId ?? null,
      supervisor_id: data.supervisorId ?? null,
      must_change_password: true,
    });
    if (profErr) throw new Error(profErr.message);

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUserId, role: data.role });
    if (roleErr) throw new Error(roleErr.message);

    // Best-effort: enqueue temp-password email; ignore if email infra not set up
    let emailSent = false;
    try {
      const { error: enqErr } = await (supabaseAdmin.rpc as any)("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          template: "employee_invite",
          to: data.email,
          data: { fullName: data.fullName, tempPassword },
        },
      });
      emailSent = !enqErr;
    } catch {
      emailSent = false;
    }

    return { userId: newUserId, tempPassword, emailSent };
  });

export const signUpFirstAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        password: z.string().min(8).max(128),
        fullName: z.string().trim().min(1).max(120),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error: countErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id", { count: "exact", head: true })
      .eq("role", "admin");
    if (countErr) throw new Error(countErr.message);
    if ((count ?? 0) > 0) throw new Error("An admin already exists. Ask an admin to invite you.");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error || !created?.user) throw new Error(error?.message ?? "Could not create user");

    const uid = created.user.id;
    await supabaseAdmin.from("profiles").insert({
      id: uid,
      email: data.email,
      full_name: data.fullName,
      must_change_password: false,
    });
    await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: "admin" });

    return { ok: true };
  });

export const resetEmployeePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await ensureAdmin(supabaseAdmin, context.userId);
    const tempPassword = generatePassword();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: tempPassword,
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("profiles").update({ must_change_password: true }).eq("id", data.userId);
    return { tempPassword };
  });
