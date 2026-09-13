"use client";

import { useMemo, useState } from "react";

type StoreItem = {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  description: string;
  price: number;
  emoji: string;
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      const categoryOk = active === "all" || item.categoryId === active;
      const searchOk = !q || `${item.name} ${item.categoryName} ${item.description}`.toLowerCase().includes(q);
      return categoryOk && searchOk;
    });
  }, [items, query, active]);

  return (
    <>
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
          <button className={active === "all" ? "active" : ""} onClick={() => setActive("all")}>Todos</button>
          {categories.filter((category) => category.available).map((category) => (
            <button key={category.id} className={active === category.id ? "active" : ""} onClick={() => setActive(category.id)}>{category.name}</button>
          ))}
        </div>

        {filtered.length ? (
          <div className="marketProductGrid">
            {filtered.map((item, index) => {
              const image = categories.find((category) => category.id === item.categoryId)?.image || "/assets/nexus-logo";
              return (
                <a className="marketProductCard" href={item.href} key={item.id}>
                  <div className="marketProductImage">
                    <img src={image} alt={`${item.categoryName} - ${item.name}`} loading="lazy" />
                    <div className="marketProductImageShade" />
                    <span className="marketInstant">DIGITAL</span>
                    {index < 3 && active === "all" && !query ? <span className="marketHot">DESTAQUE</span> : null}
                    <div className="marketProductVisualName"><small>{item.categoryName}</small><strong>{item.name}</strong></div>
                  </div>
                  <div className="marketProductBody">
                    <div className="marketProductMeta"><small>{item.categoryName}</small><span>Disponível</span></div>
                    <h3>{item.name}</h3>
                    <p>{item.description}</p>
                    <div className="marketProductFooter">
                      <div><span>Preço atual</span><strong>R$ {item.price.toFixed(2).replace(".", ",")}</strong></div>
                      <b>Comprar <i>→</i></b>
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
            <button type="button" onClick={() => { setQuery(""); setActive("all"); }}>Limpar filtros</button>
          </div>
        )}
      </section>
    </>
  );
}
