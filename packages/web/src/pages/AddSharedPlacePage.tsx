import { useEffect, useMemo, useRef, useState } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Collapsible, CollapsibleGroup } from '@astryxdesign/core/Collapsible';
import { List, ListItem } from '@astryxdesign/core/List';
import { Selector } from '@astryxdesign/core/Selector';
import { Spinner } from '@astryxdesign/core/Spinner';
import { HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { PushScreen } from '../components/shell/Screens';
import { Card } from '../components/toss/Card';
import { InstallHint } from '../components/InstallHint';
import { byName, CATEGORY_LABEL, fromHit, PlaceSearch, type NewPlace } from '../editor/PlaceSearch';
import { trips } from '../lib/db';
import { t } from '../lib/i18n';
import { ApiError, resolvePlace, searchPlaces, type PlaceHit } from '../lib/pairing';
import { sharedParamsFromSearch, sharedPlaceTerm, sharedUrl } from '../lib/placeShare';
import { navigate } from '../lib/router';
import { defaultHome } from '../lib/settings';
import { addPlace, emptyPlan, newDoc, removePlace, savePlan, type TripDoc } from '../lib/trips';

const NEW = 'new';

/** Where the shared place should go: an existing trip, a brand-new blank trip, or the auto "받은 장소" collection. */
type Intent = { existingId: string } | { collection: true } | { new: true };

/** What was just added — enough to open it, move it, or undo it cleanly. */
interface AddState {
  tripId: string;
  placeRef: string;
  created: boolean; // the trip was created just for this add → undo removes the whole trip
  prevDoc: TripDoc | null; // the target's state before adding → undo restores it (null when `created`)
  doc: TripDoc; // the saved trip now holding the place
  place: NewPlace;
}

type Status = 'resolving' | 'added' | 'undone' | 'noTerm' | 'failed' | 'restored';

/**
 * The outcome, stored on this /add history entry. The share query stays in the URL, so without it, coming Back from the
 * editor (or reloading) would mount the page fresh and add the same place a second time — possibly into another trip.
 */
interface AddMarker {
  status: 'added' | 'undone';
  tripId: string;
  tripName: string;
  placeName: string;
}
const MARK = 'tteonaljidoAdd';
const readMarker = (): AddMarker | null => {
  const s: unknown = history.state;
  return s && typeof s === 'object' && MARK in s ? ((s as Record<string, AddMarker>)[MARK] ?? null) : null;
};
const writeMarker = (status: AddMarker['status'], a: AddState) =>
  history.replaceState({ ...(history.state ?? {}), [MARK]: { status, tripId: a.tripId, tripName: a.doc.plan.name, placeName: a.place.name } satisfies AddMarker }, '');

/**
 * Landing page for the GET Web Share Target (`/add?title=…&text=…&url=…`). The shared place is resolved to coordinates
 * with the existing Kakao keyword search (same-origin relay, no new key) — or added by name only when search is off or
 * finds nothing — and then **added automatically**: no manual trip pick, no tapping a candidate. It lands in the most
 * recent trip, or a fresh "받은 장소" collection when there are none yet. The user can open it, undo, move it to another
 * trip, or correct the place afterwards. Reuses the editor's own `addPlace`/`removePlace`/`savePlan`.
 */
export function AddSharedPlacePage() {
  const params = useMemo(() => sharedParamsFromSearch(location.search), []);
  const term = useMemo(() => sharedPlaceTerm(params), [params]);

  const [status, setStatus] = useState<Status>('resolving');
  const [docs, setDocs] = useState<TripDoc[]>([]); // trips at landing, for the "move to" picker
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [add, setAdd] = useState<AddState | null>(null);
  const [restored, setRestored] = useState<AddMarker | null>(null); // result of an earlier visit to this entry
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ran = useRef(false); // guard the one-time auto-add (React StrictMode runs effects twice in dev)

  // ---- db operations (reuse the editor's pure plan edits) ----

  const doAdd = async (intent: Intent, place: NewPlace): Promise<AddState> => {
    let doc: TripDoc;
    let created: boolean;
    let prevDoc: TripDoc | null;
    if ('existingId' in intent) {
      const got = await trips.get(intent.existingId);
      if (got) {
        doc = got;
        created = false;
        prevDoc = got;
      } else {
        doc = await newDoc(emptyPlan(), defaultHome());
        created = true;
        prevDoc = null;
      }
    } else if ('collection' in intent) {
      doc = await newDoc({ ...emptyPlan(), name: t('add.collectionName') }, defaultHome());
      created = true;
      prevDoc = null;
    } else {
      doc = await newDoc(emptyPlan(), defaultHome());
      created = true;
      prevDoc = null;
    }
    const withPlace = addPlace(doc.plan, place); // appends, so the new place is always last
    const placeRef = withPlace.places[withPlace.places.length - 1].placeRef;
    const next = await savePlan(doc, withPlace, defaultHome()); // home comes from 설정
    await trips.put(next);
    return { tripId: next.tripId, placeRef, created, prevDoc, doc: next, place };
  };

  const revert = async (a: AddState) => {
    if (a.created) await trips.remove(a.tripId);
    else if (a.prevDoc) await trips.put(a.prevDoc);
  };

  // ---- one-time auto-add on landing ----

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    // Already handled on this history entry (Back from the editor, or a reload): show the result, don't add again.
    const prior = readMarker();
    if (prior) {
      setRestored(prior);
      setStatus(prior.status === 'undone' ? 'undone' : 'restored');
      return;
    }
    void (async () => {
      try {
        // Prefer the shared title; if there's only a link, ask the server to read the place name from it.
        let name = term;
        if (!name) {
          const u = sharedUrl(params);
          if (u) {
            try {
              name = (await resolvePlace(u)).name;
            } catch {
              /* resolve failed → fall through to noTerm */
            }
          }
        }
        if (!name) {
          setStatus('noTerm');
          return;
        }
        const all = await trips.all();
        setDocs(all);
        let found: PlaceHit[] = [];
        try {
          found = await searchPlaces(name);
        } catch (e) {
          if (!(e instanceof ApiError && e.status === 503)) setNote(t('place.search.failed'));
        }
        setHits(found);
        const place = found[0] ? fromHit(found[0]) : byName(name);
        const intent: Intent = all[0] ? { existingId: all[0].tripId } : { collection: true };
        const added = await doAdd(intent, place);
        setAdd(added);
        writeMarker('added', added);
        setStatus('added');
      } catch {
        setStatus('failed'); // storage unavailable or a write failed: say so instead of spinning forever
      }
    })();
  }, [term]);

  // ---- corrections (each keeps the place in exactly one trip) ----

  const undo = async () => {
    if (!add || busy) return;
    setBusy(true);
    try {
      await revert(add);
      writeMarker('undone', add);
      setStatus('undone');
    } catch {
      setNote(t('add.failed'));
    } finally {
      setBusy(false);
    }
  };

  /** Move the same place to a different trip: take it out of the current one, put it in the chosen one. */
  const changeTrip = async (value: string) => {
    if (!add || busy || value === add.tripId) return;
    setBusy(true);
    try {
      await revert(add);
      const moved = await doAdd(value === NEW ? { new: true } : { existingId: value }, add.place);
      setAdd(moved);
      writeMarker('added', moved);
    } catch {
      setNote(t('add.failed'));
    } finally {
      setBusy(false);
    }
  };

  /** Keep the trip, swap the place (a different candidate, or a manual search result). */
  const rechoose = async (place: NewPlace) => {
    if (!add || busy) return;
    setBusy(true);
    try {
      const without = removePlace(add.doc.plan, add.placeRef);
      const withNew = addPlace(without, place);
      const placeRef = withNew.places[withNew.places.length - 1].placeRef;
      const next = await savePlan(add.doc, withNew, defaultHome());
      await trips.put(next);
      const swapped = { ...add, placeRef, doc: next, place };
      setAdd(swapped);
      writeMarker('added', swapped);
    } catch {
      setNote(t('add.failed'));
    } finally {
      setBusy(false);
    }
  };

  // Trips offered in the "move to" picker: the current one first, then the rest, then a new trip.
  const targetOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { value: string; label: string }[] = [];
    const push = (d: TripDoc) => {
      if (seen.has(d.tripId)) return;
      seen.add(d.tripId);
      opts.push({ value: d.tripId, label: d.plan.name });
    };
    if (add) push(add.doc);
    docs.forEach(push);
    opts.push({ value: NEW, label: t('add.newTrip') });
    return opts;
  }, [add, docs]);

  // One bottom CTA per state (toss.md): the next step filled, "home" beside it as the secondary.
  const goHome = (primary: boolean) =>
    primary ? (
      <div>
        <Button label={t('add.goHome')} variant="primary" size="lg" width="100%" onClick={() => navigate('/')} />
      </div>
    ) : (
      <div className="is-secondary">
        <Button label={t('add.goHome')} variant="secondary" size="lg" onClick={() => navigate('/')} />
      </div>
    );
  const openTrip = (tripId: string) => (
    <div>
      <Button label={t('add.open')} variant="primary" size="lg" width="100%" onClick={() => navigate(`/trips/${tripId}`)} />
    </div>
  );
  const cta =
    status === 'added' && add ? (
      <>
        {goHome(false)}
        {openTrip(add.tripId)}
      </>
    ) : status === 'restored' && restored ? (
      <>
        {goHome(false)}
        {openTrip(restored.tripId)}
      </>
    ) : status === 'undone' || status === 'failed' || status === 'noTerm' ? (
      goHome(true)
    ) : undefined;

  return (
    <PushScreen title={t('add.title')} onBack={() => navigate('/')} cta={cta}>
      <div className="tn-pad" style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
        <InstallHint />
        {status === 'noTerm' && <Banner status="info" title={t('add.noTerm')} />}

        {status === 'resolving' && (
          <HStack gap={2} vAlign="center">
            <Spinner />
            <Text color="secondary">{t('add.saving')}</Text>
          </HStack>
        )}

        {status === 'failed' && <Banner status="error" title={t('add.failed')} />}
        {status === 'undone' && <Banner status="info" title={t('add.undone')} />}
        {status === 'restored' && restored && <Banner status="success" title={t('add.added', { name: restored.placeName, trip: restored.tripName })} />}

        {status === 'added' && add && (
          <>
            <Banner
              status="success"
              title={t('add.added', { name: add.place.name, trip: add.doc.plan.name })}
              description={add.place.latE7 === null ? t('add.added.nameOnly') : undefined}
            />
            {note && <Banner status="warning" title={note} />}

            <Card>
              <CollapsibleGroup type="multiple" hasDividers density="balanced">
                <Collapsible value="trip" trigger={<Text type="label">{t('add.changeTrip')}</Text>}>
                  <Selector label={t('add.target')} options={targetOptions} value={add.tripId} onChange={(v) => void changeTrip(v)} />
                </Collapsible>

                {hits.length > 1 && (
                  <Collapsible value="place" trigger={<Text type="label">{t('add.otherPlace')}</Text>}>
                    <List hasDividers>
                      {hits.map((h) => (
                        <ListItem key={h.externalId} label={h.name} description={`${CATEGORY_LABEL[h.category]} · ${h.address}`} onClick={() => void rechoose(fromHit(h))} />
                      ))}
                    </List>
                  </Collapsible>
                )}

                <Collapsible value="manual" trigger={<Text type="label">{t('add.manualFind')}</Text>}>
                  <PlaceSearch label={t('add.refine.search')} onPick={(p) => void rechoose(p)} />
                </Collapsible>
              </CollapsibleGroup>
            </Card>

            <div>
              <Button label={t('add.undo')} variant="ghost" size="sm" isDisabled={busy} onClick={() => void undo()} />
            </div>
          </>
        )}
      </div>
    </PushScreen>
  );
}
