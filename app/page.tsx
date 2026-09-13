import NexusStoreVisual from "./NexusStoreVisual";
import HeaderActions from "./HeaderActions";
import { products } from "../lib/catalog";
import { getLiveOptions } from "../lib/liveStore";

const img: Record<string,string> = {
  "mobile-legends": "https://sultra.disway.id/upload/250f57b3b1ebcb0945512ae3c2ac7ca0.jpg",
  playstation: "https://i5.walmartimages.com/seo/PlayStation-Store-50-Gift-Card_54093b0e-462f-4e5a-a74d-3067938b1628.f5ab47601f117e726a441e4edffbc312.jpeg?odnBg=FFFFFF&odnHeight=576&odnWidth=576",
  xbox: "https://cdkeyprices.com/images/cards/xbox-game-pass/xbox-game-pass-logo-2.jpg",
  minecraft: "https://cdn.mos.cms.futurecdn.net/v2/t%3A0%2Cl%3A448%2Ccw%3A1152%2Cch%3A1152%2Cq%3A80%2Cw%3A1152/rpPGiw7RjFaeJCCDBC4Bna.jpg",
  roblox: "https://partners.pay-card.shop/storage/2465/01K7D0JRVR34SQ5HN4M6YZR6AH.webp",
  valorant: "https://space-waves.co/data/image/game/valorant/valorant.png",
  steam: "https://images.prom.ua/5831357315_w640_h640_podarochnaya-karta-steam.jpg"
};

export const dynamic = "force-dynamic";

export default async function Home(){
  const discord = process.env.NEXT_PUBLIC_DISCORD_INVITE || "https://discord.gg/RDvDTVFwm";
  const live = await getLiveOptions().catch(()=>[]);
  const byCategory = new Map<string, number>();
  for(const row of live){
    const current = byCategory.get(row.option.categoryId);
    if(current===undefined || row.salePriceBrl<current) byCategory.set(row.option.categoryId,row.salePriceBrl);
  }

  const featured = live.slice(0,6).map((row)=>{
    const cat = products.find(p=>p.id===row.option.categoryId);
    return {
      id: row.option.id,
      catId: row.option.categoryId,
      category: cat?.name.replace("🔥 ","") || row.option.categoryId,
      name: row.option.label.replace(/\s*[—-]\s*R\$\s*[\d.,]+\s*$/i,"").trim(),
      price: row.salePriceBrl
    };
  });

  return (
    <main className="nxPage">
      <header className="nxHeader">
        <a href="/" className="nxLogo">
          <img src="/assets/nexus-logo" alt="NexusGames"/>
          <div><strong>NEXUS<span>GAMES</span></strong><small>PLAY MORE</small></div>
        </a>
        <nav className="nxNav">
          <a className="active" href="#inicio">Início</a>
          <a href="#categorias">Jogos</a>
          <a href="#produtos">Gift Cards</a>
          <a href="#como">Como funciona</a>
          <a href={discord}>Suporte</a>
        </nav>
        <a href="#produtos" className="nxSearch"><span>⌕</span><b>Buscar jogos, produtos...</b></a>
        <HeaderActions discord={discord} />
      </header>

      <section className="nxHero" id="inicio">
        <div className="nxHeroCopy">
          <span className="nxEyebrow">🎮 GAMES, GIFT CARDS E MUITO MAIS</span>
          <h1>JOGUE MAIS.<br/><em>PAGUE MENOS.</em></h1>
          <p>Seus jogos favoritos com entrega rápida, segura e os melhores preços do Brasil.</p>
          <div className="nxHeroBtns">
            <a className="nxPrimary" href="#produtos">Ver produtos <b>→</b></a>
            <a className="nxSecondary nxDiscordHeroButton" href={discord}><span className="nxDiscordHeroIcon"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19.5 5.34A16.3 16.3 0 0 0 15.44 4l-.5 1.02a15.3 15.3 0 0 0-5.87 0L8.56 4A16.5 16.5 0 0 0 4.5 5.35C1.94 9.16 1.25 12.87 1.6 16.53a16.4 16.4 0 0 0 4.98 2.51l1.2-1.66a10.5 10.5 0 0 1-1.89-.9l.46-.36c3.64 1.68 7.6 1.68 11.2 0l.47.36c-.61.36-1.24.66-1.9.9l1.2 1.66a16.4 16.4 0 0 0 4.98-2.51c.42-4.24-.72-7.92-2.8-11.19ZM8.6 14.7c-1.1 0-2-1.02-2-2.27 0-1.25.88-2.27 2-2.27s2.02 1.03 2 2.27c0 1.25-.89 2.27-2 2.27Zm6.8 0c-1.1 0-2-1.02-2-2.27 0-1.25.88-2.27 2-2.27s2.02 1.03 2 2.27c0 1.25-.88 2.27-2 2.27Z"/></svg></span>Entrar no Discord</a>
          </div>
          <div className="nxTrust">
            <span>⚡ Entrega instantânea</span>
            <span>🛡️ Pagamento seguro</span>
            <span>🎧 Suporte 24/7</span>
          </div>
        </div>

        <div className="nxHeroArt">
          <NexusStoreVisual compact />
        </div>
      </section>

      <section className="nxCategories" id="categorias">
        {products.map((p)=> {
          const price = byCategory.get(p.id);
          return (
            <a className="nxCat" href={price!==undefined?"/categoria/"+p.id:"#produtos"} key={p.id}>
              <img src={img[p.id] || "/assets/nexus-logo"} alt={p.name}/>
              <div className="nxCatShade"/>
              <div className="nxCatText">
                <strong>{p.name.replace("🔥 ","")}</strong>
                <small>{p.id==="mobile-legends"?"Recargas":p.id==="playstation"?"Gift Cards":p.id==="xbox"?"Gift Cards e Game Pass":p.id==="minecraft"?"Minecoins e Gift Cards":p.id==="roblox"?"Robux e Gift Cards":p.id==="valorant"?"Points (VP)":"Gift Cards"}</small>
              </div>
            </a>
          );
        })}
      </section>

      <section className="nxFeatured" id="produtos">
        <div className="nxSectionTitle">
          <div><span>━ &nbsp; OFERTAS EM DESTAQUE</span><h2>Mais vendidos</h2><p>Os produtos mais adquiridos pelos nossos clientes.</p></div>
          <a href="#categorias">Ver todos →</a>
        </div>

        <div className="nxProductGrid">
          {featured.length ? featured.map((item)=>(
            <a className="nxProduct" href={"/checkout?produto="+encodeURIComponent(item.id)} key={item.id}>
              <div className="nxProductImg"><img src={img[item.catId] || "/assets/nexus-logo"} alt={item.name}/></div>
              <div className="nxProductBody">
                <h3>{item.category}</h3>
                <p>{item.name}</p>
                <span className="nxDelivery">{item.catId==="mobile-legends"?"⚡ Entrega direta":"◉ Código digital"}</span>
                <small>A partir de</small>
                <div className="nxProductBottom"><strong>R$ {item.price.toFixed(2).replace(".",",")}</strong><b>🛒</b></div>
              </div>
            </a>
          )) : products.slice(0,6).map((p)=>(
            <a className="nxProduct" href={"/categoria/"+p.id} key={p.id}>
              <div className="nxProductImg"><img src={img[p.id] || "/assets/nexus-logo"} alt={p.name}/></div>
              <div className="nxProductBody">
                <h3>{p.name.replace("🔥 ","")}</h3><p>Produtos digitais</p><span className="nxDelivery">◉ Em breve</span><small>Catálogo</small>
                <div className="nxProductBottom"><strong>Ver opções</strong><b>→</b></div>
              </div>
            </a>
          ))}
        </div>
      </section>

      <section className="nxBenefits" id="como">
        <div><span>◈</span><div><b>Melhores preços</b><small>Do Brasil</small></div></div>
        <div><span>⚡</span><div><b>Entrega rápida</b><small>Em minutos</small></div></div>
        <div><span>🛡️</span><div><b>Pagamento seguro</b><small>Via Mercado Pago</small></div></div>
        <div><span>🎧</span><div><b>Suporte 24/7</b><small>Pelo Discord</small></div></div>
        <div><span>👥</span><div><b>Comunidade</b><small>NexusGames</small></div></div>
      </section>

      <section className="nxDiscordBanner">
        <div className="nxDiscordCopy">
          <span>━ &nbsp; ENTRE NO NOSSO DISCORD</span>
          <h2>FAÇA PARTE DA<br/>NOSSA COMUNIDADE</h2>
          <p>Suporte exclusivo, sorteios, promoções e muito mais!</p>
          <a href={discord}>◉ Entrar agora</a>
        </div>
        <div className="nxDiscordVisual nxDiscordVisualArt">
          <img src="/assets/community" alt="Comunidade NexusGames"/>
          <span className="tag t1">🎁 SORTEIOS<br/>EXCLUSIVOS</span>
          <span className="tag t2">🎧 SUPORTE<br/>24/7</span>
          <span className="tag t3">💟 PROMOÇÕES<br/>ANTECIPADAS</span>
        </div>
      </section>

      <footer className="nxFooter">
        <div className="nxFooterBrand">
          <a href="/" className="nxLogo"><img src="/assets/nexus-logo" alt="NexusGames"/><div><strong>NEXUS<span>GAMES</span></strong><small>PLAY MORE</small></div></a>
          <p>Games, gift cards e muito mais. Sua diversão em primeiro lugar.</p>
          <div className="nxSocial">◉ ◎ ♪ ▶</div>
        </div>
        <div><b>Navegação</b><a href="#inicio">Início</a><a href="#categorias">Jogos</a><a href="#produtos">Gift Cards</a><a href="#como">Como funciona</a><a href={discord}>Suporte</a></div>
        <div><b>Institucional</b><a href="#">Termos de uso</a><a href="#">Política de privacidade</a><a href="#">Trocas e reembolsos</a><a href={discord}>Contato</a></div>
        <div className="nxPayments"><b>Pagamento seguro</b><strong>mercado<br/>pago</strong><p>▰ VISA &nbsp; ◉ MC &nbsp; ◇ ELO &nbsp; ◈ PIX</p><small>⌘ Ambiente seguro e criptografado.</small></div>
      </footer>
      <div className="nxCopyright"><span>© 2026 NexusGames. Todos os direitos reservados.</span><span>Play More. ✦ NexusGames</span></div>
    </main>
  );
}
