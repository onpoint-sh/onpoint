import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { AppPreview, AppPreviewProvider } from '@onpoint/app-preview'
import type { MockNote } from '@onpoint/app-preview'
import '@onpoint/app-preview/styles/app-preview.css'
import { LIGHT_THEMES, DARK_THEMES } from '@onpoint/themes'
import type { ThemeDefinition } from '@onpoint/themes'
import {
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  Search,
  Settings,
  FilePlus2,
  FolderPlus,
  PanelLeft
} from 'lucide-react'

const CARD_HEIGHT = 420

// ─── Shared Components ───

function DesktopShell({
  wallpaper,
  children,
  stretch
}: {
  wallpaper: string
  children: React.ReactNode
  stretch?: boolean
}): React.JSX.Element {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="relative" style={{ height: CARD_HEIGHT }}>
        <img src={wallpaper} alt="" className="absolute inset-0 size-full object-cover" />
        <div
          className={`absolute inset-0 flex justify-center p-6 sm:p-8 ${stretch ? 'items-stretch' : 'items-center'}`}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

function TrafficLights(): React.JSX.Element {
  return (
    <div className="flex items-center gap-1.5">
      <div className="size-[10px] rounded-full bg-[#ff5f57]" />
      <div className="size-[10px] rounded-full bg-[#febc2e]" />
      <div className="size-[10px] rounded-full bg-[#28c840]" />
    </div>
  )
}

function AppWindow({
  children,
  style
}: {
  children: React.ReactNode
  style?: React.CSSProperties
}): React.JSX.Element {
  return (
    <div
      className="flex w-full flex-col overflow-hidden rounded-lg border border-border/50 shadow-2xl"
      style={{ background: 'var(--background)', maxHeight: '100%', ...style }}
    >
      <div
        className="flex h-9 shrink-0 items-center gap-2 border-b px-3"
        style={{
          borderColor: 'var(--border)',
          background: 'color-mix(in oklch, var(--muted) 50%, var(--background))'
        }}
      >
        <TrafficLights />
        <div className="ml-2 flex items-center gap-1">
          <div
            className="flex size-6 items-center justify-center rounded"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <PanelLeft style={{ width: 13, height: 13 }} />
          </div>
          <div
            className="flex size-6 items-center justify-center rounded"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <Search style={{ width: 13, height: 13 }} />
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <span
          className="select-none text-[0.65rem]"
          style={{ color: 'var(--muted-foreground)', opacity: 0.6 }}
        >
          ONPOINT
        </span>
        <div style={{ flex: 1 }} />
        <div style={{ width: 60 }} />
      </div>
      {children}
    </div>
  )
}

function SidebarWindow({
  children,
  onAddFile,
  onAddFolder
}: {
  children: React.ReactNode
  onAddFile?: () => void
  onAddFolder?: () => void
}): React.JSX.Element {
  return (
    <div
      className="flex w-full max-w-[280px] flex-col overflow-hidden rounded-lg border border-border/50 shadow-2xl"
      style={{
        background: 'color-mix(in oklch, var(--muted) 30%, var(--background))',
        maxHeight: '100%'
      }}
    >
      <div
        className="flex h-9 shrink-0 items-center gap-2 border-b px-3"
        style={{
          borderColor: 'var(--border)',
          background: 'color-mix(in oklch, var(--muted) 50%, var(--background))'
        }}
      >
        <TrafficLights />
        <div style={{ flex: 1 }} />
        <span
          className="select-none text-[0.65rem]"
          style={{ color: 'var(--muted-foreground)', opacity: 0.6 }}
        >
          ONPOINT
        </span>
        <div style={{ flex: 1 }} />
        <div style={{ width: 40 }} />
      </div>
      <div className="flex h-8 shrink-0 items-center justify-between px-3">
        <div
          className="flex items-center gap-1 text-[0.65rem] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--muted-foreground)' }}
        >
          <ChevronRight style={{ width: 13, height: 13, transform: 'rotate(90deg)' }} />
          NOTES
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className="flex size-5 cursor-pointer items-center justify-center rounded border-0 bg-transparent transition-colors"
            style={{ color: 'var(--muted-foreground)' }}
            onClick={onAddFile}
            onMouseEnter={(e) => {
              e.currentTarget.style.background =
                'color-mix(in oklch, var(--foreground) 8%, transparent)'
              e.currentTarget.style.color = 'var(--foreground)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--muted-foreground)'
            }}
          >
            <FilePlus2 style={{ width: 11, height: 11 }} />
          </button>
          <button
            type="button"
            className="flex size-5 cursor-pointer items-center justify-center rounded border-0 bg-transparent transition-colors"
            style={{ color: 'var(--muted-foreground)' }}
            onClick={onAddFolder}
            onMouseEnter={(e) => {
              e.currentTarget.style.background =
                'color-mix(in oklch, var(--foreground) 8%, transparent)'
              e.currentTarget.style.color = 'var(--foreground)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--muted-foreground)'
            }}
          >
            <FolderPlus style={{ width: 11, height: 11 }} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">{children}</div>
      <div className="shrink-0 border-t p-1" style={{ borderColor: 'var(--border)' }}>
        <div
          className="flex items-center gap-2 rounded-md px-2 py-1 text-[0.72rem]"
          style={{ color: 'var(--muted-foreground)' }}
        >
          <Settings style={{ width: 13, height: 13 }} />
          Settings
        </div>
      </div>
    </div>
  )
}

// ─── Interactive Tree ───

type TreeItemData = {
  id: string
  name: string
  isFolder?: boolean
  defaultOpen?: boolean
  children?: TreeItemData[]
}

function InteractiveTreeNode({
  item,
  depth = 0,
  activeId,
  onSelect,
  openFolders,
  onToggleFolder
}: {
  item: TreeItemData
  depth?: number
  activeId?: string
  onSelect?: (id: string) => void
  openFolders: Set<string>
  onToggleFolder: (id: string) => void
}): React.JSX.Element {
  const paddingLeft = depth * 20 + 12
  const isOpen = openFolders.has(item.id)
  const isActive = item.id === activeId
  const Icon = item.isFolder ? (isOpen ? FolderOpen : Folder) : FileText

  return (
    <>
      <div
        className="group flex h-7 cursor-pointer items-center gap-[5px] pr-2 text-[0.78rem] transition-colors"
        style={{
          paddingLeft,
          background: isActive
            ? 'color-mix(in oklch, var(--foreground) 5%, transparent)'
            : undefined
        }}
        onClick={() => {
          if (item.isFolder) {
            onToggleFolder(item.id)
          } else {
            onSelect?.(item.id)
          }
        }}
        onMouseEnter={(e) => {
          if (!isActive)
            e.currentTarget.style.background =
              'color-mix(in oklch, var(--foreground) 4%, transparent)'
        }}
        onMouseLeave={(e) => {
          if (!isActive) e.currentTarget.style.background = ''
        }}
      >
        {item.isFolder ? (
          <span className="inline-flex w-4 shrink-0 items-center justify-center">
            <ChevronRight
              style={{
                width: 13,
                height: 13,
                color: 'var(--muted-foreground)',
                transform: isOpen ? 'rotate(90deg)' : undefined,
                transition: 'transform 150ms'
              }}
            />
          </span>
        ) : (
          <span className="inline-flex w-4 shrink-0" />
        )}
        <Icon style={{ width: 13, height: 13, flexShrink: 0, color: 'var(--muted-foreground)' }} />
        <span className="truncate font-medium" style={{ color: 'var(--foreground)' }}>
          {item.name}
        </span>
      </div>
      {isOpen &&
        item.children?.map((child) => (
          <InteractiveTreeNode
            key={child.id}
            item={child}
            depth={depth + 1}
            activeId={activeId}
            onSelect={onSelect}
            openFolders={openFolders}
            onToggleFolder={onToggleFolder}
          />
        ))}
    </>
  )
}

function useTree(items: TreeItemData[]): {
  openFolders: Set<string>
  toggleFolder: (id: string) => void
} {
  const defaultOpen = useMemo(() => {
    const ids = new Set<string>()
    const walk = (list: TreeItemData[]): void => {
      for (const item of list) {
        if (item.isFolder && item.defaultOpen) ids.add(item.id)
        if (item.children) walk(item.children)
      }
    }
    walk(items)
    return ids
  }, [items])

  const [openFolders, setOpenFolders] = useState(defaultOpen)

  const toggleFolder = useCallback((id: string) => {
    setOpenFolders((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  return { openFolders, toggleFolder }
}

// ─── Interactive Search ───

type NoteEntry = { title: string; path: string; snippet?: string }

const ALL_NOTES: NoteEntry[] = [
  // Sales
  {
    title: 'Q1 Pipeline Review',
    path: 'Sales',
    snippet: 'Acme Corp — Enterprise license, $85K. Champion is VP of Ops...'
  },
  {
    title: 'Discovery Call Template',
    path: 'Sales',
    snippet: 'How does your team currently capture and share knowledge?...'
  },
  {
    title: 'Competitive Battle Card',
    path: 'Sales',
    snippet: 'Differentiator: offline-first, plain Markdown, no vendor lock-in...'
  },
  // Content Creator
  {
    title: 'Video Script — 10 Productivity Hacks',
    path: 'Content',
    snippet: 'I tested 50 productivity methods for 30 days. These 10 actually stuck...'
  },
  {
    title: 'Channel Strategy 2025',
    path: 'Content',
    snippet: 'Upload schedule: Tuesday main video, Thursday shorts, Saturday Q&A...'
  },
  // Engineer
  {
    title: 'API Design Patterns',
    path: 'Projects',
    snippet: 'Use plural nouns for collections. Cursor-based pagination scales better...'
  },
  {
    title: 'Architecture Decision',
    path: 'Projects',
    snippet: 'Use pnpm workspaces with apps/ and packages/ directories...'
  },
  // Daily / General
  {
    title: '2025-02-27',
    path: 'Daily Notes',
    snippet: 'Team sync at 9:30. Reply to Acme Corp follow-up. Book flights...'
  },
  {
    title: 'Weekly Team Sync',
    path: 'Meeting Notes',
    snippet: 'Sarah: Marketing site is live. 2.3K visits in first 24 hours...'
  },
  {
    title: 'Client Kickoff — Acme Corp',
    path: 'Meeting Notes',
    snippet: 'Acme wants to migrate 200 users from Confluence to local-first...'
  },
  {
    title: 'Reading List',
    path: '',
    snippet: 'Build by Tony Fadell, Obviously Awesome by April Dunford...'
  },
  { title: 'Product Ideas', path: '', snippet: 'Vim mode, Backlinks, Templates, Export, Sync...' }
]

function InteractiveSearch(): React.JSX.Element {
  const [query, setQuery] = useState('Acme')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return ALL_NOTES.filter(
      (n) => n.title.toLowerCase().includes(q) || n.snippet?.toLowerCase().includes(q)
    )
  }, [query])

  const titleResults = useMemo(
    () => results.filter((r) => r.title.toLowerCase().includes(query.trim().toLowerCase())),
    [results, query]
  )
  const contentOnly = useMemo(
    () => results.filter((r) => !r.title.toLowerCase().includes(query.trim().toLowerCase())),
    [results, query]
  )
  const showSections = titleResults.length > 0 && contentOnly.length > 0

  return (
    <div
      className="flex w-full max-w-[360px] flex-col overflow-hidden rounded-xl border shadow-2xl"
      style={{
        background: 'var(--popover)',
        borderColor: 'var(--border)',
        color: 'var(--popover-foreground)',
        maxHeight: '100%'
      }}
    >
      <div
        className="flex items-center gap-2 border-b px-3.5 py-2.5"
        style={{ borderColor: 'var(--border)' }}
      >
        <Search
          style={{ width: 15, height: 15, flexShrink: 0, color: 'var(--muted-foreground)' }}
        />
        <input
          className="flex-1 bg-transparent text-[0.84rem] outline-none"
          style={{ color: 'var(--foreground)' }}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setSelectedIndex(0)
          }}
          placeholder="Search notes..."
          spellCheck={false}
        />
      </div>
      <div className="overflow-y-auto" style={{ maxHeight: 280 }}>
        {showSections && (
          <div
            className="px-3.5 pb-1 pt-2 text-[0.65rem] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Titles
          </div>
        )}
        {titleResults.map((r, i) => (
          <div
            key={`t-${r.title}`}
            className="flex cursor-pointer flex-col gap-0.5 px-3.5 py-2 transition-colors"
            style={{ background: i === selectedIndex ? 'var(--accent)' : undefined }}
            onMouseEnter={() => setSelectedIndex(i)}
          >
            <span
              className="truncate text-[0.82rem] font-medium"
              style={{ color: 'var(--foreground)' }}
            >
              {r.title}
            </span>
            {r.path && (
              <span
                className="truncate text-[0.68rem]"
                style={{ color: 'var(--muted-foreground)' }}
              >
                {r.path}
              </span>
            )}
          </div>
        ))}
        {showSections && (
          <div
            className="px-3.5 pb-1 pt-2 text-[0.65rem] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Content
          </div>
        )}
        {contentOnly.map((r, i) => (
          <div
            key={`c-${r.title}`}
            className="flex cursor-pointer flex-col gap-0.5 px-3.5 py-2 transition-colors"
            style={{
              background: i + titleResults.length === selectedIndex ? 'var(--accent)' : undefined
            }}
            onMouseEnter={() => setSelectedIndex(i + titleResults.length)}
          >
            <span
              className="truncate text-[0.82rem] font-medium"
              style={{ color: 'var(--foreground)' }}
            >
              {r.title}
            </span>
            {r.path && (
              <span
                className="truncate text-[0.68rem]"
                style={{ color: 'var(--muted-foreground)' }}
              >
                {r.path}
              </span>
            )}
            {r.snippet && (
              <span
                className="truncate text-[0.68rem]"
                style={{ color: 'color-mix(in oklch, var(--muted-foreground) 80%, transparent)' }}
              >
                {r.snippet}
              </span>
            )}
          </div>
        ))}
        {query.trim() && results.length === 0 && (
          <p
            className="m-0 p-4 text-center text-[0.82rem]"
            style={{ color: 'var(--muted-foreground)' }}
          >
            No results found.
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Present Demo (Ghost Mode) ───

export function PresentDemo(): React.JSX.Element {
  return (
    <DesktopShell wallpaper="/wallpaper-goldengate.jpg" stretch>
      <AppWindow style={{ opacity: 0.7 }}>
        <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
          <div
            className="flex w-[180px] shrink-0 flex-col border-r"
            style={{
              borderColor: 'var(--border)',
              background: 'color-mix(in oklch, var(--muted) 30%, var(--background))'
            }}
          >
            <div
              className="flex h-8 items-center px-3 text-[0.65rem] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--muted-foreground)' }}
            >
              <ChevronRight style={{ width: 13, height: 13, transform: 'rotate(90deg)' }} />
              NOTES
            </div>
            <div className="flex-1 overflow-hidden text-[0.78rem]">
              <div
                className="flex h-7 items-center gap-[5px] pr-2"
                style={{
                  paddingLeft: 12,
                  background: 'color-mix(in oklch, var(--foreground) 5%, transparent)'
                }}
              >
                <span className="inline-flex w-4 shrink-0" />
                <FileText
                  style={{ width: 13, height: 13, flexShrink: 0, color: 'var(--muted-foreground)' }}
                />
                <span className="truncate font-medium" style={{ color: 'var(--foreground)' }}>
                  Acme Demo Script
                </span>
              </div>
              <div className="flex h-7 items-center gap-[5px] pr-2" style={{ paddingLeft: 12 }}>
                <span className="inline-flex w-4 shrink-0" />
                <FileText
                  style={{ width: 13, height: 13, flexShrink: 0, color: 'var(--muted-foreground)' }}
                />
                <span className="truncate font-medium" style={{ color: 'var(--foreground)' }}>
                  Objection Handling
                </span>
              </div>
              <div className="flex h-7 items-center gap-[5px] pr-2" style={{ paddingLeft: 12 }}>
                <span className="inline-flex w-4 shrink-0" />
                <FileText
                  style={{ width: 13, height: 13, flexShrink: 0, color: 'var(--muted-foreground)' }}
                />
                <span className="truncate font-medium" style={{ color: 'var(--foreground)' }}>
                  Pricing Tiers
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-1 flex-col" style={{ background: 'var(--background)' }}>
            <div
              className="flex h-8 shrink-0 items-center border-b"
              style={{ borderColor: 'var(--border)', background: 'var(--muted)' }}
            >
              <div
                className="flex h-full items-center border-b-2 px-2.5 text-[0.72rem] font-medium"
                style={{
                  color: 'var(--foreground)',
                  borderColor: 'var(--primary)',
                  background: 'var(--background)'
                }}
              >
                Acme Demo Script
              </div>
            </div>
            <div
              className="flex-1 overflow-hidden p-3 text-[0.82rem] leading-relaxed"
              style={{ color: 'var(--foreground)' }}
            >
              <h2 className="mb-2 text-[1.1rem] font-semibold">Acme Corp — Enterprise Demo</h2>
              <p className="mb-2 text-[0.78rem]" style={{ color: 'var(--muted-foreground)' }}>
                Champion: Priya (VP Product) &bull; 200 seats &bull; Migrating from Confluence
              </p>
              <ol className="space-y-1.5 pl-4" style={{ listStyle: 'decimal' }}>
                <li>
                  <strong>Pain point</strong> — &quot;8 seconds to load a page&quot; — show instant
                  open
                </li>
                <li>
                  <strong>Offline demo</strong> — Toggle Wi-Fi off, keep editing
                </li>
                <li>
                  <strong>Plain Markdown export</strong> — Open .md file in VS Code
                </li>
                <li>
                  <strong>Search</strong> — Cmd+K across 200+ notes in &lt;100ms
                </li>
              </ol>
              <blockquote
                className="mt-3 border-l-[3px] pl-3 text-[0.78rem]"
                style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
              >
                If asked about SSO: &quot;Enterprise plan includes SAML — sending docs after the
                call.&quot;
              </blockquote>
            </div>
          </div>
        </div>
      </AppWindow>
    </DesktopShell>
  )
}

// ─── Capture Demo (Real Editor, no sidebar) ───

const CAPTURE_NOTES: MockNote[] = [
  {
    relativePath: 'Meeting Notes/Client Kickoff — Acme Corp.md',
    title: 'Client Kickoff — Acme Corp',
    mtimeMs: Date.now() - 60000,
    content: `---
title: "Client Kickoff — Acme Corp"
---

## Attendees

Lisa (PM), Derek (Engineering), Priya (Acme VP of Product)

## Goals

Acme wants to migrate 200 users from Confluence to a lightweight, local-first solution. Key concerns:

1. **Data portability** — Everything must export as plain Markdown
2. **Offline access** — Their field team works in low-connectivity areas
3. **Speed** — Current tool takes 8+ seconds to load a page

## Timeline

| Phase | Date | Deliverable |
|-------|------|-------------|
| Discovery | Mar 3–7 | Needs assessment |
| Pilot | Mar 10–21 | 50-user rollout |
| Full rollout | Apr 1 | All 200 users |

## Next Steps

- [ ] Send Priya the security whitepaper
- [ ] Derek to set up staging environment
- [x] Lisa to draft SOW by Friday
- [ ] Schedule weekly check-in (Thursdays 2pm)

> "If the tool is fast and the files are mine, I'm sold." — Priya`
  },
  {
    relativePath: 'Video Script — Why I Switched.md',
    title: 'Video Script — Why I Switched',
    mtimeMs: Date.now() - 3600000,
    content: `---
title: "Video Script — Why I Switched to Plain Text Notes"
---

## Hook

"I deleted Notion, Obsidian, and Roam — and replaced them all with plain Markdown files."

## The Problem

Every notes app eventually becomes the thing you're organizing instead of the thing helping you think. I spent more time tagging, linking, and building systems than actually *writing*.

## The Switch

Moved everything to .md files in a folder. That's it. Here's what happened:

1. **I write more** — No friction, no setup
2. **I find things faster** — Full-text search beats tags
3. **I own my data** — No vendor lock-in, no subscription`
  },
  {
    relativePath: 'Daily Notes/2025-02-27.md',
    title: '2025-02-27',
    mtimeMs: Date.now() - 7200000,
    content: `---
title: 2025-02-27
---

## Morning

- Team sync at 9:30
- Reply to Acme Corp follow-up
- Book flights for next week

## Ideas

What if we added a "focus mode" that dims everything except the current paragraph? Like a spotlight for writing.`
  }
]

export function CaptureDemo(): React.JSX.Element {
  return (
    <DesktopShell wallpaper="/wallpaper-cabin.jpg" stretch>
      <div
        className="w-full overflow-hidden rounded-lg border border-border/50 shadow-2xl"
        style={{ maxHeight: '100%' }}
      >
        <AppPreviewProvider notes={CAPTURE_NOTES}>
          <AppPreview
            height={CARD_HEIGHT - 48}
            showSidebar={false}
            defaultNote="Meeting Notes/Client Kickoff — Acme Corp.md"
          />
        </AppPreviewProvider>
      </div>
    </DesktopShell>
  )
}

// ─── Organize Demo (Interactive Tree) ───

const ORGANIZE_TREE: TreeItemData[] = [
  {
    id: 'projects',
    name: 'Projects',
    isFolder: true,
    defaultOpen: true,
    children: [
      {
        id: 'onpoint',
        name: 'ONPOINT',
        isFolder: true,
        defaultOpen: true,
        children: [
          { id: 'arch', name: 'Architecture' },
          { id: 'roadmap', name: 'Roadmap' },
          { id: 'design', name: 'Design System' }
        ]
      },
      {
        id: 'blog',
        name: 'Blog Redesign',
        isFolder: true,
        defaultOpen: true,
        children: [
          { id: 'wire', name: 'Wireframes' },
          { id: 'content', name: 'Content Plan' }
        ]
      }
    ]
  },
  {
    id: 'daily',
    name: 'Daily Notes',
    isFolder: true,
    defaultOpen: true,
    children: [
      { id: 'd1', name: '2025-02-27' },
      { id: 'd2', name: '2025-02-26' },
      { id: 'd3', name: '2025-02-25' }
    ]
  },
  {
    id: 'refs',
    name: 'References',
    isFolder: true,
    children: [
      { id: 'react', name: 'React Patterns' },
      { id: 'keys', name: 'Keyboard Shortcuts' }
    ]
  },
  {
    id: 'ideas',
    name: 'Ideas',
    isFolder: true,
    children: [
      { id: 'plugins', name: 'Plugin System' },
      { id: 'mobile', name: 'Mobile App' }
    ]
  },
  { id: 'archive', name: 'Archive', isFolder: true }
]

let counter = 0

export function OrganizeDemo(): React.JSX.Element {
  const [tree, setTree] = useState(ORGANIZE_TREE)
  const { openFolders, toggleFolder } = useTree(tree)
  const [activeId, setActiveId] = useState<string | undefined>(undefined)

  const addFile = useCallback(() => {
    counter++
    const newFile: TreeItemData = { id: `new-file-${counter}`, name: `Untitled ${counter}` }
    setTree((prev) => [...prev, newFile])
    setActiveId(newFile.id)
  }, [])

  const addFolder = useCallback(() => {
    counter++
    const newFolder: TreeItemData = {
      id: `new-folder-${counter}`,
      name: `New Folder ${counter}`,
      isFolder: true,
      defaultOpen: true
    }
    setTree((prev) => [...prev, newFolder])
  }, [])

  return (
    <DesktopShell wallpaper="/wallpaper-leaves.jpg">
      <SidebarWindow onAddFile={addFile} onAddFolder={addFolder}>
        <div className="overflow-y-auto overflow-x-hidden">
          {tree.map((item) => (
            <InteractiveTreeNode
              key={item.id}
              item={item}
              activeId={activeId}
              onSelect={setActiveId}
              openFolders={openFolders}
              onToggleFolder={toggleFolder}
            />
          ))}
        </div>
      </SidebarWindow>
    </DesktopShell>
  )
}

// ─── Search Demo (Interactive) ───

export function SearchDemo(): React.JSX.Element {
  return (
    <DesktopShell wallpaper="/wallpaper-blobs.jpg">
      <InteractiveSearch />
    </DesktopShell>
  )
}

// ─── CLI Demo (Interactive Terminal) ───

type TermLine = { type: 'cmd'; text: string } | { type: 'output'; content: React.ReactNode }

function colorizeCmd(raw: string): React.ReactNode {
  // Colorize parts: $ prompt, strings in quotes, flags starting with --
  const parts: React.ReactNode[] = []
  let i = 0
  const str = raw.trim()
  while (i < str.length) {
    if (str[i] === '"') {
      const end = str.indexOf('"', i + 1)
      const slice = end === -1 ? str.slice(i) : str.slice(i, end + 1)
      parts.push(
        <span key={i} className="text-amber-600 dark:text-amber-300">
          {slice}
        </span>
      )
      i += slice.length
    } else if (str[i] === '-' && str[i + 1] === '-') {
      const end = str.indexOf(' ', i)
      const slice = end === -1 ? str.slice(i) : str.slice(i, end)
      parts.push(
        <span key={i} className="text-cyan-600 dark:text-cyan-400">
          {slice}
        </span>
      )
      i += slice.length
    } else {
      const nextSpecial = str.slice(i).search(/["]/)
      const nextFlag = str.indexOf(' --', i)
      let end = str.length
      if (nextSpecial !== -1) end = Math.min(end, i + nextSpecial)
      if (nextFlag !== -1) end = Math.min(end, nextFlag + 1)
      parts.push(
        <span key={i} style={{ color: 'var(--foreground)' }}>
          {str.slice(i, end)}
        </span>
      )
      i = end
    }
  }
  return parts
}

type CLICommand = {
  match: (input: string) => boolean
  output: React.ReactNode
}

const CLI_COMMANDS: CLICommand[] = [
  {
    match: (input) => {
      const lower = input.toLowerCase()
      return lower.startsWith('onpoint search') || lower.startsWith('search')
    },
    output: (
      <>
        <div>
          <span className="font-semibold" style={{ color: 'var(--foreground)' }}>
            API Design Patterns
          </span>
          {'  '}
          <span style={{ color: 'var(--muted-foreground)' }}>
            (Projects/API Design Patterns.md)
          </span>
        </div>
        <div style={{ color: 'var(--muted-foreground)' }}>
          {'  '}Cursor-based pagination scales better than offset-based...
        </div>
        <div className="mt-1">
          <span className="font-semibold" style={{ color: 'var(--foreground)' }}>
            Architecture Decision
          </span>
          {'  '}
          <span style={{ color: 'var(--muted-foreground)' }}>
            (Projects/Architecture Decision.md)
          </span>
        </div>
        <div style={{ color: 'var(--muted-foreground)' }}>
          {'  '}Use pnpm workspaces with apps/ and packages/ directories...
        </div>
      </>
    )
  },
  {
    match: (input) => {
      const lower = input.toLowerCase()
      return lower.includes('note list') || lower.includes('note ls') || lower === 'ls'
    },
    output: (
      <>
        <div>
          <span className="font-semibold" style={{ color: 'var(--foreground)' }}>
            API Design Patterns
          </span>
          {'            '}
          <span style={{ color: 'var(--muted-foreground)' }}>2m ago</span>
          {'  '}
          <span style={{ color: 'var(--muted-foreground)', opacity: 0.5 }}>Projects/</span>
        </div>
        <div>
          <span className="font-semibold" style={{ color: 'var(--foreground)' }}>
            Architecture Decision
          </span>
          {'          '}
          <span style={{ color: 'var(--muted-foreground)' }}>1h ago</span>
          {'  '}
          <span style={{ color: 'var(--muted-foreground)', opacity: 0.5 }}>Projects/</span>
        </div>
        <div>
          <span className="font-semibold" style={{ color: 'var(--foreground)' }}>
            Standup
          </span>
          {'                        '}
          <span style={{ color: 'var(--muted-foreground)' }}>30m ago</span>
          {'  '}
          <span style={{ color: 'var(--muted-foreground)', opacity: 0.5 }}>Daily Notes/</span>
        </div>
        <div>
          <span className="font-semibold" style={{ color: 'var(--foreground)' }}>
            React Patterns
          </span>
          {'                '}
          <span style={{ color: 'var(--muted-foreground)' }}>2h ago</span>
          {'  '}
          <span style={{ color: 'var(--muted-foreground)', opacity: 0.5 }}>References/</span>
        </div>
      </>
    )
  },
  {
    match: (input) => {
      const lower = input.toLowerCase()
      return (
        lower.includes('note read') || lower.includes('note cat') || lower.includes('note show')
      )
    },
    output: (
      <div style={{ color: 'var(--muted-foreground)' }}>
        Cursor-based pagination scales better than offset-based
        <br />
        for large datasets. Always return next/prev links.
        <br />
        <br />
        - Use cursor tokens, not page numbers
        <br />
        - Default limit: 25, max: 100
        <br />- Include total count in response headers
      </div>
    )
  },
  {
    match: (input) => {
      const lower = input.toLowerCase()
      return lower.includes('help') || lower === 'onpoint' || lower === 'onpoint --help'
    },
    output: (
      <>
        <div style={{ color: 'var(--foreground)' }}>
          <span className="font-semibold">onpoint</span> — Notes CLI
        </div>
        <div className="mt-1" style={{ color: 'var(--muted-foreground)' }}>
          <span className="text-cyan-600 dark:text-cyan-400">{'  '}search content</span> {'<query>'}
          {'       '}Search note contents
          <br />
          <span className="text-cyan-600 dark:text-cyan-400">{'  '}note list</span> {'[--limit N]'}
          {'       '}List recent notes
          <br />
          <span className="text-cyan-600 dark:text-cyan-400">{'  '}note read</span> {'<path>'}
          {'            '}Read a note
          <br />
          <span className="text-cyan-600 dark:text-cyan-400">{'  '}note create</span> {'<title>'}
          {'          '}Create a new note
          <br />
          <span className="text-cyan-600 dark:text-cyan-400">{'  '}help</span>
          {'                        '}Show this help
        </div>
      </>
    )
  },
  {
    match: (input) => {
      const lower = input.toLowerCase()
      return lower.includes('note create') || lower.includes('note new')
    },
    output: (
      <div>
        <span className="text-emerald-500 dark:text-emerald-400">Created</span>{' '}
        <span style={{ color: 'var(--foreground)' }}>Untitled.md</span>
      </div>
    )
  },
  {
    match: (input) => input.trim() === 'clear',
    output: null // special: handled in state
  }
]

const INITIAL_LINES: TermLine[] = [
  { type: 'cmd', text: 'onpoint search content "pagination"' },
  {
    type: 'output',
    content: (
      <>
        <div>
          <span className="font-semibold" style={{ color: 'var(--foreground)' }}>
            API Design Patterns
          </span>
          {'  '}
          <span style={{ color: 'var(--muted-foreground)' }}>
            (Projects/API Design Patterns.md)
          </span>
        </div>
        <div style={{ color: 'var(--muted-foreground)' }}>
          {'  '}Cursor-based pagination scales better than offset-based...
        </div>
      </>
    )
  },
  { type: 'cmd', text: 'onpoint note list --limit 3' },
  {
    type: 'output',
    content: (
      <>
        <div>
          <span className="font-semibold" style={{ color: 'var(--foreground)' }}>
            API Design Patterns
          </span>
          {'            '}
          <span style={{ color: 'var(--muted-foreground)' }}>2m ago</span>
          {'  '}
          <span style={{ color: 'var(--muted-foreground)', opacity: 0.5 }}>Projects/</span>
        </div>
        <div>
          <span className="font-semibold" style={{ color: 'var(--foreground)' }}>
            Architecture Decision
          </span>
          {'          '}
          <span style={{ color: 'var(--muted-foreground)' }}>1h ago</span>
          {'  '}
          <span style={{ color: 'var(--muted-foreground)', opacity: 0.5 }}>Projects/</span>
        </div>
        <div>
          <span className="font-semibold" style={{ color: 'var(--foreground)' }}>
            Standup
          </span>
          {'                        '}
          <span style={{ color: 'var(--muted-foreground)' }}>30m ago</span>
          {'  '}
          <span style={{ color: 'var(--muted-foreground)', opacity: 0.5 }}>Daily Notes/</span>
        </div>
      </>
    )
  }
]

export function CLIDemo(): React.JSX.Element {
  const [lines, setLines] = useState<TermLine[]>(INITIAL_LINES)
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [lines])

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim()
    if (!trimmed) return

    if (trimmed === 'clear') {
      setLines([])
      setInput('')
      return
    }

    const cmdLine: TermLine = { type: 'cmd', text: trimmed }
    const matched = CLI_COMMANDS.find((c) => c.match(trimmed))
    const outputLine: TermLine | null = matched?.output
      ? { type: 'output', content: matched.output }
      : {
          type: 'output',
          content: (
            <div style={{ color: 'var(--muted-foreground)' }}>
              command not found: {trimmed.split(' ')[0]}. Try{' '}
              <span className="text-cyan-600 dark:text-cyan-400">onpoint help</span>
            </div>
          )
        }

    setLines((prev) => [...prev, cmdLine, ...(outputLine ? [outputLine] : [])])
    setInput('')
  }, [input])

  return (
    <DesktopShell wallpaper="/wallpaper-wave.jpg">
      <div
        className="flex w-full flex-col overflow-hidden rounded-lg border border-border/50 font-mono shadow-2xl"
        style={{ background: 'var(--card)', maxHeight: '100%' }}
        onClick={() => inputRef.current?.focus()}
      >
        <div
          className="flex h-9 shrink-0 items-center gap-2 border-b px-3"
          style={{
            borderColor: 'var(--border)',
            background: 'color-mix(in oklch, var(--muted) 50%, var(--background))'
          }}
        >
          <TrafficLights />
          <span className="ml-2 text-[0.65rem]" style={{ color: 'var(--muted-foreground)' }}>
            Terminal
          </span>
        </div>
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-3.5 text-[12px] leading-[1.7]"
          style={{ color: 'var(--foreground)' }}
        >
          {lines.map((line, i) =>
            line.type === 'cmd' ? (
              <div key={i} className={i > 0 ? 'mt-3' : ''}>
                <span className="text-emerald-500 dark:text-emerald-400">$</span>{' '}
                {colorizeCmd(line.text)}
              </div>
            ) : (
              <div key={i} className="mt-1.5">
                {line.content}
              </div>
            )
          )}
          {/* Input line */}
          <div
            className={lines.length > 0 ? 'mt-3' : ''}
            style={{ display: 'flex', alignItems: 'center' }}
          >
            <span className="text-emerald-500 dark:text-emerald-400">$</span>
            <input
              ref={inputRef}
              className="ml-1 flex-1 border-0 bg-transparent text-[12px] outline-none"
              style={{
                color: 'var(--foreground)',
                caretColor: 'var(--foreground)',
                fontFamily: 'inherit',
                lineHeight: 'inherit',
                padding: 0
              }}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit()
              }}
              spellCheck={false}
              autoComplete="off"
            />
          </div>
        </div>
      </div>
    </DesktopShell>
  )
}

// ─── Cross-platform Demo (Theme Showcase) ───

function shortThemeName(theme: ThemeDefinition): string {
  return theme.name.replace(' Light', '').replace(' Dark', '').replace(' Pro', '')
}

function ThemePicker({
  themes,
  label,
  active,
  onSelect
}: {
  themes: readonly ThemeDefinition[]
  label: string
  active: ThemeDefinition
  onSelect: (t: ThemeDefinition) => void
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <span
        className="w-9 shrink-0 text-[0.6rem] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--muted-foreground)' }}
      >
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        {themes.map((t) => {
          const isActive = t.id === active.id
          return (
            <button
              key={t.id}
              type="button"
              className="flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0"
              onClick={() => onSelect(t)}
            >
              <span
                className="block size-3 rounded-full transition-shadow"
                style={{
                  background: t.colors.primary,
                  boxShadow: isActive
                    ? `0 0 0 2px var(--background), 0 0 0 4px ${t.colors.primary}`
                    : `0 0 0 1px ${t.colors.border}`
                }}
              />
              <span
                className="text-[0.6rem] transition-colors"
                style={{
                  color: isActive ? 'var(--foreground)' : 'var(--muted-foreground)',
                  fontWeight: isActive ? 600 : 400
                }}
              >
                {shortThemeName(t)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function CrossPlatformDemo(): React.JSX.Element {
  const [theme, setTheme] = useState<ThemeDefinition>(LIGHT_THEMES[0])

  const themeVars = useMemo(() => {
    const s: Record<string, string> = {}
    for (const [k, v] of Object.entries(theme.colors)) s[`--${k}`] = v
    return s
  }, [theme])

  return (
    <div
      className="overflow-hidden rounded-xl border border-border"
      style={{ height: CARD_HEIGHT }}
    >
      <div className="flex h-full flex-col">
        {/* Themed area with wallpaper + padded app window */}
        <div
          className="relative flex flex-1 items-stretch overflow-hidden p-4 sm:p-5"
          style={themeVars}
        >
          <img
            src="/wallpaper-swirl.jpg"
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
          <div
            className="relative flex w-full flex-col overflow-hidden rounded-lg border shadow-2xl"
            style={{
              background: 'var(--background)',
              borderColor: 'var(--border)',
              transition: 'background 0.3s, border-color 0.3s'
            }}
          >
            <div
              className="flex h-9 shrink-0 items-center gap-2 border-b px-3"
              style={{
                borderColor: 'var(--border)',
                background: 'color-mix(in oklch, var(--muted) 50%, var(--background))',
                transition: 'background 0.3s, border-color 0.3s'
              }}
            >
              <TrafficLights />
              <div className="ml-2 flex items-center gap-1">
                <div
                  className="flex size-6 items-center justify-center rounded"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  <PanelLeft style={{ width: 13, height: 13 }} />
                </div>
                <div
                  className="flex size-6 items-center justify-center rounded"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  <Search style={{ width: 13, height: 13 }} />
                </div>
              </div>
              <div style={{ flex: 1 }} />
              <span
                className="select-none text-[0.65rem]"
                style={{ color: 'var(--muted-foreground)', opacity: 0.6 }}
              >
                ONPOINT
              </span>
              <div style={{ flex: 1 }} />
              <div style={{ width: 60 }} />
            </div>
            <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
              <div
                className="hidden w-[180px] shrink-0 flex-col border-r sm:flex"
                style={{
                  borderColor: 'var(--border)',
                  background: 'color-mix(in oklch, var(--muted) 30%, var(--background))',
                  transition: 'background 0.3s, border-color 0.3s'
                }}
              >
                <div
                  className="flex h-8 items-center px-3 text-[0.65rem] font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  <ChevronRight style={{ width: 13, height: 13, transform: 'rotate(90deg)' }} />
                  NOTES
                </div>
                <div className="flex-1 overflow-hidden text-[0.78rem]">
                  <div
                    className="flex h-7 items-center gap-[5px] pr-2"
                    style={{
                      paddingLeft: 12,
                      background: 'color-mix(in oklch, var(--foreground) 5%, transparent)'
                    }}
                  >
                    <span className="inline-flex w-4 shrink-0" />
                    <FileText
                      style={{
                        width: 13,
                        height: 13,
                        flexShrink: 0,
                        color: 'var(--muted-foreground)'
                      }}
                    />
                    <span className="truncate font-medium" style={{ color: 'var(--foreground)' }}>
                      Getting Started
                    </span>
                  </div>
                  <div className="flex h-7 items-center gap-[5px] pr-2" style={{ paddingLeft: 12 }}>
                    <span className="inline-flex w-4 shrink-0 items-center justify-center">
                      <ChevronRight
                        style={{
                          width: 13,
                          height: 13,
                          color: 'var(--muted-foreground)',
                          transform: 'rotate(90deg)'
                        }}
                      />
                    </span>
                    <FolderOpen
                      style={{
                        width: 13,
                        height: 13,
                        flexShrink: 0,
                        color: 'var(--muted-foreground)'
                      }}
                    />
                    <span className="truncate font-medium" style={{ color: 'var(--foreground)' }}>
                      Projects
                    </span>
                  </div>
                  <div className="flex h-7 items-center gap-[5px] pr-2" style={{ paddingLeft: 32 }}>
                    <span className="inline-flex w-4 shrink-0" />
                    <FileText
                      style={{
                        width: 13,
                        height: 13,
                        flexShrink: 0,
                        color: 'var(--muted-foreground)'
                      }}
                    />
                    <span className="truncate font-medium" style={{ color: 'var(--foreground)' }}>
                      Setup Guide
                    </span>
                  </div>
                </div>
              </div>
              <div
                className="flex flex-1 flex-col"
                style={{ background: 'var(--background)', transition: 'background 0.3s' }}
              >
                <div
                  className="flex h-8 shrink-0 items-center border-b"
                  style={{
                    borderColor: 'var(--border)',
                    background: 'var(--muted)',
                    transition: 'background 0.3s, border-color 0.3s'
                  }}
                >
                  <div
                    className="flex h-full items-center border-b-2 px-2.5 text-[0.72rem] font-medium"
                    style={{
                      color: 'var(--foreground)',
                      borderColor: 'var(--primary)',
                      background: 'var(--background)',
                      transition: 'background 0.3s, border-color 0.3s, color 0.3s'
                    }}
                  >
                    Getting Started
                  </div>
                </div>
                <div
                  className="flex-1 overflow-hidden p-3 text-[0.82rem] leading-relaxed"
                  style={{ color: 'var(--foreground)' }}
                >
                  <h2 className="mb-1 text-[1.1rem] font-semibold">Welcome to ONPOINT</h2>
                  <p className="mb-2" style={{ color: 'var(--muted-foreground)' }}>
                    Your notes, plain Markdown, stored locally, always yours.
                  </p>
                  <h3 className="mb-1 text-[0.95rem] font-semibold">Quick Start</h3>
                  <ol className="mb-3 space-y-0.5 pl-4" style={{ listStyle: 'decimal' }}>
                    <li>
                      Create a note with <strong>Cmd+N</strong>
                    </li>
                    <li>Write in Markdown</li>
                    <li>
                      Search with <strong>Cmd+K</strong>
                    </li>
                    <li>Organize with folders</li>
                  </ol>
                  <h3 className="mb-1 text-[0.95rem] font-semibold">Features</h3>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked
                        readOnly
                        className="size-3.5"
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      <span>Markdown-native editor</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked
                        readOnly
                        className="size-3.5"
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      <span>Ghost mode for presentations</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked
                        readOnly
                        className="size-3.5"
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      <span>Full-text search</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked
                        readOnly
                        className="size-3.5"
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      <span>CLI for AI agents</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Theme picker — outside themed area */}
        <div className="shrink-0 border-t border-border px-4 py-2.5">
          <div className="flex flex-col gap-1.5">
            <ThemePicker themes={LIGHT_THEMES} label="Light" active={theme} onSelect={setTheme} />
            <ThemePicker themes={DARK_THEMES} label="Dark" active={theme} onSelect={setTheme} />
          </div>
        </div>
      </div>
    </div>
  )
}
