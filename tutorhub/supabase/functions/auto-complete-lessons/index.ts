import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 
Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
 
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
 
  // 1. პოულობს ყველა completed_by_tutor ბუქინგს, სადაც 24 საათი გავიდა
  const { data: expiredBookings, error: fetchErr } = await supabase
    .from("bookings")
    .select("id, tutor_id")
    .eq("status", "completed_by_tutor")
    .lt("completed_by_tutor_at", cutoff);
 
  if (fetchErr) {
    return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500 });
  }
 
  if (!expiredBookings || expiredBookings.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), { status: 200 });
  }
 
  const ids = expiredBookings.map((b) => b.id);
 
  // 2. სტატუსი → done
  const { error: updateErr } = await supabase
    .from("bookings")
    .update({ status: "done" })
    .in("id", ids);
 
  if (updateErr) {
    return new Response(JSON.stringify({ error: updateErr.message }), { status: 500 });
  }
 
  // 3. თითოეული მასწავლებლისთვის შეტყობინება
  const notifications = expiredBookings.map((b) => ({
    user_id: b.tutor_id,
    type:    "booking",
    title:   "გადახდა დადასტურდა ✓",
    body:    "სტუდენტმა ვადა გააცდინა — გაკვეთილი ავტომატურად დადასტურდა.",
    is_read: false,
  }));
 
  await supabase.from("notifications").insert(notifications).catch(() => {});
 
  return new Response(
    JSON.stringify({ processed: ids.length, ids }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});