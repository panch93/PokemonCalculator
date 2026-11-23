"use client";

import { useEffect, useState } from "react";

const itemId = (item: string) => item.toLowerCase().replace(/[^a-z0-9]/g, "");
const itemSlug = (item: string) => item.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function ItemSprite({ item, className = "", size = 24 }: { item: string; className?: string; size?: number }) {
  const id = itemId(item);
  const sources = item ? [
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${itemSlug(item)}.png`,
    `https://play.pokemonshowdown.com/sprites/itemicons/${id}.png`,
  ] : [];
  const [sourceIndex, setSourceIndex] = useState(0);
  useEffect(() => setSourceIndex(0), [item]);
  if (!item || !sources.length || sourceIndex >= sources.length) return <span className={`item-sprite-fallback ${className}`} style={{ width: size, height: size }} title={item || "No item"} aria-label={item || "No item"}>?</span>;
  return <img className={`item-sprite ${className}`} src={sources[sourceIndex]} width={size} height={size} alt={`${item} item`} title={item} loading="lazy" decoding="async" onError={() => setSourceIndex(index => index + 1)} />;
}
