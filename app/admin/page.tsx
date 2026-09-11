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
      setResult([data.message, ...(data.changes?.length ? data.changes : ["Nenhuma alteração era necessária."])].join("\n"));
    } catch (error) {
      setResult(error instanceof Error ? `Erro: ${error.message}` : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  async function syncSupplier() {
    setLoading(true);
    setResult("");
    try {
      const response = await fetch("/api/supplier/sync", {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" }
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        const missing = Array.isArray(data.required) ? ` Faltando: ${data.required.join(", ")}` : "";
        throw new Error(`${data.reason || "Falha ao sincronizar fornecedor"}.${missing}`);
      }
      setResult([
        "SHOP2TOPUP sincronizada com sucesso.",
        `Produtos lidos: ${data.scanned}`,
        `Opções NexusGames: ${data.options}`,
        `Correspondências encontradas: ${data.matched}`
      ].join("\n"));
    } catch (error) {
      setResult(error instanceof Error ? `Erro: ${error.message}` : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  async function launchMlbb() {
    setLoading(true);
    setResult("");
    try {
      const response = await fetch("/api/admin/mlbb-launch", {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" }
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Falha ao lançar Mobile Legends");
      setResult([
        "🔥 Mobile Legends publicado no Discord.",
        ...(Array.isArray(data.changes) ? data.changes : []),
        data.channelId ? `Canal: ${data.channelId}` : ""
      ].filter(Boolean).join("\n"));
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
        <h1>Painel NexusGames</h1>
        <p>Controle o Discord, o catálogo do fornecedor e as campanhas da loja sem instalar nada no computador.</p>

        <label htmlFor="secret">Senha de setup</label>
        <input
          id="secret"
          type="password"
          value={secret}
          onChange={(event) => setSecret(event.target.value)}
          placeholder="Digite a senha configurada na Vercel"
        />

        <button onClick={launchMlbb} disabled={loading || !secret}>
          {loading ? "Processando..." : "🔥 Publicar oferta Mobile Legends"}
        </button>

        <button onClick={syncSupplier} disabled={loading || !secret}>
          {loading ? "Processando..." : "Sincronizar SHOP2TOPUP"}
        </button>

        <button onClick={runSetup} disabled={loading || !secret}>
          {loading ? "Processando..." : "Atualizar estrutura completa do Discord"}
        </button>

        {result && <pre className="setupResult">{result}</pre>}
      </section>
    </main>
  );
}
