import { useMemo } from 'react';
import {
  ActionIcon,
  Badge,
  Card,
  Center,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconPlayerPause,
  IconRefresh,
} from '@tabler/icons-react';
import { FLUX_CATEGORIES, type FluxKindStatus } from './types';
import { FluxStatusCard } from './FluxStatusCard';

interface FluxOverviewProps {
  status: FluxKindStatus[];
  loading: boolean;
  onOpenKind: (s: FluxKindStatus) => void; // Navigation zur Ressourcenliste
  onRefresh: () => void;
}

interface CategorySection {
  label: string;
  items: FluxKindStatus[];
}

function buildSections(status: FluxKindStatus[]): CategorySection[] {
  const byKind = new Map<string, FluxKindStatus>();
  for (const s of status) {
    byKind.set(s.kind, s);
  }

  const used = new Set<string>();
  const sections: CategorySection[] = [];

  for (const category of FLUX_CATEGORIES) {
    const items: FluxKindStatus[] = [];
    for (const kind of category.kinds) {
      const entry = byKind.get(kind);
      if (entry) {
        items.push(entry);
        used.add(kind);
      }
    }
    if (items.length > 0) {
      sections.push({ label: category.label, items });
    }
  }

  const rest = status.filter((s) => !used.has(s.kind));
  if (rest.length > 0) {
    sections.push({ label: 'Weitere', items: rest });
  }

  return sections;
}

function SummaryTile({
  label,
  value,
  color,
  icon,
  prominent,
}: {
  label: string;
  value: number;
  color: string;
  icon: React.ReactNode;
  prominent?: boolean;
}) {
  return (
    <Card
      withBorder
      padding="sm"
      radius="md"
      style={
        prominent
          ? { borderColor: `var(--mantine-color-${color}-6)`, borderWidth: 2 }
          : undefined
      }
    >
      <Group gap="sm" wrap="nowrap">
        <ActionIcon
          variant="light"
          color={color}
          size="lg"
          radius="md"
          component="div"
          aria-hidden
        >
          {icon}
        </ActionIcon>
        <Stack gap={0}>
          <Text fw={700} fz={24} lh={1} c={color}>
            {value}
          </Text>
          <Text size="xs" c="dimmed">
            {label}
          </Text>
        </Stack>
      </Group>
    </Card>
  );
}

export default function FluxOverview({
  status,
  loading,
  onOpenKind,
  onRefresh,
}: FluxOverviewProps) {
  const totals = useMemo(() => {
    return status.reduce(
      (acc, s) => {
        acc.total += s.total ?? 0;
        acc.ready += s.ready ?? 0;
        acc.notReady += s.notReady ?? 0;
        acc.suspended += s.suspended ?? 0;
        return acc;
      },
      { total: 0, ready: 0, notReady: 0, suspended: 0 }
    );
  }, [status]);

  const sections = useMemo(() => buildSections(status), [status]);

  if (loading && status.length === 0) {
    return (
      <Center h="100%">
        <Loader />
      </Center>
    );
  }

  const hasNotReady = totals.notReady > 0;

  return (
    <Stack p="md" gap="lg">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={2}>
          <Title order={3}>Flux</Title>
          <Text size="sm" c="dimmed">
            Status der Flux-Ressourcen im Cluster
          </Text>
        </Stack>
        <Tooltip label="Aktualisieren">
          <ActionIcon
            variant="default"
            size="lg"
            onClick={onRefresh}
            aria-label="Aktualisieren"
            loading={loading}
          >
            <IconRefresh size={18} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
        <SummaryTile
          label="Gesamt"
          value={totals.total}
          color="gray"
          icon={<IconCircleCheck size={20} />}
        />
        <SummaryTile
          label="Bereit"
          value={totals.ready}
          color="green"
          icon={<IconCircleCheck size={20} />}
        />
        <SummaryTile
          label="Nicht bereit"
          value={totals.notReady}
          color="red"
          icon={<IconAlertTriangle size={20} />}
          prominent={hasNotReady}
        />
        <SummaryTile
          label="Pausiert"
          value={totals.suspended}
          color="yellow"
          icon={<IconPlayerPause size={20} />}
        />
      </SimpleGrid>

      {sections.length === 0 ? (
        <Center py="xl">
          <Text c="dimmed">Keine Flux-Ressourcen gefunden</Text>
        </Center>
      ) : (
        sections.map((section) => (
          <Stack key={section.label} gap="xs">
            <Group gap="xs">
              <Text tt="uppercase" fw={700} size="xs" c="dimmed">
                {section.label}
              </Text>
              <Badge variant="light" color="gray" size="xs">
                {section.items.length}
              </Badge>
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
              {section.items.map((s) => (
                <FluxStatusCard
                  key={`${s.group}/${s.kind}`}
                  status={s}
                  onClick={() => onOpenKind(s)}
                />
              ))}
            </SimpleGrid>
          </Stack>
        ))
      )}
    </Stack>
  );
}
