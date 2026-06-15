export default function Header() {
  return (
    <header className="w-full bg-gradient-to-r from-red-900 via-red-800 to-amber-900 text-amber-100 py-4 px-6 shadow-lg">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold tracking-wider">
          <span className="text-amber-400">八</span>字排盘
        </h1>
        <span className="text-sm text-amber-200/70 hidden sm:block">
          四柱八字 · 传统命理
        </span>
      </div>
    </header>
  )
}
