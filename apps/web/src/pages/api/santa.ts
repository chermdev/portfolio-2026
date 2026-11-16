import type { APIRoute } from 'astro';
import postgres from 'postgres';
import { createHash, randomBytes } from 'node:crypto';
import { drawNames, duplicateNames, santaLimits } from '@portfolio/calculators';

// Secret Santa API. No accounts: access is by unguessable tokens kept in each person's browser.
// - The group id lets anyone with the group link see the names and claim an unclaimed one.
// - A claim token opens that person's own assignment and wish list. The organizer's token manages the group.
// - Only hashes of tokens are stored. No endpoint returns the whole draw, not even to the organizer.
// ponytail: no rate limiting; ids and tokens are 96+ random bits. Add per-IP limits if it is abused.
export const prerender = false;

const url = process.env.DATABASE_URL;
// prepare: false keeps it compatible with Neon's pooled (PgBouncer) connection string.
const sql = url ? postgres(url, { prepare: false, max: 1, idle_timeout: 20 }) : null;
// Tables are created on first use, so a fresh database needs no manual migration.
let ready: Promise<unknown> | undefined;
const schema = (db: postgres.Sql) => ready ??= db.unsafe(`
  create table if not exists santa_groups (
    id text primary key, admin_hash text not null unique,
    name text not null default '', budget text not null default '', exchange_date text, message text not null default '',
    exclusions jsonb not null default '[]', drawn_at timestamptz not null default now(),
    created_at timestamptz not null default now(), expires_at timestamptz not null);
  create table if not exists santa_people (
    id text primary key, group_id text not null references santa_groups(id) on delete cascade,
    name text not null, position int not null, receiver_id text,
    claim_hash text unique, claimed_at timestamptz, wishes jsonb not null default '[]');
  create index if not exists santa_people_group on santa_people (group_id);
  create unique index if not exists santa_people_name on santa_people (group_id, lower(name));
`).catch(error => { ready = undefined; throw error; });

const token = (bytes: number) => randomBytes(bytes).toString('base64url');
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
class Problem extends Error { constructor(public code: string, public status = 400) { super(code); } }
const text = (value: unknown, max: number) => { if (typeof value !== 'string' || value.trim().length > max) throw new Problem('invalid'); return value.trim(); };
const id = (value: unknown) => { if (typeof value !== 'string' || !/^[\w-]{8,64}$/.test(value)) throw new Problem('not_found', 404); return value; };

type Details = { name: string; budget: string; date: string | null; message: string };
function details(body: Record<string, unknown>): Details {
  const date = body.date === '' || body.date == null ? null : text(body.date, 10);
  // Round-trip check rejects impossible dates such as 2026-13-45.
  const time = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? Date.parse(`${date}T00:00:00Z`) : NaN;
  if (date && (Number.isNaN(time) || new Date(time).toISOString().slice(0, 10) !== date)) throw new Problem('invalid');
  return { name: text(body.name ?? '', santaLimits.group), budget: text(body.budget ?? '', santaLimits.budget), date, message: text(body.message ?? '', santaLimits.message) };
}
function roster(body: Record<string, unknown>) {
  if (!Array.isArray(body.people) || !Array.isArray(body.exclusions)) throw new Problem('invalid');
  const people = body.people.map(name => text(name, santaLimits.name)).filter(Boolean);
  if (people.length < 3 || people.length > santaLimits.people || duplicateNames(people).length) throw new Problem('invalid');
  const known = new Set(people.map(name => name.toLocaleLowerCase()));
  const exclusions = body.exclusions.slice(0, 200).map(pair => { if (!Array.isArray(pair) || pair.length !== 2) throw new Problem('invalid'); return [text(pair[0], santaLimits.name), text(pair[1], santaLimits.name)] as [string, string]; })
    .filter(([a, b]) => known.has(a.toLocaleLowerCase()) && known.has(b.toLocaleLowerCase()));
  const receivers = drawNames(people, exclusions);
  if (!receivers) throw new Problem('impossible');
  return { people, exclusions, receivers };
}
// Groups are deleted 30 days after the exchange, or 30 days after the last draw when there is no date.
// A past exchange date still gets 30 days from now, so the group isn't created already expired.
const expiry = (date: string | null) => date ? new Date(Math.max(Date.parse(`${date}T00:00:00Z`), Date.now()) + 30 * 864e5) : new Date(Date.now() + 30 * 864e5);
const groupInfo = (g: Record<string, unknown>) => ({ name: g.name, budget: g.budget, date: g.exchange_date ?? '', message: g.message, drawnAt: g.drawn_at });

async function handle(db: postgres.Sql, body: Record<string, unknown>) {
  const action = body.action;
  if (action === 'create') {
    const info = details(body), { people, exclusions, receivers } = roster(body);
    const group = token(12), admin = token(24), ids = people.map(() => token(9));
    await db.begin(async tx => {
      await tx`delete from santa_groups where expires_at < now()`;
      await tx`insert into santa_groups ${tx({ id: group, admin_hash: hash(admin), name: info.name, budget: info.budget, exchange_date: info.date, message: info.message, exclusions: tx.json(exclusions), expires_at: expiry(info.date) })}`;
      await tx`insert into santa_people ${tx(people.map((name, i) => ({ id: ids[i], group_id: group, name, position: i, receiver_id: ids[people.indexOf(receivers[i])] })))}`;
    });
    return { group, admin };
  }
  if (action === 'group') {
    const [g] = await db`select * from santa_groups where id = ${id(body.group)} and expires_at > now()`;
    if (!g) throw new Problem('not_found', 404);
    const people = await db`select id, name, claim_hash is not null as claimed from santa_people where group_id = ${g.id} order by position`;
    return { ...groupInfo(g), people };
  }
  if (action === 'claim') {
    const claim = token(24);
    const [row] = await db`update santa_people p set claim_hash = ${hash(claim)}, claimed_at = now() from santa_groups g
      where p.id = ${id(body.person)} and p.group_id = ${id(body.group)} and g.id = p.group_id and g.expires_at > now() and p.claim_hash is null returning p.id`;
    if (!row) throw new Problem('claimed', 409);
    return { token: claim };
  }
  if (action === 'me' || action === 'wishes') {
    const [me] = await db`select p.*, g.name as group_name, g.budget, g.exchange_date, g.message, g.drawn_at from santa_people p join santa_groups g on g.id = p.group_id
      where p.claim_hash = ${hash(text(body.token, 64))} and g.expires_at > now()`;
    if (!me) throw new Problem('not_found', 404);
    if (action === 'wishes') {
      if (!Array.isArray(body.wishes) || body.wishes.length > santaLimits.wishes) throw new Problem('invalid');
      const wishes = body.wishes.map(wish => text(wish, santaLimits.wish)).filter(Boolean);
      await db`update santa_people set wishes = ${db.json(wishes)} where id = ${me.id}`;
      return { wishes };
    }
    const [receiver] = await db`select name, wishes from santa_people where id = ${me.receiver_id}`;
    return { ...groupInfo({ ...me, name: me.group_name }), group: me.group_id, me: { name: me.name, wishes: me.wishes }, receiver: receiver ?? null };
  }
  // Everything below needs the organizer's token.
  const [g] = await db`select * from santa_groups where admin_hash = ${hash(text(body.admin, 64))} and expires_at > now()`;
  if (!g) throw new Problem('not_found', 404);
  if (action === 'admin') {
    const people = await db`select id, name, claim_hash is not null as claimed, jsonb_array_length(wishes) as wishes from santa_people where group_id = ${g.id} order by position`;
    return { ...groupInfo(g), group: g.id, exclusions: g.exclusions, people };
  }
  if (action === 'unclaim') {
    await db`update santa_people set claim_hash = null, claimed_at = null where id = ${id(body.person)} and group_id = ${g.id}`;
    return { ok: true };
  }
  if (action === 'update') {
    // Same names keep their claim and wish list; new names are added; missing names are removed. Then everyone is drawn again.
    const info = details(body), { people, exclusions, receivers } = roster(body);
    await db.begin(async tx => {
      // Lock the group so two redraws at once (a double click) can't interleave.
      await tx`select 1 from santa_groups where id = ${g.id} for update`;
      const existing = await tx`select id, name from santa_people where group_id = ${g.id}`;
      const byName = new Map(existing.map(row => [String(row.name).toLocaleLowerCase(), String(row.id)]));
      const ids = people.map(name => byName.get(name.toLocaleLowerCase()) ?? token(9));
      await tx`delete from santa_people where group_id = ${g.id} and id not in ${tx(ids)}`;
      for (const [i, name] of people.entries()) {
        const row = { id: ids[i], group_id: g.id, name, position: i, receiver_id: ids[people.indexOf(receivers[i])] };
        await tx`insert into santa_people ${tx(row)} on conflict (id) do update set name = excluded.name, position = excluded.position, receiver_id = excluded.receiver_id`;
      }
      await tx`update santa_groups set name = ${info.name}, budget = ${info.budget}, exchange_date = ${info.date}, message = ${info.message}, exclusions = ${tx.json(exclusions)}, drawn_at = now(), expires_at = ${expiry(info.date)} where id = ${g.id}`;
    });
    return { ok: true };
  }
  if (action === 'delete') {
    await db`delete from santa_groups where id = ${g.id}`;
    return { ok: true };
  }
  throw new Problem('invalid');
}

export const POST: APIRoute = async ({ request }) => {
  if (!sql) return json({ error: 'unavailable' }, 503);
  try {
    if (Number(request.headers.get('content-length')) > 64_000) throw new Problem('invalid', 413);
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 64_000) throw new Problem('invalid', 413);
    const body: unknown = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Problem('invalid');
    await schema(sql);
    return json(await handle(sql, body as Record<string, unknown>));
  } catch (error) {
    if (error instanceof Problem) return json({ error: error.code }, error.status);
    if (error instanceof SyntaxError) return json({ error: 'invalid' }, 400);
    console.error('secret-santa', error);
    return json({ error: 'server' }, 500);
  }
};
