/* no-way-up — 跳陣頭音遊的歌曲/譜面資料
 *
 * 2026-08-31,kc 給了兩首 Suno 寫的真歌(容身/無人望),接上 DESIGN_NOTES
 * 「跳陣頭做成音遊」那節標記「還沒實作,等 kc 用 Suno 寫真的歌」的坑,細節
 * 見那節 + 「音樂來源」那段。
 *
 * ⚠ 每個音符的時間點是**程式自動抓的**(對整首歌做 spectral flux 抓能量
 * 高峰、挑密度最高的一段當遊玩片段),不是 DESIGN_NOTES 原本講的「手動
 * 對拍」——kc 沒有機制可以讓我真的聽歌手動打譜,先用這版當第一個可玩版本,
 * 節奏感不對再回來調(調 tools/ 那支抓譜腳本的參數,或 kc 直接改這裡的
 * chart 陣列)。src 指的是**已經剪好的片段檔**(`*-clip.mp3`),不是原始
 * 整首歌——容身 4 分整首/無人望 2 分半整首都太長,不適合塞進一次對話
 * 互動,原本想法是遊戲裡動態 seek 到片段起點,但 2026-08-31 kc 回報
 * 「沒音樂沒音符」查出來是 `python -m http.server` 不支援 Range request,
 * Chrome 的 `<audio>.seekable` 因此永遠是 `[0,0]`(即使整個檔案早就
 * buffered 完成),設 currentTime 一律被吃掉,音樂只會從第 0 秒正常播,
 * 跟譜面時間點完全對不上。改成用 ffmpeg 預先把每首歌要玩的那段剪成獨立
 * mp3(`assets/audio/<key>-clip.mp3`),遊戲裡直接從 0 秒播到結束,完全
 * 不用 seek,才繞掉這個環境限制。剪片段的指令見這份檔案下面 SONGS 物件
 * 旁的行內註解,要重剪只要換掉那行 ffmpeg 的 -ss/-t 參數重跑。
 *
 * 兩首怎麼分工(這輪我選的,不喜歡跟 kc 說一聲就改):
 *   - **容身**:陣頭「練習」(4 次都用同一首,呼應反覆練習同一套的真實
 *     感),同時也是街頭藝人的歌聲來源(見 game.html startBuskerAudio())。
 *   - **無人望**:只留給「出陣」(debut)那個高潮時刻用,跟練習的歌分開,
 *     出陣才有自己的識別度。
 *
 * 2026-08-31 第二輪(kc:「之前我們有做好太鼓達人的玩遊戲畫面啊」)——
 * `prototypes/rhythm-linzitou.html`(2026-08-20)才是這個功能原本設計的
 * 樣子:上下左右四方向鍵+判定圈在左邊(太鼓達人手感),那版用固定 BPM
 * 合成鼓點当佔位譜面。現在真的歌來了,chart 從單純的時間點陣列改成
 * {t,lane,hold} 結構——lane 是 'up'/'down'/'left'/'right'/'space' 五個
 * 判定鍵之一(kc 加碼要空白鍵當第五種,呼應太鼓的「大鼓重拍」),hold>0
 * 的是拉長音(要按住到 t+hold 才算過,不是點一下就好,kc 要的「拉長音」
 * 變化)。lane/hold 指派用 tools/rhythm-lane-assign.py 產生(見那支腳本
 * 開頭筆記),不是手動一個個排的,節奏對不上時改那支腳本重跑,不要手改
 * 這裡的陣列。 */
(function (root) {

  const SONGS = {
    rongshen: {
      title: '容身',
      /* 剪法:ffmpeg -y -ss 141.0 -t 20 -i assets/audio/rongshen.mp3 -c copy assets/audio/rongshen-clip.mp3 */
      src: '../assets/audio/rongshen-clip.mp3',
      clipLen: 20,
      chart: [{t:0.34,lane:'up',hold:0},{t:0.526,lane:'right',hold:0},{t:1.153,lane:'down',hold:0},{t:1.965,lane:'left',hold:0},{t:2.383,lane:'up',hold:0},{t:2.778,lane:'space',hold:0},{t:3.196,lane:'right',hold:0},{t:3.475,lane:'down',hold:0},{t:3.684,lane:'up',hold:0},{t:4.009,lane:'down',hold:0},{t:4.334,lane:'left',hold:0},{t:4.682,lane:'space',hold:0},{t:5.077,lane:'up',hold:0},{t:5.402,lane:'right',hold:0},{t:6.052,lane:'up',hold:0},{t:6.447,lane:'left',hold:0},{t:6.865,lane:'space',hold:0},{t:7.376,lane:'down',hold:0},{t:7.677,lane:'right',hold:0},{t:7.91,lane:'up',hold:0},{t:8.328,lane:'right',hold:0},{t:8.513,lane:'down',hold:0},{t:8.908,lane:'up',hold:0},{t:9.303,lane:'space',hold:0},{t:9.558,lane:'left',hold:0},{t:10.115,lane:'right',hold:0},{t:10.324,lane:'up',hold:0},{t:10.533,lane:'left',hold:0},{t:10.928,lane:'up',hold:0},{t:11.346,lane:'space',hold:0},{t:11.602,lane:'left',hold:0.5},{t:12.461,lane:'up',hold:0},{t:12.925,lane:'down',hold:0},{t:13.273,lane:'left',hold:0},{t:13.761,lane:'right',hold:0},{t:14.179,lane:'left',hold:0.47},{t:14.852,lane:'space',hold:0},{t:15.41,lane:'right',hold:0},{t:15.642,lane:'down',hold:0},{t:15.828,lane:'right',hold:0},{t:16.222,lane:'up',hold:0},{t:16.455,lane:'right',hold:0},{t:16.64,lane:'down',hold:0},{t:16.896,lane:'space',hold:0.39},{t:17.453,lane:'up',hold:0},{t:17.732,lane:'left',hold:0},{t:18.126,lane:'down',hold:0},{t:18.498,lane:'right',hold:0},{t:18.684,lane:'space',hold:0},{t:19.078,lane:'left',hold:0},{t:19.473,lane:'up',hold:0.29},{t:19.891,lane:'left',hold:0}]
    },
    wurenwang: {
      title: '無人望',
      /* 剪法:ffmpeg -y -ss 44.0 -t 24 -i assets/audio/wurenwang.mp3 -c copy assets/audio/wurenwang-clip.mp3 */
      src: '../assets/audio/wurenwang-clip.mp3',
      clipLen: 24,
      chart: [{t:0.048,lane:'up',hold:0},{t:0.397,lane:'down',hold:0},{t:0.745,lane:'left',hold:0},{t:1.07,lane:'right',hold:0},{t:1.418,lane:'left',hold:0.47},{t:2.092,lane:'space',hold:0},{t:2.347,lane:'up',hold:0},{t:2.579,lane:'left',hold:0},{t:2.765,lane:'right',hold:0},{t:3.09,lane:'down',hold:0},{t:3.438,lane:'left',hold:0},{t:3.694,lane:'space',hold:0},{t:3.926,lane:'right',hold:0},{t:4.112,lane:'down',hold:0},{t:4.785,lane:'up',hold:0},{t:5.11,lane:'down',hold:0.47},{t:5.784,lane:'right',hold:0},{t:6.132,lane:'space',hold:0},{t:6.457,lane:'up',hold:0},{t:6.805,lane:'right',hold:0},{t:7.154,lane:'up',hold:0},{t:7.479,lane:'right',hold:0},{t:7.804,lane:'up',hold:0},{t:7.989,lane:'space',hold:0},{t:8.477,lane:'left',hold:0},{t:8.825,lane:'down',hold:0},{t:9.15,lane:'left',hold:0},{t:9.499,lane:'right',hold:0},{t:9.824,lane:'left',hold:0},{t:10.172,lane:'right',hold:0},{t:10.497,lane:'space',hold:0},{t:10.846,lane:'down',hold:0},{t:11.194,lane:'up',hold:0},{t:11.519,lane:'left',hold:0},{t:11.867,lane:'right',hold:0},{t:12.192,lane:'left',hold:0.47},{t:12.866,lane:'space',hold:0},{t:13.191,lane:'right',hold:0},{t:13.377,lane:'left',hold:0},{t:13.725,lane:'right',hold:0},{t:14.143,lane:'down',hold:0},{t:14.375,lane:'right',hold:0},{t:14.561,lane:'left',hold:0},{t:14.886,lane:'space',hold:0},{t:15.234,lane:'right',hold:0},{t:15.559,lane:'left',hold:0},{t:15.745,lane:'right',hold:0},{t:16.07,lane:'up',hold:0},{t:16.395,lane:'down',hold:0},{t:16.581,lane:'space',hold:0},{t:16.906,lane:'right',hold:0},{t:17.092,lane:'left',hold:0},{t:17.579,lane:'down',hold:0},{t:17.765,lane:'left',hold:0},{t:18.09,lane:'down',hold:0},{t:18.601,lane:'space',hold:0},{t:18.926,lane:'left',hold:0},{t:19.112,lane:'right',hold:0},{t:19.599,lane:'down',hold:0},{t:19.948,lane:'left',hold:0},{t:20.134,lane:'space',hold:0},{t:20.459,lane:'down',hold:0},{t:20.784,lane:'up',hold:0},{t:21.132,lane:'right',hold:0},{t:21.62,lane:'left',hold:0},{t:21.968,lane:'up',hold:0.47},{t:22.641,lane:'space',hold:0},{t:22.966,lane:'right',hold:0},{t:23.315,lane:'up',hold:0},{t:23.663,lane:'right',hold:0.23},{t:23.988,lane:'up',hold:0}]
    }
  };

  root.RhythmTroupe = { SONGS };
})(typeof globalThis !== 'undefined' ? globalThis : this);
