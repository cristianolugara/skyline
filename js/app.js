// Interfaccia: collega le regole (regole.js) e il visore (visore.js) alle due schermate,
// lo skyline da indovinare e l'isometrica. Per ora c'è solo New York.
import citta from '../citta/new-york.js';
import * as R from './regole.js';
import { creaVisore } from './visore.js';

const $ = (sel) => document.querySelector(sel);

function zoneDi(chiave) {
  const im = citta.immagini[chiave];
  return (im && citta.zone[im.zone]) || null;
}

// Collega il visore ai pezzi dell'immagine mostrata in quel momento. `attivo` permette di
// spegnere i pezzi prima della soluzione: il numero (domani il nome) svelerebbe la città.
function pezziDi(chiaveMostrata, attivo = () => true) {
  return {
    trovaPezzo(x, y, tolleranza) {
      const zone = zoneDi(chiaveMostrata());
      if (!zone || !attivo()) return null;
      const i = R.pezzoSotto(zone, x, y, tolleranza);
      return i === null ? null : { indice: i, etichetta: R.etichettaPezzo(zone, i) };
    },
    riquadroPezzo(i) {
      const zone = zoneDi(chiaveMostrata());
      return zone && attivo() ? R.riquadroPezzo(zone, i) : null;
    },
  };
}

function precarica(...chiavi) {
  for (const k of chiavi) new Image().src = citta.immagini[k].file;
}

// --- Schermata di gioco ------------------------------------------------------------------------

let stato = R.nuovaPartita();
let chiaveGioco = null;
const messaggio = $('#messaggio');
const campo = $('#campo');
const visoreGioco = creaVisore($('#visore-gioco'), pezziDi(() => chiaveGioco, () => R.pezziCliccabili(stato)));

async function mostraFase(dissolvenza) {
  const chiave = R.immagineDellaFase(stato);
  if (chiave === chiaveGioco) return;
  chiaveGioco = chiave;
  const alt = R.pezziCliccabili(stato) ? `Skyline di ${citta.nome}` : 'Skyline da riconoscere';
  try {
    await visoreGioco.mostra(citta.immagini[chiave].file, { dissolvenza, alt });
  } catch {
    messaggio.textContent = `Immagine non trovata: ${citta.immagini[chiave].file}`;
  }
}

function aggiornaComandi() {
  const risolta = R.pezziCliccabili(stato);
  $('#risposta').hidden = risolta;
  $('#aiuto').hidden = risolta;
  $('#aiuto').disabled = stato.fase !== R.FASI.PARTENZA;
  $('#aiuto').textContent = stato.fase === R.FASI.PARTENZA ? 'Aiuto' : 'Aiuto usato';
  $('#vai-isometrica').hidden = !risolta;
  $('#ricomincia').hidden = !risolta;
  $('#soluzione').disabled = risolta;
  for (const b of document.querySelectorAll('[data-variante]')) {
    b.setAttribute('aria-pressed', String(b.dataset.variante === stato.variantePartenza));
  }
}

function aggiorna(dissolvenza = 0) {
  aggiornaComandi();
  return mostraFase(dissolvenza);
}

function risolta() {
  campo.blur();
  messaggio.textContent = stato.arreso
    ? `Era ${citta.nome}. Tocca un monumento per vedere il suo numero.`
    : `Giusto, è ${citta.nome}! Tocca un monumento per vedere il suo numero.`;
  precarica('isometrica');
  return aggiorna(1000);
}

$('#risposta').addEventListener('submit', (e) => {
  e.preventDefault();
  const testo = campo.value;
  const esito = R.rispondi(stato, citta, testo);
  stato = esito.stato;
  if (esito.esito === 'giusta') {
    risolta();
  } else if (esito.esito === 'sbagliata') {
    messaggio.textContent = `Non è «${testo.trim()}». Riprova.`;
    const form = $('#risposta');
    form.classList.remove('scuoti');
    void form.offsetWidth;
    form.classList.add('scuoti');
    navigator.vibrate?.(80);
    campo.value = '';
    campo.focus();
  } else if (esito.esito === 'vuota') {
    campo.focus();
  }
});

// Il bordo rosso dell'errore resta finché non si ricomincia a scrivere.
campo.addEventListener('input', () => $('#risposta').classList.remove('scuoti'));

$('#aiuto').addEventListener('click', () => {
  stato = R.chiediAiuto(stato);
  messaggio.textContent = 'Ecco i dettagli. Che città è?';
  aggiorna(700);
});

$('#soluzione').addEventListener('click', () => {
  stato = R.arrenditi(stato);
  risolta();
});

$('#ricomincia').addEventListener('click', () => {
  stato = R.nuovaPartita(stato.variantePartenza);
  campo.value = '';
  messaggio.textContent = 'Pizzica o usa la rotella per ingrandire.';
  aggiorna(500);
});

// Serve ad Alberto per scegliere tra le due partenze: da qualunque fase riporta all'inizio con
// quella variante, così il confronto si fa con due tocchi.
for (const b of document.querySelectorAll('[data-variante]')) {
  b.addEventListener('click', () => {
    if (stato.fase === R.FASI.PARTENZA) {
      stato = R.cambiaVariantePartenza(stato, b.dataset.variante);
    } else {
      stato = R.nuovaPartita(b.dataset.variante);
      campo.value = '';
      messaggio.textContent = 'Pizzica o usa la rotella per ingrandire.';
    }
    aggiorna(400);
  });
}

// --- Schermata isometrica ----------------------------------------------------------------------

let vistaIso = 'isometrica';
let vistaMostrata = null;
let visoreIso = null;

async function mostraIsometrica() {
  // Il visore nasce alla prima apertura: da nascosto non avrebbe misure su cui adattarsi.
  visoreIso ??= creaVisore($('#visore-iso'), pezziDi(() => vistaIso));
  for (const b of document.querySelectorAll('[data-vista]')) {
    b.setAttribute('aria-pressed', String(b.dataset.vista === vistaIso));
  }
  const avviso = $('#messaggio-iso');
  avviso.textContent = zoneDi(vistaIso)
    ? 'Tocca un monumento per il suo numero. Doppio tocco per ingrandirlo.'
    : 'Pizzica o usa la rotella per ingrandire. In questa vista i monumenti non sono ancora segnati.';
  if (vistaIso === vistaMostrata) return;
  vistaMostrata = vistaIso;
  const { file } = citta.immagini[vistaIso];
  try {
    await visoreIso.mostra(file, { dissolvenza: 400, alt: `${citta.nome}, vista ${vistaIso.replace('-', ' ')}` });
  } catch {
    vistaMostrata = null;
    avviso.textContent = `Immagine non trovata: ${file}`;
  }
}

for (const b of document.querySelectorAll('[data-vista]')) {
  b.addEventListener('click', () => {
    vistaIso = b.dataset.vista;
    mostraIsometrica();
  });
}

// La vista frontale la manda Alberto più avanti: il pulsante si accende da solo quando il file c'è.
{
  const prova = new Image();
  prova.onload = () => {
    const b = $('[data-vista="isometrica-frontale"]');
    b.disabled = false;
    b.removeAttribute('title');
    b.querySelector('small')?.remove();
  };
  prova.src = citta.immagini['isometrica-frontale'].file;
}

// --- Navigazione -------------------------------------------------------------------------------

function instrada() {
  const iso = location.hash === '#isometrica';
  $('#gioco').hidden = iso;
  $('#isometrica').hidden = !iso;
  $('#titolo-isometrica').textContent = citta.nome;
  window.scrollTo(0, 0);
  if (iso) mostraIsometrica();
}

addEventListener('hashchange', instrada);
instrada();
aggiorna().then(() => precarica('riempita', 'aiuto', 'risolta'));
