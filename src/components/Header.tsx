export default function Header() {
  return (
    <header className="w-full bg-[#FBF7F0] border-b border-[#D8D2C8] py-3 px-6">
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-[0.15em] text-[#1C1914]" style={{ fontFamily: '"Noto Serif SC", serif' }}>
          八字排盘
        </h1>
        <span className="text-xs text-[#B0A898] hidden sm:block tracking-wider">
          四柱八字 · 传统命理
        </span>
      </div>
    </header>
  )
}
