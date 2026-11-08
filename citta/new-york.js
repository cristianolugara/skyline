// New York: risposte accettate, immagini e dove sta ogni monumento in ciascuna immagine.
// I profili (dove finisce il cielo) li calcola scripts/genera-profili.py; i confini tra un
// monumento e l'altro sono fissati a mano guardando le immagini, in pixel dell'immagine originale.
import profili from './new-york-profili.js';

const DISEGNI = [
  'statua-liberta', 'ellis-island', 'wall-street', 'freedom-tower', 'ponte-brooklyn',
  'empire-state', 'palazzo-di-vetro', 'chrysler', 'rockefeller', 'super-slender',
];
// Nel disegno a colori e nell'isometrica Midtown ha un altro ordine da sinistra a destra.
const RENDERING = [
  'statua-liberta', 'ellis-island', 'wall-street', 'freedom-tower', 'ponte-brooklyn',
  'palazzo-di-vetro', 'chrysler', 'empire-state', 'rockefeller', 'super-slender',
];

export default {
  id: 'new-york',
  nome: 'New York',
  risposte: ['New York', 'NY', 'NYC', 'Nuova York', 'New York City'],

  // L'ordine è quello geografico di Alberto (07/11/2026), da sud a nord.
  monumenti: {
    'statua-liberta': 'Statua della Libertà',
    'ellis-island': 'Ellis Island',
    'wall-street': 'Wall Street',
    'freedom-tower': 'Freedom Tower',
    'ponte-brooklyn': 'Ponte di Brooklyn',
    'palazzo-di-vetro': 'Palazzo di Vetro',
    'chrysler': 'Chrysler Building',
    'empire-state': 'Empire State Building',
    'rockefeller': 'Rockefeller Center',
    'super-slender': 'Grattacieli super slender',
  },

  // Le chiavi linea/riempita/aiuto/risolta sono quelle che usa regole.immagineDellaFase.
  // `zone` dice quale foglio di zone vale per l'immagine: i tre disegni di Alberto sono
  // allineati al pixel e ne condividono uno.
  immagini: {
    linea: { file: 'img/new-york/partenza-linea.webp', zone: 'disegni' },
    riempita: { file: 'img/new-york/partenza-riempita.webp', zone: 'disegni' },
    aiuto: { file: 'img/new-york/aiuto.webp', zone: 'disegni' },
    risolta: { file: 'img/new-york/risolta.webp', zone: 'risolta' },
    isometrica: { file: 'img/new-york/isometrica.webp', zone: 'isometrica' },
    // Fatta con Gemini partendo dall'isometrica (08/11/2026). Se cambia, si rigenerano i profili
    // e si ricontrollano i confini del foglio 'isometrica-frontale'.
    'isometrica-frontale': { file: 'img/new-york/isometrica-frontale.webp', zone: 'isometrica-frontale' },
  },

  zone: {
    disegni: {
      profilo: profili.disegni,
      pezzi: DISEGNI,
      confini: [0, 384, 1088, 1392, 1568, 2200, 2488, 2800, 3000, 3240, 3840],
    },
    risolta: {
      profilo: profili.risolta,
      pezzi: RENDERING,
      confini: [0, 344, 896, 1200, 1392, 1800, 2024, 2216, 2464, 2720, 3168],
    },
    isometrica: {
      profilo: profili.isometrica,
      pezzi: RENDERING,
      confini: [
        0,
        [[322, 1300], [470, 1395]],
        [[748, 1040], [790, 1090], [886, 1125]],
        [[1076, 1000], [1108, 1150]],
        1276,
        [[1570, 790], [1612, 800], [1612, 890], [1530, 905], [1580, 1030]],
        [[1746, 875], [1822, 900]],
        1958,
        [[2112, 685], [2165, 700]],
        [[2305, 605], [2332, 620]],
        2752,
      ],
    },
    // Nella frontale gli edifici non si coprono: bastano confini dritti. Il palazzetto accanto
    // al ponte va al ponte e la casetta tra Chrysler ed Empire all'Empire, come nell'isometrica.
    'isometrica-frontale': {
      profilo: profili['isometrica-frontale'],
      pezzi: RENDERING,
      confini: [0, 355, 885, 1185, 1345, 1731, 2000, 2166, 2417, 2640, 3168],
    },
  },
};
