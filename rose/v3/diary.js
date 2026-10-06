(function () {
  'use strict';
  var pages = document.querySelectorAll('[data-diary-page]');
  var prev = document.getElementById('diaryPrevBtn'), next = document.getElementById('diaryNextBtn');
  var label = document.getElementById('diaryPageLabel'), save = document.getElementById('saveLetterBtn');
  var field = document.getElementById('letterText'), current = 0, timer;
  function show(index) {
    current = Math.max(0, Math.min(pages.length - 1, index));
    pages.forEach(function (page, i) {
      page.hidden = i !== current;
      page.classList.remove('turning');
      if (i === current) { void page.offsetWidth; page.classList.add('turning'); }
    });
    clearTimeout(timer); timer = setTimeout(function () { pages[current].classList.remove('turning'); }, 380);
    label.textContent = String(current + 1).padStart(2, '0') + ' / 03';
    prev.disabled = current === 0; next.disabled = current === pages.length - 1;
    save.hidden = current !== pages.length - 1;
  }
  prev.addEventListener('click', function () { show(current - 1); });
  next.addEventListener('click', function () { show(current + 1); });
  window.RoseDiary = {
    open:function () {
      document.getElementById('diaryEntryDate').textContent = new Intl.DateTimeFormat('zh-CN', { year:'numeric', month:'long', day:'numeric', timeZone:'Asia/Shanghai' }).format(new Date()) + ' · 写给此刻';
      show(field.value.trim() ? pages.length - 1 : 0);
    }
  };
  show(0);
})();
