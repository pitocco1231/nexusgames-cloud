const categories = [
  ["💳", "Steam", "Wallet e jogos digitais"],
  ["🟩", "Minecraft", "Java + Bedrock e produtos oficiais"],
  ["🎮", "Xbox", "Gift cards e Game Pass"],
  ["🔫", "Valorant", "VP quando houver fornecedor autorizado"],
  ["🔴", "Roblox", "Robux somente por canal autorizado"],
  ["🔵", "PlayStation", "Produtos compativeis com a regiao"]
];

export default function Home() {
  const discordInvite = process.env.NEXT_PUBLIC_DISCORD_INVITE || "#";

  return (
    <main>
      <header className="nav">
        <div className="brand"><span>N</span> NexusGames</div>
        <a className="navLink" href={discordInvite}>Discord</a>
      </header>

      <section className="hero">
        <div className="heroGlow" />
        <span className="eyebrow">LOJA GAMER DIGITAL</span>
        <h1>Compre. Receba.<br /><strong>Jogue.</strong></h1>
        <p>
          A NexusGames esta construindo uma experiencia de compra de produtos digitais com verificacao de estoque,
          pagamento e entrega automatizada pelo Discord.
        </p>
        <div className="heroActions">
          <a className="primaryButton" href={discordInvite}>Entrar no Discord</a>
          <a className="secondaryButton" href="#catalogo">Ver catalogo</a>
        </div>
        <div className="statusPill"><i /> Sistema em implantacao</div>
      </section>

      <section className="featureStrip">
        <div><b>⚡</b><span><strong>Entrega rapida</strong><small>Fluxo automatizado</small></span></div>
        <div><b>🔐</b><span><strong>Compra protegida</strong><small>Validacao antes da entrega</small></span></div>
        <div><b>🎮</b><span><strong>Multiplos jogos</strong><small>Um unico servidor</small></span></div>
        <div><b>💬</b><span><strong>Suporte no Discord</strong><small>Historico do pedido</small></span></div>
      </section>

      <section className="catalog" id="catalogo">
        <div className="sectionHeader">
          <span className="eyebrow">CATALOGO</span>
          <h2>Um servidor. Varios universos.</h2>
          <p>Os produtos entram na loja somente quando houver disponibilidade e condicoes seguras de revenda.</p>
        </div>
        <div className="categoryGrid">
          {categories.map(([emoji, title, text]) => (
            <article className="categoryCard" key={title}>
              <div className="categoryIcon">{emoji}</div>
              <h3>{title}</h3>
              <p>{text}</p>
              <span>Em preparacao →</span>
            </article>
          ))}
        </div>
      </section>

      <section className="howItWorks">
        <div className="sectionHeader">
          <span className="eyebrow">COMO VAI FUNCIONAR</span>
          <h2>Da escolha ate a entrega.</h2>
        </div>
        <div className="steps">
          <div><b>01</b><h3>Escolha</h3><p>Selecione o produto pelo bot da NexusGames.</p></div>
          <div><b>02</b><h3>Validacao</h3><p>O sistema verifica estoque, regiao e preco do fornecedor.</p></div>
          <div><b>03</b><h3>Pagamento</h3><p>O checkout e liberado somente quando o pedido puder ser atendido.</p></div>
          <div><b>04</b><h3>Entrega</h3><p>O codigo e entregue de forma privada e fica vinculado ao pedido.</p></div>
        </div>
      </section>

      <footer>
        <div className="brand"><span>N</span> NexusGames</div>
        <p>Produtos digitais. Operacao em fase de implantacao.</p>
      </footer>
    </main>
  );
}
