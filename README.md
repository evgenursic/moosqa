# MooSQA Radar

Urednisko oblikovana spletna aplikacija za zajem novih indie izdaj iz `r/indieheads`, hitro vizualno orientacijo in skupnostno ocenjevanje od 1 do 100.

## Kaj ze deluje

- avtomatski zajem javnih objav iz `https://www.reddit.com/r/indieheads/.json`
- prepoznavanje tipov `FRESH`, `FRESH ALBUM`, `FRESH EP`, `FRESH PERFORMANCE`
- vizualna naslovnica z "featured" sekcijo, gridom singlov in petkovo album/EP sekcijo
- podrobna stran posamezne objave
- anonimno glasovanje uporabnikov z lokalnim `device` cookie identifikatorjem
- enrichment sloj za `label`, `genre`, potrjen `release date` in boljse direct listening linke
- AI-generated enovrsticni opis skladbe oziroma izdaje z `OPENAI_API_KEY` ali lokalni fallback brez kljuca
- SQLite + Prisma model, pripravljen za dodajanje dodatnih portalov
- `GET /api/sync` endpoint za cron sinhronizacijo

## Zagon lokalno

1. Namesti odvisnosti:

```bash
npm install
```

2. Pripravi okoljske spremenljivke:

```bash
copy .env.example .env
```

Po potrebi dodaj tudi:

```bash
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5-nano
```

3. Generiraj klienta in inicializiraj bazo:

```bash
npm run db:setup
```

4. Zazeni razvojni streznik:

```bash
npm run dev
```

5. Odpri `http://localhost:3000`.

Pri prvem obisku se bo aplikacija sama poskusila napolniti z zacetnimi podatki. Rocni sync lahko sprozis tudi z:

```bash
curl "http://localhost:3000/api/sync?secret=change-me"
```

## Produkcijska logika

- nastavi `CRON_SECRET`
- v hostingu dodaj cron, ki periodicno klice `/api/sync?secret=...`
- za skoraj takojsnjo objavo novih Reddit zapisov nastavi klic na 5 do 15 minut

## Naslednji poslovni koraki

- dodaj enrichment za pravo zalozbo in natancen datum izida prek dodatnih glasbenih API-jev
- razsiri model na vec virov: Bandcamp, Stereogum, BrooklynVegan, FLOOD, NME, Pitchfork
- dodaj uporabniske profile, uredniske sezname in oglasne oziroma partnerske umestitve
