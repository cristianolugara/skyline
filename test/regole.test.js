import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FASI, nuovaPartita, cambiaVariantePartenza, chiediAiuto, rispondi, arrenditi,
  immagineDellaFase, pezziCliccabili, normalizza, rispostaGiusta,
  xDelConfine, pezzoSotto, riquadroPezzo, etichettaPezzo,
} from '../js/regole.js';
import newYork from '../citta/new-york.js';

// --- Risposta ----------------------------------------------------------------------------------

test('normalizza toglie maiuscole, accenti, spazi e punteggiatura', () => {
  assert.equal(normalizza('  Nuova  York '), 'nuovayork');
  assert.equal(normalizza('N.Y.'), 'ny');
  assert.equal(normalizza('Nùova Yòrk'), 'nuovayork');
  assert.equal(normalizza(null), '');
});

test('New York si riconosce in tutte le forme richieste da Alberto', () => {
  for (const r of ['New York', 'new york', 'NEWYORK', 'NY', 'n.y.', 'Nuova York', 'nuova york', 'NYC', 'nyc', ' New  York City ']) {
    assert.ok(rispostaGiusta(newYork, r), r);
  }
});

test('le risposte sbagliate o vuote non passano', () => {
  for (const r of ['', '   ', 'York', 'New Jersey', 'Newark', 'New York York', 'Boston']) {
    assert.ok(!rispostaGiusta(newYork, r), r);
  }
});

// --- Fasi --------------------------------------------------------------------------------------

test('una partita parte dalla sola linea, senza pezzi cliccabili', () => {
  const s = nuovaPartita();
  assert.equal(s.fase, FASI.PARTENZA);
  assert.equal(immagineDellaFase(s), 'linea');
  assert.equal(pezziCliccabili(s), false);
});

test('la variante di partenza cambia solo l\'immagine di partenza', () => {
  const s = cambiaVariantePartenza(nuovaPartita(), 'riempita');
  assert.equal(immagineDellaFase(s), 'riempita');
  assert.equal(cambiaVariantePartenza(s, 'boh'), s);
  assert.equal(immagineDellaFase(chiediAiuto(s)), 'aiuto');
});

test('l\'aiuto passa ai dettagli una volta sola', () => {
  const s = chiediAiuto(nuovaPartita());
  assert.equal(s.fase, FASI.AIUTO);
  assert.equal(s.aiutiUsati, 1);
  assert.equal(chiediAiuto(s), s);
});

test('una risposta sbagliata conta un errore e lascia la fase com\'è', () => {
  const { stato, esito } = rispondi(chiediAiuto(nuovaPartita()), newYork, 'Chicago');
  assert.equal(esito, 'sbagliata');
  assert.equal(stato.fase, FASI.AIUTO);
  assert.equal(stato.errori, 1);
});

test('il campo vuoto non è un errore', () => {
  const s = nuovaPartita();
  const r = rispondi(s, newYork, '  ');
  assert.equal(r.esito, 'vuota');
  assert.equal(r.stato, s);
});

test('la risposta giusta risolve, da qualunque fase, e accende i pezzi', () => {
  for (const s of [nuovaPartita(), chiediAiuto(nuovaPartita())]) {
    const { stato, esito } = rispondi(s, newYork, 'nyc');
    assert.equal(esito, 'giusta');
    assert.equal(stato.fase, FASI.RISOLTA);
    assert.equal(stato.arreso, false);
    assert.equal(immagineDellaFase(stato), 'risolta');
    assert.equal(pezziCliccabili(stato), true);
    assert.equal(rispondi(stato, newYork, 'Roma').esito, 'chiusa');
  }
});

test('mostra soluzione risolve ma segna che il giocatore si è arreso', () => {
  const s = arrenditi(nuovaPartita());
  assert.equal(s.fase, FASI.RISOLTA);
  assert.equal(s.arreso, true);
  assert.equal(arrenditi(s), s);
});

// --- Pezzi: dati finti, per vedere le regole una per una ---------------------------------------

// Due edifici larghi 40 pixel: il primo alto fino a y=20, il secondo fino a y=60; il suolo è a y=90.
const finte = {
  profilo: {
    larghezza: 80, altezza: 100, passo: 10,
    alto: [20, 20, 20, 20, 60, 60, 60, 60],
    basso: [90, 90, 90, 90, 90, 90, 90, 90],
  },
  confini: [0, 40, 80],
  pezzi: ['a', 'b'],
};

test('un punto sotto il profilo cade sul pezzo della sua striscia', () => {
  assert.equal(pezzoSotto(finte, 10, 50), 0);
  assert.equal(pezzoSotto(finte, 70, 70), 1);
  assert.equal(etichettaPezzo(finte, 1), '2');
});

test('il cielo sopra un edificio, il suolo sotto e il fuori immagine non sono pezzi', () => {
  assert.equal(pezzoSotto(finte, 70, 30), null);
  assert.equal(pezzoSotto(finte, 10, 95), null);
  assert.equal(pezzoSotto(finte, -1, 50), null);
  assert.equal(pezzoSotto(finte, 80, 50), null);
});

test('la tolleranza allarga il disegno: in alto e di lato', () => {
  assert.equal(pezzoSotto(finte, 70, 55), null);
  assert.equal(pezzoSotto(finte, 70, 55, 6), 1);
  // A 45 il cielo comincia a 60, ma a 5 pixel di distanza c'è l'edificio alto fino a 20.
  assert.equal(pezzoSotto(finte, 45, 30), null);
  assert.equal(pezzoSotto(finte, 45, 30, 6), 1);
});

test('un confine a spezzata piega seguendo lo spigolo dell\'edificio davanti', () => {
  const spezzata = [[40, 50], [60, 70]];
  assert.equal(xDelConfine(spezzata, 0), 40);
  assert.equal(xDelConfine(spezzata, 60), 50);
  assert.equal(xDelConfine(spezzata, 99), 60);
  const z = { ...finte, confini: [0, spezzata, 80] };
  // A y=62 il confine è a x=52: il punto a 45 è ancora del primo edificio, quello a 58 no.
  assert.equal(pezzoSotto(z, 45, 62), 0);
  assert.equal(pezzoSotto(z, 58, 62), 1);
  assert.equal(pezzoSotto(finte, 45, 62), 1);
});

test('il riquadro di un pezzo lo contiene tutto', () => {
  assert.deepEqual(riquadroPezzo(finte, 0), { x: 0, y: 20, larghezza: 40, altezza: 71 });
  assert.equal(riquadroPezzo({ ...finte, confini: [0, 40, 80, 90], pezzi: ['a', 'b', 'c'] }, 2), null);
});

// --- Pezzi: i dati veri di New York ------------------------------------------------------------

test('i fogli di New York sono coerenti', () => {
  for (const [nome, z] of Object.entries(newYork.zone)) {
    assert.equal(z.confini.length, z.pezzi.length + 1, nome);
    assert.equal(z.pezzi.length, 10, nome);
    assert.equal(z.profilo.alto.length, Math.ceil(z.profilo.larghezza / z.profilo.passo), nome);
    for (const id of z.pezzi) assert.ok(id in newYork.monumenti, `${nome}: ${id}`);
    assert.equal(new Set(z.pezzi).size, 10, `${nome}: monumenti ripetuti`);
    // I confini non si incrociano: da sinistra a destra a ogni altezza.
    for (let y = 0; y < z.profilo.altezza; y += 16) {
      for (let i = 1; i < z.confini.length; i++) {
        assert.ok(xDelConfine(z.confini[i - 1], y) < xDelConfine(z.confini[i], y), `${nome}: confine ${i} a y=${y}`);
      }
    }
    z.pezzi.forEach((id, i) => assert.ok(riquadroPezzo(z, i), `${nome}: ${id} senza area`));
  }
  for (const [chiave, im] of Object.entries(newYork.immagini)) {
    if (chiave !== 'isometrica-frontale') assert.ok(im.zone in newYork.zone, chiave);
  }
});

// Punti presi a occhio sulle immagini: se cambiano disegni o confini e uno salta, va ricontrollato.
test('punti noti sui disegni di Alberto', () => {
  const z = newYork.zone.disegni;
  const nome = (x, y) => { const i = pezzoSotto(z, x, y); return i === null ? null : z.pezzi[i]; };
  assert.equal(nome(225, 1200), 'statua-liberta');
  assert.equal(nome(1493, 600), 'freedom-tower');
  assert.equal(nome(1493, 200), null); // cielo sopra l'antenna
  assert.equal(nome(1790, 1200), 'ponte-brooklyn');
  assert.equal(nome(2335, 900), 'empire-state');
  assert.equal(nome(2630, 1300), 'palazzo-di-vetro');
  assert.equal(nome(2630, 1000), null); // cielo sopra il Palazzo di Vetro
  assert.equal(nome(3550, 700), 'super-slender');
  assert.equal(nome(1900, 1480), null); // sotto il suolo
});

test('punti noti sul disegno a colori', () => {
  const z = newYork.zone.risolta;
  const nome = (x, y) => { const i = pezzoSotto(z, x, y); return i === null ? null : z.pezzi[i]; };
  assert.equal(nome(230, 800), 'statua-liberta');
  assert.equal(nome(1300, 600), 'freedom-tower');
  assert.equal(nome(1300, 60), null);
  assert.equal(nome(1900, 900), 'palazzo-di-vetro');
  assert.equal(nome(2130, 900), 'chrysler');
  assert.equal(nome(2340, 700), 'empire-state');
  assert.equal(nome(2340, 150), null);
});

test('punti noti sull\'isometrica', () => {
  const z = newYork.zone.isometrica;
  const nome = (x, y) => { const i = pezzoSotto(z, x, y); return i === null ? null : z.pezzi[i]; };
  assert.equal(nome(270, 1100), 'statua-liberta');
  assert.equal(nome(600, 1250), 'ellis-island');
  assert.equal(nome(1000, 700), 'wall-street');
  assert.equal(nome(1170, 600), 'freedom-tower');
  assert.equal(nome(1430, 900), 'ponte-brooklyn');
  assert.equal(nome(1650, 700), 'palazzo-di-vetro');
  assert.equal(nome(2050, 400), 'empire-state');
  assert.equal(nome(2350, 300), 'super-slender');
  assert.equal(nome(500, 400), null); // sfondo
});
