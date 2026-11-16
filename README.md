# The Warming Song: an Earth Information Jukebox

NASA Space Apps Challenge 2026, "The Earth Information Jukebox".
A musical, whimsical journey through 144 years of NASA temperature data (1880–2023), built on
NASA SVS 5207 "Global Temperature Anomalies from 1880 to 2023" (GISTEMP v4): https://svs.gsfc.nasa.gov/5207/

NASA's temperature map floats in deep space, coloured like SVS 5207 (blue = cooler than 1951–1980, white = normal, red = warmer)
using **NASA GISTEMP's real zonal means**: each band of latitude gets its own real value every year, so you watch the Arctic heat up fastest.
With the backend running, NASA's own SVS 5207 frames are shown instead.

**One number drives the sound: the map's global temperature.** As it rises:
- 🐦 cute birds (and butterflies) get rarer, softer and further away, never harsher
- 🌿 crickets, frogs, waves and the creek fade; the breeze turns gusty
- 🏭 pollution surges dramatically: traffic roar, cars zooming past, a gritty engine drone, factory drone, chimney puffs, clanks, horns, jackhammers, sirens and smog fizz, with brown smog visibly swallowing the sky
- 🎵 the music climbs higher, faster and tenser
- 🎧 **Narrator** (top-right button or V): reads the story, the year, the temperatures and what's changing, and ducks the other sounds while it speaks. Made for blind and low-vision listeners.
- 🔇 Mute (button or M)

## Sound visuals

A glowing waveform across the top of the map shows the live sound, and the glow around the map pulses with the loudness of the music. The music-box melody is a short, low phrase that repeats and slowly changes, so it sounds like one connected tune; it gets busier and tenser as the map warms.

## How the story ends

As the map warms, the page moves through three moods: a storybook dawn, a smoky dusk and a dark night. The birds fade with the heat and are completely gone by the hottest years. When the timeline reaches 2023, an epilogue opens. It is short: one line about what the data showed, three NASA Science facts and "We need to act now". Every source used for the map, the story facts and the ending is listed in a Sources section at the bottom of the page. With the narrator on, it is read aloud.

## Narrator voice (open source)

The narrator uses Piper, an open-source text-to-speech engine (MIT licence), with the "Norman" voice, a deep US English male voice trained on public-domain LibriVox recordings. It runs entirely in the browser (`public/voice.js`).

- The first time someone turns the narrator on, the browser downloads the voice (about 63 MB) from the official Piper voice library on Hugging Face. After that it is cached, so it starts quickly.
- If the voice can't be downloaded (offline, or a site that blocks outside downloads), the narrator falls back to the browser's built-in voice so it still works.
- `voice-src.js` is the readable source of `public/voice.js`. To rebuild it: `npm i @mintplex-labs/piper-tts-web@1.0.5 onnxruntime-web@1.18.0 esbuild`, then `npx esbuild voice-src.js --bundle --format=esm --minify --platform=browser --external:fs --external:path --external:crypto --external:worker_threads --external:vm --outfile=public/voice.js`, and replace `diffusionstudio/piper-voices` with `rhasspy/piper-voices` in the output.

## Recording your own narration

You can narrate the story yourself. Record the lines in the recording script and save them in `public/voice/` with the exact file names, for example `welcome.m4a`, `1880.m4a`, `quick-3.m4a` and `ending.m4a`. The files can be `.m4a`, `.mp3` or `.wav`.

The site plays your recording whenever that line comes up. Any line without a recording is read by the Norman voice, including the data lines that change with the year (like "1953. The planet is 0.1 degrees warmer…"). To skip those data lines instead, set `VO_DATA = false` near the top of the narrator code in `public/app.js`.

## Sounds and licences

There are no audio files in this project. Every sound, including the birds, wind, pollution, music and whoosh, is synthesized live in the browser with the Web Audio API by the code in `public/app.js`. Because nothing was downloaded or sampled, there are no third-party sound copyrights to worry about. The narrator uses the open-source Piper voice described above. Fonts (Fraunces, Inter, IBM Plex Mono) are under the SIL Open Font License. All sources are credited at the bottom of the page.

## Run it

```bash
pip install -r requirements.txt
python3 server.py            # first run downloads SVS 5207 frames + GISTEMP (a few minutes), then serves
# open http://localhost:8000
```

Without the backend, `public/index.html` still works: it uses the built-in GISTEMP numbers, and the map is drawn from real coastlines and tinted by each year's global average (labelled as an illustration).

## Files

| File | Language | Role |
|---|---|---|
| `server.py` | Python | Backend: downloads the official GISTEMP global and zonal tables, NOAA CO₂ and SVS 5207 frames + colorbar + time.txt; reads every map pixel (Robinson projection, area-weighted) to get the global, Arctic and tropics anomaly and the share of the planet above +1 °C; writes `data/timeline.json` + small map JPEGs; serves the site. |
| `public/app.js` | JavaScript | The conductor that turns the map's temperature into every sound (Web Audio: birds, nature, pollution, music, whoosh), the storybook picture with the Robinson-projection map, the time ribbon, story cards, mute and controls. |
| `public/geo-data.js` | JavaScript (data) | Natural Earth coastlines (public domain) for the map outline. |
| `public/story.js` | JavaScript | The narration and quick facts. Edit this to change the story. |
| `public/fallback-data.js` | JavaScript (data) | Built-in GISTEMP global + zonal annual means and Mauna Loa CO₂, so the page works on its own (2023 zonal bands estimated; the backend downloads the real table). |
| `public/index.html`, `public/style.css` | HTML/CSS | Layout and styling. |

## Options
- `python3 server.py --step 1` uses a map for every year (default every 2nd year; each SVS frame is a few MB).
- `python3 server.py --build` rebuilds the data.
- `--cb-min/--cb-max` force the colorbar range. Otherwise it's calibrated against the official GISTEMP numbers.
- Old macOS Python with SSL errors: handled automatically (falls back to `curl`).

Data: NASA GISS GISTEMP v4, NASA SVS 5207, NOAA GML. Not an official NASA product.
