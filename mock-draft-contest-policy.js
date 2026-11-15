(() => {
'use strict';

const DEADLINE_2027 = '2027-04-29T23:30:00.000Z';

function formatDeadline(deadline = DEADLINE_2027, timeZone) {
  const date = new Date(deadline);
  const local = new Intl.DateTimeFormat(undefined, {
    year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
    timeZoneName: 'short', ...(timeZone ? { timeZone } : {})
  }).format(date);
  return `${local} (your local time; 7:30 PM Eastern)`;
}

function submissionPolicy(contest, now = Date.now()) {
  const deadline = contest.year === 2027 ? DEADLINE_2027 : null;
  const deadlinePassed = Boolean(deadline && now >= Date.parse(deadline));
  const open = contest.submissions === 'open' && !deadlinePassed;
  return { deadline, timeZone: 'America/New_York', open, editable: contest.year === 2027 && open };
}

const api = { DEADLINE_2027, submissionPolicy, formatDeadline };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else {
  globalThis.HushMockDeadline = api;
  document.querySelectorAll('[data-mock-deadline]').forEach(node => {
    node.textContent = formatDeadline();
    node.dateTime = DEADLINE_2027;
  });
}
})();
