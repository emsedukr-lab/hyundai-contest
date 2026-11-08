import { useEffect, useMemo, useRef, useState } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Collapsible } from '@astryxdesign/core/Collapsible';
import { Layout, LayoutContent, LayoutHeader } from '@astryxdesign/core/Layout';
import { List, ListItem } from '@astryxdesign/core/List';
import { Selector } from '@astryxdesign/core/Selector';
import { Spinner } from '@astryxdesign/core/Spinner';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Heading, Text } from '@astryxdesign/core/Text';
import { InstallHint } from '../components/InstallHint';
import { CATEGORY_LABEL, PlaceSearch, type NewPlace } from '../editor/PlaceSearch';
import { trips } from '../lib/db';
import { t } from '../lib/i18n';
import { ApiError, resolvePlace, searchPlaces, type PlaceHit } from '../lib/pairing';
import { sharedParamsFromSearch, sharedPlaceTerm, sharedUrl } from '../lib/placeShare';
import { navigate } from '../lib/router';
import { addPlace, emptyPlan, newDoc, removePlace, savePlan, type TripDoc } from '../lib/trips';

const NEW = 'new';

const fromHit = (h: PlaceHit): NewPlace => ({
  name: h.name,
  address: h.address,
  latE7: h.latE7,
  lonE7: h.lonE7,
  category: h.category,
  source: { provider: 'KAKAO', externalId: h.externalId },
  naviPoi: null,
  hours: { status: 'UNKNOWN' },
});

/** A place added by name only (search off or no result); the car pins the exact spot in the Hyundai navigation. */
const byName = (term: string): NewPlace => ({
  name: term.slice(0, 60),
  address: '',
  latE7: null,
  lonE7: null,
  category: 'OTHER',
  source: { provider: 'MANUAL', externalId: null },
  naviPoi: null,
  hours: { status: 'UNKNOWN' },
});

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

type Status = 'resolving' | 'added' | 'undone' | 'noTerm';

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
        doc = await newDoc(emptyPlan());
        created = true;
        prevDoc = null;
      }
    } else if ('collection' in intent) {
      doc = await newDoc({ ...emptyPlan(), name: t('add.collectionName') });
      created = true;
      prevDoc = null;
    } else {
      doc = await newDoc(emptyPlan());
      created = true;
      prevDoc = null;
    }
    const withPlace = addPlace(doc.plan, place); // appends, so the new place is always last
    const placeRef = withPlace.places[withPlace.places.length - 1].placeRef;
    const next = await savePlan(doc, withPlace, doc.home);
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
    void (async () => {
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
      setAdd(await doAdd(intent, place));
      setStatus('added');
    })();
  }, [term]);

  // ---- corrections (each keeps the place in exactly one trip) ----

  const undo = async () => {
    if (!add || busy) return;
    setBusy(true);
    await revert(add);
    setStatus('undone');
    setBusy(false);
  };

  /** Move the same place to a different trip: take it out of the current one, put it in the chosen one. */
  const changeTrip = async (value: string) => {
    if (!add || busy || value === add.tripId) return;
    setBusy(true);
    await revert(add);
    setAdd(await doAdd(value === NEW ? { new: true } : { existingId: value }, add.place));
    setBusy(false);
  };

  /** Keep the trip, swap the place (a different candidate, or a manual search result). */
  const rechoose = async (place: NewPlace) => {
    if (!add || busy) return;
    setBusy(true);
    const without = removePlace(add.doc.plan, add.placeRef);
    const withNew = addPlace(without, place);
    const placeRef = withNew.places[withNew.places.length - 1].placeRef;
    const next = await savePlan(add.doc, withNew, add.doc.home);
    await trips.put(next);
    setAdd({ ...add, placeRef, doc: next, place });
    setBusy(false);
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

  return (
    <Layout
      contentWidth={640}
      header={
        <LayoutHeader hasDivider>
          <HStack gap={2} vAlign="center">
            <Button label={t('common.back')} variant="ghost" size="sm" onClick={() => navigate('/')} />
            <Heading level={1}>{t('add.title')}</Heading>
          </HStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent>
          <VStack gap={4}>
            <InstallHint />
            {status === 'noTerm' && <Banner status="info" title={t('add.noTerm')} />}

            {status === 'resolving' && (
              <HStack gap={2} vAlign="center">
                <Spinner />
                <Text color="secondary">{t('add.saving')}</Text>
              </HStack>
            )}

            {status === 'undone' && (
              <>
                <Banner status="info" title={t('add.undone')} />
                <Button label={t('add.goHome')} variant="primary" onClick={() => navigate('/')} />
              </>
            )}

            {status === 'added' && add && (
              <>
                <Banner
                  status="success"
                  title={t('add.added', { name: add.place.name, trip: add.doc.plan.name })}
                  description={add.place.latE7 === null ? t('add.added.nameOnly') : undefined}
                />
                {note && <Banner status="warning" title={note} />}
                <HStack gap={2} wrap="wrap">
                  <Button label={t('add.open')} variant="primary" onClick={() => navigate(`/trips/${add.tripId}`)} />
                  <Button label={t('add.goHome')} variant="secondary" onClick={() => navigate('/')} />
                  <Button label={t('add.undo')} variant="ghost" isDisabled={busy} onClick={() => void undo()} />
                </HStack>

                <Collapsible trigger={<Text type="label">{t('add.changeTrip')}</Text>} defaultIsOpen={false}>
                  <Selector label={t('add.target')} options={targetOptions} value={add.tripId} onChange={(v) => void changeTrip(v)} />
                </Collapsible>

                {hits.length > 1 && (
                  <Collapsible trigger={<Text type="label">{t('add.otherPlace')}</Text>} defaultIsOpen={false}>
                    <List hasDividers>
                      {hits.map((h) => (
                        <ListItem key={h.externalId} label={h.name} description={`${CATEGORY_LABEL[h.category]} · ${h.address}`} onClick={() => void rechoose(fromHit(h))} />
                      ))}
                    </List>
                  </Collapsible>
                )}

                <Collapsible trigger={<Text type="label">{t('add.manualFind')}</Text>} defaultIsOpen={false}>
                  <PlaceSearch label={t('add.refine.search')} onPick={(p) => void rechoose(p)} />
                </Collapsible>
              </>
            )}
          </VStack>
        </LayoutContent>
      }
    />
  );
}
