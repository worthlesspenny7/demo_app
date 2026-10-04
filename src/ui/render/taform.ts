/**
 * The Time Allowance forms as HTML strings (TAF-001, TAF-003; no DOM). The web form is the 2026 grscores.com page word for word (frame 2026-110m28s): a login page and an entry page
 * (Stage, Leg Number, Between Instructions a & b, Allowance m s, Reason, a green Submit, a yellow "CLICK to see Time Allowances Submitted", a red "CLICK this after submitting ALL
 * Time Allowances for the ENTIRE stage"); it has no witness field. The paper sheet is the older Time Delay Form (11b section 2.4).
 */
import { TA_WEB, TA_PAPER, TA_CAUSES, TA_STEP } from '../viewmodels/ta.js';
import { esc } from './griid.js';

export interface TaFormState {
  /** typed values by field id (kept across rebuilds) */
  draft: Record<string, string>;
  legs: { legIndex: number }[];
  /** the leg to start on and what the engine suggests for it (lines, claim, cause) */
  first?: { legIndex: number; fromLine: number | null; toLine: number | null; suggested: number; cause: string | null } | null;
  carDefault: string;
  /** web: the login page has been passed */
  loggedIn: boolean;
  /** show the red end-of-stage button (the engine only accepts it at the end-of-stage TA point) and whether it has been pressed */
  endOfStage: boolean; acked: boolean;
}

const v = (st: TaFormState, id: string, dflt = ''): string => esc(st.draft[id] ?? dflt);
const legOptions = (st: TaFormState, prefix: string): string => st.legs.map(l => `<option value="${l.legIndex}"${st.first?.legIndex === l.legIndex ? ' selected' : ''}>${prefix}${l.legIndex}</option>`).join('');
const minOf = (s: number): string => String(Math.floor(s / 60));
const secOf = (s: number): string => String(s % 60);

/** The web form: login page then entry page, both in the DOM (one hidden) so typed values survive. */
export function taWebHtml(st: TaFormState): string {
  const f = st.first;
  const claim = f ? f.suggested : 0;
  const reasonDefault = f?.cause ? `Delayed by ${f.cause}` : '';
  return `<div class="taweb" id="taweb">
    <div class="taweb-screen taweb-login" id="ta-login-screen"${st.loggedIn ? ' hidden' : ''}>
      <div class="taweb-title">${TA_WEB.loginTitle.map(esc).join('<br>')}</div>
      <label class="taweb-row">${esc(TA_WEB.login.car)} <input id="ta-car" type="text" inputmode="numeric" autocomplete="off" value="${v(st, 'ta-car', st.carDefault)}"></label>
      <label class="taweb-row">${esc(TA_WEB.login.password)} <input id="ta-password" type="password" inputmode="numeric" maxlength="4" autocomplete="off" value="${v(st, 'ta-password')}"></label>
      <label class="taweb-row taweb-wide">${esc(TA_WEB.login.phone)} <input id="ta-phone" type="tel" autocomplete="off" value="${v(st, 'ta-phone')}"></label>
      <button id="ta-login" class="taweb-btn green" type="button">${esc(TA_WEB.login.button)}</button>
    </div>
    <div class="taweb-screen taweb-entry" id="ta-entry-screen"${st.loggedIn ? '' : ' hidden'}>
      <div class="taweb-stage">${esc(TA_WEB.entry.stage)} <input id="ta-stage" type="number" min="0" step="1" value="${v(st, 'ta-stage')}"></div>
      <label class="taweb-row">${esc(TA_WEB.entry.leg)} <select id="ta-leg">${legOptions(st, 'Leg ')}</select></label>
      <div class="taweb-block"><div>${esc(TA_WEB.entry.between)}</div><div class="taweb-pair"><input id="ta-from" type="number" min="1" step="1" value="${v(st, 'ta-from', f?.fromLine != null ? String(f.fromLine) : '')}"> <b>${esc(TA_WEB.entry.and)}</b> <input id="ta-to" type="number" min="1" step="1" value="${v(st, 'ta-to', f?.toLine != null ? String(f.toLine) : '')}"></div></div>
      <div class="taweb-block"><div>${esc(TA_WEB.entry.allowance)}</div><div class="taweb-pair"><input id="ta-min" type="number" min="0" step="1" value="${v(st, 'ta-min', f ? minOf(claim) : '')}"> ${esc(TA_WEB.entry.minutes)} <input id="ta-sec" type="number" min="0" max="59" step="${TA_STEP}" value="${v(st, 'ta-sec', f ? secOf(claim) : '')}"> ${esc(TA_WEB.entry.seconds)}</div></div>
      <div class="taweb-block"><div>${esc(TA_WEB.entry.reason)}</div><input id="ta-cause" type="text" list="ta-causes" maxlength="40" value="${v(st, 'ta-cause', reasonDefault)}"></div>
      <datalist id="ta-causes">${TA_CAUSES.map(c => `<option value="Delayed by ${c}">`).join('')}</datalist>
      <div class="taweb-btnrow"><button id="ta-submit" class="taweb-btn green" type="button">${esc(TA_WEB.entry.submit)}</button>
      <button id="ta-see" class="taweb-btn yellow" type="button">${esc(TA_WEB.entry.seeSubmitted)}</button></div>
      <button id="ta-ack-btn" class="taweb-btn red" type="button"${st.acked ? ' disabled' : ''}>${esc(TA_WEB.entry.done)}</button>
      <div class="taweb-host">${esc(TA_WEB.entry.host)}</div>
    </div>
  </div>`;
}

/** The classic paper Time Delay Form (11b section 2.4): three requests on one sheet, the witness rows, the signature and status, the office-use blocks. */
export function taPaperHtml(st: TaFormState): string {
  const f = st.first; const claim = f ? f.suggested : 0;
  const role = (id: string): string => `<select id="${id}"><option value=""></option><option value="contestant"${st.draft[id] === 'contestant' ? ' selected' : ''}>Contestant</option><option value="official"${st.draft[id] === 'official' ? ' selected' : ''}>Official</option></select>`;
  const w = (n: number): string => `<tr><td><input id="ta-w${n}-car" type="text" size="4" value="${v(st, `ta-w${n}-car`)}"></td><td><input id="ta-w${n}-name" type="text" value="${v(st, `ta-w${n}-name`)}"></td><td>${role(`ta-w${n}-role`)}</td></tr>`;
  const type = st.draft['ta-type'] ?? 'time-allowance';
  return `<div class="tapaper" id="tapaper">
    <div class="tapaper-top"><label>Car # <input id="ta-car" type="text" inputmode="numeric" size="4" value="${v(st, 'ta-car', st.carDefault)}"></label> <label>Stage # <input id="ta-stage" type="number" min="0" step="1" value="${v(st, 'ta-stage')}"></label> <label>Leg # <select id="ta-leg">${legOptions(st, '')}</select></label></div>
    <p class="tapaper-intro">${esc(TA_PAPER.intro)}</p>
    <fieldset class="tapaper-types" id="ta-types">${TA_PAPER.types.map(t => `<label><input type="radio" name="ta-type" value="${t.id}"${type === t.id ? ' checked' : ''}> ${esc(t.label)}</label>`).join('')}</fieldset>
    <p>${esc(TA_PAPER.conditions)} <input id="ta-from" type="number" min="1" step="1" size="4" value="${v(st, 'ta-from', f?.fromLine != null ? String(f.fromLine) : '')}"> and # <input id="ta-to" type="number" min="1" step="1" size="4" value="${v(st, 'ta-to', f?.toLine != null ? String(f.toLine) : '')}">.</p>
    <p>${esc(TA_PAPER.allowance)} <input id="ta-min" type="number" min="0" step="1" size="3" value="${v(st, 'ta-min', f ? minOf(claim) : '')}"> minutes and <input id="ta-sec" type="number" min="0" max="59" step="${TA_STEP}" size="3" value="${v(st, 'ta-sec', f ? secOf(claim) : '')}"> seconds ${esc(TA_PAPER.multiples)} ${esc(TA_PAPER.because)}</p>
    <textarea id="ta-circumstances" rows="3" maxlength="600" placeholder="caught by a train at the crossing on Hwy. 49.">${v(st, 'ta-circumstances', f?.cause ? `caught by a ${f.cause}` : '')}</textarea>
    <p class="muted tapaper-formal">${esc(TA_PAPER.formal)}</p>
    <div class="tapaper-witness"><b>${esc(TA_PAPER.witnessed)}</b><table><thead><tr>${TA_PAPER.witnessCols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${w(1)}${w(2)}</tbody></table></div>
    <p class="tapaper-certify">${esc(TA_PAPER.certify)}</p>
    <div class="tapaper-sign"><label>${esc(TA_PAPER.signature)} <input id="ta-signature" type="text" value="${v(st, 'ta-signature')}"></label> <label>${esc(TA_PAPER.status)} <select id="ta-status"><option value="driver"${st.draft['ta-status'] !== 'navigator' ? ' selected' : ''}>Driver</option><option value="navigator"${st.draft['ta-status'] === 'navigator' ? ' selected' : ''}>Navigator</option></select> <span class="muted">${esc(TA_PAPER.statusHint)}</span></label></div>
    <div class="tapaper-office muted"><div>${esc(TA_PAPER.received)} ________ Date ______ Time ______</div><div>${esc(TA_PAPER.decision)} Date ________ Time ________</div></div>
    <button id="ta-submit" class="primary" type="button">Hand in the sheet</button>
    ${st.endOfStage ? `<button id="ta-ack-btn" class="taweb-btn red" type="button"${st.acked ? ' disabled' : ''}>${esc(TA_WEB.entry.done)}</button>` : ''}
  </div>`;
}
