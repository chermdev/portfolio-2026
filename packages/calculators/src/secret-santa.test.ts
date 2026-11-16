import test from 'node:test';
import assert from 'node:assert/strict';
import { drawNames, parseNames, duplicateNames, parseWishes, sameRoster } from './secret-santa.ts';
const valid = (names: string[], receivers: string[] | null, pairs: [string, string][] = []) => {
  assert.ok(receivers);
  assert.deepEqual([...receivers].sort(), [...names].sort(), 'everyone receives exactly once');
  receivers.forEach((receiver, i) => {
    assert.notEqual(receiver, names[i], 'nobody draws themselves');
    assert.notEqual(receivers[names.indexOf(receiver)], names[i], 'nobody draws the person who drew them');
    for (const [a, b] of pairs) assert.ok(!(names[i] === a && receiver === b) && !(names[i] === b && receiver === a), 'excluded pairs never draw each other');
  });
};
test('draws a valid assignment, with and without exclusions', () => {
  const names = ['Ana', 'Luis', 'Carlos', 'María', 'Sofía', 'Diego'];
  const pairs: [string, string][] = [['Ana', 'Luis'], ['Carlos', 'María']];
  for (let run = 0; run < 300; run++) { valid(names, drawNames(names)); valid(names, drawNames(names, pairs)); }
  for (let run = 0; run < 100; run++) valid(['A', 'B', 'C'], drawNames(['A', 'B', 'C']));
  // Exclusions match names regardless of case and spacing.
  for (let run = 0; run < 100; run++) valid(['Ana', 'Luis', 'Eva', 'Leo'], drawNames(['Ana', 'Luis', 'Eva', 'Leo'], [[' ana', 'LUIS ']]), [['Ana', 'Luis']]);
});
test('falls back to a search when shuffles keep failing, and reports impossible draws', () => {
  // Each person may only give to the next one in a ring: shuffling almost never finds it, the search does.
  const names = Array.from({ length: 12 }, (_, i) => `P${i}`);
  const pairs = names.flatMap((a, i) => names.filter((_, j) => j !== i && j !== (i + 1) % 12 && i !== (j + 1) % 12).map(b => [a, b] as [string, string]));
  valid(names, drawNames(names, pairs), pairs);
  assert.equal(drawNames(['Ana', 'Luis', 'Eva', 'Leo'], [['Ana', 'Luis'], ['Ana', 'Eva']]), null, 'Ana can only give to Leo and receive from Leo');
  assert.equal(drawNames(['Ana', 'Luis']), null, 'two people would draw each other');
  assert.equal(drawNames(['Ana', 'Luis', 'Eva'], [['Ana', 'Luis']]), null);
});
test('every valid draw is reachable and roughly equally likely', () => {
  const counts = new Map<string, number>();
  for (let run = 0; run < 6000; run++) { const draw = drawNames(['A', 'B', 'C', 'D'])!.join(''); counts.set(draw, (counts.get(draw) ?? 0) + 1); }
  assert.equal(counts.size, 6, '4 people have 6 single loops and no other valid draw');
  for (const count of counts.values()) assert.ok(count > 800 && count < 1200, `uneven: ${count}`);
});
test('parses names, duplicates and pasted wish lists', () => {
  assert.deepEqual(parseNames(' Ana \n\nLuis\n  \nana'), ['Ana', 'Luis', 'ana']);
  assert.deepEqual(duplicateNames(['Ana', 'Luis', 'ana']), ['ana']);
  assert.deepEqual(parseWishes('- Audífonos\r\n* Libro de cocina\n• Taza\n1. Calcetines\n2) Bufanda\n[ ] Lego\n[x] Vela\n☐ Termo\n✓ Planta\n\n  Café de olla  \n-1 regalo'), ['Audífonos', 'Libro de cocina', 'Taza', 'Calcetines', 'Bufanda', 'Lego', 'Vela', 'Termo', 'Planta', 'Café de olla', '1 regalo']);
  assert.equal(parseWishes('x'.repeat(500))[0].length, 200);
});

test('an edit keeps the draw only when people and exclusions are unchanged', () => {
  const people = ['Ana', 'Luis', 'Carlos'], pairs: [string, string][] = [['Ana', 'Luis']];
  assert.equal(sameRoster(['carlos', 'ANA', 'Luis'], [['luis', 'ana'], ['Luis', 'Ana']], people, pairs), true);
  assert.equal(sameRoster([...people, 'María'], pairs, people, pairs), false);
  assert.equal(sameRoster(['Ana', 'Luis', 'Carla'], pairs, people, pairs), false);
  assert.equal(sameRoster(people, [], people, pairs), false);
  assert.equal(sameRoster(people, [['Ana', 'Carlos']], people, pairs), false);
});
