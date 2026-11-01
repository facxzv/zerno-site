/* «Зерно»: небольшие скрипты. Тексты, меню и фото лежат в data.js (правятся в redaktor.html) */
(function () {
  'use strict';

  var data = window.ZERNO || { menu: [], gallery: [] };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) setText(n, text);
    return n;
  }

  /* Текст с подсветкой заглушек: всё, что в [[двойных скобках]], выделяется жёлтым */
  function setText(node, value) {
    node.textContent = '';
    String(value == null ? '' : value).split(/(\[\[[\s\S]*?\]\])/).forEach(function (part) {
      if (!part) return;
      if (/^\[\[[\s\S]*\]\]$/.test(part)) {
        var s = document.createElement('span');
        s.className = 'todo';
        s.textContent = part;
        node.appendChild(s);
      } else node.appendChild(document.createTextNode(part));
    });
  }

  function get(path) {
    return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, data);
  }

  /* Телефон для ссылки tel: оставляем только цифры и плюс, 8... превращаем в +7... */
  function telHref(v) {
    v = String(v || '');
    if (v.indexOf('[[') !== -1) return 'tel:' + v;
    var d = v.replace(/[^\d+]/g, '');
    if (/^8\d{10}$/.test(d)) d = '+7' + d.slice(1);
    else if (/^7\d{10}$/.test(d)) d = '+' + d;
    return 'tel:' + d;
  }

  function hideIfEmpty(node, empty) {
    var box = node.closest('[data-hide-empty]');
    if (box) box.hidden = empty;
  }

  /* ---------- Подстановка данных в страницу ---------- */
  $$('[data-f]').forEach(function (n) {
    var v = get(n.getAttribute('data-f'));
    if (v == null) return;                 // нет в data.js: остаётся текст из index.html
    setText(n, v);
    hideIfEmpty(n, String(v).trim() === '');
  });
  $$('[data-href]').forEach(function (n) {
    var v = String(get(n.getAttribute('data-href')) || '').trim();
    if (v) n.setAttribute('href', v);
    hideIfEmpty(n, v === '');
  });
  $$('[data-tel]').forEach(function (n) {
    n.setAttribute('href', telHref(get(n.getAttribute('data-tel'))));
  });
  var mapBox = $('#map');
  if (mapBox) mapBox.setAttribute('data-src', (data.site && data.site.mapEmbed) || '');

  /* ---------- Баннер дня рождения ---------- */
  var banner = $('[data-hide-after]');
  if (banner) {
    var b = data.birthday || {};
    var until = new Date((b.hideAfter || banner.getAttribute('data-hide-after')) + 'T00:00:00');
    if (b.show === false || (!isNaN(until) && new Date() >= until)) banner.remove();
  }

  /* ---------- Год в подвале ---------- */
  var year = $('#year');
  if (year) year.textContent = new Date().getFullYear();

  /* ---------- Меню ---------- */
  var menuBox = $('#menu-list');
  if (menuBox && data.menu) {
    var rub = new Intl.NumberFormat('ru-RU');
    var hasExample = false;
    data.menu.forEach(function (cat) {
      var sec = el('section', 'menu-cat reveal');
      var h = el('h3', null, cat.title);
      if (cat.example) { hasExample = true; h.appendChild(el('small', null, 'пример')); }
      sec.appendChild(h);
      var ul = el('ul');
      (cat.items || []).forEach(function (it) {
        var li = el('li', 'menu-item');
        var row = el('div', 'menu-row');
        row.appendChild(el('span', 'menu-name', it.name));
        var lead = el('span', 'menu-leader');
        lead.setAttribute('aria-hidden', 'true');
        row.appendChild(lead);
        row.appendChild(el('span', 'menu-price', rub.format(Number(it.price) || 0) + ' ₽'));
        li.appendChild(row);
        if (it.note) li.appendChild(el('p', 'menu-note', it.note));
        ul.appendChild(li);
      });
      sec.appendChild(ul);
      menuBox.appendChild(sec);
    });
    var sample = $('#menu-sample');
    if (sample && hasExample) {
      sample.appendChild(el('p', 'menu-sample', 'Это пример меню: позиции и цены ещё не настоящие. Скоро заменим.'));
    }
    var note = $('#menu-note');
    if (note) {
      if (data.menuNote) setText(note, data.menuNote); else note.remove();
    }
  }

  /* ---------- Галерея ---------- */
  var gal = $('#gallery');
  if (gal && data.gallery) {
    var tones = 6;
    data.gallery.forEach(function (p, i) {
      var fig = el('figure', 'shot reveal' + (p.size ? ' shot--' + p.size : ''));
      if (p.file) {
        var base = 'assets/photos/' + p.file;
        var pic = el('picture');
        var formats = p.avif ? [['avif', 'image/avif'], ['webp', 'image/webp']] : [['webp', 'image/webp']];
        formats.forEach(function (f) {
          var s = el('source');
          s.type = f[1];
          s.sizes = '(min-width: 52rem) 33vw, 50vw';
          s.srcset = [480, 800, 1200].map(function (w) { return base + '-' + w + '.' + f[0] + ' ' + w + 'w'; }).join(', ');
          pic.appendChild(s);
        });
        var img = document.createElement('img');
        img.src = base + '-800.webp';
        img.alt = p.alt || '';
        img.width = p.w || 1200;
        img.height = p.h || 900;
        img.loading = 'lazy';
        img.decoding = 'async';
        pic.appendChild(img);
        fig.appendChild(pic);
      } else {
        var ph = el('div', 'ph t' + (i % tones));
        ph.setAttribute('role', 'img');
        ph.setAttribute('aria-label', 'Здесь будет фото: ' + (p.alt || ''));
        ph.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/></svg>';
        ph.appendChild(el('span', null, p.alt || 'Фото'));
        ph.appendChild(el('small', null, 'здесь будет фото'));
        fig.appendChild(ph);
      }
      if (p.caption && p.file) fig.appendChild(el('figcaption', null, p.caption));
      gal.appendChild(fig);
    });
  }

  /* ---------- Мобильное меню навигации ---------- */
  var toggle = $('.nav-toggle');
  var nav = $('#nav');
  function setNav(open) {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Закрыть меню навигации' : 'Открыть меню навигации');
  }
  if (toggle && nav) {
    toggle.addEventListener('click', function () { setNav(toggle.getAttribute('aria-expanded') !== 'true'); });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) setNav(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { setNav(false); toggle.focus(); }
    });
  }

  /* Линия под шапкой при прокрутке и подсветка текущего раздела */
  var header = $('#header');
  function onScroll() { header.classList.toggle('is-stuck', window.scrollY > 8); }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  var links = $$('.nav a');
  if ('IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (a) {
          if (a.getAttribute('href') === '#' + en.target.id) a.setAttribute('aria-current', 'true');
          else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    links.forEach(function (a) { var s = $(a.getAttribute('href')); if (s) spy.observe(s); });
  }

  /* ---------- Ссылки-заглушки не уводят на несуществующую страницу ---------- */
  $$('a[href*="[["]').forEach(function (a) {
    a.classList.add('is-todo');
    a.setAttribute('title', 'Ссылка ещё не заполнена: ' + a.getAttribute('href'));
    a.addEventListener('click', function (e) { e.preventDefault(); });
  });

  /* ---------- Карта: загружается только по нажатию ---------- */
  var btn = $('#map-btn');
  if (mapBox && btn) {
    btn.addEventListener('click', function () {
      var src = mapBox.getAttribute('data-src') || '';
      if (!src || src.indexOf('[[') !== -1) {
        $('#map-msg').textContent = 'Карта появится, когда будет адрес.';
        return;
      }
      var f = document.createElement('iframe');
      f.src = src;
      f.title = 'Карта: как добраться до кофейни «Зерно»';
      f.loading = 'lazy';
      f.referrerPolicy = 'no-referrer-when-downgrade';
      f.setAttribute('allowfullscreen', '');
      mapBox.innerHTML = '';
      mapBox.appendChild(f);
    });
  }

  /* ---------- Плавное появление блоков ---------- */
  var items = $$('.reveal');
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (calm || !('IntersectionObserver' in window)) {
    items.forEach(function (n) { n.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    items.forEach(function (n) { io.observe(n); });
  }
})();
