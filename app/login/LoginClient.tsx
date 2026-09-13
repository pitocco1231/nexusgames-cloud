"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginClient() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    setSuccess(false);

    try {
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, mode })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMessage(data?.message || "Não foi possível continuar.");
        return;
      }

      if (data?.requiresConfirmation) {
        setSuccess(true);
        setMessage("Conta criada. Confira seu e-mail para confirmar o cadastro.");
        return;
      }

      const next = params.get("next");
      router.replace(next && next.startsWith("/") ? next : "/");
      router.refresh();
    } catch {
      setMessage("Não foi possível conectar agora. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="nxAuthCard">
      <div className="nxAuthBrand">
        <img src="/assets/nexus-logo" alt="NexusGames" />
        <div><strong>NEXUS<span>GAMES</span></strong><small>PLAY MORE</small></div>
      </div>

      <div className="nxAuthTabs">
        <button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setMessage(""); }}>Entrar</button>
        <button className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setMessage(""); }}>Criar conta</button>
      </div>

      <div className="nxAuthHeading">
        <span>{mode === "login" ? "MINHA CONTA" : "NOVO NA NEXUS?"}</span>
        <h1>{mode === "login" ? "Bem-vindo de volta." : "Crie sua conta."}</h1>
        <p>{mode === "login" ? "Entre para acompanhar seus pedidos e comprar mais rápido." : "Tenha seus pedidos e compras organizados em um só lugar."}</p>
      </div>

      <form onSubmit={submit} className="nxAuthForm">
        <label>
          E-mail
          <div className="nxAuthInput">
            <span>✉</span>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
          </div>
        </label>

        <label>
          Senha
          <div className="nxAuthInput">
            <span>⌁</span>
            <input type={showPassword ? "text" : "password"} required minLength={6} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
            <button type="button" onClick={() => setShowPassword(!showPassword)}>{showPassword ? "Ocultar" : "Mostrar"}</button>
          </div>
        </label>

        {message ? <div className={success ? "nxAuthMessage success" : "nxAuthMessage"}>{message}</div> : null}

        <button className="nxAuthSubmit" type="submit" disabled={busy}>
          {busy ? "Aguarde..." : mode === "login" ? "Entrar na NexusGames" : "Criar minha conta"} <b>→</b>
        </button>
      </form>

      <div className="nxAuthSecure">
        <span>🔒</span>
        <p>Seus dados de login são protegidos e sua senha não fica armazenada no site.</p>
      </div>

      <a className="nxAuthBack" href="/">← Voltar para a loja</a>
    </div>
  );
}
