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
  const [userEmail, setUserEmail] = useState("");

  async function loadUser() {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await res.json();
      setUserEmail(data?.email || "");
    } catch {}
  }

  useEffect(() => { loadUser(); }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUserEmail("");
    window.location.href = "/";
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
        <a className="nxLoginButton nxLoginLink" href="/login">
          <span className="nxUserOutline">♙</span>
          <div><b>Entrar</b><small>Minha conta</small></div>
        </a>
      )}
    </div>
  );
}
