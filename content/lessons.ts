/** School lessons: six short readings, one check question each. Sources are the research docs under docs/research/. */
export interface Lesson { id: string; title: string; minutes: number; body: string[]; check: { question: string; options: string[]; answer: number; explain: string }; source: string }

export const LESSONS: Lesson[] = [
  {
    id: 'ghost-car', title: 'The ghost car', minutes: 3, source: 'docs/research/07 §1, §4; DESIGN §4',
    body: [
      'The Great Race gives you no distances and no odometer. Every instruction is a landmark, an action and a speed: "Right at STOP. Pause 15. Speed 35." Hidden somewhere on the leg is a timing checkpoint, and you are scored one point for every second you cross it early or late.',
      'The rallymaster computes the perfect time with a ghost car: it drives exactly the assigned speeds, changes speed instantly at each landmark, and spends exactly the printed pause at every Pause. Your real car cannot change speed instantly, so you are late at every stop and every speed change unless you plan for it.',
      'A checkpoint resets the clock: the next leg is timed from your actual crossing, not the ghost\'s. Errors do not compound, which is why champions can average about one second per leg over a nine-day event.',
    ],
    check: { question: 'The ghost car arrives at a STOP with "Pause 15". How long does the ghost spend there?', options: ['Nothing: the ghost never stops', 'Exactly 15 seconds, then it is instantly back at speed', '15 seconds plus the braking and acceleration time'], answer: 1, explain: 'The ghost spends the printed pause and nothing else. Your car also loses braking and acceleration time, which you must subtract from your dwell.' },
  },
  {
    id: 'pause-arithmetic', title: 'Pause arithmetic: dwell = pause - loss', minutes: 4, source: 'docs/research/07 §2.1; REQUIREMENTS P2',
    body: [
      'Stopping from 35 mph and getting back to 35 costs the 1939 Ford about 7.5 seconds compared with the ghost, before you have waited at all. That number is your car\'s stop/start loss, measured on the performance table and written on your card for each entry/exit speed pair.',
      'So at "STOP. Pause 15" you should wait only pause minus loss: 15 - 7.5 = 7.5 seconds after the wheels stop, then call "go". Wait the whole 15 and you arrive 7.5 seconds late; call go immediately and you are 7.5 seconds early.',
      'Set the stopwatch bezel so the sweep hand reaches the index at the dwell, count down out loud ("three, two, one, go") and keep the rhythm identical at every stop. A constant bias calibrates out on the card; scatter does not.',
    ],
    check: { question: 'Pause 20, entering at 40 and leaving at 30. Your card says the stop/start loss for 40 in / 30 out is 6.4 s. How long do you dwell?', options: ['20 s', '13.6 s', '26.4 s', '6.4 s'], answer: 1, explain: 'dwell = pause - loss = 20 - 6.4 = 13.6 s after the driver says "stopped".' },
  },
  {
    id: 'griid-cameo', title: 'The GRIID page and the CAMEO', minutes: 4, source: 'docs/research/01 §2, 04 §2.2; REQUIREMENTS R1.2',
    body: [
      'A Great Race route page has five columns: the line number, A = the CAMEO diagram, B = section symbols (warm-up, calibration, transit, free zone, lunch, refuel, pit), C = speeds and timing, D = hints. Column C is the one you execute: a speed, a Pause, or a timed segment such as "30 for 0:36 then 40".',
      'The CAMEO is read from the dot: the dot is the road you arrive on, the arrow is the road you leave on, the bold line between them is the route. Thin lines are roads you do not take. Dashed or omitted lines are driveways, parking lots, unpaved roads and dead ends: they do not count as roads.',
      'Quoted signs must match exactly: "SPEED LIMIT 45" is not "SPEED 45". A T is where your road ends; a Y is a fork of roughly equal roads; "bear" is a gentle change of heading, "acute" is sharper than 90 degrees, a "jog" is a short offset.',
    ],
    check: { question: 'In a CAMEO, what does the dot mark?', options: ['The checkpoint', 'The road you arrive on', 'The road you leave on', 'A driveway'], answer: 1, explain: 'Dot = entry, arrow = exit, bold line = route between them.' },
  },
  {
    id: 'calibration', title: 'The morning calibration run', minutes: 4, source: 'docs/research/07 §3; REQUIREMENTS P5',
    body: [
      'Your speedometer lies, and the tires change the lie every day. Each morning the route book opens with a calibration run: hold an assigned speed between marked landmarks whose perfect split times are printed in Column C. Lap the stopwatch at each mark and compare.',
      'k = sum of perfect splits / sum of your actual splits. If your splits are longer than perfect, the car is slower than the speedometer says, and you must hold a higher indicated speed: indicated = assigned / k. Write the result for 20, 25, 30 ... 50 mph on a cheat card, or set the factor on a Timewise speedometer.',
      'A one percent speedometer error is nine seconds over a fifteen-minute leg. Calibration dominates the score, and it costs nothing but attention during the first ten minutes of the day.',
    ],
    check: { question: 'Perfect splits sum to 300 s, yours to 306 s at an indicated 50. What indicated speed holds a true 50?', options: ['49.0', '50.0', '51.0', '53.0'], answer: 2, explain: 'k = 300 / 306 = 0.980; indicated = 50 / 0.980 = 51.0. Your splits were long, so the car is slow for the reading: hold more.' },
  },
  {
    id: 'recovery', title: 'Early, late and the 10 % / 20 % rule', minutes: 4, source: 'docs/research/03 §4.3, 07 §6; REQUIREMENTS P6',
    body: [
      'A truck, a red light or a long stop makes you late by a known number of seconds: you measured it on the stopwatch. Write it in the ledger (press E in the cockpit). Then recover it in open cruise, well before any likely checkpoint spot, and stop correcting once the ledger reads zero.',
      'The field rule: run 10 % over the assigned speed for 10 times the delay, or 20 % over for 5 times the delay. At 35 mph, a 6-second delay is recovered with 38.5 mph for 60 seconds. The rule slightly under-corrects on purpose: being early costs exactly as much as being late, and early is harder to fix.',
      'In seconds-per-second terms: at +5 mph you make up one second for every (v / 5 + 1) seconds of ghost time; at +10 mph for every (v / 10 + 1). Trains and traffic lights may instead be declared as a Time Allowance at the checkpoint - but never both declare and make up the same seconds.',
    ],
    check: { question: 'You are 8 s late at an assigned 40 mph. Using the 20 % rule, what do you drive?', options: ['48 mph for 40 s', '44 mph for 80 s', '48 mph for 80 s', '50 mph until the next sign'], answer: 0, explain: '20 % over 40 is 48 mph, held for 5 x 8 = 40 seconds. Then back to 40 and ledger zero.' },
  },
  {
    id: 'protocol', title: 'Driver / navigator protocol', minutes: 3, source: 'docs/research/03 §1, 04 §4; REQUIREMENTS P10',
    body: [
      'The driver drives to the speedometer and looks for landmarks. The navigator reads the book, holds the stopwatch and clock, and calls everything: the next landmark before looking down again, the turn before the decision point (150 ft before the intersection in this trainer), the speed with a lead so the car is mid-ramp at the sign, and "go" on the count.',
      'Every callout gets a read-back: "Right at the stop" / "Right at the stop, got it"; "Thirty-six" / "Holding thirty-six". The driver says "stopped" when the wheels stop and "at thirty-six" when the needle settles, and checks off each instruction as it is executed so neither of you loses the line.',
      'If a landmark does not appear when it should, do not keep driving: stop before the leading edge of the next intersection and work out where you are. A wrong turn costs two minutes; a missed pause costs fifteen seconds; a lost line can cost the whole day.',
    ],
    check: { question: 'When should the turn be called?', options: ['As the car enters the intersection', 'Before the decision point, after the driver has the landmark in sight', 'After the driver asks "left or right?"'], answer: 1, explain: 'Call it early enough that the driver can brake and position; if he has to ask, the callout was late.' },
  },
];
