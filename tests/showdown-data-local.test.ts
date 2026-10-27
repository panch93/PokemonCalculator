import { afterEach, describe, expect, it, vi } from "vitest";
import { clearShowdownDataCache, loadShowdownData } from "../src/lib/showdown-data/client";
import { getBundledShowdownFormats } from "../src/lib/showdown-format-config";

afterEach(() => {
  vi.unstubAllGlobals();
  clearShowdownDataCache();
});

describe("bundled Pokémon Showdown data", () => {
  it("loads species, moves, learnsets, items, abilities and natures without network access", async () => {
    const fetchStub = vi.fn(() => Promise.reject(new Error("Network must not be used for bundled data")));
    vi.stubGlobal("fetch", fetchStub);
    const progress: number[] = [];
    const data = await loadShowdownData(true, percent => progress.push(percent));

    expect(fetchStub).not.toHaveBeenCalled();
    expect(Object.keys(data.species).length).toBeGreaterThan(1000);
    expect(Object.keys(data.moves).length).toBeGreaterThan(500);
    expect(Object.keys(data.learnsets).length).toBeGreaterThan(500);
    expect(Object.keys(data.items).length).toBeGreaterThan(100);
    expect(Object.keys(data.abilities).length).toBeGreaterThan(100);
    expect(Object.keys(data.natures)).toHaveLength(25);
    expect(progress).toContain(100);
  });

  it("exposes the bundled format catalog without a remote request", () => {
    const formats = getBundledShowdownFormats();
    expect(formats.length).toBeGreaterThan(100);
    expect(formats.find(format => format.id === "gen9ou")).toMatchObject({ label: "[Gen 9] OU", source: "bundled" });
    expect(formats.find(format => format.id === "gen9doublesou")).toBeTruthy();
  });
});
