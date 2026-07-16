import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const CYCLE_DAYS = 30;
const TOTAL_WEEKS = 4;

export default function Client() {
  const [user, setUser] = useState(null);
  const [sub, setSub] = useState(null);
  const [routine, setRoutine] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [showVideo, setShowVideo] = useState(false);

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

  // Semana actual del ciclo, derivada de los días restantes (ciclo de 30 días / 4 semanas)
  const daysElapsed = Math.max(0, CYCLE_DAYS - daysLeft);
  const currentWeek = Math.min(TOTAL_WEEKS, Math.max(1, Math.ceil(daysElapsed / 7) || 1));
  const progressPct = Math.min(100, Math.round((daysElapsed / CYCLE_DAYS) * 100));

  const firstName = user.email ? user.email.split("@")[0].split(".")[0] : "";
  const displayName = firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1) : "";
  const hour = new Date().getHours();
  const saludo = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";

  return (
    <div style={{ minHeight: "100vh", background: "#1C1F22", padding: 24 }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <p style={{ color: "#EDEAE3", fontSize: 22, marginBottom: 24 }}>
          {saludo}{displayName ? `, ${displayName}` : ""} 👋
        </p>

        {active ? (
          <div style={{ background: "#26292E", border: "1px solid #3A3F45", borderRadius: 12, padding: 22 }}>
            <p style={{ color: "#8A9199", fontSize: 14, marginBottom: 8 }}>
              Semana {currentWeek} de {TOTAL_WEEKS}
            </p>
            <div style={{ width: "100%", height: 6, background: "#3A3F45", borderRadius: 3, marginBottom: 6 }}>
              <div style={{ width: `${progressPct}%`, height: "100%", background: "#F4C430", borderRadius: 3 }} />
            </div>
            <p style={{ color: "#F4C430", fontSize: 13, marginBottom: 20 }}>{progressPct}%</p>

            {routine ? (
              <>
                <p style={{ color: "#8A9199", fontSize: 13, marginBottom: 4 }}>Tu siguiente entrenamiento</p>
                <h3 style={{ color: "#EDEAE3", marginTop: 0, marginBottom: 16 }}>{routine.title}</h3>
                {routine.notes && (
                  <p style={{ color: "#8A9199", whiteSpace: "pre-wrap", fontSize: 14, marginBottom: 16 }}>
                    {routine.notes}
                  </p>
                )}

                {videoUrl ? (
                  showVideo ? (
                    <video src={videoUrl} controls autoPlay style={{ width: "100%", borderRadius: 8 }} />
                  ) : (
                    <button
                      onClick={() => setShowVideo(true)}
                      style={{ width: "100%", padding: "14px", borderRadius: 8, background: "#F4C430", color: "#1C1F22", fontWeight: 700, border: "none", cursor: "pointer" }}
                    >
                      INICIAR ENTRENAMIENTO
                    </button>
                  )
                ) : null}
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
              style={{ padding: "12px 20px", borderRadius: 8, background: "#F4C430", color: "#1C1F22", fontWeight: 700, border: "none", cursor: "pointer" }}
            >
              Renovar pago
            </button>
          </div>
        )}

        {active && (
          <div style={{ marginTop: 20 }}>
            {[
              ["📈", "Mi progreso"],
              ["📸", "Fotos de avance"],
              ["⚖️", "Peso"],
              ["📏", "Medidas"],
              ["🍽️", "Nutrición"],
              ["💬", "Chat con tu coach"],
            ].map(([icon, label]) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "14px 6px",
                  borderBottom: "1px solid #2A2E33",
                  color: "#EDEAE3",
                  fontSize: 15,
                  opacity: 0.6,
                }}
              >
                <span>{icon}</span>
                <span>{label}</span>
                <span style={{ marginLeft: "auto", color: "#5C6268", fontSize: 12 }}>Próximamente</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
