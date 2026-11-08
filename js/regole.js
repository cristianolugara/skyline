// Regole del gioco, senza DOM: fasi della partita, controllo della risposta, quale pezzo dello
// skyline sta sotto un punto. Tutto qui è puro (dati in ingresso, dati in uscita) così si prova
// con `node --test` senza browser, e l'interfaccia resta libera di cambiare.

export const FASI = Object.freeze({
  PARTENZA: 'partenza', // solo la linea superiore (o la linea riempita, variante da confrontare)
  AIUTO: 'aiuto',       // linee interne, i dettagli
  RISOLTA: 'risolta',   // disegno a colori, i pezzi diventano cliccabili
});

export const VARIANTI_PARTENZA = Object.freeze(['linea', 'riempita']);

// --- Partita -----------------------------------------------------------------------------------

export function nuovaPartita(variantePartenza = 'linea') {
  return {
    fase: FASI.PARTENZA,
    variantePartenza: VARIANTI_PARTENZA.includes(variantePartenza) ? variantePartenza : 'linea',
    aiutiUsati: 0,
    errori: 0,
    arreso: false,
  };
}

export function cambiaVariantePartenza(stato, variante) {
  if (!VARIANTI_PARTENZA.includes(variante)) return stato;
  return { ...stato, variantePartenza: variante };
}

export function chiediAiuto(stato) {
  if (stato.fase !== FASI.PARTENZA) return stato;
  return { ...stato, fase: FASI.AIUTO, aiutiUsati: stato.aiutiUsati + 1 };
}

// Esito: 'giusta', 'sbagliata', oppure 'vuota' (campo vuoto: non conta come errore, è un tocco
// distratto sul pulsante) o 'chiusa' (partita già risolta).
export function rispondi(stato, citta, testo) {
  if (stato.fase === FASI.RISOLTA) return { stato, esito: 'chiusa' };
  if (normalizza(testo) === '') return { stato, esito: 'vuota' };
  if (rispostaGiusta(citta, testo)) {
    return { stato: { ...stato, fase: FASI.RISOLTA }, esito: 'giusta' };
  }
  return { stato: { ...stato, errori: stato.errori + 1 }, esito: 'sbagliata' };
}

// "Mostra soluzione": porta alla fine ma lo segna, perché il risultato da condividere dovrà
// distinguere chi ha indovinato da chi si è arreso.
export function arrenditi(stato) {
  if (stato.fase === FASI.RISOLTA) return stato;
  return { ...stato, fase: FASI.RISOLTA, arreso: true };
}

// Quale immagine della città mostrare: la chiave dentro `citta.immagini`.
export function immagineDellaFase(stato) {
  if (stato.fase === FASI.PARTENZA) return stato.variantePartenza;
  return stato.fase;
}

export function pezziCliccabili(stato) {
  return stato.fase === FASI.RISOLTA;
}

// --- Risposta ----------------------------------------------------------------------------------

// Toglie maiuscole, accenti, spazi e punteggiatura: "N.Y.", "nuova  york" e "Nuova York" devono
// valere uguale, e sul telefono il correttore aggiunge spazi e maiuscole a caso.
export function normalizza(testo) {
  return String(testo ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function rispostaGiusta(citta, testo) {
  const t = normalizza(testo);
  return t !== '' && citta.risposte.some((r) => normalizza(r) === t);
}

// --- Pezzi dello skyline -----------------------------------------------------------------------
//
// Un "foglio" di zone descrive un'immagine (o più immagini allineate tra loro):
//   profilo: { larghezza, altezza, passo, alto[], basso[] }  generato da scripts/genera-profili.py
//   confini: N+1 linee che separano gli N pezzi, da sinistra a destra
//   pezzi:   N id di monumenti, nell'ordine da sinistra a destra di quell'immagine
// Un confine è un numero (linea verticale a quella x) oppure una spezzata [[x, y], ...] con le y
// crescenti: serve nell'isometrica, dove l'edificio davanti copre in parte quello dietro e il
// confine piega seguendo il suo spigolo. Fuori dai punti dati la linea prosegue in verticale.

export function xDelConfine(confine, y) {
  if (typeof confine === 'number') return confine;
  if (y <= confine[0][1]) return confine[0][0];
  for (let i = 1; i < confine.length; i++) {
    const [x1, y1] = confine[i];
    if (y <= y1) {
      const [x0, y0] = confine[i - 1];
      return y1 === y0 ? x1 : x0 + ((x1 - x0) * (y - y0)) / (y1 - y0);
    }
  }
  return confine[confine.length - 1][0];
}

// Indice del pezzo nella cui striscia cade il punto, senza guardare il profilo.
function striscia(zone, x, y) {
  const { confini } = zone;
  for (let i = 0; i < confini.length - 1; i++) {
    if (x >= xDelConfine(confini[i], y) && x < xDelConfine(confini[i + 1], y)) return i;
  }
  return null;
}

// Il pezzo sotto il punto (coordinate in pixel dell'immagine), o null se il punto è nel cielo,
// sotto il suolo o fuori dall'immagine. La tolleranza (in pixel dell'immagine) allarga il
// disegno in tutte le direzioni: un dito non centra un'antenna larga 4 pixel.
export function pezzoSotto(zone, x, y, tolleranza = 0) {
  const p = zone.profilo;
  if (x < 0 || y < 0 || x >= p.larghezza || y >= p.altezza) return null;
  const da = Math.max(0, Math.floor((x - tolleranza) / p.passo));
  const a = Math.min(p.alto.length - 1, Math.floor((x + tolleranza) / p.passo));
  let alto = Infinity;
  let basso = -Infinity;
  for (let c = da; c <= a; c++) {
    if (p.alto[c] < alto) alto = p.alto[c];
    if (p.basso[c] > basso) basso = p.basso[c];
  }
  if (y < alto - tolleranza || y > basso + tolleranza) return null;
  return striscia(zone, x, y);
}

// Il rettangolo che contiene il pezzo, in pixel dell'immagine: serve per zoomare su un monumento.
// Si campiona una griglia al passo del profilo: è grossolano ma basta per inquadrare.
export function riquadroPezzo(zone, indice) {
  const p = zone.profilo;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let c = 0; c < p.alto.length; c++) {
    if (p.alto[c] > p.basso[c]) continue;
    const x = Math.min(p.larghezza - 1, c * p.passo + p.passo / 2);
    for (let y = p.alto[c]; y <= p.basso[c]; y += p.passo) {
      if (striscia(zone, x, y) !== indice) continue;
      x0 = Math.min(x0, c * p.passo);
      x1 = Math.max(x1, Math.min(p.larghezza, (c + 1) * p.passo));
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, Math.min(p.basso[c] + 1, y + p.passo));
    }
  }
  if (x0 === Infinity) return null;
  return { x: x0, y: y0, larghezza: x1 - x0, altezza: y1 - y0 };
}

// Per ora Alberto vuole solo il numero (07/11/2026: «metti solo 1,2,3 per vedere se va»): la
// posizione da sinistra in quell'immagine. I nomi veri sono già in `citta.monumenti`.
export function etichettaPezzo(zone, indice) {
  return String(indice + 1);
}
