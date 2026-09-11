const LIVE_ENDPOINT = "https://api.codeswholesale.com";
const SANDBOX_ENDPOINT = "https://sandbox.codeswholesale.com";

type CodesWholesaleMode = "sandbox" | "live";

export type CodesWholesalePrice = {
  from?: number;
  to?: number;
  value?: number;
};

export type CodesWholesaleProduct = {
  identifier?: string;
  name?: string;
  platform?: string;
  prices?: CodesWholesalePrice[];
  productId?: string;
  quantity?: number;
  regions?: string[];
  languages?: string[];
};

type CodesWholesaleProductsResponse = {
  items?: CodesWholesaleProduct[];
};

type OAuthResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
};

let cachedToken: { value: string; expiresAt: number; mode: CodesWholesaleMode } | null = null;

export function codesWholesaleMode(): CodesWholesaleMode {
  return process.env.CODESWHOLESALE_MODE === "live" ? "live" : "sandbox";
}

export function isCodesWholesaleConfigured() {
  return Boolean(
    process.env.CODESWHOLESALE_CLIENT_ID &&
      process.env.CODESWHOLESALE_CLIENT_SECRET
  );
}

function endpoint(mode: CodesWholesaleMode) {
  return mode === "live" ? LIVE_ENDPOINT : SANDBOX_ENDPOINT;
}

function credentials() {
  const clientId = process.env.CODESWHOLESALE_CLIENT_ID;
  const clientSecret = process.env.CODESWHOLESALE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "CODESWHOLESALE_CLIENT_ID e CODESWHOLESALE_CLIENT_SECRET não configurados na Vercel."
    );
  }

  return { clientId, clientSecret };
}

async function accessToken(mode: CodesWholesaleMode) {
  if (
    cachedToken &&
    cachedToken.mode === mode &&
    cachedToken.expiresAt > Date.now() + 30_000
  ) {
    return cachedToken.value;
  }

  const { clientId, clientSecret } = credentials();
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret
  });

  const response = await fetch(`${endpoint(mode)}/oauth/token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body,
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`CodesWholesale OAuth ${response.status}: ${text.slice(0, 300)}`);
  }

  const payload = (await response.json()) as OAuthResponse;
  if (!payload.access_token) {
    throw new Error("CodesWholesale não retornou access_token.");
  }

  const expiresIn = Math.max(60, Number(payload.expires_in || 900));
  cachedToken = {
    value: payload.access_token,
    mode,
    expiresAt: Date.now() + expiresIn * 1000
  };

  return payload.access_token;
}

async function cwRequest<T>(path: string, init: RequestInit = {}) {
  const mode = codesWholesaleMode();
  const token = await accessToken(mode);

  const response = await fetch(`${endpoint(mode)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers || {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`CodesWholesale ${response.status}: ${text.slice(0, 500)}`);
  }

  return (await response.json()) as T;
}

export async function listCodesWholesaleProducts() {
  const response = await cwRequest<CodesWholesaleProductsResponse>("/v2/products");
  return response.items || [];
}

export function singleUnitCost(product: CodesWholesaleProduct) {
  const prices = Array.isArray(product.prices) ? product.prices : [];
  const oneUnitTier = prices.find((price) => {
    const from = Number(price.from ?? 1);
    const to = Number(price.to ?? Number.MAX_SAFE_INTEGER);
    return from <= 1 && to >= 1 && Number.isFinite(Number(price.value));
  });

  const candidates = (oneUnitTier ? [oneUnitTier] : prices)
    .map((price) => Number(price.value))
    .filter((value) => Number.isFinite(value) && value >= 0);

  return candidates.length ? Math.min(...candidates) : null;
}

export async function getCodesWholesaleAccount() {
  return cwRequest<Record<string, unknown>>("/v2/accounts/current");
}

export async function createCodesWholesaleOrder(params: {
  clientOrderId: string;
  productId: string;
  unitPrice: number;
  quantity?: number;
}) {
  return cwRequest<Record<string, unknown>>("/v2/orders", {
    method: "POST",
    body: JSON.stringify({
      allowPreOrder: false,
      orderId: params.clientOrderId,
      products: [
        {
          price: params.unitPrice,
          productId: params.productId,
          quantity: Math.max(1, params.quantity || 1)
        }
      ]
    })
  });
}
