"""Ricava dalle immagini di una città il profilo degli edifici e lo scrive in citta/<citta>-profili.js.

Il profilo dice, per ogni striscia verticale dell'immagine, dove comincia il disegno in alto e
dove finisce in basso. Serve al gioco per capire se un tocco cade su un edificio o nel cielo:
i confini tra un monumento e l'altro invece si fissano a mano in citta/<citta>.js, perché
nessuna regola automatica sa dove finisce Ellis Island e comincia Wall Street.

    python scripts/genera-profili.py            # tutte le città configurate qui sotto
    python scripts/genera-profili.py new-york

Va rilanciato ogni volta che cambia un'immagine in img/<citta>/. Richiede Pillow, numpy e scipy.
"""

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

RADICE = Path(__file__).resolve().parent.parent

# Ogni città ha più "fogli": immagini che condividono le stesse zone. I tre disegni di Alberto
# sono allineati al pixel, quindi fanno un foglio solo e il profilo è l'unione dei tre (la sola
# linea, da sola, non dice dov'è il suolo sotto gli edifici).
CITTA = {
    "new-york": {
        "disegni": {"file": ["partenza-linea.webp", "partenza-riempita.webp", "aiuto.webp"], "modo": "inchiostro"},
        "risolta": {"file": ["risolta.webp"], "modo": "inchiostro"},
        "isometrica": {"file": ["isometrica.webp"], "modo": "sfondo"},
        "isometrica-frontale": {"file": ["isometrica-frontale.webp"], "modo": "sfondo"},
    },
}

# Campionare ogni 8 pixel tiene il file piccolo (qualche KB) e resta più fine del dito: a
# schermo intero sul telefono 8 pixel dell'immagine sono meno di un pixel.
PASSO = 8


def maschera_inchiostro(im: Image.Image) -> np.ndarray:
    grigio = np.asarray(im.convert("L"))
    nero = grigio < 160
    # Toglie i puntini isolati (polvere della scansione, sbavature dell'IA) che altrimenti
    # renderebbero cliccabile un pezzo di cielo. Le antenne sono sottili ma attaccate al
    # loro edificio, quindi restano.
    return togli_piccoli(nero, 40)


def maschera_sfondo(im: Image.Image) -> np.ndarray:
    rgb = np.asarray(im.convert("RGB")).astype(float)
    bordo = np.concatenate([rgb[:20].reshape(-1, 3), rgb[-20:].reshape(-1, 3),
                            rgb[:, :20].reshape(-1, 3), rgb[:, -20:].reshape(-1, 3)])
    fondo = np.median(bordo, axis=0)
    # Le ombre sullo sfondo sono lo stesso colore, solo più scuro: si confronta la tinta
    # (scarto dalla retta fondo*k) e non la distanza dal colore, che le prenderebbe per edifici.
    k = (rgb @ fondo) / (fondo @ fondo)
    scarto = np.sqrt(((rgb - k[..., None] * fondo) ** 2).sum(axis=2))
    pieno = (scarto > 10) | (k < 0.80)
    pieno = ndi.binary_opening(pieno, iterations=2)
    return togli_piccoli(pieno, 2000)


def togli_piccoli(maschera: np.ndarray, area_minima: int) -> np.ndarray:
    etichette, n = ndi.label(maschera, structure=np.ones((3, 3)))
    if n == 0:
        return maschera
    aree = ndi.sum(maschera, etichette, range(1, n + 1))
    grandi = np.flatnonzero(aree >= area_minima) + 1
    return np.isin(etichette, grandi)


def profilo(maschera: np.ndarray) -> dict:
    altezza, larghezza = maschera.shape
    colonne_piene = maschera.any(axis=0)
    alto = np.where(colonne_piene, maschera.argmax(axis=0), altezza)
    basso = np.where(colonne_piene, altezza - 1 - maschera[::-1].argmax(axis=0), -1)
    # Per ogni gruppo di colonne vale la più alta: così una guglia sottile resta cliccabile
    # anche se il campione cade di fianco.
    n = -(-larghezza // PASSO)
    alto_c = [int(alto[i * PASSO:(i + 1) * PASSO].min()) for i in range(n)]
    basso_c = [int(basso[i * PASSO:(i + 1) * PASSO].max()) for i in range(n)]
    return {"larghezza": larghezza, "altezza": altezza, "passo": PASSO, "alto": alto_c, "basso": basso_c}


def genera(citta: str) -> None:
    cartella = RADICE / "img" / citta
    profili = {}
    for foglio, conf in CITTA[citta].items():
        percorsi = [cartella / f for f in conf["file"]]
        if not all(p.exists() for p in percorsi):
            mancanti = ", ".join(p.name for p in percorsi if not p.exists())
            print(f"{citta}/{foglio}: salto, manca {mancanti}")
            continue
        unione = None
        for p in percorsi:
            im = Image.open(p)
            m = maschera_inchiostro(im) if conf["modo"] == "inchiostro" else maschera_sfondo(im)
            if unione is not None and unione.shape != m.shape:
                sys.exit(f"{p.name}: misure diverse dalle altre immagini del foglio {foglio}")
            unione = m if unione is None else (unione | m)
        profili[foglio] = profilo(unione)
        print(f"{citta}/{foglio}: {unione.shape[1]}x{unione.shape[0]}, {len(profili[foglio]['alto'])} campioni")

    righe = [
        "// Generato da scripts/genera-profili.py: non modificarlo a mano, rilancia lo script.",
        "// Per ogni foglio: alto[i] e basso[i] sono la prima e l'ultima riga disegnata nelle colonne",
        "// da i*passo a (i+1)*passo. Colonna vuota: alto = altezza, basso = -1.",
        "export default {",
    ]
    for foglio, p in profili.items():
        righe.append(f"  {json.dumps(foglio)}: {{")
        righe.append(f"    larghezza: {p['larghezza']}, altezza: {p['altezza']}, passo: {p['passo']},")
        righe.append(f"    alto: {json.dumps(p['alto'], separators=(',', ':'))},")
        righe.append(f"    basso: {json.dumps(p['basso'], separators=(',', ':'))},")
        righe.append("  },")
    righe.append("};")
    uscita = RADICE / "citta" / f"{citta}-profili.js"
    uscita.parent.mkdir(exist_ok=True)
    uscita.write_text("\n".join(righe) + "\n", encoding="utf-8")
    print(f"scritto {uscita.relative_to(RADICE)}")


def main() -> None:
    scelte = sys.argv[1:] or list(CITTA)
    for c in scelte:
        if c not in CITTA:
            sys.exit(f"città sconosciuta: {c} (configurate: {', '.join(CITTA)})")
        genera(c)


if __name__ == "__main__":
    main()
