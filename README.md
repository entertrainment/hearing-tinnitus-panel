# Hearing & Tinnitus Panel 🎧

**[▶ Live demo](https://entertrainment.github.io/hearing-tinnitus-panel/)** · **[Scientific methods](https://entertrainment.github.io/hearing-tinnitus-panel/methods.html)** · [MIT License](LICENSE)

A single-file, offline-capable web app with **two tabs**:

### 1 · Quick test
0. **Set your level** — a 1 kHz reference tone + slider; pick a level that's clearly audible but doesn't overshadow your tinnitus. Used for both sweeps.
1. **Hearing range** — medium-speed 250 Hz → 20 kHz sweep; tap *"I can't hear it anymore"* to record your high-frequency cutoff.
2. **Tinnitus pitch match** — a *slow* sweep starting at **500 Hz** (documented tinnitus low bound). After each match you land on a **fine-tune & confirm** screen: a **live oscilloscope** + **real-time spectrum with a pitch marker**, a continuous pitch scrubber (with **÷2 / ×2** octave jumps to defeat octave confusion), and an **A/B compare** that alternates the tone with silence so you can check it against your tinnitus. Runs **up to 3 times**, **geometrically averaged**.
3. **Tinnitus character** — a short questionnaire (closest sound, laterality, pulsatile, somatic) → a **suggested tinnitus type**.
4. **Sound therapy** — from the result, a player tuned to your matched pitch: **narrowband** masker, **notched noise** (energy removed at your pitch), **pink-ish**, or **white** noise, with a level slider.

### 2 · Audiology panel
0. **Set a comfort ceiling** — the loudest comfortable level; the test never exceeds it.
1. **Per-ear pure-tone thresholds** — left and right measured **separately** (stereo-panned, so **headphones are required**), across the standard audiometric frequencies (**250, 500, 1k, 2k, 3k, 4k, 6k, 8k Hz**). Uses the accredited-audiometry approach:
   - **Warbled pulsed tone bursts ("chirps")** — 3 pulses, ±4 % warble at 5 Hz — like a clinical audiometer, and easier to tell apart from tinnitus.
   - **Bayesian adaptive thresholds (ZEST-inspired)** *(research-informed — see below)*: each (ear, frequency) holds a probability distribution over its threshold; every fixed-level chirp updates that posterior, the next chirp is placed at the posterior mean, and a tone finishes once the posterior SD is small enough — reporting **threshold + 95 % credible interval + trial count**, not a bare integer. New tones borrow an **informed prior** from age and from already-measured neighbouring frequencies / the other ear. Simulation: **~6 trials/frequency, ~1.8 dB mean error (max 5), no-response flagged 100%**.
   - **Shuffled interleaved presentation**: tones are presented in a **randomised order** — mixing ear, frequency and level so there's no predictable ramp — never the same pitch twice running, finished tones excluded.
   - **Extended high frequencies (10–16 kHz)** *(optional)*: an early-damage region [8][9], shaded and labelled exploratory because most consumer headphones can't reproduce it accurately [1].
   - **Headphone type** is recorded for context.
   - **Reaction-time proof**: because every chirp is a fixed level, a slow or late button press can't inflate the threshold (the old rising-ramp method could). The response window is generous, and **randomised silent gaps** catch anticipatory/false presses ("Wait for the chirp…").
2. **Audiogram** — drawn on a canvas: frequency (log x) × level-needed (y). Worse hearing **dips down**; **red ◯ = right, blue ✕ = left**; **no-response frequencies leave a gap** (marked ↓). Downloadable as **PNG**. Also:
   - **Self-referenced** — levels are re-referenced to your own *best* threshold (so 0 = your best), which is less arbitrary than the comfort-ceiling anchor. Axis reads "dB rel. to your best".
   - **Age overlay** — enter an optional age and a dashed **typical age-related shape** (ISO-7029-style presbycusis trend) is drawn for context, anchored to your low-frequency point. Clearly labelled as shape-only, not a calibrated comparison.
   - **Reliability readout** — per-ear **Good / Fair / Questionable** based on false presses and how many presentations each frequency needed; flags an unreliable run.
3. **Advanced tinnitus battery** — pitch match (averaged, each pass confirmed on the **live-scope fine-tuner** with ÷2/×2 octave jumps) → **sound-quality audition** (tone / ring / hiss / buzz / roar / crickets) → **loudness match** (also shown in **dB SL**, above your threshold) → **minimum masking level** → **MRIL** (minimum residual-inhibition level: an *adaptive* search using **triangular-envelope narrowband bursts** [10] — plays ~20 s, asks if your tinnitus is briefly reduced, then probes quieter/louder to find the lowest level that produces residual inhibition) → questionnaire → a **suggested tinnitus type** that references your audiogram shape → optional **tinnitus impact index** (0–100, original wording modelled on validated distress questionnaires) → **sound therapy** (evidence tempered per recent trials).

### 3 · Speech-in-noise
A **calibration-free** speech-in-noise screen: three spoken digits over noise, with an adaptive **1-up/1-down** SNR track → a speech-reception threshold. Uses the browser's built-in speech voice + Web Audio noise, so it's honest about being a **relative, TTS-based** screen rather than the validated clinical Digits-in-Noise corpus. Captures functional hearing (understanding speech in noise) that pure-tone testing can miss.

**SNR math (verified against the DiN literature [1'][2']).** SNR in dB is `20·log10(RMS_speech / RMS_noise)`; to change SNR by *N* dB with speech held fixed, the noise **amplitude** is scaled by `10^(−N/20)` — implemented as `noiseGain = 0.10·10^(−snr/20)` (a validated "fix speech, vary noise" mixing method). Since the device speech voice's RMS is unmeasured, the result is a **relative** dB SNR (true SNR = value + an unknown constant). The track uses a **larger 4 dB step until the first reversal, then 2 dB**, and the **SRT = mean of the reversal SNRs, discarding the first** — standard adaptive practice. Simulation: SNR steps are exact (6.00 / 2.00 dB), and the SRT recovers a known threshold to **~0.8 dB**.

Extra references: [1'] Smits et al. 2013, *JASA* (the DiN test); [2'] Smits 2022, *JASA* (1-up/1-down SEM); Van den Borre 2021 (DTT scoping review); Türüdü 2025 (online DiN, mixing-method effects ~1–2 dB, antiphasic vs diotic ~6 dB).

Results (and, for the audiology panel, the full threshold table + tinnitus profile) are shown on screen and emailed to **douglas@entertrainment.co.uk**.

---

## Research-informed additions (Aug 2026)

These upgrades were guided by a review of recent audiology literature (via Consensus):

- **Bayesian adaptive thresholds** — probabilistic active-learning audiometry with informed (age / inter-frequency / inter-aural) priors is faster and more accurate than fixed staircases [13][14][15].
- **Speech-in-noise (Digits-in-Noise) screen** — DiN is calibration-free, correlates strongly with pure-tone audiometry, and catches functional loss the audiogram misses [4][5][6].
- **Extended high frequencies (10–16 kHz)** — the earliest marker of cochlear damage, elevated even with a normal standard audiogram [8][9]; consumer-headphone accuracy degrades above ~6–8 kHz, so it's flagged exploratory [1][2].
- **Tinnitus battery** — psychoacoustic pitch/loudness correlate weakly with tinnitus *impact*, so a validated-style **impact index** was added [12]; loudness reported in **dB SL** [11]; masking/residual-inhibition reliability supports the battery [10]; and **sound-therapy claims were tempered** — a 2026 RCT found notched therapy no better than plain amplification [16], though tailored notched music does show residual-inhibition effects [17][18].

Key references: [1] Al-Maskari 2025; [2] Seluakumaran 2021; [4] Ceccato 2021; [5] Han 2020; [6] Gu 2025; [8] Lough 2022 (JASA); [9] Škerková 2026; [10] Daoud 2024; [11] Raj-Koziak 2019; [12] Manning 2019; [13] Cox 2021; [14] Wallaert 2024; [15] Vercammen 2025; [16] Quemar 2026; [17][18] Zhu 2024/2023. Full titles/links were provided in the build conversation.

> **Not diagnostic.** Every part of this suite is an uncalibrated screening tool. For real concerns, see an audiologist (calibrated audiogram, validated tinnitus questionnaire) or an ENT (red flags: pulsatile, unilateral, sudden-onset, vertigo).

Runs in any modern browser on any device (iOS Safari, Android Chrome, desktop). No build step, no dependencies.

---

## Optional: email results from your Outlook (Microsoft Graph)

By default results are delivered via **Netlify Forms** (dashboard notification) and the **mailto** button. If you'd rather have each result emailed automatically **from your own Outlook**, deploy the included serverless function — [`netlify/functions/send-result.js`](netlify/functions/send-result.js). The site POSTs each result to it; it sends the email server-side via Microsoft Graph. **Credentials live only in Netlify environment variables — never in the page or the repo.**

> Why not put credentials in the page? A static site's JavaScript is fully visible to anyone. OAuth tokens/secrets there would expose your whole mailbox. The serverless function is the safe place for them.

**One-time setup (using your existing Entra app registration):**
1. In **Entra / Azure AD → App registrations → your app**:
   - **API permissions → Add → Microsoft Graph → Application permissions → `Mail.Send`**, then **Grant admin consent**. (App-only sending needs a *confidential* client — if your registration is public-only, add a client secret next.)
   - **Certificates & secrets → New client secret** → copy the value.
   - Note the **Directory (tenant) ID** and **Application (client) ID** (both already in your AA app config).
2. In **Netlify → Site settings → Environment variables**, add:
   - `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET`
   - `MS_SENDER` = `douglas@entertrainment.co.uk` (the mailbox to send from)
   - `RESULT_TO` = `douglas@entertrainment.co.uk` (optional; defaults to `MS_SENDER`)
   - `ALLOWED_ORIGINS` = your deployed URL, e.g. `https://your-site.netlify.app` (recommended)
   - `RESULT_TOKEN` = optional shared token (see note below)
3. Redeploy. Results now arrive in your Outlook. The result screen shows "✓ Result emailed to your Outlook" when the function accepts it.

**Abuse hardening (built in).** The endpoint is public, so the function includes: the **recipient is fixed server-side** (never taken from the request — so it can't be an open relay, only ever emails you), **origin allow-listing** (`ALLOWED_ORIGINS`, else same-site only), a **request-size cap**, **per-IP best-effort rate limiting**, a **honeypot**, and payload validation. `RESULT_TOKEN` adds a required header — but note a static site can't truly keep a secret, so it's friction, not real auth. Worst case without a token is someone spamming *your* inbox with junk results; the rate limit + origin check make that impractical.

Notes: the function has **no npm dependencies** (uses Node 18+ global `fetch`). Sending is **app-only/unattended** — no user needs to be signed in. It currently sends **to you only**; to also reply to the test-taker, add a `toRecipients` entry using an email they enter on the form (opt-in). If you use the Graph function, you can turn off the Netlify Forms email notification to avoid duplicates.

### Prefer not to add a client secret? Use the delegated (no-secret) path

[`netlify/functions/send-result-delegated.js`](netlify/functions/send-result-delegated.js) does the same job with a **delegated refresh token** (public client + PKCE) — **no client secret**. Setup:

1. On your Entra app: set **Authentication → Allow public client flows = Yes**, and add the **delegated** Graph permission **`Mail.Send`**.
2. Mint a refresh token once, locally (device-code flow, nothing stored in the app):
   ```bash
   node tools/get-refresh-token.js <TENANT_ID> <CLIENT_ID>
   ```
   It prints a code + URL — sign in as the mailbox to send **from** — then prints the `refresh_token`.
3. In Netlify env vars set `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_REFRESH_TOKEN` (+ optional `RESULT_TO`, `ALLOWED_ORIGINS`, `RESULT_TOKEN`), and point the site at this function (or rename it to `send-result.js`).

**Trade-off:** refresh tokens rotate/expire (≈90 days of inactivity, and are revocable), and a stateless function can't persist a rotated token, so you may need to re-mint it occasionally. The **app-only + secret** path is more robust for fully unattended sending; the delegated path simply avoids storing a secret.

---

## Measurement-quality layer (review-informed)

Following a technical review, the audiology panel now reports how much to trust each result rather than just a number:

- **Device check** — before testing, verify **stereo routing (L/R not reversed/leaking)** and read the **sample rate** (extended highs are disabled if it's too low). No microphone means true acoustic response can't be measured, but this catches the common failures.
- **Catch trials** — occasional **silent presentations** (indistinguishable from real ones) measure your **false-alarm rate / response bias**; a high rate downgrades reliability.
- **Posterior uncertainty** — each threshold carries a **95% credible interval** (drawn as whiskers on the profile) plus **trial count**; the reliability line reports median CI, median trials, and false-alarm % per ear.
- **Test–retest** — a one-tap **retest** re-runs the thresholds and reports the **mean absolute difference** vs your first run (Good/Fair/Poor), overlaying the first run as a dashed line.
- **Naming** — the plot is a **self-referenced hearing profile**, explicitly *not* a calibrated dB HL audiogram, both in the UI and here.

These turn the panel from "a clever tone player" into an instrument that knows when it doesn't know — the reviewer's main recommendation.

**Follow-up refinements:**
- Thresholds show **±posterior SD** and a **95 % credible interval** (correct Bayesian term), not false single-dB precision.
- Test–retest is labelled **repeatability**; per-run reliability is labelled **response quality** — each a product heuristic, not a validated clinical cutoff.
- The tinnitus result now leads with **observed characteristics → phenotype → clinical flags**, with associations clearly hedged as "possible, not causes" — a measurement, not a diagnosis. A stronger **sudden-hearing-change** flag fires when sudden onset coincides with an asymmetric profile.
- **Pitch-vs-hearing-loss** readout: checks whether the matched tinnitus pitch falls inside the measured loss region (the tonotopic / central-gain pattern) — exploratory context.
- **Export raw session (JSON)** — thresholds *with posterior SD and trial counts*, catch/false-alarm data, hardware, and the full tinnitus profile — so a session can later be re-analysed with different estimators/priors, or compared against calibrated audiometry.
- The age curve is labelled **illustrative**, and speech-in-noise is an **SRT-equivalent (relative)**.

---

## ⚠️ Important — what this is and isn't

- **Not a diagnostic audiogram.** A browser **cannot** produce calibrated **dB HL** (that needs calibrated transducers in a booth). The audiogram y-axis is a **relative** level measured against the comfort ceiling *you* set. The **shape** (a 3–6 kHz noise notch, high-frequency roll-off) is informative; the absolute numbers are not clinical.
- **Your headphones/speakers cap the result.** Ear-specific testing needs **headphones**; without them both ears hear every tone and the L/R split is meaningless.
- **The tinnitus "type" is a rule-based suggestion, not a diagnosis.** Red flags (pulsatile tinnitus, one-sided tinnitus, sudden onset with hearing loss/vertigo) are surfaced with advice to seek professional care.
- If in doubt, see an **audiologist** (calibrated audiogram) or **ENT**.

---

## Files

| File | Purpose |
|------|---------|
| `index.html` | The entire app (HTML + CSS + JS, self-contained). Brand header + favicon are inline SVG. |
| `logo.svg` | Standalone **entertrainment** logo (gradient badge + audio waveform) for other uses. |
| `netlify.toml` | Publishes the folder as-is (+ serverless functions). |
| `netlify/functions/` | Optional Outlook-email functions — `send-result.js` (app-only) and `send-result-delegated.js` (no secret). |
| `tools/get-refresh-token.js` | One-time helper to mint the delegated refresh token. |
| `README.md` | This file. |

---

## Deploy to Netlify

**Drag & drop:** go to **https://app.netlify.com/drop** and drop the `hearing-test` **folder**. You get a live URL instantly.

**Email delivery:** the app posts results to a **Netlify Form** named `hearing-test`. After deploying, submit one result, then in the Netlify dashboard: **Site → Forms → hearing-test → Add notification → Email** → `douglas@entertrainment.co.uk`. From then on every result (quick test or full audiology, including the audiogram numbers and tinnitus profile) is emailed automatically and stored in the dashboard.

**Fallback everywhere:** each result screen also has an **"Email results"** button that opens the tester's own mail app pre-filled and addressed to you — works even without the Netlify setup. (The audiogram *image* is a separate **Download PNG** button, since email links can't carry an attachment.)

---

## How it works (for tinkering)

- **Web Audio API** throughout: sine `OscillatorNode`s for tones, a `BufferSource` of generated noise (band-/high-/low-pass filtered) for hiss/roar/masking, a `StereoPannerNode` for the L/R split, and a `GainNode` per voice.
- **Sweeps** follow an exponential (log) law `f(t) = f0·(f1/f0)^(t/T)`. Parameters live in the `SWEEP` object: `hearing` (250 Hz→20 kHz, 40 s) and `tinnitus` (500 Hz→12 kHz, 60 s).
- **Audiometry** (`FREQS`, `DYN`, `THETA`, `PSY_SIGMA`): `playChirp()` schedules warbled pulsed bursts at a fixed `gainForDb(level)`. Each (ear, frequency) is a **Bayesian adaptive threshold estimator (ZEST-inspired)**: `initPrior()` builds a prior over the threshold θ (grid `THETA`, informed by age + neighbouring frequencies + the other ear), `updatePost()` applies the logistic `pHear(level, θ)` after each response, and `postStats()` gives the posterior mean/SD. The next chirp is placed at the current posterior mean; a tone finishes when the posterior SD is small enough (or a trial cap is hit), reporting **threshold + posterior SD + trial count**. It is *not* a textbook ZEST (which is why "ZEST-inspired"): stimulus placement is at the posterior mean, not by expected-information-gain. **Catch trials** (`P_CATCH`, silent presentations) measure false-alarm rate; a press in the pre-stimulus silence is a false press and re-presented. Presentation order is shuffled across ear/frequency/level. `gainForDb()` maps relative dB to gain against your comfort ceiling.
- **Audiogram** is drawn on `<canvas>` (re-drawn on resize and on light/dark theme change), with broken lines across no-response points.
- **Tinnitus classifier** (`classify()`) is a transparent rule set combining sound-quality choice, pitch, questionnaire, audiogram configuration, and residual-inhibition/masking results.

To change the recipient, edit the `RECIPIENT` constant (and the Netlify notification). To adjust ranges/speeds, edit `SWEEP`, `FREQS`, or `DYN`/`RAMP`.

## Disclaimer

This is a browser-based **auditory psychophysics and tinnitus phenotyping** tool intended for research, self-observation and hypothesis generation. It is **not a medical device, not a diagnostic instrument, and not a substitute for calibrated audiometry or clinical assessment**. Browser audio is uncalibrated — the delivered sound level depends on the device, DAC, OS volume, headphones and coupling — so all results are **relative** (useful within a session for trends and relationships), not clinical dB HL. Comfortable levels only; never raise levels to "test tolerance" or to reproduce a past exposure. Sudden, one-sided, pulsatile or asymmetric hearing change — or tinnitus with vertigo — needs professional assessment (audiologist / ENT), not a web page.

## License

Released under the [MIT License](LICENSE) © 2026 entertrainment.
