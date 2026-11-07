import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { DateRangeInput } from '@astryxdesign/core/DateRangeInput';
import { Divider } from '@astryxdesign/core/Divider';
import { FormLayout } from '@astryxdesign/core/FormLayout';
import { Layout, LayoutContent, LayoutFooter, LayoutHeader } from '@astryxdesign/core/Layout';
import { List, ListItem } from '@astryxdesign/core/List';
import { NumberInput } from '@astryxdesign/core/NumberInput';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Selector } from '@astryxdesign/core/Selector';
import { Spinner } from '@astryxdesign/core/Spinner';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Heading, Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { TimeInput } from '@astryxdesign/core/TimeInput';
import type { Endpoint, Home, Trip, Visit } from '@tteonaljido/shared';
import { DaysSection } from '../editor/DaysSection';
import { CATEGORY_LABEL, PlaceSearch } from '../editor/PlaceSearch';
import { RecommendDialog } from '../editor/RecommendDialog';
import { VisitDialog } from '../editor/VisitDialog';
import { trips } from '../lib/db';
import { t } from '../lib/i18n';
import { navigate } from '../lib/router';
import { REASON_LABEL, addPlace, emptyPlan, newDoc, nightsLabel, planWarnings, relinkLegs, rememberLegs, savePlan, setPeriod, unassignedVisits, updateVisit, type LegBook, type TripDoc } from '../lib/trips';

type ISOTime = Parameters<NonNullable<Parameters<typeof TimeInput>[0]['onChange']>>[0];
type Range = NonNullable<Parameters<typeof DateRangeInput>[0]['value']>;

const endpointValue = (e: Endpoint) => (e.kind === 'HOME' ? 'HOME' : e.placeRef);
const toEndpoint = (v: string): Endpoint => (v === 'HOME' ? { kind: 'HOME' } : { kind: 'PLACE', placeRef: v });

export function TripEditorPage({ tripId }: { tripId: string | null }) {
  const [doc, setDoc] = useState<TripDoc | null>(null);
  const [plan, setPlan] = useState<Trip | null>(null);
  const [home, setHome] = useState<Home | null>(null);
  const [dirty, setDirty] = useState(false);
  const [openPlace, setOpenPlace] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [recommending, setRecommending] = useState(false);
  /** Travel times typed this session by pair of places, so reordering does not throw them away. */
  const book = useRef<LegBook>(new Map());

  useEffect(() => {
    void (async () => {
      const d = tripId ? await trips.get(tripId) : await newDoc(emptyPlan());
      if (!d) return navigate('/', true);
      setDoc(d);
      book.current = new Map();
      rememberLegs(d.plan, book.current);
      setPlan(d.plan);
      setHome(d.home);
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

  const save = async () => {
    const next = await savePlan(doc, plan, home);
    await trips.put(next);
    setDoc(next);
    setPlan(next.plan);
    setDirty(false);
    setSaved(next.revision === doc.revision && tripId ? t('editor.noChanges') : t('editor.saved', { revision: next.revision }));
    if (!tripId) navigate(`/trips/${next.tripId}`, true);
  };

  return (
    <Layout
      contentWidth={640}
      header={
        <LayoutHeader hasDivider>
          <HStack gap={2} vAlign="center">
            <Button label={t('common.back')} variant="ghost" size="sm" onClick={() => navigate('/')} />
            <Heading level={1}>{tripId ? t('editor.titleEdit') : t('editor.titleNew')}</Heading>
            <Badge variant="neutral" label={`v${doc.revision}${dirty ? ` · ${t('editor.unsaved')}` : ''}`} />
          </HStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent>
          <VStack gap={6}>
            {error && <Banner status="error" title={error} isDismissable onDismiss={() => setError(null)} />}
            {saved && <Banner status="success" title={saved} isDismissable onDismiss={() => setSaved(null)} />}

            <VStack gap={3}>
              <Heading level={2}>{t('editor.basics')}</Heading>
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
            </VStack>

            <VStack gap={3}>
              <Heading level={2}>{t('editor.route')}</Heading>
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
                <Selector label={t('editor.origin')} options={endpointOptions} value={endpointValue(plan.origin)} onChange={(v) => edit({ ...plan, origin: toEndpoint(v) })} />
                <Selector label={t('editor.finalDestination')} options={endpointOptions} value={endpointValue(plan.finalDestination)} onChange={(v) => edit({ ...plan, finalDestination: toEndpoint(v) })} />
              </FormLayout>
            </VStack>

            <VStack gap={3}>
              <Heading level={2}>{t('editor.home.title')}</Heading>
              <Text type="supporting" color="secondary">
                {t('editor.home.description')}
              </Text>
              {home ? (
                <HStack gap={2} vAlign="center">
                  <Text>{home.address}</Text>
                  <Button label={t('editor.home.remove')} variant="ghost" size="sm" onClick={() => (setHome(null), setDirty(true))} />
                </HStack>
              ) : (
                <PlaceSearch
                  label={t('editor.home.search')}
                  onPick={(p) => {
                    // Home needs coordinates; without them the car keeps using its navigation HOME.
                    if (p.latE7 === null || p.lonE7 === null) return setError(t('editor.home.needsCoords'));
                    setHome({ address: (p.address || p.name).slice(0, 120), latE7: p.latE7, lonE7: p.lonE7 });
                    setDirty(true);
                  }}
                />
              )}
            </VStack>

            <VStack gap={3}>
              <Heading level={2}>{t('editor.places')}</Heading>
              <PlaceSearch onPick={(p) => edit(addPlace(plan, p))} />
              <List hasDividers header={<Text type="label">{t('editor.places.all', { n: plan.places.length })}</Text>}>
                {plan.places.map((p) => {
                  const v = plan.visits.find((x) => x.placeRef === p.placeRef);
                  const where = v ? (v.unassignedReason ? t('common.unassigned') : t('common.day', { day: String(plan.days.find((d) => d.visitOrder.includes(v.visitId))?.dayIndex) })) : t('common.lodging');
                  return <ListItem key={p.placeRef} label={p.name} description={`${CATEGORY_LABEL[p.category]} · ${where}${v?.fixed ? ` · ${t('common.fixedAt', { time: v.fixed.time })}` : ''}`} onClick={() => setOpenPlace(p.placeRef)} />;
                })}
              </List>
            </VStack>

            <Divider />
            <HStack hAlign="end">
              <Button label={t('recommend.button')} variant="secondary" size="sm" onClick={() => setRecommending(true)} />
            </HStack>
            <DaysSection plan={plan} onChange={edit} onOpenPlace={setOpenPlace} onError={setError} />

            {unassignedVisits(plan).length > 0 && (
              <VStack gap={3}>
                <Heading level={2}>{t('editor.unassigned.title')}</Heading>
                <Text type="supporting" color="secondary">
                  {t('editor.unassigned.description')}
                </Text>
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

            {tripId && <Button label={t('editor.delete')} variant="destructive" size="sm" onClick={() => setConfirmDelete(true)} />}
          </VStack>
          <VisitDialog plan={plan} placeRef={openPlace} onChange={edit} onClose={() => setOpenPlace(null)} />
          <RecommendDialog isOpen={recommending} plan={plan} home={home} book={book.current} onApply={edit} onClose={() => setRecommending(false)} />
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
        </LayoutContent>
      }
      footer={
        <LayoutFooter hasDivider>
          <HStack gap={2} hAlign="end">
            <Button label={t('common.close')} variant="secondary" onClick={() => navigate('/')} />
            <Button label={dirty || !tripId ? t('editor.save') : t('editor.savedState')} variant="primary" isDisabled={!dirty && !!tripId} onClick={save} />
          </HStack>
        </LayoutFooter>
      }
    />
  );
}
