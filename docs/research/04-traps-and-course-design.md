# Traps and Course Design in TSD Road Rallies and the Great Race (research notes)

**Compiled:** 2026-10-03.

**Method / provenance note (read first).** The research container's egress proxy blocked direct page fetches for every rally source tried (zone8.org, mcnj.org, sdrscca.com, jcna.com, greatrace.com, the Great Race regulations PDF on bloximages/townnews, roadrallyhandbook.com, cokertire.com, hagerty.com, wikipedia, archive.org, etc. all returned 403/EGRESS_BLOCKED; only github.com was reachable). Everything below therefore comes from **web-search result summaries and snippets** of the cited pages, not from reading the full documents. Quotations are as returned by the search index. Where I could not get a snippet that states a thing, the item is marked **UNVERIFIED** and is based on general rally knowledge; treat those as hypotheses to confirm against a real General Instructions (GI) document before baking into the simulator. The session's web-search budget was exhausted mid-task (200/200), so several planned follow-up queries (listed in Appendix B) were never run.

Related file: `06-great-race-first-person-accounts.md` (same provenance caveat).

---

## 0. Framing: the three rally "flavors" and where traps live

- SCCA RoadRally distinguishes **Tour**, **Course (Trap)** and **GTA** rallies. "Tour rallies don't have tricky instructions, you just have to do the fairly simple instructions on time throughout the day." Course rallies "while continuing the timekeeping requirements of the Tour events, have instructions written purposely to tempt contestants into following a course other than the correct one ('traps'). The General Instructions for a Course Rally describe those rules and contestants are tested on their ability to follow those rules, observe signs and landmarks, and to follow specific directions." GTA ("Game-Tour-Adventure") rallies "do without average speeds or checkpoint timing, but require answers to specific questions about items along the route." Sources: https://scca-milwaukee.org/road-rally/ , https://racer.com/2016/04/06/how-to-start-racing-scca-roadrally , https://www.mohud-scca.org/roadrally/ , https://dk1xgl0d43mu1.cloudfront.net/user_files/scca/downloads/000/002/820/2009gtarallyhandbook.pdf
- "Course Rallies, also known as Trap Rallies, use route instructions usually based upon a set of precisely defined rules, and throughout the course, the rallymaster attempts to set traps, or trick you into either driving off-course, or off-time." https://www.kcrscca.org/our-racing/road-rally/
- Road Rally Handbook: "Trap events are those in which the course following aspect is deliberately tricky and based on a precise reading of the rule book." A trap "is an instruction that is easily misinterpreted." https://www.roadrallyhandbook.com/pdf/RRH.pdf ; https://www.wheelsrallyeteam.com/what-is-a-road-rallye/
- Rainier Auto Sports: "To add spice to the TSD format, the Generals can be used to 'trap' the rallyists. A rally that puts together a series of these 'traps' is often called 'tricky-trappy'." https://www.rainierautosports.com/reference/overview.htm
- Harvey Cain (Zone 8 PCA): "The goal of a rallymaster is to write instructions that contain traps." https://www.zone8.org/assets/docs/Rallying_for_beginners.pdf
- Indy SCCA novice tutorial calls traps "gotchas!" — "examples where the syntax of instructions can cause drivers to get off the intended route." http://www.indyscca.org/RallyFiles/Novice_3.pdf
- Clyde Heckler (Road Rally Handbook) advises novices "to concentrate on staying on course rather than staying on time." https://www.roadrallyhandbook.com/pdf/RRH.pdf
- **The Great Race is a tour-style TSD, not a trap rally.** Its regulations state: "The Race Route will never enter a private road, driveway, parking lot, unpaved road, or dead-end road without an instruction." https://bloximages.chicago2.vip.townnews.com/greatrace.com/content/tncms/assets/v3/editorial/c/dd/cdd7fcee-d4f6-43ba-8535-064d9ce6112e/6931b4f9a700a.pdf.pdf  Hagerty: the instructions "can be best described as cryptic. Road names are rare, stopwatches required, and speed changes abundant." https://www.hagerty.com/media/events/team-hagerty-great-race-2018/  So Great Race "traps" are mostly *unintentional*: ambiguous intersections, missed speed changes, miscounted landmarks, traffic. Still, the same GI vocabulary (T, Y, STOP, PAUSE, CAST, "1st paved road") applies, and the trap-rally literature is the best available formal description of how that vocabulary can be misread.
- Some clubs explicitly promise no timing traps: "There are no traps based on the location of speed changes." (PCA Sacramento Valley GIs) https://dl.motorsportreg.com/77342833-0e55-40f3-8393-e03f2f94cef3/

---

## 1. Catalog of classic TSD rally traps

Format for each: **Instruction text → What the road looks like → The trap → How to avoid.** Time costs are estimates (UNVERIFIED unless sourced).

### 1.1 Main Road Rule / "Straight as possible" (the foundation of every course trap)

- Definitions (sourced):
  - "The main road is the road that is most directly ahead. In the absence of an instruction, go as straight as possible." https://www.zone8.org/assets/docs/Rallying_for_beginners.pdf
  - "Straight as Possible: Proceed on the route that causes the least direction change from the direction you were traveling when the intersection was entered." (PCA Sacramento Valley GIs / JCNA Ch. 2) https://dl.motorsportreg.com/77342833-0e55-40f3-8393-e03f2f94cef3/ ; https://www.jcna.com/library/rally/chapter2.html
  - Rally WNY generals: "go straight as possible, without regard to road surface, name, number or markings, through all intersections until the next instruction applies." https://www.rallywny.com/rallywny/generals.htm
  - Indy SCCA on Main Road Determinants (MRDs): "rules that enable you to determine the main road to remain on until a numbered route instruction tells you to leave it, with the General Instructions stating one or more methods and their priority order." MRDs include "Straight ahead — where the main road is the road most directly ahead, requiring the least steering wheel input"; "Left/Right at [T] — at a T-intersection, the main road goes in the indicated direction when the road you're on ends"; "Pavement — where the main road is the paved option." http://www.indyscca.org/RallyFiles/Novice_3.pdf
  - SCCA-style "principal road" GIs (San Diego Region): "The principal road will always be obvious, and should cause no confusion. If you are to leave the principal road, or if there might be any doubt about which way you are to go, you will be given a route-following action." And: "There are intersections at which there is no principal road, such as Ts. At such an intersection, the rally route will be determined by a route-following action." Contestants "can also consider themselves off the intended route if they encounter an intersection (such as a T) where there is no principal road and where no route-following action applies." https://sdrscca.com/wp-content/uploads/2020/07/San-Diego-Region-SCCA-Road-Rally-GENERAL-INSTRUCTIONS-1.pdf
- **Trap: the "bear" that is really "straight."** Instruction: nothing (or `CAST 32` with no turn). Road: the pavement curves gently left; a lesser road continues dead-ahead (often gravel, narrower, or with a different surface). Under "straight as possible, without regard to road surface, name, number or markings" (Rally WNY) the correct action is the *least direction change*, which can be the lesser road straight ahead — OR, under a GI whose MRD priority puts "pavement" or "protected road" first, it is the curving pavement. The trap exploits the team not knowing which MRD priority their GI uses. **Avoid:** read the GI's MRD priority list before the start; at every fork with no instruction, consciously apply the *first* MRD that resolves it. (Mechanics UNVERIFIED beyond the definitions quoted above.)
- **Trap: curving main road vs. a side road that is "more straight."** The mirror of the above: the main paved road bends right; a paved side road continues straight. Under strict "least direction change" you take the side road. Teams who "follow the obvious road" go off course. This is the canonical course-rally trap implied by Harvey Cain's "most directly ahead" definition. https://www.zone8.org/assets/docs/Rallying_for_beginners.pdf (interpretation UNVERIFIED)

### 1.2 ONTO (the most-cited trap)

- Definitions: "ONTO — when placed onto a road by name or number, the rallyist is to continue on that road, however it may turn, until a subsequent course-directing Route Instruction is executed. That is, if the rallyist has been placed onto a road and that road makes a turn, the rallyist shall turn to follow the road in the absence of an instruction to do otherwise." (Richta GPS Addendum to GIs, SCCA) https://cdn.connectsites.net/user_files/scca/downloads/000/053/170/Richta%20GPS%20Addendum%20to%20the%20General%20Instructions%20-%20Updated%2011_22_2020.pdf
- Harvey Cain: "If a route instruction tells you to follow a road using the term 'onto', you must follow that road until a subsequent instruction of Straight, Left, Right, Turn or Follow. Watch for jogs to the left or right of the ONTO road." https://www.zone8.org/assets/docs/Rallying_for_beginners.pdf
- Rainier Auto Sports, on the trap itself: "A favorite trap is the ONTO trap. When instructed ONTO a road by name or number, you must stay on that road until instructed off. The Rallymaster finds a named road that turns right when the apparent main road seems to go straight. If the rallyist catches the signpost, they'll stay right, on that named road. The unwary will blunder on ahead until they realize their error or the rallymaster's plan sends them back onto the correct route." https://www.rainierautosports.com/reference/overview.htm
- MCNJ Rallye Tips: "An ONTO instruction means you must look for side roads labeled with the name that you are ONTO, and ONTO's are a form of a trap." https://www.mcnj.org/RallyeTips.htm
- **Instruction:** `Left onto Oak Rd` (three instructions ago). **Road:** a wide paved road continues straight; at an unremarkable intersection a small green street-name blade shows "OAK RD" pointing right onto a narrower road; the straight-ahead road's name has changed (its blade reads something else). **Trap:** the team, in "main road" mode, goes straight. **Avoid:** after any ONTO, the navigator's standing job is to read *every* street-name blade at every intersection and follow the named road wherever it turns, including jogs. ONTO ends only when a later course-directing instruction is executed. **Common wrong action:** straight on the apparent main road. **Time cost:** depends on how far until the next instruction fails to appear; Rainier notes rallymasters often design the wrong route to rejoin ("the rallymaster's plan sends them back onto the correct route"), so cost is often 1-5 min plus a missed checkpoint (estimate, UNVERIFIED).

### 1.3 AT vs AFTER vs ONTO interaction

- "An AT instruction directs you to turn at a specific place. It does not hold any priority after your turn. After an AT the team proceeds per Main Road Rules, and AT instructions cancel any previous ONTO." https://www.mcnj.org/RallyeTips.htm
- "AFTER: The referenced item will be before the point at which the action should take place." https://www.mcnj.org/RallyeTips.htm
- PCA Parade glossary: "After — Unless the instruction specifies otherwise, the indicated action is to be taken at the first opportunity following the designated landmark or sign." "At — 'even with' for speed changes, mileages and pauses; 'in the vicinity of' for turns and other instructions." https://mediaassets.pca.org/pages/microsites/parade2024/files/uploads/44736_pcars_2025_tsd_rally_appendix_vii.pdf
- Rally WNY: "AFTER refers to any navigational aid identified by the use of the word 'after,' which may be found anywhere along the rally route following the immediately preceding route instruction. AT refers to any navigational aid identified by the use of the word 'at' that will be visible along the rally route where the speed change or turn is to be executed. AWAY FROM is a turn in the opposite direction of the indicated navigational aid visible from the intersection." https://www.rallywny.com/rallywny/generals.htm
- **Trap A ("Right at 'Church'"):** Road: a church with a sign is visible from the intersection but the turn is 50 yards *before* reaching the sign. Because AT means "in the vicinity of" for turns, you turn at the intersection from which the sign is visible, not at the next one. Teams who wait to pass the sign miss the turn. **Avoid:** for turns, AT = the intersection where the landmark is visible/in the vicinity; for speed changes/pauses AT = even with the landmark.
- **Trap B ("Right after 'Church'"):** the first right after the sign is a driveway or an unpaved road that doesn't count as a road under the GI; the *first opportunity* is therefore the next legal road. Teams turn into the driveway. **Avoid:** apply the GI "road"/"intersection" definition before counting opportunities. (UNVERIFIED mechanics; definitions sourced above.)
- **Trap C (AT cancels ONTO):** `Right onto Maple` then later `Left at STOP`. After the AT turn you are back on main-road rules, no longer bound to Maple; a team still "following Maple" turns with it when it jogs and goes off course. https://www.mcnj.org/RallyeTips.htm

### 1.4 T intersections

- "T: An intersection, roughly in the shape of a capital T. It must be approached from the bottom." https://sdrscca.com/wp-content/uploads/2020/07/San-Diego-Region-SCCA-Road-Rally-GENERAL-INSTRUCTIONS-1.pdf
- "A point at which a road terminates into another road running more or less at right angles to it, thus forming the crossbar of a capital 'T'. This term applies only when you are heading upward on the vertical bar of the T. It is not possible to go straight at a T." https://www.jcna.com/library/rally/chapter2.html ; https://dl.motorsportreg.com/77342833-0e55-40f3-8393-e03f2f94cef3/
- **Trap ("Left at T"):** Road: you pass an intersection where a side road comes in from the right and ends at your road — visually a T, but you are on the *crossbar*, not the stem. It is not a "T" per the GI. The real T is further on, where *your* road ends. Teams turn left at the first T-looking junction. **Avoid:** a T only counts when your road ends. **Variant:** a 3-way where your road ends but the cross road is at ~45° is a Y, not a T, per JCNA definitions below.
- Great Race usage: instructions such as "Left at STOP at T" and "Jog Left at STOP" appear in the GRIID/tulip-style instruction examples found. http://drscca.org/wp-content/uploads/2014/11/road_rally_104.pdf (the example instruction set) — note this is Scott Harvey's Detroit SCCA sample, not Great Race; applicability to the Great Race UNVERIFIED.

### 1.5 Y intersections

- "Y: A branching of roads in the general shape of the letter 'Y', requiring a turn to the left or right, both turns being substantially less than 90 degrees. This term applies only when you are heading upward on the vertical tail of the Y. It is not possible to go straight at a Y." https://www.jcna.com/library/rally/chapter2.html ; https://dl.motorsportreg.com/77342833-0e55-40f3-8393-e03f2f94cef3/
- **Trap ("Bear right at Y"):** Road: a fork where one branch goes nearly straight and one bears 30° right. Is this a Y? If one branch is a continuation (near-zero direction change) some GIs say it's not a Y (both turns must be "substantially less than 90°" *and* both must be turns). A team executes the instruction at a non-Y fork, then meets the real Y with no instruction left. **Avoid:** check that both branches require a turn.

### 1.6 Turn vocabulary: Turn / Bear / Jog / Acute

- "BEAR RIGHT (or LEFT): A turn in the indicated direction of substantially less than 90 degrees." "BEAR LEFT indicates a gentle change in direction to the left of roughly 45° and perceptably less than 90°." "ACUTE LEFT indicates a sharp turn or change in direction to the left of perceptably more than 90°." (Richta GPS addendum / PCA / JCNA, via search) https://cdn.connectsites.net/user_files/scca/downloads/000/053/170/Richta%20GPS%20Addendum%20to%20the%20General%20Instructions%20-%20Updated%2011_22_2020.pdf ; https://www.jcna.com/library/rally/chapter2.html
- "A 'jog' is defined as a turn at a T followed by a turn in the opposite direction a short distance away to continue in the same general direction." http://drscca.org/wp-content/uploads/2014/11/road_rally_104.pdf
- **Trap ("Bear Left"):** Road: at the intersection there is both a 45° left and a 90° left. "Bear" = the 45°. A team takes the 90° (a "Turn"). **Trap ("Acute Right"):** a >90° turn back on yourself — teams don't expect to double back and take the 90° right instead. **Trap ("Jog left"):** a T where you turn left then almost immediately right; teams forget the second half and continue on the crossbar. **Avoid:** map instruction word → angle band before arriving: Bear <90, Turn ≈90, Acute >90, Jog = two opposite turns.

### 1.7 Quoted sign text

- "When an instruction includes words, letters, numbers or symbols within quotation marks ('…'), you must see those words, letters, numbers or symbols on a sign along the rally route. When less than an entire sign is quoted in an instruction, a prominent portion will be used." https://dl.motorsportreg.com/77342833-0e55-40f3-8393-e03f2f94cef3/
- "Spelling will be accurate for signs quoted or identifying landmarks, but case and punctuation may be ignored. Signs may be quoted in full or in part. However parts of words or parts of numbers will not be used. Words or numbers will not be scrambled or rearranged." http://drscca.org/wp-content/uploads/2014/11/road_rally_104.pdf
- Rally WNY: "Material in quotes may be read from signs, which may be quoted in full or in part, with no distinction made. Spelling within quotes is important and must be exact." https://www.rallywny.com/rallywny/generals.htm
- **Trap ("Right at 'Smith Rd'"):** Road: the first right has a blade reading "SMITH ROAD" (not "RD") or "SMYTH RD" — not an exact match, so it does not satisfy the instruction; the correct one is further on. **Trap ("Left at 'Mill'"):** a sign reads "MILLER RD" — "Mill" is a *part of a word*, which the GI promises never to use, so this is not it. **Avoid:** letter-by-letter match; parts of words don't count; case/punctuation ignored.
- Sign side: PCA glossary abbreviations "SOL: Sign on left — The sign referenced in the instruction will be on your left as you pass it. SOR: Sign on right." https://mediaassets.pca.org/pages/microsites/parade2024/files/uploads/44736_pcars_2025_tsd_rally_appendix_vii.pdf  Some GIs only count signs on the right/facing you — the "sign on wrong side / facing away" trap (UNVERIFIED as to which clubs). Open checkpoints that stop cars "will be located on the right hand side of the road in your direction of travel." http://drscca.org/wp-content/uploads/2014/11/road_rally_104.pdf

### 1.8 STOP / SIGNAL / YIELD / Blinker

- Great Race definition: "STOP SIGN is defined as 'an official octagonal sign which requires traffic to stop.'" https://bloximages.chicago2.vip.townnews.com/greatrace.com/content/tncms/assets/v3/editorial/c/dd/cdd7fcee-d4f6-43ba-8535-064d9ce6112e/6931b4f9a700a.pdf.pdf
- PCA glossary: "Blinker — A warning signal at an intersection, consisting of a light or lights, usually red or yellow, operating in an alternating sequence of off and on." https://mediaassets.pca.org/pages/microsites/parade2024/files/uploads/44736_pcars_2025_tsd_rally_appendix_vii.pdf
- Cascade rallymaster guide: speed changes "referenced to an intersection (such as SIGNAL or T) are to be executed at the leading edge of the intersection." http://www.cascadegeargrinders.org/Files/CSCC_Rallymaster_Guide_2023.pdf
- **Trap ("Right at STOP"):** Road: the first right has a YIELD (triangle) or a flashing-yellow blinker, not an octagon; the next intersection has the octagon. **Trap (STOP sign for cross traffic):** an octagon faces the *side* road, not you — most GIs require the sign to control your direction of travel (UNVERIFIED which). **Trap (SIGNAL vs Blinker):** "Left at SIGNAL" where a flashing red blinker precedes a full 3-color signal. **Avoid:** shape and color discipline: octagon=STOP, triangle=YIELD, 3-light head=SIGNAL, alternating flasher=BLINKER.

### 1.9 "First / second opportunity", counting landmarks

- PCA: After = "first opportunity following" the landmark. https://mediaassets.pca.org/pages/microsites/parade2024/files/uploads/44736_pcars_2025_tsd_rally_appendix_vii.pdf ; Rally WNY: instructions "are to be executed in the manner indicated, at the first opportunity." https://www.rallywny.com/rallywny/generals.htm
- Great Race column D hints include "1st paved road". https://bloximages.chicago2.vip.townnews.com/greatrace.com/content/tncms/assets/v3/editorial/c/dd/cdd7fcee-d4f6-43ba-8535-064d9ce6112e/6931b4f9a700a.pdf.pdf  Great Race FAQ example: "turn right at the first paved road." https://www.greatrace.com/faq/
- **Trap ("Right at 2nd Oak St"):** Road: Oak St crosses your road twice (common in grid towns) or a street signed "OAK CT" appears first. Count only exact matches. **Trap ("Right at 1st paved road"):** a paved *driveway*, a paved parking-lot entrance, a cul-de-sac, or a dead-end street comes first. The Great Race promises never to send you onto those without an instruction and may omit them from CAMEO diagrams or show them dashed (same URL). **Avoid:** before counting, exclude driveways, parking lots, dead ends (signed DEAD END / NO OUTLET / NOT A THROUGH STREET), unpaved roads.

### 1.10 Intersection / road / paved definitions (what "counts")

- Great Race: "a dead-end road is identified by a sign reading DEAD END, NO OUTLET, NOT A THROUGH STREET, etc." and such roads "will sometimes be omitted from CAMEO Diagrams or shown as a dashed line." https://bloximages.chicago2.vip.townnews.com/greatrace.com/content/tncms/assets/v3/editorial/c/dd/cdd7fcee-d4f6-43ba-8535-064d9ce6112e/6931b4f9a700a.pdf.pdf
- Indy SCCA MRD "Pavement — where the main road is the paved option." http://www.indyscca.org/RallyFiles/Novice_3.pdf
- Rally WNY: straight as possible "without regard to road surface" — i.e., in that club gravel *does* count as a road and can be the main road. https://www.rallywny.com/rallywny/generals.htm
- **Trap ("road becomes gravel"):** under a pavement-priority GI the main road leaves the gravel at the first paved option; under a surface-blind GI you stay straight onto gravel. Two clubs, opposite answers. UNVERIFIED beyond the two quoted definitions.
- "Protected road" (a road where you have right of way / cross traffic has stop signs) as an MRD: UNVERIFIED — no snippet obtained. Flag for confirmation.

### 1.11 Speed-change placement traps

- Cascade rallymaster guide: "Speed changes should occur at a specified sign or landmark, or at an official mileage... speed changes referenced to a sign or landmark are to be executed at the near edge of the referenced sign or landmark... speed changes referenced to an intersection (such as SIGNAL or T) are to be executed at the leading edge of the intersection." http://www.cascadegeargrinders.org/Files/CSCC_Rallymaster_Guide_2023.pdf
- Rally WNY: "Speed changes are to be executed at the landmark cited, or at the apex of the turn at which they apply." https://www.rallywny.com/rallywny/generals.htm  (Note the two clubs differ: *leading edge of intersection* vs *apex of turn*.)
- "CAST: An acronym for Change Average Speed To, indicating that the preceding speed (in miles per hour) is to be discontinued and replaced by the value given after CAST." https://dl.motorsportreg.com/77342833-0e55-40f3-8393-e03f2f94cef3/
- Gary Starr's driver tips: highlight "speed changes, pauses, restarts, controls, transit zones, and quoted signs" in different colors; "Remind your navigator during the leg when a speed change is about to be done." http://www.indyscca.org/RallyFiles/TIPS4DRIVERS.pdf
- **Trap (sign hidden around a corner):** `CAST 28 at "Curve"` where the warning sign is just past a blind bend; the driver is still at 40 for 150 ft → ~1.3 s error (at 40 vs 28 mph over 150 ft ≈ 2.6 s vs 3.7 s; UNVERIFIED arithmetic illustration). **Trap (which edge):** executing at the far side of a 100-ft-wide intersection instead of the leading edge costs ~0.5-1 s at low speeds. **Trap (speed change at the apex):** a CAST tied to a turn — executing at the stop line vs the apex changes time by the length of the turn. **Avoid:** know the club's edge rule; driver calls "speed change coming" early. Some clubs disclaim this entirely: "There are no traps based on the location of speed changes." https://dl.motorsportreg.com/77342833-0e55-40f3-8393-e03f2f94cef3/

### 1.12 Pause / Gain / Transit / Free Zone

- "PAUSE: To delay a specified time at or near an identified point. Example, Pause 2 minutes for traffic at Highway 101." "GAIN: The opposite of a Pause. Used to make up a specified time during passage of a specified or implied distance." "TRANSIT: A part of the rally route in which there are no checkpoints and in which no specific speed need be maintained. A restart time at the end of the Transit will be given..." "FREE ZONE: A specified part of the timed rally route in which there are no controls. No penalties will be assessed for stopping within the confines of a free zone." https://dl.motorsportreg.com/77342833-0e55-40f3-8393-e03f2f94cef3/ ; https://mediaassets.pca.org/pages/microsites/parade2024/files/uploads/44736_pcars_2025_tsd_rally_appendix_vii.pdf
- Pauses in hundredths of a minute: "Pauses are usually in the form of 1/100s of a minute. For example: 10 is 0.10 minutes, 20 is 0.20 minutes and 100 is 1.00 minutes." "Pauses are frequently used at many STOP signs to allow sufficient time to safely stop and verify that it is safe to proceed." http://drscca.org/wp-content/uploads/2014/11/road_rally_104.pdf
- Great Race: "PAUSE is defined as 'to delay a specified time.' The pause time is added to the time for the leg." https://bloximages.chicago2.vip.townnews.com/greatrace.com/content/tncms/assets/v3/editorial/c/dd/cdd7fcee-d4f6-43ba-8535-064d9ce6112e/6931b4f9a700a.pdf.pdf  Great Race driver/navigator basics: "The Course Instructions for stop signs usually say to stop at the sign, pause for 15 seconds, and proceed at the assigned speed. However, if you have to wait for traffic longer than your planned pause time, you will need to make up the difference between your planned and actual pause times." https://www.greatrace.com/driver-navigator-basics
- **Trap (forgotten pause):** a pause buried in a separate column (Great Race column C / SCCA "Pauses" column) that the navigator reads past; the car is early by the whole pause (15 s in the Great Race). **Trap (unit confusion):** "Pause 30" read as 30 seconds when the GI says hundredths of a minute (0.30 min = 18 s) → 12 s error. **Trap (gain):** a GAIN executed by stopping instead of speeding up (or vice versa) — "Gain" means arrive earlier than the computed time. **Avoid:** separate stopwatch for pauses (common Great Race practice: "pause time countdown" is a listed stopwatch use) https://ronrowland.com/analog-stopwatch-with-countdown-bezel-application-notes/ ; highlight pauses in their own color (Starr).

### 1.13 Instruction order, numbering, notes, "unless otherwise specified"

- Route instructions "are to be executed in the manner indicated, at the first opportunity" (Rally WNY) and GIs "establish ... how to stay on course if the numbered route instructions or special instructions do not apply at any particular location along the course. Sometimes, as in course (trap) rallies, they may even take precedence over the numbered route instructions." https://www.rallywny.com/rallywny/generals.htm ; https://www.roadrallyhandbook.com/pdf/RRH.pdf
- **Trap (GI overrides NRI):** a numbered instruction `Left at Oak` where "Oak" is spelled "Oake" on the sign — the GI's exact-spelling rule means the NRI is not executable here; the main-road rule carries you past. **Trap (two instructions at one intersection):** `12. Right at STOP` and `13. CAST 35` both apply at one point; executing 13 before completing 12 moves the speed change. **Trap (NOTE vs instruction):** a "Note:" line (e.g., "Note: road narrows") is informational and not an instruction; a team that executes it as a turn is off course. **Trap ("unless otherwise specified"):** GI default (e.g., turns at T are left unless specified) silently applied. All UNVERIFIED as specific trap mechanics; the numbering/precedence principle is sourced above.
- "ONEOF" — I could not find any definition in search snippets ("the search results do not contain a specific definition for an 'ONEOF' instruction"). UNVERIFIED; it appears in some trap-rally GIs as a device meaning "exactly one of the following instructions is executable here" (hypothesis only — confirm).

### 1.14 Mileage traps

- Instructions carry "Overall mileages and delta/incremental mileages" and "Each instruction includes a mileage, a tulip diagram and a written instruction." https://www.roadrallyhandbook.com/pdf/RRH.pdf ; http://drscca.org/wp-content/uploads/2014/11/road_rally_104.pdf
- **Trap (official mileage vs car odometer):** after an off-course excursion the car's cumulative mileage no longer matches the official; a navigator working from cumulative mileage executes `CAST 40 at 23.47` early or late. The Road Rally Handbook covers "handling off-course excursions" in cumulative calculations. https://www.roadrallyhandbook.com/pdf/RRH.pdf  **Avoid:** re-zero at every known landmark; use incremental mileage from the last confirmed point.

### 1.15 Off-course loop (the "come back to course" trap)

- Rainier: wrong route "until they realize their error or the rallymaster's plan sends them back onto the correct route." https://www.rainierautosports.com/reference/overview.htm
- The Drive (Covered Bridge Rally): "The team ran too far off course on one of the seven legs and took a 200-point hit." https://www.thedrive.com/vintage/6256/we-entered-an-old-subaru-in-a-rally-for-math-nerds
- Mike Roberts (Great Race 2021): "missed a 35N turn on a loop course, continuing until the loop hit I-35 again and went the wrong direction. It took them nearly 10 minutes to notice the error and turn around." https://www.mikerobertsfurniture.com/blog/tag/Great+Race
- **Visual:** a trap-rally loop is a short detour that rejoins the main road a little further on, so the team sees familiar-looking road and never realizes it skipped a checkpoint or added distance. **Avoid:** confirm each instruction's landmark; if an expected landmark/mileage doesn't appear within ~10% of expected distance, stop before the next intersection ("Never go past the leading edge of an intersection that you're not sure of" — Starr) http://www.indyscca.org/RallyFiles/TIPS4DRIVERS.pdf

### 1.16 DIYC (Do-It-Yourself Checkpoint) and checkpoint types

- "A checkpoint (CP) is a spot along the rally route where cars are timed... An open checkpoint is easily seen by the rallyists. They may be required to stop after crossing the timing line to receive an official timing slip or further instructions. A closed checkpoint does not require rally cars to stop and may be concealed from rallyists in such a way that they may not know they have passed it." https://www.jcna.com/library/rally/chapter2.html
- DIYC: no snippet obtained ("did not contain a specific definition for 'DIYC'"). UNVERIFIED: DIYC = a checkpoint where the team records its own arrival time at a described landmark; the trap is misidentifying the landmark (recording the time at the wrong sign). Modern Richta GPS checkpoints make this moot: timing is by GPS at pre-set coordinates. https://richtarally.com/assets/documentation/Richta-GPS-Documentation.pdf

### 1.17 "Rookied" / following the car ahead

- Mike Roberts: "being 'rookied' by another set of rookies when another competitor took a wrong turn in front of them, leading them to turn back to check if they had missed a turn." https://www.mikerobertsfurniture.com/blog/tag/Great+Race  A behavioral trap, not a course-design one: never navigate by the car ahead.

---

## 2. Great Race specific: how teams actually lose time

### 2.1 Format facts (sourced)
- "Each day the driver and navigator team receives a set of course instructions that indicate every turn, speed change, stop, and start that the team must make throughout the day (usually 220 to 250 such instructions per day)." https://www.greatrace.com/driver-navigator-basics ; https://www.hagerty.com/media/events/team-hagerty-great-race-2018/
- Instructions are handed out "exactly 30 minutes before their assigned start time each morning" (greatrace.com) — other sources say 20 minutes ("one navigator per minute, twenty minutes before each car was required to start" https://www.mymcmedia.org/the-great-race-crosses-maryland-part-2/ ; FAQ says 20 https://www.greatrace.com/faq/ ). Both figures appear; the current regulations figure is UNVERIFIED (likely 30 in recent years).
- "18 to 20 pages of instructions detailing every turn, every speed change and every stop." https://www.greatrace.com/x-cup
- Typical instruction: "turn right at the stop sign, go exactly 25 mph for 40 seconds, then increase to 45 mph and turn right at the first paved road." https://www.greatrace.com/faq/
- Checkpoints: "from 4 to 7 checkpoints" per day (greatrace.com FAQ) / "about once an hour the cars would pass a secret, hidden checkpoint" https://www.mymcmedia.org/the-great-race-crosses-maryland-part-2/ ; "Each second early or late equates to one point, and the lowest score wins"; a perfect leg is an "Ace." https://www.hagerty.com/media/events/team-hagerty-great-race-2018/
- Speeds: "Rarely will Great Race competitors reach speeds more than 50 mph." (same Hagerty URL)
- Instruments: "There are only 3 basic rally instruments: a speedometer, a clock and a stopwatch." Official speedometer: Timewise 825; "Most speedometer calibration runs are performed at 50MPH." https://greatrace.com/bill-croker/rally-equipment.html ; https://fifthaveinternetgarage.blogspot.com/2015/10/the-great-racehow-it-works.html  Daily "speedometer calibration run" is a leg type listed in column B of the instructions (regulations URL below).

### 2.2 The GRIID instruction page (the closest thing to an official sample)
From the Great Race Event Regulations (2026 edition, via search snippets) https://bloximages.chicago2.vip.townnews.com/greatrace.com/content/tncms/assets/v3/editorial/c/dd/cdd7fcee-d4f6-43ba-8535-064d9ce6112e/6931b4f9a700a.pdf.pdf :
- "The GRIID (Great Race International Instruction Design) format will be used. Each instruction will consist of five columns."
- Col 1: "instruction numbers."
- Col "A": "CAMEO images or diagrams of signs, landmarks, and road and intersection configurations. The CAMEO diagram of an intersection will indicate the road on which you are approaching the intersection with a dot, and the road on which you are to leave the intersection with an arrow. The route that you are to follow through the intersection is represented by a bold line from the dot to the arrow. Thin line(s) in the CAMEO diagram of the intersection represent road(s) not taken." Driveways/parking lots/unpaved/dead-ends "will sometimes be omitted from CAMEO Diagrams or shown as a dashed line."
- Col "B": "symbols specifying the tire warm-up, the speedometer calibration run, transits, free zones, lunch stops, refueling stops, pit stops, etc."
- Col "C": "assigned average speeds and timing information" (CAST values, pauses, timed segments).
- Col "D": "additional information such as 'Comes quick', 'Look sharp', '1st paved road', 'Follow this Curve Warning Sign', or other helpful information."
- No written-text column is named in the snippets; the written instruction may be in col A with the cameo or an unlabeled column — UNVERIFIED. The Detroit SCCA sample (not Great Race) has: mileage, tulip diagram, written instruction, plus columns for CAST, Pauses, and Other. http://drscca.org/wp-content/uploads/2014/11/road_rally_104.pdf

### 2.3 Specific loss modes
1. **Wrong turn / missed turn.** Hagerty: "Following the correct route is more important than chasing a perfect second. A wrong turn can cost far more than a small timing error." https://www.hagerty.com/media/events/team-hagerty-great-race-2018/  Examples: 2025 rookie team (Riley Schlick-Trask/Jo Bejar) "made one wrong turn, but thanks to rookie rules, that 1:05 mistake got dropped from their time" https://www.onallcylinders.com/2025/06/21/rileys-road-show-tales-from-the-great-race/ ; 2021 Mike Roberts ~10 min lost on a missed 35N turn https://www.mikerobertsfurniture.com/blog/tag/Great+Race ; 2003 diary: a team "missed some instructions" and another "missed a turn and did some fast slam shifting to try to correct." https://greatrace.com/news/great-race-diary-from-2003.html
2. **Stop-sign pauses.** Standard: stop, pause 15 s, resume. If traffic holds you longer, you must make up the excess. https://www.greatrace.com/driver-navigator-basics  Variant trap: an instruction says STOP but the sign is a YIELD/blinker (UNVERIFIED as a Great Race occurrence; definitional basis in §1.8).
3. **Traffic lights.** "If a team gets stopped at a traffic light, they can take a time allowance and add it to their time without penalty. If you get stopped, you start the timer to help know how much time allowance you'll need." https://www.greatrace.com/driver-navigator-basics  (So lights are NOT "built into" the instructions; they are handled by a self-declared time allowance. The exact mechanism — declared on arrival at the checkpoint, and any cap — is UNVERIFIED.) Two correction options: "start before the instructed time, or ... make up for the lost time after starting at the instructed time." (same URL)
4. **Trains / accidents / construction.** "If you are delayed on the instructed route by circumstances beyond your control, such as blockage of the route by a train or need to assist at the scene of an accident, you may request a time allowance." Not grounds: "Mechanical failure (flat tire...), lack of vehicle capability (inability to maintain assigned speed), and personal failure." Phones "to be used only in case of emergency, and for the purpose of submitting Time Allowance Requests." (regulations URL above)
5. **Speed changes.** "speed changes abundant" (Hagerty). A navigator looking down to compute misses the landmark: basics advise "the navigator should tell the driver what sign, road, or intersection comes next before looking down to calculate or check timing" and "the driver should repeat important directions back to the navigator." https://www.greatrace.com/driver-navigator-basics
6. **Towns / parade zones / lunch stops.** Transits, free zones and lunch stops are coded in column B (regulations). Teams are timed into and out of towns; detail on "parade" segments UNVERIFIED (budget exhausted before query).
7. **Trophy Run.** "The Trophy Run is the initial time trial event that kicks off the Great Race. Teams score points based on how many seconds they are off the ideal time, and it serves as the first major competition before the main event begins." https://www.greatrace.com/faq/ ; 2025 rookies did "four hours on the road" on the Trophy Run. https://www.onallcylinders.com/2025/06/21/rileys-road-show-tales-from-the-great-race/  Whether it counts toward the overall: UNVERIFIED.
8. **Rookie rules.** Rookie division: "both driver and navigator must have less than 2 days Great Racing experience"; X-Cup "is for Student Teams." https://www.greatrace.com/faq/  A rookie's worst leg (or a bad leg) can be dropped — "that 1:05 mistake got dropped from their time" (onallcylinders). Exact drop rule UNVERIFIED.
9. **Being "rookied"** by following another car (§1.17).

---

## 3. General Instruction conventions (consolidated)

Term → definition (source in brackets; S=Sacramento PCA/JCNA, R=Richta/SCCA addendum, W=Rally WNY, P=PCA Parade glossary, G=Great Race regs, D=Detroit SCCA sample):
- **Main road / straight as possible**: least direction change [S]; "without regard to road surface, name, number or markings" [W]; MRD priority list given in each GI [Indy].
- **Intersection types**: T = your road ends at ~90° crossbar, approached from the stem, no straight possible [S]; Y = both branches turn <90°, approached from the tail, no straight possible [S].
- **ONTO**: follow the named/numbered road however it turns until a course-directing instruction [R]. **AT**: "even with" for speed changes/mileage/pause, "in the vicinity of" for turns [P]; cancels ONTO [MCNJ]. **AFTER**: first opportunity following the landmark [P]. **AWAY FROM**: turn opposite to the aid [W].
- **Turns**: Bear <90 (~45); Turn ≈90; Acute >90 [R]; Jog = turn at T then opposite turn shortly after [D].
- **Signs**: quoted text must appear on a sign, in full or in part, exact spelling, case/punctuation ignored, never partial words/numbers [S][D][W]; SOL/SOR [P]; STOP SIGN = official octagon [G]; Blinker = alternating flasher [P].
- **Timing words**: CAST [S]; PAUSE in hundredths of a minute [D] or seconds [G]; GAIN [S]; TRANSIT (no CPs, restart time given) [S]; FREE ZONE (no controls, stopping allowed) [S].
- **Where a speed change applies**: near edge of sign/landmark; leading edge of intersection [Cascade]; or apex of turn [W] — club-specific.
- **How "when" is specified**: (a) at a landmark/sign ("at", "after"), (b) at an official mileage (cumulative or incremental), (c) at a time (timed segments: "go 25 mph for 40 seconds" — Great Race FAQ), (d) by count ("1st paved road", "2nd opportunity").
- **Priority**: GIs govern when NRIs don't apply and in trap rallies may override NRIs [RRH/W]; NRIs executed in order at first opportunity [W].
- **Checkpoints**: open (visible, may stop for slip) vs closed (hidden, don't stop) [JCNA]; open stop-CPs on the right side [D]; Richta GPS checkpoints are virtual [Richta].

---

## 4. Official sample page
No scanned Great Race page was obtainable (fetch blocked). Best available description is the GRIID 5-column spec in §2.2. For a non-Great-Race reference format: Detroit SCCA's sample route card has mileage + tulip + text + CAST + Pause + Other columns (http://drscca.org/wp-content/uploads/2014/11/road_rally_104.pdf). Example instruction strings found verbatim: "Jog Left at STOP", "Left at STOP at T", "Right on Side road" (same URL). Great Race sample text: "turn right at the stop sign, go exactly 25 mph for 40 seconds, then increase to 45 mph and turn right at the first paved road" (https://www.greatrace.com/faq/). Column-D hint strings: "Comes quick", "Look sharp", "1st paved road", "Follow this Curve Warning Sign" (regulations PDF).

---

## 5. How roads actually look (visual cues for the renderer)

Sourced anchors, then inferences (marked):
- **CAMEO convention** (G): dot = entry road, arrow = exit road, bold line = your path, thin lines = roads not taken, dashed/omitted = driveways, parking lots, unpaved, dead-ends. A simulator's top-down intersection diagram should literally adopt this.
- **What is not a road** (G): private roads, driveways, parking lots, unpaved roads, dead-end roads (signed DEAD END / NO OUTLET / NOT A THROUGH STREET). Render: driveways narrower with a house/mailbox; parking lots with a building; dead ends with the yellow diamond sign; gravel with a texture change.
- **Sign shapes** (G, P, §1.8): octagon = STOP; triangle = YIELD; 3-lamp head = SIGNAL; single/double alternating lamp = BLINKER; green rectangle blade = street name; yellow diamond = warning (e.g., "Curve Warning Sign" referenced in column D).
- **T**: your road ends, crossbar ~90°, often a STOP facing you. **Y**: fork with both branches <90°, usually no stop. **Jog**: T followed within a short distance by an opposite turn.
- **Angles**: bear ≈45°, turn ≈90°, acute >90° (R).
- **Edges**: "leading edge of the intersection" and "near edge of the sign" (Cascade) are the timing datums — render the stop line/curb-line and the sign post.
- **Sign side**: SOL/SOR (P); open checkpoints on the right (D).
- Inference (UNVERIFIED): experienced navigators also use lane-width continuity, centerline continuity (a painted centerline that follows the curve marks the "main" road in many GIs), and route-marker shields to confirm ONTO roads.

---

## 6. Implications for a training simulator — prioritized trap library

Priority is by (frequency in sources) × (time cost). Time costs are estimates unless cited.

| # | Trap name | Instruction text | Visual layout (top-down) | Correct action | Common wrong action | Time cost |
|---|---|---|---|---|---|---|
| 1 | Missed/wrong turn (Great Race #1 loss) | `Right at STOP` with a cameo | STOP octagon facing you at a 4-way; side road right | Turn at the octagon-controlled intersection | Turn at an earlier YIELD/blinker, or go straight | 1-10 min (1:05 rookie wrong turn https://www.onallcylinders.com/2025/06/21/rileys-road-show-tales-from-the-great-race/ ; ~10 min https://www.mikerobertsfurniture.com/blog/tag/Great+Race ) |
| 2 | ONTO follows the name | `Left onto Oak Rd` (earlier) | Wide road continues straight; "OAK RD" blade points to narrower right branch | Turn right with the name | Straight on apparent main road | 2-5 min + missed CP (est.) https://www.rainierautosports.com/reference/overview.htm |
| 3 | Forgotten pause | `PAUSE 15` (col C) at STOP | Standard STOP at T | Stop, hold 15 s, resume | Roll through / resume immediately | 15 s (Great Race) https://www.greatrace.com/driver-navigator-basics |
| 4 | Speed change edge | `CAST 30 at SIGNAL` | Wide signalized intersection | Change speed at leading edge | Change at far side / after turn | 0.5-2 s http://www.cascadegeargrinders.org/Files/CSCC_Rallymaster_Guide_2023.pdf |
| 5 | Hidden speed-change sign | `CAST 28 at "Curve"` | Yellow diamond just past a blind bend, near edge | Slow at near edge of sign | Late by the surprise distance | 1-3 s (est.) |
| 6 | 1st paved road | `Right at 1st paved road` | Paved driveway, then parking lot entrance, then real road | Skip driveway & lot | Turn into driveway | 30 s-3 min (est.) https://bloximages.chicago2.vip.townnews.com/greatrace.com/content/tncms/assets/v3/editorial/c/dd/cdd7fcee-d4f6-43ba-8535-064d9ce6112e/6931b4f9a700a.pdf.pdf |
| 7 | Not-a-T | `Left at T` | Side road ends at yours (you're on the crossbar); real T ahead | Continue to where your road ends | Turn at the first T-shape | 2-5 min (est.) https://www.jcna.com/library/rally/chapter2.html |
| 8 | Bear vs Turn | `Bear Left` | 45° and 90° lefts at same node | Take 45° | Take 90° | 2-5 min (est.) |
| 9 | Straight-as-possible fork | (no instruction) | Main pavement curves; lesser road dead ahead | Apply GI MRD priority (least change OR pavement) | Follow the "obvious" road | 2-10 min (est.) https://www.rallywny.com/rallywny/generals.htm |
| 10 | Quoted sign mismatch | `Right at "Smith Rd"` | Blade "SMITH ROAD" first, "SMITH RD" later | Exact match only | Turn at the near-match | 2-5 min (est.) https://dl.motorsportreg.com/77342833-0e55-40f3-8393-e03f2f94cef3/ |
| 11 | AT vs AFTER | `Right after "Church"` vs `Right at "Church"` | Sign visible from intersection; next road 50 yd past sign | AT: turn where sign is in vicinity; AFTER: first opportunity past the sign | Swap them | 1-5 min (est.) https://mediaassets.pca.org/pages/microsites/parade2024/files/uploads/44736_pcars_2025_tsd_rally_appendix_vii.pdf |
| 12 | Pause unit confusion | `Pause 30` | Any | Convert per GI (0.30 min = 18 s vs 30 s) | Wrong unit | 12 s (est.) http://drscca.org/wp-content/uploads/2014/11/road_rally_104.pdf |
| 13 | Traffic-light delay not declared | (none) | Red light | Start stopwatch, request time allowance or make up time | Panic-speed to catch up / forget TA | 10-90 s https://www.greatrace.com/driver-navigator-basics |
| 14 | Jog | `Jog Left at STOP` | T, then right turn 100 ft later | Two turns | Only the first | 2-5 min (est.) http://drscca.org/wp-content/uploads/2014/11/road_rally_104.pdf |
| 15 | Acute | `Acute Right` | >90° doubling back + a 90° right | Take the sharp one | Take the 90° | 2-5 min (est.) |
| 16 | 2nd occurrence count | `Right at 2nd "Oak"` | "OAK CT" then "OAK ST" ×2 | Count exact matches only | Count OAK CT | 2-5 min (est.) |
| 17 | Mileage drift after excursion | `CAST 40 at 23.47` | Any | Re-zero at last confirmed landmark | Trust cumulative odometer | 5-30 s (est.) https://www.roadrallyhandbook.com/pdf/RRH.pdf |
| 18 | Off-course loop rejoin | (missed instruction) | Detour rejoins main road | Stop before next unknown intersection, backtrack | Press on | 200 pts in SCCA example https://www.thedrive.com/vintage/6256/we-entered-an-old-subaru-in-a-rally-for-math-nerds |
| 19 | Rookied by car ahead | (none) | Car ahead turns | Ignore it | Follow it | 1-3 min https://www.mikerobertsfurniture.com/blog/tag/Great+Race |
| 20 | Note vs instruction (UNVERIFIED) | `Note: road narrows` | Any | Don't act | Treat as turn | varies |

Simulator design notes:
- Render every scenario with the **GRIID CAMEO grammar** (dot/arrow/bold/thin/dashed) beside the written instruction and a separate column for CAST/pause and a column-D hint, so trainees learn the real page layout.
- Make the **GI selectable** (surface-blind vs pavement-priority main road; pause in seconds vs hundredths; speed change at leading edge vs apex) since the same road yields different correct answers under different GIs (§1.1, §1.11, §1.12).
- Score as the Great Race does: seconds early/late = points; off-course = large fixed penalty; provide a "time allowance" action for lights/trains.
- Drill the behavioral habits the sources recommend: navigator calls the next landmark before looking down; driver reads back; never cross the leading edge of an uncertain intersection (https://www.greatrace.com/driver-navigator-basics ; http://www.indyscca.org/RallyFiles/TIPS4DRIVERS.pdf).

---

## Appendix A — Source list (all accessed only via search snippets)
- SCCA 2025 RoadRally Rules: https://cdn.connectsites.net/user_files/scca/downloads/000/073/902/2025%20RoadRally%20Rulebook.pdf
- San Diego Region SCCA GIs: https://sdrscca.com/wp-content/uploads/2020/07/San-Diego-Region-SCCA-Road-Rally-GENERAL-INSTRUCTIONS-1.pdf
- Richta GPS Addendum to GIs (SCCA): https://cdn.connectsites.net/user_files/scca/downloads/000/053/170/Richta%20GPS%20Addendum%20to%20the%20General%20Instructions%20-%20Updated%2011_22_2020.pdf
- Richta docs: https://richtarally.com/assets/documentation/Richta-GPS-Documentation.pdf
- Harvey Cain, Rallying for Beginners: https://www.zone8.org/assets/docs/Rallying_for_beginners.pdf
- MCNJ Rallye Tips: https://www.mcnj.org/RallyeTips.htm
- Rainier Auto Sports overview: https://www.rainierautosports.com/reference/overview.htm
- Rally WNY Generals: https://www.rallywny.com/rallywny/generals.htm
- JCNA Rally Ch. 2: https://www.jcna.com/library/rally/chapter2.html
- PCA Sacramento Valley GIs: https://dl.motorsportreg.com/77342833-0e55-40f3-8393-e03f2f94cef3/
- PCA Parade Rally Glossary (App. VII): https://mediaassets.pca.org/pages/microsites/parade2024/files/uploads/44736_pcars_2025_tsd_rally_appendix_vii.pdf
- Detroit SCCA Road Rally 103/104 (Scott Harvey): http://drscca.org/wp-content/uploads/2014/11/road_rally_104.pdf ; http://drscca.org/wp-content/uploads/2014/11/road_rally_103.pdf
- Indy SCCA Novice Tutorial III: http://www.indyscca.org/RallyFiles/Novice_3.pdf ; Gary Starr driver tips: http://www.indyscca.org/RallyFiles/TIPS4DRIVERS.pdf
- Cascade Gear Grinders Rallymaster Guide 2023: http://www.cascadegeargrinders.org/Files/CSCC_Rallymaster_Guide_2023.pdf
- Road Rally Handbook: https://www.roadrallyhandbook.com/pdf/RRH.pdf
- Great Race Event Regulations (2026): https://bloximages.chicago2.vip.townnews.com/greatrace.com/content/tncms/assets/v3/editorial/c/dd/cdd7fcee-d4f6-43ba-8535-064d9ce6112e/6931b4f9a700a.pdf.pdf
- Great Race Driver & Navigator Basics: https://www.greatrace.com/driver-navigator-basics ; FAQ: https://www.greatrace.com/faq/ ; X-Cup: https://www.greatrace.com/x-cup ; Rally Equipment: https://greatrace.com/bill-croker/rally-equipment.html ; 2003 diary: https://greatrace.com/news/great-race-diary-from-2003.html
- Hagerty 2018: https://www.hagerty.com/media/events/team-hagerty-great-race-2018/
- OnAllCylinders 2025 rookie account: https://www.onallcylinders.com/2025/06/21/rileys-road-show-tales-from-the-great-race/
- Mike Roberts 2021 blog: https://www.mikerobertsfurniture.com/blog/tag/Great+Race
- Montgomery Community Media: https://www.mymcmedia.org/the-great-race-crosses-maryland-part-2/
- Randy Rundle, How It Works: https://fifthaveinternetgarage.blogspot.com/2015/10/the-great-racehow-it-works.html
- Ron Rowland stopwatch notes: https://ronrowland.com/analog-stopwatch-with-countdown-bezel-application-notes/
- The Drive, Covered Bridge Rally: https://www.thedrive.com/vintage/6256/we-entered-an-old-subaru-in-a-rally-for-math-nerds
- SCCA type explainers: https://scca-milwaukee.org/road-rally/ ; https://www.kcrscca.org/our-racing/road-rally/ ; https://racer.com/2016/04/06/how-to-start-racing-scca-roadrally ; https://www.mohud-scca.org/roadrally/

## Appendix B — Planned but not executed (search budget exhausted)
Queries never run: SIGNAL/STOP/YIELD definitions across clubs; "opportunity" definition; NOTE vs instruction and "unless otherwise specified" wording; "protected road" MRD; landmark/sign-side rules ("visible from the car", "facing"); off-course-loop design guidance from rallymaster handbooks; ONEOF definition; DIYC definition; Great Race Trophy Run scoring, rookie drop rule, time-allowance mechanics/caps, parade/town segments; Student X-Cup day blogs; kpcnews team stories; 2003 diary details. All corresponding items above are marked UNVERIFIED.
