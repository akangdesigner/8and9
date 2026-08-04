/* no-way-up — 劇情線:母親・男朋友(接 FAMILIES 的 mom:'bf')
 *
 * 純資料,不碰 DOM。格式同 story-bet.js。
 *
 * 核心:**你在自己家裡是客人。** 家裡多了一個外人,而他比你有話語權。
 *   這條線沒有人對你不好 —— 他甚至對你不錯,那才是最難處理的地方。
 *
 * ⚠ 不要把他寫成壞人。他不打你、不偷你的錢、還給你錢。
 *   痛的是**位置**:毛巾被移到最下面那一格、吵架的時候你才是打擾的人、
 *   你媽問你意見但她已經決定了。
 *   寫成壞人的話這條線就變成廉價的後父故事,而且違反基準線。
 *
 * 需要新角色代號 'bf'(頭像沿用場景人物畫法,見 DESIGN_NOTES「UI:對話框」)。
 */
(function (root) {

  const NODES = [

    /* ── 第 5 天 ── 他用主人的語氣 ── */
    {
      day: 5,
      title: '回來啦',
      beats: [
        { who:'pc',  text:'客廳有一個男的在看電視。' },
        { who:'pc',  text:'你媽在廚房。' },
        { who:'bf',  text:'「回來啦。」' },
        { who:'pc',  text:'他沒有站起來。' }
      ],
      menu: [
        {
          label: '「嗯。」',
          cost: '歸屬感 −8',
          calm: -8,
          beats: [
            { who:'pc',  text:'你走回房間。' },
            { who:'pc',  text:'他坐的位置，是你以前坐的位置。' },
            { toast:'那句「回來啦」是主人對客人講的。', ms:4000 }
          ]
        },
        {
          label: '不回話',
          cost: '歸屬感 −11',
          calm: -11,
          beats: [
            { who:'pc',  text:'你直接進房間。' },
            { who:'mom', text:'（廚房那邊）「欸，人家跟你講話。」' },
            { toast:'她第一句話是講給他聽的。', ms:3800 }
          ]
        }
      ]
    },

    /* ── 第 10 天 ── 位置一格一格被移走 ── */
    {
      day: 10,
      title: '浴室',
      beats: [
        { who:'pc',  text:'架子上多了一支牙刷。' },
        { who:'pc',  text:'還有一條毛巾，深藍色的。' },
        { who:'pc',  text:'你的毛巾被移到最下面那一格。' }
      ],
      menu: [
        {
          label: '移回去',
          cost: '歸屬感 −7',
          calm: -7,
          beats: [
            { who:'pc',  text:'隔天它又在最下面。' },
            { who:'pc',  text:'沒有人跟你講過這件事。' },
            { toast:'你沒有再移第二次。', ms:3600 }
          ]
        },
        {
          label: '就放在那裡',
          cost: '歸屬感 −9',
          calm: -9,
          beats: [
            { who:'pc',  text:'你蹲下去拿毛巾。' },
            { who:'pc',  text:'以後每天都要蹲一次。' },
            { toast:'這種事沒有辦法跟任何人講。', ms:3800 }
          ]
        }
      ]
    },

    /* ── 第 16 天 ── 他對你不錯,這才難處理 ── */
    {
      day: 16,
      title: '他給你錢',
      beats: [
        { who:'bf',  text:'「欸，這個你拿去。」' },
        { who:'pc',  text:'三千塊。' },
        { who:'bf',  text:'「不要跟你媽講。」' },
        { who:'pc',  text:'他人不壞。\n\n這件事讓整件事更難處理。' }
      ],
      menu: [
        {
          label: '收下',
          cost: '＋$3000　歸屬感 −13',
          money: 3000, calm: -13,
          beats: [
            { who:'pc',  text:'你說了謝謝。' },
            { who:'pc',  text:'你需要這三千塊。\n你這個月差的就是三千塊。' },
            { toast:'你討厭自己收下了。而且你還是會再收第二次。', ms:4400 }
          ]
        },
        {
          label: '「不用。」',
          cost: '歸屬感 −6',
          calm: -6,
          beats: [
            { who:'bf',  text:'「⋯⋯好啦。」' },
            { who:'pc',  text:'他把錢收回去，沒有勉強。' },
            { who:'pc',  text:'那天晚上你算了三次\n這個月的錢夠不夠。' },
            { toast:'不夠。', ms:3400 }
          ]
        }
      ]
    },

    /* ── 第 21 天 ── 你才是那個打擾的人 ── */
    {
      day: 21,
      title: '他們在吵',
      beats: [
        { who:'pc',  text:'你在房間聽到外面的聲音。' },
        { who:'pc',  text:'不大聲，但你聽得出來。' },
        { who:'pc',  text:'你媽在哭。' }
      ],
      menu: [
        {
          label: '出去',
          cost: '歸屬感 −15',
          calm: -15,
          beats: [
            { who:'pc',  text:'兩個人同時停下來看你。' },
            { who:'mom', text:'「⋯⋯沒事啦，你回去睡。」' },
            { who:'pc',  text:'她的語氣是在請你離開。' },
            { toast:'在那個房間裡，你才是打擾的那一個。', ms:4400 }
          ]
        },
        {
          label: '待在房間',
          cost: '歸屬感 −10',
          calm: -10,
          beats: [
            { who:'pc',  text:'你把耳機戴上，沒有放音樂。' },
            { who:'pc',  text:'過了大概二十分鐘，外面安靜了。' },
            { who:'pc',  text:'然後你聽到笑聲。' },
            { toast:'他們和好了。你在房間裡待了二十分鐘。', ms:4200 }
          ]
        }
      ]
    },

    /* ── 第 27 天 ── 她在問你,但她已經決定了 ── */
    {
      day: 27,
      title: '她問你的意見',
      beats: [
        { who:'mom', text:'「欸⋯⋯」' },
        { who:'mom', text:'「你會不會覺得他怪怪的。」' },
        { who:'pc',  text:'她在問你的意見。' },
        { who:'pc',  text:'但她已經決定了。\n\n你看得出來。' }
      ],
      menu: [
        {
          label: '「不會啊。」',
          cost: '歸屬感 −12',
          calm: -12,
          beats: [
            { who:'mom', text:'「對嘛。」' },
            { who:'pc',  text:'她鬆了一口氣，\n那口氣鬆得比你想的還要大。' },
            { toast:'她要的不是意見，是一句「可以」。你給了。', ms:4400 }
          ]
        },
        {
          label: '說實話',
          cost: '歸屬感 −17',
          calm: -17,
          beats: [
            { who:'pc',  text:'「⋯⋯我覺得不太舒服。」' },
            { who:'pc',  text:'她安靜了很久。' },
            { who:'mom', text:'「你不要這樣講他啦。」' },
            { who:'mom', text:'「他對我們很好。」' },
            { who:'pc',  text:'「我們」。' },
            { toast:'她說「我們」的時候，你不確定裡面有沒有你。', ms:4600 }
          ]
        }
      ]
    }
  ];

  root.StoryBf = { NODES };
})(typeof globalThis !== 'undefined' ? globalThis : this);
