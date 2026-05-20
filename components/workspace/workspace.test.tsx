import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import { fakeBrowser } from '@webext-core/fake-browser';
import type { StorageRoot, SavedGroup, SavedCollection, SavedTab } from '../../lib/storage/schema';
import { defaultRoot } from '../../lib/storage/defaults';
import { useStorage } from '../../lib/hooks/useStorage';
import { Workspace } from './Workspace';
import { GroupSection } from './GroupSection';
import { CollectionCard } from './CollectionCard';
import { TabList } from './TabList';

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------
function makeTab(overrides: Partial<SavedTab> = {}): SavedTab {
  return {
    id: 't1',
    url: 'https://example.com',
    title: 'Example',
    faviconUrl: null,
    addedAt: Date.now(),
    ...overrides,
  };
}

function makeCollection(overrides: Partial<SavedCollection> = {}): SavedCollection {
  return {
    id: 'c1',
    name: 'My Collection',
    groupId: 'g1',
    chromeGroupColor: 'blue',
    tabs: [makeTab(), makeTab({ id: 't2', title: 'Second tab', url: 'https://second.com' })],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

function makeGroup(overrides: Partial<SavedGroup> = {}): SavedGroup {
  return {
    id: 'g1',
    name: 'Work',
    color: 'blue',
    collectionIds: ['c1'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

function makeRoot(overrides: Partial<StorageRoot> = {}): StorageRoot {
  const collection = makeCollection();
  const group = makeGroup();
  return {
    ...defaultRoot(),
    groups: { g1: group },
    collections: { c1: collection },
    ...overrides,
  };
}

// Wire fake chrome before each test
beforeEach(async () => {
  await fakeBrowser.storage.local.clear();
  vi.stubGlobal('chrome', fakeBrowser);
});

// -------------------------------------------------------------------
// useStorage hook
// -------------------------------------------------------------------
describe('useStorage', () => {
  it('returns loading=true initially then loading=false after first value', async () => {
    const { result } = renderHook(() => useStorage());
    // Initially loading
    expect(result.current[1]).toBe(true);
    // After storage reads, loading becomes false
    await waitFor(() => expect(result.current[1]).toBe(false));
  });

  it('returns defaultRoot() when storage is empty', async () => {
    const { result } = renderHook(() => useStorage());
    await waitFor(() => expect(result.current[1]).toBe(false));
    expect(result.current[0]).toEqual(defaultRoot());
  });

  it('updates state when storage changes externally', async () => {
    const { result } = renderHook(() => useStorage());
    await waitFor(() => expect(result.current[1]).toBe(false));

    const newRoot = makeRoot();
    await act(async () => {
      await fakeBrowser.storage.local.set({ __tablocal_root: newRoot });
    });

    await waitFor(() =>
      expect(result.current[0].groups['g1']?.name).toBe('Work'),
    );
  });
});

// -------------------------------------------------------------------
// Workspace
// -------------------------------------------------------------------
describe('Workspace', () => {
  it('renders empty state when root has zero groups', () => {
    render(<Workspace root={defaultRoot()} loading={false} />);
    expect(screen.getByText('No collections yet')).toBeInTheDocument();
  });

  it('renders a GroupSection for each group in the root', () => {
    const root = makeRoot({
      groups: {
        g1: makeGroup({ id: 'g1', name: 'Group One', collectionIds: ['c1'] }),
        g2: makeGroup({ id: 'g2', name: 'Group Two', collectionIds: [] }),
      },
      collections: { c1: makeCollection({ id: 'c1', groupId: 'g1' }) },
    });
    render(<Workspace root={root} loading={false} />);
    expect(screen.getByText('Group One')).toBeInTheDocument();
    expect(screen.getByText('Group Two')).toBeInTheDocument();
  });

  it('renders loading state when loading=true', () => {
    render(<Workspace root={defaultRoot()} loading={true} />);
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true');
  });
});

// -------------------------------------------------------------------
// GroupSection
// -------------------------------------------------------------------
describe('GroupSection', () => {
  it('renders the group name', () => {
    const group = makeGroup({ name: 'Research' });
    render(<GroupSection group={group} collections={[]} />);
    expect(screen.getByText('Research')).toBeInTheDocument();
  });

  it('renders correct number of CollectionCard elements', () => {
    const group = makeGroup({ collectionIds: ['c1', 'c2'] });
    const collections = [
      makeCollection({ id: 'c1', name: 'Alpha' }),
      makeCollection({ id: 'c2', name: 'Beta' }),
    ];
    render(<GroupSection group={group} collections={collections} />);
    expect(screen.getByRole('heading', { level: 3, name: 'Alpha' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Beta' })).toBeInTheDocument();
  });

  it('shows empty message when group has no collections', () => {
    const group = makeGroup({ collectionIds: [] });
    render(<GroupSection group={group} collections={[]} />);
    expect(screen.getByText(/no collections in this group/i)).toBeInTheDocument();
  });

  it('toggles collapsed state when header is clicked', () => {
    const group = makeGroup({ name: 'Toggle Me', collectionIds: ['c1'] });
    const collections = [makeCollection({ id: 'c1', name: 'Visible' })];
    render(<GroupSection group={group} collections={collections} />);
    // Visible initially (use heading to avoid duplicate match with footer)
    expect(screen.getByRole('heading', { level: 3, name: 'Visible' })).toBeInTheDocument();
    // Click the chevron button to collapse
    fireEvent.click(screen.getByRole('button', { name: 'Collapse group' }));
    expect(screen.queryByRole('heading', { level: 3, name: 'Visible' })).not.toBeInTheDocument();
  });
});

// -------------------------------------------------------------------
// CollectionCard
// -------------------------------------------------------------------
describe('CollectionCard', () => {
  it('renders collection name and tab count badge', () => {
    const collection = makeCollection({ name: 'Sprint Planning', tabs: [makeTab(), makeTab({ id: 't2' })] });
    render(<CollectionCard collection={collection} />);
    expect(screen.getByRole('heading', { level: 3, name: 'Sprint Planning' })).toBeInTheDocument();
    expect(screen.getByText('2 tabs')).toBeInTheDocument();
  });

  it('expands TabList when card is clicked', async () => {
    const collection = makeCollection({
      name: 'Expandable',
      tabs: [makeTab({ title: 'My Expanded Tab', url: 'https://expand.com' })],
    });
    render(<CollectionCard collection={collection} />);
    fireEvent.click(screen.getByRole('article'));
    await waitFor(() =>
      expect(screen.getByText('My Expanded Tab')).toBeInTheDocument(),
    );
  });

  it('shows EmptyState for a collection with 0 tabs', () => {
    const collection = makeCollection({ tabs: [] });
    render(<CollectionCard collection={collection} />);
    expect(screen.getByText('No tabs')).toBeInTheDocument();
  });

  it('shows preview items when collapsed', () => {
    const tabs = Array.from({ length: 6 }, (_, i) =>
      makeTab({ id: `t${i}`, title: `Tab ${i}`, url: `https://tab${i}.com` }),
    );
    const collection = makeCollection({ tabs });
    render(<CollectionCard collection={collection} />);
    // Should show max 4 preview + "+2 more"
    expect(screen.getByText('+ 2 more')).toBeInTheDocument();
  });
});

// -------------------------------------------------------------------
// TabList
// -------------------------------------------------------------------
describe('TabList', () => {
  it('renders correct number of tab rows', () => {
    const tabs = [
      makeTab({ id: 't1', title: 'Tab One', url: 'https://one.com' }),
      makeTab({ id: 't2', title: 'Tab Two', url: 'https://two.com' }),
      makeTab({ id: 't3', title: 'Tab Three', url: 'https://three.com' }),
    ];
    render(<TabList tabs={tabs} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('renders tab titles', () => {
    const tabs = [
      makeTab({ id: 't1', title: 'Hello World', url: 'https://hello.com' }),
    ];
    render(<TabList tabs={tabs} />);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('renders hostname from URL', () => {
    const tabs = [makeTab({ id: 't1', title: 'Example', url: 'https://example.com/path' })];
    render(<TabList tabs={tabs} />);
    expect(screen.getByText('example.com')).toBeInTheDocument();
  });
});
