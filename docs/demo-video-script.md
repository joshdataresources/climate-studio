# Climate Studio — investor demo script

**Runtime:** 2:30 · **Audience:** investors / stakeholders · **Format:** screen recording with voiceover

Narration is written to be read at a normal pace, roughly 150 words per minute. Read it
once out loud before recording — anything you stumble over, change. The words should
sound like you, not like a script.

---

## Before you record

```
cd ~/Documents/github-project/climate-suite
npm run dev
```

Wait for the per-service Earth Engine check to come back green. If any service shows ✗,
stop and run `python3 qgis-processing/diagnose_ee.py` — a blank raster mid-take is the
one thing you can't fix in the edit.

**Set the map up first, then start recording:**

| Setting | Value |
|---|---|
| Browser | Chrome, 1920×1080, zoom 100% |
| Window | Full screen, bookmarks bar hidden |
| Start view | CONUS — full country in frame |
| Layers on | Factories, AI Data Centers, Topographic Relief |
| Layers off | Everything else (you'll turn them on live) |
| Projection year | 2025 |
| Scenario | RCP 4.5 |

**Which layers respond to the year slider** — worth knowing so you never drag it against
a layer that can't move:

| Responds to the slider | Fixed regardless of year |
|---|---|
| Future Temperature Anomaly | Aquifers (static polygons) |
| Wet Bulb Temperature | Groundwater / GRACE (observed 2002–2024) |
| Sea Level Rise | Wildfire Hazard (present-day USFS snapshot) |
| Precipitation & Drought | Factories, data centers, dams, rivers |

Do a dry run with all the layers you'll toggle so their tiles are warm in the cache.
Cold Earth Engine tiles can take 10–40 seconds; warm ones are near-instant.

Record at 60fps if you can. Move the map slowly — smooth pans read as confident, fast
ones read as nervous.

---

## The script

### 0:00–0:18 · Cold open

**Screen:** CONUS. Factory and data center icons scattered across the country. Slow push
toward the Southwest.

> Since 2022, companies have committed more than four hundred and fifty billion dollars
> to new factories on American soil. Another six hundred billion to AI data centers.
>
> Every one of those sites was chosen on an assumption about water and heat that was
> true when the check was signed.

**Note:** Don't rush the second line. The pause before "true when the check was signed"
is doing the work.

---

### 0:18–0:42 · What already happened (observed — slider stays at 2025)

This beat is entirely present-day. **Do not touch the year slider here.** Aquifer
polygons are static and the GRACE overlay is a fixed 2002–2024 observed record fetched
once — neither responds to the year. Dragging the slider now would look like a bug.

**Screen:** Click a Southwest factory — Micron Boise, or a Phoenix-area site. Detail card
opens at the bottom. Give it a beat to settle before you speak.

> This is a semiconductor fab. Chip manufacturing runs on ultrapure water — millions of
> gallons a day.

**Screen:** Turn on **Aquifers**. Wait for the polygons to render, then **Rivers &
Aqueducts**. One at a time, about a second apart — two layers appearing at once reads as
clutter, sequenced they read as an argument.

> Here's where its water comes from. The aquifer underneath it, and the rivers and
> aqueducts feeding the region.

**Screen:** Turn on **Groundwater**, then **GRACE** — GRACE only renders when Groundwater
is also on. Hold still for two full seconds once the depletion colors land. This is the
image the whole demo turns on; let it sit.

> And this is what's happened to that groundwater since 2002. NASA's GRACE satellites,
> measuring the mass of water in the ground directly, from orbit.
>
> That's not a projection. That already happened.

---

### 0:42–1:08 · What's coming (projected — this is where the slider moves)

**Screen:** Turn **GRACE and Groundwater off**. Leave aquifers and rivers on for
continuity. Turn on **Future Temperature Anomaly** and **Wet Bulb Temperature**.

> Now push it forward.

**Screen:** *Now* grab the projection year slider. Drag from 2025 to 2095 over about four
seconds — slow and continuous, one motion, no stops. Both layers redraw as you go, and
that redraw is the point of the shot.

**Screen:** Release at 2095, hold a beat, then drag back and settle on **2055**.

> This is NASA's downscaled CMIP6 model — the same projections the IPCC works from —
> showing wet-bulb temperature. Heat and humidity combined: the measure that tracks
> whether a human body can actually cool itself.

**Screen:** Stay parked at 2055 while you deliver the last line.

> The red areas are approaching the limit where working outdoors is survivable only in
> short shifts. That's 2055 — inside the operating life of every plant we just looked at.

**Why the split matters:** observed and projected are two different claims. Running them
together invites "so is this data or a forecast?" — the worst question to get mid-demo.
Separating them, and saying "that already happened" out loud, answers it before it's
asked.

---

### 1:08–1:32 · The other hazards

**Screen:** Turn on **Wildfire Hazard** — it won't move with the slider, so just let it
land while you're parked at 2055.

> Wildfire hazard from the Forest Service, at thirty-meter resolution.

**Screen:** Turn on **Sea Level Rise**, then step the year from 2055 up to 2100. This one
*does* respond — the coastline visibly floods. Pan to the Gulf or the Bay Area where the
change is largest.

> Sea level rise from NOAA.
>
> Any one of these is a known risk. The question nobody could answer quickly was what
> happens when you stack them — and where that leaves a specific city.

---

### 1:32–2:07 · The answer — resilience index

**Screen:** Open the **Resilience leaderboard**. Let the ranked list of metros land.

> So we built the composite. Fifty-two US metros, scored zero to a hundred on heat,
> water, wildfire, flood, and adaptive capacity — the ability to absorb a shock and
> recover.

**Screen:** Drag the **Water** weight slider up. The leaderboard re-ranks live.

> The weights are yours. If your exposure is water, weight water — the ranking moves
> with you.

**Screen:** Click a metro on the map. Card expands showing the five dimensions. Click
**Generate report**.

> And any city on this map produces a report in one click.

**Screen:** Report modal opens. Scroll through it slowly — score, trajectory chart to
2095, local hazard map, FEMA county table.

> Score, trajectory to 2095, the local hazard picture, and the county-level FEMA data
> behind it. Downloadable, sourced, and it says plainly what's projected and what's a
> present-day snapshot.

---

### 2:07–2:32 · Close

**Screen:** Zoom back out to CONUS with the resilience colors on. Hold.

> Every number here traces to a public dataset — NASA, NOAA, USGS, FEMA, the Forest
> Service. No black box.
>
> Four hundred and fifty billion dollars of industrial capacity is being sited right now
> against a climate that isn't the one in the siting assumptions.
>
> This is the tool for asking whether it holds.

**Screen:** Hold two beats on the map. Cut.

---

## Accuracy guardrails

The credibility of this demo is the sourcing. Two claims to avoid, because the app is
careful about them and the script should be too:

**Don't imply fire, flood, and capacity are projected forward.** They're present-day
FEMA National Risk Index values, held flat across decades. Only heat and water carry the
trend. The report states this on screen — if an investor asks, that honesty is an asset,
so don't paper over it.

**Don't call the metro migration figures observed data.** "Metro Data Statistics" is
sourced as a Climate Migration Model. It's a model output, not a measurement. Leave it
out of the demo entirely — you don't need it, and it's the one number someone could
challenge.

Everything else in the script is defensible: NEX-GDDP-CMIP6, GRACE MASCON, USFS Wildfire
Hazard Potential, NOAA SLR, FEMA NRI 2.0, USGS.

---

## Numbers you may be asked for

| | |
|---|---|
| Factories tracked | 36 · $455B total investment · $45.2B CHIPS Act funding |
| AI data centers | 20 · $600B+ · 15+ GW power capacity |
| Metros scored | 52 |
| Projection range | 2025–2095, 8 decades |
| Scenario shown | RCP 4.5 (moderate); resilience index uses ssp585 (high) |
| Dams / rivers | 29 dams · 28 rivers, 18 with flow projections |
| Jobs promised vs delivered | 127,485 vs 39,935 — 31.3% |

That last row isn't in the script, but it's the most arresting number in the dataset and
it demonstrates the depth of what's tracked. Worth having ready if the conversation turns
to whether the industrial buildout is going to plan.

---

## If you want a shorter cut

For a 60-second version, keep the cold open, the aquifer reveal, and the resilience
leaderboard with the weight slider. Cut the wildfire and sea level beat and the report
walkthrough. The argument survives; the feature tour doesn't.
