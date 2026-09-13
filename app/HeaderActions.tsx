"use client";

import { useEffect, useState } from "react";

function DiscordIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M19.5 5.34A16.3 16.3 0 0 0 15.44 4l-.5 1.02a15.3 15.3 0 0 0-5.87 0L8.56 4A16.5 16.5 0 0 0 4.5 5.35C1.94 9.16 1.25 12.87 1.6 16.53a16.4 16.4 0 0 0 4.98 2.51l1.2-1.66a10.5 10.5 0 0 1-1.89-.9l.46-.36c3.64 1.68 7.6 1.68 11.2 0l.47.36c-.61.36-1.24.66-1.9.9l1.2 1.66a16.4 16.4 0 0 0 4.98-2.51c.42-4.24-.72-7.92-2.8-11.19ZM8.6 14.7c-1.1 0-2-1.02-2-2.27 0-1.25.88-2.27 2-2.27s2.02 1.03 2 2.27c0 1.25-.89 2.27-2 2.27Zm6.8 0c-1.1 0-2-1.02-2-2.27 0-1.25.88-2.27 2-2.27s2.02 1.03 2 2.27c0 1.25-.88 2.27-2 2.27Z"/>
    </svg>
  );
}

export default function HeaderActions({ discord }: { discord: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadUser() {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await res.json();
      setUserEmail(data?.email || "");
    } catch {}
  }

  useEffect(() => { loadUser(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, mode })
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.message || "Não foi possível continuar.");
        return;
      }
      if (data?.requiresConfirmation) {
        setMessage("Conta criada. Confira seu e-mail para confirmar o cadastro.");
        return;
      }
      setOpen(false);
      setPassword("");
      await loadUser();
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUserEmail("");
  }

  return (
    <div className="nxHeaderActions">
      <a className="nxDiscordMini nxDiscordOfficial" href={discord} target="_blank" rel="noreferrer">
        <span className="nxDiscordIcon"><DiscordIcon /></span>
        <div><b>Discord</b><small>Suporte 24/7</small></div>
      </a>

      {userEmail ? (
        <button className="nxLoginButton logged" onClick={logout}>
          <span className="nxUserAvatar">{userEmail.slice(0,1).toUpperCase()}</span>
          <div><b>{userEmail.split("@")[0]}</b><small>Sair da conta</small></div>
        </button>
      ) : (
        <button className="nxLoginButton" onClick={() => setOpen(true)}>
          <span className="nxUserOutline">♙</span>
          <div><b>Entrar</b><small>Minha conta</small></div>
        </button>
      )}

      {open ? (
        <div className="nxLoginOverlay" onMouseDown={(e) => { if (e.currentTarget === e.target) setOpen(false); }}>
          <div className="nxLoginModal">
            <button className="nxLoginClose" onClick={() => setOpen(false)}>×</button>
            <img src="/assets/nexus-logo" alt="NexusGames" />
            <span>NEXUSGAMES</span>
            <h2>{mode === "login" ? "Bem-vindo de volta." : "Crie sua conta."}</h2>
            <p>{mode === "login" ? "Entre para acompanhar seus pedidos." : "Cadastre-se para ter uma experiência mais rápida."}</p>

            <form onSubmit={submit}>
              <label>E-mail<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" /></label>
              <label>Senha<input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" /></label>
              {message ? <div className="nxLoginMessage">{message}</div> : null}
              <button type="submit" disabled={busy}>{busy ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}</button>
            </form>

            <button className="nxSwitchMode" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMessage(""); }}>
              {mode === "login" ? "Ainda não tem conta? Criar conta" : "Já tem conta? Entrar"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
