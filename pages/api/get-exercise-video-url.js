import { supabaseAdmin } from "../../lib/supabaseAdmin";

export default async function handler(req, res) {
  const { exerciseId, clientId } = req.query;
  if (!exerciseId || !clientId) return res.status(400).json({ error: "Faltan parámetros" });

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("status, current_period_end")
    .eq("client_id", clientId)
    .maybeSingle();

  const active = sub && sub.status === "active" && new Date(sub.current_period_end) > new Date();
  if (!active) return res.status(403).json({ error: "Ciclo vencido. Renueva tu pago." });

  // Verifica que el ejercicio pertenezca a una rutina asignada a este cliente
  const { data: link } = await supabaseAdmin
    .from("routine_exercises")
    .select("id, routines!inner(client_id)")
    .eq("exercise_id", exerciseId)
    .eq("routines.client_id", clientId)
    .maybeSingle();

  if (!link) return res.status(404).json({ error: "Ejercicio no encontrado para este cliente" });

  const { data: exercise } = await supabaseAdmin
    .from("exercises")
    .select("video_path")
    .eq("id", exerciseId)
    .maybeSingle();

  if (!exercise?.video_path) return res.status(404).json({ error: "Este ejercicio no tiene video" });

  const { data: signed, error } = await supabaseAdmin.storage
    .from("exercise-videos")
    .createSignedUrl(exercise.video_path, 3600);

  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ url: signed.signedUrl });
}
