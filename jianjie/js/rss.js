/* 最新文章（渲染进主页2 的时间线卡片，沿用 .dw-line 样式）
 * 数据源：./data/posts.json（构建期生成的同源快照，无 CORS 限制）
 * 说明：Muyu 的博客 atom.xml 未开放 CORS，浏览器无法直接抓取，
 *       因此这里读取本地快照；如需更新，重新生成 data/posts.json 即可。
 * 右侧浮层弹窗已移除，文章列表改为固定在卡片内展示。
 */
document.addEventListener('DOMContentLoaded', function () {
  var line = document.getElementById('dw-line');
  if (!line) return;

  // 不设条数上限：数据源就是本地的 data/posts.json 快照，快照里有多少篇就展示多少篇。
  // （之前写死 8 条，导致快照里的其它文章看不到，看起来像「数量不全」。）
  // 卡片本身是固定高度的滚动区，条数变多只会让滚动变长，不会把卡片撑高。

  function escapeHtml(text) {
    return String(text == null ? '' : text).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  // 与卡片原有日期风格一致：2026.10 / 2026.9（月份不补零）
  function formatDate(value) {
    if (!value) return '--';
    var d = new Date(value);
    if (isNaN(d.getTime())) return '--';
    return d.getFullYear() + '.' + (d.getMonth() + 1);
  }

  function render(posts) {
    if (!posts.length) {
      line.innerHTML = '<li class="dw-line-item is-focus">' +
        '<span class="dw-line-dot" aria-hidden="true"></span>' +
        '<span class="dw-line-text"><a href="https://muyudada.dpdns.org/" target="_blank" rel="noopener">' +
        'MuYuの小窝 · 暂无文章数据</a></span>' +
        '<span class="dw-line-date">--</span></li>';
      return;
    }

    line.innerHTML = posts.map(function (post, i) {
      return '<li class="dw-line-item' + (i === 0 ? ' is-focus' : '') + '">' +
        '<span class="dw-line-dot" aria-hidden="true"></span>' +
        '<span class="dw-line-text"><a href="' + escapeHtml(post.url) + '" target="_blank" rel="noopener" title="' +
        escapeHtml(post.title) + '">' + escapeHtml(post.title) + '</a></span>' +
        '<span class="dw-line-date">' + formatDate(post.date) + '</span>' +
        '</li>';
    }).join('');
  }

  fetch('./data/posts.json', { cache: 'no-cache' })
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (data) {
      var items = (data.items || []).filter(function (post) {
        return post && post.title && post.url;
      });
      render(items);
    })
    .catch(function (err) {
      console.warn('加载本地文章快照失败：', err);
      render([]);
    });
});
