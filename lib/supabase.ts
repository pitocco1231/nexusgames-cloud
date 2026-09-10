type NexusUser = {
  id: string;
  discord_user_id: string;
  discord_username: string | null;
  is_customer?: boolean;
};

export type NexusOrder = {
  id?: string;
  user_id?: string;
  order_number: string;
  product_id: string;
  quantity: number;
  unit_price_brl: number | string;
  total_price_brl: number | string;
  status: string;
  created_at: string;
  paid_at?: string | null;
};

export type NexusPayment = {
  id: string;
  order_id: string;
  provider: string;
  provider_payment_id: string | null;
  amount_brl: number | string;
  status: string;
  pix_qr_code: string | null;
  pix_copy_paste: string | null;
  raw_payload: Record<string, unknown>;
  created_at: string;
};

type MercadoPagoOrderLike = {
  id: string;
  external_reference?: string;
  total_amount?: string;
  status?: string;
  status_detail?: string;
  transactions?: {
    payments?: Array<{
      id?: string;
      amount?: string;
      status?: string;
      status_detail?: string;
      payment_method?: {
        ticket_url?: string;
        qr_code?: string;
      };
    }>;
  };
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

const ORDER_SELECT =
  "id,user_id,order_number,product_id,quantity,unit_price_brl,total_price_brl,status,created_at,paid_at";

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
    `orders?select=${ORDER_SELECT}&idempotency_key=eq.${encodeURIComponent(
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

async function findDiscordUser(discordUserId: string) {
  const users = await supabaseRequest<NexusUser[]>(
    `users?select=id,discord_user_id,discord_username,is_customer&discord_user_id=eq.${encodeURIComponent(
      discordUserId
    )}&limit=1`
  );
  return users?.[0] || null;
}

export async function findDiscordOrderByNumber(
  discordUserId: string,
  orderNumber: string
) {
  const user = await findDiscordUser(discordUserId);
  if (!user) return null;

  const rows = await supabaseRequest<NexusOrder[]>(
    `orders?select=${ORDER_SELECT}&user_id=eq.${encodeURIComponent(
      user.id
    )}&order_number=eq.${encodeURIComponent(orderNumber)}&limit=1`
  );
  return rows?.[0] || null;
}

export async function listDiscordOrders(discordUserId: string, limit = 5) {
  const user = await findDiscordUser(discordUserId);
  if (!user) return [];

  return supabaseRequest<NexusOrder[]>(
    `orders?select=${ORDER_SELECT}&user_id=eq.${encodeURIComponent(
      user.id
    )}&order=created_at.desc&limit=${Math.max(1, Math.min(limit, 10))}`
  );
}

export async function getMercadoPagoPaymentForOrder(orderId: string) {
  const rows = await supabaseRequest<NexusPayment[]>(
    `payments?select=id,order_id,provider,provider_payment_id,amount_brl,status,pix_qr_code,pix_copy_paste,raw_payload,created_at&order_id=eq.${encodeURIComponent(
      orderId
    )}&provider=eq.mercado_pago&order=created_at.desc&limit=1`
  );
  return rows?.[0] || null;
}

async function getMercadoPagoPaymentByProviderOrderId(providerOrderId: string) {
  const rows = await supabaseRequest<NexusPayment[]>(
    `payments?select=id,order_id,provider,provider_payment_id,amount_brl,status,pix_qr_code,pix_copy_paste,raw_payload,created_at&provider=eq.mercado_pago&provider_payment_id=eq.${encodeURIComponent(
      providerOrderId
    )}&limit=1`
  );
  return rows?.[0] || null;
}

export async function attachMercadoPagoSandboxOrder(params: {
  localOrder: NexusOrder;
  providerOrder: MercadoPagoOrderLike;
}) {
  if (!params.localOrder.id) {
    throw new Error("Pedido local sem ID para vincular o Pix.");
  }

  const providerOrderId = params.providerOrder.id;
  if (!providerOrderId) {
    throw new Error("Mercado Pago não retornou o ID da order.");
  }

  const payment = params.providerOrder.transactions?.payments?.[0];
  const amount = Number(params.providerOrder.total_amount || payment?.amount || 50);
  const qrCode = payment?.payment_method?.qr_code || null;
  const now = new Date().toISOString();
  const existing = await getMercadoPagoPaymentByProviderOrderId(providerOrderId);

  const paymentBody = {
    order_id: params.localOrder.id,
    provider: "mercado_pago",
    provider_payment_id: providerOrderId,
    method: "pix",
    amount_brl: amount,
    status: "PENDING",
    pix_qr_code: qrCode,
    pix_copy_paste: qrCode,
    raw_payload: params.providerOrder,
    updated_at: now
  };

  if (existing) {
    await supabaseRequest<NexusPayment[]>(
      `payments?id=eq.${encodeURIComponent(existing.id)}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(paymentBody)
      }
    );
  } else {
    await supabaseRequest<NexusPayment[]>("payments", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(paymentBody)
    });
  }

  if (params.localOrder.status === "CREATED" || params.localOrder.status === "AWAITING_PAYMENT") {
    await supabaseRequest<NexusOrder[]>(
      `orders?id=eq.${encodeURIComponent(params.localOrder.id)}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          unit_price_brl: amount,
          total_price_brl: amount,
          status: "AWAITING_PAYMENT",
          updated_at: now
        })
      }
    );
  }

  return getMercadoPagoPaymentByProviderOrderId(providerOrderId);
}

function mapMercadoPagoStatus(order: MercadoPagoOrderLike) {
  const transaction = order.transactions?.payments?.[0];
  const status = order.status || transaction?.status || "created";
  const detail = order.status_detail || transaction?.status_detail || "";

  if (status === "processed" && detail === "accredited") {
    return { orderStatus: "PAID", paymentStatus: "APPROVED" };
  }
  if (status === "refunded") {
    return { orderStatus: "REFUNDED", paymentStatus: "REFUNDED" };
  }
  if (status === "charged_back") {
    return { orderStatus: "MANUAL_REVIEW", paymentStatus: "IN_REVIEW" };
  }
  if (status === "expired") {
    return { orderStatus: "CANCELLED", paymentStatus: "EXPIRED" };
  }
  if (status === "canceled") {
    return { orderStatus: "CANCELLED", paymentStatus: "CANCELLED" };
  }
  if (status === "failed") {
    return { orderStatus: "FAILED", paymentStatus: "REJECTED" };
  }
  if (status === "processed" && detail === "partially_refunded") {
    return { orderStatus: "MANUAL_REVIEW", paymentStatus: "IN_REVIEW" };
  }

  return { orderStatus: "AWAITING_PAYMENT", paymentStatus: "PENDING" };
}

export async function syncMercadoPagoOrder(providerOrder: MercadoPagoOrderLike) {
  if (!providerOrder.id) throw new Error("Order do Mercado Pago sem ID.");

  const paymentRecord = await getMercadoPagoPaymentByProviderOrderId(providerOrder.id);
  if (!paymentRecord) return null;

  const localOrders = await supabaseRequest<NexusOrder[]>(
    `orders?select=${ORDER_SELECT}&id=eq.${encodeURIComponent(
      paymentRecord.order_id
    )}&limit=1`
  );
  const localOrder = localOrders?.[0];
  if (!localOrder?.id || !localOrder.user_id) return null;

  const payment = providerOrder.transactions?.payments?.[0];
  const amount = Number(providerOrder.total_amount || payment?.amount || localOrder.total_price_brl || 0);
  const qrCode = payment?.payment_method?.qr_code || paymentRecord.pix_qr_code || null;
  const mapped = mapMercadoPagoStatus(providerOrder);
  const now = new Date().toISOString();

  let nextOrderStatus = mapped.orderStatus;
  if (
    ["PAID", "PURCHASING", "DELIVERED"].includes(localOrder.status) &&
    nextOrderStatus === "AWAITING_PAYMENT"
  ) {
    nextOrderStatus = localOrder.status;
  }
  if (localOrder.status === "DELIVERED" && nextOrderStatus === "PAID") {
    nextOrderStatus = "DELIVERED";
  }

  await supabaseRequest<NexusPayment[]>(
    `payments?id=eq.${encodeURIComponent(paymentRecord.id)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        amount_brl: amount,
        status: mapped.paymentStatus,
        pix_qr_code: qrCode,
        pix_copy_paste: qrCode,
        paid_at: mapped.paymentStatus === "APPROVED" ? now : undefined,
        raw_payload: providerOrder,
        updated_at: now
      })
    }
  );

  const orderPatch: Record<string, unknown> = {
    unit_price_brl: amount,
    total_price_brl: amount,
    status: nextOrderStatus,
    updated_at: now
  };
  if (mapped.orderStatus === "PAID" && !localOrder.paid_at) {
    orderPatch.paid_at = now;
  }

  const updatedOrders = await supabaseRequest<NexusOrder[]>(
    `orders?id=eq.${encodeURIComponent(localOrder.id)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(orderPatch)
    }
  );

  const users = await supabaseRequest<NexusUser[]>(
    `users?select=id,discord_user_id,discord_username,is_customer&id=eq.${encodeURIComponent(
      localOrder.user_id
    )}&limit=1`
  );
  const user = users?.[0] || null;

  const isPaid = ["PAID", "PURCHASING", "DELIVERED"].includes(nextOrderStatus);
  if (isPaid && user?.id && !user.is_customer) {
    await supabaseRequest<NexusUser[]>(
      `users?id=eq.${encodeURIComponent(user.id)}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ is_customer: true, updated_at: now })
      }
    );
  }

  return {
    order: updatedOrders?.[0] || { ...localOrder, status: nextOrderStatus },
    discordUserId: user?.discord_user_id || null,
    isPaid,
    providerStatus: providerOrder.status || payment?.status || "unknown",
    providerStatusDetail: providerOrder.status_detail || payment?.status_detail || ""
  };
}
