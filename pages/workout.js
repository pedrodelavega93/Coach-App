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
      const previousLogs = allLogsForThis.filter((l) => new Date(l.logged_at) 
