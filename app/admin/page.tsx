"use client";

import { useState } from "react";

export default function AdminSetupPage() {
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");

  async function runSetup() {
    setLoading(true);
    setResult("");

    try {
      const response = await fetch("/api/admin/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret })
      });

      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Falha no setup");

      setResult(
        [data.message, ...(data.changes?.length ? data.changes : ["Nenhuma alteracao era necessaria."])].join("\n")
      );
    } catch (error) {
      setResult(error instanceof Error ? `Erro: ${error.message}` : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="adminShell">
      <section className="adminCard">
        <span className="eyebrow">NEXUSGAMES CLOUD</span>
        <h1>Setup do Discord</h1>
        <p>
          Esta pagina registra os comandos e cria a estrutura inicial do servidor sem precisar instalar nada no computador.
        </p>

        <label htmlFor="secret">Senha de setup</label>
        <input
          id="secret"
          type="password"
          value={secret}
          onChange={(event) => setSecret(event.target.value)}
          placeholder="Digite a senha configurada na Vercel"
        />

        <button onClick={runSetup} disabled={loading || !secret}>
          {loading ? "Configurando..." : "Configurar servidor"}
        </button>

        {result && <pre className="setupResult">{result}</pre>}
      </section>
    </main>
  );
}
