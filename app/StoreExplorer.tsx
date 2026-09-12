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
      const searchOk = !q || \`\${item.name} \${item.categoryName} \${item.description}\`.toLowerCase().includes(q);
      return categoryOk && searchOk;
    });
  }, [items, query, active]);

  return (
    <>
      <section className="marketCategories" id="categorias">
        <div className="marketSectionHead">
          <div>
            <span>EXPLORE</span>
            <h2>Categorias</h2>
          </div>
          <p>Escolha a plataforma e veja apenas ofertas com região e estoque verificados.</p>
        </div>

        <div className="marketCategoryRail">
          {categories.map((category) => (
            <a className={\`marketCategoryTile \${category.available ? "" : "soon"}\`} href={category.available ? \`/categoria/\${category.id}\` : "#catalogo"} key={category.id}>
              <img src={category.image} alt={category.name} />
              <div className="marketCategoryShade" />
              <div className="marketCategoryCopy">
                <strong>{category.name}</strong>
                <small>{category.available && category.fromPrice !== null ? \`a partir de R$ \${category.fromPrice.toFixed(2).replace(".", ",")}\` : "em breve"}</small>
              </div>
            </a>
          ))}
        </div>
      </section>

      <section className="marketCatalog" id="catalogo">
        <div className="marketSectionHead catalogHead">
          <div>
            <span>OFERTAS ATIVAS</span>
            <h2>Mais vendidos</h2>
          </div>
          <div className="marketSearch">
            <span>⌕</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar produto, jogo ou plataforma..." />
          </div>
        </div>

        <div className="marketFilterRow">
          <button className={active === "all" ? "active" : ""} onClick={() => setActive("all")}>Todos</button>
          {categories.filter((c) => c.available).map((category) => (
            <button key={category.id} className={active === category.id ? "active" : ""} onClick={() => setActive(category.id)}>{category.name}</button>
          ))}
        </div>

        {filtered.length ? (
          <div className="marketProductGrid">
            {filtered.map((item, index) => {
              const image = categories.find((c) => c.id === item.categoryId)?.image || "/assets/nexus-icon";
              return (
                <a className="marketProductCard" href={item.href} key={item.id}>
                  <div className="marketProductImage">
                    <img src={image} alt={item.name} loading="lazy" />
                    <div className="marketProductImageShade" />
                    {index < 2 && active === "all" && !query ? <span className="marketHot">🔥 MAIS VENDIDO</span> : null}
                    <span className="marketInstant">⚡ DIGITAL</span>
                  </div>
                  <div className="marketProductBody">
                    <small>{item.categoryName}</small>
                    <h3>{item.name}</h3>
                    <p>{item.description}</p>
                    <div className="marketProductFooter">
                      <div><span>Preço</span><strong>R$ {item.price.toFixed(2).replace(".", ",")}</strong></div>
                      <b>Comprar →</b>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        ) : (
          <div className="marketEmpty">Nenhum produto encontrado. Tente outro termo ou categoria.</div>
        )}
      </section>
    </>
  );
}
