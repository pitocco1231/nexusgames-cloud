const items = [
  { name: "PlayStation", image: "https://i5.walmartimages.com/seo/PlayStation-Store-50-Gift-Card_54093b0e-462f-4e5a-a74d-3067938b1628.f5ab47601f117e726a441e4edffbc312.jpeg?odnBg=FFFFFF&odnHeight=576&odnWidth=576", sub: "Gift Cards" },
  { name: "Xbox", image: "https://cdkeyprices.com/images/cards/xbox-game-pass/xbox-game-pass-logo-2.jpg", sub: "Game Pass" },
  { name: "Steam", image: "https://images.prom.ua/5831357315_w640_h640_podarochnaya-karta-steam.jpg", sub: "Wallet" },
  { name: "Valorant", image: "https://space-waves.co/data/image/game/valorant/valorant.png", sub: "Riot Points" },
  { name: "Mobile Legends", image: "https://sultra.disway.id/upload/250f57b3b1ebcb0945512ae3c2ac7ca0.jpg", sub: "Diamantes" },
  { name: "Roblox", image: "https://partners.pay-card.shop/storage/2465/01K7D0JRVR34SQ5HN4M6YZR6AH.webp", sub: "Robux" },
  { name: "Minecraft", image: "https://cdn.mos.cms.futurecdn.net/v2/t%3A0%2Cl%3A448%2Ccw%3A1152%2Cch%3A1152%2Cq%3A80%2Cw%3A1152/rpPGiw7RjFaeJCCDBC4Bna.jpg", sub: "Minecoins" }
];

export default function NexusStoreVisual({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`nexusStoreVisual ${compact ? "compact" : ""}`} aria-hidden="true">
      <div className="nsvGlow nsvGlowOne" />
      <div className="nsvGlow nsvGlowTwo" />
      <div className="nsvGrid" />

      <div className="nsvSign">
        <img src="/assets/nexus-logo" alt="" />
        <div><strong>NEXUS<span>GAMES</span></strong><small>GAMES • GIFT CARDS • RECARGAS</small></div>
      </div>

      <div className="nsvShelf">
        {items.map((item, index) => (
          <div className="nsvCard" style={{"--nsv-i": index} as React.CSSProperties} key={item.name}>
            <img src={item.image} alt="" />
            <div className="nsvCardShade" />
            <div className="nsvCardCopy"><b>{item.name}</b><small>{item.sub}</small></div>
          </div>
        ))}
      </div>

      <div className="nsvDesk">
        <div className="nsvController">🎮</div>
        <div className="nsvDeskLogo"><img src="/assets/nexus-logo" alt="" /><span>PLAY MORE</span></div>
        <div className="nsvStatus"><i /> LOJA ONLINE</div>
      </div>

      <div className="nsvPromise">
        <span>⚡ ENTREGA DIGITAL</span>
        <span>🔒 PAGAMENTO SEGURO</span>
        <span>🎧 SUPORTE</span>
      </div>
    </div>
  );
}
