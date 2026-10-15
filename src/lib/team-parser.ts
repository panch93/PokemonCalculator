import { PokemonSet, Stats, Team } from "./types";

const STAT_MAP: Record<string, keyof Stats> = {
  HP: "hp",
  Atk: "atk",
  Def: "def",
  SpA: "spa",
  SpD: "spd",
  Spe: "spe",
};

const emptyStats = (): Stats => ({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });
const defaultIVs = (): Stats => ({ hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 });

export function parseTeamPaste(input: string): Team {
  const blocks = input.replace(/\r/g, "").split(/\n\s*\n/);
  const team: Team = [];

  for (const block of blocks) {
    const lines = block.split("\n").map(s => s.trim()).filter(Boolean);
    if (!lines.length) continue;

    const header = lines[0];
    const [left, itemPart] = header.split(/\s+@\s+/);
    const genderless = left.replace(/\s+\([MF]\)\s*$/, "");
    const nicknameMatch = genderless.match(/^(.*?)\s+\((.*?)\)$/);

    const set: PokemonSet = {
      name: nicknameMatch?.[1]?.trim() || genderless.trim(),
      species: nicknameMatch?.[2]?.trim() || genderless.trim(),
      item: itemPart?.trim() || "",
      ability: "",
      nature: "Hardy",
      level: 100,
      teraType: "",
      importedTeraType: "",
      evs: emptyStats(),
      ivs: defaultIVs(),
      moves: [],
    };

    for (const line of lines.slice(1)) {
      if (/^Ability:/i.test(line)) set.ability = line.replace(/^Ability:\s*/i, "");
      else if (/^EVs:/i.test(line)) set.evs = parseStats(line.replace(/^EVs:\s*/i, ""));
      else if (/^IVs:/i.test(line)) set.ivs = { ...defaultIVs(), ...parseStats(line.replace(/^IVs:\s*/i, "")) };
      else if (/^([A-Za-z]+) Nature$/i.test(line)) set.nature = line.replace(/\s+Nature$/i, "");
      else if (/^Level:/i.test(line)) set.level = Number(line.replace(/^Level:\s*/i, "")) || 100;
      else if (/^Tera Type:/i.test(line)) { set.teraType = line.replace(/^Tera Type:\s*/i, ""); set.importedTeraType = set.teraType; }
      else if (/^-\s*/.test(line)) set.moves.push(line.replace(/^-\s*/, ""));
    }

    while (set.moves.length < 4) set.moves.push("");
    team.push(set);
  }

  return team.slice(0, 6);
}

function parseStats(value: string): Stats {
  const stats = emptyStats();
  for (const part of value.split("/")) {
    const match = part.trim().match(/^(\d+)\s+(.+)$/);
    if (!match) continue;
    const stat = STAT_MAP[match[2].trim()];
    if (stat) stats[stat] = Math.max(0, Math.min(252, Number(match[1])));
  }
  return stats;
}

export function exportTeam(team: Team): string {
  return team.map(set => {
    const header = set.name && set.name !== set.species
      ? `${set.name} (${set.species})`
      : set.species;

    const lines = [`${header}${set.item ? ` @ ${set.item}` : ""}`];
    if (set.ability) lines.push(`Ability: ${set.ability}`);

    const evs = formatStats(set.evs);
    if (evs) lines.push(`EVs: ${evs}`);

    if (set.level !== 100) lines.push(`Level: ${set.level}`);

    if (set.teraType) lines.push(`Tera Type: ${set.teraType}`);

    const ivs = formatIVs(set.ivs);
    if (ivs) lines.push(`IVs: ${ivs}`);

    if (set.nature) lines.push(`${set.nature} Nature`);
    for (const move of set.moves.filter(Boolean)) lines.push(`- ${move}`);

    return lines.join("\n");
  }).join("\n\n");
}

function formatStats(stats: Stats): string {
  return (Object.entries(STAT_MAP) as [string, keyof Stats][])
    .filter(([, key]) => stats[key] > 0)
    .map(([label, key]) => `${stats[key]} ${label}`)
    .join(" / ");
}

function formatIVs(ivs: Stats): string {
  return (Object.entries(STAT_MAP) as [string, keyof Stats][])
    .filter(([, key]) => ivs[key] !== 31)
    .map(([label, key]) => `${ivs[key]} ${label}`)
    .join(" / ");
}
