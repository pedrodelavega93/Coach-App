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
  const [activeVideoUrl, setActiveVideoUrl] = useState(null);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [rest, setRest] = useState(null); // { secondsLeft, running, nextName }
  const timerRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    if (routineId) load();
  }, [routineId]);

  useEffect(() => {
    if (rest?.running && rest.secondsLeft > 0) {
      timerRef.current = setTimeout(() => {
        setRest((r) => (r ? { ...r, secondsLeft: r.secondsLeft - 1 } : r));
      }, 1000);
    } else if (rest?.running && rest.secondsLeft === 0) {
      if (!audioRef.current) {
        audioRef.current = new Audio(
          "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="
        );
      }
      audioRef.current.play().catch(() => {});
      if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
      setRest((r) => (r ? { ...r, running: false } : r));
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

      const todayLogs = allLogsForThis.filter((l) => new Date(l.logged_at) >= startOfToday);
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
          client_id: user.id
