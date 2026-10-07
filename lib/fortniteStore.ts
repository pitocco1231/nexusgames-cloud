const DISCORD_API = "https://discord.com/api/v10";
const GUILD_ID = "1547332734794334319";
const NEON = 0x7c3aed;

type Channel = {
  id: string;
  name: string;
  type: number;
  parent_id?: string | null;
  topic?: string | null;
};

type Message = {
  id: string;
  author?: { bot?: boolean };
  embeds?: Array<{ footer?: { text?: string } }>;
};

type ChannelConfig = {
  target: string;
  aliases: readonly string[];
  topic: string;
  type?: 0 | 2;
};

type GroupConfig = {
  target: string;
  aliases: readonly string[];
  channels: readonly ChannelConfig[];
};

function token() {
  const value = process.env.DISCORD_BOT_TOKEN;
  if (!value) throw new Error("DISCORD_BOT_TOKEN ausente");
  return value;
}

async function discord(path: string, init: RequestInit = {}) {
  const response = await fetch(`${DISCORD_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${token()}`,
      "Content-Type": "application/json",
      ...(init.headers || {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Discord ${response.status}: ${(await response.text()).slice(0, 500)}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

const GROUPS: readonly GroupConfig[] = [
  {
    target: "📌・𝗜𝗡𝗜𝗖𝗜𝗢",
    aliases: ["📌・𝗜𝗡𝗜𝗖𝗜𝗢"],
    channels: [
      { target: "✨・comece-aqui", aliases: ["✨・comece-aqui"], topic: "Comece aqui e entenda como funciona a NexusGames." },
      { target: "📜・regras", aliases: ["📜・regras"], topic: "Regras da comunidade, segurança e condições da loja." },
      { target: "🧭・como-funciona", aliases: ["🧭・como-funciona"], topic: "Fluxo completo: buscar, escolher, pagar, atendimento e entrega." },
      { target: "🛡️・termos-e-garantias", aliases: ["🛡️・termos-e-garantias"], topic: "Termos, garantias anunciadas e informações importantes antes da compra." },
      { target: "🟢・status-nexus", aliases: ["🟢・status-nexus"], topic: "Status do bot, buscas, pagamentos e atendimento NexusGames." }
    ]
  },
  {
    target: "🔎・𝗕𝗨𝗦𝗖𝗔𝗥 𝗖𝗢𝗡𝗧𝗔𝗦",
    aliases: ["🔎・𝗕𝗨𝗦𝗖𝗔𝗥 𝗖𝗢𝗡𝗧𝗔𝗦"],
    channels: [
      { target: "🔎・buscar-conta", aliases: ["🔎・buscar-conta"], topic: "Canal principal para pesquisar contas Fortnite por skin, picareta, emote, asa-delta e filtros." },
      { target: "🧩・como-pesquisar", aliases: ["🧩・como-pesquisar"], topic: "Exemplos e dicas para encontrar a conta certa usando os filtros Nexus." },
      { target: "🔥・contas-em-destaque", aliases: ["🔥・contas-em-destaque"], topic: "Melhores oportunidades encontradas pela NexusGames." },
      { target: "🆕・novas-contas", aliases: ["🆕・novas-contas"], topic: "Novas contas encontradas nos fornecedores autorizados." },
      { target: "🎯・procurando-conta", aliases: ["🎯・procurando-conta"], topic: "Salve o que você procura para ser avisado quando aparecer uma opção compatível." }
    ]
  },
  {
    target: "🛒・𝗖𝗢𝗠𝗣𝗥𝗔𝗦",
    aliases: ["🛒・𝗖𝗢𝗠𝗣𝗥𝗔𝗦"],
    channels: [
      { target: "📦・meus-pedidos", aliases: ["📦・meus-pedidos"], topic: "Acompanhe os seus pedidos NexusGames." },
      { target: "🛍️・como-comprar", aliases: ["🛍️・como-comprar"], topic: "Passo a passo da compra de uma conta pesquisada na Nexus." },
      { target: "💠・formas-de-pagamento", aliases: ["💠・formas-de-pagamento"], topic: "Formas de pagamento aceitas no checkout oficial." },
      { target: "💬・duvidas-de-compra", aliases: ["💬・duvidas-de-compra"], topic: "Dúvidas gerais antes de finalizar uma compra." }
    ]
  },
  {
    target: "⭐・𝗖𝗢𝗡𝗙𝗜𝗔𝗡𝗖𝗔",
    aliases: ["⭐・𝗖𝗢𝗡𝗙𝗜𝗔𝗡𝗖𝗔"],
    channels: [
      { target: "💜・avaliacoes", aliases: ["💜・avaliacoes"], topic: "Avaliações e experiências dos clientes NexusGames." },
      { target: "✅・vendas-realizadas", aliases: ["✅・vendas-realizadas"], topic: "Registro público e sem dados sensíveis de pedidos concluídos." },
      { target: "❓・faq", aliases: ["❓・faq"], topic: "Perguntas frequentes sobre pesquisa, pagamento, atendimento e entrega." },
      { target: "🎟️・suporte", aliases: ["🎟️・suporte"], topic: "Suporte geral da NexusGames." }
    ]
  },
  {
    target: "💬・𝗖𝗢𝗠𝗨𝗡𝗜𝗗𝗔𝗗𝗘",
    aliases: ["💬・𝗖𝗢𝗠𝗨𝗡𝗜𝗗𝗔𝗗𝗘"],
    channels: [
      { target: "💬・chat-geral", aliases: ["💬・chat-geral"], topic: "Conversa geral da comunidade NexusGames." },
      { target: "🎮・fortnite", aliases: ["🎮・fortnite"], topic: "Fortnite, novidades, temporadas e comunidade." },
      { target: "🎨・skins-e-lockers", aliases: ["🎨・skins-e-lockers"], topic: "Converse sobre skins, lockers, picaretas e cosméticos." },
      { target: "💡・sugestoes", aliases: ["💡・sugestoes"], topic: "Sugestões para melhorar a NexusGames." },
      { target: "🔊・geral", aliases: ["🔊・geral"], topic: "Canal de voz geral da comunidade.", type: 2 }
    ]
  },
  {
    target: "🎫・𝗧𝗜𝗖𝗞𝗘𝗧𝗦",
    aliases: ["🎫・𝗧𝗜𝗖𝗞𝗘𝗧𝗦"],
    channels: []
  },
  {
    target: "🔒・𝗔𝗗𝗠𝗜𝗡 𝗩𝗘𝗡𝗗𝗔𝗦",
    aliases: ["🔒・𝗔𝗗𝗠𝗜𝗡 𝗩𝗘𝗡𝗗𝗔𝗦"],
    channels: [
      { target: "💰・novas-vendas", aliases: ["💰・novas-vendas"], topic: "Pagamentos aprovados e pedidos aguardando ação dos admins." },
      { target: "🟡・pedidos-em-andamento", aliases: ["🟡・pedidos-em-andamento"], topic: "Pedidos com ticket aberto ou em preparação." },
      { target: "✅・pedidos-concluidos", aliases: ["✅・pedidos-concluidos"], topic: "Histórico administrativo de pedidos entregues." },
      { target: "↩️・reembolsos", aliases: ["↩️・reembolsos"], topic: "Pedidos cancelados, substituições e reembolsos." },
      { target: "🚨・alertas", aliases: ["🚨・alertas"], topic: "Alertas de oferta indisponível, preço alterado, pagamento ou atendimento pendente." }
    ]
  },
  {
    target: "🔒・𝗔𝗗𝗠𝗜𝗡 𝗙𝗢𝗥𝗡𝗘𝗖𝗘𝗗𝗢𝗥𝗘𝗦",
    aliases: ["🔒・𝗔𝗗𝗠𝗜𝗡 𝗙𝗢𝗥𝗡𝗘𝗖𝗘𝗗𝗢𝗥𝗘𝗦"],
    channels: [
      { target: "🌐・fornecedores", aliases: ["🌐・fornecedores"], topic: "Lista administrativa dos fornecedores autorizados." },
      { target: "🔗・links-fornecedores", aliases: ["🔗・links-fornecedores"], topic: "Links originais e referências privadas dos fornecedores." },
      { target: "📡・estoque-monitorado", aliases: ["📡・estoque-monitorado"], topic: "Monitoramento de ofertas, disponibilidade e alterações de preço." },
      { target: "⚠️・contas-com-problema", aliases: ["⚠️・contas-com-problema"], topic: "Ofertas bloqueadas, removidas ou que exigem revisão." },
      { target: "📈・precos-e-margens", aliases: ["📈・precos-e-margens"], topic: "Custos, preço Nexus, margem e limites internos." }
    ]
  },
  {
    target: "🔒・𝗔𝗗𝗠𝗜𝗡 𝗚𝗘𝗦𝗧𝗔𝗢",
    aliases: ["🔒・𝗔𝗗𝗠𝗜𝗡 𝗚𝗘𝗦𝗧𝗔𝗢"],
    channels: [
      { target: "🧠・painel", aliases: ["🧠・painel"], topic: "Painel central de operações da NexusGames." },
      { target: "📋・logs", aliases: ["📋・logs"], topic: "Logs do bot, tickets, buscas, pagamentos e ações administrativas." },
      { target: "⚙️・config-bot", aliases: ["⚙️・config-bot"], topic: "Configurações e controles administrativos do bot Nexus." },
      { target: "💭・sugestoes-clientes", aliases: ["💭・sugestoes-clientes"], topic: "Sugestões e feedbacks dos clientes para revisão da equipe." },
      { target: "📊・metricas", aliases: ["📊・metricas"], topic: "Vendas, ticket médio, margem, buscas e conversão." }
    ]
  }
] as const;

const PANELS = [
  {
    channel: "✨・comece-aqui",
    marker: "nexus-start-v3",
    title: "⚡ NEXUSGAMES // CONTAS FORTNITE",
    description: [
      "> Encontre a conta que você quer sem precisar procurar anúncio por anúncio.",
      "",
      "**COMO FUNCIONA**",
      "01 • pesquise por skin, picareta, emote ou outro cosmético",
      "02 • a Nexus mostra as melhores opções dentro do seu orçamento",
      "03 • escolha a conta e finalize o pagamento pelo fluxo oficial",
      "04 • após a confirmação, nossa equipe valida a oferta e inicia seu atendimento privado",
      "05 • seu ticket é aberto por um admin e a entrega acontece somente por lá",
      "",
      "💰 As opções exibidas podem chegar a **R$ 500**.",
      "🔐 Links, custos e fornecedores são informações internas da NexusGames."
    ].join("\n")
  },
  {
    channel: "🧭・como-funciona",
    marker: "nexus-flow-v3",
    title: "🧭 COMO FUNCIONA A NEXUS",
    description: [
      "**1. BUSCA** — escolha o cosmético e aplique seus filtros.",
      "**2. RESULTADOS** — veja preço Nexus, skins principais, quantidade de cosméticos, V-Bucks, condições de e-mail e imagens disponíveis.",
      "**3. COMPRA** — escolha a oferta e confirme o pedido.",
      "**4. PAGAMENTO** — use apenas o checkout oficial.",
      "**5. VALIDAÇÃO** — após o pagamento, a equipe confere novamente disponibilidade e condições da oferta.",
      "**6. TICKET** — um admin abre um canal privado apenas com você, admins e o bot.",
      "**7. ENTREGA** — os dados e orientações do pedido são enviados somente no ticket."
    ].join("\n")
  },
  {
    channel: "🔎・buscar-conta",
    marker: "nexus-search-v3",
    title: "🔎 BUSCADOR NEXUS",
    description: [
      "> Este é o canal principal para encontrar contas Fortnite.",
      "",
      "Você poderá pesquisar por:",
      "• skin",
      "• picareta",
      "• emote",
      "• asa-delta",
      "• quantidade de skins",
      "• V-Bucks",
      "• possibilidade de alteração de e-mail",
      "• orçamento de até **R$ 500**",
      "",
      "A Nexus mostra somente as melhores opções que passam pelos filtros internos de preço e fornecedor.",
      "",
      "⚙️ O comando de busca será ativado neste canal durante a implantação do buscador."
    ].join("\n")
  },
  {
    channel: "🧩・como-pesquisar",
    marker: "nexus-search-help-v3",
    title: "🧩 COMO PESQUISAR",
    description: [
      "**Exemplos do que você poderá pedir:**",
      "• Travis Scott até R$ 300",
      "• Travis Scott + Kratos",
      "• Leviathan Axe até R$ 400",
      "• conta com +100 skins e e-mail alterável",
      "• melhor conta possível até R$ 500",
      "",
      "💡 Quando houver várias opções, a Nexus prioriza custo-benefício, qualidade da conta e segurança do fornecedor."
    ].join("\n")
  },
  {
    channel: "🛍️・como-comprar",
    marker: "nexus-buy-v3",
    title: "🛍️ COMO COMPRAR",
    description: [
      "**1.** Pesquise em **🔎・buscar-conta**.",
      "**2.** Abra os detalhes da opção que você gostou e confira as imagens.",
      "**3.** Clique em comprar e revise o resumo da conta.",
      "**4.** Faça o pagamento pelo checkout oficial.",
      "**5.** Após a aprovação, seu pedido entra na fila administrativa.",
      "**6.** Um admin valida a oferta e abre seu ticket privado.",
      "**7.** A entrega e qualquer suporte acontecem dentro do ticket.",
      "",
      "⚠️ A oferta pode ser vendida pelo fornecedor enquanto o pagamento é processado. Se isso ocorrer, a equipe apresenta alternativas ou trata o reembolso."
    ].join("\n")
  },
  {
    channel: "🛡️・termos-e-garantias",
    marker: "nexus-terms-v3",
    title: "🛡️ TERMOS & GARANTIAS",
    description: [
      "• Cada oferta deve mostrar exatamente as condições conhecidas antes do pagamento.",
      "• Garantia só existe quando estiver informada no pedido/ticket.",
      "• A equipe pode substituir uma oferta se ela ficar indisponível antes da compra no fornecedor.",
      "• Nunca envie senha, token, código 2FA ou dados bancários em canal público.",
      "• A Nexus não aceita fornecedores ou ofertas identificados como provenientes de invasão, phishing, stealer ou outro acesso não autorizado.",
      "",
      "⚠️ A Epic proíbe compra, venda e transferência de contas em seus termos. Isso pode gerar restrições ou perda de acesso; esse risco precisa ser considerado antes da compra."
    ].join("\n")
  },
  {
    channel: "❓・faq",
    marker: "nexus-faq-v3",
    title: "❓ FAQ",
    description: [
      "**Recebo a conta imediatamente?**",
      "Não necessariamente. Depois do pagamento, a equipe valida a oferta e abre seu atendimento privado.",
      "",
      "**Onde recebo os dados?**",
      "Somente no ticket privado criado por um admin.",
      "",
      "**Consigo ver as skins antes de comprar?**",
      "Sim. Quando o fornecedor disponibilizar imagens, elas serão exibidas nos detalhes/carrinho da oferta.",
      "",
      "**Consigo procurar uma skin específica?**",
      "Sim. O buscador será focado exatamente nisso.",
      "",
      "**Qual o preço máximo das opções?**",
      "A busca pública será limitada a ofertas Nexus de até R$ 500.",
      "",
      "**Posso ver o fornecedor?**",
      "Não. Links, custos e identidade do fornecedor ficam restritos à equipe."
    ].join("\n")
  },
  {
    channel: "🎟️・suporte",
    marker: "nexus-support-v3",
    title: "🎟️ SUPORTE NEXUS",
    description: [
      "> Use este canal para dúvidas gerais ou problemas com um pedido.",
      "",
      "Pedidos pagos terão um **ticket de compra aberto pela equipe administrativa**.",
      "Não é necessário abrir outro ticket enquanto seu pedido estiver aguardando atendimento.",
      "",
      "🔐 Nunca publique credenciais ou dados privados fora do ticket."
    ].join("\n")
  },
  {
    channel: "💰・novas-vendas",
    marker: "nexus-admin-sales-v3",
    title: "💰 NOVAS VENDAS // ADMIN",
    description: [
      "> Canal privado para pedidos com pagamento aprovado.",
      "",
      "Cada venda deverá mostrar:",
      "• número do pedido",
      "• nome e @ do cliente",
      "• Discord ID",
      "• Nexus ID da conta",
      "• valor pago",
      "• custo do fornecedor",
      "• margem estimada",
      "• link privado do fornecedor",
      "• status",
      "",
      "O card da venda terá o botão **ABRIR TICKET**. Ao clicar, o bot cria um canal privado somente com o cliente, admins e o próprio bot."
    ].join("\n")
  },
  {
    channel: "🌐・fornecedores",
    marker: "nexus-admin-suppliers-v3",
    title: "🌐 FORNECEDORES // ADMIN",
    description: [
      "> Controle interno dos fornecedores autorizados pela NexusGames.",
      "",
      "Aqui ficam IDs, observações, reputação interna e status de cada fornecedor.",
      "Links originais e preços de custo nunca devem aparecer em canais públicos."
    ].join("\n")
  }
] as const;

function matches(name: string, aliases: readonly string[]) {
  return aliases.includes(name);
}

async function ensureCategory(existing: Channel[], target: string, aliases: readonly string[]) {
  let category = existing.find((channel) => channel.type === 4 && matches(channel.name, aliases));

  if (!category) {
    category = await discord(`/guilds/${GUILD_ID}/channels`, {
      method: "POST",
      body: JSON.stringify({ name: target, type: 4 })
    }) as Channel;
    existing.push(category);
  } else if (category.name !== target) {
    category = await discord(`/channels/${category.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: target })
    }) as Channel;
  }

  return category;
}

async function ensureChannel(existing: Channel[], parentId: string, config: ChannelConfig) {
  const desiredType = config.type ?? 0;
  let channel = existing.find((candidate) => candidate.type === desiredType && matches(candidate.name, config.aliases));

  if (!channel) {
    channel = await discord(`/guilds/${GUILD_ID}/channels`, {
      method: "POST",
      body: JSON.stringify({
        name: config.target,
        type: desiredType,
        parent_id: parentId,
        ...(desiredType === 0 ? { topic: config.topic } : {})
      })
    }) as Channel;
    existing.push(channel);
    return channel;
  }

  const changes: Record<string, unknown> = {};
  if (channel.name !== config.target) changes.name = config.target;
  if (channel.parent_id !== parentId) changes.parent_id = parentId;
  if (desiredType === 0 && channel.topic !== config.topic) changes.topic = config.topic;

  if (Object.keys(changes).length) {
    channel = await discord(`/channels/${channel.id}`, {
      method: "PATCH",
      body: JSON.stringify(changes)
    }) as Channel;
  }

  return channel;
}

async function ensurePanel(channelId: string, config: typeof PANELS[number]) {
  const messages = await discord(`/channels/${channelId}/messages?limit=50`) as Message[];
  const markerText = `NexusGames • canal:${config.marker}`;
  const managed = messages.filter(
    (message) =>
      message.author?.bot &&
      message.embeds?.some((embed) => String(embed.footer?.text || "").startsWith("NexusGames • canal:"))
  );

  const payload = {
    allowed_mentions: { parse: [] },
    embeds: [{
      color: NEON,
      title: config.title,
      description: config.description,
      footer: { text: markerText }
    }]
  };

  if (managed[0]) {
    await discord(`/channels/${channelId}/messages/${managed[0].id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });

    for (const duplicate of managed.slice(1)) {
      await discord(`/channels/${channelId}/messages/${duplicate.id}`, {
        method: "DELETE"
      }).catch(() => null);
    }
    return;
  }

  await discord(`/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function migrateToFortniteAccountStore() {
  const existing = await discord(`/guilds/${GUILD_ID}/channels`) as Channel[];
  const channelIds = new Map<string, string>();
  const changes: string[] = [];

  for (const group of GROUPS) {
    const category = await ensureCategory(existing, group.target, group.aliases);
    changes.push(`Categoria pronta: ${group.target}`);

    for (const config of group.channels) {
      const channel = await ensureChannel(existing, category.id, config);
      channelIds.set(config.target, channel.id);
      changes.push(`Canal pronto: #${config.target}`);
    }
  }

  for (const panel of PANELS) {
    const channelId = channelIds.get(panel.channel);
    if (!channelId) continue;
    await ensurePanel(channelId, panel);
    changes.push(`Painel aplicado: #${panel.channel}`);
  }

  return changes;
}

export async function getFortniteStoreNavigation() {
  const channels = await discord(`/guilds/${GUILD_ID}/channels`) as Channel[];
  const items = [
    { key: "buscar", label: "Buscar conta", emoji: "🔎", names: ["🔎・buscar-conta"] },
    { key: "destaques", label: "Contas em destaque", emoji: "🔥", names: ["🔥・contas-em-destaque"] },
    { key: "novas", label: "Novas contas", emoji: "🆕", names: ["🆕・novas-contas"] },
    { key: "procurando", label: "Procurando conta", emoji: "🎯", names: ["🎯・procurando-conta"] },
    { key: "pedidos", label: "Meus pedidos", emoji: "📦", names: ["📦・meus-pedidos"] }
  ];

  return items.map((item) => {
    const channel = channels.find((candidate) => candidate.type === 0 && item.names.includes(candidate.name));
    return {
      ...item,
      channelId: channel?.id || null,
      mention: channel ? `<#${channel.id}>` : item.label
    };
  });
}
