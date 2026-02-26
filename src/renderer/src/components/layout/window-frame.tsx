type WindowFrameProps = {
  children: React.ReactNode
}

function WindowFrame({ children }: WindowFrameProps): React.JSX.Element {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-background text-foreground">
      {children}
    </div>
  )
}

export { WindowFrame }
