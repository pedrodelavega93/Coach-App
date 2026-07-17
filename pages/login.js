import { useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

export default function Login() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("signin"); // signin | signup
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const router = useRouter();

  const submit = async () => {
    setError("");
    setNotice("");
    if (!email || !password) {
      return setError("Por favor completa tu correo y contraseña.");
    }
    if (mode === "signup" && !fullName) {
      return setError("Por favor escribe tu nombre completo.");
    }
    if (password.length < 6) {
      return setError("La contraseña debe tener al menos 6 caracteres.");
    }
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return setError(error.message);
      // Crea el perfil como cliente por defecto
      await supabase.from("profiles").insert({ id: data.user.id, email, full_name: fullName, role: "client" });
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

  const handleForgotPassword = async () => {
    setError("");
    setNotice("");
    if (!email) return setError("Escribe tu correo para recuperar tu contraseña.");
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) return setError(error.message);
    setNotice("Te enviamos un correo para restablecer tu contraseña.");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#1C1F22", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <h1 style={{ color: "#EDEAE3", fontSize: 30, marginBottom: 4, textAlign: "center", letterSpacing: 1 }}>
          MÉTODOUNO
        </h1>
        <p style={{ color: "#8A9199", textAlign: "center", marginBottom: 28, fontSize: 15, fontStyle: "italic" }}>
          Tu evolución comienza aquí
        </p>

        {mode === "signup" && (
          <input
            placeholder="Nombre completo"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            style={inputStyle}
          />
        )}
        <input
          placeholder="Correo electrónico"
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

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, fontSize: 13 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#8A9199", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            Recordarme
          </label>
          <span onClick={handleForgotPassword} style={{ color: "#8A9199", cursor: "pointer" }}>
            ¿Olvidaste tu contraseña?
          </span>
        </div>

        <button onClick={submit} style={btnStyle}>
          {mode === "signup" ? "Crear cuenta" : "Entrar"}
        </button>

        <p
          onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
          style={{ color: "#8A9199", textAlign: "center", marginTop: 14, cursor: "pointer", fontSize: 14 }}
        >
          {mode === "signup" ? "Ya tengo cuenta" : "¿Aún no eres alumno? Solicita tu programa personalizado"}
        </p>

        {error && <p style={{ color: "#B3261E", marginTop: 10, fontSize: 14, textAlign: "center" }}>{error}</p>}
        {notice && <p style={{ color: "#8FBF8F", marginTop: 10, fontSize: 14, textAlign: "center" }}>{notice}</p>}

        <p style={{ color: "#5C6268", textAlign: "center", marginTop: 24, fontSize: 12 }}>
          Seguimiento semanal con tu coach.
        </p>
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
  cursor: "pointer",
};
