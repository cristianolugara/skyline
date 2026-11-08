# Genera i rendering di una città: stessi monumenti, stili diversi. Le prove finiscono nei documenti
# (repo-docs\progetti\skyline\rendering\<città>), il gioco non le usa da lì.
# Uso: python scripts/genera-rendering.py [lettera ...]   (senza lettere: tutti gli stili)
#
# Passa da fal.ai e non da Gemini direttamente, anche se il modello è lo stesso: la chiave Gemini è sul
# piano gratuito, che per i modelli di immagini ha quota zero (429, verificato il 07/11/2026).
# Per un'altra città basta cambiare CITTA e MONUMENTI.
import base64
import json
import os
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

MODELLO = "fal-ai/nano-banana-pro"
CITTA = "new-york"
DOCUMENTI = Path(r"C:\Users\crist\repo-docs\progetti\skyline")
USCITA = DOCUMENTI / "rendering" / CITTA / "originali"
MATERIALI = DOCUMENTI / "materiali-alberto"

MONUMENTI = """The picture contains EXACTLY these landmarks of New York, arranged from LEFT to RIGHT in this exact order, each one clearly separated from the next so it can be recognised on its own:
1. Statue of Liberty, on her pedestal, torch raised in her right hand.
2. Ellis Island immigration building: long low red-brick hall with four slim towers topped by small copper domes.
3. Wall Street, shown as the New York Stock Exchange neoclassical temple front with six big columns and a triangular pediment, with 40 Wall Street behind it (slim tower with a green pyramid roof and a small spire).
4. One World Trade Center (Freedom Tower): very tall tapering glass tower with chamfered edges and a long thin spire. It is the tallest element.
5. Brooklyn Bridge: two massive stone towers with double pointed gothic arches and fanned suspension cables, seen from the side.
6. United Nations Secretariat: a perfectly plain, thin, flat-topped glass slab, no spire.
7. Chrysler Building: art deco, stacked stainless-steel sunburst arches with triangular windows forming a needle crown.
8. Empire State Building: symmetrical stepped setbacks and a tall mast.
9. Rockefeller Center: 30 Rockefeller Plaza, a limestone art-deco slab with a stepped silhouette and a flat top.
10. Three super-slender pencil towers standing close together: Central Park Tower (very tall, flat top, with a small cantilever step), 111 West 57th Street (needle-thin with a feathered stepped top that narrows to a point), 432 Park Avenue (thin square grid tower with a flat top).
Do not add any other recognisable landmark. Between the landmarks only a few low anonymous buildings at most. No text, no letters, no numbers, no labels, no logos, no watermark, no signature anywhere in the image."""

STILI = {
    "A-sagoma": {
        "formato": "21:9",
        "testo": "A pure solid black silhouette skyline on a plain pure white background. Flat single-colour shapes only, no shading, no details inside the shapes, no windows, no reflections, no gradient. All the buildings stand on one common straight ground line at the bottom. Crisp clean vector-like edges. Each landmark must be recognisable only from its outline, like a stencil.",
    },
    "B-fumetto": {
        "formato": "21:9",
        "riferimento": MATERIALI / "amico-fumettista" / "Tavole_1.jpg",
        "testo": "A hand-drawn urban-sketch skyline in black felt-tip pen on white paper, loose confident lines, slightly wobbly, with hatching, exactly in the style of the attached reference drawing by a cartoonist (ignore the hand-written captions and the buildings of the reference, use only its line style). No colour. All buildings stand on one common hand-drawn ground line.",
    },
    "C-pop": {
        "formato": "21:9",
        "testo": "A flat vector pop illustration of a skyline: bold cheerful saturated colours, thick dark outlines, simple geometric shapes and playful cartoon proportions, plain pale sky-blue background, no gradients and no 3D. Mobile game art, very clean and appealing. All buildings stand on one common ground line, with a thin strip of blue water under the Statue of Liberty, Ellis Island and the Brooklyn Bridge.",
    },
    "D-poster": {
        "formato": "21:9",
        "testo": "A vintage 1930s art-deco travel poster of a skyline: limited palette of teal, cream, coral and mustard, screen-print texture, large flat shapes with long geometric shadows, warm sunset sun disc behind the buildings. All buildings stand on one common ground line above calm stylised water.",
    },
    "E-notte": {
        "formato": "21:9",
        "testo": "A night-time skyline in a stylised mobile-game look: deep indigo sky with soft stars, dark navy buildings with warm glowing yellow windows and neon-coloured rim lights on the edges, faint reflections in the water at the bottom. Clean, polished, simple shapes. All buildings stand on one common ground line.",
    },
    "F-isometrica": {
        "formato": "16:9",
        "riferimento": MATERIALI / "scene-ia-isometriche" / "versione-chibi-del-paese.jpg",
        "testo": "A clear, 45-degree top-down isometric miniature 3D cartoon diorama, in the chibi/pop style of the attached reference image (use only its style: ignore its buildings, title, weather icon and every piece of text). Soft refined textures with realistic PBR materials and gentle lifelike lighting. The diorama is a long thin slice of New York running diagonally, with the landmarks in the given order along the diagonal, from the bay at the bottom-left to the tall towers at the top-right. Clean minimalistic composition on a soft solid-coloured background.",
    },
}


def genera(nome):
    stile = STILI[nome]
    corpo = {
        "prompt": "\n\n".join([stile["testo"], MONUMENTI]),
        "aspect_ratio": stile["formato"],
        "resolution": "2K",
        "num_images": 1,
        "output_format": "png",
    }
    endpoint = MODELLO
    if rif := stile.get("riferimento"):
        endpoint = f"{MODELLO}/edit"
        corpo["image_urls"] = ["data:image/jpeg;base64," + base64.b64encode(rif.read_bytes()).decode()]
    richiesta = urllib.request.Request(
        f"https://fal.run/{endpoint}",
        data=json.dumps(corpo).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Key {os.environ['FAL_KEY']}"},
    )
    try:
        with urllib.request.urlopen(richiesta, timeout=280) as risposta:
            dati = json.load(risposta)
    except urllib.error.HTTPError as e:
        return f"{nome}: ERRORE HTTP {e.code} {e.read().decode(errors='replace')[:600]}"
    except Exception as e:
        return f"{nome}: ERRORE {e}"
    immagini = dati.get("images") or []
    if not immagini:
        return f"{nome}: NESSUNA IMMAGINE {json.dumps(dati)[:600]}"
    file = USCITA / f"{nome}.png"
    urllib.request.urlretrieve(immagini[0]["url"], file)
    return f"{nome}: {file} ({file.stat().st_size // 1024} KB)"


USCITA.mkdir(parents=True, exist_ok=True)
nomi = [n for n in STILI if not sys.argv[1:] or n[0] in sys.argv[1:]]
with ThreadPoolExecutor(3) as gruppo:
    for esito in gruppo.map(genera, nomi):
        print(esito, flush=True)
