# 10c - Short official videos (Jeff Stumb how-to series + two X-Cup 2026 videos)

Sources: eight YouTube auto-caption transcripts in `docs/research/transcripts/txt/` (plus the matching `.en.vtt`
files, used only to recover the last cue that the cleaned `.txt` lost): Clock and Stopwatch (3:29), Starting on
Time (5:30), Filling Out a Time Delay Form (5:48), Making Up Time (5:48), Reading The Instructions (7:14),
Performance Charts And Preparing Your Car (7:14), How to Create Performance Charts for Vintage Car Rally (7:46),
How to Install a Timewise Speedometer in a Great Race Rally Car (6:47). `Hacking.txt` is empty (see section 9).

Compared against: `08-rookie-handbook-body.md` (HB, 2015 handbook, main body), `08b-rookie-handbook-appendices.md`
(HB App B/C/E), `09-event-regulations-2026.md` (REG; section 5 equipment, section 14 Time Allowance),
`docs/spec/OPEN-QUESTIONS.md` and the current SPECS ids that the videos touch.

Reading rules used here
- [mm:ss] = the transcript marker nearest the statement (the .txt has a marker every ~30 s, so +/- 30 s).
- "(?)" = auto-caption doubtful (names, numbers, garbled phrases). "Flag" = my reading of a garbled passage.
- The videos were NOT watched; only captions. Every "what is on screen" entry in section 11 is inferred from the
  speaker's words ("this one", "you will see", "look at"), not from pixels. Screenshots must be taken by a human.
- The .txt files stop one cue early. Recovered from the .vtt: Clock ends "...call WWV, and that number will be
  provided to you during the Great Race."; Making Up Time ends "...do not make up time during that time it will
  mess up what you're already doing."; Charts video ends "...our great donation car behind us."; Timewise ends
  "...you won't be getting an accurate reading."
- Dates: the videos carry no date. The Jeff Stumb series is undated and may pre-date the 2026 regulations; the two
  X-Cup videos name "2026 X Cup racers" (Timewise) and "X Cup Legacy" (charts). Where a Jeff video disagrees with
  REG 2026, REG wins for the default and the video becomes an option or a lesson note (Josh: organisers' documents
  and videos override his preferences; REG is the later, formal text).

---------------------------------------------------------------------------------

## 0. Top findings (details and citations below)

1. The director does not rely on the Sawtooth clock for time of day. It has "a very consistent second hand" but "a
   rather loose minute hand and it's quite easy to make a 1 minute mistake"; he uses a digital 3-button stopwatch
   in time-of-day mode instead ("When I run, I no longer use a watch"). The clock is a backup or a second-hand
   source. This contradicts HB p.5 ("minimal backlash") and our LESSON-006 / WATCH-009 (clock is the only TOD source).
2. Start-on-time procedure: start time = sign time + start position (9:05 + 27 = 9:32); you cannot go 0 to 30 mph
   instantly, so launch the measured net loss early (3 s -> 9:31:57); pull up when the car ahead leaves (about a
   minute before); at 9:31:30 warn the driver, then give a countdown that ends at 9:31:57.
3. Time delay: time the stop with the stopwatch (stop to go), add the stop-and-go loss from the chart,
   round to a multiple of 10 s by MAKING UP the excess (3:47 -> make up 7 s -> claim 3:40). The paper "time delay
   form" (car, stage, leg, instruction numbers, time, description, signature, other cars stopped) is handed to an
   official at lunch or at the finish line each night, pre-filled. REG V.H.3 says phone/web at a printed point.
4. Make-up time: 10 % over the assigned speed gains 1 s per 10 s (6 s per minute); 20 % over gains 12 s per minute;
   keep a running total in chunks; drop the extra speed at the next speed-change sign and re-apply; use a stop sign
   (stop for 1 s of a 10 s pause = 9 s gained); NEVER try to make up time inside a stopwatch-timed interval.
5. "Throw out your 5 worst legs" for a rookie: contradicts REG I.F.3.d (Rookie drops 6, Sportsman 5, pooled over
   Stages 1-7).
6. Performance charts, Jeff's quick method: two poles, every 5 mph from 15 to 50; flying time vs standing-start
   time = start loss (45 s vs 48 s at 30 = 3 s); stop-in-the-middle run (50 s) minus flying (45 s) = 5 s total,
   minus 3 s start = 2 s braking loss. A different way to get the same two numbers as HB App B.
7. X-Cup chart video: Great Race supplies a chart-creation spreadsheet (times in SECONDS only; computes averages;
   yellow help boxes); 4 runs per speed, per driver, about 4 hours; a negative net loss (-2.7 in the demo) means
   an outlier in the constant-speed row (19.1 among 19.8, 19.9, 19.8): delete it or, better, re-run and re-average.
8. Reading the instructions: Column A is "the most important" (cameo: dot = car, arrow = direction), B symbols
   (tyre + 9.0 = about 9 miles to #6), C time/speed, D hints; handwritten notes in the booklet example are
   tutorial hints that will NOT be on race sheets. Numbers match HB App E (4m03.4s, 3m16.3s/7m19.7s, 28m43.2s,
   1:40 + 42 = 2:22, stop 10.2 s). No read-aloud/callout protocol is taught in this video.
9. Timewise install: magnet gap 3/8 to 5/8 in (three popsicle sticks glued), two magnets per wheel (2 pulses/rev),
   epoxied (JB Weld) on an inside NON-DRIVEN wheel, transducer on the tie-rod end/knuckle, 12 V only (a 6 V car
   needs "something else"), 15 A inline fuse, factors on the back adjusted daily. Faults: jumping needle = lost
   power/fuse; half or zero speed = missing magnet or dirty/broken transducer. There is NO calibration procedure
   in this video (use HB App C).
10. Prep video: the first day is "the number one day for picking up cars"; seat belts required even if the car had
    none; hydraulic-brake and 12-volt conversions "allowed with no penalty" (not in my REG extract: verify).

---------------------------------------------------------------------------------

## 1. Clock and Stopwatch (Jeff Stumb, director; 3:29)

Teaches: which timepieces to carry and what each is for. Hardware: the Sawtooth clock (second hand), a 3-button
digital stopwatch with time-of-day mode (the director's own tool) and an analog wristwatch.

Facts, rules, tips
- [00:03] Series purpose: newcomers, first-time and second-time participants. Core idea: "the important thing is to
  start on time, stay the course, and stay on time". Intro lists "clocks, chronometers, and wristwatches";
  "chronometer" is never defined separately, he then shows clock, digital stopwatch, wristwatch (so chronometer =
  the stopwatch, ?).
- [00:03] The clock: "the 9-inch watch that most runners will use. It is made by Sawtooth Clocks." (REG limit is 10
  inches measured on the face, II.H.1.d(1).)
- [00:37] "It has a very consistent second hand. But it has a rather loose minute hand and it's quite easy to make
  a 1 minute mistake with the clock. When I run, I no longer use a watch."
- [00:37] "Some people use the watch only for the second hand, to see the seconds pass, but they don't use it to see
  the time of day."
- [01:08] Digital stopwatch: "Most of these stopwatches have three buttons on top and are designed so you can
  toggle between the time of day and stopwatch mode. And if you set up this stopwatch correctly, you won't need
  that watch."
- [01:08] You may carry the clock "in emergencies, knowing that the minute hand could easily come off" (flag: probably
  "come off" = read wrong by a minute; the literal "fall off" is also possible, ?).
- [01:39] Why the minute hand fails: "as time approaches the top of the hour, when the second hand is in the 55 or
  56 second range, moving towards zero at the top of the clock, the minute hand has already moved to the next
  minute, and it can be problematic to figure out what minute it actually is." (He says "hour"; the mechanism he
  describes is the minute roll-over, i.e. the last ~5 s of EVERY minute, flag.) In plain terms: the minute hand
  runs ahead of the second hand near :55-:00.
- [01:39] Stopwatch jobs: "many maneuvers in this race will require the stopwatch to make you perform a specific
  maneuver for 25 seconds, maybe a minute and a half, maybe 6 or 7 minutes".
- [02:10] Example of a timed hold: "go from 30 to 35 for 7 minutes and 30 seconds. At the end of that time
  period, go to 45. You start the stopwatch and 7 and a half minutes later you can stop it and move on to the next
  prescribed speed." (speeds as captioned look garbled, flag; the point is hold speed A for 7:30 by stopwatch then
  change.)
- [02:10] Time of day: "You will use the time of day from the stopwatch, clock, or wristwatch at the start, in
  transit, or upon resumption after lunch. Therefore, you need to know how to use the stopwatch or clock to make
  sure you have the correct time."
- [02:41] Wristwatch: "it must be analog, without a stopwatch mode."
- [02:41] Setting up: "Every morning, at the official start, there will be an official clock that shows the exact
  time of the day and you can reset all your watches. And you'll probably have to restart them 24 hours after the
  previous day." (second sentence unclear; read as: re-set every morning, ?)
- [03:11] "You can also call WWV, and that number will be provided to you during the Great Race." (He does not say
  when you may call; REG II.H.1.i bars cell-phone clock use and phone use after the start line.)

---------------------------------------------------------------------------------

## 2. Starting on Time (Jeff Stumb; 5:30)

Teaches: how to leave a standing start exactly on time by launching early by the car's measured start loss.

Facts, rules, procedure
- [00:04] Topic: "how to start from a standing start at the first sign of the day".
- [00:04] Each car gets a number: "you draw a number the day before and that's your start position" (REG III.A.4:
  draw within Groups II/III for Stages 2-8; he calls it "car number" loosely; HB/REG call it the assigned start
  position, ASP, which is not the car number).
- [00:36] Hotel start is not the scored start: "most days the start at the hotel will be at 8:00 plus your start
  order" (#27 -> 8:27), then "tire warmup and the calibration before the actual scoring starts".
- [01:07] Scored start: "a sign that is designated as the starting location for every car for that day"; "if the
  start time at that sign is 9:05 and we're car number 27 then our start time at that sign becomes 9:32 ... 9:05
  plus 27 positions which is 27 minutes".
- [01:38] Start speed 30 mph: "you cannot instantaneously get from 0 to 30 miles an hour. Now this goes back to
  your performance chart that you should have done prior to coming to the Great Race."
- [02:08] Mini chart method (any two objects, any distance apart: poles, signs, cones): run 30 mph through them:
  35 s. Then stop at the first pole, driver goes, start the stopwatch when he goes, stop at the second pole:
  38 s. "That tells you that it takes you 3 seconds to get to speed from 30 miles an hour" (his wording; see
  table, HB says the chart is net loss, not acceleration time).
- [03:41] Race day: start time 9:32, loss 3 s, "so we're going to start at that sign 3 seconds early ... 9:31 and
  57 seconds".
- [03:41] "the car in front of you will have left a minute early before you. As soon as they leave you pull up to
  that start sign with the clock running".
- [04:12] Cue: you "tell the driver when I do a countdown you're going to go to 30 mph"; at "9:31 and 30 seconds you
  tell the driver all right we're going to be going in about 25 seconds" (flag: 9:31:30 to 9:31:57 is 27 s; 25
  may be a loose figure or caption error, ?) "and you start to give them a countdown and that countdown should
  finish at 9:31 and 57 seconds so that you're already going and at speed and on time when 9:32 your actual start
  time arrives."
- [04:43] "it's not as complicated as all that sounds". (He gives a phone/email for questions; not reproduced.)

Net timeline for the sim (9:32:00 start, 3 s loss): 9:30:57 car ahead leaves (about) -> pull up to the sign with
the clock running -> 9:31:30 "about 25 s" warning -> countdown ends 9:31:57 -> wheels roll -> 9:32:00 perfect
position reached. Nobody releases the car: self-start on your own timepiece.

---------------------------------------------------------------------------------

## 3. Filling Out a Time Delay Form (Jeff Stumb; 5:48)

Teaches: what to do when a train, tractor, school bus or construction stops you, and how to fill and hand in the
form so your score is as if the delay never happened.

Facts, rules, procedure
- [00:04] Context: "inevitably on the Great Race you're going to get stopped at some point in the 2400 miles in
  nine days by a train, a tractor, possibly a school bus or construction" (9 days = REG 9-Stage event).
- [00:37] "Don't panic ... we do want you to stay on time ... but if something happens ... first thing you do is
  stop the vehicle and start your stopwatch at that point. Relax".
- [01:07] "You're getting behind one minute, two minutes, maybe even three minutes by a train; don't worry about
  it, that is what the time delay is for. When you turn in your time delay it goes back and calculates as if the
  event had never happened if you do it correctly and your score will be just as it was before."
- [01:38] Measurement: "the simplest way is to add back in the stop and go time to the speed you're doing when you
  stop" (flag: read as add the performance-chart stop-and-go loss for that speed to the measured stop; he says
  he will not go into "starting your stopwatch halfway down and halfway up at your speeds", the alternative method
  of timing from mid-deceleration to mid-acceleration). Start the stopwatch "when the vehicle starts or stops and
  you start it back when the vehicle starts moving". Wrap-up [04:44]: "if you add in your stop and go times off
  your performance chart to that number you will have your time delay, get it down to a multiple of 10".
- [02:10] Rounding: "time delays can be turned in in any multiples of 10 seconds, so 3 minutes and 47 seconds is
  not a multiple of 10 seconds so first thing you want to do is make up 7 seconds to get time delay down to 3
  minutes and 40 seconds".
- [02:41] "we want you to make up that time if possible, if it's safe, you want to be safe at all times". If a
  checkpoint comes while you still carry the delay: "don't worry, go through the checkpoint as usual, mark down
  what time or what instruction number that time delay is for".
- [02:41] Form fields, in the order he fills them (example):
  1. Car number (example: 99).
  2. Stage ("what day of the rally it is": second day = stage 2).
  3. Leg number: "the number of checkpoints you've passed ... if we've passed checkpoint number four we're now
     working on leg number five" (leg = checkpoints passed + 1).
  4. Instruction numbers where it happened: "the most important part" (example: between 102 and 103).
  5. The time (3 minutes 40 seconds).
  6. Description ("stopped by a train"; "it was a school bus"; "stopped by a giant combine").
  7. Signature ("You then sign it").
  8. Other cars stopped too: "car number two ahead of us and car number eight behind us" (a place on the form).
- [04:13] Submission: "if this is before lunch you will turn it in at lunch time, there'll be somebody there to ask
  you if you have time delay in case you forget, or at the Finish Line each night, the first thing they'll ask is do
  you have a time delay, that's where you turn that in. I already have it filled out with all the information
  already done so that you don't have to keep a delay there at the Finish Line." (Tip: pre-fill.)
- [04:44] Recap: "Don't panic. Start your stopwatch when the car stops, start your stopwatch again when the car
  starts moving".  (As captioned "start again"; read as stop it when moving, flag.)
- Nothing said about lights or about subtracting time you made up (REG V.H.5 wants "Made up 0m25s" in the text).

---------------------------------------------------------------------------------

## 4. Making Up Time (Jeff Stumb; 5:48)

Teaches: the ten per cent rule and when NOT to use it.

Facts, numbers, rules
- [00:03] "like everything in the Great Race you need to keep it simple ... the KISS rule". "if you're trying to make
  up lost time again don't panic, it happens to everybody".
- [00:33] "if you worry too much about being one second late and worry about it too much and you miss the next
  sign you're gonna be more than one second late, you're gonna be thirty seconds later, five minutes late". "don't
  worry about the small things especially early on, have fun your first year."
- [01:03] Ten percent rule: "if I go 10 % over the prescribed speed for every ten seconds I can make up one second
  ... so in a minute at ten percent over I can make up six seconds".
- [01:36] Numbers: 40 mph -> 44 mph; 35 mph -> 38.5 mph. "if you drive 44 while everyone else is driving 40 you
  will increase your place on the course by one second every 10 seconds or by 6 seconds every minute". (Caption
  says "10 percent of the 40 is 4 seconds": a slip for 4 mph.)
- [02:37] Keep a running total: "sometimes you won't be able to get all 30 seconds made up all at one time, it may
  be in chunks. If I can get 1 minute in that's 6 seconds, another minute 12 seconds and so on until you've made up
  the entire 30 seconds" (30 s at +10 % = 5 min of driving; my arithmetic, he does not say 5 min).
- [03:08] 20 %: "as you get a little more comfortable with it and it's in a big chunk like that you may choose to do
  20 % over ... 48 miles an hour [at 40] ... now you're making up 12 seconds for every minute".
  (Check: 10 % over gains exactly 1 s per 10 s; 20 % over gains exactly 12 s per 60 s.)
- [03:39] Keep watching for signs while going faster: "you're doing two things ... some of the signs mean a new
  instruction which might mean a new speed". Example: curve warning sign, 40 -> 35: come off the extra speed at
  the sign, get comfortable, work out how much was made up, then "go 10 % over again, that's 38 and a half".
  ("at the knee of the speed" in the caption is unclear, ?).
- [04:41] Stop signs as make-up spots: "a lot of veterans don't like to do this because they're afraid of a
  checkpoint ... as a rookie ... if that's more comfortable for you that's a good way ... if you're doing 40 and
  you're going to stop at that stop sign for 10 seconds and you stop for one you've made up nine seconds right
  there".
- [05:11] "if you get caught by a checkpoint that's the way it goes, that's why we have what we call the throw out
  legs where you can throw out as a rookie or a sports[man] your 5 worst legs on the entire nine day event"
  (caption "as a rookie or a sports when you can throw out your 5 worst legs", flag).
- [05:11] Last advice: "do not try to make up time in a timed interval. If you're doing a certain speed and it tells
  you to do 30 miles an hour for seven minutes and you're using the stopwatch to do that, do not make up time
  during that time, it will mess up what you're already doing." (Last clause recovered from .vtt; no further
  reason is given.)

Gain rule (my arithmetic, exact): driving a fraction p over the assigned speed gains 60 x p seconds per minute
of driving: 10 % -> 6 s/min, 20 % -> 12 s/min (5 % -> 3 s/min). To clear L seconds at +10 % drive 10 x L
seconds (HB p.10); at +20 % drive 5 x L seconds.

---------------------------------------------------------------------------------

## 5. Reading The Instructions (Jeff Stumb; 7:14)

Teaches: the layout of the instruction sheet using the booklet's sample (the 2014 Trophy Run in HB Appendix E).
It does NOT teach how navigator and driver read the sheet aloud, who says what, or when to read ahead (see below).

Facts
- [00:03] Uses the booklet "Preparing for the Great Race", "page 32, Appendix II" (caption; the 2015 handbook
  here has the example as App E, and its printed page numbers differ, so this is another edition or a caption
  error, ?). "A simple set of instructions just like you'll get each morning just before your start."
- [00:34] Layout: numbers down the side, columns A, B, C, D across the top. "Obviously the most important
  instruction out of the columns is column A": it shows "turn right onto US 1 north from the Ogunquit
  Playhouse" (captioned "AG unquote play house").
- [01:05] Column B: picture of a tyre with 9.0 miles = "approximately nine miles to the next instruction in that
  column which you'll see is instruction six". Column C: "time of day start".
- [01:35] "everything that looks like it's in handwriting is what we've written in handwriting; that is not going to
  be on your instructions". The "approximately nine miles to instruction number six" in B "is not going to be on
  the set of instructions that you're getting; these are hints that we're giving you".
- [01:35] Column D = "hints to what's going to happen": e.g. "you may encounter support vehicles without penalty
  on this particular day"; #2 Shore Road off to the right but follow the road curving left; official start tomorrow
  on Beach Street; #3 "turn left at the stop light onto the interstate ... the fifth stoplight". Summary [02:39]:
  "your main instruction is A and then followed by B, C and D for other items that you may need".
- [02:39] Morning sequence: tire warm-up = instructions 1 to 6; "we're starting at instruction 6 at the speed limit
  65 mile an hour sign ... the start of the calibration run; that's what the little speedometer says".
- [03:10] #6: "approximately 24 miles" (column B); column C "50 miles per hour for 29 minutes" (captioned "59").
- [03:41] #7 Kennebunk/Kennebunkport sign on the right: "notice the little dot and the arrow, the dot is your car,
  the arrow shows you the direction you're going"; pass it "after 4 minutes and 3.4 seconds" (4m03.4s), and "the
  cumulative time ... the same time since this is the first time".
- [03:41] #8 Eastern Trail sign on the left: "three minutes and sixteen point three seconds from the last sign or
  seven minutes nineteen point seven seconds cumulative". (4:03.4 + 3:16.3 = 7:19.7: consistent.)
- [04:11] "You will do the calibration all the way through instruction 18 and you would be 28 minutes and 43.2
  seconds." Official start sign is not until #26: "you have to do everything up through 25 to be able to know
  where instruction 26 is".
- [04:47] #26 "stop sign ahead" sign = start of the rally portion; start time 1:40 pm; "this booklet assumes that you're
  car number 42" -> 1:40 + 42 = 2:22 pm, 20 mph (he says car number; HB says ASP).
- [05:19] "you'll drive until you get to the stop sign, instruction 27. Now that stop sign may be a hundred yards or
  it may be ten miles, you don't know."
- [05:51] #27 T-intersection, right turn at the stop sign: zero mph in column C for 15 seconds then 35 mph. "The
  rally master makes this course assuming that you can stop instantaneously and start instantaneously ... well
  your car's not going to be able to do that and in this example they have determined that [you] are only going
  to stop for ten point two seconds to be on time" (matches HB Packard table: 20 in / 35 out = 10.2). "You will
  learn how to do that in the how to make a performance chart section."
- [06:23] #28 speed limit 35 sign: speed drops from 35 to 30 at that sign.
- [06:53] Close: "use the booklet to learn more ... read those notes, they're very very helpful".

What this video does not contain: any read-aloud protocol (who reads A/C/D, repeat-back, how far ahead to read,
how to call the next sign), any lapboard, any marking-up technique. For these use HB p.15 (the 8 tips) and the
rally-school sessions (10a/10b).

---------------------------------------------------------------------------------

## 6. Performance charts (three videos)

### 6a. Performance Charts And Preparing Your Car (Jeff Stumb; 7:14)
Teaches: prepare the car first; then Jeff's "quick simple way" to measure start and stop losses with two poles.

Car preparation
- [00:02] "it doesn't matter how good you are at the competition portion if you're on the side of the road because
  your car's not prepared". [00:33] Drive it a lot: "you'd be surprised how many cars break on the very first day;
  the first day of the Great Race is the number one day for picking up cars". The sweep truck "will not leave you
  behind ... but boy I hate picking up rookies especially on the first day".
- [01:04] Know the rules: sent in the welcome email package; "what modifications you can and cannot have on the car
  with or without a penalty. Some of the most common things are conversions to hydraulic brakes, especially like a
  Model A's, conversion to 12-volt, well all this is allowed with no penalty". [01:37] "seatbelts in your car even if
  your car did not come equipped with seatbelts, you will have to have seatbelts".
- [02:07] The booklet "how to prepare for the Great Race ... read it and reread it several times"; has "a sample set
  of performance charts for a 1936 Packard ... it would be better than nothing".

Jeff's quick chart method (all at each speed)
- [03:07] Two objects on a deserted road (telephone poles). Speeds: "every five miles per hour between 15 and 50"
  (15, 20, 25 ... 50). Example speed 30 mph.
- [03:07] Run 1, flying: start the stopwatch at pole 1, stop at pole 2: 45 s (example).
- [04:08] Run 2, standing: stop even with pole 1, "get a countdown, 5, 4, 3, 2, 1 and go", start the stopwatch and
  the car together, stop at pole 2 while holding 30: 48 s. "At 30 miles per hour you have a three-second loss in
  starting."
- [05:09] Run 3, stop in the middle: run at 30 through pole 1, "get past the telephone pole by 50 yards", driver stops
  completely "just as they would at any stop sign" (so use a deserted road), "as soon as you stop start back to 30
  mph", stop the watch at pole 2: 50 s.
- [06:10] Arithmetic: 50 - 45 = 5 s lost for a stop-and-go; minus the 3 s start loss = "2 seconds to stop from 30
  miles per hour". Do it "at every speed, every five miles an hour between 15 and 50". Then "use the booklet; it goes
  into great detail".
- Not said: the number of runs per speed (single run shown), distance between the poles, speed variations (OUT
  speed other than IN), turns.

### 6b. How to Create Performance Charts for Vintage Car Rally (X-Cup Legacy, Auburn IN; 7:46)
Speakers (caption names doubtful): a host who says "this is Houston with the Great Race" (?); "Glynn Douglas" (?), X-Cup
participant two years; "Nigel Strat" (?), prior owner of a 1957 Plymouth two-door station wagon (the demo car, a
"donation car", end of video). Teaches: build all three charts with the Great Race chart-creation tool.

- [00:15] Three chart types: "acceleration deceleration performance charts, stop and start charts, and then turn
  charts". Requirements [00:46]: "your Timewise speedometer", "good working stopwatch", "driver navigator pair",
  "a stretch of road that is straight and it's safe that you can legally get up from 0 to 55 mph. Preferably go back
  again at 55 mph" (efficient). Use "the charts creation tool you can get directly from Great Race"; fill it "live
  while you are doing the measurements".
- [00:46] Chart 1, constant speed: two cones/checkpoints; "enter the first checkpoint going your desired speed,
  maintain that speed and exit the second checkpoint at that same speed."
- [01:16] Chart 2, from a dead stop at checkpoint 1, accelerate to the desired speed, hold to checkpoint 2.
- [01:16] Chart 3, braking ("arguably the most difficult"): "enter the first checkpoint
  at your desired speed. You will then brake until your front bumper is touching the second checkpoint. This may take
  multiple tries and be very difficult, but this is arguably one of your most important measurements."
  [04:12] "break as soon as we hit the first checkpoint ... consistent deceleration braking the entire way".
- [01:46] Demo at 25 mph between two telephone poles (one near, one farther). [03:05] standing start: front bumper
  even with checkpoint 1; navigator starts at go and "hit the stopwatch again once we cross our second checkpoint".
  The interval [01:46]-[03:05], [03:05]-[04:12] and [04:12]-[05:33] contain no captions (driving and results).
- [05:33] "each time we did it, we only did it at 25 miles an hour. In reality, you need to do it at every speed four
  times to get an average. You need to do that again for every driver that you have. Realistically, you need to set
  aside about four hours ... burn gas and burn time, but it's worth it."
- [06:04] Chart tool: enter times; it averages automatically. Demo numbers (constant speed at 25 mph): "roughly 19
  seconds"; "about 18 second average"; "again 25 mph, we had 17" (?). Single runs shown only. (At 25 mph, about 19 s
  corresponds to about 700 ft between poles, my arithmetic.)
- [06:34] "there is a yellow highlighted area on the right side of the screen over here, here, and here. It will tell
  you how to do everything you need to do, give you your averages, do the math for you, then output it as your
  performance chart. Make sure you convert the seconds for your inputs ... If you input it as a 1 minute and 2 second
  time, it will not take it and it will not convert it for you. It has to be in seconds."
- [07:04] Common problem: "a negative number in your average charts ... our acceleration braking, have a negative
  2.7. Obviously that's not possible." Cause: constant-speed 25 mph column "19.8, 19.9, 19.1, and 19.8 ... our
  19.1 is the outlier". Fix: "either simply delete it and leave it off your averages, or you can go out again, rerun
  the score, report back with your score, create a new average, and that's what we recommend to be the most accurate".

(Starting on Time [02:08] also describes a mini chart; see section 2.)

---------------------------------------------------------------------------------

## 7. How to Install a Timewise Speedometer (X-Cup 2026 team, Early Ford V8 Museum; 6:47)

Speakers (caption names doubtful): Connor Miller (host, ?), Aidan Cake (?), Jackson Sintay (?, "Alpha State"),
Calvin (?, "Alpha State"). Demo car: a '46 Ford, battery behind the passenger seat. Teaches: the Timewise 825
kit and a field install; NOT calibration.

- [00:16] Kit: user's manual ("the first thing you pull out"), the Timewise 825 speedometer ("you'll use throughout
  the whole race"), the transducer cable "included this year ... with the Alpha magnets" (?), and a power supply
  ("any ground in your car or any 12-V supply").
- [01:17] Sensor mounting: jack the car, wheel off. Route the transducer "in a way that it won't be caught in any road
  debris"; mount it "to your tie rod end on the knuckle" so it turns with the wheel (no messed-up reading or loose
  speedometer).
- [01:49] Gap between the sensor's flat surface and the magnet on the yoke: "about 3/8 to 5/8 of an inch or we use just
  three popsicle sticks glued together and put them in between". Keep the surface clean (dirty = bad readings).
- [02:19] Magnets: any rotating part (brake drum, inside of rotor); they mount on the wheel (rim) "because it's easier
  than taking your hub apart and easier to troubleshoot". "We mount two magnets, which is standard practice, so that
  every revolution counts two pulses." Clean the rim and epoxy with "JB Weld or any kind of stuff that will ... avoid
  the heat" so magnets do not get thrown off mid-day.
- [02:49] The manual allows the drive shaft, "we try to avoid that because it will get thrown off. It's higher
  revolutions and it's only one magnet, so it's not as precise". Mount "on the inside non-drive wheel. So if your car
  is rear-wheel drive, you'll mount it on the front driver side so that you're not spinning the wheel and getting
  inaccurate readings." [06:31] again: do not use the drive shaft or drive wheels (spinning tyres on a hot-rod launch
  give inaccurate readings).
- [03:19] Power: "directly to your battery" with the gold loops (positive/negative) on the supply, other end to the
  speedometer. [04:20] "In the manual, it says that you need an auxiliary battery. We've never had issues with it
  draining the battery down. As long as you unhook it overnight, you can leave it hooked in for a lunch stop or dinner
  stop." "This speedometer can only run off 12 V. If you have a 6-V battery, you will have to do something else to
  power this speedometer."
- [04:50] Cabin mount: easy to read while driving and easy to remove daily, "you're going to have to be able to unplug
  and plug in the transducer cable, and adjust the factors on the back of the speedometer from a day-to-day basis".
  No standard mount is supplied: 3D-printed holder or "a 4-in piece of PVC" to slide the unit in/out and rotate.
- [05:22] Fixing it to column/dash "is still going to be up to you".
- [05:59] Troubleshooting: speedometer jumping around = lost power; "check that 15 amp inline fuse or check the hookup
  to the ..." (cut). Stopped but reading wrong: "take this face plate and spin the needle back clockwise" (cut; HB App
  C: stop, disconnect power, remove the glass, gently move the needle to zero). Half speed or none: "missing one or
  both of your magnets ... or a dirty transducer or just a broken or messed up one".
- Calibration (the question): the only calibration content is "adjust the factors on the back of the speedometer
  from a day-to-day basis". No factor numbers, no chalk-mark procedure, no clicks. Use HB App C (factor = tenths of
  an inch for 5 tyre revolutions; clicks = 4315/3600 = 1.2 per s/h; new = old x correct/actual).

---------------------------------------------------------------------------------

## 8. New vs the handbook / regulations

Status key: NEW = not in HB/REG; CONFIRMS = in HB/REG (cite); CONTRADICTS = conflicting statement (both quoted).

| # | Video | Item | Status | HB / REG (cite) vs video | Recommended simulator action |
|---|-------|------|--------|--------------------------|------------------------------|
| 1 | Clock | Director uses stopwatch TOD mode, no clock/watch for TOD | NEW + CONTRADICTS | HB p.5 (as in 08 s2): "Sawtooth Rally Clock: continuous motion, minimal backlash"; LESSON-006: clock is "the only source for time of day". Video [00:37]: "a rather loose minute hand and it's quite easy to make a 1 minute mistake ... When I run, I no longer use a watch." | Offer "Jeff setup": stopwatch in TOD mode for TOD, clock for second hand only. Keep clock as the default analog dial. Rewrite LESSON-006 (stopwatch TOD can be primary). Relax WATCH-009 misuse flags. |
| 2 | Clock | Minute hand runs ahead near :55-:00 (second hand 55-56 s) so the minute is ambiguous | NEW | not in HB/REG | Model a minute-hand lag (hand shows next minute from about :55) and a misread penalty in D16-type drills. |
| 3 | Clock | 3-button digital stopwatch that toggles TOD / stopwatch mode | CONFIRMS | HB p.5 "lap-split function and a time-of-day function"; REG II.H.1.d(3); Q24 | Keep digital default (UI-033). Mode toggle is real: model that TOD is not visible while chrono mode is shown (?: video says "toggle between", not whether both run). |
| 4 | Clock | Analog wristwatch without stopwatch mode | CONFIRMS | REG II.H.1.d(2) | Optional wrist-watch item; no engine change. |
| 5 | Clock | Reset all watches at the official morning clock; call WWV number given during the race | CONFIRMS (+ small NEW) | HB p.13 (WWV at pick-up); REG V.C.1.b digital clock set to WWV at the start | Keep sync step. Note REG II.H.2.c bans WWV radios and II.H.1.i bans phone clocks; do not add a "call WWV" action. |
| 6 | Clock | 9-inch clock | CONFIRMS | REG II.H.1.d(1) max 10 in | None. |
| 7 | Starting | Start time = sign time + start position (9:05 + 27 = 9:32); hotel start 8:00 + position | CONFIRMS | REG VII.B.2.a, Example Rally #1/#12; STAGE-002 | None. Note "car number 27" = ASP loosely. |
| 8 | Starting | Launch early by the net start loss (3 s -> 9:31:57) | CONFIRMS | HB p.7-8: "either start 4.5 s before the instructed time or make it up after" (0 to 40) | Start drill: score front-tire crossing vs (start - loss(0 to speed)). Keep exact chart value. |
| 9 | Starting | Procedure: pull up when the car ahead leaves; 30 s warning at 9:31:30; countdown ends at 9:31:57 | NEW | HB p.15 tip 6: "At restart points do not pull up to the start point until it is your minute." HB App B: "3, 2, 1, GO" | Show a two-stage cue: warning about 30 s before the launch, then a count ending at the launch second. Clarify UI-032 "your minute" = once the car ahead has left. |
| 10 | Starting | "takes you 3 seconds to get to speed from 30 miles an hour" | CONTRADICTS (wording only) | HB p.7: "The times on this chart are NOT the actual acceleration and deceleration times. The chart shows the NET time lost." Video [03:09]: "it takes you 3 seconds to get to speed" | Keep net-loss definition; add a note in the lesson that colloquial wording is loose. |
| 11 | Starting | Self-start: nobody releases the car | CONFIRMS | HB p.13; Q17 | None. |
| 12 | Delay | Paper time-delay form handed to an official at lunch or at the finish line (they ask first thing) | CONTRADICTS (method) | REG V.H.3: "submitted by cellular telephone to the Great Race Scoring Crew, using the procedure and at the locations included in each Stage's Course Instructions"; Example #18/#36: web page, "Within 15m00s". Video [04:13]: "you will turn it in at lunch time ... or at the Finish Line each night". | Keep REG/TA-002 as default. Add a "classic form" mode: TA points = end of morning portion (lunch) and finish; form is pre-filled. Same TA points structure, different channel. |
| 13 | Delay | Fields: car, stage, leg, instruction numbers, time, description | CONFIRMS | REG V.H.3: "Stage number, your car number, the leg number, the Course Instruction number(s) ... brief description" | None. |
| 14 | Delay | Signature; other cars stopped (ahead/behind) | NEW (witnesses CONFIRM) | REG V.H.5: "witnesses should be listed when possible, especially for delays over 1m00s" | Add "witness car numbers" and a signature step (TA-005 witness field exists). |
| 15 | Delay | Leg number = checkpoints passed + 1 | NEW (consistent) | REG glossary LEG | Show this rule in the TA form helper. |
| 16 | Delay | Multiples of 10 s; make up the excess first (3:47 -> make up 7 s -> 3:40) | CONFIRMS + NEW tactic | REG V.H.3, V.H.6 (rounded up or down "to the possible detriment of the contestant"); V.H.5 may lose time at 5 mph at a checkpoint to reach a multiple | TA-007 stays (round down). Add the tactic as the hint: make the odd seconds up yourself. |
| 17 | Delay | Measure = stopwatch from stop to go, plus the chart stop-and-go loss | NEW | HB p.13 silent on measuring; REG V.H.5 example "Delayed 0m45s by a farm tractor. Made up 0m25s. Request 0m20s." | Ledger: measured delay = stopped time + brk(IN) + acc(OUT) from the car's own chart. |
| 18 | Delay | "calculates as if the event had never happened" | CONTRADICTS (tone) | REG V.H.4: Committee "may reduce or refuse"; V.H.5 expects you to make up time | Keep the committee model; the lesson should say it is not automatic. |
| 19 | Delay | Delay causes: train, tractor, school bus, construction, combine | NEW | REG V.H.1 names only a train and assisting at an accident; lights not named (TA-008) | Add tractor, school bus, construction/road-works events to the delay generator. Lights stay non-qualifying. |
| 20 | Delay | Do not panic; go through the next checkpoint as usual and note the instruction number | CONFIRMS | HB p.13 "Do not continue to make up time after passing a checkpoint" | None. |
| 21 | Making up | 10 % rule: 40 -> 44, 35 -> 38.5, 6 s per minute | CONFIRMS | HB p.10: "38.5 mph for 40 s to make up 4 s at 35" | None. |
| 22 | Making up | 20 % rule (40 -> 48, 12 s per minute) for big chunks | NEW | HB gives only 10 % | Add to make-up lesson and to the mental-math drill (D14). Warn that +20 % may exceed the posted limit (HB p.1: all speeds at or below limits). |
| 23 | Making up | Keep a running total in 6-s chunks; drop the extra speed at the next speed-change sign, then re-apply | NEW (detail) | HB p.15 tip 7 "make up losses as soon as safe" | Ledger line "gained so far"; extra speed auto-ends at a speed change in the ghost aid. |
| 24 | Making up | Shorten a stop-sign pause to gain a big chunk (10 s pause, stop 1 s = 9 s) | NEW | HB p.11: "nothing to make up unless traffic"; REG V.A.1.a(3) sight-zone stop = 30 s | Allow in the engine (it already follows the printed pause); lesson: only when late, complete stop still required, checkpoint risk if early. |
| 25 | Making up | Never make up time inside a stopwatch-timed interval | NEW | not in HB/REG | Flag extra speed during a timed hold in the debrief ("timed interval disturbed"); add a trap card. Reason is not given in the video. |
| 26 | Making up | "throw out your 5 worst legs" (rookie or sportsman) | CONTRADICTS | REG I.F.3.d: Rookie "all but the 6 worst"; I.F.3.c Sportsman 5; pooled over Stages 1-7. Video [05:11]: "throw out as a rookie or a sports[man] your 5 worst legs on the entire nine day event" | Keep REG-003 (Rookie 6). Mention that older material said 5. |
| 27 | Making up | Do not sweat one second; a missed sign costs 30 s to 5 min | CONFIRMS | HB p.14 Four S's | Debrief copy. |
| 28 | Reading | Columns A/B/C/D roles; dot = car, arrow = direction | CONFIRMS | HB App D; REG VII.B.3.c(2)-(5) | None. |
| 29 | Reading | Column A is "the most important"; D = hints only on the training example; handwritten notes not on race sheets | CONFIRMS | 08b App E (HW tags); Q26/GRIID-009 ("real race sheets carry only remarks" in D). REG Example Rally prints full sentences in D | Keep 'race' vs 'example' verbosity (GRIID-009); hints in a distinct hand-style font only in tutorial mode. |
| 30 | Reading | All the example numbers (50 mph 29 min/24 mi; 4m03.4s; 3m16.3s / 7m19.7s; 28m43.2s; 1:40 + 42 = 2:22; 20 mph; stop 15 s -> 10.2 s; 35 -> 30) | CONFIRMS | 08b App E rows 6-8, 18, 26-28; HB table 3b (20 in / 35 out = 10.2) | Build an interactive "How to read" overlay from App E in this order. |
| 31 | Reading | Distance to the next sign is unknown ("a hundred yards or ten miles") | NEW emphasis | HB p.15 tip 7 | Never print distances in race mode (already true). |
| 32 | Reading | No read-aloud protocol | NOT COVERED | HB p.15 tips 1-8 are the only source | Keep LESSON-002 on HB p.15. |
| 33 | Charts | Quick method (flying vs standing vs stop-in-middle) at 15-50 | NEW method | HB App B: braking run ends "with front wheels at end marker" and watch stopped "when the car rocks back" | Add as a second D06 measurement mode; the numbers feed the same three charts. |
| 34 | Charts | Speeds 15 to 50 (Jeff) / "0 to 55" (X-Cup) | CONFIRMS | HB 15-50; REG VII.E.1.a 50/55 on highways; STAGE-007 15-55 | CHART-001 has 55: keep. |
| 35 | Charts | Chart-creation tool (spreadsheet), seconds-only input, auto average | NEW | HB uses paper tables | D06: enter run times in seconds with automatic averages; reject mm:ss. |
| 36 | Charts | 4 runs per speed, each driver, ~4 hours | CONFIRMS + NEW | HB App B "at least 4 runs ... in BOTH directions" | Flavour text; per-driver charts (Josh vs Dad if they swap). |
| 37 | Charts | Negative net loss = constant-speed outlier; delete or re-run | NEW | HB: "If you have a lot of variation, make more runs" | D06: inject an outlier and a negative-loss warning, teach the re-run fix (HB noise data in 08b 1.7). |
| 38 | Charts | Braking measured to the second checkpoint with the front BUMPER | CONTRADICTS (minor) | HB App B: "front wheels of the car are at the end marker". Video [01:16]: "until your front bumper is touching the second checkpoint" | Pick one reference point (front wheels = REG VII.E.2.b) and say so. |
| 39 | Prep | Seat belts required; hydraulic and 12-volt conversions allowed with no penalty | CONFIRMS (belts) / NOT VERIFIED (conversions) | REG IX.B.9-11 lap belts; REG IX.C.13 allows 2-wheel to 4-wheel brake conversion; 12-V/hydraulic not found in my 09 extract | Checklist item only; check the REG text for 12-V before quoting. |
| 40 | Prep | First day is the top breakdown day; drive the car a lot | CONFIRMS | HB App F (drive 200 miles) | Lesson copy. |
| 41 | Timewise | Magnet gap 3/8-5/8 in; two magnets; epoxy; non-driven inside wheel; tie-rod mount | NEW | REG II.H.1.h(8) only "one magnetic pickup unit"; HB App C starts at the factor | Install lesson (optional). |
| 42 | Timewise | 12 V only, 15 A fuse, direct to battery, unhook overnight | NEW | none | Install lesson; link to Josh's car voltage (section 12, item 7). |
| 43 | Timewise | Factors on the back adjusted daily; needle back to zero | CONFIRMS | HB App C | None. |
| 44 | Timewise | Fault patterns (jump = power/fuse; half/zero = magnet/transducer) | NEW | none | Fault-injection drill: Timewise half-speed, jumpy, no-zero (D17-style). |

---------------------------------------------------------------------------------

## 9. Hacking.txt (empty)

`Hacking.txt` has 1 byte. `Hacking.en.vtt` holds only auto-caption hallucinations over music ("eBay, get rid of
Corsini and Cordoba in UK, space art, Garfunkel, stories of Spain") across about 5:54: no speech captured. Nothing
can be learned about content; the title suggests a how-to of some "hack" but that is a guess. Needs human
screenshots or a description from Josh (screenshot list in section 11, last row).

---------------------------------------------------------------------------------

## 10. Teaching points for Dad and Navigator best practices

### Teaching points for Dad (driver)
1. Launch on "GO": the navigator's countdown ends at the early second (start minus the car's net start loss).
   Accelerate the same way every time (HB: "a little less than full throttle").
2. Braking is part of the chart: brake the same way each time ("consistent deceleration braking the entire way",
   [04:12] charts video). Each driver needs his own chart ("every driver that you have").
3. Hold the assigned speed steady; when the navigator says "make up 6 seconds", drive 10 % over for one minute (40
   -> 44) and come off the extra speed at the next sign.
4. Do not speed up during a stopwatch-timed interval (the navigator is counting; Making Up Time [05:11]).
5. At a stop sign make a full legal stop; the navigator tells you when to go (chart pause).
6. If a train or school bus stops you: stop, stay calm, nothing to do but wait; afterwards drive the extra
   few seconds the navigator asks for to get to a multiple of 10.
7. Know the car: drive it a lot before the event, seat belts in, report any speedometer oddity (jumping = power).

### Navigator best practices
1. Each morning: set stopwatch (TOD mode) and clock from the official clock at pick-up; know that the Sawtooth
   minute hand can show the next minute from about :55, so take minutes from the stopwatch TOD and seconds from the
   sweep hand (Jeff's method).
2. Use the stopwatch only for intervals (25 s, 1:30, 6-7 min holds); use time of day for starts, transits and the
   restart after lunch.
3. Start: compute start time = sign time + position; subtract your chart loss; pull up when the car ahead leaves;
   warn at about 30 s before; count so that the last count lands on the launch second.
4. Delay: stop the stopwatch when stopped, note the instruction numbers, add the stop-and-go chart loss, round to
   a multiple of 10 by making up the odd seconds, pre-fill the form (car, stage, leg = checkpoints + 1,
   instruction numbers, time, description, signature, other cars), hand it in at the TA point.
5. Make up in chunks with a running total (10 % = 6 s/min; 20 % = 12 s/min), stop making up after a checkpoint, and
   re-compute at each speed-change sign.
6. Never chase one second; a missed sign costs 30 s to 5 min.
7. Read the sheet column A first (route), then B, C, D; keep ahead; the distance to the next sign is unknown.
8. Build the chart from many runs (4 per speed, every speed 15-50 or 55), each driver, in seconds; discard or
   re-run outliers.
9. Timewise: gap 3/8-5/8 in, two magnets, inside non-driven wheel, 12 V, fuse, factor on the back checked daily.

---------------------------------------------------------------------------------

## 11. Visual moments worth a screenshot

Timestamps are where the speaker refers to an object (inferred from speech; the video was not viewed). Take frames
at these times and about 1-2 s after.

| Video | mm:ss | What is shown (inferred) | Why useful |
|-------|-------|--------------------------|-----------|
| Clock and Stopwatch | 00:03 | The 9-inch Sawtooth clock ("This is the 9-inch watch") | Reference art for the dash clock: numbered seconds, hands, size |
| Clock and Stopwatch | 00:37 | Close-up of the clock hands ("loose minute hand") | Shows minute/second hand styling for the lag model |
| Clock and Stopwatch | 01:08 | Digital 3-button stopwatch ("like this one") | Button layout for the digital watch (mode / start-stop / lap) |
| Clock and Stopwatch | 01:39 | Clock near :55-:56 (second hand toward 12, minute hand ahead) if shown | Exactly the ambiguity to model |
| Clock and Stopwatch | 02:41 | Analog wristwatch ("third watch") | Wristwatch item art |
| Starting on Time | 01:07 | Start sign / designated start location (?) | Reference for the start-line scene |
| Starting on Time | 02:08-03:09 | Two poles / stopwatch demo or diagram (?) | Shows the mini-chart set-up |
| Time Delay Form | 02:41-04:44 | The filled time-delay form (car 99, stage 2, leg 5, instr. 102-103, 3:40, description, signature, other cars) | The only look at the paper form; copy the field layout |
| Making Up Time | 01:03-03:08 | Possibly written numbers/whiteboard for 10 % and 20 % (?) | Reference for the make-up table |
| Reading The Instructions | 00:03 | Booklet cover and page 32 | Source and edition identification |
| Reading The Instructions | 00:34 | Instruction page with columns A-D | Layout reference for the book view |
| Reading The Instructions | 01:35 | The handwritten annotations on the example | Tutorial hint style versus real sheet |
| Reading The Instructions | 03:41 | #7 cameo with dot and arrow, column C 4m03.4s | Calibration row look |
| Reading The Instructions | 04:47-05:51 | #26-#27 rows (start sign, stop with 15 s) | Start and pause rows |
| Performance Charts And Preparing Your Car | 02:37 | Sample 1936 Packard performance charts in the booklet | Chart layout |
| Performance Charts (X-Cup) | 01:46 | Telephone poles on a straight road with the car | Test-course scene |
| Performance Charts (X-Cup) | 05:33 | Chart-creation tool (spreadsheet) with yellow help boxes | UI model for D06 |
| Performance Charts (X-Cup) | 07:04 | The averages grid with -2.7 and the 19.8/19.9/19.1/19.8 column | Outlier example for the tool |
| Timewise install | 00:16-00:47 | Kit on the table: manual, Timewise 825, transducer, magnets, power supply | Kit contents |
| Timewise install | 01:17-01:49 | Transducer on the knuckle, popsicle-stick gap | Install and gap |
| Timewise install | 02:19-02:49 | Two magnets epoxied on the rim | Magnet placement |
| Timewise install | 03:19-04:20 | Power supply on the battery terminals | Wiring |
| Timewise install | 04:50-05:22 | Speedometer in 3D-printed holder and 4-in PVC mount | Cabin mount (the closest the series gets to a lapboard) |
| Timewise install | 05:59 | Face plate with the needle being reset | Needle-zero fix |
| Hacking | 0:00-5:54 | Unknown (no speech) | Take frames every 30 s; the title is the only clue |

Not shown or mentioned in any of these videos (per captions): a lapboard, a countdown bezel, a rally-computer, the
Sawtooth clock's mounting. The lapboard screenshot must come from the Handbook or the rally school sessions.

---------------------------------------------------------------------------------

## 12. Simulator changes implied (ranked)

1. [High] Time-of-day instrument model (LESSON-006, WATCH-008, WATCH-009, UI-033). Add the Sawtooth minute-hand
   lag near :55-:00 and a "Jeff setup" (stopwatch TOD for time of day, clock for seconds). Stop flagging TOD read from
   the stopwatch as misuse. Update Q24: director uses a 3-button digital stopwatch in TOD mode (evidence for the
   digital default).
2. [High] Standing-start procedure (D16 start drill, UI-032): launch = start - net loss(0 to speed); pull-up on
   car-ahead-gone; warning at about 30 s; count ending at the launch second; score the front-tire crossing.
3. [High] Time-allowance flow (TA-002/005/007, UI-031): classic paper form option at lunch and finish; measured delay =
   stopped time + chart stop-and-go loss; make-up-to-multiple-of-10 hint; witnesses and signature; leg = checkpoints
   passed + 1; add tractor, school bus and construction delays.
4. [High] Make-up lesson and ledger (D14): 10 % and 20 % with gain per minute, running total, drop extra speed at the
   next speed-change sign, stop-sign shortening for rookies, "do not make up in a timed interval" trap and debrief flag.
5. [Medium] D06 chart tool: seconds-only entry, 4 runs per speed averaged, outlier detection and negative-loss
   warning, per-driver charts, stop-in-the-middle (Jeff) measurement variant, speeds to 55.
6. [Medium] "How to read" overlay built on App E (rows 1, 6, 7, 8, 18, 26, 27, 28) with the director's narration
   order and distinct tutorial-hint styling that disappears in race mode.
7. [Medium] Josh-specific: Timewise needs 12 V; a 1939 Ford was 6 V from the factory (my own knowledge, not in the
   videos; verify with Dad); Jeff's prep video says a 12-volt conversion is allowed without penalty (verify against
   the REG). Add a "Timewise power" checklist question and, if 6 V, a note in the equipment lesson.
8. [Low] Timewise install lesson and fault injection (jumpy, half speed, needle not at zero).
9. [Low] Copy fixes: Rookie drops 6 legs (REG), not 5; "net loss, not acceleration time".
10. [Low] Open-question bookkeeping: Q17 self-start supported; Q24 digital default supported; Q13 (MBCA video) still
    unread; Hacking.txt needs a human description.

## Flagged uncertain numbers and readings (summary)
- Clock: "come off" vs "fall off"; "top of the hour" (mechanism is minute roll-over); 24-hour restart sentence.
- Starting: "about 25 seconds" at 9:31:30 for a 9:31:57 finish (27 s computed).
- Delay: "add the stop and go time" meaning (taken as the chart loss, not the printed 15 s-less pause).
- Making up: "knee of the speed"; "5 worst legs" speaker slip; reason for the timed-interval ban not given.
- Reading: "Appendix II/page 32" edition; "59" for 50 mph.
- Charts: names (Houston, Glynn Douglas, Nigel Strat) and demo times (19/18/17 s at 25 mph).
- Timewise: names (Connor Miller, Aidan Cake, Jackson Sintay, Calvin, "Alpha State"), "clockwise" needle direction.
