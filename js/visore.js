// Visore: un'immagine adattata al riquadro, con zoom (pinch, rotella, doppio tocco) e
// spostamento trascinando, più un fumetto ancorato a un punto dell'immagine che segue lo zoom.
// Non sa niente del gioco: chi lo usa gli dice, con `trovaPezzo` e `riquadroPezzo`, cosa c'è
// sotto un punto.
//
// Lo zoom cambia le dimensioni dell'<img> (width/height) invece di usare transform: scale(),
// perché con scale() il browser può ridisegnare l'immagine dalla versione piccola e allora
// ingrandendo sgrana, che è proprio ciò che Alberto non vuole sull'isometrica.

const SOGLIA_TRASCINAMENTO = 8; // px: sotto questa distanza un tocco resta un tocco
const DOPPIO_TOCCO_MS = 320;
const DOPPIO_TOCCO_PX = 30;
const TOLLERANZA_DITO = 10; // px di schermo intorno al dito che contano ancora sul pezzo
const ZOOM_MINIMO_GARANTITO = 2; // Alberto: almeno 2x anche se l'immagine è piccola

export function creaVisore(radice, opzioni = {}) {
  const {
    trovaPezzo = () => null,     // (x, y, tolleranza) in pixel immagine → { indice, etichetta } | null
    riquadroPezzo = () => null,  // (indice) → { x, y, larghezza, altezza } in pixel immagine
  } = opzioni;

  radice.classList.add('visore');
  const strato = document.createElement('div');
  strato.className = 'visore-immagini';
  const tag = document.createElement('div');
  tag.className = 'tag';
  tag.hidden = true;
  tag.setAttribute('role', 'status');
  const intera = document.createElement('button');
  intera.type = 'button';
  intera.className = 'visore-intera';
  intera.textContent = 'Vista intera';
  intera.hidden = true;
  radice.append(strato, tag, intera);

  let corrente = null; // { el, w, h }
  let s = 1, tx = 0, ty = 0; // pixel di schermo per pixel d'immagine, e posizione dell'angolo in alto a sinistra
  let ancora = null; // { x, y } del fumetto, in pixel immagine
  let animazione = 0;

  const misure = () => ({ cw: radice.clientWidth, ch: radice.clientHeight });

  function scalaAdattata() {
    const { cw, ch } = misure();
    return corrente ? Math.min(cw / corrente.w, ch / corrente.h) : 1;
  }

  // Lo zoom si ferma quando un pixel dell'immagine diventa un pixel fisico dello schermo:
  // oltre si vedrebbero i quadretti. Ma almeno 2x, anche sui telefoni con schermo denso.
  function scalaMassima() {
    const adattata = scalaAdattata();
    return Math.max(1 / (window.devicePixelRatio || 1), adattata * ZOOM_MINIMO_GARANTITO);
  }

  function limita(vs, vx, vy) {
    const { cw, ch } = misure();
    vs = Math.min(scalaMassima(), Math.max(scalaAdattata(), vs));
    const lw = corrente.w * vs, lh = corrente.h * vs;
    vx = lw <= cw ? (cw - lw) / 2 : Math.min(0, Math.max(cw - lw, vx));
    vy = lh <= ch ? (ch - lh) / 2 : Math.min(0, Math.max(ch - lh, vy));
    return [vs, vx, vy];
  }

  function applica() {
    // Da nascosto il riquadro misura zero: si aspetta che torni visibile (ci pensa il ResizeObserver).
    if (!corrente || radice.clientWidth === 0) return;
    [s, tx, ty] = limita(s, tx, ty);
    const st = corrente.el.style;
    st.width = `${corrente.w * s}px`;
    st.height = `${corrente.h * s}px`;
    st.transform = `translate(${tx}px, ${ty}px)`;
    intera.hidden = s <= scalaAdattata() * 1.01;
    posizionaTag();
  }

  function posizionaTag() {
    if (!ancora) return;
    const x = tx + ancora.x * s, y = ty + ancora.y * s;
    tag.style.left = `${x}px`;
    tag.style.top = `${y}px`;
    // Vicino al bordo alto il fumetto finirebbe fuori: lo si gira sotto il punto.
    tag.classList.toggle('sotto', y < 48);
  }

  function apriTag(x, y, testo) {
    ancora = { x, y };
    tag.textContent = testo;
    tag.hidden = false;
    // Riavvia l'animazione anche se il fumetto era già aperto su un altro pezzo.
    tag.classList.remove('compare');
    void tag.offsetWidth;
    tag.classList.add('compare');
    posizionaTag();
  }

  function chiudiTag() {
    ancora = null;
    tag.hidden = true;
  }

  function vaiA(vs, vx, vy, durata = 280) {
    cancelAnimationFrame(animazione);
    const [s1, x1, y1] = limita(vs, vx, vy);
    if (durata <= 0 || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      s = s1; tx = x1; ty = y1; applica();
      return;
    }
    // Si interpola il punto dell'immagine al centro dello schermo, non la traslazione: così
    // lo zoom va dritto verso il bersaglio invece di fare una curva.
    const { cw, ch } = misure();
    const s0 = s, c0 = [(cw / 2 - tx) / s, (ch / 2 - ty) / s], c1 = [(cw / 2 - x1) / s1, (ch / 2 - y1) / s1];
    const t0 = performance.now();
    const passo = (ora) => {
      const k = Math.min(1, (ora - t0) / durata);
      const e = 1 - (1 - k) ** 3;
      s = s0 * (s1 / s0) ** e;
      tx = cw / 2 - (c0[0] + (c1[0] - c0[0]) * e) * s;
      ty = ch / 2 - (c0[1] + (c1[1] - c0[1]) * e) * s;
      applica();
      if (k < 1) animazione = requestAnimationFrame(passo);
    };
    animazione = requestAnimationFrame(passo);
  }

  function zoomAttorno(px, py, nuovaS) {
    const ix = (px - tx) / s, iy = (py - ty) / s;
    s = Math.min(scalaMassima(), Math.max(scalaAdattata(), nuovaS));
    tx = px - ix * s;
    ty = py - iy * s;
    applica();
  }

  function vistaIntera(durata = 280) {
    vaiA(scalaAdattata(), 0, 0, durata);
  }

  function zoomSuRiquadro(r) {
    const { cw, ch } = misure();
    const vs = Math.min((cw * 0.8) / r.larghezza, (ch * 0.8) / r.altezza);
    const [s1] = limita(vs, 0, 0);
    vaiA(s1, cw / 2 - (r.x + r.larghezza / 2) * s1, ch / 2 - (r.y + r.altezza / 2) * s1);
  }

  // --- Immagini --------------------------------------------------------------------------------

  // I colori del bordo alto e basso dell'immagine diventano il fondo del riquadro, sfumato
  // dall'uno all'altro: la carta del disegno a colori non è bianca (e in basso è più scura),
  // l'isometrica è color pesca, e senza questo i margini attorno all'immagine si vedrebbero.
  function fondoDi(el) {
    try {
      const c = document.createElement('canvas');
      c.width = 32; c.height = 1;
      const g = c.getContext('2d', { willReadFrequently: true });
      const w = el.naturalWidth, h = el.naturalHeight;
      // Solo le due righe di pixel sul bordo: una striscia più alta prenderebbe le cime dei palazzi.
      const riga = (y) => {
        g.clearRect(0, 0, c.width, 1);
        g.drawImage(el, 0, y, w, 2, 0, 0, c.width, 1);
        const d = g.getImageData(0, 0, c.width, 1).data;
        const m = [0, 0, 0];
        for (let i = 0; i < d.length; i += 4) { m[0] += d[i]; m[1] += d[i + 1]; m[2] += d[i + 2]; }
        return `rgb(${m.map((v) => Math.round(v / c.width)).join(',')})`;
      };
      return `linear-gradient(${riga(0)}, ${riga(h - 2)})`;
    } catch {
      return ''; // canvas non leggibile: resta il fondo del CSS
    }
  }

  // Mostra un'immagine con dissolvenza sopra la precedente. Se ha le stesse misure (i disegni di
  // Alberto sono allineati) si tiene lo zoom: l'aiuto compare proprio dove si stava guardando.
  let richiesta = 0;
  async function mostra(src, { dissolvenza = 0, alt = '' } = {}) {
    const questa = ++richiesta;
    const el = new Image();
    el.src = src;
    el.alt = alt;
    el.draggable = false;
    await el.decode();
    // Due cambi di fila (Aiuto e subito Mostra soluzione): vince l'ultimo chiesto, non
    // l'ultimo che finisce di caricarsi.
    if (questa !== richiesta) return;
    const w = el.naturalWidth, h = el.naturalHeight;
    const stesseMisure = corrente && corrente.w === w && corrente.h === h;
    const vecchio = corrente;
    chiudiTag();
    corrente = { el, w, h };
    if (!stesseMisure) { s = 0; tx = 0; ty = 0; } // limita() porta alla vista intera
    radice.style.backgroundImage = fondoDi(el);
    el.style.opacity = vecchio && dissolvenza ? '0' : '1';
    el.style.transition = `opacity ${dissolvenza}ms ease`;
    strato.append(el);
    applica();
    if (vecchio && dissolvenza) {
      void el.offsetWidth;
      el.style.opacity = '1';
      await new Promise((ok) => setTimeout(ok, dissolvenza));
    }
    // Toglie tutto ciò che sta sotto: anche le immagini di una dissolvenza interrotta a metà.
    // Se nel frattempo è arrivata un'altra immagine, la pulizia tocca a lei.
    if (!el.isConnected) return;
    while (strato.firstChild && strato.firstChild !== el) strato.firstChild.remove();
  }

  // --- Gesti -----------------------------------------------------------------------------------

  const dita = new Map(); // pointerId → { x, y }
  let gesto = null;       // stato del gesto in corso
  let ultimoTocco = null; // { t, x, y } per riconoscere il doppio tocco

  const locale = (e) => {
    const r = radice.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function iniziaGesto() {
    const punti = [...dita.values()];
    if (punti.length === 1) {
      gesto = { tipo: 'uno', x0: punti[0].x, y0: punti[0].y, tx0: tx, ty0: ty, mosso: gesto?.multi ?? false, multi: gesto?.multi ?? false };
    } else if (punti.length >= 2) {
      const [a, b] = punti;
      gesto = {
        tipo: 'due', multi: true, mosso: true,
        d0: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, s0: s, tx0: tx, ty0: ty,
      };
    }
  }

  radice.addEventListener('pointerdown', (e) => {
    if (!corrente || e.target === intera) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    cancelAnimationFrame(animazione);
    radice.setPointerCapture(e.pointerId);
    if (dita.size === 0) gesto = null;
    dita.set(e.pointerId, locale(e));
    iniziaGesto();
  });

  radice.addEventListener('pointermove', (e) => {
    if (!dita.has(e.pointerId) || !gesto) return;
    dita.set(e.pointerId, locale(e));
    const punti = [...dita.values()];
    if (gesto.tipo === 'due' && punti.length >= 2) {
      const [a, b] = punti;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      // Il punto dell'immagine che stava tra le dita all'inizio resta tra le dita.
      const ix = (gesto.mx - gesto.tx0) / gesto.s0, iy = (gesto.my - gesto.ty0) / gesto.s0;
      s = Math.min(scalaMassima(), Math.max(scalaAdattata(), gesto.s0 * (d / gesto.d0)));
      tx = mx - ix * s;
      ty = my - iy * s;
      applica();
    } else if (gesto.tipo === 'uno') {
      const p = punti[0];
      if (!gesto.mosso && Math.hypot(p.x - gesto.x0, p.y - gesto.y0) > SOGLIA_TRASCINAMENTO) gesto.mosso = true;
      if (gesto.mosso) {
        tx = gesto.tx0 + (p.x - gesto.x0);
        ty = gesto.ty0 + (p.y - gesto.y0);
        applica();
      }
    }
  });

  function fine(e, annullato) {
    if (!dita.has(e.pointerId)) return;
    const p = dita.get(e.pointerId);
    dita.delete(e.pointerId);
    if (dita.size > 0) {
      // Da due dita a una: si riparte da qui, altrimenti l'immagine salterebbe.
      iniziaGesto();
      return;
    }
    const eraTocco = gesto && gesto.tipo === 'uno' && !gesto.mosso && !gesto.multi && !annullato;
    gesto = null;
    if (eraTocco) tocco(p.x, p.y);
  }
  radice.addEventListener('pointerup', (e) => fine(e, false));
  radice.addEventListener('pointercancel', (e) => fine(e, true));

  function tocco(px, py) {
    const ix = (px - tx) / s, iy = (py - ty) / s;
    const ora = performance.now();
    const doppio = ultimoTocco && ora - ultimoTocco.t < DOPPIO_TOCCO_MS &&
      Math.hypot(px - ultimoTocco.x, py - ultimoTocco.y) < DOPPIO_TOCCO_PX;
    ultimoTocco = doppio ? null : { t: ora, x: px, y: py };
    const pezzo = trovaPezzo(ix, iy, TOLLERANZA_DITO / s);

    if (!doppio) {
      // Un tocco sul pezzo apre il fumetto lì (chiudendo il precedente); fuori lo chiude.
      if (pezzo) apriTag(ix, iy, pezzo.etichetta);
      else chiudiTag();
      return;
    }
    // Doppio tocco: su un monumento lo inquadra; altrove ingrandisce lì, o torna alla vista intera.
    const r = pezzo && riquadroPezzo(pezzo.indice);
    if (r) zoomSuRiquadro(r);
    else if (s > scalaAdattata() * 1.05) vistaIntera();
    else {
      const s1 = Math.min(scalaMassima(), s * 2.5);
      vaiA(s1, px - ix * s1, py - iy * s1);
    }
  }

  radice.addEventListener('wheel', (e) => {
    if (!corrente) return;
    e.preventDefault();
    cancelAnimationFrame(animazione);
    const p = locale(e);
    // deltaMode 1 = righe (Firefox con la rotella): una riga vale circa 16 pixel.
    const delta = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
    // Il pinch sul trackpad arriva come rotella con ctrlKey e delta piccoli: va accelerato.
    zoomAttorno(p.x, p.y, s * Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.0015)));
  }, { passive: false });

  intera.addEventListener('click', () => vistaIntera());

  new ResizeObserver(() => {
    if (!corrente) return;
    const eraIntera = intera.hidden;
    if (eraIntera) s = 0;
    applica();
  }).observe(radice);

  return { mostra, vistaIntera };
}
