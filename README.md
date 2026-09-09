# NexusGames Cloud

Versao cloud da NexusGames. Nao precisa de Node.js instalado no computador do usuario.

## Arquitetura atual

- Next.js hospedado na Vercel
- Discord Interactions por HTTP
- Pagina `/admin` para registrar comandos e criar canais
- Catalogo inicial sem pagamento real
- Preparado para Supabase, Mercado Pago e fornecedor
- Setup visual com categorias estilizadas, emojis e mensagens oficiais nos canais principais

## IDs ja configurados

- Application ID: `1547332142776975400`
- Guild ID: `1547332734794334319`

## Variaveis que devem ser configuradas na Vercel

- `DISCORD_PUBLIC_KEY`: Public Key da aplicacao no Discord Developer Portal
- `DISCORD_BOT_TOKEN`: token do bot; nunca colocar no GitHub ou em mensagens
- `ADMIN_SETUP_SECRET`: uma senha escolhida pelo dono da loja para proteger `/admin`
- `NEXT_PUBLIC_DISCORD_INVITE`: link de convite do servidor, opcional

Depois entraremos com:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MERCADO_PAGO_ACCESS_TOKEN`
- `MERCADO_PAGO_WEBHOOK_SECRET`
- credenciais do fornecedor

## Depois do deploy

1. Na Vercel, configure as variaveis acima.
2. Abra `https://SEU-DOMINIO.vercel.app/admin`.
3. Informe a senha escolhida em `ADMIN_SETUP_SECRET`.
4. Clique em **Configurar servidor**.
5. No Discord Developer Portal, em General Information, coloque em **Interactions Endpoint URL**:
   `https://SEU-DOMINIO.vercel.app/api/discord/interactions`
6. O Discord testara a assinatura do endpoint automaticamente.

## Comandos do MVP

- `/loja`
- `/comprar`
- `/pedidos`
- `/suporte`

Nenhum pagamento real ou compra no fornecedor esta habilitado nesta etapa.
