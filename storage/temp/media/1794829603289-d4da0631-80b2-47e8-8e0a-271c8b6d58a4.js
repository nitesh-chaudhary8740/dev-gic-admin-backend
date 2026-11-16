document.addEventListener('DOMContentLoaded', () => {
  const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];

  // font size controls
  let fs = 100;
  const setFs = (v) => { fs = v; document.documentElement.style.fontSize = fs * 0.15 + 'px'; };
  $('#fInc').onclick = () => setFs(Math.min(fs + 10, 130));
  $('#fDef').onclick = () => setFs(100);
  $('#fDec').onclick = () => setFs(Math.max(fs - 10, 80));

  // read page aloud
  $('#tts').onclick = () => {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    speechSynthesis.speak(new SpeechSynthesisUtterance($('main').innerText.slice(0, 2000)));
  };

  // mobile menu
  $('.menu-btn').onclick = () => $('.nav').classList.toggle('open');

  // hero slider
  const sl = $$('.hero .s'); let i = 0, play = true;
  const show = (n) => { sl[i].classList.remove('on'); i = (n + sl.length) % sl.length; sl[i].classList.add('on'); };
  $('.hero .p').onclick = () => show(i - 1);
  $('.hero .n').onclick = () => show(i + 1);
  const pp = $('.hero .pp');
  pp.onclick = () => { play = !play; pp.textContent = play ? 'Pause' : 'Play'; };
  setInterval(() => play && show(i + 1), 4500);

  // latest news ticker (duplicate list for a seamless loop)
  const ul = $('.tk ul');
  ul.innerHTML += ul.innerHTML;
  ul.style.animationDuration = ul.children.length * 3 + 's';

  // popup
  $('#popX').onclick = () => $('#pop').remove();
});
