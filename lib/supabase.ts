type NexusUser = {
  id: string;
  discord_user_id: string;
  discord_username: string | null;
};

export type NexusOrder = {
  id?: string;
  order_number: string;
  product_id: string;
  quantity: number;
  unit_price_brl: number | string;
  total_price_brl: number | string;
  status: string;
  created_at: string;
};

function supabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error("Supabase ainda não está configurado na Vercel.");
  }

  return { url, secretKey };
}

async function supabaseRequest<T>(path: string, init: RequestInit = {}) {
  const { url, secretKey } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: secretKey,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers || {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase ${response.status}: ${text.slice(0, 300)}`);
  }

  if (response.status === 204) return null as T;
  return (await response.json()) as T;
}

export async function checkDatabaseConnection() {
  await supabaseRequest<Array<{ id: string }>>("products?select=id&limit=1");
  return true;
}

export async function ensureDiscordUser(
  discordUserId: string,
  discordUsername?: string | null
) {
  const users = await supabaseRequest<NexusUser[]>(
    "users?on_conflict=discord_user_id",
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        discord_user_id: discordUserId,
        discord_username: discordUsername || null,
        updated_at: new Date().toISOString()
      })
    }
  );

  const user = users?.[0];
  if (!user) throw new Error("Não foi possível registrar o usuário no banco.");
  return user;
}

async function findOrderByIdempotencyKey(idempotencyKey: string) {
  const rows = await supabaseRequest<NexusOrder[]>(
    `orders?select=id,order_number,product_id,quantity,unit_price_brl,total_price_brl,status,created_at&idempotency_key=eq.${encodeURIComponent(
      idempotencyKey
    )}&limit=1`
  );
  return rows?.[0] || null;
}

export async function createDiscordOrder(params: {
  discordUserId: string;
  discordUsername?: string | null;
  productId: string;
  interactionId: string;
}) {
  const idempotencyKey = `discord:${params.interactionId}`;
  const existing = await findOrderByIdempotencyKey(idempotencyKey);
  if (existing) return { order: existing, created: false };

  const user = await ensureDiscordUser(
    params.discordUserId,
    params.discordUsername
  );

  try {
    const rows = await supabaseRequest<NexusOrder[]>("orders", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        user_id: user.id,
        product_id: params.productId,
        quantity: 1,
        unit_price_brl: 0,
        total_price_brl: 0,
        status: "CREATED",
        idempotency_key: idempotencyKey
      })
    });

    const order = rows?.[0];
    if (!order) throw new Error("Não foi possível criar o pedido.");
    return { order, created: true };
  } catch (error) {
    // Se o Discord reenviar a mesma interação, a chave única evita pedido duplicado.
    const duplicate = await findOrderByIdempotencyKey(idempotencyKey);
    if (duplicate) return { order: duplicate, created: false };
    throw error;
  }
}

export async function listDiscordOrders(discordUserId: string, limit = 5) {
  const users = await supabaseRequest<Array<{ id: string }>>(
    `users?select=id&discord_user_id=eq.${encodeURIComponent(discordUserId)}&limit=1`
  );

  const user = users?.[0];
  if (!user) return [];

  return supabaseRequest<NexusOrder[]>(
    `orders?select=id,order_number,product_id,quantity,unit_price_brl,total_price_brl,status,created_at&user_id=eq.${encodeURIComponent(
      user.id
    )}&order=created_at.desc&limit=${Math.max(1, Math.min(limit, 10))}`
  );
}
