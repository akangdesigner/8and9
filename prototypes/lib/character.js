/* no-way-up — 主角外觀:唯一一份,2D 室內跟 3D 街道都讀這裡
 *
 * 2026-08-12 kc:「獨立畫法不合理吧,就是一致啊」——3D 街上換了真人骨架模型之後,
 * 進門切到 2D 室內卻是完全另一套寫死的顏色,兩邊各改各的,顏色遲早會漂移,
 * 看起來就像換了個人。拆成這一份共用資料,兩邊都改這裡,不會再各自寫一次。
 *
 * 不用 ES module,理由跟其他 lib/*.js 一樣——讓 .html 可以直接雙擊開,
 * file:// 不會被 CORS 擋(見 src/tags.js 開頭)。3D 那邊(scene-city3d.js)
 * 雖然是 ES module,但 module 腳本可以直接讀 globalThis 上的東西,
 * 只要這個檔案在 host html 裡排在 <script type="module"> 之前載入就好。
 *
 * 顏色用 '#rrggbb' 字串——2D canvas 的 fillStyle 跟 THREE.Color 都直接吃這個格式,
 * 不用兩邊各轉一次。 */
(function (root) {
  const Character = {
    skin:  '#c1926e',
    hair:  '#241d19',
    hood:  '#4a5563',
    pants: '#333a44',
    shoe:  '#191c21',
    /* 3D 街上用的布料照片檔名(assets/tex/,見 PROMPTS.md)。2D 室內目前是純色畫,
     * 用不到這幾張,但寫在這裡以後兩邊都查得到同一份。 */
    tex: { hood: 'char-hoodie.png', pants: 'char-pants.png', shoe: 'char-shoe.png' }
  };
  root.Character = Character;
})(typeof globalThis !== 'undefined' ? globalThis : this);
