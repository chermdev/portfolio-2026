// Secret Santa: the draw and the text helpers shared by the page and the API.

export const santaLimits = { people: 100, name: 40, group: 60, budget: 30, message: 280, wishes: 30, wish: 200 } as const;

const cryptoRandom = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
const key = (name: string) => name.trim().toLocaleLowerCase();

/** One name per line; blank lines dropped. */
export const parseNames = (text: string) => text.split('\n').map(name => name.trim()).filter(Boolean);
/** Names typed twice, ignoring case: two people with the same name couldn't tell their links apart. */
export const duplicateNames = (names: string[]) => names.filter((name, index) => names.findIndex(other => key(other) === key(name)) !== index);

/**
 * A pasted list becomes one wish per line. List markers from notes apps are dropped:
 * "- ", "* ", "• ", "1. ", "2) ", and checkboxes such as "[ ]", "[x]", "☐", "✓".
 */
export function parseWishes(text: string) {
  return text.split(/\r?\n/)
    .map(line => line.trim().replace(/^(?:[-*•·–—]\s*|\d{1,3}[.)]\s+)?(?:\[[ xX✓✔]?\]\s*|[☐☑✅✓✔]\s*)?/u, '').trim())
    .filter(Boolean)
    .map(line => line.slice(0, santaLimits.wish));
}

/**
 * Who each person gives to: receivers[i] is the person names[i] gives to.
 * - Nobody draws themselves.
 * - Nobody draws the person who drew them (no A→B with B→A), so every gift goes around a loop of 3 or more.
 * - An excluded pair (such as a couple) never draws each other, in either direction.
 * Returns null when no valid draw exists (or none is found within the search budget).
 */
export function drawNames(names: string[], exclusions: [string, string][] = [], random: () => number = cryptoRandom): string[] | null {
  const n = names.length;
  if (n < 3) return null;
  const blocked = new Set(exclusions.flatMap(([a, b]) => [`${key(a)}\n${key(b)}`, `${key(b)}\n${key(a)}`]));
  const allowed = (giver: number, receiver: number) => giver !== receiver && !blocked.has(`${key(names[giver])}\n${key(names[receiver])}`);
  const shuffle = (list: number[]) => { for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; } return list; };
  const valid = (order: number[]) => order.every((receiver, giver) => allowed(giver, receiver) && order[receiver] !== giver);
  // Shuffle until the order is valid, so every valid draw is equally likely. Without exclusions about 1 in 5 tries pass.
  for (let attempt = 0; attempt < 5000; attempt++) {
    const order = shuffle([...names.keys()]);
    if (valid(order)) return order.map(index => names[index]);
  }
  // Many exclusions: search for any valid draw, giving the most constrained person a receiver first.
  // ponytail: not uniform, and capped by total work (about n² per step) so a crafted exclusion list can't pin the CPU; only reached when 5000 shuffles fail.
  const receiverOf: number[] = Array(n).fill(-1), taken: boolean[] = Array(n).fill(false);
  const options = [...names.keys()].map(giver => shuffle([...names.keys()].filter(receiver => allowed(giver, receiver))));
  let steps = 0;
  const search = (assigned: number): boolean => {
    if (assigned === n) return true;
    if ((steps += n * n) > 20_000_000) return false;
    let giver = -1, fewest = Infinity;
    for (let g = 0; g < n; g++) if (receiverOf[g] === -1) {
      const count = options[g].filter(r => !taken[r] && receiverOf[r] !== g).length;
      if (count < fewest) { fewest = count; giver = g; }
    }
    if (fewest === 0) return false;
    for (const receiver of options[giver]) {
      if (taken[receiver] || receiverOf[receiver] === giver) continue;
      receiverOf[giver] = receiver; taken[receiver] = true;
      if (search(assigned + 1)) return true;
      receiverOf[giver] = -1; taken[receiver] = false;
    }
    return false;
  };
  return search(0) ? receiverOf.map(index => names[index]) : null;
}

/** True when two rosters have the same people and exclusions, ignoring order and letter case, so an edit can keep the draw. */
export function sameRoster(people: string[], exclusions: [string, string][], otherPeople: string[], otherExclusions: [string, string][]) {
  const names = (list: string[]) => list.map(key).sort().join('\n');
  const pairs = (list: [string, string][], known: string[]) => {
    const set = new Set(known.map(key));
    return [...new Set(list.filter(([a, b]) => set.has(key(a)) && set.has(key(b))).map(pair => pair.map(key).sort().join('\t')))].sort().join('\n');
  };
  return names(people) === names(otherPeople) && pairs(exclusions, people) === pairs(otherExclusions, otherPeople);
}
