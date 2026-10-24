import { describe, expect, it } from "vitest";
import { parseShowdownFormatConfig } from "../src/lib/showdown-format-config";

const upstreamFixture = `
// The official source uses a TypeScript array of format records.
export const Formats: FormatList = [
  { section: "S/V Singles" },
  {
    name: "[Gen 9] OU",
    mod: 'gen9',
    ruleset: ['Standard', '[Gen 9] National Dex'],
    banlist: ['Uber', 'King\\'s Rock'],
  },
  {
    name: '[Gen 9] UU',
    mod: 'gen9',
    ruleset: ['[Gen 9] OU'],
    banlist: ['OU', 'UUBL'],
    searchShow: false,
  },
`;
const completeFixture = upstreamFixture + Array.from({ length: 18 }, (_, index) =>
  `{ name: '[Gen 9] Test Format ${index}', mod: 'gen9' },`
).join("\n") + "\n];";

describe("live Showdown format config parser", () => {
  it("reads names, sections, rules and bans without mistaking bracketed strings for array endings", () => {
    const formats = parseShowdownFormatConfig(completeFixture);
    expect(formats).toHaveLength(20);
    expect(formats[0]).toMatchObject({
      id: "gen9ou",
      label: "[Gen 9] OU",
      section: "S/V Singles",
      mod: "gen9",
      ruleset: ["Standard", "[Gen 9] National Dex"],
      banlist: ["Uber", "King's Rock"],
    });
    expect(formats[1]).toMatchObject({ id: "gen9uu", ruleset: ["[Gen 9] OU"], searchShow: false });
  });

  it("rejects incomplete upstream content rather than replacing the catalog with partial data", () => {
    expect(() => parseShowdownFormatConfig("export const Formats: FormatList = [{ name: 'Only one' }];"))
      .toThrow(/looked incomplete/i);
  });
});
