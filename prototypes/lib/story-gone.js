/* no-way-up — 劇情線:父親・走了(接 FAMILIES 的 dad:'gone')
 *
 * 純資料,不碰 DOM。格式同 story-bet.js。
 *
 * 核心:**人走了,債留下來。** 而且他在別的地方過得比你好。
 *   這條線沒有人在你家裡,痛的是「你在還一個不在場的人的債」——
 *   你連要恨誰都找不到對象。
 *
 * ⚠ 支線。他偶爾出現一下就好,不要讓他變成主角。
 *   最後那一節不要給答案(去或不去都不演),留在門口就停。
 */
(function (root) {

  const NODES = [

    /* ── 第 6 天 ── 陌生號碼 ── */
    {
      day: 6,
      title: '陌生號碼',
      beats: [
        { who:'pc',  text:'手機在震。' },
        { who:'pc',  text:'不認識的號碼。0937 開頭。' }
      ],
      menu: [
        {
          label: '接',
          cost: '歸屬感 −9',
          calm: -9,
          beats: [
            { who:'dad', text:'「⋯⋯喂？」' },
            { who:'pc',  text:'你六年沒聽到這個聲音了。' },
            { who:'dad', text:'「你好不好。」' },
            { who:'dad', text:'「⋯⋯欸，你現在有沒有在賺錢？」' },
            { toast:'他問了兩句。第二句才是真的那句。', ms:4200 }
          ]
        },
        {
          label: '不接',
          cost: '歸屬感 −5',
          calm: -5,
          beats: [
            { who:'pc',  text:'響了很久才停。' },
            { who:'pc',  text:'沒有留言。' },
            { toast:'你把號碼記下來了。你自己也不知道為什麼。', ms:3600 }
          ]
        }
      ]
    },

    /* ── 第 12 天 ── 他記得的你是六年前的你 ── */
    {
      day: 12,
      title: '包裹',
      beats: [
        { who:'pc',  text:'管理室有你的包裹。\n寄件人沒有寫名字。' },
        { who:'pc',  text:'裡面是一件外套。' },
        { who:'pc',  text:'尺寸不對。這是小孩的尺寸。' }
      ],
      menu: [
        {
          label: '留下來',
          cost: '歸屬感 −7',
          calm: -7,
          beats: [
            { who:'pc',  text:'你把它塞進衣櫃最上面那一格。' },
            { who:'pc',  text:'他記得的你，是六年前的你。' },
            { toast:'他離開的那年，你剛好穿這個尺寸。', ms:4000 }
          ]
        },
        {
          label: '丟掉',
          cost: '歸屬感 −10',
          calm: -10,
          beats: [
            { who:'pc',  text:'你拿到樓下垃圾車。' },
            { who:'pc',  text:'車來之前你站了一下。' },
            { toast:'你還是丟了。但你站了一下。', ms:3600 }
          ]
        }
      ]
    },

    /* ── 第 18 天 ── 人不在,帳單在 ── */
    {
      day: 18,
      title: '又一張',
      beats: [
        { who:'pc',  text:'信箱裡又有一張。' },
        { who:'pc',  text:'上面是他的名字。' },
        { who:'pc',  text:'地址是你家。' }
      ],
      menu: [
        {
          label: '拆開來看',
          cost: '歸屬感 −12　債 +6000',
          calm: -12, debt: +6000,
          beats: [
            { who:'pc',  text:'金額比上一張多。' },
            { who:'pc',  text:'他人不在，可是他的東西\n每個月還是會寄到這裡來。' },
            { toast:'你連要跟誰吵都找不到人。', ms:4000 }
          ]
        },
        {
          label: '跟前面幾張放在一起',
          cost: '歸屬感 −6　債 +6000',
          calm: -6, debt: +6000,
          beats: [
            { who:'pc',  text:'抽屜裡已經有五張了。' },
            { who:'pc',  text:'你沒有拆過任何一張。' },
            { toast:'你知道拆了也不會變少。', ms:3600 }
          ]
        }
      ]
    },

    /* ── 第 24 天 ── 他過得比你好 ── */
    {
      day: 24,
      title: '你在街上看到他',
      beats: [
        { who:'pc',  text:'廟口那邊。' },
        { who:'pc',  text:'他跟一個女人在一起，\n中間牽著一個小孩。' },
        { who:'pc',  text:'小孩叫他爸爸。' }
      ],
      menu: [
        {
          label: '走過去',
          cost: '歸屬感 −18',
          calm: -18,
          beats: [
            { who:'pc',  text:'他看到你了。' },
            { who:'pc',  text:'他愣了半秒，然後笑了一下，\n那個笑是給旁邊的人看的。' },
            { who:'dad', text:'「⋯⋯這麼巧。」' },
            { who:'pc',  text:'他沒有介紹你是誰。' },
            { toast:'你也沒有說。', ms:4400 }
          ]
        },
        {
          label: '轉身',
          cost: '歸屬感 −14',
          calm: -14,
          beats: [
            { who:'pc',  text:'你往回走，走了兩條街才停下來。' },
            { who:'pc',  text:'你在想那個小孩幾歲。' },
            { toast:'你算出來了。你不想算的，但你算出來了。', ms:4200 }
          ]
        }
      ]
    },

    /* ── 第 30 天 ── 留在門口就停,不要給答案 ── */
    {
      day: 30,
      title: '他要結婚了',
      beats: [
        { who:'pc',  text:'這次你接了。' },
        { who:'dad', text:'「⋯⋯我下個月要辦桌。」' },
        { who:'dad', text:'「你要不要來。」' },
        { who:'pc',  text:'他沒有提那些帳單。' },
        { who:'pc',  text:'一次都沒有提過。' }
      ],
      menu: [
        {
          label: '「我看看。」',
          cost: '歸屬感 −10',
          calm: -10,
          beats: [
            { who:'dad', text:'「好啦，那你再跟我講。」' },
            { who:'pc',  text:'他掛掉了。' },
            { toast:'你把那個號碼存起來了。名字那一欄你想了很久。', ms:4400 }
          ]
        },
        {
          label: '「你先把帳單處理掉。」',
          cost: '歸屬感 −16',
          calm: -16,
          beats: [
            { who:'pc',  text:'那邊安靜了三秒。' },
            { who:'dad', text:'「⋯⋯那個很複雜啦。」' },
            { who:'pc',  text:'然後他就掛了。' },
            { toast:'那是他六年來，第一次講到你的名字以外的事。', ms:4400 }
          ]
        }
      ]
    }
  ];

  root.StoryGone = { NODES };
})(typeof globalThis !== 'undefined' ? globalThis : this);
