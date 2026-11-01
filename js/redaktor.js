/* Редактор сайта «Зерно». Работает у вас в браузере, ничего не отправляет в интернет.
   Читает data.js, показывает формы, а при сохранении переписывает файлы сайта. */
(function () {
  'use strict';

  /* ---------- Данные ---------- */
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  var D = clone(window.ZERNO || {});
  D.site = D.site || {}; D.texts = D.texts || {}; D.birthday = D.birthday || {};
  D.menu = D.menu || []; D.gallery = D.gallery || []; D.menuNote = D.menuNote || '';
  var ser = function () { return JSON.stringify(D, function (k, v) { return k.charAt(0) === '_' ? undefined : v; }, 2); };
  var ORIG = ser();
  var newPhotos = {};          // имя файла -> {480: Blob, 800: Blob, 1200: Blob}
  var removedFiles = [];       // фото, которые убрали из списка
  var root = null;             // выбранная папка сайта

  var $ = function (s, r) { return (r || document).querySelector(s); };
  function h(tag, attrs, kids) {
    var n = document.createElement(tag), k, v;
    for (k in (attrs || {})) {
      v = attrs[k];
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v);
      else if (v === true) n.setAttribute(k, '');
      else if (v !== false && v != null) n.setAttribute(k, v);
    }
    (kids || []).forEach(function (c) { if (c != null) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  var uid = 0;
  function getp(path) { return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, D); }
  function setp(path, val) {
    var parts = path.split('.'), last = parts.pop();
    var o = parts.reduce(function (a, k) { a[k] = a[k] || {}; return a[k]; }, D);
    o[last] = val;
  }

  /* ---------- Сообщения и состояние ---------- */
  function say(text, kind) {
    var m = $('#msg');
    m.textContent = text || '';
    m.className = kind || '';
    if (text) m.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function todoCount() { return (ser().match(/\[\[(?!\.\.\.)/g) || []).length; }
  function touch() {
    var dirty = ser() !== ORIG || Object.keys(newPhotos).length > 0;
    var st = $('#state');
    st.classList.toggle('dirty', dirty);
    $('#state-text').textContent = dirty ? 'Есть несохранённые изменения' : 'Изменений нет';
    var n = todoCount(), c = $('#todo-count');
    c.hidden = !n;
    c.textContent = 'не заполнено: ' + n;
    $('#b-todo').hidden = !n;
    return dirty;
  }
  window.addEventListener('beforeunload', function (e) {
    if (touch()) { e.preventDefault(); e.returnValue = ''; }
  });

  /* ---------- Поля ---------- */
  function field(path, label, type, hint) {
    var id = 'f' + (++uid), val = getp(path);
    var inp;
    if (type === 'check') {
      inp = h('input', { type: 'checkbox', id: id });
      inp.checked = val !== false;
      inp.addEventListener('change', function () { setp(path, inp.checked); touch(); });
      return h('label', { class: 'check', for: id }, [inp, label]);
    }
    if (type === 'area' || type === 'embed') inp = h('textarea', { id: id, rows: type === 'embed' ? 3 : 4 });
    else inp = h('input', { id: id, type: type === 'date' ? 'date' : 'text' });
    inp.value = val == null ? '' : val;
    var paint = function () { inp.classList.toggle('is-todo', /\[\[/.test(inp.value)); };
    paint();
    inp.addEventListener('input', function () {
      var v = inp.value;
      if (type === 'embed') { var m = v.match(/src=["']([^"']+)["']/); if (m) v = m[1]; }
      setp(path, v); paint(); touch();
    });
    inp.addEventListener('change', function () {
      if (type === 'embed') { var m = inp.value.match(/src=["']([^"']+)["']/); if (m) { inp.value = m[1]; setp(path, m[1]); touch(); } }
    });
    inp.setAttribute('data-path', path);
    return h('label', { class: 'f' + (type === 'area' || type === 'embed' ? ' full' : ''), for: id }, [label, hint ? h('small', { text: hint }) : null, inp]);
  }
  function group(title, fields, cols) {
    return h('div', { class: 'group' }, [
      h('h3', { text: title }),
      h('div', { class: 'grid' + (cols === 1 ? '' : ' two') }, fields.map(function (f) { return field.apply(null, f); }))
    ]);
  }
  function card(id, title, lead, kids) {
    return h('section', { class: 'card', id: id }, [h('h2', { text: title }), h('p', { class: 'lead', text: lead })].concat(kids));
  }

  /* ---------- Разделы ---------- */
  function buildContacts() {
    return card('s-contacts', 'Контакты и адрес', 'Всё это видят гости в разделе «Контакты». Адрес и часы работы должны быть такими же, как в Яндекс.Картах и 2ГИС.', [
      group('Где мы', [
        ['site.city', 'Город', 'text', 'Название города.'],
        ['site.areaLine', 'Город, район, улица одной строкой', 'text', 'Для поисковиков, в описании сайта.'],
        ['site.address', 'Адрес', 'text', 'Город, улица, дом.'],
        ['site.addressNote', 'Как найти', 'text', 'Этаж, вход со двора, ориентир. Если не нужно, оставьте пустым.']
      ]),
      group('Когда и как связаться', [
        ['site.hoursWeekdays', 'Часы работы в будни', 'text', 'Например: Пн–Пт 8:00–20:00.'],
        ['site.hoursWeekend', 'Часы работы в выходные', 'text', 'Если такие же, можно оставить пустым.'],
        ['site.phone', 'Телефон', 'text', 'Как увидят гости: +7 999 123-45-67.']
      ]),
      group('Ссылки', [
        ['site.routeUrl', 'Ссылка «Построить маршрут»', 'text', 'Ссылка на вашу карточку в Яндекс.Картах или 2ГИС.'],
        ['site.mapEmbed', 'Встроенная карта', 'embed', 'В Яндекс.Картах: «Поделиться» → «Встроить». Вставьте сюда весь код или только адрес из src.'],
        ['site.vk', 'ВКонтакте', 'text', 'Если нет, оставьте пустым: кнопка исчезнет.'],
        ['site.telegram', 'Telegram', 'text', 'Если нет, оставьте пустым.'],
        ['site.instagram', 'Instagram', 'text', 'Если нет, оставьте пустым. В России для ссылки на Instagram нужна пометка, лучше уточнить у юриста.']
      ]),
      group('Удобства', [
        ['site.wifi', 'Wi-Fi', 'text', 'Напишите «есть» или «нет». Пустое поле скроет пункт.'],
        ['site.outlets', 'Розетки', 'text', 'Например: есть у окна. Пустое поле скроет пункт.'],
        ['site.takeaway', 'Кофе с собой', 'text', 'Пустое поле скроет пункт.']
      ]),
      group('Для поисковиков', [
        ['site.hoursSchemaWeekdays', 'Часы работы в будни (английский формат)', 'text', 'Так: Mo-Fr 08:00-20:00'],
        ['site.hoursSchemaWeekend', 'Часы работы в выходные (английский формат)', 'text', 'Так: Sa-Su 09:00-21:00. Если выходных нет, оставьте пустым.'],
        ['site.priceRange', 'Уровень цен', 'text', '₽ недорого, ₽₽ средне, ₽₽₽ дорого.'],
        ['site.domain', 'Адрес сайта', 'text', 'Без https:// и без слеша в конце, например zerno-cafe.ru. Впишите, когда сайт будет в интернете.']
      ])
    ]);
  }

  function buildBirthday() {
    return card('s-birthday', 'Праздник: баннер на сайте', 'Баннер с приглашением на день рождения кофейни. После указанной даты он исчезает сам.', [
      h('div', { class: 'grid two' }, [
        field('birthday.show', 'Показывать баннер на сайте', 'check'),
        field('birthday.hideAfter', 'Скрыть баннер, начиная с даты', 'date', 'В этот день и позже баннера не будет.')
      ]),
      group('Дата на «билете»', [
        ['birthday.day', 'Число', 'text', ''], ['birthday.month', 'Месяц', 'text', 'Например: ноября'], ['birthday.weekday', 'День недели', 'text', '']
      ]),
      group('Что написано', [
        ['birthday.title', 'Заголовок', 'text', ''],
        ['birthday.intro', 'Приглашение', 'area', ''],
        ['birthday.when', 'Когда', 'text', 'Например: Суббота, 7 ноября, с 12:00 до 20:00.'],
        ['birthday.program', 'Что будет', 'area', 'Только то, что правда планируется.']
      ])
    ]);
  }

  function buildTexts() {
    return card('s-texts', 'Тексты на сайте', 'Заголовки и абзацы. Поля, где остались [[двойные скобки]], ещё ждут ваших слов.', [
      group('Главный экран', [['texts.slogan', 'Слоган', 'text', 'Варианты: «Тёплая чашка, домашняя выпечка, свободный стол.» или «Маленькая кофейня, где можно остаться.»']], 1),
      group('О нас', [
        ['texts.aboutTitle', 'Заголовок раздела', 'text', ''],
        ['texts.about1', 'Абзац 1', 'area', ''], ['texts.about2', 'Абзац 2 (про кофе)', 'area', ''],
        ['texts.about3', 'Абзац 3 (про выпечку)', 'area', ''], ['texts.about4', 'Абзац 4 (про атмосферу)', 'area', '']
      ], 1),
      group('Подписи к разделам', [
        ['texts.menuIntro', 'Под заголовком «Меню»', 'area', ''],
        ['texts.fotoIntro', 'Под заголовком «Как у нас выглядит»', 'area', '']
      ], 1)
    ]);
  }

  /* --- Меню --- */
  var menuBody;
  function move(arr, i, d) { var j = i + d; if (j < 0 || j >= arr.length) return; var t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
  function tools(arr, i, rerender, what, deleteConfirm) {
    return h('div', { class: 'tools' }, [
      h('button', { type: 'button', class: 'ghost mini', 'aria-label': 'Поднять выше', title: 'Выше', onclick: function () { move(arr, i, -1); rerender(); } }, ['↑']),
      h('button', { type: 'button', class: 'ghost mini', 'aria-label': 'Опустить ниже', title: 'Ниже', onclick: function () { move(arr, i, 1); rerender(); } }, ['↓']),
      h('button', { type: 'button', class: 'danger mini', 'aria-label': 'Удалить ' + what, title: 'Удалить', onclick: function () {
        if (deleteConfirm && !confirm(deleteConfirm)) return;
        arr.splice(i, 1); rerender();
      } }, ['✕'])
    ]);
  }
  function bindText(inp, obj, key, num) {
    inp.value = obj[key] == null ? '' : obj[key];
    var paint = function () { inp.classList.toggle('is-todo', /\[\[/.test(inp.value)); };
    paint();
    inp.addEventListener('input', function () {
      obj[key] = num ? (inp.value === '' ? '' : Number(inp.value.replace(',', '.'))) : inp.value;
      paint(); touch();
    });
    return inp;
  }
  function renderMenu() {
    menuBody.textContent = '';
    D.menu.forEach(function (cat, ci) {
      cat.items = cat.items || [];
      var catEl = h('div', { class: 'cat' });
      var tIn = bindText(h('input', { type: 'text', 'aria-label': 'Название категории' }), cat, 'title');
      var ex = h('input', { type: 'checkbox' }); ex.checked = !!cat.example;
      ex.addEventListener('change', function () { cat.example = ex.checked; touch(); });
      catEl.appendChild(h('div', { class: 'cat-head' }, [
        h('label', { class: 'f' }, ['Категория', tIn]),
        h('label', { class: 'check' }, [ex, 'Это пример, не настоящие цены']),
        tools(D.menu, ci, renderMenu, 'категорию', 'Удалить категорию «' + (cat.title || '') + '» вместе со всеми позициями?')
      ]));
      cat.items.forEach(function (it, ii) {
        var nameIn = bindText(h('input', { type: 'text', 'aria-label': 'Название', placeholder: 'Название' }), it, 'name');
        var priceIn = bindText(h('input', { type: 'number', min: '0', step: '1', inputmode: 'numeric', 'aria-label': 'Цена в рублях', placeholder: 'Цена, ₽' }), it, 'price', true);
        var noteIn = bindText(h('input', { type: 'text', 'aria-label': 'Описание', placeholder: 'Описание (не обязательно)' }), it, 'note');
        catEl.appendChild(h('div', { class: 'item' }, [nameIn, priceIn, h('div', { class: 'note' }, [noteIn]), tools(cat.items, ii, renderMenu, 'позицию')]));
      });
      catEl.appendChild(h('div', { style: 'margin-top:.75rem' }, [
        h('button', { type: 'button', class: 'ghost', onclick: function () { cat.items.push({ name: '', price: 0, note: '' }); renderMenu(); var ins = catEl.querySelectorAll('.item'); var last = ins[ins.length - 1]; if (last) { var i0 = last.querySelector('input'); i0.focus(); } } }, ['+ Добавить позицию'])
      ]));
      menuBody.appendChild(catEl);
    });
    menuBody.appendChild(h('div', { style: 'margin-top:1rem' }, [
      h('button', { type: 'button', class: 'ghost', onclick: function () { D.menu.push({ title: 'Новая категория', example: false, items: [] }); renderMenu(); } }, ['+ Добавить категорию'])
    ]));
    touch();
  }
  function buildMenu() {
    menuBody = h('div');
    renderMenu();
    return card('s-menu', 'Меню и цены', 'Меняйте названия и цены прямо в списке. Пока стоит галочка «Это пример», на сайте у категории пометка «пример»: уберите её, когда внесёте настоящие цены.', [
      menuBody,
      h('div', { class: 'group' }, [h('div', { class: 'grid' }, [field('menuNote', 'Примечание под меню', 'area', 'Например, про доплату за растительное молоко. Можно оставить пустым.')])])
    ]);
  }

  /* --- Фото --- */
  var photosBody;
  var SIZES = [480, 800, 1200];
  function toBlob(canvas) {
    return new Promise(function (res) { canvas.toBlob(res, 'image/webp', 0.8); });
  }
  async function processImage(file) {
    var bmp;
    try { bmp = await createImageBitmap(file); }
    catch (e) { throw new Error('Не удалось открыть «' + file.name + '». Сохраните фото как JPG или PNG и попробуйте снова.'); }
    var blobs = {}, dims = {};
    for (var i = 0; i < SIZES.length; i++) {
      var w = Math.min(SIZES[i], bmp.width), hh = Math.round(bmp.height * w / bmp.width);
      var c = document.createElement('canvas'); c.width = w; c.height = hh;
      var ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(bmp, 0, 0, w, hh);
      var b = await toBlob(c);
      if (!b || b.type !== 'image/webp') throw new Error('Этот браузер не умеет сохранять фото для сайта. Откройте редактор в Chrome или Edge.');
      blobs[SIZES[i]] = b; dims[SIZES[i]] = [w, hh];
    }
    bmp.close && bmp.close();
    var d = dims[1200], ratio = d[1] / d[0];
    return { blobs: blobs, w: d[0], h: d[1], size: ratio > 1.15 ? 'tall' : ratio < 0.7 ? 'wide' : '' };
  }
  function newName() { return 'foto-' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36); }
  async function attach(entry, file) {
    say('Готовлю фото «' + file.name + '»…');
    try {
      var r = await processImage(file), name = newName();
      if (entry.file && newPhotos[entry.file]) delete newPhotos[entry.file];
      else if (entry.file) removedFiles.push(entry.file);
      newPhotos[name] = r.blobs;
      entry.file = name; entry.w = r.w; entry.h = r.h; entry.size = entry.size || r.size; entry.avif = false;
      entry._thumb = URL.createObjectURL(r.blobs[480]);
      say('Фото готово. Не забудьте нажать «Сохранить».', 'ok');
    } catch (e) { say(e.message, 'err'); }
  }
  function fileButton(label, multiple, onFiles, cls) {
    var inp = h('input', { type: 'file', accept: 'image/*', multiple: multiple, hidden: true });
    inp.addEventListener('change', function () { if (inp.files.length) onFiles(Array.prototype.slice.call(inp.files)); inp.value = ''; });
    return h('span', {}, [inp, h('button', { type: 'button', class: cls || 'ghost', onclick: function () { inp.click(); } }, [label])]);
  }
  function renderPhotos() {
    photosBody.textContent = '';
    D.gallery.forEach(function (p, i) {
      var thumb = p.file
        ? h('img', { class: 'thumb', alt: '', src: p._thumb || ('assets/photos/' + p.file + '-480.webp') })
        : h('div', { class: 'thumb', text: 'пока заглушка' });
      var sel = h('select', { 'aria-label': 'Размер на странице' }, [
        h('option', { value: '', text: 'Обычное' }), h('option', { value: 'wide', text: 'Широкое' }), h('option', { value: 'tall', text: 'Высокое' })
      ]);
      sel.value = p.size || '';
      sel.addEventListener('change', function () { p.size = sel.value; touch(); });
      var alt = bindText(h('input', { type: 'text', 'aria-label': 'Что на фото' }), p, 'alt');
      var cap = bindText(h('input', { type: 'text', 'aria-label': 'Подпись на фото' }), p, 'caption');
      photosBody.appendChild(h('div', { class: 'photo' }, [
        thumb,
        h('div', { class: 'body' }, [
          h('div', { class: 'row2' }, [
            h('label', { class: 'f' }, ['Что на фото', h('small', { text: 'Для слабовидящих и поиска.' }), alt]),
            h('label', { class: 'f' }, ['Подпись', h('small', { text: 'Не обязательно.' }), cap]),
            h('label', { class: 'f' }, ['Размер в сетке', h('small', { text: ' ' }), sel])
          ]),
          h('div', { class: 'tools' }, [
            fileButton(p.file ? 'Заменить фото' : 'Загрузить фото', false, async function (fs) { await attach(p, fs[0]); renderPhotos(); touch(); }),
            h('button', { type: 'button', class: 'ghost mini', 'aria-label': 'Поднять выше', onclick: function () { move(D.gallery, i, -1); renderPhotos(); touch(); } }, ['↑']),
            h('button', { type: 'button', class: 'ghost mini', 'aria-label': 'Опустить ниже', onclick: function () { move(D.gallery, i, 1); renderPhotos(); touch(); } }, ['↓']),
            h('button', { type: 'button', class: 'danger mini', 'aria-label': 'Удалить', onclick: function () {
              if (!confirm('Убрать это фото из списка?')) return;
              if (p.file) { if (newPhotos[p.file]) delete newPhotos[p.file]; else removedFiles.push(p.file); }
              D.gallery.splice(i, 1); renderPhotos(); touch();
            } }, ['✕'])
          ])
        ])
      ]));
    });
    photosBody.appendChild(h('div', { style: 'margin-top:1rem;display:flex;gap:.6rem;flex-wrap:wrap' }, [
      fileButton('+ Добавить фото', true, async function (fs) {
        for (var i = 0; i < fs.length; i++) {
          var e = { file: null, alt: '', caption: '', w: 1200, h: 900, size: '' };
          await attach(e, fs[i]);
          if (e.file) D.gallery.push(e);
        }
        renderPhotos(); touch();
      }, 'primary'),
      h('button', { type: 'button', class: 'ghost', onclick: function () { D.gallery.push({ file: null, alt: 'Фото', caption: '', w: 1200, h: 900, size: '' }); renderPhotos(); touch(); } }, ['+ Пустая заглушка'])
    ]));
  }
  function buildPhotos() {
    photosBody = h('div');
    renderPhotos();
    return card('s-photos', 'Фотографии', 'Можно выбрать сразу несколько фото с телефона или компьютера: редактор сам уменьшит их до лёгкого размера. Хорошо подходят 6–10 снимков.', [photosBody]);
  }

  /* ---------- Что записывать в файлы сайта ---------- */
  var HEADER = '/* ============================================================\n' +
    '   ДАННЫЕ САЙТА «ЗЕРНО»: тексты, контакты, меню, фотографии.\n\n' +
    '   Проще всего менять всё на странице redaktor.html (откройте её двойным кликом):\n' +
    '   она сама перепишет этот файл. Можно править и вручную: меняйте только то,\n' +
    '   что внутри кавычек "...", запятые и скобки не удаляйте.\n' +
    '   Всё, что в [[двойных скобках]], ещё не заполнено.\n' +
    '   ============================================================ */\n';
  function dataJs() { return HEADER + 'window.ZERNO = ' + ser() + ';\n'; }

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
  function cleanDomain(d) {
    d = String(d || '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    return d || '[[ДОМЕН]]';
  }
  function seoBlock() {
    var s = D.site, host = cleanDomain(s.domain), base = 'https://' + host + '/';
    var title = 'Зерно: кофейня ' + s.city + '. Кофе, домашняя выпечка, спокойное место';
    var desc = 'Зерно — небольшая кофейня на 20 мест: ' + s.areaLine + '. Хороший кофе, домашняя выпечка, спокойно. Можно прийти с ноутбуком или с друзьями.';
    var slogan = (D.texts.slogan || '').trim();
    var ld = {
      '@context': 'https://schema.org', '@type': 'CafeOrCoffeeShop', name: 'Зерно',
      description: 'Небольшая кофейня на 20 мест: хороший кофе, домашняя выпечка, спокойная атмосфера.',
      url: base, image: base + 'assets/og-image.png', logo: base + 'assets/logo.svg',
      telephone: s.phone || '', priceRange: s.priceRange || '', servesCuisine: ['Кофе', 'Выпечка'],
      address: { '@type': 'PostalAddress', streetAddress: s.address || '', addressLocality: s.city || '', addressCountry: 'RU' },
      openingHours: [s.hoursSchemaWeekdays, s.hoursSchemaWeekend].filter(function (x) { return x && String(x).trim(); }),
      hasMenu: base + '#menu', hasMap: s.routeUrl || '',
      sameAs: [s.vk, s.telegram, s.instagram].filter(function (x) { return x && String(x).trim(); })
    };
    if (!ld.telephone) delete ld.telephone; if (!ld.priceRange) delete ld.priceRange; if (!ld.hasMap) delete ld.hasMap;
    var json = JSON.stringify(ld, null, 2).replace(/<\//g, '<\\/').split('\n').join('\n  ');
    return [
      '<!--SEO:НАЧАЛО-->',
      '  <title>' + esc(title) + '</title>',
      '  <meta name="description" content="' + esc(desc) + '">',
      '  <link rel="canonical" href="' + esc(base) + '">',
      '  <meta property="og:type" content="website">',
      '  <meta property="og:locale" content="ru_RU">',
      '  <meta property="og:site_name" content="Зерно">',
      '  <meta property="og:title" content="Зерно: кофейня ' + esc(s.city) + '">',
      '  <meta property="og:description" content="Кофе, домашняя выпечка и никакой спешки. Маленькая кофейня на 20 мест.">',
      '  <meta property="og:url" content="' + esc(base) + '">',
      '  <meta property="og:image" content="' + esc(base) + 'assets/og-image.png">',
      '  <meta property="og:image:width" content="1200">',
      '  <meta property="og:image:height" content="630">',
      '  <meta property="og:image:alt" content="Зерно: кофейня. ' + esc(slogan) + '">',
      '  <meta name="twitter:card" content="summary_large_image">',
      '  <meta name="twitter:title" content="Зерно: кофейня ' + esc(s.city) + '">',
      '  <meta name="twitter:description" content="Кофе, домашняя выпечка и никакой спешки.">',
      '  <meta name="twitter:image" content="' + esc(base) + 'assets/og-image.png">',
      '  <script type="application/ld+json">',
      '  ' + json,
      '  </script>',
      '  <!--SEO:КОНЕЦ-->'
    ].join('\n');
  }
  function patchIndex(html) {
    var re = /<!--SEO:НАЧАЛО-->[\s\S]*?<!--SEO:КОНЕЦ-->/;
    if (!re.test(html)) return null;
    return html.replace(re, function () { return seoBlock(); });
  }
  function robotsTxt() {
    var host = cleanDomain(D.site.domain), ready = host.indexOf('[[') === -1;
    return 'User-agent: *\nAllow: /\nDisallow: /redaktor.html\nDisallow: /data.backup.js\n\n' +
      (ready ? '' : '# Когда у сайта появится адрес, впишите его в редакторе: строка ниже включится сама.\n# ') +
      'Sitemap: https://' + host + '/sitemap.xml\n';
  }
  function sitemapXml() {
    var host = cleanDomain(D.site.domain), d = new Date().toISOString().slice(0, 10);
    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://' + host +
      '/</loc>\n    <lastmod>' + d + '</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>1.0</priority>\n  </url>\n</urlset>\n';
  }
  /* список файлов, которые нужно записать: [{path, data: string | Blob}] */
  function buildFiles(indexHtml) {
    var files = [{ path: 'data.js', data: dataJs() }, { path: 'robots.txt', data: robotsTxt() }, { path: 'sitemap.xml', data: sitemapXml() }];
    var warn = null;
    if (indexHtml != null) {
      var p = patchIndex(indexHtml);
      if (p == null) warn = 'В index.html не найден блок SEO:НАЧАЛО … SEO:КОНЕЦ, поэтому заголовок и описание для поисковиков не обновлены.';
      else files.push({ path: 'index.html', data: p });
    } else warn = 'index.html не обновлён: заголовок и описание для поисковиков изменятся, когда вы сохраните через кнопку «Выбрать папку сайта» (Chrome или Edge).';
    var used = {};
    D.gallery.forEach(function (g) { if (g.file) used[g.file] = 1; });
    Object.keys(newPhotos).forEach(function (name) {
      if (!used[name]) return;
      SIZES.forEach(function (w) { files.push({ path: 'assets/photos/' + name + '-' + w + '.webp', data: newPhotos[name][w] }); });
    });
    return { files: files, warn: warn };
  }

  /* ---------- Запись в папку сайта ---------- */
  async function dirFor(path, create) {
    var parts = path.split('/'), name = parts.pop(), d = root;
    for (var i = 0; i < parts.length; i++) d = await d.getDirectoryHandle(parts[i], { create: create });
    return { dir: d, name: name };
  }
  async function writeFile(path, data) {
    var t = await dirFor(path, true), fh = await t.dir.getFileHandle(t.name, { create: true });
    var w = await fh.createWritable(); await w.write(data); await w.close();
  }
  async function readText(path) {
    var t = await dirFor(path, false), fh = await t.dir.getFileHandle(t.name);
    return (await fh.getFile()).text();
  }
  async function saveToFolder() {
    var idx = null; try { idx = await readText('index.html'); } catch (e) { /* ниже будет предупреждение */ }
    var built = buildFiles(idx);
    try { await writeFile('data.backup.js', await readText('data.js')); } catch (e) { /* первой копии может не быть */ }
    for (var i = 0; i < built.files.length; i++) await writeFile(built.files[i].path, built.files[i].data);
    for (var j = 0; j < removedFiles.length; j++) {
      for (var k = 0; k < SIZES.length; k++) {
        for (var e2 of ['webp', 'avif']) {
          try { var t = await dirFor('assets/photos/' + removedFiles[j] + '-' + SIZES[k] + '.' + e2, false); await t.dir.removeEntry(t.name); } catch (e) { /* нет такого файла */ }
        }
      }
    }
    return built.warn;
  }

  /* ---------- Архив (если нельзя писать в папку) ---------- */
  var CRC = (function () { var t = [], c, n, k; for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { var c = -1; for (var i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
  async function makeZip(files) {
    var enc = new TextEncoder(), parts = [], central = [], offset = 0, cdSize = 0;
    for (var i = 0; i < files.length; i++) {
      var f = files[i], name = enc.encode(f.path);
      var data = typeof f.data === 'string' ? enc.encode(f.data) : new Uint8Array(await f.data.arrayBuffer());
      var crc = crc32(data), size = data.length;
      var lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, 0, true); lh.setUint16(12, 0x21, true); lh.setUint32(14, crc, true); lh.setUint32(18, size, true);
      lh.setUint32(22, size, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, data);
      var ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
      ch.setUint16(10, 0, true); ch.setUint16(12, 0, true); ch.setUint16(14, 0x21, true); ch.setUint32(16, crc, true);
      ch.setUint32(20, size, true); ch.setUint32(24, size, true); ch.setUint16(28, name.length, true);
      ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      cdSize += 46 + name.length;
      offset += 30 + name.length + size;
    }
    var end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    return new Blob(parts.concat(central, [new Uint8Array(end.buffer)]), { type: 'application/zip' });
  }
  async function saveAsZip() {
    var idx = null;
    try { var r = await fetch('index.html'); if (r.ok) idx = await r.text(); } catch (e) { /* открыто двойным кликом: читать index.html нельзя */ }
    var built = buildFiles(idx);
    var blob = await makeZip(built.files);
    var a = h('a', { href: URL.createObjectURL(blob), download: 'zerno-izmeneniya.zip' });
    document.body.appendChild(a); a.click(); a.remove();
    return built.warn;
  }

  /* ---------- Публикация в интернет (GitHub) ---------- */
  var GH_KEY = 'zerno-gh';
  function loadGh() {
    var c = { owner: '', repo: '', branch: 'main', token: '' };
    try { Object.assign(c, JSON.parse(localStorage.getItem(GH_KEY) || '{}')); } catch (e) { /* хранилище недоступно */ }
    var hp = new URLSearchParams(location.hash.replace(/^#/, ''));   // ссылка-приглашение: ...redaktor.html#k=ключ
    if (hp.get('k')) {
      c.token = hp.get('k');
      if (hp.get('o')) c.owner = hp.get('o');
      if (hp.get('r')) c.repo = hp.get('r');
      if (hp.get('b')) c.branch = hp.get('b');
      try { localStorage.setItem(GH_KEY, JSON.stringify(c)); } catch (e) { /* не страшно */ }
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ключ просто останется в адресе */ }
    }
    if (!c.owner && /\.github\.io$/.test(location.hostname)) {   // редактор открыт на самом сайте: подставляем сами
      c.owner = location.hostname.replace(/\.github\.io$/, '');
      var seg = location.pathname.split('/')[1];
      c.repo = seg && !/\.html$/.test(seg) ? seg : c.owner + '.github.io';
    }
    return c;
  }
  var gh = loadGh();
  function saveGh() { try { localStorage.setItem(GH_KEY, JSON.stringify(gh)); } catch (e) { /* не страшно */ } }
  function ghReady() { return !!(String(gh.owner).trim() && String(gh.repo).trim() && String(gh.token).trim()); }
  function branchName() { return String(gh.branch || 'main').trim() || 'main'; }
  function siteUrl() {
    var o = String(gh.owner).trim(), r = String(gh.repo).trim();
    if (!o || !r) return '';
    return 'https://' + o + '.github.io/' + (r.toLowerCase() === o.toLowerCase() + '.github.io' ? '' : r + '/');
  }
  async function ghReq(method, path, body, raw) {
    var res;
    try {
      res = await fetch('https://api.github.com/repos/' + encodeURIComponent(String(gh.owner).trim()) + '/' + encodeURIComponent(String(gh.repo).trim()) + path, {
        method: method, cache: 'no-store',
        headers: Object.assign({ Authorization: 'Bearer ' + String(gh.token).trim(), Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, body ? { 'Content-Type': 'application/json' } : {}),
        body: body ? JSON.stringify(body) : undefined
      });
    } catch (e) { throw new Error('Нет связи с интернетом или GitHub сейчас недоступен.'); }
    if (!res.ok) {
      var msg = ''; try { msg = (await res.json()).message || ''; } catch (e) { /* без текста */ }
      if (res.status === 401) throw new Error('Ключ доступа не подошёл или истёк. Создайте новый ключ и вставьте его в разделе «Публикация».');
      if (res.status === 403 || res.status === 404) throw new Error('Нет доступа к «' + gh.owner + '/' + gh.repo + '» или такого файла нет. Проверьте название и права ключа (Contents: Read and write). ' + msg);
      if (res.status === 409 || res.status === 422) throw new Error('Пока вы правили, сайт успел измениться. Обновите страницу редактора (F5) и повторите. (' + msg + ')');
      throw new Error('GitHub ответил ошибкой ' + res.status + '. ' + msg);
    }
    return raw ? res.text() : res.json();
  }
  function b64(u8) { var s = '', n = 0x8000, i; for (i = 0; i < u8.length; i += n) s += String.fromCharCode.apply(null, u8.subarray(i, i + n)); return btoa(s); }
  async function toBytes(data) { return typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(await data.arrayBuffer()); }
  async function saveToGitHub() {
    var br = encodeURIComponent(branchName());
    var ref = await ghReq('GET', '/git/ref/heads/' + br);
    var headSha = ref.object.sha;
    var commit = await ghReq('GET', '/git/commits/' + headSha);
    var baseTree = commit.tree.sha;
    var idx = null; try { idx = await ghReq('GET', '/contents/index.html?ref=' + br, null, true); } catch (e) { /* предупреждение ниже */ }
    var built = buildFiles(idx);
    var tree = [];
    for (var i = 0; i < built.files.length; i++) {
      var f = built.files[i];
      var blob = await ghReq('POST', '/git/blobs', { content: b64(await toBytes(f.data)), encoding: 'base64' });
      tree.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
    }
    if (removedFiles.length) {
      var existing = {};
      (await ghReq('GET', '/git/trees/' + baseTree + '?recursive=1')).tree.forEach(function (t) { existing[t.path] = 1; });
      removedFiles.forEach(function (name) {
        SIZES.forEach(function (w) { ['webp', 'avif'].forEach(function (ext) {
          var p = 'assets/photos/' + name + '-' + w + '.' + ext;
          if (existing[p]) tree.push({ path: p, mode: '100644', type: 'blob', sha: null });
        }); });
      });
    }
    var nt = await ghReq('POST', '/git/trees', { base_tree: baseTree, tree: tree });
    if (nt.sha === baseTree) return { warn: built.warn, same: true };
    var nc = await ghReq('POST', '/git/commits', { message: 'Правки через редактор сайта', tree: nt.sha, parents: [headSha] });
    await ghReq('PATCH', '/git/refs/heads/' + br, { sha: nc.sha });
    return { warn: built.warn };
  }
  /* Свежие данные берём не из кэша сайта, а прямо из репозитория, чтобы не затереть чужие правки */
  async function loadFreshData() {
    var text = await ghReq('GET', '/contents/data.js?ref=' + encodeURIComponent(branchName()), null, true);
    var w = {}; new Function('window', text)(w);
    if (!w.ZERNO) throw new Error('В data.js нет данных сайта.');
    return w.ZERNO;
  }

  /* ---------- Проверка и сохранение ---------- */
  function validate() {
    var errs = [];
    D.menu.forEach(function (c) {
      if (!String(c.title || '').trim()) errs.push('У одной из категорий меню нет названия.');
      (c.items || []).forEach(function (it) {
        if (!String(it.name || '').trim()) errs.push('В категории «' + c.title + '» есть позиция без названия.');
        if (typeof it.price !== 'number' || !isFinite(it.price) || it.price < 0) errs.push('У позиции «' + (it.name || '?') + '» не указана цена (нужно число).');
      });
    });
    D.gallery.forEach(function (g, i) { if (g.file && !String(g.alt || '').trim()) errs.push('У фото №' + (i + 1) + ' не написано, что на нём (поле «Что на фото»).'); });
    return errs;
  }
  var saving = false, stale = false;
  function mode() { return ghReady() ? 'github' : root ? 'folder' : 'zip'; }
  async function save(force) {
    if (saving) return;
    var errs = validate();
    if (errs.length) { say('Сохранить пока нельзя:\n• ' + errs.filter(function (v, i, a) { return a.indexOf(v) === i; }).join('\n• '), 'err'); return; }
    var m = typeof force === 'string' ? force : mode();
    if (m === 'github' && stale && !confirm('Не удалось загрузить самую свежую версию сайта, поэтому показаны данные, которые могут быть устаревшими. Всё равно опубликовать?')) return;
    saving = true; $('#b-save').disabled = true;
    say(m === 'github' ? 'Публикую…' : 'Сохраняю…');
    try {
      var warn, where;
      if (m === 'github') {
        var r = await saveToGitHub(); warn = r.warn;
        where = r.same ? 'Изменений по сравнению с сайтом нет, публиковать нечего.' : 'Опубликовано. Сайт обновится через 1–2 минуты' + (siteUrl() ? ': ' + siteUrl() : '.');
      } else if (m === 'folder') { warn = await saveToFolder(); where = 'Сохранено в папку сайта. Откройте сайт и обновите страницу (F5).'; }
      else { warn = await saveAsZip(); where = 'Архив скачан. Распакуйте его в папку сайта с заменой файлов, потом откройте сайт и обновите страницу (F5).'; }
      ORIG = ser(); newPhotos = {}; removedFiles = []; stale = false;
      say(where + (warn ? '\n' + warn : ''), 'ok');
    } catch (e) {
      say('Не удалось сохранить: ' + (e && e.message ? e.message : e) + (m === 'github' ? '\nМожно скачать архив кнопкой «Скачать архив»: ничего не потеряется.' : '\nПопробуйте скачать архив (выберите папку заново или откройте редактор в Chrome).'), 'err');
    }
    saving = false; $('#b-save').disabled = false; touch();
  }
  var folderLabel = '';
  function updateButtons() {
    var m = mode(), f = $('#b-folder');
    $('#b-save').textContent = m === 'github' ? 'Сохранить и опубликовать' : m === 'folder' ? 'Сохранить на сайт' : 'Скачать архив';
    $('#b-zip').hidden = m === 'zip';
    f.hidden = !window.showDirectoryPicker || m === 'github';
    f.textContent = folderLabel || (root ? 'Папка: ' + root.name + ' (сменить)' : 'Выбрать папку сайта');
    var note = $('#mode-note');
    if (note) note.textContent = m === 'github' ? 'Публикация включена: ' + (siteUrl() || '') : m === 'folder' ? 'Запись в папку на этом компьютере' : '';
  }

  /* ---------- Выбор папки (запоминается между запусками) ---------- */
  function idb() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open('zerno-editor', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('kv'); };
      r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
    });
  }
  async function kv(op, key, val) {
    try {
      var db = await idb();
      return await new Promise(function (res, rej) {
        var tx = db.transaction('kv', op === 'set' ? 'readwrite' : 'readonly'), st = tx.objectStore('kv');
        var rq = op === 'set' ? st.put(val, key) : st.get(key);
        rq.onsuccess = function () { res(rq.result); }; rq.onerror = function () { rej(rq.error); };
      });
    } catch (e) { return null; }
  }
  async function verifyRoot(h) {
    try { await h.getFileHandle('index.html'); await h.getFileHandle('data.js'); }
    catch (e) { throw new Error('В выбранной папке нет файлов index.html и data.js. Выберите папку zerno, в которой лежит редактор.'); }
  }
  function setRoot(h) { root = h; folderLabel = ''; updateButtons(); }
  async function pickFolder() {
    if (!window.showDirectoryPicker) {
      say('Этот браузер не умеет записывать в папку. Откройте редактор в Chrome или Edge на компьютере или нажмите «Скачать архив» после правок.', 'err');
      return;
    }
    try {
      var h = await window.showDirectoryPicker({ mode: 'readwrite' });
      await verifyRoot(h); setRoot(h); await kv('set', 'root', h);
      say('Папка подключена. Теперь кнопка «Сохранить» сама обновит файлы сайта.', 'ok');
    } catch (e) { if (e && e.name !== 'AbortError') say(e.message || String(e), 'err'); }
  }
  async function restoreFolder() {
    var h = await kv('get', 'root');
    if (!h || !h.requestPermission) return;
    var b = $('#b-folder'); folderLabel = 'Продолжить с папкой «' + h.name + '»'; updateButtons();
    b.onclick = async function () {
      try {
        if ((await h.requestPermission({ mode: 'readwrite' })) === 'granted') { await verifyRoot(h); setRoot(h); b.onclick = pickFolder; say('Папка подключена.', 'ok'); }
        else pickFolder();
      } catch (e) { pickFolder(); }
    };
  }

  /* --- раздел «Публикация» --- */
  function ghField(label, key, hint, type) {
    var id = 'f' + (++uid), inp = h('input', { id: id, type: type || 'text', autocomplete: 'off', spellcheck: 'false' });
    inp.value = gh[key] || '';
    inp.addEventListener('input', function () { gh[key] = inp.value; saveGh(); updateButtons(); });
    return h('label', { class: 'f', for: id }, [label, hint ? h('small', { text: hint }) : null, inp]);
  }
  function buildPublish() {
    var out = h('div', { id: 'gh-msg', role: 'status', style: 'margin-top:1rem;font-weight:700;white-space:pre-line' });
    var test = h('button', { type: 'button', class: 'ghost', onclick: async function () {
      out.textContent = 'Проверяю…'; out.style.color = '';
      try {
        if (!ghReady()) throw new Error('Заполните имя, репозиторий и ключ.');
        var repo = await ghReq('GET', '');
        if (repo.permissions && repo.permissions.push === false) throw new Error('Ключ только читает репозиторий, а нужно ещё и записывать (Contents: Read and write).');
        await ghReq('GET', '/git/ref/heads/' + encodeURIComponent(branchName()));
        out.textContent = 'Всё подключено: ' + gh.owner + '/' + gh.repo + ', ветка «' + branchName() + '».\nАдрес сайта: ' + siteUrl(); out.style.color = 'var(--ok)';
      } catch (e) { out.textContent = e.message; out.style.color = 'var(--bad)'; }
    } }, ['Проверить подключение']);
    var invite = h('button', { type: 'button', class: 'ghost', onclick: async function () {
      if (!ghReady()) { out.textContent = 'Сначала вставьте ключ и проверьте подключение.'; out.style.color = 'var(--bad)'; return; }
      var p = new URLSearchParams({ k: String(gh.token).trim(), o: String(gh.owner).trim(), r: String(gh.repo).trim(), b: branchName() });
      var link = location.origin + location.pathname + '#' + p.toString();
      try { await navigator.clipboard.writeText(link); out.textContent = 'Ссылка скопирована. Отправьте её директору лично (не в общий чат). Открыв её, директор сразу сможет публиковать.'; out.style.color = 'var(--ok)'; }
      catch (e) { out.textContent = 'Скопируйте ссылку вручную и отправьте директору лично:\n' + link; out.style.color = ''; }
    } }, ['Скопировать ссылку для директора']);
    var forget = h('button', { type: 'button', class: 'danger', onclick: function () {
      if (!confirm('Забыть ключ на этом устройстве? Придётся вставить его снова.')) return;
      gh.token = ''; saveGh(); location.reload();
    } }, ['Забыть ключ на этом устройстве']);
    return card('s-publish', 'Публикация в интернет', 'Один раз настраивается помощником, потом директору ничего делать не нужно: кнопка «Сохранить и опубликовать» отправляет правки на сайт сама. Пошаговая инструкция: файл ПУБЛИКАЦИЯ.md.', [
      h('div', { class: 'grid two' }, [
        ghField('Имя на GitHub', 'owner', 'Ваш логин на GitHub.'),
        ghField('Название репозитория', 'repo', 'Папка сайта на GitHub, например zerno-site.'),
        ghField('Ветка', 'branch', 'Обычно main.'),
        ghField('Ключ доступа', 'token', 'Длинный набор символов из настроек GitHub. Хранится только в этом браузере.', 'password')
      ]),
      h('div', { class: 'tools', style: 'margin-top:1rem' }, [test, invite, forget]),
      out,
      h('p', { class: 'lead', style: 'margin-top:1rem', text: 'Ссылка для директора: она настраивает редактор на другом устройстве одним нажатием, ключ вводить не нужно. Отправляйте её только директору лично. У кого есть эта ссылка, тот может менять сайт; если ссылка попала не туда, удалите ключ в настройках GitHub и создайте новый.' })
    ]);
  }

  /* ---------- Старт ---------- */
  async function start() {
    if (ghReady()) {
      say('Загружаю свежую версию сайта…');
      try {
        var fresh = await loadFreshData();
        D = clone(fresh);
        D.site = D.site || {}; D.texts = D.texts || {}; D.birthday = D.birthday || {};
        D.menu = D.menu || []; D.gallery = D.gallery || []; D.menuNote = D.menuNote || '';
        ORIG = ser(); say('');
      } catch (e) { stale = true; say('Не получилось загрузить свежую версию сайта: ' + e.message + '\nПоказаны данные из этой страницы, они могут быть устаревшими.', 'err'); }
    }
    var box = $('#sections');
    [buildContacts(), buildBirthday(), buildTexts(), buildMenu(), buildPhotos(), buildPublish()].forEach(function (s) { box.appendChild(s); });
    $('#b-save').addEventListener('click', function () { save(); });
    $('#b-zip').addEventListener('click', function () { save('zip'); });
    $('#b-folder').onclick = pickFolder;
    $('#b-todo').addEventListener('click', function () {
      var els = Array.prototype.slice.call(document.querySelectorAll('.is-todo'));
      if (!els.length) return;
      var cur = els.indexOf(document.activeElement), nx = els[(cur + 1) % els.length];
      nx.scrollIntoView({ block: 'center', behavior: 'smooth' }); nx.focus({ preventScroll: true });
    });
    if (!window.showDirectoryPicker) {
      if (!ghReady()) say('Этот браузер не умеет записывать прямо в папку сайта, поэтому правки сохранятся архивом. Для сохранения в один клик откройте редактор в Chrome или Edge или настройте публикацию (раздел «Публикация»).', '');
    } else restoreFolder();
    updateButtons();
    touch();
  }
  window.ZernoEditor = { get: function () { return D; }, buildFiles: buildFiles, makeZip: makeZip, seoBlock: seoBlock, dataJs: dataJs, setRoot: setRoot, save: save, attach: attach, processImage: processImage, gh: gh, saveGh: saveGh, updateButtons: updateButtons, loadFreshData: loadFreshData, ghReq: ghReq, state: function () { return { newPhotos: newPhotos, removedFiles: removedFiles, stale: stale }; }, ready: start() };
})();
