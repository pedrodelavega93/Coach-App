import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function BuildRoutine() {
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("");

  const [routineMode, setRoutineMode] = useState("new"); // "new" | existing routine id
  const [existingRoutines, setExistingRoutines] = useState([]);
  const [newTitle, setNewTitle] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const [catalog, setCatalog] = useState([]);
  const [items, setItems] = useState([]); // ejercicios agregados a esta rutina

  const [pickExerciseId, setPickExerciseId] = useState("");
  const [pickSets, setPickSets] = useState(4);
  const [pickReps, setPickReps] = useState(10);
  const [pickRest, setPickRest] = useState(60);

  const [showNewExercise, setShowNewExercise] = useState(false);
  const [editingExerciseId, setEditingExerciseId] = useState(null); // null = creando uno nuevo
  const [exName, setExName] = useState("");
  const [exVideoFile, setExVideoFile] = useState(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [exMuscles, setExMuscles] = useState("");
  const [exTechnique, setExTechnique] = useState("");
  const [exMistakes, setExMistakes] = useState("");

  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  useEffect(() => {
    loadClients();
    loadCatalog();
  }, []);

  useEffect(() => {
    if (selectedClientId) loadRoutinesForClient(selectedClientId);
  }, [selectedClientId]);

  useEffect(() => {
    if (routineMode !== "new") loadItemsForRoutine(routineMode);
    else setItems([]);
  }, [routineMode]);

  const loadClients = async () => {
    const { data } = await supabase.from("profiles").select("id, email, full_name").eq("role", "client");
    setClients(data || []);
  };

  const loadCatalog = async () => {
    const { data } = await supabase.from("exercises").select("*").order("name", { ascending: true });
    setCatalog(data || []);
  };

  const loadRoutinesForClient = async (clientId) => {
    const { data } = await supabase
      .from("routines")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    setExistingRoutines(data || []);
    setRoutineMode("new");
    setNewTitle("");
    setNewNotes("");
  };

  const loadItemsForRoutine = async (routineId) => {
    const { data } = await supabase
      .from("routine_exercises")
      .select("*, exercises(*)")
      .eq("routine_id", routineId)
      .order("order_index", { ascending: true });
    setItems(
      (data || []).map((re) => ({
        routineExerciseId: re.id,
        exercise_id: re.exercise_id,
        name: re.exercises?.name,
        sets: re.sets,
        reps: re.reps,
        rest_seconds: re.rest_seconds,
      }))
    );
  };

  const addItem = () => {
    if (!pickExerciseId) return;
    const ex = catalog.find((c) => c.id === pickExerciseId);
    setItems((prev) => [
      ...prev,
      {
        routineExerciseId: null,
        exercise_id: pickExerciseId,
        name: ex?.name,
        sets: Number(pickSets),
        reps: pickReps,
        rest_seconds: Number(pickRest),
      },
    ]);
    setPickExerciseId("");
    setPickSets(4);
    setPickReps(10);
    setPickRest(60);
  };

  const removeItem = (idx) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateItemField = (idx, field, value) => {
    setItems((prev) =>
      prev.map((it, i) =>
        i === idx ? { ...it, [field]: field === "reps" || value === "" ? value : Number(value) } : it
      )
    );
  };

  const startEditExercise = (ex) => {
    setEditingExerciseId(ex.id);
    setExName(ex.name || "");
    setExVideoFile(null);
    setExMuscles(ex.muscles_worked || "");
    setExTechnique(ex.technique_notes || "");
    setExMistakes(ex.common_mistakes || "");
    setShowNewExercise(true);
  };

  const cancelExerciseForm = () => {
    setShowNewExercise(false);
    setEditingExerciseId(null);
    setExName("");
    setExVideoFile(null);
    setExMuscles("");
    setExTechnique("");
    setExMistakes("");
  };

  const saveExercise = async () => {
    if (!exName) return;
    setUploadingVideo(true);

    try {
      let video_path = editingExerciseId
        ? catalog.find((c) => c.id === editingExerciseId)?.video_path || null
        : null;

      if (exVideoFile) {
        const filePath = `${Date.now()}-${exVideoFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("exercise-videos")
          .upload(filePath, exVideoFile);
        if (uploadError) {
          setUploadingVideo(false);
          alert("Error al subir el video: " + uploadError.message);
          return;
        }
        video_path = filePath;
      }

      const payload = {
        name: exName,
        video_path,
        muscles_worked: exMuscles || null,
        technique_notes: exTechnique || null,
        common_mistakes: exMistakes || null,
      };

      let data, error;
      if (editingExerciseId) {
        ({ data, error } = await supabase
          .from("exercises")
          .update(payload)
          .eq("id", editingExerciseId)
          .select()
          .maybeSingle());
      } else {
        ({ data, error } = await supabase.from("exercises").insert(payload).select().maybeSingle());
      }

      setUploadingVideo(false);

      if (error) {
        alert("Error al guardar el ejercicio: " + error.message);
        return;
      }
      if (!data) {
        alert("No se pudo guardar el ejercicio (no se recibió confirmación de la base de datos). Intenta de nuevo.");
        return;
      }

      setCatalog((prev) => {
        const withoutOld = prev.filter((c) => c.id !== data.id);
        return [...withoutOld, data].sort((a, b) => a.name.localeCompare(b.name));
      });
      // Si el ejercicio editado ya estaba agregado a la rutina actual, actualiza su nombre ahí también
      setItems((prev) => prev.map((it) => (it.exercise_id === data.id ? { ...it, name: data.name } : it)));
      setPickExerciseId(data.id);
      cancelExerciseForm();
    } catch (err) {
      setUploadingVideo(false);
      alert("Ocurrió un error inesperado: " + (err?.message || err));
    }
  };


  const deleteRoutine = async () => {
    if (routineMode === "new") return;
    const routineTitle = existingRoutines.find((r) => r.id === routineMode)?.title || "esta rutina";
    const confirmed = confirm(
      `¿Seguro que quieres eliminar "${routineTitle}"? Esto borra la rutina y todos sus ejercicios asignados (los ejercicios del catálogo NO se borran, solo su conexión con esta rutina). No se puede deshacer.`
    );
    if (!confirmed) return;

    setSaving(true);
    await supabase.from("routine_exercises").delete().eq("routine_id", routineMode);
    const { error } = await supabase.from("routines").delete().eq("id", routineMode);
    setSaving(false);

    if (error) {
      alert("Error al eliminar: " + error.message);
      return;
    }

    setSavedMsg(`"${routineTitle}" fue eliminada.`);
    setRoutineMode("new");
    setItems([]);
    loadRoutinesForClient(selectedClientId);
  };

  const save = async () => {
    if (!selectedClientId) return alert("Elige un cliente.");
    if (items.length === 0) return alert("Agrega al menos un ejercicio.");
    const invalid = items.find((it) => !it.sets || !it.reps);
    if (invalid) {
      setSaving(false);
      return alert(`Revisa "${invalid.name}": series y reps no pueden estar vacíos o en 0.`);
    }
    setSaving(true);
    setSavedMsg("");

    let routineId = routineMode;

    if (routineMode === "new") {
      if (!newTitle) {
        setSaving(false);
        return alert("Ponle un título a la rutina.");
      }
      const { data, error } = await supabase
        .from("routines")
        .insert({ client_id: selectedClientId, title: newTitle, notes: newNotes || null })
        .select()
        .maybeSingle();
      if (error) {
        setSaving(false);
        return alert(error.message);
      }
      routineId = data.id;
    }

    // Borra los routine_exercises previos de esta rutina y vuelve a insertar (más simple y evita duplicados)
    await supabase.from("routine_exercises").delete().eq("routine_id", routineId);

    const rows = items.map((it, idx) => ({
      routine_id: routineId,
      exercise_id: it.exercise_id,
      order_index: idx,
      sets: it.sets,
      reps: it.reps,
      rest_seconds: it.rest_seconds,
    }));

    const { error: insertError } = await supabase.from("routine_exercises").insert(rows);
    setSaving(false);
    if (insertError) return alert(insertError.message);

    setSavedMsg("Rutina guardada correctamente.");
    if (routineMode === "new") {
      loadRoutinesForClient(selectedClientId);
      setRoutineMode(routineId);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#1C1F22", padding: 24 }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <h1 style={{ color: "#EDEAE3", marginBottom: 20 }}>Armar rutina</h1>

        <label style={labelStyle}>Cliente</label>
        <select
          value={selectedClientId}
          onChange={(e) => setSelectedClientId(e.target.value)}
          style={selectStyle}
        >
          <option value="">Selecciona un cliente</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.full_name || c.email}</option>
          ))}
        </select>

        {selectedClientId && (
          <>
            <label style={labelStyle}>Rutina</label>
            <select
              value={routineMode}
              onChange={(e) => setRoutineMode(e.target.value)}
              style={selectStyle}
            >
              <option value="new">+ Crear rutina nueva</option>
              {existingRoutines.map((r) => (
                <option key={r.id} value={r.id}>{r.title}</option>
              ))}
            </select>

            {routineMode !== "new" && (
              <p
                onClick={deleteRoutine}
                style={{ color: "#B3261E", fontSize: 13, cursor: "pointer", marginTop: -6, marginBottom: 14 }}
              >
                Eliminar esta rutina
              </p>
            )}

            {routineMode === "new" && (
              <>
                <label style={labelStyle}>Título de la rutina</label>
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="ej. Espalda + Bíceps"
                  style={inputStyle}
                />
                <label style={labelStyle}>Notas (opcional)</label>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  rows={3}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </>
            )}

            <div style={{ background: "#26292E", border: "1px solid #3A3F45", borderRadius: 10, padding: 16, marginTop: 20 }}>
              <p style={{ color: "#EDEAE3", fontWeight: 700, marginTop: 0, marginBottom: 12 }}>Agregar ejercicio</p>

              <select
                value={pickExerciseId}
                onChange={(e) => setPickExerciseId(e.target.value)}
                style={selectStyle}
              >
                <option value="">Elige del catálogo</option>
                {catalog.map((ex) => (
                  <option key={ex.id} value={ex.id}>{ex.name}</option>
                ))}
              </select>

              {pickExerciseId && !showNewExercise && (
                <p
                  onClick={() => startEditExercise(catalog.find((c) => c.id === pickExerciseId))}
                  style={{ color: "#8A9199", fontSize: 13, cursor: "pointer", marginBottom: 12, textDecoration: "underline" }}
                >
                  Editar este ejercicio (nombre, video, técnica)
                </p>
              )}

              <p
                onClick={() => (showNewExercise ? cancelExerciseForm() : setShowNewExercise(true))}
                style={{ color: "#F4C430", fontSize: 13, cursor: "pointer", marginBottom: 12 }}
              >
                {showNewExercise ? "Cancelar" : "+ Crear ejercicio nuevo en el catálogo"}
              </p>

              {showNewExercise && (
                <div style={{ marginBottom: 14, borderTop: "1px solid #3A3F45", paddingTop: 12 }}>
                  {editingExerciseId && (
                    <p style={{ color: "#8A9199", fontSize: 12, marginBottom: 10 }}>
                      Editando "{catalog.find((c) => c.id === editingExerciseId)?.name}"
                    </p>
                  )}
                  <input placeholder="Nombre del ejercicio" value={exName} onChange={(e) => setExName(e.target.value)} style={inputStyle} />
                  <label style={labelStyle}>Video de técnica{editingExerciseId ? " (deja vacío para conservar el actual)" : ""}</label>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(e) => setExVideoFile(e.target.files?.[0] || null)}
                    style={{ ...inputStyle, padding: "8px 0" }}
                  />
                  <input placeholder="Músculos trabajados" value={exMuscles} onChange={(e) => setExMuscles(e.target.value)} style={inputStyle} />
                  <textarea placeholder="Descripción de la técnica" value={exTechnique} onChange={(e) => setExTechnique(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
                  <textarea placeholder="Errores comunes" value={exMistakes} onChange={(e) => setExMistakes(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
                  <button onClick={saveExercise} disabled={uploadingVideo} style={smallBtnStyle}>
                    {uploadingVideo ? "Subiendo video..." : editingExerciseId ? "Guardar cambios" : "Guardar ejercicio en catálogo"}
                  </button>
                </div>
              )}

              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Series</label>
                  <input type="number" value={pickSets} onChange={(e) => setPickSets(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Reps</label>
                  <input type="text" value={pickReps} onChange={(e) => setPickReps(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Descanso (s)</label>
                  <input type="number" value={pickRest} onChange={(e) => setPickRest(e.target.value)} style={inputStyle} />
                </div>
              </div>

              <button onClick={addItem} style={smallBtnStyle}>Agregar a la rutina</button>
            </div>

            <div style={{ marginTop: 20 }}>
              {items.map((it, idx) => (
                <div
                  key={idx}
                  style={{ background: "#26292E", border: "1px solid #3A3F45", borderRadius: 8, padding: "12px 14px", marginBottom: 8 }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <p style={{ color: "#EDEAE3", margin: 0, fontWeight: 600 }}>{it.name}</p>
                    <span onClick={() => removeItem(idx)} style={{ color: "#B3261E", cursor: "pointer", fontSize: 13 }}>
                      Quitar
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ ...labelStyle, marginTop: 0 }}>Series</label>
                      <input
                        type="number"
                        value={it.sets}
                        onChange={(e) => updateItemField(idx, "sets", e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ ...labelStyle, marginTop: 0 }}>Reps</label>
                      <input
                        type="text"
                        value={it.reps}
                        onChange={(e) => updateItemField(idx, "reps", e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ ...labelStyle, marginTop: 0 }}>Descanso (s)</label>
                      <input
                        type="number"
                        value={it.rest_seconds}
                        onChange={(e) => updateItemField(idx, "rest_seconds", e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={save} disabled={saving} style={btnStyle}>
              {saving ? "Guardando..." : "Guardar rutina"}
            </button>
            {savedMsg && <p style={{ color: "#8FBF8F", textAlign: "center", marginTop: 10 }}>{savedMsg}</p>}
          </>
        )}
      </div>
    </div>
  );
}

const labelStyle = { color: "#8A9199", fontSize: 13, display: "block", marginBottom: 6, marginTop: 12 };

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  marginBottom: 10,
  borderRadius: 8,
  background: "#1C1F22",
  border: "1px solid #3A3F45",
  color: "#EDEAE3",
  outline: "none",
  boxSizing: "border-box",
};

const selectStyle = { ...inputStyle };

const btnStyle = {
  width: "100%",
  padding: "14px",
  borderRadius: 8,
  background: "#F4C430",
  color: "#1C1F22",
  fontWeight: 700,
  border: "none",
  cursor: "pointer",
  marginTop: 20,
};

const smallBtnStyle = {
  padding: "10px 16px",
  borderRadius: 6,
  background: "#3A3F45",
  color: "#EDEAE3",
  fontWeight: 600,
  border: "none",
  cursor: "pointer",
  fontSize: 13,
};
