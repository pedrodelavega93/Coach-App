import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Coach() {
  const [clients, setClients] = useState([]);
  const [selected, setSelected] = useState(null);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, email, full_name, subscriptions(status, current_period_end)")
      .eq("role", "client");
    setClients(data || []);
  };

  const uploadRoutine = async () => {
    if (!selected) return setStatus("Selecciona un cliente primero.");
    setStatus("Subiendo...");

    let video_path = null;
    if (file) {
      const path = `${selected}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("routine-videos").upload(path, file);
      if (upErr) return setStatus(`Error subiendo video: ${upErr.message}`);
      video_path = path;
    }

    const { error } = await supabase
      .from("routines")
      .insert({ client_id: selected, title, notes, video_path });

    if (error) return setStatus(`Error: ${error.message}`);
    setStatus("Rutina guardada ✅");
    setTitle("");
    setNotes("");
    setFile(null);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#1C1F22", padding: 24 }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <h1 style={{ color: "#EDEAE3", marginBottom: 20 }}>Panel del entrenador</h1>

        <h3 style={{ color: "#8A9199", marginBottom: 8 }}>Clientes</h3>
        <div style={{ marginBottom: 24 }}>
          {clients.map((c) => {
            const sub = c.subscriptions?.[0];
            const active = sub?.status === "active" && new Date(sub.current_period_end) > new Date();
            return (
              <div
                key={c.id}
                onClick={() => setSelected(c.id)}
                style={{
                  padding: 12,
                  marginBottom: 8,
                  borderRadius: 8,
                  cursor: "pointer",
                  background: selected === c.id ? "#3A3F45" : "#26292E",
                  border: "1px solid #3A3F45",
                  color: "#EDEAE3",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>{c.full_name || c.email}</span>
                <span style={{ color: active ? "#F4C430" : "#B3261E", fontSize: 13 }}>
                  {active ? "Activo" : "Vencido"}
                </span>
              </div>
            );
          })}
          {clients.length === 0 && <p style={{ color: "#8A9199" }}>Aún no hay clientes registrados.</p>}
        </div>

        <h3 style={{ color: "#8A9199", marginBottom: 8 }}>Subir rutina</h3>
        <input
          placeholder="Título de la rutina"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={inputStyle}
        />
        <textarea
          placeholder="Notas / instrucciones"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          style={{ ...inputStyle, resize: "none" }}
        />
        <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files[0])} style={{ marginBottom: 12, color: "#8A9199" }} />
        <button onClick={uploadRoutine} style={btnStyle}>
          Guardar y asignar
        </button>
        {status && <p style={{ color: "#EDEAE3", marginTop: 10 }}>{status}</p>}
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  marginBottom: 12,
  borderRadius: 8,
  background: "#26292E",
  border: "1px solid #3A3F45",
  color: "#EDEAE3",
  outline: "none",
};

const btnStyle = {
  width: "100%",
  padding: "14px",
  borderRadius: 8,
  background: "#F4C430",
  color: "#1C1F22",
  fontWeight: 700,
  border: "none",
};
