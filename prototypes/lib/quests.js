/* no-way-up — 任務總表
 *
 * 2026-08-04 kc:「有一些人可以接任務,比如學校的小美如果跟他聊天,
 *   帥潮值超過一定比例的話可以跟他交往。廟口的話都是一些 89 相關的任務等等。
 *   你先幫我設計一整套,多一點。」
 *
 * ── 設計原則 ────────────────────────────────────────
 * 1. **門檻是雙向的。** 帥潮不夠他們不找你,風評太差廟方不要你
 *    (見 npc-temple.js 的 TROUPE)。任務也照這個規矩。
 * 2. **不要寫成犯罪模擬器。** 大部分任務是灰的,而且——
 *    **你不是選擇變壞,你是被一步一步帶進去的。**
 *    所以有 `twist`:你接的時候以為是 A,做到一半才知道是 B。
 *    那時候才給你「繼續／走人」,而走人要付歸屬感。
 * 3. **拒絕也有代價。** 沒有安全的選項,這是這款遊戲的基本盤。
 * 4. `oneway:true` = 不可逆。做了就回不去,遊戲不警告。
 *
 * 欄位:
 *   need   接任務的門檻(cool 帥潮／rep 風評／calm 歸屬感／rel 跟誰多熟)
 *   slots  要花幾格(一天三格)
 *   days   期限,超過就過期
 *   pay    完成的報酬
 *   refuse 拒絕的代價
 */
(function (root) {

/* ══════════ 廟口・8+9 那條 ══════════════════════════ */
const TEMPLE = [
  {
    id:'carry', title:'搬東西', from:'阿伯', tier:'白',
    hook:'廟會前一天，桌椅、香爐、金紙都要從倉庫搬出來。',
    need:{}, slots:1, days:2,
    pay:{ money:+500, calm:+4 },
    beats:[
      { text:'你搬了三個小時。' },
      { text:'阿伯給你五百，你說不用，他直接塞進你口袋。' },
      { text:'「這是工錢，不是給你的。」' }
    ],
    quiet:'他分得很清楚。這一點你記了很久。',
    refuse:{ calm:-2, line:'他自己搬。你隔天看到他在貼痠痛藥布。' }
  },
  {
    id:'stall', title:'顧攤', from:'阿姨', tier:'白',
    hook:'她要去醫院一趟。攤子沒人顧。',
    need:{ rel:3 }, slots:1, days:3,
    pay:{ money:+300, calm:+6, full:+20 },
    beats:[
      { text:'她把零錢盒推給你，沒有數。' },
      { text:'「賣多少算多少。」' },
      { text:'她五點回來，帶了一個便當給你。' },
      { text:'你沒有問她去醫院做什麼。' }
    ],
    quiet:'那天她的眼睛是腫的。你也沒有問。',
    refuse:{ calm:-5, line:'那天攤子沒有開。' }
  },
  {
    id:'guard', title:'跟去談事情', from:'阿源', tier:'灰',
    hook:'「你站在後面就好，不用做什麼。」',
    need:{ cool:20, repMin:-40 }, slots:1, days:2,
    pay:{ money:+1500, cool:+6, rep:-8, calm:+9 },
    beats:[
      { text:'六個人，你排最後面。' },
      { text:'阿源跟對面講了二十分鐘，語氣一直很平。' },
      { text:'從頭到尾沒有人動手。' },
      { text:'回程他買飲料請大家。' }
    ],
    quiet:'你什麼都沒做，領一千五。你知道你領的是什麼錢。',
    refuse:{ calm:-8, line:'「喔，好啦。」他沒有再找你第二次。' }
  },
  {
    id:'deliver', title:'送個東西', from:'阿源', tier:'灰',
    hook:'「幫我送到後火車站那邊，有人會來拿。」',
    need:{ cool:15 }, slots:1, days:2,
    pay:{ money:+2000, rep:-6 },
    twist:{
      title:'你看到裡面是什麼了',
      beats:[
        { text:'袋子在你機車踏板上，路上顛了一下，開了。' },
        { text:'你看到了。' },
        { text:'你把它重新綁好。' },
        { text:'還有兩公里。' }
      ],
      go:{ label:'送完',  pay:{ money:+2000, rep:-14, cool:+4 },
           line:'對方接過去，數了一下，跟你說謝謝。你騎回家的時候一直在看後照鏡。' },
      stop:{ label:'掉頭',pay:{ calm:-14, rep:+2 },
           line:'你把袋子放回阿源家門口，沒有敲門。他隔天沒有問，之後也沒有。' }
    },
    beats:[], quiet:'',
    refuse:{ calm:-6, line:'「沒關係啦。」他找別人去了。' }
  },
  {
    id:'watch', title:'看場子', from:'阿源', tier:'灰',
    hook:'一個晚上，坐在門口。什麼都不用做，人在就好。',
    need:{ cool:30, repMin:-50 }, slots:1, days:3,
    pay:{ money:+2500, rep:-10, calm:+7 },
    beats:[
      { text:'你坐了六個小時。' },
      { text:'進出的人會跟你點頭。' },
      { text:'凌晨三點有人來鬧，你站起來，他就走了。' },
      { text:'你什麼都沒做，只是站起來。' }
    ],
    quiet:'那是你第一次發現自己看起來很像那種人。',
    refuse:{ calm:-5, line:'那晚是別人去的。' }
  },
  {
    id:'debt', title:'跟去收錢', from:'阿源', tier:'黑', oneway:true,
    hook:'「就去講一講，不會怎樣。」',
    need:{ cool:35, repMin:-60 }, slots:1, days:2,
    pay:{ money:+4000, rep:-22, cool:+8, calm:+11 },
    beats:[
      { text:'那間房子的鐵門很舊。' },
      { text:'開門的是一個女的，後面有小孩探頭出來。' },
      { text:'阿源講話還是很平。' },
      { text:'你站在最後面，什麼都沒說。' },
      { text:'那個小孩一直看你。' }
    ],
    quiet:'你回家的時候客廳燈亮著。你站在門口很久才進去。',
    refuse:{ calm:-10, line:'「你不用去啦。」語氣沒有變，但你聽得出來。' }
  },
  {
    id:'ticket', title:'幫忙賣票', from:'阿源', tier:'灰',
    hook:'廟會的平安餐券。「一張抽三十。」',
    need:{ cool:12 }, slots:1, days:5,
    pay:{ money:+900, calm:+4, rep:-3 },
    beats:[
      { text:'你在校門口賣掉十二張。' },
      { text:'買的都是你們班的。' },
      { text:'有兩個沒帶錢，說明天給你。' },
      { text:'那兩張你自己貼。' }
    ],
    quiet:'抽三十，貼兩百。你沒有跟阿源講。',
    refuse:{ calm:-3, line:'' }
  },
  /* ⚠ 這一個接回主線:你名下那筆債就是這樣來的。 */
  {
    id:'name', title:'借你的名字', from:'阿源', tier:'黑', oneway:true,
    hook:'「欸，你名下乾淨齁？借我辦個門號就好。」',
    need:{ cool:25, rel:5 }, slots:1, days:3,
    pay:{ money:+6000, calm:+13, rep:-5 },
    beats:[
      { text:'他說三個月就解掉。' },
      { text:'他說他自己的辦不了，卡到之前的。' },
      { text:'他說六千，現金。' },
      { text:'你想到你十五歲那年，有人也是這樣跟你媽講的。' },
      { text:'' },
      { text:'你簽了。' }
    ],
    quiet:'⚠ 兩個月後帳單會寄到你家，上面是你的名字。那時候阿源已經去當兵了。',
    later:{ day:60, debt:+38000,
      line:'一張催繳單。門號的，欠了三萬八。\n上面是你的名字，地址是你家。\n\n你打阿源的電話，是空號。' },
    refuse:{ calm:-12, line:'「喔。」\n\n他笑了一下，說沒關係。\n之後有兩次出陣他沒有找你。' }
  }
];

/* ══════════ 學校 ══════════════════════════════════ */
const SCHOOL = [
  /* ── 小美線:多階段,帥潮是入場券 ── */
  {
    id:'mei1', title:'她跟你講話了', from:'小美', tier:'白', chain:'mei',
    hook:'隔壁班的。她在福利社前面叫住你。',
    need:{ cool:22 }, slots:1, days:99,
    pay:{ calm:+7 },
    beats:[
      { text:'「欸，你的車是不是換排氣管。」' },
      { text:'「⋯⋯對。」' },
      { text:'「聲音很好聽。」' },
      { text:'她講完就走了。' }
    ],
    quiet:'帥潮低於 22 她不會注意到你。這件事不好聽，但它是真的。'
  },
  {
    id:'mei2', title:'約她', from:'小美', tier:'白', chain:'mei',
    hook:'她說她禮拜六沒事。',
    need:{ cool:22, money:800 }, slots:1, days:7,
    pay:{ calm:+12, money:-650, cool:+3 },
    beats:[
      { text:'你載她去河堤，然後去吃鹽酥雞。' },
      { text:'六百五。' },
      { text:'她要付一半，你說不用。' },
      { text:'回程她抓著你的外套。' }
    ],
    quiet:'六百五是你晚班八個小時。你覺得值得，而你確實也覺得值得。'
  },
  {
    id:'mei3', title:'她問你要不要交往', from:'小美', tier:'白', chain:'mei', oneway:true,
    hook:'她傳訊息問的。',
    need:{ cool:25, calm:45 }, slots:0, days:3,
    pay:{ calm:+20, cool:+5 },
    beats:[
      { text:'「那我們算什麼。」' },
      { text:'你看著那行字看了很久。' },
      { text:'你回「你想算什麼」。' },
      { text:'她回了一個貼圖。' }
    ],
    quiet:'⚠ 交往之後：每個禮拜要花錢跟時間，沒花的話歸屬感會掉。',
    steady:true
  },
  {
    id:'mei4', title:'她說要去你家', from:'小美', tier:'白', chain:'mei',
    hook:'「你家在哪？我還沒去過欸。」',
    need:{ chainDone:'mei3' }, slots:1, days:5,
    pay:{},
    branch:[
      { label:'帶她回去', pay:{ calm:-6, cool:-4 },
        beats:[
          { text:'客廳燈是亮的。他在沙發上，電視開很大聲。' },
          { text:'他抬頭看了一眼，沒有講話。' },
          { text:'你們在你房間坐了二十分鐘。' },
          { text:'她一直說「你家很好啊」。' }
        ],
        quiet:'她講第三次的時候你叫她不要再講了。那天你們沒有吵架，但也沒有講話。' },
      { label:'「我家在整修。」', pay:{ calm:-9 },
        beats:[
          { text:'「喔，那等整修好。」' },
          { text:'「嗯。」' },
          { text:'她沒有再問過第二次。' },
          { text:'你也沒有再提。' }
        ],
        quiet:'那間房子沒有在整修。你們兩個都知道。' }
    ]
  },

  /* ── 導師線:讀書那條 ── */
  {
    id:'makeup', title:'補考', from:'導師', tier:'白',
    hook:'數學不及格。他幫你安排了補考，禮拜五放學。',
    need:{}, slots:1, days:5,
    pay:{ rep:+6 }, quiz:3,
    beats:[
      { text:'教室只有你們兩個。' },
      { text:'他改完直接跟你講分數。' },
      { text:'「你會啊。」' },
      { text:'「你只是沒時間。」' }
    ],
    quiet:'他說「你只是沒時間」的時候在看你眼睛下面。',
    refuse:{ rep:-4, line:'那科就這樣掛了。他沒有再提。' }
  },
  {
    id:'schol', title:'清寒獎學金', from:'導師', tier:'白',
    hook:'表格他已經幫你填好一半。要附戶籍謄本跟所得證明。',
    need:{ rep:0 }, slots:2, days:10,
    pay:{ money:+6000, rep:+10, calm:-5 },
    beats:[
      { text:'你去區公所排隊，兩個小時。' },
      { text:'所得證明那一欄印出來是零。' },
      { text:'承辦的人多看了你一眼。' },
      { text:'六千，下個月會下來。' }
    ],
    quiet:'那張紙上寫著你家一年賺多少。你看到數字的時候愣了一下。',
    refuse:{ line:'截止日期過了。公佈欄上那張紙貼到十二月才撕掉。' }
  },
  {
    id:'skipbuddy', title:'阿仁找你蹺課', from:'阿仁', tier:'灰',
    hook:'「今天下午沒課啦，去打撞球。」',
    need:{}, slots:2, days:1,
    pay:{ calm:+6, money:-250, rep:-5 },
    beats:[
      { text:'撞球間冷氣很強。' },
      { text:'你們打到五點半。' },
      { text:'他一直在講他要去當學徒的事。' },
      { text:'他講了三個月了。' }
    ],
    quiet:'他不會去。你也知道他不會去。',
    refuse:{ calm:-4, line:'他自己去了。隔天他沒有提這件事。' }
  },
  {
    id:'discipline', title:'教官找你', from:'教官', tier:'灰',
    hook:'有人跟他講你手上有東西。',
    need:{}, slots:1, days:1,
    pay:{},
    branch:[
      { label:'把袖子拉起來', pay:{ rep:-12, cool:+4 },
        beats:[
          { text:'他看了三秒。' },
          { text:'「什麼時候弄的。」' },
          { text:'「去年。」' },
          { text:'他在本子上寫了幾個字。' }
        ],
        quiet:'記過。那筆紀錄會跟到你畢業。' },
      { label:'「沒有啊。」', pay:{ rep:-4, calm:-6 },
        beats:[
          { text:'他盯著你的袖口。' },
          { text:'今天三十四度。' },
          { text:'他沒有叫你拉起來。' },
          { text:'「你自己知道就好。」' }
        ],
        quiet:'他知道。他只是不想處理。' }
    ]
  }
];

/* ══════════ 打工那條 ══════════════════════════════ */
const WORK = [
  {
    id:'cover', title:'代班', from:'店長', tier:'白',
    hook:'有人臨時請假。「你可以嗎？」',
    need:{}, slots:1, days:1,
    pay:{ money:+950, calm:+3, rep:+2 },
    beats:[
      { text:'大夜。你從十一點做到早上七點。' },
      { text:'店長多算你一小時。' },
      { text:'「下次還是要先講啦。」他笑著說。' }
    ],
    quiet:'⚠ 隔天上午那一格會沒有。',
    dead:true,
    refuse:{ rep:-3, line:'他自己來。你隔天看到他在櫃台趴著。' }
  },
  {
    id:'short', title:'錢櫃短少', from:'店長', tier:'灰',
    hook:'昨天晚班少了八百。昨天晚班是你。',
    need:{}, slots:1, days:2,
    pay:{},
    branch:[
      { label:'「不是我。」', pay:{ rep:-6, calm:-8 },
        beats:[
          { text:'他說他知道，他只是要問一下。' },
          { text:'他調了監視器。' },
          { text:'畫面裡沒有你。' },
          { text:'他沒有跟你道歉。' }
        ],
        quiet:'之後排班他把你跟另一個人分開排。' },
      { label:'自己賠', pay:{ money:-800, rep:+5 },
        beats:[
          { text:'你把八百放在桌上。' },
          { text:'「這樣就沒事了齁。」' },
          { text:'他愣了一下，收下了。' }
        ],
        quiet:'你不知道是誰拿的。八百塊買一個「不要再問了」。' }
    ]
  },
  {
    id:'ref', title:'店長願意幫你寫推薦', from:'店長', tier:'白',
    hook:'你做滿半年。他說他可以幫你寫一張。',
    need:{ rep:10 }, slots:1, days:14,
    pay:{ rep:+12, calm:+8 },
    beats:[
      { text:'他用店裡的紙寫的，有店章。' },
      { text:'字很醜。' },
      { text:'「以後你要去哪裡，這個給他看。」' }
    ],
    quiet:'那張紙你收在成績單旁邊。'
  }
];

  root.Quests = { TEMPLE, SCHOOL, WORK };
})(typeof globalThis !== 'undefined' ? globalThis : this);
