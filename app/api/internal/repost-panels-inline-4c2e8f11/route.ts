const DISCORD_API = "https://discord.com/api/v10";
const GUILD_ID = "1547332734794334319";
const STORE_URL = "https://nexusgames-cloud-main.vercel.app";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DiscordChannel = { id: string; name: string; type: number };
type DiscordMessage = { id: string; author?: { bot?: boolean }; embeds?: Array<{ title?: string; footer?: { text?: string } }> };
type PanelConfig = { channelName: string; marker: string; imageName: string; title: string; description: string; components?: Array<Record<string, unknown>> };

function botToken(){ const v=process.env.DISCORD_BOT_TOKEN; if(!v) throw new Error("DISCORD_BOT_TOKEN nao configurado"); return v; }
async function discordJson(path:string){ const r=await fetch(`${DISCORD_API}${path}`,{headers:{Authorization:`Bot ${botToken()}`},cache:"no-store"}); if(!r.ok) throw new Error(`Discord GET ${r.status}: ${await r.text()}`); return r.json(); }

async function postInline(channelId:string, oldMessageId:string|null, config:PanelConfig){
  const ir=await fetch(`${STORE_URL}/assets-jpg/${config.imageName}?inline-jpg=20260910-4`,{cache:"no-store"});
  if(!ir.ok) throw new Error(`Banner JPG ${config.imageName} HTTP ${ir.status}`);
  const bytes=await ir.arrayBuffer();
  const filename=`NexusGames-${config.imageName}-final.jpg`;
  const payload:any={
    allowed_mentions:{parse:[]},
    attachments:[{id:0,filename,description:`Banner ${config.title} - NexusGames`}],
    embeds:[{color:0x7c3aed,title:config.title,description:config.description,image:{url:`attachment://${filename}`},footer:{text:`NexusGames • canal:${config.marker}`}}],
    ...(config.components?{components:config.components}:{})
  };
  const form=new FormData();
  form.append("payload_json",JSON.stringify(payload));
  form.append("files[0]",new Blob([bytes],{type:"image/jpeg"}),filename);
  const r=await fetch(`${DISCORD_API}/channels/${channelId}/messages`,{method:"POST",headers:{Authorization:`Bot ${botToken()}`},body:form,cache:"no-store"});
  const text=await r.text();
  if(!r.ok) throw new Error(`Discord POST ${r.status}: ${text.slice(0,500)}`);
  const created=JSON.parse(text);
  if(oldMessageId&&oldMessageId!==created.id){ await fetch(`${DISCORD_API}/channels/${channelId}/messages/${oldMessageId}`,{method:"DELETE",headers:{Authorization:`Bot ${botToken()}`},cache:"no-store"}).catch(()=>null); }
  return {ok:true,messageId:created.id,attachmentCount:Array.isArray(created.attachments)?created.attachments.length:0,embedImage:created.embeds?.[0]?.image?.url||null,attachmentUrl:created.attachments?.[0]?.url||null};
}

function buyButton(customId:string,label:string){return [{type:1,components:[{type:2,style:3,custom_id:customId,label,emoji:{name:"🛒"}}]}];}
function productDescription(text:string){return [text,"","✅ categoria disponível para pedido","🔎 preço, região e estoque serão confirmados antes do pagamento real","🔐 entrega privada após confirmação","","Clique abaixo para iniciar sua compra."].join("\n");}

const panels:PanelConfig[]=[
{channelName:"⚡・ofertas",marker:"offers-v1",imageName:"ofertas",title:"⚡ Ofertas NexusGames",description:"Promoções, descontos e oportunidades especiais aparecem aqui. Quando uma oferta estiver ativa, confira produto, região e validade antes de comprar."},
{channelName:"🎟️・suporte",marker:"support-panel-v1",imageName:"suporte",title:"🎟️ Central de Suporte NexusGames",description:["Precisa de ajuda com uma compra, pagamento, entrega ou produto?","","Clique no botão abaixo para criar um **ticket privado**.","Somente você e a administração do servidor poderão acompanhar o atendimento.","","Antes de abrir um ticket, tenha em mãos o número do pedido caso já tenha realizado uma compra.","","🔐 Nunca envie senhas, token do Discord ou dados bancários completos."].join("\n"),components:[{type:1,components:[{type:2,style:1,custom_id:"support:create-ticket",label:"Abrir ticket",emoji:{name:"🎟️"}}]}]},
{channelName:"💳・steam",marker:"product-steam-v1",imageName:"steam",title:"💳 Steam",description:productDescription("Steam Wallet e produtos para PC."),components:buyButton("buy:steam-wallet","Comprar Steam Wallet")},
{channelName:"🪻・minecraft",marker:"product-minecraft-v1",imageName:"minecraft",title:"🪻 Minecraft",description:productDescription("Minecraft Java + Bedrock e produtos relacionados."),components:buyButton("buy:minecraft-java-bedrock","Comprar Minecraft")},
{channelName:"🎮・xbox",marker:"product-xbox-v1",imageName:"xbox",title:"🎮 Xbox / Game Pass",description:productDescription("Xbox, Game Pass e produtos digitais relacionados."),components:buyButton("buy:xbox-gamepass","Comprar Xbox / Game Pass")},
{channelName:"👾・roblox",marker:"product-roblox-v1",imageName:"roblox",title:"👾 Roblox / Robux",description:productDescription("Produtos Roblox disponíveis para pedido."),components:buyButton("buy:roblox","Comprar Roblox")},
{channelName:"🔮・valorant",marker:"product-valorant-v1",imageName:"valorant",title:"🔮 Valorant Points",description:productDescription("Valorant Points disponíveis para pedido."),components:buyButton("buy:valorant-points","Comprar Valorant Points")},
{channelName:"💠・playstation",marker:"product-playstation-v1",imageName:"playstation",title:"💠 PlayStation",description:productDescription("Produtos PlayStation disponíveis para pedido."),components:buyButton("buy:playstation-gift-card","Comprar PlayStation")}
];

export async function GET(){
 try{
  const channels=await discordJson(`/guilds/${GUILD_ID}/channels`) as DiscordChannel[];
  const results:any[]=[];
  for(const config of panels){
   const ch=channels.find(i=>i.type===0&&i.name===config.channelName);
   if(!ch){results.push({channel:config.channelName,ok:false,error:"canal nao encontrado"});continue;}
   const messages=await discordJson(`/channels/${ch.id}/messages?limit=50`) as DiscordMessage[];
   const markerText=`NexusGames • canal:${config.marker}`;
   const old=messages.find(i=>i.author?.bot&&i.embeds?.some(e=>e.footer?.text===markerText||e.title===config.title));
   try{results.push({channel:config.channelName,...await postInline(ch.id,old?.id||null,config)});}catch(error){results.push({channel:config.channelName,ok:false,error:error instanceof Error?error.message:"erro desconhecido"});}
  }
  return Response.json({ok:results.every(i=>i.ok),results});
 }catch(error){return Response.json({ok:false,error:error instanceof Error?error.message:"erro desconhecido"},{status:500});}
}
