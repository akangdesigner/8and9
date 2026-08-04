/* no-way-up — 地點與互動點
 *
 * 2026-08-04 kc:「重點是一天到底要怎麼過。我很喜歡之前便利商店那些,
 *   比如可以偷便當、買 i珍食之類。」
 *
 * ── 這份表要解決的問題 ─────────────────────────────
 * 第一版的一天是抽象選單:「超商晚班 +$850」。那是記帳項目,不是遊戲。
 * kc 喜歡的是**站在那個櫃子前面**的決定:正價 89 / 黃標 58 / 趁他轉身。
 *
 * 所以一天分兩層:
 *   1. **去哪裡**(花掉一格)
 *   2. **在那裡面對什麼**(具體到物件)
 *
 * ── 鮮食櫃是這個遊戲的縮影 ───────────────────────────
 * 同一個櫃子前面三個選項,三種不同的代價:
 *   正價 89  → 錢
 *   黃標 58  → **歸屬感**(會被看見,見 DESIGN_NOTES「i珍食 = 會被看見的標籤」)
 *   偷       → **風評**(而且會被抓)
 * 一個互動點就把整個遊戲濃縮完了。
 *
 * ── 偷的規矩 ─────────────────────────────────────
 * 成功率看**店員朝向**(game.html 已有這個機制)。畫面要先告訴玩家他朝哪邊,
 * 玩家才有得算 —— 這是空間感,不是骰子。
 * 被抓 = 風評大掉,而且第二次會有前科。
 */
(function (root) {

const PLACES = {

  /* ══ 超商 ══════════════════════════════════════ */
  store: {
    name:'超商', at:['am','noon','night'],
    amb:'日光燈很亮，亮到有點刺眼。外面才是暗的。',
    spots:[
      {
        id:'hot', name:'鮮食櫃', desc:'正價便當 89。旁邊那個貼黃標，58。',
        acts:[
          { label:'拿正價的', cost:{ money:-89, full:+30 },
            say:'你拿了 89 的。', quiet:'' },
          { label:'拿黃標的（i珍食）', cost:{ money:-58, full:+28 }, seen:true,
            say:'你拿了貼黃標的那個。',
            quiet:'結帳的時候後面排了三個人。你把便當推過去的時候，\n那張黃色標籤是朝上的。' },
          { label:'塞進外套', steal:true, cost:{ full:+28 },
            say:'你把它塞進外套內袋，拉鍊拉到最上面。',
            quiet:'走出自動門那幾步，你聽得到自己的心跳。' }
        ]
      },
      {
        id:'drink', name:'飲料櫃', desc:'冰櫃的門是霧的。你站在那邊會涼一下。',
        acts:[
          { label:'買一瓶水', cost:{ money:-20, full:+6 }, say:'二十塊。', quiet:'' },
          { label:'開門站著吹', cost:{}, say:'你把門開著站了十秒。',
            quiet:'店員看你一眼。你把門關上。' }
        ]
      },
      {
        id:'shelf', name:'貨架', desc:'泡麵、餅乾、衛生紙。最上面那排是進口的。',
        acts:[
          { label:'買泡麵', cost:{ money:-25, full:+16 }, say:'最便宜那個。', quiet:'' },
          { label:'塞一包餅乾', steal:true, cost:{ full:+8 },
            say:'很小一包，塞進褲子後面口袋。',
            quiet:'你不是很想吃。你只是想試看看拿不拿得走。' }
        ]
      },
      {
        id:'mag', name:'雜誌區', desc:'站在這裡看得到門口，門口也看得到你。',
        acts:[
          { label:'翻一下', cost:{}, say:'你翻了三本，一本都沒看進去。',
            quiet:'你在等剛剛進來那個人先走。' }
        ]
      },
      {
        id:'counter', name:'櫃台', desc:'店長在看排班表。',
        acts:[
          { label:'問有沒有缺人', job:true, cost:{},
            say:'「你幾歲？」\n「十六。」\n「⋯⋯家長同意書帶來。」', quiet:'' },
          { label:'上晚班', work:true, dead:true, cost:{ money:+850, full:-12 },
            say:'到十一點。收銀、補貨、拖地。',
            quiet:'回到家十一點半。明天第一節你會睡著。' }
        ]
      },
      {
        id:'atm', name:'提款機', desc:'角落那台。',
        acts:[
          { label:'查餘額', cost:{},
            say:'你按了查詢，沒有領。',
            quiet:'螢幕上那個數字你看了兩秒就按取消。\n手續費五塊，你沒有付。' }
        ]
      }
    ]
  },

  /* ══ 學校 ══════════════════════════════════════ */
  school: {
    name:'學校', at:['am','noon'],
    amb:'走廊的地板永遠有一層灰。三年級那邊在整修，圍了兩年。',
    spots:[
      {
        id:'class', name:'教室', desc:'你的位子在窗邊倒數第二排。',
        acts:[
          { label:'上課', quiz:true, att:+1, cost:{} },
          { label:'趴著睡', cost:{ calm:-4 }, att:-1,
            say:'你睡了兩節。', quiet:'老師從你旁邊走過去，看了一眼，沒有叫你。' }
        ]
      },
      {
        id:'stair', name:'後面樓梯間', desc:'四五個人蹲在那裡。有人抬頭看你。',
        acts:[
          { label:'過去蹲一下', cost:{ calm:+6, rep:-5, money:-60, cool:+2 },
            say:'有人往旁邊挪，空出一個位子。', quiet:'那個位子不是白給的。' },
          { label:'走過去上廁所', cost:{ calm:-3 },
            say:'你經過他們，點了個頭。', quiet:'沒有人叫你。' }
        ]
      },
      {
        id:'shop', name:'福利社', desc:'排隊的人很多，麵包剩兩種。',
        acts:[
          { label:'買麵包跟奶茶', cost:{ money:-45, full:+18 }, say:'四十五。', quiet:'' },
          { label:'去裝飲水機的水', cost:{ full:+4 },
            say:'你把水壺裝滿。', quiet:'午餐就這樣。' }
        ]
      },
      {
        id:'nurse', name:'保健室', desc:'護理師不在，床是空的。',
        acts:[
          { label:'躺一下', cost:{ full:-4 },
            say:'你躺了四十分鐘，沒有睡著。', quiet:'天花板有一塊水漬，形狀像台灣。' }
        ]
      },
      {
        id:'office', name:'導師辦公室', desc:'他桌上有一疊沒發下去的講義。',
        acts:[
          { label:'問補考的事', quest:'makeup', cost:{},
            say:'「你來了。」\n他從抽屜拿出一張紙。', quiet:'' }
        ]
      }
    ]
  },

  /* ══ 家 ══════════════════════════════════════ */
  home: {
    name:'家', at:['am','night'],
    amb:'客廳燈亮著，電視開很大聲。神明桌那兩盞紅燈整夜都不會關。',
    spots:[
      {
        id:'fridge', name:'冰箱', desc:'開門的時候要用力提一下，不然關不緊。',
        acts:[
          { label:'找東西吃', cost:{ full:+8 },
            say:'半罐豆腐乳、三顆蛋、一包過期的火腿。',
            quiet:'你煎了一顆蛋。' },
          { label:'關上', cost:{}, say:'你把門關好。', quiet:'' }
        ]
      },
      {
        id:'sofa', name:'沙發', desc:'他在上面。電視開著，遙控器掉在地上。',
        acts:[
          { label:'坐下來', cost:{ calm:-6 }, home:true,
            say:'你坐在旁邊那張椅子。\n他沒有轉頭。',
            quiet:'廣告播完之後他問你今天幾點下班。你說十一點。他說喔。' },
          { label:'直接回房間', cost:{ calm:-3 },
            say:'六步。', quiet:'你走得很慢。' }
        ]
      },
      {
        id:'god', name:'神明桌', desc:'香爐裡的香灰滿出來了。',
        acts:[
          { label:'上一炷香', cost:{ calm:+3 },
            say:'你點了一炷，插進去。',
            quiet:'你沒有講什麼。你只是站了三十秒。' }
        ]
      },
      {
        id:'table', name:'餐桌', desc:'上面有一疊沒拆的信。',
        acts:[
          { label:'翻一下', cost:{ calm:-8 },
            say:'四張。三張是同一家寄的。',
            quiet:'最上面那張的日期是這個月。你把它們放回去，順序沒有動。' }
        ]
      },
      {
        id:'room', name:'房間', desc:'你的房間。門把鬆了，要抬起來才關得上。',
        acts:[
          { label:'睡覺', sleep:true, cost:{},
            say:'', quiet:'' }
        ]
      }
    ]
  },

  /* ══ 廟口 ══════════════════════════════════════ */
  temple: {
    name:'廟口', at:['night'],
    amb:'香的味道。廟裡的音樂放很小聲。後面有人在練步。',
    spots:[
      { id:'yuan', name:'阿源那邊', desc:'蹲在金爐旁邊抽菸。',
        acts:[{ label:'過去講話', npc:'yuan', cost:{} }] },
      { id:'ayi', name:'阿姨的攤子', desc:'油鍋的聲音蓋過廟裡的音樂。',
        acts:[
          { label:'買一份', cost:{ money:-60, full:+24, calm:+2 },
            say:'她裝了一大袋，還多丟了兩塊雞排進去。\n「六十。」', quiet:'那袋至少值一百二。' }
        ] },
      { id:'troupe', name:'後面在練', desc:'八個人排兩列。腳踩地板的聲音很整齊。',
        acts:[{ label:'跟他們練', troupe:true, cost:{} }] }
    ]
  }
};

/* 每個時段可以去哪裡 */
const BY_SLOT = {
  am:   ['school','store','home'],
  noon: ['school','store'],
  night:['store','temple','home']
};

/* 偷的判定:先給玩家看店員朝哪邊,再決定 —— 空間感,不是骰子 */
const CLERK = [
  { face:'背對你在補貨',       risk:0.10 },
  { face:'在整理櫃台，低著頭', risk:0.30 },
  { face:'正對著這邊',         risk:0.75 },
  { face:'在跟另一個客人講話', risk:0.18 }
];

  root.Places = { PLACES, BY_SLOT, CLERK };
})(typeof globalThis !== 'undefined' ? globalThis : this);
