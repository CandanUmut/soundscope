# SoundScope

A browser-based **sound-level meter** and **hearing-awareness toolkit**. It runs
entirely on your device, works offline (installable PWA), and is free to host on
GitHub Pages. No accounts, no servers, no tracking, no ads.

---

## ⚠️ Honest accuracy statement (read this)

A phone browser **cannot measure absolute sound level without an external
reference.** After proper calibration, expect roughly **±2–5 dB**. Readings are
trustworthy only in approximately the **30–90 dB** range — phone microphones
clamp and compress above ~95–100 dB, so loud environments (concerts, heavy
machinery, gunfire) are unreliable, and SoundScope shows a *"near sensor limit"*
warning above ~95 dB.

A/C frequency weighting is **approximate**: it uses standard IEC 61672 filter
approximations, but the phone mic's own response is not flat and is not corrected
per device.

**SoundScope is not a Type 1/2 certified sound level meter.** Do not use it for
legal, occupational-compliance, or evidentiary purposes. The hearing tools are
**awareness only** — not a medical or audiometric device. For anything real, see
an audiologist.

---

## Features

- **Live meter** — large dB(A/C/Z) readout, Fast/Slow time-weighting, color-zoned
  gauge, "near sensor limit" warning. Metering runs in an `AudioWorklet` on the
  audio thread for glitch-free level integration.
- **Session stats** — live Leq, Lmax/Lmin, and L10/L50/L90 percentiles.
- **Timeline chart** — level over time with a Leq reference line.
- **Spectrum** — real-time octave / ⅓-octave band bars.
- **Exposure** — OSHA PEL (90 dBA, 5 dB exchange) and NIOSH REL (85 dBA, 3 dB
  exchange) running dose and projected time-to-limit. *Educational only.*
- **Sessions** — save/load/delete in IndexedDB; export CSV.
- **Noise map** — opt-in geotagged Leq logging; export GeoJSON + CSV. Stays
  on-device.
- **Accessibility suite**
  - **Alerts** — visual flash + haptic buzz when a level threshold is crossed.
  - **Live captions** — Web Speech API speech-to-text (see privacy caveat below).
  - **Hearing screening** — relative pure-tone awareness check, *heavily
    disclaimed; not a hearing test.*
  - **Listen/assist** — gain-capped live amplification + EQ to earphones. *Not a
    medical hearing aid.*

---

## How to calibrate properly

The gauge zones and dB readings only mean something after calibration.

1. **Reference-match (recommended, accurate).** Place a calibrated SPL meter — or
   a 94 dB / 1 kHz acoustic calibrator — at your phone's mic. Start the meter,
   then in the **Calibrate** tab enter the known level. SoundScope sets
   `offset = knownSPL − currentDbFS`.
2. **Manual nudge.** A slider for a rough, plausible offset.
3. **Device preset.** Approximate per-phone starting points — *not* calibrated.

The **self-test** tone/pink-noise is a **relative input check only**. Playing a
tone through the phone speaker and measuring it with the same phone's mic reveals
only the speaker→mic loopback gain — it does **not** establish room loudness and
**cannot** set absolute accuracy.

> SoundScope also requests the mic with `autoGainControl`, `echoCancellation`,
> and `noiseSuppression` **off**. Some devices apply hardware AGC that can't be
> disabled; when the constraints aren't honored, SoundScope warns you.

---

## Privacy model

- Audio is processed **on-device** and never uploaded.
- Sessions → IndexedDB (local). Settings & calibration → localStorage (local).
- Noise-map location is **opt-in** and stays on-device; you own the exported file.
- **Caption caveat:** live captions use the browser's Web Speech API, which may
  send audio to a **cloud** recognizer (e.g. Chrome → Google) and usually needs a
  network connection. This is the only feature that isn't fully on-device.

---

## Develop & build

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # outputs dist/
npm run preview  # serve the built dist/
```

Requires a recent browser with Web Audio + AudioWorklet support. Microphone
access requires a secure context (`https://` or `localhost`).

## Deploy

### GitHub Actions → GitHub Pages (recommended)

`.github/workflows/deploy.yml` builds the Vite output and publishes `dist/` on
every push to `main`. Enable **Settings → Pages → Build and deployment → Source:
GitHub Actions**. The workflow sets Vite's `base` to `/<repository-name>/`
automatically so assets resolve on project sites.

### No-build fallback

If you'd rather not use CI, you can build locally and commit the output to a
`/docs` folder, then point **Settings → Pages → Source: Deploy from a branch →
/docs**:

```bash
npm run build
rm -rf docs && cp -r dist docs
git add docs && git commit -m "Publish build" && git push
```

(Set `BASE_PATH=/<repo>/ npm run build` so paths match your Pages URL.)

---

## Tech

Vanilla JS + ES modules, Vite, AudioWorklet metering, native `BiquadFilterNode`
weighting, IndexedDB sessions, localStorage settings, PWA service worker. Plain
CSS with custom-property theming. No framework, dependency-light.

## License

Apache-2.0. See [LICENSE](./LICENSE).
