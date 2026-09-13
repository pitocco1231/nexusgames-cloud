"use client";

import { useMemo, useState } from "react";

type StoreItem = {
  id: string;
  department: "gift-cards" | "coins";
  categoryId: string;
  categoryName: string;
  name: string;
  description: string;
  price: number;
  emoji: string;
  image: string;
  brand: { name: string; mark: string; tone: string };
  href: string;
};

type Category = {
  id: string;
  name: string;
  description: string;
  image: string;
  available: boolean;
  fromPrice: number | null;
};

export default function StoreExplorer({ items, categories }: { items: StoreItem[]; categories: Category[] }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState("all");
  const [department, setDepartment] = useState("all");
  const [sort, setSort] = useState("featured");

  const departments = [
    {
      id: "gift-cards",
      eyebrow: "CRÉDITOS PARA SUA PLATAFORMA",
      title: "Gift Cards",
      description: "Cartões digitais com região e disponibilidade verificadas antes do pagamento.",
      image: "/departments/gift-cards.webp",
      action: "Ver gift cards"
    },
    {
      id: "accounts",
      eyebrow: "ACESSO COM PROCEDÊNCIA",
      title: "Contas",
      description: "Uma área reservada somente para ofertas legítimas e verificadas. Catálogo em preparação.",
      image: "/departments/accounts.webp",
      action: "Em preparação"
    },
    {
      id: "coins",
      eyebrow: "SALDO DIRETO NO JOGO",
      title: "Moedas",
      description: "Diamantes, Minecoins e créditos entregues conforme as regras de cada jogo.",
      image: "/departments/coins.webp",
      action: "Ver moedas"
    }
  ] as const;

  function selectDepartment(nextDepartment: string) {
    if (nextDepartment === "accounts") return;
    setDepartment(nextDepartment);
    setActive("all");
    setQuery("");
    requestAnimationFrame(() => document.querySelector("#catalogo")?.scrollIntoView({ behavior: "smooth" }));
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result = items.filter((item) => {
      const categoryOk = active === "all" || item.categoryId === active;
      const departmentOk = department === "all" || item.department === department;
      const searchOk = !q || `${item.name} ${item.categoryName} ${item.description}`.toLowerCase().includes(q);
      return categoryOk && departmentOk && searchOk;
    });
    if (sort === "lowest") return result.toSorted((a, b) => a.price - b.price);
    if (sort === "highest") return result.toSorted((a, b) => b.price - a.price);
    if (sort === "name") return result.toSorted((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    return result;
  }, [items, query, active, department, sort]);

  return (
    <>
      <section className="nxDepartments" id="departamentos">
        <div className="marketSectionHead nxDepartmentsHead">
          <div>
            <span>COMPRE DO SEU JEITO</span>
            <h2>O que você procura?</h2>
          </div>
          <p>Três áreas claras para você chegar mais rápido ao produto certo.</p>
        </div>

        <div className="nxDepartmentGrid">
          {departments.map((item) => {
            const disabled = item.id === "accounts";
            return (
              <button
                className={`nxDepartmentCard nxDepartment-${item.id} ${disabled ? "isPreparing" : ""}`}
                type="button"
                key={item.id}
                onClick={() => selectDepartment(item.id)}
                disabled={disabled}
              >
                <img src={item.image} alt="" loading="lazy" />
                <span className="nxDepartmentShade" />
                <span className="nxDepartmentBrand"><img src="/assets/nexus-logo" alt="" /><b>NEXUS<span>GAMES</span></b></span>
                <span className="nxDepartmentCopy">
                  <small>{item.eyebrow}</small>
                  <strong>{item.title}</strong>
                  <em>{item.description}</em>
                  <b>{item.action} <i>{disabled ? "•" : "→"}</i></b>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="marketCategories" id="categorias">
        <div className="marketSectionHead">
          <div>
            <span>ESCOLHA SUA PLATAFORMA</span>
            <h2>Categorias</h2>
          </div>
          <p>Entre direto no catálogo da plataforma que você procura. Itens sem estoque ficam sinalizados como indisponíveis.</p>
        </div>

        <div className="marketCategoryRail">
          {categories.map((category) => (
            <a
              className={`marketCategoryTile ${category.available ? "isAvailable" : "soon"}`}
              href={category.available ? `/categoria/${category.id}` : "#catalogo"}
              key={category.id}
              aria-label={`${category.name}${category.available ? "" : " - em breve"}`}
            >
              <img src={category.image} alt={category.name} loading="lazy" />
              <div className="marketCategoryShade" />
              <div className="marketCategoryCopy">
                <small>{category.available ? "DISPONÍVEL" : "EM BREVE"}</small>
                <strong>{category.name}</strong>
                <span>{category.available && category.fromPrice !== null ? `a partir de R$ ${category.fromPrice.toFixed(2).replace(".", ",")}` : "catálogo em preparação"}</span>
              </div>
            </a>
          ))}
        </div>
      </section>

      <section className="marketCatalog" id="catalogo">
        <div className="marketSectionHead catalogHead">
          <div>
            <span>CATÁLOGO ATIVO</span>
            <h2>Produtos disponíveis</h2>
            <p>Somente ofertas que passaram pela validação de disponibilidade aparecem aqui.</p>
          </div>
          <label className="marketSearch">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="Buscar produtos"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar produto, jogo ou plataforma..."
            />
            {query ? <button type="button" onClick={() => setQuery("")} aria-label="Limpar busca">×</button> : null}
          </label>
        </div>

        <div className="marketFilterRow" role="group" aria-label="Filtrar por categoria">
          <div className="marketFilterButtons">
            <button className={active === "all" && department === "all" ? "active" : ""} onClick={() => { setActive("all"); setDepartment("all"); }}>Todos</button>
            <button className={department === "gift-cards" ? "active" : ""} onClick={() => { setActive("all"); setDepartment("gift-cards"); }}>Gift Cards</button>
            <button className={department === "coins" ? "active" : ""} onClick={() => { setActive("all"); setDepartment("coins"); }}>Moedas</button>
            {categories.filter((category) => category.available).map((category) => (
              <button key={category.id} className={active === category.id ? "active" : ""} onClick={() => { setActive(category.id); setDepartment("all"); }}>{category.name}</button>
            ))}
          </div>
          <label className="marketSort">Ordenar
            <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Ordenar produtos">
              <option value="featured">Destaques</option>
              <option value="lowest">Menor preço</option>
              <option value="highest">Maior preço</option>
              <option value="name">Nome</option>
            </select>
          </label>
        </div>

        {filtered.length ? (
          <div className="marketProductGrid">
            {filtered.map((item, index) => {
              return (
                <a className="marketProductCard" href={item.href} key={item.id}>
                  <div className="marketProductImage">
                    <img src={item.image} alt={`${item.categoryName} - ${item.name}`} loading="lazy" />
                    <div className="marketProductImageShade" />
                    <div className={`marketBrand marketBrand-${item.brand.tone}`}><b>{item.brand.mark}</b><span>{item.brand.name}</span></div>
                    <span className="marketInstant">PRODUTO DIGITAL</span>
                    {index < 3 && active === "all" && !query ? <span className="marketHot">DESTAQUE</span> : null}
                    <div className="marketPackLabel"><small>PACOTE</small><strong>{item.name}</strong></div>
                  </div>
                  <div className="marketProductBody">
                    <div className="marketProductMeta"><small>{item.categoryName}</small><span>● Disponível agora</span></div>
                    <h3>{item.name}</h3>
                    <p>{item.description}</p>
                    <div className="marketProductFooter">
                      <div><span>Preço atual</span><strong>R$ {item.price.toFixed(2).replace(".", ",")}</strong></div>
                      <b>Comprar agora <i>→</i></b>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        ) : (
          <div className="marketEmpty">
            <span>⌕</span>
            <strong>Nenhum produto encontrado</strong>
            <p>Tente outro termo ou selecione outra categoria.</p>
            <button type="button" onClick={() => { setQuery(""); setActive("all"); setDepartment("all"); }}>Limpar filtros</button>
          </div>
        )}
      </section>
    </>
  );
}
