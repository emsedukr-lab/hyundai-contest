import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { DateRangeInput } from '@astryxdesign/core/DateRangeInput';
import { DropdownMenu } from '@astryxdesign/core/DropdownMenu';
import { FormLayout } from '@astryxdesign/core/FormLayout';
import { IconButton } from '@astryxdesign/core/IconButton';
import { List, ListItem } from '@astryxdesign/core/List';
import { NumberInput } from '@astryxdesign/core/NumberInput';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Selector } from '@astryxdesign/core/Selector';
import { Spinner } from '@astryxdesign/core/Spinner';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Tab, TabList } from '@astryxdesign/core/TabList';
import { Heading, Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { TimeInput } from '@astryxdesign/core/TimeInput';
import type { Endpoint, Trip, Visit } from '@tteonaljido/shared';
import { MoreIcon, StarIcon } from '../components/shell/icons';
import { PushScreen } from '../components/shell/Screens';
import { Card, CardListHeader, Section } from '../components/toss/Card';
import { DaysSection } from '../editor/DaysSection';
import { CATEGORY_LABEL, PlaceSearch } from '../editor/PlaceSearch';
import { RecommendDialog } from '../editor/RecommendDialog';
import { ShareDialog } from '../editor/ShareDialog';
import { VisitDialog } from '../editor/VisitDialog';
import { trips } from '../lib/db';
import { t } from '../lib/i18n';
import { navigate } from '../lib/router';
import { PRESET_SLOTS, defaultHome, presetLabel, presetPlace } from '../lib/settings';
import {
  REASON_LABEL,
  addPlace,
  emptyPlan,
  isEndpointOnly,
  newDoc,
  nightsLabel,
  nowIso,
  planWarnings,
  presetInPlan,
  relinkLegs,
  rememberLegs,
  savePlan,
  setOrigin,
  setPeriod,
  startFromPreset,
  unassignedVisits,
  updateVisit,
  type LegBook,
  type TripDoc,
} from '../lib/trips';

type ISOTime = Parameters<NonNullable<Parameters<typeof TimeInput>[0]['onChange']>>[0];
type Range = NonNullable<Parameters<typeof DateRangeInput>[0]['value']>;
/** The editor's three parts, split into inline tabs so a phone isn't one endless scroll. */
type EditorTab = 'basics' | 'places' | 'days';

const endpointValue = (e: Endpoint) => (e.kind === 'HOME' ? 'HOME' : e.placeRef);
const toEndpoint = (v: string): Endpoint => (v === 'HOME' ? { kind: 'HOME' } : { kind: 'PLACE', placeRef: v });

export function TripEditorPage({ tripId }: { tripId: string | null }) {
  const [doc, setDoc] = useState<TripDoc | null>(null);
  const [plan, setPlan] = useState<Trip | null>(null);
  // The one home address, set in 설정 and shared by every trip (route checks, map, recommend, what the car may get).
  const [home] = useState(defaultHome);
  // Saved start places (설정 › 회사, 즐겨찾기 1–3), read once like home.
  const [presets] = useState(() => PRESET_SLOTS.filter((s) => s !== 'home').map((slot) => ({ slot, place: presetPlace(slot) })));
  const [dirty, setDirty] = useState(false);
  const [openPlace, setOpenPlace] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [recommending, setRecommending] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [tab, setTab] = useState<EditorTab>('basics');
  /** Travel times typed this session by pair of places, so reordering does not throw them away. */
  const book = useRef<LegBook>(new Map());
  /** Importance a visit had before it was starred, so un-starring restores e.g. OPTIONAL instead of flattening it to NORMAL. */
  const beforeMust = useRef(new Map<string, Visit['importance']>());

  useEffect(() => {
    void (async () => {
      const d = tripId ? await trips.get(tripId) : await newDoc(emptyPlan(), defaultHome());
      if (!d) return navigate('/', true);
      setDoc(d);
      book.current = new Map();
      rememberLegs(d.plan, book.current);
      setPlan(d.plan);
    })();
  }, [tripId]);

  const warnings = useMemo(() => (plan ? planWarnings(plan, home) : []), [plan, home]);
  if (!plan || !doc) return <Spinner />;

  const edit = (p: Trip) => {
    const linked = relinkLegs(plan, p, book.current);
    rememberLegs(linked, book.current);
    setPlan(linked);
    setDirty(true);
    setSaved(null);
  };
  const endpointOptions = [{ value: 'HOME', label: t('common.home') }, ...plan.places.map((p) => ({ value: p.placeRef, label: p.name }))];

  // 출발 장소 (top of 기본): 집 and the saved places first — a saved place already in the trip answers to its place — then
  // the trip's other places. A slot not set yet is listed but disabled, pointing at 설정.
  const seen = new Set<string>(['HOME']);
  const savedStarts = [
    { value: 'HOME', label: t('common.home'), description: home ? home.address : t('editor.startPlace.homeUnset') },
    ...presets.flatMap(({ slot, place }) => {
      if (!place) return [{ value: `preset:${slot}`, label: presetLabel(slot), description: t('settings.home.unset'), disabled: true }];
      const value = presetInPlan(plan, place)?.placeRef ?? `preset:${slot}`;
      if (seen.has(value)) return []; // two slots saved as the same place: list it once
      seen.add(value);
      return [{ value, label: `${presetLabel(slot)} · ${place.name}`, description: place.address }];
    }),
  ];
  const tripStarts = plan.places.filter((p) => !seen.has(p.placeRef)).map((p) => ({ value: p.placeRef, label: p.name, description: p.address || undefined }));
  const startOptions = [
    { type: 'section' as const, title: t('editor.startPlace.saved'), options: savedStarts },
    ...(tripStarts.length ? [{ type: 'section' as const, title: t('editor.startPlace.tripPlaces'), options: tripStarts }] : []),
  ];
  const startAddress = plan.origin.kind === 'HOME' ? (home ? home.address : t('editor.startPlace.homeUnset')) : plan.places.find((p) => p.placeRef === (plan.origin as { placeRef: string }).placeRef)?.address || undefined;
  const pickStart = (v: string) => {
    if (v === 'HOME') return edit(setOrigin(plan, { kind: 'HOME' }));
    const preset = v.startsWith('preset:') ? presets.find((x) => `preset:${x.slot}` === v)?.place : undefined;
    edit(preset ? startFromPreset(plan, preset) : setOrigin(plan, toEndpoint(v)));
  };

  const save = async () => {
    const next = await savePlan(doc, plan, home);
    await trips.put(next);
    setDoc(next);
    setPlan(next.plan);
    setDirty(false);
    setSaved(next.revision === doc.revision && tripId ? t('editor.noChanges') : t('editor.saved', { revision: next.revision }));
    if (!tripId) navigate(`/trips/${next.tripId}`, true);
  };

  /** Makes a copy of the current trip (places, days, home and all) as a new trip and opens it. The original is untouched. */
  const duplicate = async () => {
    if (dirty) await save(); // keep unsaved edits in the original too, not only in the copy
    const clone: Trip = { ...structuredClone(plan), tripId: crypto.randomUUID(), name: t('trip.copyName', { name: plan.name }).slice(0, 60), revision: 1, updatedAt: nowIso() };
    const nd = await newDoc(clone, home);
    await trips.put(nd);
    navigate(`/trips/${nd.tripId}`);
  };

  /** Leave the editor (back to the trips tab, or to 설정 to change home); unsaved edits ask first instead of vanishing. */
  const leave = (to = '/') => {
    if (dirty && !window.confirm(t('editor.leave.confirm'))) return;
    navigate(to);
  };

  // Secondary actions live in the top bar's menu (toss.md 'menu': opens next to its trigger), keeping one CTA below.
  const menuItems = [
    ...(tripId ? [{ label: t('trip.duplicate'), onClick: () => void duplicate() }] : []),
    { label: t('share.button'), onClick: () => setSharing(true) },
    { label: t('recommend.button'), onClick: () => setRecommending(true) },
    ...(tripId ? [{ type: 'divider' as const }, { label: t('editor.delete'), variant: 'destructive' as const, onClick: () => setConfirmDelete(true) }] : []),
  ];

  return (
    <PushScreen
      title={tripId ? plan.name || t('editor.titleEdit') : t('editor.titleNew')}
      onBack={() => leave()}
      actions={
        <>
          <Badge variant="neutral" label={`v${doc.revision}${dirty ? ` · ${t('editor.unsaved')}` : ''}`} />
          <DropdownMenu
            items={menuItems}
            presentation="popover"
            renderTrigger={(props) => (
              <button type="button" className="tn-iconbtn" aria-label={t('editor.more')} {...props}>
                <MoreIcon />
              </button>
            )}
          />
        </>
      }
      cta={<Button label={dirty || !tripId ? t('editor.save') : t('editor.savedState')} variant="primary" size="lg" width="100%" isDisabled={!dirty && !!tripId} onClick={save} />}>
      <div className="tn-pad" style={{ position: 'sticky', top: 'calc(56px + env(safe-area-inset-top))', zIndex: 4, background: 'var(--color-background-body)' }}>
        {/* ARIA tabs: one panel region whose content swaps, so every tab controls the same panel. */}
        <TabList role="tablist" value={tab} onChange={(v) => setTab(v as EditorTab)} hasDivider>
          <Tab value="basics" label={t('editor.tab.basics')} panelId="editor-panel" />
          <Tab value="places" label={t('editor.tab.places')} panelId="editor-panel" />
          <Tab value="days" label={t('editor.tab.days')} panelId="editor-panel" />
        </TabList>
      </div>

      <div
        id="editor-panel"
        role="tabpanel"
        aria-label={t(tab === 'basics' ? 'editor.tab.basics' : tab === 'places' ? 'editor.tab.places' : 'editor.tab.days')}
        className="tn-pad"
        style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingTop: 16 }}>
        {error && <Banner status="error" title={error} isDismissable onDismiss={() => setError(null)} />}
        {saved && <Banner status="success" title={saved} isDismissable onDismiss={() => setSaved(null)} />}

        {tab === 'basics' && (
          <>
            {/* Where the trip starts, first thing on a new trip: 집·회사·즐겨찾기 1–3 are set once in 설정. */}
            <Section title={t('editor.startPlace')}>
              <VStack gap={3}>
                <VStack gap={1}>
                  <Selector label={t('editor.startPlace')} isLabelHidden options={startOptions} value={endpointValue(plan.origin)} onChange={pickStart} />
                  {startAddress && (
                    <div style={{ wordBreak: 'keep-all' }}>
                      <Text type="supporting">{startAddress}</Text>
                    </div>
                  )}
                </VStack>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: '1 1 auto', minWidth: 0, wordBreak: 'keep-all' }}>
                    {presets.some((x) => !x.place) && (
                      <Text type="supporting" color="secondary">
                        {t('editor.startPlace.hint')}
                      </Text>
                    )}
                  </div>
                  <div style={{ flex: 'none' }}>
                    <Button label={t('editor.home.openSettings')} variant="secondary" size="sm" onClick={() => leave('/settings')} />
                  </div>
                </div>
              </VStack>
            </Section>

            <Section title={t('editor.basics')}>
              <FormLayout>
                <TextInput label={t('editor.name')} value={plan.name} onChange={(v) => edit({ ...plan, name: v.slice(0, 60) })} isRequired />
                <DateRangeInput
                  label={t('editor.period')}
                  value={{ start: plan.startDate, end: plan.endDate } as Range}
                  maxRangeSpan={14}
                  hasClear={false}
                  description={t('editor.period.detail', { nights: nightsLabel(plan), timezone: plan.timezone })}
                  onChange={(r) => {
                    if (!r) return;
                    try {
                      edit(setPeriod(plan, r.start, r.end));
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                />
              </FormLayout>
            </Section>

            <Section title={t('editor.route')}>
              <FormLayout>
                <SegmentedControl
                  label={t('editor.firstDay')}
                  value={plan.firstDay.basis}
                  onChange={(v) =>
                    edit({
                      ...plan,
                      firstDay: v === 'DEPART_ORIGIN' ? { basis: 'DEPART_ORIGIN', departTime: '09:00' } : { basis: 'ARRIVE_FIRST_STOP', arriveTime: '10:00', prepMinutes: 10 },
                    })
                  }>
                  <SegmentedControlItem value="DEPART_ORIGIN" label={t('editor.firstDay.depart')} />
                  <SegmentedControlItem value="ARRIVE_FIRST_STOP" label={t('editor.firstDay.arrive')} />
                </SegmentedControl>
                {plan.firstDay.basis === 'DEPART_ORIGIN' ? (
                  <TimeInput
                    label={t('editor.departTime')}
                    increment={30}
                    value={plan.firstDay.departTime as ISOTime}
                    onChange={(v) => v && edit({ ...plan, firstDay: { basis: 'DEPART_ORIGIN', departTime: String(v).slice(0, 5) } })}
                  />
                ) : (
                  <HStack gap={2}>
                    <TimeInput
                      label={t('editor.arriveTime')}
                      increment={30}
                      value={plan.firstDay.arriveTime as ISOTime}
                      onChange={(v) => v && plan.firstDay.basis === 'ARRIVE_FIRST_STOP' && edit({ ...plan, firstDay: { ...plan.firstDay, arriveTime: String(v).slice(0, 5) } })}
                    />
                    <NumberInput
                      label={t('editor.prepMinutes')}
                      value={plan.firstDay.prepMinutes}
                      isIntegerOnly
                      onChange={(v) =>
                        plan.firstDay.basis === 'ARRIVE_FIRST_STOP' && edit({ ...plan, firstDay: { ...plan.firstDay, prepMinutes: Math.max(0, Math.min(240, Math.round(v ?? 0))) } })
                      }
                    />
                  </HStack>
                )}
                <Selector label={t('editor.finalDestination')} options={endpointOptions} value={endpointValue(plan.finalDestination)} onChange={(v) => edit({ ...plan, finalDestination: toEndpoint(v) })} />
              </FormLayout>
            </Section>

          </>
        )}

        {tab === 'places' && (
          <VStack gap={3}>
            <Heading level={2}>{t('editor.places')}</Heading>
            <PlaceSearch onPick={(p) => edit(addPlace(plan, p))} onPickMany={(places) => edit(places.reduce((pl, p) => addPlace(pl, p), plan))} />
            {plan.places.length === 0 ? (
              <Text type="supporting" color="secondary">
                {t('editor.firstPlace')}
              </Text>
            ) : (
              <Card pad={0}>
                <List hasDividers header={<CardListHeader>{t('editor.places.all', { n: plan.places.length })}</CardListHeader>}>
                  {plan.places.map((p) => {
                    const v = plan.visits.find((x) => x.placeRef === p.placeRef);
                    const where = v
                      ? v.unassignedReason
                        ? t('common.unassigned')
                        : t('common.day', { day: String(plan.days.find((d) => d.visitOrder.includes(v.visitId))?.dayIndex) })
                      : isEndpointOnly(plan, p.placeRef)
                        ? t('editor.places.endpointOnly')
                        : t('common.lodging');
                    return (
                      <ListItem
                        key={p.placeRef}
                        label={p.name}
                        description={`${CATEGORY_LABEL[p.category]} · ${where}${v?.fixed ? ` · ${t('common.fixedAt', { time: v.fixed.time })}` : ''}`}
                        endContent={
                          v ? (
                            <IconButton
                              label={v.importance === 'MUST' ? t('visit.must.unset') : t('visit.must.set')}
                              icon={<StarIcon filled={v.importance === 'MUST'} />}
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (v.importance === 'MUST') return edit(updateVisit(plan, v.visitId, { importance: beforeMust.current.get(v.visitId) ?? 'NORMAL' }));
                                beforeMust.current.set(v.visitId, v.importance);
                                edit(updateVisit(plan, v.visitId, { importance: 'MUST' }));
                              }}
                            />
                          ) : undefined
                        }
                        onClick={() => setOpenPlace(p.placeRef)}
                      />
                    );
                  })}
                </List>
              </Card>
            )}
          </VStack>
        )}

        {tab === 'days' && (
          <>
            <div>
              <Button label={t('recommend.button')} variant="secondary" size="md" onClick={() => setRecommending(true)} />
            </div>
            <DaysSection plan={plan} home={home} onChange={edit} onOpenPlace={setOpenPlace} onError={setError} />

            {unassignedVisits(plan).length > 0 && (
              <VStack gap={3}>
                <Heading level={2}>{t('editor.unassigned.title')}</Heading>
                <Text type="supporting" color="secondary">
                  {t('editor.unassigned.description')}
                </Text>
                <Card pad={0}>
                  <List hasDividers>
                    {unassignedVisits(plan).map((v) => (
                      <ListItem
                        key={v.visitId}
                        label={plan.places.find((p) => p.placeRef === v.placeRef)?.name ?? v.visitId}
                        endContent={
                          <Selector
                            label={t('editor.unassigned.reason')}
                            isLabelHidden
                            size="sm"
                            options={Object.entries(REASON_LABEL).map(([value, label]) => ({ value, label }))}
                            value={v.unassignedReason ?? 'NOT_SCHEDULED_YET'}
                            onChange={(r) => edit(updateVisit(plan, v.visitId, { unassignedReason: r as Visit['unassignedReason'] }))}
                          />
                        }
                      />
                    ))}
                  </List>
                </Card>
              </VStack>
            )}

            {warnings.length > 0 && (
              <VStack gap={2}>
                <Heading level={2}>{t('editor.warnings')}</Heading>
                {warnings.map((w) => (
                  <Banner key={w.text} status={w.level} title={w.text} />
                ))}
              </VStack>
            )}
          </>
        )}
      </div>

      <VisitDialog plan={plan} placeRef={openPlace} onChange={edit} onClose={() => setOpenPlace(null)} />
      <RecommendDialog isOpen={recommending} plan={plan} home={home} book={book.current} onApply={edit} onClose={() => setRecommending(false)} />
      <ShareDialog isOpen={sharing} doc={{ ...doc, plan, home }} onClose={() => setSharing(false)} />
      <AlertDialog
        isOpen={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('editor.delete.title')}
        description={t('editor.delete.description')}
        actionLabel={t('editor.delete.action')}
        actionVariant="destructive"
        onAction={async () => {
          await trips.remove(doc.tripId);
          navigate('/', true);
        }}
      />
    </PushScreen>
  );
}
