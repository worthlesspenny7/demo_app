# 11c - Frames: Hacking, Timewise install, X-Cup chart tool, Packard sample chart

Sources: 12 `hacking-*` frames (one every 30 s), 12 `timewise-*` frames (4 moments x -3/+0/+4), 9 `xcupcharts-*` (3 moments x 3
variants) and 3 `prepcharts-*` frames (1 moment x 3), all in `docs/research/frames/`. Every frame was viewed. Crops of the spreadsheet frame were
upscaled 3x to read cell text. Context read first: `10c-short-videos.md`, `08b-rookie-handbook-appendices.md` (App B/C),
`08-rookie-handbook-body.md` s3, SPECS CHART-001..006 and CAL-005/006, `src/core/drills/d06.ts`, `src/core/perf-table.ts`,
`src/ui/viewmodels/charts.ts`, `src/core/calibration.ts`.

Honesty notes
- Frame filenames are the 10c section-11 guesses. Several do NOT show what the name says (see 3.1: the "05m33s chart-creation-tool"
  frames show a talking head and a drone shot, not the spreadsheet; the "02m37s Packard" frames show the booklet cover and a
  semi-transparent page cross-fade whose cells cannot be read).
- Screen text inside the Timewise video is almost all unreadable at 1280x720 (no part numbers other than the manual cover title).
- "Inferred" marks anything I derived rather than read.

---------------------------------------------------------------------------------

## 1. Hacking

### 1.1 Frame by frame (t = 30 s x (n-1) if frame 001 is t = 0; the spacing is given, the offset is my assumption)

All twelve frames are the same shot: Jeff Stumb (grey hair, goatee, black Great Race polo with the pocket logo) in front of a red brick
wall, the same set as the other Jeff Stumb how-to videos (and the prepcharts frames). No props, no hands-on demonstration, no diagram,
no screen, no stopwatch or watch is shown at any point. The only information on screen is the lower-third text overlays.

| Frame | t (approx.) | On screen |
|---|---|---|
| 001 | 0:00 | Great Race logo (yellow racer #1) top-left and the white caption "HOW-TO'S" under it: the series banner. Jeff speaking, leaning forward, hands low. |
| 002 | 0:30 | No overlay. Jeff to the right of centre, head tilted, mid-sentence. |
| 003 | 1:00 | White caption, two blocks: "DON'T PANIC" / "TURN AROUND & BACKTRACK". |
| 004 | 1:30 | Same two-block caption still up ("DON'T PANIC / TURN AROUND & BACKTRACK"). |
| 005 | 2:00 | No overlay. Jeff talking, looking left. |
| 006 | 2:30 | White caption, three lines: "FIND THE ORDER OF / START AND YOUR / POSITION". |
| 007 | 3:00 | No overlay. Jeff leaning left, right hand raised flat (a "stop"/"hold" or "level" gesture). |
| 008 | 3:30 | No overlay, camera re-framed (closer, Jeff centred). |
| 009 | 4:00 | No overlay, same closer framing, hand gesturing at the bottom edge. |
| 010 | 4:30 | No overlay, closer framing, Jeff looking down (reading or thinking). |
| 011 | 5:00 | Full logo and the caption `"HACKING"` (quotation marks included). Jeff speaking. |
| 012 | 5:30 | Same logo and `"HACKING"` caption. Jeff speaking. |

Observations
- The camera framing changes between 007 and 008 (wide to close): an edit point, probably two takes.
- The `"HACKING"` title card is at the END of the sampled run (5:00 and 5:30 of a 5:54 video), not the start; the start card says
  "HOW-TO'S". Either the video is cold-open with the title appearing late (a recap/outro card) or the first frames belong to the
  series bumper. I cannot tell which from stills.
- The quotation marks around HACKING mark it as slang: a term of art Jeff explains, not a general-English "hacking".
- Speech exists (his mouth is moving in every frame) but the auto-captions failed, which is why `Hacking.txt` was empty.

### 1.2 What the video demonstrates

It is NOT a watch synchronisation ("hack" a second hand to a reference), NOT a Timewise procedure and NOT an app. It is a talking-head
tutorial on "hacking" in the Great Race sense: re-establishing where you are in time/position from other cars when you are lost or
unsure, with the recovery steps shown as captions:

1. "DON'T PANIC" (the same words as in every Jeff video and in the 2026 rally school).
2. "TURN AROUND & BACKTRACK": when you realise you are off course, do not press on; go back to where the course was.
3. "FIND THE ORDER OF START AND YOUR POSITION": use the start order to know which car is a minute ahead of you and which a minute
   behind, to work out how late you are and where to rejoin.
4. `"HACKING"` (closing card): the term for taking a time reference off another car (or a landmark a car passed).

Independent support for this reading (all already in the repo, none are frame evidence):
- `transcripts/txt/2024 Great Race Training Session.txt` [117:43-121:49]: "use all the information available at your disposal and that
  may involve hacking off of other parts and we'll tell you how to do that another time maybe over a beer"; then the lost doctrine:
  pull over, check whether the car one minute behind arrives, turn around and backtrack with the stopwatch, "you have your order of
  start and you know that car is 10 minutes behind you so you're 10 minutes late", write the leg off, rejoin 30 s behind a car you know
  is on course. The three captions in frames 003-006 are the headings of exactly that passage.
- `01-great-race-rules-and-format.md` l.208: a 2003 diary calls the re-sync after being one instruction out of step a "reverse hack".
- `transcripts/txt/2026 Great Race Training Session.txt` [125:28-126:31]: "give yourself a little hack along the way. It's not official. It's
  not exact", i.e. pick a landmark (a hickory tree at a bridge), note when the car ahead (a minute in front) passes it and when you
  do, to see whether you run fast or slow.

Conclusion: "hacking" = using other cars (their start-order gaps) and landmarks as an unofficial time reference to find out how early or
late you are, and the video's frames show its lost-recovery use (backtrack, then use order of start to quantify lateness). Confidence:
high for the topic (captions plus the three independent passages), medium for the exact definition Jeff gives, because the audio is not
available. A human should listen once to the audio to confirm his definition.

### 1.3 What the simulator should take from it

The recovery content is already in the spec (LOST-001, `src/core/drills/lost.ts`, LESSON-008) but the frames add three things:
1. Order of the recovery steps: (1) stay calm, (2) turn around and backtrack to a known point, (3) use the order of start to compute how
   late you are. LOST-001 has steps for stopwatch, doubling and rejoin; it has no "who is a minute ahead/behind me" step. Add it to the
   lost guidance text (`LOST_GUIDANCE` in `src/core/drills/lost.ts`) and to LESSON-008.
2. A "hack" is a rough, unofficial reference: add a debrief/lesson note "the car one minute behind you is your clock when lost" and the
   2026 landmark trick (note when the car ahead passes a fixed object). Optional engine feature: when the scenario has a ghost car one
   minute ahead/behind (not currently simulated), a "sighting" event to give the player a +-10 s clue. Low priority.
3. Nothing to do with watches: do NOT change WATCH-/LESSON-006 on the strength of this video.

---------------------------------------------------------------------------------

## 2. Timewise install frames

Setting: a university motorsports shop (concrete floor, blue engine hoist/lift stand, red "Blue-Point ACT2 AUTO AIR SERVICE CENTER III"
tool chest, pegboard with wrenches, a blue Kobalt tool box). Presenters wear black/red polos reading "ALFRED STATE MOTORSPORTS
TECHNOLOGY" (the caption "Alpha State" in 10c is a mis-hearing); a fourth man wears a grey shirt with a "... COBRA EXPERIENCE" logo.
Demo car: a cream/white 1940s Ford (a "FORD Business Coupe" lettering is reflected in one frame), fitted with front disc brakes, a
Bilstein-type coil-over shock, a chrome-ring steering wheel and a round dash gauge.

### 2.1 Kit contents (timewise-00m30s, three frames)

- +4 frame (clearest): a presenter holds up a white booklet. Cover text, legible: "Timewise Model 825", "Analog Reading Electronic
  Speedometer", "User's Manual", over a photo of a dial.
- Lower-left overlay (white serif text; present in +0 and +4; the -3 frame is a group shot with no overlay):

      Included in the Box:
        1. User Manual
        2. Timewise Speedometer
        3. Transducer Cable
        4. Magnets
        5. 12v Power Supply Cable

  (10c had four items and had the transducer "included this year with the Alpha magnets"; the overlay is the authoritative list: five
  items, and the power cable is explicitly "12v".)
- No part numbers, serial numbers or switch labels are readable in these frames. The speedometer itself is not shown in this moment; the
  presenter holds only the manual.
- -3 frame: four men stand in the shop (the Cobra Experience man, two Alfred State students, one more Alfred State man in a cap); a
  tyre on a black steel wheel lies in the foreground and a cardboard tabletop with a red wire at the bottom left is where the kit sits.

### 2.2 Transducer and the popsicle-stick gap (timewise-01m30s)

- All three frames: the front-left corner of the car on a lift with the wheel removed. Hub, disc rotor, caliper and ball joint are bare.
  The Timewise transducer is a thin grey signal cable that runs from the inner fender/frame (cable clamp near the upper control-arm
  pocket) down to a small bracket at the steering knuckle, next to the lower ball joint / tie-rod end area. A hand points at the
  mounting point (+0, +4: hand at the knuckle bracket; -3: the same view in a wider shot).
- The sensor body is a small cylinder on a bracket (silver/white hardware, small clamp), visible in +4 near the lower ball-joint
  region. No label on it is readable.
- The popsicle sticks themselves (three glued together, per the speech) are not clearly visible in any of the three frames; the gap
  between sensor face and magnet is therefore not measurable from the stills. The sensor mounts on the non-rotating knuckle and the
  magnet on the rotating wheel: the thing being set is the radial/axial gap.

### 2.3 Magnets on the rim (timewise-02m30s)

- +0, +4: the Cobra Experience man crouches next to a black steel wheel with a tyre ("...GY ST" sidewall text), pointing at the inside
  of the rim flange; the wheel face shows the lug pattern and hub opening with a centre cap or hub spacer.
- -3: close-up of the inside edge of the black rim with the tyre ("HANKOOK"/"Hankook" lettering). Near the 4-5 o'clock position of the
  rim flange there is a white rectangular patch with a lighter strip beside it: that is the only thing that could be a magnet bonded
  to the rim (inferred; the colour is not what a magnet looks like, so it may be epoxy or tape). I cannot see two magnets, a
  diametrically opposed pair or the "2 pulses per revolution" arrangement. Surface paint is scuffed around it (preparation).
- No epoxy brand is visible (the speech says JB Weld).

### 2.4 Cabin mount and the face (timewise-05m00s)

- +0: interior of the Ford from the passenger side: the student holds a black cylinder (the Timewise unit, a round can) up near
  the steering wheel; overhead there is a red/black shop light on a boom. No standard mount is seen on the dash; the unit is simply held.
- +4 (the clearest for the back of the unit): the student holds the BACK of the unit: a black round case with a red and a black lead
  going into a plug (the 12 V supply cable), and on the back panel a ring of small holes and printed marks (factor switch windows and
  connector cut-outs; the digits and arrows printed there are NOT legible). Consistent with the speech "adjust the factors on the back"
  (HB App C: four factor switches).
- -3: wider shot, the student gestures at the dash; at the bottom edge of the frame the front face of a Timewise is visible: round white
  dial, red needle, a small red/blue logo, black bezel, sitting low by the steering column below the wheel rim. Scale numbers are not
  readable.
- Dash items: a round white gauge in a bracket on the dash left of the wheel (original Ford speedometer or the unit?), a "Floyd's
  Deluxe Lager" sticker on the wheel hub area and a lime-green tape mark on the wheel rim (a visual 12 o'clock reference).

### 2.5 What matters for the simulator

Nothing here changes timing maths. Only the kit list is new in a checkable form (12 V supply cable; transducer cable; magnets;
manual). Install-lesson candidates are as in 10c ranked item 8 (low priority). Weak evidence for a visual: the unit is a round black
can with a white dial and a red needle, with the supply leads and factor switches on the back.

---------------------------------------------------------------------------------

## 3. X-Cup chart-tool frames

### 3.1 What each frame set shows

| Set | Frames | What is really there |
|---|---|---|
| `xcupcharts-01m46s` | -3, +0, +4 | Three caption cards over live footage: (+0) Step 4 over a straight rural road with a wooden telephone pole and the cream wagon's nose at lower right; (+4) "Note:" card over the road looking away from the car (another car approaching in the distance); (-3) Step 4 over the three presenters. |
| `xcupcharts-05m33s` | -3, +0, +4 | (-3) Drone shot of the car passing a pole with a stopwatch overlay; (+0, +4) "Step 5" over the three presenters. The spreadsheet and yellow help boxes are NOT in these frames. |
| `xcupcharts-07m04s` | -3, +0, +4 | Three identical frames of the spreadsheet (macOS Excel) with a two-line caption. This is the real data source for the transcription. |

Caption texts, verbatim (white sans on a dark bar):
- Step 4: "Pick checkpoints. Use something that will never move (i.e. mailboxes, telephone poles, signs, etc.)"
- Note: "Distance between 2 checkpoints does not matter, providing it stays the same for all runs."
- Step 5: "Fill out 4 runs for each speed, timing between checkpoint 1 and 2."
- Over the spreadsheet: "Double-check there are no negative numbers in the completed CHART tab." / "If negative numbers are present, check for
  large discrepancies in each speed run."

(So the video is a captioned step-by-step: steps 1-3 precede the frames I have, and step 4 is picking checkpoints; "Step 6+" holds the
spreadsheet.)

### 3.2 The test course

- A straight, flat, two-lane tarmac country road in farmland (Auburn, Indiana region per 10c), bare trees, a house, a grain elevator on
  the horizon. The "checkpoints" are fixed roadside objects: a telephone pole on the left in the first frame (with orange survey
  flags/stakes in the field nearby), a mailbox on a post and a small yard sign visible in the +4 frame, plus a second pole farther down
  the road. No cones, no tape, no painted lines, no measured pole spacing is shown or captioned. The note says the distance does not
  matter as long as it is the same on every run.
- Stopwatch overlay in the -3 drone frame (a Mac stopwatch widget): large "00:18.83"; table below: columns "Lap No.", "Split", "Total";
  row "Lap 1", "00:18.84", "00:18.84". The cream 1957 Plymouth wagon (race plate "24") is passing the pole at the left. So one of the
  25-mph runs took about 18.84 s (consistent with the spoken "roughly 19 / about 18 / 17").
- Inference: 18.8 s at 25 mph (36.7 ft/s) is about 690 ft between the checkpoints, a much shorter course than the handbook's
  about 40 s at 50 mph (about 2,900 ft).
- The car: cream body, gold roof, decals "HEMMINGS.COM", "McCollister's Auto Transport", "COKER TIRE".

### 3.3 Spreadsheet transcription (frame 07m04s, all three variants identical)

Application: Microsoft Excel for Mac (ribbon visible: Paste, B I U, borders, fill, font colour, alignment, "Conditional Formatting",
"Format as Table", "Cell Styles", "Delete", "Format", "Sort & Filter", "Find & Select"). Name box "Q33" (an empty cell is selected; the formula bar is
empty). Visible columns A-Y; rows 4 to about 41. The sheet is scrolled so rows 1-3 are off screen; the bottom of the window is
darkened by the caption bar, and the sheet-tab strip at the very bottom is illegible (the caption names the "CHART tab").
Green triangles at the top-left of the numeric cells mark Excel error/inconsistency flags.

**Block 1 (rows 3-15), grey title bar row 4: "ACCELERATION"**

Row 3 is cut off at the top; the visible fragment reads: `If 4.5 seconds are lost, start 4.5 seconds earlier` (the Packard 0>40
example from the handbook, now a sheet caption).

Vertical side label (rows 6-14, grey bar): "BRAKING". Column headers (row 5) C5:L5 = 0, 15, 20, 25, 30, 35, 40, 45, 50, 55.
Row headers (B6:B15) = 0, 15, 20, 25, 30, 35, 40, 45, 50, 55. Cells (grey filled = diagonal, no value):

| row \ col | 0 | 15 | 20 | 25 | 30 | 35 | 40 | 45 | 50 | 55 |
|---|---|---|---|---|---|---|---|---|---|---|
| **0** (r6) | grey | #DIV/0! | #DIV/0! | **-1.7** | #DIV/0! | #DIV/0! | #DIV/0! | #DIV/0! | #DIV/0! | #DIV/0! |
| **15** (r7) | #DIV/0! | grey | #DIV/0! | #DIV/0! | #DIV/0! | #DIV/0! | #DIV/0! | #DIV/0! | #DIV/0! | #DIV/0! |
| **20** (r8) | #DIV/0! | #DIV/0! | grey | #DIV/0! | #DIV/0! | #DIV/0! | #DIV/0! | #DIV/0! | #DIV/0! | #DIV/0! |
| **25** (r9) | **-2.7** | #DIV/0! | #DIV/0! | grey | #DIV/0! | #DIV/0! | #DIV/0! | #DIV/0! | #DIV/0! | #DIV/0! |
| **30** (r10) | #DIV/0! | #DIV/0! | #DIV/0! | #DIV/0! | grey | #DIV/0! | #DIV/0! | #DIV/0! | #DIV/0! | #DIV/0! |
| **35** (r11) | #DIV/0! | #DIV/0! | #DIV/0! | #DIV/0! | #DIV/0! | grey | #DIV/0! | #DIV/0! | #DIV/0! | #DIV/0! |
| **40** (r12) | #DIV/0! | #DIV/0! | #DIV/0! | #DIV/0! | #DIV/0! | #DIV/0! | grey | #DIV/0! | #DIV/0! | #DIV/0! |
| **45** (r13) | #DIV/0! | #DIV/0! | #DIV/0! | #DIV/0! | #DIV/0! | #DIV/0! | #DIV/0! | grey | #DIV/0! | #DIV/0! |
| **50** (r14) | #DIV/0! | #DIV/0! | #DIV/0! | #DIV/0! | #DIV/0! | #DIV/0! | #DIV/0! | #DIV/0! | grey | #DIV/0! |
| **55** (r15) | #DIV/0! | #DIV/0! | #DIV/0! | #DIV/0! | #DIV/0! | #DIV/0! | #DIV/0! | #DIV/0! | #DIV/0! | grey |

Layout reading: rows are the speed you START at (the "BRAKING" side), columns the speed you END at (the "ACCELERATION" top). Same
orientation as HB App B s1.5 (row 0 = acceleration from a stop, column 0 = braking to a stop). The only two filled cells are
C9 = **-2.7** (row 25, col 0: braking 25 to 0) and F6 = **-1.7** (row 0, col 25: accelerating 0 to 25). Both are NEGATIVE.
10c only mentioned the -2.7; the -1.7 is new. (The grid is 10x10 with the 55 row and column; the HB grid is 9x9 to 50.)

**Block 2 (rows 18-33): yellow title bar row 18: "Start / Stop Lost Time"**

- Row 19: `Instead of pausing for alloted "15" seconds, pause for this amount of time` (sic, "alloted")
- Row 20: `This accounts for accel/decel lost time as well.`
- Row 21 grey bar: "OUT speed". Row 22 headers: 15, 20, 25, 30, 35, 40, 45, 50, 55 (nine speeds, no 0). Side label (grey): "IN speed". Row headers rows 23-31: 15, 20, 25, 30, 35, 40, 45, 50, 55.
- All 81 cells show #DIV/0! except one: the cell at IN 25 / OUT 25 (row 25, column E) = **19.3**.
- Row 32 footnote: `(START/STOP TIME)-(accel IN + accel OUT)`.

**Block 3 (rows 35-41, partly hidden by the caption)**

- Row 35: olive/yellow title bar "TURNS". Row 36: a subtitle line, illegible (it contains the word "to" and "turn"; probably the handbook
  "to ... 15 mph" turn explanation). Row 37 grey "OUT speed". Row 38 headers 15, 20, 25, 30, 35, 40, 45, 50, 55.
- Row 39 (IN 15): column 15 = **0.0**, the rest #DIV/0!. Rows 40-41 hidden behind the caption (visible only as #DIV/0!).
  (0.0 at 15>15 rather than #DIV/0! shows that cell does not depend on the run data: a 15 mph turn loses nothing, as in HB
  App B Table B-7.)

**Block 4 (data entry): NOT VISIBLE in any frame.** The run-time input tab (constant-speed runs 1-4, accel runs, brake runs and
averages, the 19.8 / 19.9 / 19.1 / 19.8 column) and the yellow help boxes are on other tabs/screens that the sampled frames miss. Only
the narration (10c [06:34], [07:04]) tells us they exist: seconds only; yellow help text on the right; the average
cells; the 19.1 outlier.

### 3.4 Reconstructed arithmetic (inferred, consistent with the spoken numbers)

- 10c: constant-speed runs at 25 mph "19.8, 19.9, 19.1, 19.8": mean 19.65 (19.83 without the 19.1).
- Spoken single runs: "roughly 19", "about 18", "again 25 mph, we had 17". If the acceleration average is 18.0 and the braking average 17.0:
  accel = 18.0 - 19.65 = -1.65 (printed -1.7) and braking = 17.0 - 19.65 = -2.65 (printed -2.7). Both match the grid, and the
  Start/Stop cell is then 15 - (-2.65) - (-1.65) = 19.30, exactly the printed 19.3. So the formula in the footnote is the handbook rule
  pause = 15 - brake_loss(IN to 0) - accel_loss(0 to OUT), with "accel IN" meaning the braking loss from IN, "accel OUT" the start loss to OUT.
  This is inference, but three printed numbers reproduce from it.
- Moral the video draws: the run times are impossible (a start or a stop can never be FASTER than a flying run), so the negative net
  loss is the symptom; the cause is a bad run in the denominator (the 19.1) and/or bad accel/brake runs. The fix is to re-run and
  re-average, not to trust the tool.
- A negative net loss pushes the stop-and-go pause ABOVE 15 s (19.3): impossible for a car (it would mean sitting longer than the
  sign), another visible symptom.

### 3.5 Differences vs the handbook layout (App B) worth keeping

| Item | Handbook (08b s1.5-1.6) | X-Cup sheet (frames) |
|---|---|---|
| Speeds | rows/cols 15-50 (8 speeds), 0 row/col for accel chart | 15-55 (9 speeds), 0 row/col for the accel chart only |
| Accel chart labels | columns "ACCELERATION", rows "BRAKING" | same, plus grey title bar "ACCELERATION" and side bar "BRAKING" |
| Pause chart labels | "IN speed" rows, "OUT speed" columns; "15 sec. stop" | "IN speed"/"OUT speed"; header "Start / Stop Lost Time"; text "Instead of pausing for alloted '15' seconds, pause for this amount of time. This accounts for accel/decel lost time as well." |
| Pause formula text | prose: add the braking loss to the acceleration loss and subtract from 15 | footnote "(START/STOP TIME)-(accel IN + accel OUT)" |
| Turns | slow to 15 mph, brk(IN->15) + acc(15->OUT) | "TURNS" table, same 15/15 = 0.0 |
| Course | about half a mile; about 40 s at 50 mph | any distance, constant for all runs (video: about 19 s at 25 mph) |
| Braking end point | front wheels at the end marker; stop the watch when the car rocks back | (speech) front bumper touching the second checkpoint |
| Inputs | paper tables | spreadsheet; seconds only; 4 runs per speed |
| Error check | "if you have a lot of variation, make more runs" | "Double-check there are no negative numbers in the completed CHART tab. If negative numbers are present, check for large discrepancies in each speed run." |

---------------------------------------------------------------------------------

## 4. The 1936 Packard sample chart frame (prepcharts-02m37s)

### 4.1 What is shown

- -3 and +0: the booklet cover filling the left third of the frame (white page, Great Race logo with crossed green and chequered flags
  over a US-flag shield and "WWW.GREATRACE.COM"); below, bold: "Preparing for the Great Race"; "A Guide for Rookies and Returning
  Teams"; "Prepared By: Bill Croker"; "Revised: September 2015". This confirms the edition (Sept 2015, as in `08-rookie-handbook-body.md`
  header), and answers the 10c doubt about "page 32, Appendix II" (the booklet is the same 2015 edition; page numbering aside).
- +4: a cross-fade from the cover to the interior pages: three semi-transparent page images overlaid on the brick wall at the left, the
  upper-left one headed **"Car Calibration"**. The pages contain (a) body text, (b) a grid with a grey diagonal and left labels that read as
  "START / SPEED" (the acceleration-deceleration chart), (c) a second grid with the header "OUT SPEED" and an "IN" side label (the stop
  & go pause chart), and (d) a third grid lower left (turns). Only fragments of the prose are legible: "The times on this chart are
  ... the actual acceleration and deceleration ...", "...a 4.5 ...", "The second chart is the STOP & GO PAUSE TIMES" and "STOP & GO
  PAUSE TIMES (15 sec. stop)" above the pause grid.
- Even at 4x magnification no table cell can be read reliably (transparency over brickwork, 1280x720 source).

### 4.2 Comparison with the handbook tables (08 s3, cell by cell)

No cell can be confirmed or contradicted from this frame. What can be checked is structure only:

| Item | Frame | Handbook s3 | Match |
|---|---|---|---|
| Section heading | "Car Calibration" | "3. Car calibration (p.7-9)" | yes |
| Chart order | acceleration-decel grid, then stop & go pause, then turns | 3a, 3b, 3c | yes |
| Chart (a) row/col labels | "START SPEED" on rows | "start\end" | yes |
| Chart (a) grey diagonal | present | "-" on the diagonal | yes |
| Chart (b) title | "STOP & GO PAUSE TIMES (15 sec. stop)" | "Stop & Go pause times (15 s stop)" | yes |
| Chart (b) headers | "OUT SPEED" across, "IN" down | in\out | yes |
| Prose | "NOT the actual accel/decel times"; "start 4.5 seconds earlier" | same quote and 0 to 40 = 4.5 | yes |

The X-Cup sheet's row-3 caption "If 4.5 seconds are lost, start 4.5 seconds earlier" is copied from this page, so the Packard 0>40 = 4.5
and 30 in / 40 out = 8.6 values (CHART-002) are uncontested. A cell-level check needs a clean image of printed pages 7-9 (the
Handbook PDF itself, not the video).

---------------------------------------------------------------------------------

## 5. Differences from the simulator

### 5.1 D06 (`src/core/drills/d06.ts`)

D06 hands the player the IN>OUT marker lines and asks for the NET LOSS of each pair ("stopgo 30>40 = 8.4", "accel 0>40 = 4.5"), judged
to within 1 s; `parseChartRuns` accepts "runs a b c d" lists of those net values. The real tool and the real workflow differ:

1. Raw runs, not net losses. The X-Cup tool takes RAW course times in seconds (4 per speed for each of three run types:
   constant-speed, from a standstill, braking to a standstill) and COMPUTES the net losses as average minus the constant-speed
   average, then the pause as 15 - brk - acc. D06 skips that arithmetic. Change `d06.ts` so the player can enter timed runs
   ("const 25 runs 19.8 19.9 19.1 19.8", "acc 25 runs ...", "brk 25 runs ...") and have `parseChartRuns` + the rubric derive the net
   loss; keep the current "stopgo 30>40 = 8.4" form as the shortcut. The scenario already measures against the ghost, so the "constant"
   runs equal the ghost time between the marks (a flying pass); that needs a third marker pair (new pair kind `flying` / `const`).
2. Negative-loss flag is on the wrong quantity. `parseChartRuns` flags a negative NUMBER the player typed as an "outlier": but in the real
   tool the negative appears in a derived CHART cell (-1.7, -2.7), and its cause is a discrepant run (19.1 among 19.8/19.9/19.8). Add:
   (a) a negative-cell warning that reads like the caption ("Double-check there are no negative numbers in the completed CHART tab. If
   negative numbers are present, check for large discrepancies in each speed run."), (b) detection of the run that deviates most from
   the others (e.g. > 0.5 s or 2 sd) and naming it, (c) the pause > 15 s symptom (19.3 for 25/25).
3. Speeds and grids: the tool is 15-55 with a 0 row and column on the acceleration chart only; D06 picks its pairs from 20/25-55. Add 15 and
   keep 0 only for the accel chart; show the diagonal as a grey blank.
4. Course and distance: D06's marks are fixed 0.2-mile steps; the video says distance does not matter if constant, and uses roadside
   fixed objects, 4 runs per speed, per driver. Tell the player (objective text) that the distance is irrelevant provided it is the same on
   every run, and that a mark must be something that never moves.
5. Braking end point: the video says front bumper at the second checkpoint; the handbook (and REG VII.E.2.b) say front wheels. D06 uses the
   marker lines; state the rule once in the objective ("front wheels at the mark").
6. Per-driver and 4 runs: already implemented (driver A/B tags and runs lists).
7. Bronze copies the Packard: keep; the frame shows the booklet cover and "Car Calibration", so the Bronze hand-out can use that artwork
   or label ("1936 Packard 120B, Preparing for the Great Race, Revised Sept 2015, p.7-9").

### 5.2 Chart layout (`src/ui/viewmodels/charts.ts`, rendered in `src/ui/screens/cockpit.ts`)

`chartGrids` builds the three grids as IN rows x OUT columns with titles "Acceleration - deceleration", "Stop & go pause times",
"Turns". Changes suggested by the sheet and booklet frames:
1. Add the axis labels as printed: accel chart "BRAKING" (rows, vertical) and "ACCELERATION" (columns); pause and turn charts "IN speed"
   (rows) and "OUT speed" (columns); grey diagonal cells flagged `blank: true` (currently printed as 0.0).
2. Add the three captions verbatim to `TITLES`: accel: "If 4.5 seconds are lost, start 4.5 seconds earlier" (the example: 0 to 40 = 4.5);
   pause: `Instead of pausing for the allotted "15" seconds, pause for this amount of time. This accounts for accel/decel lost time as
   well.`; and the footnote "(START/STOP TIME) - (accel IN + accel OUT)" as the formula under the pause grid.
3. Chart (b) title: add "(15 sec. stop)" as in the booklet; turn chart title "TURNS" with the 15 mph-apex sentence.
4. Show #DIV/0! equivalents for unmeasured cells in the player's own chart (an empty cell shows "-" or blank, not 0.0); a negative cell
   renders in a warning colour.
5. Speeds list: the sheet and the HB differ (15-55 vs 15-50); `m.speeds` already comes from the car's matrix; make sure the 0 row/col
   appears only in chart (a).

### 5.3 Calibration lesson (CAL-005/006, CHART-005)

The Timewise frames show only the install (kit, transducer, magnets, mount, the back of the unit); the video has no calibration
procedure. Therefore:
- `src/core/calibration.ts` (`timewiseAdjustment`, `adjustFactor`, `clicksPerSecondPerHour`) and the reference text (`src/ui/screens/reference.ts` l.121)
  need NO change.
- One addition to the lesson that explains the factor (reference/school text): the factor is set on switches on the BACK of the unit
  (frame 05m00s+4: ring of holes and printed marks with a red/black power lead), so the in-race adjustment is a small
  screwdriver job in the car (as HB App C and App F say). A picture of the back of the unit is the missing illustration.
- Hacking frames add nothing to calibration; they belong to the lost-recovery lesson (LESSON-008, LOST-001), see 1.3.
- Install-lesson (optional, low): kit list (manual, speedometer, transducer cable, magnets, 12 V power supply cable), transducer on the
  knuckle of a non-driven wheel, two magnets, gap about 3/8-5/8 in with three popsicle sticks (speech), 12 V only.

### 5.4 Spec deltas vs CHART-001..006

| ID | Delta from these frames |
|---|---|
| CHART-001 | Add: grids carry the printed axis labels (BRAKING/ACCELERATION; IN speed/OUT speed), grey blank diagonal, the 15 mph turn cell = 0.0; the 15-55 range with the 0 row and column only in chart (a). The caption strings in 5.2 are the reference text. |
| CHART-002 | No change (Packard values unverifiable from the frame, structure matches). Add the cover identification (Bill Croker, rev. Sept 2015) to the Bronze hand-out. |
| CHART-003 | None. |
| CHART-004 | Add the sheet's own phrasing of the pause rule: "Instead of pausing for the allotted 15 seconds, pause for this amount of time; this accounts for accel/decel lost time as well" and the footnote "(START/STOP TIME)-(accel IN + accel OUT)". |
| CHART-005 | None (the Timewise video has no calibration). |
| CHART-006 | Rewrite: the D06 tool accepts raw run times in seconds for THREE run types (constant, from standstill, braking), 4 per speed per driver, computes net loss = average - constant average and the pause = 15 - brk - acc; a NEGATIVE derived cell (the demo shows -1.7 at 0>25 and -2.7 at 25>0, giving a 25/25 pause of 19.3 s > 15 s) triggers "check for large discrepancies in each speed run"; the run furthest from the others is named (19.1 against 19.8/19.9/19.8); recommended fix is to re-run and re-average rather than delete the run. Distance between marks does not matter if constant; marks must be fixed objects (pole, mailbox, sign). |
| CAL-005, CAL-006 | None. |
| LOST-001 / LESSON-008 (new) | Add the order-of-start step ("find the order of start and your position": the car one minute behind is your clock) and the "don't panic, turn around and backtrack" ordering; define "hack" as an unofficial time reference off other cars or landmarks (2026 session [126:31]). |

---------------------------------------------------------------------------------

## 6. Open items for a human

1. Listen to the audio of `Hacking` once to confirm Jeff's definition of "hacking" (the stills only prove the lost-recovery topic).
2. The yellow help boxes and the run-entry tab of the X-Cup spreadsheet are not in the sampled frames; grab frames around 6:04-6:50 of the
   charts video (the `xcupcharts-05m33s` set is mis-timed or mis-named).
3. A clean image of the Handbook p.7-9 charts is needed for a cell-level check of the Packard tables (the video only cross-fades them).
4. Timewise back-panel switch labels and any part numbers: take a close frame near 5:00-5:20 of the install video.
