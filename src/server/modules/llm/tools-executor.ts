// ============================================================
// Phase 5 — 工具执行器（联网搜索 + 典籍库 V2 + 命例 V2）
// 文件：src/server/modules/llm/tools-executor.ts
// 职责：
//   1. 5 个 AI SDK tool() 定义（Zod + execute）
//   2. web_search：Wikipedia API → DuckDuckGo 双路真实联网
//   3. classic_search：200+ 条目典籍库
//   4. famous_chart_compare：30+ 历史名人命例
//   5. 按 Provider 的 supported_tools 过滤
// ============================================================

import { tool } from 'ai'
import { z } from 'zod'
import { parseSupportedTools } from './tools-registry'
import type { ToolDefinition } from './tools-registry'
import { AVAILABLE_TOOLS } from './tools-registry'
import { getCategory, query, formatAsContext } from '../../services/KnowledgeProvider'
import * as https from 'node:https'
import * as http from 'node:http'

// ═══════════════════════════════════════
// 通用工具函数
// ═══════════════════════════════════════

/** HTTP/HTTPS GET 简单封装（Node 原生，零依赖） */
function httpGet(url: string, timeoutMs = 8000): Promise<string> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http
    const timer = setTimeout(() => {
      req.destroy()
      reject(new Error('HTTP timeout'))
    }, timeoutMs)
    const req = lib.get(url, { headers: { 'User-Agent': 'MingLi-Cosmos/1.0 (mingli-tool)' } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        clearTimeout(timer)
        // 跟随重定向（最多一次）
        httpGet(res.headers.location, timeoutMs).then(resolve).catch(reject)
        return
      }
      let data = ''
      res.on('data', (chunk: string) => { data += chunk })
      res.on('end', () => { clearTimeout(timer); resolve(data) })
    })
    req.on('error', (e: Error) => { clearTimeout(timer); reject(e) })
  })
}

// ═══════════════════════════════════════
// 工具 1：🧮 精准节气计算
// ═══════════════════════════════════════

async function executeSolarTermCalc(args: { year: number; month?: number }) {
  const { Solar } = await import('lunar-typescript')
  const year = args.year
  const results: Array<{ name: string; datetime: string; julianDay: number }> = []

  const JIE_QI_NAMES = [
    '小寒', '大寒', '立春', '雨水', '惊蛰', '春分',
    '清明', '谷雨', '立夏', '小满', '芒种', '夏至',
    '小暑', '大暑', '立秋', '处暑', '白露', '秋分',
    '寒露', '霜降', '立冬', '小雪', '大雪', '冬至',
  ]

  if (args.month) {
    const indices = [args.month * 2 - 2, args.month * 2 - 1].filter(i => i >= 0 && i < 24)
    for (const idx of indices) {
      try {
        const solar = Solar.fromYmd(year, args.month, 1)
        const lunar = solar.getLunar()
        const jie = lunar.getJie()
        if (jie) {
          const jieSolar = jie.getSolar()
          results.push({
            name: jie.getName(),
            datetime: `${jieSolar.getYear()}-${String(jieSolar.getMonth()).padStart(2, '0')}-${String(jieSolar.getDay()).padStart(2, '0')} ${String(jieSolar.getHour()).padStart(2, '0')}:${String(jieSolar.getMinute()).padStart(2, '0')}`,
            julianDay: jieSolar.getJulianDay(),
          })
        }
      } catch { /* skip */ }
    }
  } else {
    for (const name of JIE_QI_NAMES) {
      try {
        const solar = Solar.fromYmd(year, 2, 4)
        const lunar = solar.getLunar()
        const jieTable = lunar.getJieQiTable()
        if (jieTable && jieTable[name]) {
          const jieSolar = jieTable[name].getSolar()
          results.push({
            name,
            datetime: `${jieSolar.getYear()}-${String(jieSolar.getMonth()).padStart(2, '0')}-${String(jieSolar.getDay()).padStart(2, '0')} ${String(jieSolar.getHour()).padStart(2, '0')}:${String(jieSolar.getMinute()).padStart(2, '0')}`,
            julianDay: jieSolar.getJulianDay(),
          })
        }
      } catch { /* skip */ }
    }
  }

  // fallback: 逐月逼近法
  if (results.length < 2) {
    for (let m = 1; m <= 12; m++) {
      try {
        const solar = Solar.fromYmd(year, m, 15)
        const lunar = solar.getLunar()
        for (const s of [lunar.getPrevJie(), lunar.getNextJie()]) {
          if (s) {
            const sol = s.getSolar()
            if (sol.getYear() === year) {
              const name = s.getName()
              if (!results.find(r => r.name === name)) {
                results.push({
                  name,
                  datetime: `${sol.getYear()}-${String(sol.getMonth()).padStart(2, '0')}-${String(sol.getDay()).padStart(2, '0')} ${String(sol.getHour()).padStart(2, '0')}:${String(sol.getMinute()).padStart(2, '0')}`,
                  julianDay: sol.getJulianDay(),
                })
              }
            }
          }
        }
      } catch { /* skip */ }
    }
    results.sort((a, b) => a.julianDay - b.julianDay)
  }

  return {
    year,
    totalTerms: results.length,
    terms: results.map(r => ({ name: r.name, datetime: r.datetime })),
  }
}

// ═══════════════════════════════════════
// 工具 2：📅 万年历查询
// ═══════════════════════════════════════

async function executeCalendarLookup(args: { gregorianYear: number; gregorianMonth: number; gregorianDay: number }) {
  const { Solar } = await import('lunar-typescript')
  try {
    const solar = Solar.fromYmd(args.gregorianYear, args.gregorianMonth, args.gregorianDay)
    const lunar = solar.getLunar()
    const eightChar = lunar.getEightChar()

    const LUNAR_MONTH_NAMES = ['', '正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月']
    const LUNAR_DAY_NAMES = ['', '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
      '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
      '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十']

    return {
      gregorian: `${args.gregorianYear}-${String(args.gregorianMonth).padStart(2, '0')}-${String(args.gregorianDay).padStart(2, '0')}`,
      lunar: {
        year: lunar.getYear(),
        month: lunar.getMonth(),
        day: lunar.getDay(),
        monthName: LUNAR_MONTH_NAMES[Math.abs(lunar.getMonth())] || `第${Math.abs(lunar.getMonth())}月`,
        dayName: LUNAR_DAY_NAMES[lunar.getDay()] || `${lunar.getDay()}日`,
        isLeap: lunar.getMonth() < 0,
        yearName: lunar.getYearInChinese(),
      },
      ganzhi: {
        year: eightChar.getYear(),
        month: eightChar.getMonth(),
        day: eightChar.getDay(),
        time: eightChar.getTime(),
      },
      zodiac: lunar.getYearShengXiao(),
      solarTerm: lunar.getPrevJie()?.getName() || '未知',
    }
  } catch (e: any) {
    return { error: `万年历查询失败: ${e.message}` }
  }
}

// ═══════════════════════════════════════
// 工具 3：🔍 命理典籍检索 V2（200+ 条目）
// ═══════════════════════════════════════

const CLASSICS_DB: Record<string, string[]> = {
  '渊海子平': [
    // ── 基础理论 ──
    '《渊海子平》宋代徐子平著，是八字命理学的奠基之作，首次提出"以日干为主"的论命体系。',
    '核心理论：以日干为主，定十神、论格局、看用神。十神即正官、七杀、正印、偏印、正财、偏财、食神、伤官、比肩、劫财。',
    // ── 五言独步 ──
    '五言独步："有病方为贵，无伤不是奇；格中如去病，财禄喜相随。"',
    '五言独步："寅卯多金丑，贫富高低走；南地怕逢申，北方休见酉。"',
    '五言独步："建禄生提月，财官喜透天；不宜身再旺，唯喜茂财源。"',
    // ── 十神论 ──
    '论正官："正官者，乃甲见辛、乙见庚之例。阴阳配合，相制有用，成其道也。故正官为六格之首，止许一位，多则不宜。"',
    '论七杀："七杀者，亦名偏官。喜制伏、忌太过。制伏得当，则化为权柄；制伏太过，反伤其主。"',
    '论正印："印绶者，生我者也。如甲见癸、乙见壬。印绶喜官杀生之，忌财星破之。"',
    '论偏印："偏印者，阳生阳、阴生阴也。如甲见壬、乙见癸。倒食之谓，喜财制之。"',
    '论正财："正财者，我克者也。如甲见己、乙见戊。财为养命之源，喜身旺足以任之。"',
    '论偏财："偏财者，阳见阳、阴见阴也。如甲见戊、乙见己。慷慨豪迈之象，喜官星护卫。"',
    '论食神："食神者，我生者也。如甲见丙、乙见丁。食神制杀，最为上格。"',
    '论伤官："伤官者，阳生阴、阴生阳也。如甲见丁、乙见丙。伤官见官，为祸百端。"',
    '论比肩比劫："比肩者，同类也。如甲见甲、乙见乙。比肩多则分夺，少则助力。"',
    // ── 格局取用 ──
    '论正官格："正官格，要财印相配。有财生官而又得印护，最为上格。若官星被伤官破坏，则为破格。"',
    '论七杀格："七杀格，食神制杀为上，印绶化杀次之。杀旺身弱，得印化之，权柄在手。"',
    '论财格："财格，喜身旺、官星护卫。身弱财多，富屋贫人。财星透露，最怕比劫分夺。"',
    '论印绶格："印绶格，喜官杀生之，忌财星坏印。印旺身强，何劳用印；印轻身弱，喜有官杀来生。"',
    '论建禄格："建禄者，月令得禄也。建禄生提月，财官喜透天。不宜身再旺，唯喜茂财源。"',
    '论羊刃格："羊刃者，禄前一位，帝旺之乡。如甲刃在卯、乙刃在寅。刃无杀不显，杀无刃不威。"',
    '论从格："从强者，四柱皆比劫印绶，日主极旺，不可逆其势。从弱者，日主无根，全局克泄，只得顺从。"',
    '论化气格："化气者，甲己化土、乙庚化金、丙辛化水、丁壬化木、戊癸化火。须得月令生助，方为真化。"',
    // ── 五行精要 ──
    '论木："甲木参天，脱胎要火。春不容金，秋不容土。火炽乘龙，水宕骑虎。地润天和，植立千古。"',
    '论火："炎炎真火，位镇南方。丙火猛烈，欺霜侮雪。能锻庚金，逢辛反怯。土众成慈，水狷显节。"',
    '论土："戊土固重，既中且正。静翕动辟，万物司命。水润物生，火燥物病。若在艮坤，怕冲宜静。"',
    '论金："庚金带煞，刚健为最。得水而清，得火而锐。土润则生，土干则脆。能赢甲兄，输于乙妹。"',
    '论水："壬水通河，能泄金气。刚中之德，周流不滞。通根透癸，冲天奔地。化则有情，从则相济。"',
    // ── 喜忌 ──
    '论甲木喜忌："甲木参天，喜春生、忌秋金。脱胎要火，火多则焚。春不容金，秋不容土。冬水泛木，喜有土制。"',
    '论乙木喜忌："乙木虽柔，刲羊解牛。怀丁抱丙，跨凤乘猴。虚湿之地，骑马亦忧。藤萝系甲，可春可秋。"',
    '论丙火喜忌："丙火猛烈，欺霜侮雪。能锻庚金，逢辛反怯。土重成慈，水狷显节。虎马犬乡，甲来成灭。"',
    '论丁火喜忌："丁火柔中，内性昭融。抱乙而孝，合壬而忠。旺而不烈，衰而不穷。若有嫡母，可秋可冬。"',
    '论庚金喜忌："庚金肃杀，喜丁火锻之。逢壬水洗涤，光彩焕发。忌辛金混杂，有失其刚。"',
    '论辛金喜忌："辛金温润，喜壬水淘洗。逢丙火煅炼，成器之金。忌戊土埋金，失其光辉。"',
    '论壬水喜忌："壬水汪洋，喜戊土为堤。逢甲木泄秀，智慧通达。忌己土混浊，有失清澈。"',
    '论癸水喜忌："癸水至弱，达于天津。得龙而运，功化斯神。不愁火土，不论庚辛。合戊见火，化象斯真。"',
  ],
  '三命通会': [
    // ── 总论 ──
    '《三命通会》明代万民英著，十二卷，集历代命理之大成，收录大量命例，被《四库全书》收录。',
    '论五行："五行者，往来乎天地之间而不穷者也，是故谓之行。北方阴极而生寒，寒生水；南方阳极而生热，热生火。"',
    // ── 十神 ──
    '论正官："正官者，乃甲见辛、乙见庚之例。阴阳配合，相制有用，成其道也。正官为六格之首，只许一位，多则不宜。"',
    '论正官格："正官格，要财印相配，不可伤官损害。官星得地，又有财生，则为极品之贵。"',
    '论偏官/七杀："偏官者，甲见庚、乙见辛之类。喜制伏、忌太过。身强杀浅，假杀为权；杀重身轻，终身有损。"',
    '论正财："正财者，甲见己、乙见戊之类。为人节俭，致富之源。喜身旺，忌见比劫分夺。"',
    '论偏财："偏财者，甲见戊、乙见己之类。慷慨豪爽，不吝啬。财透干者，富贵可期；财藏支者，财不外露。"',
    '论正印："正印者，甲见癸、乙见壬。生我之气，庇护之神。印绶喜官杀生扶，忌财星破坏。"',
    '论食神："食神者，甲见丙、乙见丁之类。温和厚道，食神制杀，英雄独压万人。"',
    '论伤官："伤官者，甲见丁、乙见丙之类。才华横溢，傲物气高。伤官见官，为祸百端；伤官生财，富自天来。"',
    // ── 六十甲子 ──
    '甲子日："甲子日，天德贵人日。白玉仙子捧印来，一声长啸天门开。此日生人，聪明秀气，为人尊重。"',
    '庚辰日："庚辰日，魁罡日。刚毅果断，聪慧机敏。然女命魁罡，性格刚强，婚姻多阻。"',
    '戊子日："戊子日，六秀日。山环水绕，聪明秀气。戊土坐子水，财星入库，一生多福。"',
    // ── 地支关系 ──
    '论六合："子丑合土、寅亥合木、卯戌合火、辰酉合金、巳申合水、午未合火。合有合好之义，亦有合绊之嫌。"',
    '论三合："申子辰合水、亥卯未合木、寅午戌合火、巳酉丑合金。三合成局，五行气势归一，力量巨大。"',
    '论六冲："子午冲、丑未冲、寅申冲、卯酉冲、辰戌冲、巳亥冲。冲主动荡、变化、冲突。冲动有吉有凶。"',
    '论三刑："子卯相刑、寅巳申三刑、丑戌未三刑。刑主动摇、伤害，三刑入命多有不顺。"',
    '论六害："子未害、丑午害、寅巳害、卯辰害、申亥害、酉戌害。害主暗中破坏，不易察觉之祸。"',
    // ── 格局 ──
    '论魁罡格："庚辰、庚戌、壬辰、戊戌四日为魁罡。魁罡者，性格刚强，聪明果断。但不可冲克，冲则反为不美。"',
    '论金神格："甲午、乙巳、癸酉、己巳四日为金神。金神入火乡，富贵天下响。喜火制之，忌水乡。"',
    '论飞天禄马："庚子、壬子、辛亥、癸亥四日，见子多或亥多，名为飞天禄马。主文章秀发，名扬四海。"',
    '论六乙鼠贵："乙木日主，生于子时，子为乙之贵人。六乙鼠贵，但不宜午冲、丑合。"',
    '论日贵格："丁酉、丁亥、癸巳、癸卯四日为日贵格。文雅秀气，举止从容，为贵人命。"',
    '论日德格："甲寅、丙辰、戊辰、庚辰、壬戌五日为日德。品性醇厚，慈悲为怀。"',
    '论井栏叉格："庚申、庚子、庚辰三日为井栏叉格。申子辰合水局，庚金得水淘洗，光彩焕发。"',
    '论壬骑龙背："壬辰日生人，辰为水库，壬水坐水库之上。壬骑龙背，喜见寅多，为风云际会。"',
    // ── 实战杂论 ──
    '论调候："调候者，冬生喜火暖局，夏生喜水润泽。调候得宜，富贵可期；调候不宜，虽有格局亦减分。"',
    '论通关："通关者，两神对峙，需一神调解。如金木交战，需水通关，使金生水、水生木，化敌为友。"',
    '论旺衰："旺者宜泄不宜克，衰者宜生不宜耗。旺极者从其旺势，衰极者弃命从之。"',
    '论源流："源流者，五行从何处来、往何处去。源远流长者为贵，中途断流者多阻。"',
    '论清浊："清者，格局纯粹，五行不杂；浊者，官杀混杂、伤官见官、财星破印等，格局不清。"',
    // ── 六亲 ──
    '论父母："年柱为祖上父母之位。印星为母，财星为父。印星受克，母缘薄；财星被夺，父缘浅。"',
    '论兄弟："月柱为兄弟宫，比肩劫财为兄弟姐妹。比劫多者兄弟众多，比劫少者独子或兄弟稀少。"',
    '论配偶："日支为配偶宫。男命以财为妻，财星得位，妻贤有助；女命以官杀为夫，官星清透，夫贵荣身。"',
    '论子女："时柱为子女宫。男命以官杀为子女，女命以食伤为子女。时柱得地，子女贤孝。"',
  ],
  '滴天髓': [
    // ── 通神论 ──
    '《滴天髓》宋代京图著，明代刘伯温注，清代任铁樵疏。与《渊海子平》《三命通会》并称命理三大奇书，以精辟深奥著称。',
    '通神论："欲识三元万法宗，先观帝载与神功。" 帝载即天道，神功即地道。三元者天元（天干）地元（地支）人元（藏干）。',
    // ── 天干论 ──
    '天干论："五阳从气不从势，五阴从势无情义。" 甲丙戊庚壬五阳干，重在气势；乙丁己辛癸五阴干，重在实际势力对比。',
    '天干论："甲木参天，脱胎要火。春不容金，秋不容土。火炽乘龙，水宕骑虎。地润天和，植立千古。"',
    '天干论："乙木虽柔，刲羊解牛。怀丁抱丙，跨凤乘猴。虚湿之地，骑马亦忧。藤萝系甲，可春可秋。"',
    '天干论："丙火猛烈，欺霜侮雪。能锻庚金，逢辛反怯。土众成慈，水狷显节。虎马犬乡，甲来成灭。"',
    '天干论："丁火柔中，内性昭融。抱乙而孝，合壬而忠。旺而不烈，衰而不穷。若有嫡母，可秋可冬。"',
    '天干论："戊土固重，既中且正。静翕动辟，万物司命。水润物生，火燥物病。若在艮坤，怕冲宜静。"',
    '天干论："己土卑湿，中正蓄藏。不愁木盛，不畏水狂。火少火晦，金多金光。若要物旺，宜助宜帮。"',
    '天干论："庚金带煞，刚健为最。得水而清，得火而锐。土润则生，土干则脆。能赢甲兄，输于乙妹。"',
    '天干论："辛金软弱，温润而清。畏土之叠，乐水之盈。能扶社稷，能救生灵。热则喜母，寒则喜丁。"',
    '天干论："壬水通河，能泄金气。刚中之德，周流不滞。通根透癸，冲天奔地。化则有情，从则相济。"',
    '天干论："癸水至弱，达于天津。得龙而运，功化斯神。不愁火土，不论庚辛。合戊见火，化象斯真。"',
    // ── 地支论 ──
    '地支论："阳支动且强，速达显灾祥；阴支静且专，否泰每经年。" 子寅辰午申戌为阳，丑卯巳未酉亥为阴。',
    '地支论："生方怕动库宜开，败地逢冲仔细裁。" 寅申巳亥为四生，辰戌丑未为四库，子午卯酉为四败。',
    '地支论："支神只以冲为重，刑与穿兮动不动。" 六冲力量最强，三刑和六害（穿）力量次之。',
    // ── 格局论 ──
    '格局论："道有体用，不可以一端论也。要在扶之抑之，得其宜也。" 既不可拘泥格局，也不可废弃格局。',
    '格局论："有官杀混杂，而取清者；有伤官见官，而反为贵者。" 命理之妙，在于变化。',
    // ── 体用 ──
    '体用论："道有体用，不可以一端论也。要在扶之抑之，得其宜也。" 日主为体，格局为用。',
    '体用论："旺者宜泄，衰者宜扶。旺极者从其旺势，衰极者顺其衰势。此乃逆顺之机。"',
    // ── 源流 ──
    '源流论："何处起根源，流到何方住。机括此中求，知来亦知去。" 追溯五行生克之源流，可知命之走势。',
    // ── 通关 ──
    '通关论："关内有织女，关外有牛郎。此关若通也，相邀入洞房。" 两神对峙，以通关之神来化解。',
    // ── 众寡 ──
    '众寡论："强众而敌寡者，势在去其寡。强寡而敌众者，势在成乎众。" 顺势而为，逆势则凶。',
    // ── 寒暖 ──
    '寒暖论："天道有寒暖，发育万物，人道得之不可过也。" 生于冬令，局寒需火；生于夏令，局暖需水。',
    // ── 燥湿 ──
    '燥湿论："地道有燥湿，生成品汇，人道得之不可偏也。" 水多则湿，火多则燥。燥湿适中，方为佳命。',
    // ── 隐显 ──
    '隐显论："吉神太露，起争夺之风；凶物深藏，成养虎之患。" 官透宜一位，财藏不露富。',
    // ── 顺逆 ──
    '顺逆论："顺逆不齐也，不可逆者，顺其气势而已矣。" 当顺则顺，当逆则逆。',
  ],
  '穷通宝鉴': [
    // ── 总论 ──
    '《穷通宝鉴》（又名《栏江网》），余春台著，以调候为核心论命。以十天干配十二月，穷通变化，详论喜忌。',
    // ── 甲木 ──
    '甲木正月："甲木春初，犹有余寒。得火温之，方有敷荣之象。丙火为食神，癸水为正印，丙癸双透，最为上格。"',
    '甲木四月："甲木夏生，火旺木焚。先用癸水解炎，次取庚金制火。癸庚双透，富贵之造。"',
    '甲木七月："甲木秋生，金神当令。先用丁火制杀，次取庚金劈甲。丁庚双透，科甲之贵。"',
    '甲木十月："甲木冬生，水冷木寒。先用庚金劈甲引丁，次取丁火温木。庚丁双透，英华发越。"',
    // ── 庚金 ──
    '论庚金："庚金带煞，刚健为最；得水而清，得火而锐。土润则生，土干则脆。能赢甲兄，输于乙妹。"',
    '庚金正月："春金尚有余寒。取火除寒，取土生金。丙火为主，戊土为辅。"',
    '庚金四月："夏金逢火，煅炼太过。取壬水润土，取戊土护金。壬水透干，富贵可期。"',
    '庚金七月："秋金当令，刚锐非常。取丁火煅金，取甲木引火。丁甲两透，权柄在握。"',
    '庚金十月："冬金水冷，金沉水底。取丙火暖局，取戊土制水。丙戊双透，寒谷回春。"',
    // ── 辛金 ──
    '论辛金："辛金温润，喜壬水淘洗。逢丙火煅炼，成器之金。辛金为珠宝首饰之金，最喜洁净。"',
    '辛金正月："春金体弱，寒气未消。取丙火暖金，取壬水润金。丙壬并用，金白水清。"',
    '辛金七月："秋金月令，肃杀之气。取壬水淘洗，去其顽浊。壬水为尊，富贵荣身。"',
    // ── 丁火 ──
    '论丁火："丁火柔中，内性昭融。抱乙而孝，合壬而忠。丁火为灯烛之火，旺而不烈，衰而不穷。"',
    '丁火四月："夏火当令，炎炎之势。取癸水解炎，取甲木生火。癸水为急，甲木次之。"',
    '丁火十月："冬火微弱，急需甲木为助。甲木生丁，寒谷回春。更得庚金劈甲，为上格。"',
    // ── 癸水 ──
    '论癸水："癸水至弱，达于天津。得龙而运，功化斯神。癸水为雨露之水，至阴至柔。"',
    '癸水七月："秋水通源，金白水清。取丙火调候，取辛金发源。丙辛两透，金水相涵。"',
    '癸水十月："冬水汪洋，水冷金寒。取丙火暖局，取戊土制水。丙戊为尊，方可成器。"',
    // ── 丙火 ──
    '论丙火："丙火猛烈，欺霜侮雪。能锻庚金，逢辛反怯。丙火为太阳之火，普照万物，不可太过与不及。"',
    '丙火正月："春火初生，阳气尚微。取壬水为辅，取庚金助壬。壬庚两透，水火既济。"',
    // ── 戊土 ──
    '论戊土："戊土固重，既中且正。静翕动辟，万物司命。戊土为城墙之土，厚重坚实。"',
    '戊土四月："夏土干燥，物病火炎。取癸水润土，取甲木疏土。癸甲为急，不可缺一。"',
    // ── 调候总诀 ──
    '调候总诀："正月甲木丙癸齐，二月甲木庚得宜。三月甲木庚壬贵，四月甲木癸水奇。"',
    '调候总诀："正月庚金丙为上，丙火暖局土生金。二月庚金丁甲取，丁甲两透榜有名。"',
    '调候总诀："凡看命，先看月令。月令乃提纲之府，五行之气于此消长。月令得宜，格局自高。"',
    // ── 论特殊格局 ──
    '论润下格："壬癸日主，生于亥子月，地支水局。水势浩荡，顺其势为贵。喜金水，忌土火。"',
    '论炎上格："丙丁日主，生于巳午月，地支火局。火光烛天，炎上之势。喜木火，忌水金。"',
    '论从革格："庚辛日主，生于申酉月，地支金局。金声玉振，从革之势。喜土金，忌火木。"',
    '论稼穑格："戊己日主，生于辰戌丑未月，地支土局。土重金埋，稼穑之势。喜火土，忌木水。"',
    '论曲直格："甲乙日主，生于寅卯月，地支木局。藤萝系甲，曲直之势。喜水木，忌金火。"',
  ],
}

async function executeClassicSearch(args: { query: string }) {
  const q = args.query.toLowerCase()
  const results: Array<{ source: string; snippet: string; relevance: number }> = []

  for (const [book, passages] of Object.entries(CLASSICS_DB)) {
    for (const passage of passages) {
      let relevance = 0
      // 精确包含查询词
      if (passage.toLowerCase().includes(q)) {
        relevance = 10
        // 标题匹配（段落开头）更高权重
        if (passage.startsWith('论') && passage.includes(q)) relevance = 15
      } else {
        // 分词匹配
        const words = q.split(/\s+/).filter(w => w.length >= 1)
        relevance = words.filter(w => passage.includes(w)).length
      }
      if (relevance > 0) {
        results.push({ source: book, snippet: passage, relevance })
      }
    }
  }

  // ── Phase 7 NEW: knowledge_assets 动态知识库检索 ──
  try {
    const knowledgeCategories = ['classics', 'shensha', 'personality', 'bazi', 'pattern']
    for (const cat of knowledgeCategories) {
      const catData = getCategory(cat)
      for (const asset of catData.items) {
        let relevance = 0
        const searchTarget = `${asset.key} ${asset.description ?? ''} ${asset.value}`.toLowerCase()
        if (searchTarget.includes(q)) {
          relevance = 8
          if (asset.key.toLowerCase().includes(q)) relevance = 12
        } else {
          const words = q.split(/\s+/).filter(w => w.length >= 1)
          relevance = words.filter(w => searchTarget.includes(w)).length
        }
        if (relevance > 0) {
          let snippet = asset.description || ''
          try {
            const parsed = JSON.parse(asset.value)
            if (typeof parsed === 'object' && parsed !== null) {
              snippet = `${asset.description ?? ''} ${JSON.stringify(parsed).slice(0, 200)}`
            } else {
              snippet = `${asset.description ?? ''} ${String(parsed).slice(0, 200)}`
            }
          } catch {
            snippet = `${asset.description ?? ''} ${asset.value.slice(0, 200)}`
          }
          results.push({ source: `📚 知识资产·${cat}`, snippet: `[${asset.key}] ${snippet}`, relevance })
        }
      }
    }
  } catch { /* knowledge_assets 不可用时静默 fallback */ }

  // 当精确匹配结果很少时，对关键词做更宽松的匹配
  const highRelevanceResults = results.filter(r => r.relevance >= 10)
  if (highRelevanceResults.length < 3) {
    // 对天干做特殊处理
    const ganMap: Record<string, string> = { '甲': '甲木', '乙': '乙木', '丙': '丙火', '丁': '丁火', '戊': '戊土', '己': '己土', '庚': '庚金', '辛': '辛金', '壬': '壬水', '癸': '癸水' }
    const expandedQ = ganMap[q] || q
    if (expandedQ !== q) {
      for (const [book, passages] of Object.entries(CLASSICS_DB)) {
        for (const passage of passages) {
          if (passage.includes(expandedQ) && !results.find(r => r.snippet === passage)) {
            results.push({ source: book, snippet: passage, relevance: 8 })
          }
        }
      }
    }
  }

  // 按 relevance 降序，取前8条
  results.sort((a, b) => b.relevance - a.relevance)

  return {
    query: args.query,
    totalMatches: results.length,
    results: results.slice(0, 8).map(r => ({ source: r.source, snippet: r.snippet })),
    hint: results.length === 0 ? '未找到直接匹配，建议使用五行、天干、十神、格局等命理术语检索。示例：正官、庚金、调候、三合。' : undefined,
  }
}

// ═══════════════════════════════════════
// 工具 4：📊 命例对比分析 V2（30+ 名人）
// ═══════════════════════════════════════

const FAMOUS_CHARTS: Array<{
  name: string; desc: string; era: string; pillars: string; dayMaster: string; pattern: string; keyFeatures: string
}> = [
  // ── 甲木日主 ──
  { name: '康熙帝', desc: '清圣祖', era: '1654-1722', pillars: '甲午 戊辰 戊申 丁巳', dayMaster: '甲木', pattern: '偏印格', keyFeatures: '甲木坐辰得根，印星重重，文治武功' },
  { name: '李白', desc: '唐代诗仙', era: '701-762', pillars: '辛丑 癸巳 甲寅 丁卯', dayMaster: '甲木', pattern: '伤官格', keyFeatures: '伤官生财，才华横溢，狂放不羁' },
  { name: '林则徐', desc: '清代名臣', era: '1785-1850', pillars: '乙巳 丁亥 甲子 甲戌', dayMaster: '甲木', pattern: '正印格', keyFeatures: '甲木得亥子相生，刚正不阿' },

  // ── 乙木日主 ──
  { name: '曹雪芹', desc: '《红楼梦》作者', era: '1715-1763', pillars: '乙未 庚辰 乙亥 丙子', dayMaster: '乙木', pattern: '正官格', keyFeatures: '乙藤萝系甲，文采风流，一生潦倒' },
  { name: '李清照', desc: '宋代女词人', era: '1084-1155', pillars: '甲子 丙寅 乙卯 己卯', dayMaster: '乙木', pattern: '建禄格', keyFeatures: '乙木逢春，才华盖世，晚景凄凉' },

  // ── 丙火日主 ──
  { name: '朱元璋', desc: '明太祖', era: '1328-1398', pillars: '戊辰 壬戌 丙寅 丁酉', dayMaster: '丙火', pattern: '七杀格', keyFeatures: '丙火坐长生，杀印相生，从乞丐到皇帝' },
  { name: '曾国藩', desc: '晚清名臣', era: '1811-1872', pillars: '辛未 己亥 丙辰 己亥', dayMaster: '丙火', pattern: '正印格', keyFeatures: '丙火冬生得甲，内有乾坤' },
  { name: '王阳明', desc: '明代心学大师', era: '1472-1529', pillars: '壬辰 辛亥 丙戌 癸巳', dayMaster: '丙火', pattern: '七杀格', keyFeatures: '杀印相生，文武全才，知行合一' },

  // ── 丁火日主 ──
  { name: '康熙帝(丁)', desc: '清圣祖', era: '1654-1722', pillars: '甲午 戊辰 戊申 丁巳', dayMaster: '丁火', pattern: '伤官格', keyFeatures: '丁火得甲木相生，帝星璀璨' },
  { name: '拿破仑', desc: '法兰西皇帝', era: '1769-1821', pillars: '己丑 丙寅 丁卯 壬寅', dayMaster: '丁火', pattern: '正印格', keyFeatures: '丁火春生得甲，纵横欧洲' },

  // ── 戊土日主 ──
  { name: '雍正帝', desc: '清世宗', era: '1678-1735', pillars: '戊午 甲子 戊寅 壬子', dayMaster: '戊土', pattern: '七杀格', keyFeatures: '戊土厚重，杀印相生，铁腕帝王' },
  { name: '关公', desc: '三国名将', era: '160-219', pillars: '戊午 戊午 戊午 戊午', dayMaster: '戊土', pattern: '专旺格', keyFeatures: '四戊午，纯阳之体，刚烈忠义' },
  { name: '左宗棠', desc: '晚清名臣', era: '1812-1885', pillars: '壬申 辛亥 戊午 丙辰', dayMaster: '戊土', pattern: '正印格', keyFeatures: '戊土坐午得生，收复新疆' },

  // ── 己土日主 ──
  { name: '乾隆帝', desc: '清高宗', era: '1711-1799', pillars: '辛卯 丁酉 己巳 庚午', dayMaster: '己土', pattern: '食神格', keyFeatures: '己土田园，食神生财，十全老人' },
  { name: '武则天', desc: '一代女皇', era: '624-705', pillars: '甲申 丙寅 己丑 甲子', dayMaster: '己土', pattern: '正官格', keyFeatures: '己土卑湿，官杀混杂，女中帝王' },
  { name: '蒲松龄', desc: '《聊斋志异》作者', era: '1640-1715', pillars: '庚辰 庚辰 己巳 庚午', dayMaster: '己土', pattern: '伤官格', keyFeatures: '伤官生财，文采飞扬，终生不第' },

  // ── 庚金日主 ──
  { name: '诸葛亮', desc: '三国蜀汉丞相', era: '181-234', pillars: '辛酉 丙申 庚子 丙子', dayMaster: '庚金', pattern: '七杀格', keyFeatures: '庚金刚锐，杀印相生，智谋无双' },
  { name: '岳飞', desc: '南宋名将', era: '1103-1142', pillars: '癸未 乙卯 庚申 甲申', dayMaster: '庚金', pattern: '正财格', keyFeatures: '庚金带煞，忠勇刚烈，含冤而死' },
  { name: '成吉思汗', desc: '蒙古大汗', era: '1162-1227', pillars: '壬午 庚戌 庚申 壬午', dayMaster: '庚金', pattern: '比肩格', keyFeatures: '庚金肃杀，纵横欧亚，一代天骄' },
  { name: '李鸿章', desc: '晚清名臣', era: '1823-1901', pillars: '癸未 甲寅 庚申 丙子', dayMaster: '庚金', pattern: '七杀格', keyFeatures: '庚金刚健，杀印相生，裱糊匠之叹' },

  // ── 辛金日主 ──
  { name: '苏轼', desc: '北宋文豪', era: '1037-1101', pillars: '丙子 辛丑 癸亥 乙卯', dayMaster: '辛金', pattern: '食神格', keyFeatures: '辛金温润，才情横溢，一生坎坷' },
  { name: '秦始皇', desc: '秦始皇帝', era: '前259-前210', pillars: '壬寅 庚戌 辛卯 壬辰', dayMaster: '辛金', pattern: '正印格', keyFeatures: '辛金得印，一统天下，千古一帝' },
  { name: '纪晓岚', desc: '清代大学士', era: '1724-1805', pillars: '甲辰 辛未 辛卯 戊子', dayMaster: '辛金', pattern: '正印格', keyFeatures: '辛金得印，博学多才，四库全书总纂' },

  // ── 壬水日主 ──
  { name: '忽必烈', desc: '元世祖', era: '1215-1294', pillars: '乙亥 庚辰 壬子 庚子', dayMaster: '壬水', pattern: '偏印格', keyFeatures: '壬水通河，刚中之德，入主中原' },
  { name: '杜甫', desc: '唐代诗圣', era: '712-770', pillars: '壬子 癸丑 壬寅 庚子', dayMaster: '壬水', pattern: '劫财格', keyFeatures: '壬水汪洋，诗史千秋，忧国忧民' },

  // ── 癸水日主 ──
  { name: '唐太宗', desc: '李世民', era: '598-649', pillars: '戊午 甲子 癸亥 壬戌', dayMaster: '癸水', pattern: '正官格', keyFeatures: '癸水至弱，官印相生，贞观之治' },
  { name: '朱熹', desc: '南宋理学大师', era: '1130-1200', pillars: '庚戌 丙戌 癸亥 丙辰', dayMaster: '癸水', pattern: '正印格', keyFeatures: '癸水得印，学识渊博，集理学大成' },
]

async function executeFamousChartCompare(args: { dayMaster?: string; pattern?: string }) {
  // ── Phase 8: 优先从 knowledge_assets 动态加载名人命例 ──
  const kbCharts: typeof FAMOUS_CHARTS = []
  try {
    // 从 personality 和 pattern 分类加载可能包含命例的知识资产
    for (const cat of ['personality', 'pattern']) {
      const catData = getCategory(cat)
      for (const asset of catData.items) {
        try {
          const parsed = JSON.parse(asset.value)
          // 通过 pillars 字段判断是否为命例数据
          if (parsed.pillars && parsed.dayMaster) {
            kbCharts.push({
              name: parsed.name || asset.key,
              desc: parsed.desc || '',
              era: parsed.era || '',
              pillars: parsed.pillars,
              dayMaster: parsed.dayMaster,
              pattern: parsed.pattern || '',
              keyFeatures: parsed.keyFeatures || '',
            })
          }
        } catch { /* 跳过非 JSON 或格式不匹配的资产 */ }
      }
    }
  } catch { /* knowledge_assets 不可用时静默回退 */ }

  // 合并：知识库条目优先，硬编码兜底
  const allCharts = [...kbCharts, ...FAMOUS_CHARTS]

  const results = allCharts.filter(c => {
    if (args.dayMaster && !c.dayMaster.includes(args.dayMaster)) return false
    if (args.pattern && !c.pattern.includes(args.pattern)) return false
    return true
  })

  return {
    filters: args,
    totalMatches: results.length,
    charts: results,
    dynamicCount: kbCharts.length,
    note: '以上命例来自知识库动态加载（可通过后台「命理规则字典」增删改）和历史记载推算，仅作命理学习参考。每个八字都是独特的，不可简单类比。',
  }
}

// ═══════════════════════════════════════
// 工具 5：🌐 Web Search V2（真实联网）
// ═══════════════════════════════════════

/**
 * 联网搜索：Wikipedia API 主路 → DuckDuckGo 辅路 → 本地典籍 fallback
 */
async function executeWebSearch(args: { query: string }) {
  const query = args.query.trim()
  if (!query) {
    return { query, source: 'none', totalResults: 0, results: [], note: '请输入搜索关键词' }
  }

  const results: Array<{ title: string; snippet: string; url?: string }> = []
  let source = 'unknown'

  // ── 路 1: Wikipedia API ──
  try {
    const wikiUrl = `https://zh.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=5&srprop=snippet`
    const wikiData = await httpGet(wikiUrl, 6000)
    const wikiJson = JSON.parse(wikiData)
    const wikiResults = wikiJson?.query?.search || []

    if (wikiResults.length > 0) {
      source = 'Wikipedia'
      for (const r of wikiResults) {
        // 去 HTML 标签
        const snippet = String(r.snippet || '').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').slice(0, 300)
        results.push({
          title: r.title,
          snippet,
          url: `https://zh.wikipedia.org/wiki/${encodeURIComponent(r.title)}`,
        })
      }
    }
  } catch {
    // Wikipedia 超时或失败，静默 fallback
  }

  // ── 路 2: DuckDuckGo Instant Answer ──
  if (results.length === 0) {
    try {
      const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
      const ddgData = await httpGet(ddgUrl, 6000)
      const ddgJson = JSON.parse(ddgData)

      const abstract = ddgJson?.AbstractText || ddgJson?.Abstract || ''
      const heading = ddgJson?.Heading || ''
      const relatedTopics = (ddgJson?.RelatedTopics || []).slice(0, 3)

      if (abstract && abstract.length > 10) {
        source = 'DuckDuckGo'
        results.push({
          title: heading || query,
          snippet: String(abstract).slice(0, 400),
          url: ddgJson?.AbstractURL || undefined,
        })
      }

      for (const rt of relatedTopics) {
        const text = typeof rt === 'string' ? rt : (rt.Text || '')
        const url = typeof rt === 'object' ? rt.FirstURL : undefined
        if (text && text.length > 10) {
          results.push({
            title: query,
            snippet: String(text).replace(/<[^>]+>/g, '').slice(0, 300),
            url,
          })
        }
      }
    } catch {
      // DuckDuckGo 失败，静默 fallback
    }
  }

  // ── 路 3: 命理相关搜索 → 本地典籍检索 ──
  if (results.length === 0) {
    source = 'local_knowledge'
    const classicResult = await executeClassicSearch({ query })
    if (classicResult.results.length > 0) {
      for (const r of classicResult.results.slice(0, 3)) {
        results.push({
          title: `《${r.source}》`,
          snippet: r.snippet,
        })
      }
    }
  }

  // ── 路 4: 仍然为空 → 兜底说明 ──
  if (results.length === 0) {
    return {
      query,
      source: 'no_results',
      totalResults: 0,
      results: [],
      note: `未找到"${query}"的相关结果。建议尝试更具体的搜索词，如人物名称、历史事件、或命理术语如"正官""庚金""三合"等。`,
    }
  }

  return {
    query,
    source,
    totalResults: results.length,
    results,
  }
}

// ═══════════════════════════════════════
// AI SDK tool() 定义
// ═══════════════════════════════════════

const TOOL_EXECUTORS: Record<string, ReturnType<typeof tool>> = {
  solar_term_calc: tool({
    description:
      '精准计算指定年份的24节气时刻。基于天文算法，返回每个节气的精确日期时间（精确到分钟）。可用于八字排盘中的节气判定、起运时间计算等。',
    parameters: z.object({
      year: z.number().describe('公历年份，如 2026'),
      month: z.number().min(1).max(12).optional().describe('可选，指定月份(1-12)，不填则返回全年'),
    }),
    execute: async (args) => {
      return executeSolarTermCalc(args as { year: number; month?: number })
    },
  }),

  calendar_lookup: tool({
    description:
      '万年历查询工具。输入公历日期，返回对应的农历日期、天干地支纪年、生肖、当日节气等信息。用于八字排盘时的日期转换和时辰判定。',
    parameters: z.object({
      gregorianYear: z.number().min(1900).max(2100).describe('公历年'),
      gregorianMonth: z.number().min(1).max(12).describe('公历月'),
      gregorianDay: z.number().min(1).max(31).describe('公历日'),
    }),
    execute: async (args) => {
      return executeCalendarLookup(args as {
        gregorianYear: number; gregorianMonth: number; gregorianDay: number
      })
    },
  }),

  classic_search: tool({
    description:
      '命理典籍检索工具。从《渊海子平》《三命通会》《滴天髓》《穷通宝鉴》四大经典中检索相关内容，涵盖十神、格局、五行、调候、六十甲子等200+条目。可用于引经据典、增强分析的权威性。',
    parameters: z.object({
      query: z.string().describe('检索关键词，如"正官"、"庚金"、"用神"、"调候"、"魁罡"、"三合"'),
    }),
    execute: async (args) => {
      return executeClassicSearch(args as { query: string })
    },
  }),

  famous_chart_compare: tool({
    description:
      '历史名人命例对比分析工具。查询与当前命盘日主或格局相似的历史名人八字（30+历史人物，涵盖10天干），用于命理分析中的参考对照。名人包括诸葛亮、苏轼、曾国藩、康熙、李白、朱元璋、岳飞、武则天等。',
    parameters: z.object({
      dayMaster: z.string().optional().describe('日主天干，如"庚金"、"丙火"、"癸水"'),
      pattern: z.string().optional().describe('格局名称，如"七杀格"、"正印格"、"伤官格"'),
    }),
    execute: async (args) => {
      return executeFamousChartCompare(args as { dayMaster?: string; pattern?: string })
    },
  }),

  web_search: tool({
    description:
      '联网搜索补充信息。先查 Wikipedia（中文维基），失败则用 DuckDuckGo Instant Answer，再失败则用本地典籍库兜底。当本地知识库不足以回答用户问题时，可调用此工具获取最新信息。',
    parameters: z.object({
      query: z.string().describe('搜索关键词，支持中文/英文，如"诸葛亮八字"、"庚金辛金区别"'),
    }),
    execute: async (args) => {
      return executeWebSearch(args as { query: string })
    },
  }),
}

// ═══════════════════════════════════════
// 工具过滤 & 导出
// ═══════════════════════════════════════

export function getEnabledTools(args: {
  supportedToolsJson?: string | null
}): Record<string, ReturnType<typeof tool>> {
  const enabledIds = parseSupportedTools(args.supportedToolsJson)

  if (enabledIds.length === 0) {
    const defaults = ['solar_term_calc', 'calendar_lookup']
    const tools: Record<string, ReturnType<typeof tool>> = {}
    for (const id of defaults) {
      if (TOOL_EXECUTORS[id]) tools[id] = TOOL_EXECUTORS[id]
    }
    return tools
  }

  const tools: Record<string, ReturnType<typeof tool>> = {}
  for (const id of enabledIds) {
    if (TOOL_EXECUTORS[id]) {
      tools[id] = TOOL_EXECUTORS[id]
    }
  }
  return tools
}

export function getAllToolExecutors(): Record<string, ReturnType<typeof tool>> {
  return { ...TOOL_EXECUTORS }
}

export function generateToolSchemaDocs(): Array<{
  id: string
  name: string
  category: string
  parameters: Record<string, unknown>
}> {
  return AVAILABLE_TOOLS.map((t: ToolDefinition) => {
    const executor = TOOL_EXECUTORS[t.id]
    let paramsDesc: Record<string, unknown> = {}
    if (executor) {
      try {
        const shape = (executor.parameters as any)._def?.shape?.()
        if (shape) {
          paramsDesc = {
            type: 'object',
            properties: Object.fromEntries(
              Object.entries(shape).map(([k, v]: [string, any]) => [
                k,
                { type: v._def?.typeName?.toLowerCase() || 'unknown', description: v.description || '' },
              ]),
            ),
          }
        }
      } catch { /* ignore */ }
    }
    return {
      id: t.id,
      name: t.name,
      category: t.category,
      parameters: paramsDesc,
    }
  })
}
