import { LocaleProvider, useTranslation } from '@portfolio/i18n/react';
import { type Locale } from '@portfolio/i18n';
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Check, Copy, Crown, Eye, EyeOff, Gift as GiftIcon, Pencil, Plus, Send, ShieldCheck, Trash2, UserRoundX, X } from 'lucide-react';
import { Button } from '@portfolio/ui/components/button';
import { Input } from '@portfolio/ui/components/input';
import { Textarea } from '@portfolio/ui/components/textarea';
import { Field, FieldGroup, FieldLabel, FieldDescription, FieldError } from '@portfolio/ui/components/field';
import { Alert, AlertTitle, AlertDescription } from '@portfolio/ui/components/alert';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@portfolio/ui/components/alert-dialog';
import { drawNames, parseNames, parseWishes, duplicateNames, sameRoster, santaLimits } from '@portfolio/calculators';
import { SelectField, Settings, ResultRow } from '../calculators/Fields';
import { useSecretSantaStore, useHydrateCalculator, type SantaRoom } from '../../stores/calculators';
import { Gift, Scene, Snowfall, Tree, Santa, Snowman, celebrate } from './Art';

type Info = { name: string; budget: string; date: string; message: string; drawnAt: string };
type Person = { id: string; name: string; claimed: boolean; wishes?: number };
type Me = Info & { group: string; me: { name: string; wishes: string[] }; receiver: { name: string; wishes: string[] } | null };
type Admin = Info & { group: string; exclusions: [string, string][]; people: Person[] };
type Draft = { names: string; group: string; budget: string; date: string; message: string; exclusions: { id: number; a: string; b: string }[] };

async function api<T>(body: Record<string, unknown>): Promise<T> {
  let response: Response;
  try { response = await fetch('/api/santa', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); }
  catch { throw new Error('network'); }
  const data = await response.json().catch(() => ({ error: 'server' }));
  if (!response.ok) throw new Error(data.error ?? 'server');
  return data as T;
}
function useErrors() {
  const { t } = useTranslation();
  return (code: string) => ({
    invalid: t("Check the details and try again."),
    not_found: t("This Secret Santa no longer exists, or the link is incomplete."),
    claimed: t("Someone already chose that name. If it’s you on another device, open your personal link, or ask the organizer to free your name."),
    impossible: t("With these exclusions, no draw works. Remove a pair or add more people."),
    unavailable: t("Secret Santa isn’t connected to its database yet. Try again later."),
  } as Record<string, string>)[code] ?? t("Something went wrong. Check your connection and try again.");
}
const intl = (locale: Locale) => locale === 'es' ? 'es-MX' : 'en-US';
function day(value: string, locale: Locale) {
  const [y, m, d] = value.split('-').map(Number);
  return y && m && d ? new Intl.DateTimeFormat(intl(locale), { dateStyle: 'long', timeZone: 'UTC' }).format(Date.UTC(y, m - 1, d)) : '';
}
const link = (hash: string) => `${location.origin}${location.pathname}#${hash}`;
const go = (hash: string) => { location.hash = hash; };

function TextField({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: (id: string, describedBy?: string) => ReactNode }) {
  const id = useId();
  return <Field data-invalid={error ? true : undefined}><FieldLabel htmlFor={id}>{label}</FieldLabel>{children(id, error ? `${id}-error` : hint ? `${id}-hint` : undefined)}{hint && <FieldDescription id={`${id}-hint`}>{hint}</FieldDescription>}{error && <FieldError id={`${id}-error`}>{error}</FieldError>}</Field>;
}
const Note = ({ children }: { children: ReactNode }) => <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"><ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0" size={16} />{children}</p>;
const Problem = ({ title, children }: { title: string; children: ReactNode }) => <Alert variant="destructive"><AlertTitle>{title}</AlertTitle><AlertDescription>{children}</AlertDescription></Alert>;

/** Copy a link; if the browser blocks the clipboard, show it for manual copying. */
function ShareLink({ url, label, whatsapp, onShare }: { url: string; label: string; whatsapp?: string; onShare?: () => void }) {
  const { t } = useTranslation();
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle');
  async function copy() {
    onShare?.();
    try { await navigator.clipboard.writeText(url); setState('copied'); setTimeout(() => setState('idle'), 2000); } catch { setState('manual'); }
  }
  return <div className="flex flex-col gap-2">
    <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" className="h-11 sm:h-8" onClick={copy}>{state === 'copied' ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />} {state === 'copied' ? t("Copied") : label}</Button>
      {whatsapp && <Button asChild variant="outline" size="sm" className="h-11 sm:h-8"><a href={`https://wa.me/?text=${encodeURIComponent(`${whatsapp}\n${url}`)}`} target="_blank" rel="noopener noreferrer" onClick={onShare}><Send aria-hidden="true" /> WhatsApp</a></Button>}</div>
    {state === 'manual' && <TextField label={t("Copy this link")} hint={t("Your browser blocked copying. Select the link and copy it.")}>{(id, describedBy) => <Input id={id} readOnly value={url} onFocus={event => event.target.select()} aria-describedby={describedBy} />}</TextField>}
  </div>;
}

function Explainer() {
  const { t } = useTranslation();
  return <div className="flex flex-col gap-8">
    <Scene className="pb-1" />
    <div className="flex flex-col gap-3"><h2 className="meta">{t("How it works")}</h2><ol className="flex list-decimal flex-col gap-2 pl-5 leading-7">
      <li>{t("Write everyone’s names, and any couples who shouldn’t draw each other. Create the Secret Santa: names are drawn right away.")}</li>
      <li>{t("Share one group link in your group chat.")}</li>
      <li>{t("Each person opens it, picks their name, opens their gift to see who they give to, and adds a wish list for their Secret Santa.")}</li>
    </ol></div>
    <div className="flex flex-col gap-3"><h2 className="meta">{t("Keep in mind")}</h2><ul className="flex list-disc flex-col gap-2 pl-5 leading-7 text-muted-foreground">
      <li>{t("Nobody draws themselves, and nobody draws the person who drew them.")}</li>
      <li>{t("Nobody can see the whole draw, not even the organizer. Each person sees only who they give to.")}</li>
      <li>{t("Each person picks their own name. If someone picks a name that isn’t theirs, the real person will find it taken; the organizer can free it.")}</li>
      <li>{t("There are no accounts: access is saved in each browser. To use another device, copy your personal link.")}</li>
      <li>{t("Names and wish lists are stored on this site’s database and deleted 30 days after the exchange, or 30 days after the draw if there is no date.")}</li>
    </ul></div>
  </div>;
}

/** The organizer's form, for a new group or to edit one (which draws everyone again). */
function GroupForm({ draft, set, submitLabel, onSubmit, busy, error, editing, redraw = true }: { draft: Draft; set: <K extends keyof Draft>(key: K, value: Draft[K] | ((previous: Draft[K]) => Draft[K])) => void; submitLabel: string; onSubmit: () => void; busy: boolean; error: string; editing?: boolean; redraw?: boolean }) {
  const { t } = useTranslation();
  const people = parseNames(draft.names), duplicates = [...new Set(duplicateNames(people))], long = people.find(name => name.length > santaLimits.name);
  const namesError = !draft.names.trim() ? '' : people.length < 3 ? t("Add at least 3 people.") : people.length > santaLimits.people ? t('Up to {n} people.', { n: santaLimits.people })
    : long ? t('Keep each name under {n} characters: {name}', { n: santaLimits.name + 1, name: long }) : duplicates.length ? t('Each name must be different: {names}', { names: duplicates.join(', ') }) : '';
  const known = new Set(people.map(name => name.toLocaleLowerCase()));
  const pairs = draft.exclusions.filter(pair => known.has(pair.a.toLocaleLowerCase()) && known.has(pair.b.toLocaleLowerCase()));
  const [pick, setPick] = useState({ a: '', b: '' });
  const a = people.includes(pick.a) ? pick.a : people[0] ?? '';
  const b = people.includes(pick.b) && pick.b !== a ? pick.b : people.find(name => name !== a) ?? '';
  const same = (x: string, y: string) => x.toLocaleLowerCase() === y.toLocaleLowerCase();
  const taken = pairs.some(pair => (same(pair.a, a) && same(pair.b, b)) || (same(pair.a, b) && same(pair.b, a)));
  const [confirming, setConfirming] = useState(false), [impossible, setImpossible] = useState(false);
  const ready = people.length >= 3 && !namesError;
  return <FieldGroup>
    <TextField label={t("Participants")} hint={t("One name per line, the way each person should see it. At least 3.")} error={namesError}>{(id, describedBy) => <Textarea id={id} rows={7} value={draft.names} onChange={event => { set('names', event.target.value); setImpossible(false); }} placeholder={'Ana\nLuis\nCarlos\nMaría'} aria-invalid={!!namesError} aria-describedby={describedBy} />}</TextField>
    <TextField label={t("Event name")} hint={t("Optional. Everyone sees it.")}>{(id, describedBy) => <Input id={id} value={draft.group} maxLength={santaLimits.group} onChange={event => set('group', event.target.value)} placeholder={t("Family Christmas")} aria-describedby={describedBy} />}</TextField>
    <div className="grid items-start gap-5 sm:grid-cols-2 lg:grid-cols-1">
      <TextField label={t("Budget")} hint={t("Optional. Include the currency.")}>{(id, describedBy) => <Input id={id} value={draft.budget} maxLength={santaLimits.budget} onChange={event => set('budget', event.target.value)} placeholder={t("$500 MXN")} aria-describedby={describedBy} />}</TextField>
      <TextField label={t("Exchange date")} hint={t("Optional.")}>{(id, describedBy) => <Input id={id} type="date" min="2000-01-01" max="2100-12-31" value={draft.date} onChange={event => set('date', event.target.value)} aria-describedby={describedBy} />}</TextField>
    </div>
    <TextField label={t("Message for everyone")} hint={t('Optional. Up to {n} characters.', { n: santaLimits.message })}>{(id, describedBy) => <Textarea id={id} rows={3} value={draft.message} maxLength={santaLimits.message} onChange={event => set('message', event.target.value)} placeholder={t("Bring your gift wrapped, with the name on it.")} aria-describedby={describedBy} />}</TextField>
    <Settings title={t("Couples and exclusions")} summary={pairs.length ? t('{n} pairs won’t draw each other', { n: pairs.length }) : t("Anyone can draw anyone")}>
      {people.length < 2 ? <p className="text-sm text-muted-foreground">{t("Add names first.")}</p> : <FieldGroup>
        <div className="grid items-end gap-5 sm:grid-cols-2 lg:grid-cols-1"><SelectField label={t("Person")} value={a} onChange={value => setPick({ a: value, b })} options={people.map(name => ({ value: name, label: name }))} /><SelectField label={t("Can’t draw each other with")} value={b} onChange={value => setPick({ a, b: value })} options={people.filter(name => name !== a).map(name => ({ value: name, label: name }))} /></div>
        <Button variant="outline" disabled={!a || !b || taken} onClick={() => { set('exclusions', previous => [...previous, { id: Date.now(), a, b }]); setImpossible(false); }}><Plus aria-hidden="true" /> {t("Add pair")}</Button>
        {pairs.length > 0 && <ul className="flex flex-col">{pairs.map(pair => <li key={pair.id} className="flex items-center justify-between gap-3 border-b py-1 text-sm"><span>{pair.a} · {pair.b}</span><Button variant="ghost" size="icon" aria-label={t('Remove {a} and {b}', { a: pair.a, b: pair.b })} onClick={() => { set('exclusions', previous => previous.filter(item => item.id !== pair.id)); setImpossible(false); }}><X aria-hidden="true" /></Button></li>)}</ul>}
      </FieldGroup>}
    </Settings>
    {(impossible || error) && <Problem title={impossible ? t("No valid draw") : t("Couldn’t save")}>{impossible ? t("With these exclusions, no draw works. Remove a pair or add more people.") : error}</Problem>}
    <Button size="lg" disabled={!ready || busy} onClick={() => { if (!redraw) onSubmit(); else if (drawNames(people, pairs.map(pair => [pair.a, pair.b]))) setConfirming(true); else setImpossible(true); }}>{redraw ? <GiftIcon aria-hidden="true" /> : <Check aria-hidden="true" />} {busy ? (redraw ? t("Drawing names…") : t("Saving…")) : submitLabel}</Button>
    <AlertDialog open={confirming} onOpenChange={setConfirming}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{editing ? t("Draw everyone again?") : t("Before you create it")}</AlertDialogTitle><AlertDialogDescription>{t('Check the names: {n} people.', { n: people.length })}</AlertDialogDescription></AlertDialogHeader>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-6 text-muted-foreground">
          {editing ? <><li>{t("Everyone gets a new person to give to, including people who already looked.")}</li><li>{t("People who stay keep their name and wish list. People you removed lose access.")}</li></>
            : <><li>{t("Names are drawn as soon as you create it. You’ll see who joined, never who drew whom.")}</li><li>{t("Changing the people later draws everyone again.")}</li></>}
          <li>{draft.date ? t("Names and wish lists are stored until 30 days after the exchange.") : t("Names and wish lists are stored until 30 days after the draw.")}</li>
        </ul>
        <AlertDialogFooter><AlertDialogCancel>{t("Go back")}</AlertDialogCancel><AlertDialogAction onClick={onSubmit}>{submitLabel}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </FieldGroup>;
}

function Home({ draft, set, rooms, addRoom, reset }: { draft: Draft; set: Parameters<typeof GroupForm>[0]['set']; rooms: SantaRoom[]; addRoom: (room: SantaRoom) => void; reset: () => void }) {
  const { t } = useTranslation();
  const message = useErrors();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const button = useRef<HTMLDivElement>(null);
  async function create() {
    setBusy(true); setError('');
    try {
      const people = parseNames(draft.names), known = new Set(people.map(name => name.toLocaleLowerCase()));
      const { group, admin } = await api<{ group: string; admin: string }>({ action: 'create', name: draft.group, budget: draft.budget, date: draft.date, message: draft.message, people, exclusions: draft.exclusions.filter(pair => known.has(pair.a.toLocaleLowerCase()) && known.has(pair.b.toLocaleLowerCase())).map(pair => [pair.a, pair.b]) });
      addRoom({ group, title: draft.group.trim(), admin, token: '' });
      celebrate(button.current);
      go(`a=${admin}`);
    } catch (err) { setError(message((err as Error).message)); } finally { setBusy(false); }
  }
  return <div className="tool-workspace">
    <aside className="tool-pane-inputs" aria-label={t("Inputs")}>
      {rooms.length > 0 && <div className="flex flex-col gap-2"><h2 className="meta">{t("Your Secret Santas")}</h2><ul className="flex flex-col">{rooms.map(room => <li key={room.group} className="flex flex-wrap items-center gap-2 border-b py-2"><span className="min-w-0 flex-1 truncate font-medium">{room.title || t("Secret Santa")}</span>
        {room.admin && <Button variant="outline" size="sm" className="h-11 sm:h-8" onClick={() => go(`a=${room.admin}`)}><Crown aria-hidden="true" /> {t("Organize")}</Button>}
        <Button variant="outline" size="sm" className="h-11 sm:h-8" onClick={() => go(`g=${room.group}`)}><GiftIcon aria-hidden="true" /> {room.token ? t("My gift") : t("Join")}</Button></li>)}</ul></div>}
      <h2 className="text-xl font-medium tracking-tight">{t("New Secret Santa")}</h2>
      <div ref={button}><GroupForm draft={draft} set={set} submitLabel={t("Create Secret Santa")} onSubmit={create} busy={busy} error={error} /></div>
      <div className="mt-auto flex flex-col items-start gap-3 border-t pt-5"><Note>{t("Names and wish lists are stored on this site’s database, without accounts, until the group is deleted.")}</Note><Button variant="ghost" size="sm" className="-ml-2.5 h-11 sm:h-8" onClick={reset}>{t("Clear form")}</Button></div>
    </aside>
    <section className="tool-pane-result" aria-label={t("How it works")}><Explainer /></section>
  </div>;
}

function Organizer({ admin, addRoom, removeRoom }: { admin: string; addRoom: (room: SantaRoom) => void; removeRoom: (group: string) => void }) {
  const { t, locale } = useTranslation();
  const message = useErrors();
  const [data, setData] = useState<Admin | null>(null), [error, setError] = useState(''), [editing, setEditing] = useState<Draft | null>(null), [busy, setBusy] = useState(false), [saveError, setSaveError] = useState('');
  const load = useCallback(() => api<Admin>({ action: 'admin', admin }).then(result => { setData(result); addRoom({ group: result.group, title: result.name, admin, token: '' }); }).catch(err => setError(message(err.message))), [admin]);
  useEffect(() => { void load(); }, [load]);
  if (error) return <Single><Problem title={t("Can’t open this Secret Santa")}>{error}</Problem></Single>;
  if (!data) return <Single><p className="text-muted-foreground">{t("Loading…")}</p></Single>;
  const joined = data.people.filter(person => person.claimed).length;
  async function save() {
    if (!editing) return;
    setBusy(true); setSaveError('');
    try {
      const { redrawn } = await api<{ redrawn: boolean }>({ action: 'update', admin, name: editing.group, budget: editing.budget, date: editing.date, message: editing.message, people: parseNames(editing.names), exclusions: editing.exclusions.map(pair => [pair.a, pair.b]) });
      setEditing(null); if (redrawn) celebrate(); await load();
    } catch (err) { setSaveError(message((err as Error).message)); } finally { setBusy(false); }
  }
  // Same check as the server: only changing the people or exclusions draws everyone again.
  const redraw = !!editing && !sameRoster(parseNames(editing.names), editing.exclusions.map(pair => [pair.a, pair.b]), data.people.map(person => person.name), data.exclusions);
  const setEdit: Parameters<typeof GroupForm>[0]['set'] = (key, value) => setEditing(previous => previous && ({ ...previous, [key]: typeof value === 'function' ? (value as (p: unknown) => unknown)(previous[key]) : value }));
  return <div className="tool-workspace">
    <aside className="tool-pane-inputs" aria-label={t("Details")}>
      {editing ? <><div className="flex flex-col gap-2"><h2 className="text-xl font-medium tracking-tight">{t("Edit Secret Santa")}</h2><Note>{redraw ? t("You changed the people or exclusions, so saving draws everyone again.") : t("Everyone keeps who they give to. Changing the people or exclusions draws everyone again.")}</Note></div><GroupForm draft={editing} set={setEdit} submitLabel={redraw ? t("Save and draw again") : t("Save changes")} onSubmit={save} busy={busy} error={saveError} editing redraw={redraw} /><Button variant="ghost" onClick={() => setEditing(null)}>{t("Cancel")}</Button></>
        : <div className="flex flex-col gap-5">
          <div><p className="meta flex items-center gap-1.5"><Crown aria-hidden="true" size={14} /> {t("You organize")}</p><h2 className="mt-1 text-xl font-medium tracking-tight">{data.name || t("Secret Santa")}</h2></div>
          <dl><ResultRow label={t("People")} value={String(data.people.length)} />{data.budget && <ResultRow label={t("Budget")} value={data.budget} />}{data.date && <ResultRow label={t("Exchange date")} value={day(data.date, locale)} />}<ResultRow label={t("Couples and exclusions")} value={String(data.exclusions.length)} /></dl>
          {data.message && <p className="whitespace-pre-line rounded-xl border p-4 text-sm leading-6">{data.message}</p>}
          <Button variant="outline" onClick={() => setEditing({ names: data.people.map(person => person.name).join('\n'), group: data.name, budget: data.budget, date: data.date, message: data.message, exclusions: data.exclusions.map(([a, b], i) => ({ id: i, a, b })) })}><Pencil aria-hidden="true" /> {t("Edit")}</Button>
          <div className="flex flex-col gap-2"><p className="text-sm font-medium">{t("Your organizer link")}</p><p className="text-xs leading-5 text-muted-foreground">{t("Keep it private: it manages the group. It is saved in this browser; copy it to organize from another device.")}</p><ShareLink url={link(`a=${admin}`)} label={t("Copy organizer link")} /></div>
          <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" className="justify-start text-destructive"><Trash2 aria-hidden="true" /> {t("Delete Secret Santa")}</Button></AlertDialogTrigger>
            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t("Delete this Secret Santa?")}</AlertDialogTitle><AlertDialogDescription>{t("Everyone loses access, and the names and wish lists are deleted. This can’t be undone.")}</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>{t("Keep it")}</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={async () => { try { await api({ action: 'delete', admin }); removeRoom(data.group); go(''); } catch (err) { setError(message((err as Error).message)); } }}>{t("Delete")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
        </div>}
    </aside>
    <section className="tool-pane-result" aria-label={t("Group")}>
      <div className="flex flex-col gap-6">
        <div className="flex items-end gap-4"><Santa className="h-16 w-auto shrink-0" /><div><h2 className="text-xl font-medium tracking-tight">{t("Share the group link")}</h2><p className="text-sm leading-6 text-muted-foreground">{t("Send this one link to the group chat. Each person picks their name and sees who they give to.")}</p></div></div>
        <ShareLink url={link(`g=${data.group}`)} label={t("Copy group link")} whatsapp={data.name ? t('Join our Secret Santa, {name}! Pick your name to see who you give to:', { name: data.name }) : t("Join our Secret Santa! Pick your name to see who you give to:")} />
        <div className="flex flex-col gap-2"><div className="flex items-baseline justify-between gap-3"><h3 className="meta">{t('{joined} of {total} joined', { joined, total: data.people.length })}</h3><Button variant="link" size="sm" className="h-11 sm:h-8" onClick={() => go(`g=${data.group}`)}>{t("Join as a participant")}</Button></div>
          <ul className="flex flex-col">{data.people.map(person => <li key={person.id} className="flex flex-wrap items-center gap-3 border-b py-3">
            <span className="min-w-0 flex-1 font-medium">{person.name}</span>
            <span className="meta">{person.claimed ? t('Joined · {n} wishes', { n: person.wishes ?? 0 }) : t("Waiting")}</span>
            {person.claimed && <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="h-11 sm:h-8" aria-label={t('Free {name}’s name', { name: person.name })}><UserRoundX aria-hidden="true" /> {t("Free name")}</Button></AlertDialogTrigger>
              <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t('Free {name}’s name?', { name: person.name })}</AlertDialogTitle><AlertDialogDescription>{t("Use this if someone picked the wrong name or lost access. Whoever has it now loses access, and the name can be picked again from the group link. The wish list stays.")}</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>{t("Cancel")}</AlertDialogCancel><AlertDialogAction onClick={async () => { try { await api({ action: 'unclaim', admin, person: person.id }); await load(); } catch (err) { setError(message((err as Error).message)); } }}>{t("Free name")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}
          </li>)}</ul></div>
        <Note>{t("You see who joined, never who drew whom. If you take part too, join with your own name like everyone else.")}</Note>
      </div>
    </section>
  </div>;
}

function Join({ group, addRoom }: { group: string; addRoom: (room: SantaRoom) => void }) {
  const { t, locale } = useTranslation();
  const message = useErrors();
  const [data, setData] = useState<(Info & { people: Person[] }) | null>(null), [error, setError] = useState(''), [claimError, setClaimError] = useState(''), [choice, setChoice] = useState<Person | null>(null);
  const load = useCallback(() => api<Info & { people: Person[] }>({ action: 'group', group }).then(setData).catch(err => setError(message(err.message))), [group]);
  useEffect(() => { void load(); }, [load]);
  if (error) return <Single><Problem title={t("Can’t open this Secret Santa")}>{error}</Problem></Single>;
  if (!data) return <Single><p className="text-muted-foreground">{t("Loading…")}</p></Single>;
  async function claim(person: Person) {
    try {
      const { token } = await api<{ token: string }>({ action: 'claim', group, person: person.id });
      addRoom({ group, title: data!.name, admin: '', token });
      celebrate();
    } catch (err) { setChoice(null); setClaimError(message((err as Error).message)); await load(); }
  }
  return <div className="tool-workspace">
    <aside className="tool-pane-inputs" aria-label={t("Details")}><Details info={data} locale={locale} /></aside>
    <section className="tool-pane-result" aria-label={t("Pick your name")}>
      <div className="flex flex-col gap-6">
        <div className="flex items-end gap-4"><Snowman className="h-16 w-auto shrink-0" /><div><h2 className="text-xl font-medium tracking-tight">{t("Who are you?")}</h2><p className="text-sm leading-6 text-muted-foreground">{t("Pick your own name. Only you will see who you give to.")}</p></div></div>
        <ul className="grid gap-2 @xl:grid-cols-2">{data.people.map(person => <li key={person.id}><Button variant="outline" className="h-auto min-h-12 w-full justify-between whitespace-normal py-2" disabled={person.claimed} onClick={() => setChoice(person)}><span className="font-medium">{person.name}</span>{person.claimed && <span className="meta">{t("Taken")}</span>}</Button></li>)}</ul>
        {claimError && <Problem title={t("Couldn’t pick that name")}>{claimError}</Problem>}
        <AlertDialog open={!!choice} onOpenChange={open => !open && setChoice(null)}>
          <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t('Are you {name}?', { name: choice?.name ?? '' })}</AlertDialogTitle><AlertDialogDescription>{t("This name becomes yours on this device. Picking someone else’s name would spoil their surprise.")}</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>{t("Go back")}</AlertDialogCancel><AlertDialogAction onClick={() => choice && claim(choice)}>{t('Yes, I’m {name}', { name: choice?.name ?? '' })}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
        <Note>{t("If your name is taken and you didn’t pick it, ask the organizer to free it.")}</Note>
      </div>
    </section>
  </div>;
}

function Details({ info, locale }: { info: Info; locale: Locale }) {
  const { t } = useTranslation();
  return <div className="flex flex-col gap-5">
    <div className="flex items-end gap-3"><Tree className="festive-sway h-14 w-auto shrink-0" /><div><p className="meta">{t("Secret Santa")}</p>{info.name && <h2 className="mt-1 text-xl font-medium tracking-tight">{info.name}</h2>}</div></div>
    {(info.budget || info.date) && <dl>{info.budget && <ResultRow label={t("Budget")} value={info.budget} />}{info.date && <ResultRow label={t("Exchange date")} value={day(info.date, locale)} />}</dl>}
    {info.message && <p className="whitespace-pre-line rounded-xl border p-4 text-sm leading-6">{info.message}</p>}
  </div>;
}

function Wishes({ token, initial }: { token: string; initial: string[] }) {
  const { t } = useTranslation();
  const message = useErrors();
  const [wishes, setWishes] = useState(initial), [entry, setEntry] = useState(''), [paste, setPaste] = useState(''), [status, setStatus] = useState(''), [error, setError] = useState('');
  const pasted = parseWishes(paste);
  const room = santaLimits.wishes - wishes.length;
  async function save(next: string[]) {
    const previous = wishes;
    setWishes(next); setStatus(t("Saving…")); setError('');
    try { const result = await api<{ wishes: string[] }>({ action: 'wishes', token, wishes: next }); setWishes(result.wishes); setStatus(t("Saved")); }
    catch (err) { setWishes(previous); setStatus(''); setError(message((err as Error).message)); }
  }
  return <div className="flex flex-col gap-4">
    <div className="flex items-baseline justify-between gap-3"><h2 className="font-medium">{t("Your wish list")}</h2><span className="meta" aria-live="polite">{status}</span></div>
    <p className="text-xs leading-5 text-muted-foreground">{t("Whoever drew you sees this list. You never see who drew you.")}</p>
    {wishes.length > 0 ? <ul className="flex flex-col">{wishes.map((wish, i) => <li key={`${i}-${wish}`} className="flex items-center gap-2 border-b py-1 text-sm"><GiftIcon aria-hidden="true" className="festive-accent shrink-0" size={16} /><span className="min-w-0 flex-1 break-words">{wish}</span><Button variant="ghost" size="icon" aria-label={t('Remove {wish}', { wish })} onClick={() => save(wishes.filter((_, j) => j !== i))}><X aria-hidden="true" /></Button></li>)}</ul>
      : <p className="text-sm text-muted-foreground">{t("No wishes yet.")}</p>}
    <form className="flex gap-2" onSubmit={event => { event.preventDefault(); if (entry.trim() && room > 0) { void save([...wishes, ...parseWishes(entry)].slice(0, santaLimits.wishes)); setEntry(''); } }}>
      <Input aria-label={t("Add a wish")} value={entry} maxLength={santaLimits.wish} onChange={event => setEntry(event.target.value)} placeholder={t("A book, a mug, socks…")} disabled={room <= 0} />
      <Button type="submit" variant="outline" disabled={!entry.trim() || room <= 0}><Plus aria-hidden="true" /> {t("Add")}</Button>
    </form>
    <Settings title={t("Paste a list")} summary={t("From your notes: each line becomes a wish")}>
      <FieldGroup>
        <TextField label={t("Your list")} hint={t("Bullets, numbers, and checkboxes are removed.")}>{(id, describedBy) => <Textarea id={id} rows={5} value={paste} onChange={event => setPaste(event.target.value)} placeholder={'- Audífonos\n- Libro de cocina\n- Taza navideña'} aria-describedby={describedBy} />}</TextField>
        <Button variant="outline" disabled={!pasted.length || room <= 0} onClick={() => { void save([...wishes, ...pasted].slice(0, santaLimits.wishes)); setPaste(''); }}><Plus aria-hidden="true" /> {t('Add {n} wishes', { n: Math.min(pasted.length, Math.max(room, 0)) })}</Button>
        {pasted.length > room && <p className="text-xs text-muted-foreground">{t('Up to {n} wishes; the rest are left out.', { n: santaLimits.wishes })}</p>}
      </FieldGroup>
    </Settings>
    {error && <Problem title={t("Couldn’t save")}>{error}</Problem>}
  </div>;
}

function Participant({ token, forget }: { token: string; forget: () => void }) {
  const { t, locale } = useTranslation();
  const message = useErrors();
  const [data, setData] = useState<Me | null>(null), [error, setError] = useState('');
  // The unwrapping plays once; later visits start hidden, so opening the link in front of others doesn't give it away.
  const seenKey = `santa-seen:${token}`;
  const [view, setView] = useState<'new' | 'shown' | 'hidden'>(() => { try { return localStorage.getItem(seenKey) ? 'hidden' : 'new'; } catch { return 'new'; } });
  const open = view === 'shown';
  const gift = useRef<HTMLDivElement>(null);
  useEffect(() => { api<Me>({ action: 'me', token }).then(setData).catch(err => setError(err.message)); }, [token]);
  if (error) return <Single><Problem title={t("Can’t open your gift")}>{error === 'not_found' ? t("Your access to this Secret Santa ended: the organizer may have freed your name, changed the people, or deleted it.") : message(error)}</Problem>{error === 'not_found' && <Button variant="outline" className="mt-4 self-start" onClick={forget}>{t("Pick my name again")}</Button>}</Single>;
  if (!data) return <Single><p className="text-muted-foreground">{t("Loading…")}</p></Single>;
  return <div className="tool-workspace">
    <aside className="tool-pane-inputs" aria-label={t("Details")}>
      <Details info={data} locale={locale} />
      <Wishes token={token} initial={data.me.wishes} />
      <div className="mt-auto flex flex-col gap-3 border-t pt-5">
        <p className="text-sm">{t('You are {name}.', { name: data.me.name })}</p>
        <p className="text-xs leading-5 text-muted-foreground">{t("Your access is saved in this browser. To open it on another device, copy your personal link. Don’t share it: it shows who you give to.")}</p>
        <ShareLink url={link(`p=${token}`)} label={t("Copy my personal link")} />
      </div>
    </aside>
    <section className="tool-pane-result" aria-label={t("Your gift")}>
      {!data.receiver ? <Problem title={t("No assignment yet")}>{t("Ask the organizer to draw again.")}</Problem>
        : <div className="flex flex-col items-center gap-6 text-center">
          <div ref={gift} className="pt-6"><Gift open={open} className="h-40 w-40" /></div>
          {view === 'new' ? <div className="flex max-w-md flex-col items-center gap-4"><h2 className="text-xl font-medium tracking-tight">{t('Hi, {name}', { name: data.me.name })}</h2><p className="leading-7 text-muted-foreground">{t("Your gift is ready. Open it somewhere nobody can see your screen.")}</p><Button size="lg" onClick={() => { setView('shown'); try { localStorage.setItem(seenKey, '1'); } catch { /* private mode: the unwrapping plays again next time */ } celebrate(gift.current); }}><GiftIcon aria-hidden="true" /> {t("See who I give to")}</Button></div>
            : <div className="gift-reveal flex w-full max-w-md flex-col items-center gap-5">
              <Receiver person={open ? data.receiver : decoy(data.receiver.wishes.length)} hidden={!open} />
              <Button variant={open ? 'outline' : 'default'} onClick={() => setView(open ? 'hidden' : 'shown')}>{open ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />} {open ? t("Hide") : t("Show")}</Button>
            </div>}
        </div>}
    </section>
  </div>;
}

// Hidden view: the blur covers made-up content of the same shape, never the real name or wishes.
const decoyWishes = ['A surprise gift', 'Something handmade for the holidays', 'A good book'];
const decoy = (count: number) => ({ name: 'Santa Claus', wishes: Array.from({ length: count }, (_, i) => decoyWishes[i % decoyWishes.length]) });

function Receiver({ person, hidden }: { person: { name: string; wishes: string[] }; hidden: boolean }) {
  const { t } = useTranslation();
  const blur = hidden ? 'pointer-events-none select-none blur-md' : '';
  return <>
    <div><p className="meta">{t("You give a gift to")}</p><p className={`result-value mt-1 ${blur}`} aria-hidden={hidden || undefined}>{person.name}</p><p className="text-xs text-muted-foreground">{t("Keep it secret.")}</p></div>
    <div className={`w-full rounded-2xl border p-5 text-left ${blur}`} aria-hidden={hidden || undefined}><h3 className="font-medium">{t('{name}’s wish list', { name: person.name })}</h3>
      {person.wishes.length ? <ul className="mt-3 flex flex-col">{person.wishes.map((wish, i) => <li key={i} className="flex items-start gap-2 border-b py-2 text-sm last:border-0"><GiftIcon aria-hidden="true" className="festive-accent mt-0.5 shrink-0" size={16} /><span className="break-words">{wish}</span></li>)}</ul>
        : <p className="mt-2 text-sm text-muted-foreground">{t('{name} hasn’t added wishes yet. Check back later.', { name: person.name })}</p>}</div>
  </>;
}

const Single = ({ children }: { children: ReactNode }) => <div className="tool-workspace"><section className="tool-pane-result flex flex-col lg:col-span-full"><div className="flex max-w-prose flex-col">{children}<a className="text-link mt-6 text-sm" href={location.pathname}>{useTranslation().t("Start a new Secret Santa")}</a></div></section></div>;

function SecretSantaContent() {
  const store = useSecretSantaStore;
  useHydrateCalculator(store);
  const { values, set } = store();
  const [hash, setHash] = useState<string | null>(null);
  useEffect(() => { const read = () => setHash(location.hash.slice(1)); read(); addEventListener('hashchange', read); return () => removeEventListener('hashchange', read); }, []);
  const addRoom = useCallback((room: SantaRoom) => set('rooms', rooms => {
    const existing = rooms.find(item => item.group === room.group);
    const merged = { group: room.group, title: room.title || existing?.title || '', admin: room.admin || existing?.admin || '', token: room.token || existing?.token || '' };
    return [merged, ...rooms.filter(item => item.group !== room.group)].slice(0, 20);
  }), [set]);
  const [kind, value] = (hash ?? '').split(/=(.*)/s);
  // A personal link (#p=token) is saved, then the address bar shows only the group, so the token isn't left on screen.
  useEffect(() => {
    if (kind !== 'p' || !value) return;
    api<Me>({ action: 'me', token: value }).then(me => { addRoom({ group: me.group, title: me.name, admin: '', token: value }); history.replaceState(null, '', `#g=${me.group}`); setHash(`g=${me.group}`); }).catch(() => setHash('g=missing'));
  }, [kind, value, addRoom]);
  // The server renders the form; the view for a link is chosen after hydration.
  let view: ReactNode;
  if (hash === null || !kind || !value) view = <Home draft={values} set={set as Parameters<typeof GroupForm>[0]['set']} rooms={values.rooms} addRoom={addRoom} reset={() => { set('names', ''); set('group', ''); set('budget', ''); set('date', ''); set('message', ''); set('exclusions', []); }} />;
  else if (kind === 'a') view = <Organizer key={value} admin={value} addRoom={addRoom} removeRoom={group => set('rooms', rooms => rooms.filter(item => item.group !== group))} />;
  else if (kind === 'g') {
    const room = values.rooms.find(item => item.group === value);
    view = room?.token ? <Participant key={room.token} token={room.token} forget={() => set('rooms', rooms => rooms.map(item => item.group === value ? { ...item, token: '' } : item))} /> : <Join key={value} group={value} addRoom={addRoom} />;
  } else view = <Single><p className="text-muted-foreground">…</p></Single>;
  return <>{hash !== null && <Snowfall />}{view}</>;
}

export default function SecretSanta({ locale = 'en' }: { locale?: Locale }) {
  return <LocaleProvider locale={locale}><SecretSantaContent /></LocaleProvider>;
}
