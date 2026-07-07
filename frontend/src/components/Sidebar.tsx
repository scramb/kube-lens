import { useMemo, useState } from 'react';
import { NavLink, ScrollArea, Text, TextInput, Stack, Divider } from '@mantine/core';
import { IconSearch, IconPuzzle } from '@tabler/icons-react';
import { NavSection } from '../resourceCatalog';
import { APIResource, resourceKey } from '../types';

interface Props {
  standard: NavSection[];
  crds: NavSection[];
  selected: APIResource | null;
  onSelect: (r: APIResource) => void;
}

export default function Sidebar({ standard, crds, selected, onSelect }: Props) {
  const [filter, setFilter] = useState('');

  const filterSections = (sections: NavSection[]) =>
    sections
      .map((s) => ({
        ...s,
        items: s.items.filter((i) =>
          i.label.toLowerCase().includes(filter.toLowerCase())
        ),
      }))
      .filter((s) => s.items.length > 0);

  const visibleStandard = useMemo(() => filterSections(standard), [standard, filter]);
  const visibleCrds = useMemo(() => filterSections(crds), [crds, filter]);

  const selectedKey = selected ? resourceKey(selected) : '';

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
        {visibleStandard.map((section) => (
          <div key={section.label}>
            <Text size="xs" fw={700} c="dimmed" tt="uppercase" px="md" pt="sm" pb={4}>
              {section.label}
            </Text>
            {section.items.map((item) => (
              <NavLink
                key={resourceKey(item.resource)}
                label={item.label}
                active={resourceKey(item.resource) === selectedKey}
                onClick={() => onSelect(item.resource)}
                px="md"
                py={5}
              />
            ))}
          </div>
        ))}
        {visibleCrds.length > 0 && (
          <>
            <Divider my="sm" />
            <Text size="xs" fw={700} c="dimmed" tt="uppercase" px="md" pb={4}>
              Custom Resources
            </Text>
            {visibleCrds.map((section) => (
              <NavLink
                key={section.label}
                label={section.label}
                leftSection={<IconPuzzle size={14} />}
                defaultOpened={filter.length > 0}
                childrenOffset={16}
                px="md"
                py={5}
              >
                {section.items.map((item) => (
                  <NavLink
                    key={resourceKey(item.resource)}
                    label={item.label}
                    active={resourceKey(item.resource) === selectedKey}
                    onClick={() => onSelect(item.resource)}
                    py={5}
                  />
                ))}
              </NavLink>
            ))}
          </>
        )}
      </ScrollArea>
    </Stack>
  );
}
