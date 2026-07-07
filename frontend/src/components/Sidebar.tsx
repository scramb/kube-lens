import { MouseEvent, useMemo, useState } from 'react';
import { ActionIcon, Divider, Group, NavLink, ScrollArea, Stack, Switch, Text, TextInput, Tooltip } from '@mantine/core';
import { IconBolt, IconEyeOff, IconPuzzle, IconSearch, IconStar, IconStarFilled } from '@tabler/icons-react';
import { NavItem, NavSection } from '../resourceCatalog';
import { APIResource, resourceKey } from '../types';

interface Props {
  standard: NavSection[];
  crds: NavSection[];
  selected: APIResource | null;
  favorites: string[];
  collapsedSections: Record<string, boolean>;
  hideEmptyCRDs: boolean;
  crdItemPresence: Record<string, boolean | undefined>;
  onSelect: (r: APIResource) => void;
  onToggleFavorite: (r: APIResource, favorite: boolean) => void;
  onSectionCollapsedChange: (sectionKey: string, collapsed: boolean) => void;
  onHideEmptyCRDsChange: (hide: boolean) => void;
  onEnsureCrdSectionPresence: (section: NavSection) => void;
  fluxAvailable: boolean;
  fluxActive: boolean;
  onOpenFlux: () => void;
}

function sectionKey(kind: 'standard' | 'crd', label: string): string {
  return `${kind}:${label}`;
}

function FavoriteStar({ resource, active, onToggle }: { resource: APIResource; active: boolean; onToggle: (r: APIResource, favorite: boolean) => void }) {
  const stopAndToggle = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onToggle(resource, !active);
  };

  return (
    <Tooltip label={active ? 'Favorit entfernen' : 'Als Favorit anpinnen'} openDelay={300}>
      <ActionIcon
        component="span"
        size="xs"
        variant="subtle"
        color={active ? 'yellow' : 'gray'}
        className="favorite-star"
        data-active={active || undefined}
        aria-label={active ? 'Favorit entfernen' : 'Als Favorit anpinnen'}
        onClick={stopAndToggle}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {active ? <IconStarFilled size={13} /> : <IconStar size={13} />}
      </ActionIcon>
    </Tooltip>
  );
}

export default function Sidebar({
  standard,
  crds,
  selected,
  favorites,
  collapsedSections,
  hideEmptyCRDs,
  crdItemPresence,
  onSelect,
  onToggleFavorite,
  onSectionCollapsedChange,
  onHideEmptyCRDsChange,
  onEnsureCrdSectionPresence,
  fluxAvailable,
  fluxActive,
  onOpenFlux,
}: Props) {
  const [filter, setFilter] = useState('');

  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);
  const allItems = useMemo(() => [...standard, ...crds].flatMap((s) => s.items), [standard, crds]);
  const favoriteItems = useMemo(() => {
    const byKey = new Map<string, NavItem>();
    for (const item of allItems) byKey.set(resourceKey(item.resource), item);
    return favorites
      .map((key) => byKey.get(key))
      .filter((item): item is NavItem => !!item)
      .filter((item) => item.label.toLowerCase().includes(filter.toLowerCase()));
  }, [allItems, favorites, filter]);

  const filterSections = (sections: NavSection[], kind: 'standard' | 'crd') =>
    sections
      .map((s) => {
        const items = s.items.filter((i) => {
          if (!i.label.toLowerCase().includes(filter.toLowerCase())) return false;
          if (kind === 'crd' && hideEmptyCRDs && crdItemPresence[resourceKey(i.resource)] === false) return false;
          return true;
        });
        return { ...s, items };
      })
      .filter((s) => s.items.length > 0);

  const visibleStandard = useMemo(() => filterSections(standard, 'standard'), [standard, filter]);
  const visibleCrds = useMemo(() => filterSections(crds, 'crd'), [crds, filter, hideEmptyCRDs, crdItemPresence]);

  const selectedKey = selected ? resourceKey(selected) : '';

  const renderItem = (item: NavItem, indented = false) => {
    const key = resourceKey(item.resource);
    const isFavorite = favoriteSet.has(key);
    return (
      <NavLink
        key={key}
        label={item.label}
        active={key === selectedKey}
        onClick={() => onSelect(item.resource)}
        rightSection={<FavoriteStar resource={item.resource} active={isFavorite} onToggle={onToggleFavorite} />}
        disableRightSectionRotation
        px={indented ? undefined : 'md'}
        py={5}
      />
    );
  };

  const isOpened = (key: string, defaultOpened = true) => (filter.length > 0 ? true : !(collapsedSections[key] ?? !defaultOpened));

  return (
    <Stack gap={0} h="100%">
      <TextInput
        m="sm"
        size="xs"
        placeholder="Ressourcen filtern …"
        leftSection={<IconSearch size={14} />}
        value={filter}
        onChange={(e) => setFilter(e.currentTarget.value)}
      />
      <ScrollArea flex={1} type="scroll">
        {favoriteItems.length > 0 && (
          <>
            <Text size="xs" fw={700} c="dimmed" tt="uppercase" px="md" pt="sm" pb={4}>
              Favoriten
            </Text>
            {favoriteItems.map((item) => renderItem(item))}
            <Divider my="sm" />
          </>
        )}

        {fluxAvailable && filter.length === 0 && (
          <>
            <Text size="xs" fw={700} c="dimmed" tt="uppercase" px="md" pt="sm" pb={4}>
              Dashboards
            </Text>
            <NavLink
              label="Flux"
              leftSection={<IconBolt size={16} />}
              active={fluxActive}
              onClick={onOpenFlux}
              px="md"
              py={5}
            />
            <Divider my="sm" />
          </>
        )}

        {visibleStandard.map((section) => {
          const key = sectionKey('standard', section.label);
          return (
            <NavLink
              key={key}
              label={section.label}
              opened={isOpened(key)}
              onChange={(opened) => onSectionCollapsedChange(key, !opened)}
              childrenOffset={16}
              px="md"
              py={5}
              keepMounted={false}
            >
              {section.items.map((item) => renderItem(item, true))}
            </NavLink>
          );
        })}

        {crds.length > 0 && (
          <>
            <Divider my="sm" />
            <Group justify="space-between" px="md" pb={4} wrap="nowrap">
              <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                Custom Resources
              </Text>
              <Tooltip label="Leere CRDs lazy beim Aufklappen ausblenden" openDelay={300}>
                <Switch
                  size="xs"
                  checked={hideEmptyCRDs}
                  onChange={(event) => onHideEmptyCRDsChange(event.currentTarget.checked)}
                  thumbIcon={<IconEyeOff size={10} />}
                  aria-label="Leere CRDs ausblenden"
                />
              </Tooltip>
            </Group>
            {visibleCrds.map((section) => {
              const key = sectionKey('crd', section.label);
              return (
                <NavLink
                  key={key}
                  label={section.label}
                  leftSection={<IconPuzzle size={14} />}
                  opened={isOpened(key, false)}
                  onChange={(opened) => {
                    onSectionCollapsedChange(key, !opened);
                    if (opened) onEnsureCrdSectionPresence(section);
                  }}
                  childrenOffset={16}
                  px="md"
                  py={5}
                  keepMounted={false}
                >
                  {section.items.map((item) => renderItem(item, true))}
                </NavLink>
              );
            })}
          </>
        )}
      </ScrollArea>
    </Stack>
  );
}
