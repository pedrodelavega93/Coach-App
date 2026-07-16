import { useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("signin"); // signin | signup
  const [error, setError] = useState("");
  const router = useRouter();

  const submit = async () => {
    setError("");
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return setError(error.message);
      // Crea el perfil como cliente por defecto
      await supabase.from("profiles").insert({ id: data.user.id, email, role: "client" });
      router.push("/client");
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return setError(error.message);
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();
      router.push(profile?.role === "coach" ? "/coach" : "/client");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#1C1F22", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <h1 style={{ color: "#EDEAE3", fontSize: 28, marginBottom: 24, textAlign: "center" }}>CICLO</h1>
        <input
          placeholder="Correo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
        <input
          placeholder="Contraseña"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />
        <button onClick={submit} style={btnStyle}>
          {mode === "signup" ? "Crear cuenta" : "Entrar"}
        </button>
        <p
          onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
          style={{ color: "#8A9199", textAlign: "center", marginTop: 14, cursor: "pointer", fontSize: 14 }}
        >
          {mode === "signup" ? "Ya tengo cuenta" : "Crear una cuenta nueva"}
        </p>
        {error && <p style={{ color: "#B3261E", marginTop: 10, fontSize: 14 }}>{error}</p>}
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
