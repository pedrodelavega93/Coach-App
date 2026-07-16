import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Client() {
  const [user, setUser] = useState(null);
  const [sub, setSub] = useState(null);
  const [routine, setRoutine] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
    if (!user) return;

    const { data: subData } = await supabase
      .from("subscriptions")
      .select("status, current_period_end")
      .eq("client_id", user.id)
      .maybeSingle();
    setSub(subData);

    const { data: routineData } = await supabase
      .from("routines")
      .select("*")
      .eq("client_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setRoutine(routineData);

    const active = subData?.status === "active" && new Date(subData.current_period_end) > new Date();
    if (active && routineData?.video_path) {
      const res = await fetch(`/api/get-video-url?routineId=${routineData.id}&clientId=${user.id}`);
      const json = await res.json();
      if (json.url) setVideoUrl(json.url);
    }
  };

  const renovar = async () => {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: user.id, email: user.email }),
    });
    const json = await res.json();
    if (json.url) window.location.href = json.url;
  };

  if (!user) return <p style={{ color: "#EDEAE3", padding: 24 }}>Inicia sesión para ver tu rutina.</p>;

  const active = sub?.status === "active" && new Date(sub.current_period_end) > new Date();
  const daysLeft = sub?.current_period_end
    ? Math.ceil((new Date(sub.current_period_end) - new Date()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <div style={{ minHeight: "100vh", background: "#1C1F22", padding: 24 }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <h1 style={{ color: "#EDEAE3", marginBottom: 20 }}>Mi rutina</h1>

        {active ? (
          <div style={{ background: "#26292E", border: "1px solid #3A3F45", borderRadius: 10, padding: 20 }}>
            <p style={{ color: "#F4C430", marginBottom: 10 }}>{daysLeft} días restantes de tu ciclo</p>
            {routine ? (
              <>
                <h3 style={{ color: "#EDEAE3" }}>{routine.title}</h3>
                <p style={{ color: "#8A9199", whiteSpace: "pre-wrap" }}>{routine.notes}</p>
                {videoUrl && (
                  <video src={videoUrl} controls style={{ width: "100%", marginTop: 12, borderRadius: 8 }} />
                )}
              </>
            ) : (
              <p style={{ color: "#8A9199" }}>Tu entrenador aún no te ha asignado una rutina.</p>
            )}
          </div>
        ) : (
          <div style={{ background: "#26292E", border: "1px solid #3A3F45", borderRadius: 10, padding: 24, textAlign: "center" }}>
            <p style={{ color: "#EDEAE3", fontWeight: 700, marginBottom: 8 }}>Acceso bloqueado</p>
            <p style={{ color: "#8A9199", marginBottom: 16 }}>
              Tu ciclo de 30 días terminó. Renueva tu pago para desbloquear tu próxima rutina.
            </p>
            <button
              onClick={renovar}
              style={{ padding: "12px 20px", borderRadius: 8, background: "#F4C430", color: "#1C1F22", fontWeight: 700, border: "none" }}
            >
              Renovar pago
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
