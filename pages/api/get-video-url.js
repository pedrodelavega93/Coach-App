import { supabaseAdmin } from "../../lib/supabaseAdmin";

export default async function handler(req, res) {
  const { routineId, clientId } = req.query;
  if (!routineId || !clientId) return res.status(400).json({ error: "Faltan parámetros" });

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("status, current_period_end")
    .eq("client_id", clientId)
    .maybeSingle();

  const active =
    sub && sub.status === "active" && new Date(sub.current_period_end) > new Date();

  if (!active) return res.status(403).json({ error: "Ciclo vencido. Renueva tu pago." });

  const { data: routine } = await supabaseAdmin
    .from("routines")
    .select("video_path, client_id")
    .eq("id", routineId)
    .maybeSingle();

  if (!routine || routine.client_id !== clientId) {
    return res.status(404).json({ error: "Rutina no encontrada" });
  }

  const { data: signed, error } = await supabaseAdmin.storage
    .from("routine-videos")
    .createSignedUrl(routine.video_path, 3600);

  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ url: signed.signedUrl });
}
