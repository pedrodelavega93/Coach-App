import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

export default function Workout() {
  const router = useRouter();
  const { routineId } = router.query;

  const [user, setUser] = useState(null);
  const [routine, setRoutine] = useState(null);
  const [items, setItems] = useState([]); // routine_exercises + exercise info + logs
  const [loading, setLoading] = useState(true);
  const [activeVideo, setActiveVideo] = useState(null); // exercise object being viewed
  const [rest, setRest] = useState(null); // { secondsLeft, running, nextName }
  const timerRef = useRef(null);

  useEffect(() => {
    if (routineId) load();
  }, [routineId]);

  useEffect(() => {
    if (rest?.running && rest.secondsLeft > 0) {
      timerRef.current = setTimeout(() => {
        setRest((r) => (r ? { ...r, secondsLeft: r.secondsLeft - 1 } : r));
      }, 1000);
    }
    return () => clearTimeout(timerRef.current);
  }, [rest]);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
    if (!user) return;

    const { data: routineData } = await supabase
      .from("routines")
      .select("*")
      .eq("id", routineId)
      .maybeSingle();
    setRoutine(routineData);

    const { data: routineExercises } = await supabase
      .from("routine_exercises")
      .select("*, exercises(*)")
      .eq("routine_id", routineId)
      .order("order_index", { ascending: true });

    if (!routineExercises) {
      setItems([]);
      setLoading(false);
      return;
    }

    const routineExerciseIds = routineExercises.map((re) => re.id);
    const { data: logs } = await supabase
      .from("exercise_logs")
      .select("*")
      .in("routine_exercise_id", routineExerciseIds)
      .eq("client_id", user.id)
      .order("logged_at", { ascending: false });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const built = routineExercises.map((re) => {
      const allLogsForThis = (logs || []).filter((l) => l.routine_exercise_id === re.id);

      // Registros de hoy (sesión actual)
      const todayLogs = allLogsForThis.filter((l) => new Date(l.logged_at) >= startOfToday);
      // Registros anteriores (para la comparación "la semana pasada hiciste X")
      const previousLogs = allLogsForThis.filter((l) => new Date(l.logged_at) < startOfToday);

      const sets = Array.from({ length: re.sets }, (_, i) => {
        const setNumber = i + 1;
        const existing = todayLogs.find((l) => l.set_number === setNumber);
        const previous = previousLogs.find((l) => l.set_number === setNumber);
        return {
          setNumber,
          logId: existing?.id || null,
          weight: existing?.weight_kg ?? "",
          completed: existing?.completed || false,
          previousWeight: previous?.weight_kg ?? null,
        };
      });

      return {
        routineExerciseId: re.id,
        exercise: re.exercises,
        setsCount: re.sets,
        reps: re.reps,
        restSeconds: re.rest_seconds,
        sets,
      };
    });

    setItems(built);
    setLoading(false);
  };

  const totalExercises = items.length;
  const completedExercises = items.filter((it) => it.sets.every((s) => s.completed)).length;
  const progressPct = totalExercises ? Math.round((completedExercises / totalExercises) * 100) : 0;

  const updateWeight = (routineExerciseId, setNumber, value) => {
    setItems((prev) =>
      prev.map((it) =>
        it.routineExerciseId !== routineExerciseId
          ? it
          : { ...it, sets: it.sets.map((s) => (s.setNumber === setNumber ? { ...s, weight: value } : s)) }
      )
    );
  };

  const saveWeight = async (item, set) => {
    if (set.logId) {
      await supabase.from("exercise_logs").update({ weight_kg: set.weight || null }).eq("id", set.logId);
    } else {
      const { data } = await supabase
        .from("exercise_logs")
        .insert({
          routine_exercise_id: item.routineExerciseId,
          client_id: user.id,
          set_number: set.setNumber,
          weight_kg: set.weight || null,
          completed: false,
        })
        .select()
        .maybeSingle();
      if (data) {
        setItems((prev) =>
          prev.map((it) =>
            it.routineExerciseId !== item.routineExerciseId
              ? it
              : { ...it, sets: it.sets.map((s) => (s.setNumber === set.setNumber ? { ...s, logId: data.id } : s)) }
          )
        );
      }
    }
  };

  const toggleSet = async (item, set) => {
    const newCompleted = !set.completed;

    // Guarda / actualiza en Supabase
    if (set.logId) {
      await supabase
        .from("exercise_logs")
        .update({ weight_kg: set.weight || null, completed: newCompleted })
        .eq("id", set.logId);
    } else {
      const { data } = await supabase
        .from("exercise_logs")
        .insert({
          routine_exercise_id: item.routineExerciseId,
          client_id: user.id,
          set_number: set.setNumber,
          weight_kg: set.weight || null,
          completed: newCompleted,
        })
        .select()
        .maybeSingle();
      if (data) set.logId = data.id;
    }

    setItems((prev) =>
      prev.map((it) =>
        it.routineExerciseId !== item.routineExerciseId
          ? it
          : {
              ...it,
              sets: it.sets.map((s) =>
                s.setNumber === set.setNumber ? { ...s, completed: newCompleted, logId: set.logId } : s
              ),
            }
      )
    );

    // Inicia el descanso solo cuando se marca (no al desmarcar)
    if (newCompleted) {
      const idx = items.findIndex((it) => it.routineExerciseId === item.routineExerciseId);
      const next = items[idx + 1];
      setRest({ secondsLeft: item.restSeconds, running: true, nextName: next?.exercise?.name || null });
    }
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  if (loading) return <p style={{ color: "#EDEAE3", padding: 24 }}>Cargando entrenamiento...</p>;
  if (!routine) return <p style={{ color: "#EDEAE3", padding: 24 }}>No se encontró la rutina.</p>;

  return (
    <div style={{ minHeight: "100vh", background: "#1C1F22", padding: 24 }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <p
          onClick={() => router.push("/client")}
          style={{ color: "#8A9199", fontSize: 14, cursor: "pointer", marginBottom: 16 }}
        >
          ← Volver
        </p>

        <div style={{ background: "#26292E", border: "1px solid #3A3F45", borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <h2 style={{ color: "#EDEAE3", marginTop: 0, marginBottom: 10 }}>{routine.title}</h2>
          <div style={{ width: "100%", height: 6, background: "#3A3F45", borderRadius: 3, marginBottom: 6 }}>
            <div style={{ width: `${progressPct}%`, height: "100%", background: "#8FBF8F", borderRadius: 3 }} />
          </div>
          <p style={{ color: "#8A9199", fontSize: 13, margin: 0 }}>
            {completedExercises} de {totalExercises} ejercicios completados
          </p>
        </div>

        {rest && (
          <div style={{ background: "#26292E", border: "1px solid #F4C430", borderRadius: 12, padding: 18, marginBottom: 16 }}>
            <p style={{ color: "#8A9199", fontSize: 13, marginBottom: 4 }}>Descanso</p>
            <p style={{ color: "#F4C430", fontSize: 28, fontWeight: 700, margin: "0 0 10px 0" }}>
              {formatTime(rest.secondsLeft)}
            </p>
            <button
              onClick={() => setRest((r) => (r ? { ...r, running: !r.running } : r))}
              style={{ padding: "8px 16px", borderRadius: 6, background: "#3A3F45", color: "#EDEAE3", border: "none", cursor: "pointer", marginBottom: 10 }}
            >
              {rest.running ? "⏸" : "▶️"}
            </button>
            {rest.nextName && (
              <p style={{ color: "#8A9199", fontSize: 13, margin: 0 }}>
                Siguiente ejercicio: <span style={{ color: "#EDEAE3" }}>{rest.nextName}</span>
              </p>
            )}
          </div>
        )}

        {items.map((item) => {
          const allDone = item.sets.every((s) => s.completed);
          return (
            <div
              key={item.routineExerciseId}
              style={{
                background: "#26292E",
                border: `1px solid ${allDone ? "#4C7A4C" : "#3A3F45"}`,
                borderRadius: 12,
                padding: 18,
                marginBottom: 14,
              }}
            >
              <h3
                onClick={() => setActiveVideo(item.exercise)}
                style={{ color: "#F4C430", margin: "0 0 4px 0", cursor: "pointer", textDecoration: "underline" }}
              >
                {item.exercise?.name || "Ejercicio"}
              </h3>
              <p style={{ color: "#5C6268", fontSize: 12, marginBottom: 12 }}>
                {item.setsCount} series × {item.reps} reps · Descanso {item.restSeconds}s
              </p>

              {item.sets.some((s) => s.previousWeight != null) && (
                <p style={{ color: "#8A9199", fontSize: 12, marginBottom: 10, fontStyle: "italic" }}>
                  La semana pasada:{" "}
                  {item.sets
                    .filter((s) => s.previousWeight != null)
                    .map((s) => `${s.previousWeight}kg`)
                    .join(", ")}
                  {" · "}Intenta {Math.max(...item.sets.map((s) => Number(s.previousWeight) || 0)) + 2.5}kg
                </p>
              )}

              <div>
                {item.sets.map((set) => (
                  <div
                    key={set.setNumber}
                    style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}
                  >
                    <input
                      type="checkbox"
                      checked={set.completed}
                      onChange={() => toggleSet(item, set)}
                    />
                    <span style={{ color: "#8A9199", fontSize: 13, width: 60 }}>Serie {set.setNumber}</span>
                    <input
                      type="number"
                      placeholder="kg"
                      value={set.weight}
                      onChange={(e) => updateWeight(item.routineExerciseId, set.setNumber, e.target.value)}
                      onBlur={() => saveWeight(item, set)}
                      style={{
                        width: 70,
                        padding: "6px 8px",
                        borderRadius: 6,
                        background: "#1C1F22",
                        border: "1px solid #3A3F45",
                        color: "#EDEAE3",
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {activeVideo && (
          <div
            onClick={() => setActiveVideo(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.85)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
              zIndex: 50,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ background: "#26292E", borderRadius: 12, padding: 20, maxWidth: 480, width: "100%" }}
            >
              <h3 style={{ color: "#EDEAE3", marginTop: 0 }}>{activeVideo.name}</h3>
              {activeVideo.video_url ? (
                <video src={activeVideo.video_url} controls style={{ width: "100%", borderRadius: 8, marginBottom: 14 }} />
              ) : (
                <p style={{ color: "#8A9199" }}>Tu entrenador aún no subió un video para este ejercicio.</p>
              )}
              {activeVideo.technique_notes && (
                <>
                  <p style={{ color: "#8A9199", fontSize: 13, marginBottom: 2 }}>Técnica</p>
                  <p style={{ color: "#EDEAE3", fontSize: 14, marginBottom: 10 }}>{activeVideo.technique_notes}</p>
                </>
              )}
              {activeVideo.common_mistakes && (
                <>
                  <p style={{ color: "#8A9199", fontSize: 13, marginBottom: 2 }}>Errores comunes</p>
                  <p style={{ color: "#EDEAE3", fontSize: 14, marginBottom: 10 }}>{activeVideo.common_mistakes}</p>
                </>
              )}
              {activeVideo.muscles_worked && (
                <>
                  <p style={{ color: "#8A9199", fontSize: 13, marginBottom: 2 }}>Músculos trabajados</p>
                  <p style={{ color: "#EDEAE3", fontSize: 14, marginBottom: 10 }}>{activeVideo.muscles_worked}</p>
                </>
              )}
              <button
                onClick={() => setActiveVideo(null)}
                style={{ width: "100%", padding: 12, borderRadius: 8, background: "#F4C430", color: "#1C1F22", fontWeight: 700, border: "none", cursor: "pointer" }}
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
