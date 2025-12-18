export default function Layout({ children }) {
  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">
      <main className="flex-1 overflow-hidden relative">
        <div className="absolute inset-0 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
