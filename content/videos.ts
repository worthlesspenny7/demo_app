/**
 * SCH-002: the 13 official Great Race training videos whose auto-captions are in docs/research/transcripts
 * (titles from docs/research/transcripts/README.md, keys from urls.txt). `url` is copied from
 * docs/research/transcripts/urls.txt when Josh has filled it in (a test keeps the two in step); a blank URL
 * means the reference chip opens the excerpt only.
 */
export const VIDEO_KEYS = ['2026', '2024', 'classen1', 'croker2', 'clock', 'start', 'delay', 'makeup', 'reading', 'prepcharts', 'xcupcharts', 'timewise', 'hacking'] as const;
export type VideoKey = (typeof VIDEO_KEYS)[number];

export interface Video {
  key: VideoKey;
  title: string;
  /** the short name a chip label uses: "Video 2026 110:28" */
  short: string;
  /** YouTube URL from urls.txt, undefined while unknown */
  url?: string;
  note: string;
}

export const VIDEOS: Video[] = [
  { key: '2026', title: '2026 Great Race Training Session', short: '2026', note: 'Main rally school, 2026 (Brad, Steve and Janet). The current reference.' },
  { key: '2024', title: '2024 Great Race Training Session', short: '2024', note: 'Main rally school, 2024 ("Great Race 101"); paper time allowances, now replaced.' },
  { key: 'classen1', title: 'Rally School with Rally Master John Classen Part 1', short: 'Classen', note: 'John Classen, Director of Competition: checkpoints, scoring, reading a whole day of instructions.' },
  { key: 'croker2', title: 'Rally School Q&A Segment with Veteran Racer Bill Croker Part 2', short: 'Croker', note: 'Bill Croker, author of the Rookie Handbook: the Four S\'s, stops, splits, ICE.' },
  { key: 'clock', title: 'Clock and Stopwatch', short: 'Clock', note: 'Jeff Stumb: the loose minute hand and the stopwatch time-of-day mode.' },
  { key: 'start', title: 'Starting on Time', short: 'Start', note: 'Jeff Stumb: base plus position, launch early by the start loss, the countdown.' },
  { key: 'delay', title: 'Filling Out a Time Delay Form', short: 'Delay', note: 'Jeff Stumb: what qualifies, measuring a delay, 10 s steps (paper form era).' },
  { key: 'makeup', title: 'Making Up Time', short: 'Make-up', note: 'Jeff Stumb: the 10 % and 20 % rules, chunks, stops, never inside a timed interval.' },
  { key: 'reading', title: 'Reading The Instructions', short: 'Reading', note: 'Jeff Stumb: the columns, the dot and arrow, a morning of instructions.' },
  { key: 'prepcharts', title: 'Performance Charts And Preparing Your Car', short: 'Charts', note: 'Jeff Stumb: the two-pole method for flying, standing and stop-in-the-middle runs.' },
  { key: 'xcupcharts', title: 'How to Create Performance Charts for Vintage Car Rally', short: 'X-Cup charts', note: 'X-Cup team: three chart types, four runs per speed, the chart spreadsheet.' },
  { key: 'timewise', title: 'How to Install a Timewise Speedometer in a Great Race Rally Car', short: 'Timewise', note: 'X-Cup team: sensor, magnets, power and faults of the Timewise 825.' },
  { key: 'hacking', title: 'Hacking', short: 'Hacking', note: 'No speech captured; visuals only.' },
];

export const videoByKey = (key: string): Video | undefined => VIDEOS.find(v => v.key === key);

/** The URL that opens the video at `seconds`, or undefined while the URL is unknown. */
export const videoLink = (key: string, seconds: number): string | undefined => {
  const url = videoByKey(key)?.url;
  if (!url) return undefined;
  return `${url}${url.includes('?') ? '&' : '?'}t=${Math.max(0, Math.round(seconds))}s`;
};

/** "110:28" -> 6628 */
export const mmssToSeconds = (mmss: string): number => { const [m, s] = mmss.split(':').map(Number); return (m ?? 0) * 60 + (s ?? 0); };
/** 6628 -> "110:28" */
export const secondsToMmss = (sec: number): string => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
