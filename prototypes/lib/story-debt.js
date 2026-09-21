/* no-way-up — 主線骨幹:那筆用你名字借的錢(2026-09-21)
 *
 * 純資料,不碰 DOM。格式同 story-bet.js,由 game.html 的 maybeTriggerStoryNode() 吃('debt' 那組)。
 *
 * 為什麼有這份檔(kc:「我覺得問題是現在都沒有推進劇情的感覺」→ 我提「你的選擇改下一場」→
 * kc:「這跟劇情有個屁關聯」):母線六場戲是同一種場面演六次(要錢×4、躲你、看到單子),沒有一條線
 * 在往哪裡去。推進劇情要的是每隔幾天有新的事、你知道了新的事、情況更糟、最後被逼著做決定。
 * 遊戲裡最重的一件事——十五歲那筆用你名字借的錢——原本只在 day64 出現一張紙。現在它是骨幹:
 *
 *   day2  她拿走兩千(既有)            day16/28 藥錢、修車錢(既有)
 *   day34 有人按鈴找你媽(新,這裡)     day40 她不編了(既有)
 *   day52 那個人坐在門外,講了「三十萬」(既有節點加了開頭,見 story-bet.js)
 *   day64 那幾張紙:三十萬,你的名字(既有,加了金額)
 *   day70 那個人在街上攔你,不是找你媽,是找你(game.html DEBT,3D 街上)
 *   day78 起 你得找人:阿正/阿源/爸各一句(game.html)
 *   day84 你選一個(新,這裡):報案 / 讓阿源處理 / 自己扛
 *   day90 結局(story-ending.js 接 DEBT.resolution)
 *
 * 三十萬這個數字是我抓的(DESIGN_NOTES「家裡的拉扯」只說「債會變大」);kc 說不對就改,只改這一份跟
 * story-bet.js day52/64 那兩句。
 */
(function (root) {

  const AMOUNT = 300000;

  const NODES = [
    /* ── day34 ── 早上有人按鈴。你第一次知道有人在追她的錢。 ── */
    {
      day: 34,
      title: '按鈴的人',
      beats: [
        { who:'pc',        text:'早上七點多,鐵門外有人按鈴。她不在,你去開。' },
        { who:'pc',        text:'鐵門外站著一個男人,四十幾歲,手上沒有拿東西。' },
        { who:'collector', text:'「你媽在嗎?」' },
        { who:'pc',        text:'「不在。」' },
        { who:'collector', text:'「跟她講,月底。她知道我是誰。」' },
        { who:'pc',        text:'他往你家裡面看了一眼,轉身下樓。' }
      ],
      menu: [
        {
          label: '追出去問他是誰',
          cost: '情緒 −3',
          mood: -3,
          beats: [
            { who:'pc',        text:'你追到樓梯口。' },
            { who:'collector', text:'「你是她兒子?」他停下來看你。「那你更應該叫她處理。」' },
            { who:'pc',        text:'他沒有講他是誰,下樓了。' },
            { toast:'你第一次知道,有人在追她的錢。\n（情緒 −3）', ms:3600 }
          ]
        },
        {
          label: '把鐵門關上',
          cost: '',
          beats: [
            { who:'pc', text:'你把鐵門關上,聽他的腳步聲下到二樓、一樓。' },
            { who:'pc', text:'她晚上回來,你講了。她說「喔」,然後去洗澡。' },
            { toast:'你第一次知道,有人在追她的錢。', ms:3600 }
          ]
        }
      ]
    },

    /* ── day84 ── 你選一個。哪些選項出現看你 day78 之後找過誰(item.when,game.html 過濾)。 ── */
    {
      day: 84,
      title: '月底',
      beats: [
        { who:'pc',        text:'月底。早上鐵門外又是那個人。這次他沒有問你媽在不在。' },
        { who:'collector', text:'「三十萬。你的名字。所以呢?」' },
        { who:'pc',        text:'她在房間裡,門關著。爸在沙發上,沒有醒。' }
      ],
      menu: [
        {
          label: '「我去報案。」',
          cost: '風評 +6　歸屬感 −12',
          when: s => s.askedBrother,
          star: 6, calm: -12,
          debt: 'police',
          beats: [
            { who:'collector', text:'「報案?」他笑了一下。「好啊。你去。」' },
            { who:'pc',        text:'你走到警局,阿正在門口。你把那三張紙的事講了。' },
            { who:'brother',   text:'「你確定?」' },
            { who:'pc',        text:'「確定。」' },
            { who:'pc',        text:'下午兩台車停在你家樓下。她被帶走的時候沒有看你。' },
            { toast:'你媽被帶走了。那筆錢不用你還,但你知道你做了什麼。\n（風評 +6、歸屬感 −12）', ms:4600 }
          ]
        },
        {
          label: '「阿源會處理。」',
          cost: '歸屬感 +6　風評 −6',
          when: s => s.askedYuan,
          calm: 6, star: -6,
          debt: 'yuan',
          beats: [
            { who:'collector', text:'「阿源?」他把手機拿出來,撥了一通。' },
            { who:'pc',        text:'他講了兩分鐘,掛掉。' },
            { who:'collector', text:'「好。你的事我不管了。」他下樓了。' },
            { who:'pc',        text:'晚上你去廟口。' },
            { who:'yuan',      text:'「處理好了。」他沒有說怎麼處理的。「以後你的人是我的,知道嗎。」' },
            { toast:'三十萬不見了,換成你欠阿源。\n（歸屬感 +6、風評 −6）', ms:4600 }
          ]
        },
        {
          label: '「我自己還。」',
          cost: '情緒 −12',
          mood: -12,
          debt: 'self',
          beats: [
            { who:'collector', text:'「自己還。」他看了你一下。「一個月五千,先這樣。」' },
            { who:'pc',        text:'「我還在讀書。」' },
            { who:'collector', text:'「那是你的事。」' },
            { who:'pc',        text:'他下樓了。你算了一下,一個月五千,超商要站二十九輪班。' },
            { toast:'三十萬,你的名字,你自己還。\n（情緒 −12）', ms:4600 }
          ]
        }
      ]
    }
  ];

  root.StoryDebt = { NODES, AMOUNT };
})(window);
