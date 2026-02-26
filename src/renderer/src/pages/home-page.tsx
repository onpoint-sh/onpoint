import { useCallback } from 'react'
import { Mosaic, type MosaicNode } from 'react-mosaic-component'
import { useDragDropManager } from 'react-dnd'
import { FolderOpen, FilePlus2, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import 'react-mosaic-component/react-mosaic-component.css'
import { usePanesStore } from '@/stores/panes-store'
import { useNotesStore } from '@/stores/notes-store'
import { DEFAULT_SETTINGS_SECTION_ID, getSettingsSectionPath } from '@/pages/settings-sections'
import { EditorPane } from '@/components/notes/editor-pane'

function WelcomePage(): React.JSX.Element {
  const navigate = useNavigate()
  const pickVault = useNotesStore((s) => s.pickVault)
  const config = useNotesStore((s) => s.config)
  const createNote = useNotesStore((s) => s.createNote)

  return (
    <div className="flex h-full items-center justify-center bg-background">
      <div className="flex max-w-[22rem] flex-col gap-5">
        <div>
          <h1
            className="m-0 text-[1.6rem] font-[300] leading-tight"
            style={{ color: 'var(--foreground)' }}
          >
            Onpoint
          </h1>
          <p
            className="m-0 mt-0.5 text-[0.82rem] font-[400]"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Markdown notes, captured fast
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <p
            className="m-0 mb-1 text-[0.78rem] font-[600] uppercase tracking-wide"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Start
          </p>
          {config.vaultPath ? (
            <button
              type="button"
              className="welcome-link"
              onClick={() => void createNote()}
            >
              <FilePlus2 className="size-[1.05rem]" />
              New Note…
            </button>
          ) : null}
          <button
            type="button"
            className="welcome-link"
            onClick={() => void pickVault()}
          >
            <FolderOpen className="size-[1.05rem]" />
            Open…
          </button>
          <button
            type="button"
            className="welcome-link"
            onClick={() => navigate(getSettingsSectionPath(DEFAULT_SETTINGS_SECTION_ID))}
          >
            <Settings className="size-[1.05rem]" />
            Settings
          </button>
        </div>
      </div>
    </div>
  )
}

function HomePage(): React.JSX.Element {
  const layout = usePanesStore((s) => s.layout)
  const updateLayout = usePanesStore((s) => s.updateLayout)
  const config = useNotesStore((s) => s.config)
  const dndManager = useDragDropManager()

  const handleChange = useCallback(
    (newLayout: MosaicNode<string> | null) => {
      updateLayout(newLayout)
    },
    [updateLayout]
  )

  const renderTile = useCallback((paneId: string) => {
    return <EditorPane paneId={paneId} />
  }, [])

  if (!config.vaultPath || layout === null) {
    return <WelcomePage />
  }

  return (
    <div className="mosaic-container h-full">
      <Mosaic<string>
        renderTile={renderTile}
        value={layout}
        onChange={handleChange}
        dragAndDropManager={dndManager}
        className=""
      />
    </div>
  )
}

export { HomePage }
