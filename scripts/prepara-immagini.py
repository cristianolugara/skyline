"""Copia le immagini di una città dentro il repo, convertite in WebP, con i nomi che il gioco si aspetta.

Il gioco non legge mai i materiali in repo-docs: le immagini si portano qui con questo script,
dandogli i percorsi dei file di partenza. Si passano solo quelle da aggiornare.

    python scripts/prepara-immagini.py --citta new-york \
        --linea      <disegno solo linea>.png \
        --riempita   <disegno linea riempita>.png \
        --aiuto      <disegno con i dettagli>.png \
        --risolta    <disegno a colori>.png \
        --isometrica <scena isometrica>.png \
        --isometrica-frontale <scena isometrica frontale>.png

Dopo aver cambiato un'immagine si rigenerano i profili: `python scripts/genera-profili.py`.
"""

import argparse
from pathlib import Path

from PIL import Image

RADICE = Path(__file__).resolve().parent.parent

# I disegni al tratto vanno senza perdita: pesano poco lo stesso (20-30 KB) e la compressione
# con perdita sporcherebbe le linee proprio dove si zooma. Le illustrazioni a colori invece
# sono fotografiche: con perdita a qualità alta pesano un decimo del PNG e allo zoom 2x non si
# vede differenza.
RUOLI = {
    "linea": ("partenza-linea.webp", "tratto"),
    "riempita": ("partenza-riempita.webp", "tratto"),
    "aiuto": ("aiuto.webp", "tratto"),
    "risolta": ("risolta.webp", 88),
    "isometrica": ("isometrica.webp", 90),
    "isometrica-frontale": ("isometrica-frontale.webp", 90),
}


def converti(sorgente: Path, destinazione: Path, modo) -> None:
    im = Image.open(sorgente)
    if modo == "tratto":
        # Alcuni disegni arrivano con la trasparenza: la si appoggia sul bianco, perché il
        # gioco li mostra comunque su fondo bianco e così il profilo si calcola uguale.
        if im.mode in ("RGBA", "LA", "P"):
            fondo = Image.new("RGBA", im.size, (255, 255, 255, 255))
            fondo.alpha_composite(im.convert("RGBA"))
            im = fondo
        im.convert("L").save(destinazione, lossless=True, method=6)
    else:
        im.convert("RGB").save(destinazione, quality=modo, method=6)
    print(f"{sorgente.name} -> {destinazione.relative_to(RADICE)} "
          f"({im.size[0]}x{im.size[1]}, {destinazione.stat().st_size // 1024} KB)")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--citta", required=True, help="cartella sotto img/, es. new-york")
    for ruolo in RUOLI:
        p.add_argument(f"--{ruolo}", type=Path)
    args = p.parse_args()

    cartella = RADICE / "img" / args.citta
    cartella.mkdir(parents=True, exist_ok=True)
    fatte = 0
    for ruolo, (nome, modo) in RUOLI.items():
        sorgente = getattr(args, ruolo.replace("-", "_"))
        if sorgente:
            converti(sorgente, cartella / nome, modo)
            fatte += 1
    if not fatte:
        p.error("nessuna immagine indicata")


if __name__ == "__main__":
    main()
