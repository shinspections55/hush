(function () {
    'use strict';

    if (!['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)) return;

    function createIconButton(label) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'trade-open-btn';
        button.setAttribute('aria-label', label);
        button.title = label;
        const icon = document.createElement('img');
        icon.className = 'trade-open-icon';
        icon.src = '/public/assets/trade-icon.png?v=20261112-transparent';
        icon.alt = '';
        icon.width = 52;
        icon.height = 52;
        const badge = document.createElement('span');
        badge.className = 'trade-open-badge';
        badge.setAttribute('aria-hidden', 'true');
        badge.hidden = true;
        button.append(icon, badge);
        return button;
    }

    function create({ socket, code, username, mode, mount, onState, showLauncher = true }) {
        if (!socket || !mount) return null;
        const button = createIconButton('Open trades - local prototype');
        const badge = button.children[1];
        if (showLauncher) mount.prepend(button);
        const notification = document.createElement('div');
        notification.className = 'trade-notification';
        notification.setAttribute('role', 'status');
        notification.hidden = true;
        document.body.append(notification);
        const dialog = document.createElement('dialog');
        dialog.className = 'trade-dialog';
        dialog.setAttribute('aria-label', 'Team trades');
        document.body.append(dialog);
        let state = null;
        let target = '';
        let counter = null;
        let busy = false;
        let dialogMessage = '';
        const seen = new Map();
        const escape = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[char]);
        const available = () => state && (mode === 'draft' ? state.phase === 'live' : state.phase === 'post');

        function announce(message) {
            dialogMessage = message;
            const status = dialog.querySelector('[data-trade-message]');
            if (status) {
                status.textContent = message;
                status.hidden = false;
            }
            notification.replaceChildren(document.createTextNode(message + ' '));
            const review = document.createElement('button');
            review.type = 'button';
            review.textContent = 'Review trades';
            review.onclick = () => open();
            const dismiss = document.createElement('button');
            dismiss.type = 'button';
            dismiss.textContent = 'Dismiss';
            dismiss.onclick = () => { notification.hidden = true; };
            notification.append(review, dismiss);
            notification.hidden = false;
        }

        function apply(next) {
            if (!next) return;
            const previousView = state && JSON.stringify([state.phase, state.teams, state.waiverPicks, state.offers]);
            state = next;
            onState(next);
            for (const offer of next.offers) {
                if (seen.get(offer.id) === offer.status) continue;
                if (offer.to === username && offer.status === 'pending') announce(`New trade offer from ${offer.from}.`);
                else if (seen.has(offer.id) || offer.from === username) announce(`Trade with ${offer.from === username ? offer.to : offer.from}: ${offer.status}.`);
                seen.set(offer.id, offer.status);
            }
            const pending = state.offers.filter(offer => offer.to === username && offer.status === 'pending').length;
            const label = `Open trades${pending ? ` (${pending} pending)` : ''} - local prototype`;
            button.setAttribute('aria-label', label);
            button.title = label;
            badge.textContent = String(pending);
            badge.hidden = pending === 0;
            mount.querySelectorAll('.trade-team-btn').forEach(updateTeamButton);
            const nextView = JSON.stringify([state.phase, state.teams, state.waiverPicks, state.offers]);
            if (dialog.open && !busy && previousView !== nextView) render();
        }

        function request(event, input, callback) {
            socket.timeout(7000).emit(event, { code, ...input }, (error, response) => {
                if (event !== 'getTradeState') busy = false;
                if (error || !response || !response.ok) {
                    const reasons = {
                        empty_offer: 'Select at least one player, budget amount, or waiver pick.',
                        insufficient_budget: 'A team does not have enough budget for this offer.',
                        roster_capacity_exceeded: "This trade would exceed a team's roster capacity.",
                        player_no_longer_owned: 'A selected player is no longer on that team.',
                        waiver_pick_no_longer_owned: 'A selected waiver pick is no longer owned by that team.',
                        trades_resolving: 'Trading is paused during round results or tied auctions.',
                        trades_waiting: 'Trading is available once silent bidding begins.',
                        trades_closed: 'Trading is closed because waivers have started.',
                        trade_phase_changed: 'This offer belongs to an earlier draft phase.',
                        cpu_rankings_unavailable: 'CPU trade evaluation is unavailable because default rankings could not be loaded.',
                        local_prototype_only: 'Trading is available only through localhost.',
                        not_in_draft: 'Reconnect to the draft before sending a trade.'
                    };
                    const reason = response && response.reason;
                    announce(`Trade request failed: ${error ? 'connection timeout; refresh trades before retrying' : (reasons[reason] || reason || 'unknown error')}`);
                    if (event !== 'getTradeState') refresh();
                    if (dialog.open) render();
                    return;
                }
                apply(response.state);
                if (event === 'offerTrade' && response.offer) {
                    announce(response.offer.status === 'countered'
                        ? 'The CPU sent a counteroffer. Review it in Offers.'
                        : `Offer ${response.offer.status === 'pending' ? 'sent' : response.offer.status}.`);
                }
                if (callback) callback(response);
            });
        }

        function refresh() {
            if (!socket.connected) return;
            request('getTradeState', {});
        }

        function describe(side, owner, names) {
            const team = state.teams.find(item => item.name === owner);
            const players = side.players.map((id, index) => {
                const player = team && team.roster.find(item => Number(item.id) === id);
                return names && names[index] || (player ? player.name : `Player #${id}`);
            });
            return [...players, ...(side.budget ? [`$${side.budget}`] : []),
                ...side.picks.map(id => `Waiver pick #${id}`)].join(', ') || 'Nothing';
        }

        function assets(team, name, preset) {
            const side = preset || { players: [], picks: [], budget: 0 };
            const prices = team.roster.map(draftPrice);
            const knownPrices = prices.filter(price => price !== null);
            const paid = knownPrices.reduce((total, price) => total + price, 0);
            const unknown = prices.length - knownPrices.length;
            return `<fieldset class="trade-team-card"><legend>${name === 'give' ? 'You offer' : 'You receive'}</legend>
                <div class="trade-team-heading"><h3>${escape(team.name)}</h3><span>${team.roster.length} players</span></div>
                <div class="trade-team-stats">
                    <div><span>Available budget</span><strong>$${Number(team.budget || 0)}</strong></div>
                    <div><span>${unknown ? 'Known roster cost' : 'Roster cost'}</span><strong>$${paid}</strong>${unknown ? `<small>${unknown} price${unknown === 1 ? '' : 's'} unknown</small>` : ''}</div>
                </div>
                <div class="trade-roster-heading" aria-hidden="true"><span>Roster / select players</span><span>Your cost</span></div>
                <div class="trade-roster">${team.roster.map(player => {
                    const price = draftPrice(player);
                    return `<label class="trade-player-row"><input type="checkbox" name="${name}Players" value="${Number(player.id)}" ${side.players.includes(Number(player.id)) ? 'checked' : ''}>
                        <span class="trade-player-info"><span class="trade-player-name">${escape(player.name)}</span><span class="trade-player-position">${escape(player.position || 'Unknown position')}</span></span>
                        <span class="trade-player-price" title="Current player's acquisition cost">${price === null ? '<span aria-label="Player cost unknown">--</span>' : `$${price}`}${player.acquisitionCost !== undefined ? `<small>Draft: ${originalDraftPrice(player) === null ? '--' : `$${originalDraftPrice(player)}`}</small>` : ''}</span>
                    </label>`;
                }).join('') || '<p class="trade-empty">No rostered players yet.</p>'}</div>
                <div class="trade-extra-assets">${mode === 'draft' ? `<label class="trade-budget-label">Budget to include <input type="number" name="${name}Budget" min="0" max="${Number(team.budget || 0)}" step="1" value="${side.budget}"></label>` : `<h4>Waiver picks to include</h4>${state.waiverPicks.filter(pick => pick.owner === team.name).map(pick => `<label class="trade-pick-row"><input type="checkbox" name="${name}Picks" value="${pick.id}" ${side.picks.includes(pick.id) ? 'checked' : ''}> <span>Pick #${pick.id}<small>Originally ${escape(pick.originalTeam)}</small></span></label>`).join('') || '<p class="trade-empty">No waiver picks owned.</p>'}`}</div>
                <p class="trade-selection" data-selection="${name}" role="status"></p>
            </fieldset>`;
        }

        function draftPrice(player) {
            if (player.acquisitionCost !== null && player.acquisitionCost !== undefined) {
                const cost = Number(player.acquisitionCost);
                if (Number.isFinite(cost) && cost >= 0) return Math.round(cost);
            }
            return originalDraftPrice(player);
        }

        function originalDraftPrice(player) {
            const raw = player.pricePaid ?? player.bid ?? player.finalBid ?? player.finalPrice
                ?? player.winningBid ?? player.cost ?? player.price;
            if (raw === null || raw === undefined || raw === '' || typeof raw === 'boolean') return null;
            const price = Number(raw);
            return Number.isFinite(price) && price >= 0 ? Math.round(price) : null;
        }

        function updateSelections(form) {
            const data = new FormData(form);
            for (const name of ['give', 'receive']) {
                const side = readSide(data, name);
                const parts = [`${side.players.length} player${side.players.length === 1 ? '' : 's'}`];
                if (mode === 'draft') parts.push(`$${side.budget} budget`);
                else parts.push(`${side.picks.length} waiver pick${side.picks.length === 1 ? '' : 's'}`);
                form.querySelector(`[data-selection="${name}"]`).textContent = `Selected: ${parts.join(' + ')}`;
            }
        }

        function readSide(data, name) {
            return {
                players: data.getAll(`${name}Players`).map(Number),
                picks: data.getAll(`${name}Picks`).map(Number),
                budget: Number(data.get(`${name}Budget`) || 0)
            };
        }

        function render(preserve = true) {
            if (!state) return;
            const previousForm = dialog.querySelector('form');
            const values = preserve && previousForm && previousForm.elements.partner.value === target
                ? new FormData(previousForm) : null;
            const own = state.teams.find(team => team.name === username);
            const partners = state.teams.filter(team => team.name !== username);
            if (!partners.some(team => team.name === target)) target = partners[0] && partners[0].name || '';
            const partner = partners.find(team => team.name === target);
            const give = values ? readSide(values, 'give') : counter && counter.receive;
            const receive = values ? readSide(values, 'receive') : counter && counter.give;
            dialog.innerHTML = `<header class="trade-dialog-header"><div><p class="trade-eyebrow">Local trading prototype</p><h2>Trade center</h2></div><button type="button" data-close aria-label="Close trade window">Close</button></header>
                <p class="trade-intro">Build an offer side by side. Your cost reflects cash paid for a player, with the original draft price shown separately. Player swaps keep existing costs.</p>
                <p class="trade-dialog-message" data-trade-message role="status" ${dialogMessage ? '' : 'hidden'}>${escape(dialogMessage)}</p>
                <p class="trade-phase-note" role="status">${available() ? mode === 'draft' ? "Accepting a trade clears both teams' current bids. Both must resubmit." : 'Trade players and individual waiver picks before waivers begin. Waiver order stays fixed.' : `Trading is unavailable now (${escape(state.phase)}). Offers cannot complete during results or tied auctions.`}</p>
                ${own && partner ? `<form id="trade-form"><label class="trade-partner-label">Trade with <select name="partner">${partners.map(team => `<option ${team.name === target ? 'selected' : ''} value="${escape(team.name)}">${escape(team.name)}</option>`).join('')}</select></label>
                    <div class="trade-sides">${assets(own, 'give', give)}${assets(partner, 'receive', receive)}</div>
                    <div class="trade-form-actions"><button type="submit" class="trade-primary-btn" ${!available() || busy ? 'disabled' : ''}>${counter ? 'Send counteroffer' : 'Send offer'}</button>
                    ${counter ? '<button type="button" data-reset>Cancel counter</button>' : ''}<span>CPU teams consider AV, rankings, roster fit and return.</span></div></form>` : ''}
                <h3 class="trade-offers-heading">Offers</h3><div class="trade-offers">${state.offers.slice().reverse().map(offer => `<article>
                    <div class="trade-offer-heading"><strong>${escape(offer.from)} &rarr; ${escape(offer.to)}</strong><span class="trade-offer-status">${escape(offer.status)}</span></div>
                    <p>${escape(offer.from)} gives: ${escape(describe(offer.give, offer.from, offer.giveNames))}</p>
                    <p>${escape(offer.to)} gives: ${escape(describe(offer.receive, offer.to, offer.receiveNames))}</p>
                    ${offer.cpuDecision ? `<p>${escape(offer.cpuDecision)}</p>` : ''}
                    ${offer.status === 'pending' ? offer.to === username ? `<button type="button" data-action="accept" data-id="${offer.id}" ${!available() || busy ? 'disabled' : ''}>Accept</button>
                    <button type="button" data-action="decline" data-id="${offer.id}">Decline</button>
                    <button type="button" data-action="counter" data-id="${offer.id}" ${!available() ? 'disabled' : ''}>Counter</button>` : `<button type="button" data-action="cancel" data-id="${offer.id}">Withdraw</button>` : ''}
                </article>`).join('') || '<p>No offers yet.</p>'}</div>`;
            dialog.querySelector('[data-close]').onclick = () => dialog.close();
            const form = dialog.querySelector('form');
            if (form) {
                updateSelections(form);
                form.addEventListener('input', () => updateSelections(form));
                form.elements.partner.onchange = event => { target = event.target.value; counter = null; render(false); };
                form.addEventListener('invalid', () => {
                    announce('Enter a whole budget amount within the available balance.');
                }, true);
                form.onsubmit = event => {
                    event.preventDefault();
                    if (busy || !available()) return;
                    const data = new FormData(form);
                    if (!window.crypto || typeof window.crypto.randomUUID !== 'function') {
                        announce('This browser cannot create a secure trade request. Use an up-to-date browser on localhost.');
                        return;
                    }
                    busy = true;
                    dialogMessage = 'Sending offer...';
                    render();
                    request('offerTrade', { requestId: window.crypto.randomUUID(), to: target, give: readSide(data, 'give'),
                        receive: readSide(data, 'receive'), counterId: counter && counter.id }, () => { counter = null; render(false); });
                };
            }
            const reset = dialog.querySelector('[data-reset]');
            if (reset) reset.onclick = () => { counter = null; render(false); };
            dialog.querySelectorAll('[data-action]').forEach(control => {
                control.onclick = () => {
                    if (busy) return;
                    if (control.dataset.action === 'counter') {
                        counter = state.offers.find(offer => offer.id === control.dataset.id);
                        target = counter.from;
                        render(false);
                        dialog.scrollTop = 0;
                        return;
                    }
                    busy = true;
                    request('respondTrade', { id: control.dataset.id, action: control.dataset.action });
                };
            });
        }

        function open(team) {
            const changed = team && target !== team;
            if (changed) { target = team; counter = null; }
            dialogMessage = '';
            notification.hidden = true;
            if (state) render(!changed);
            if (!dialog.open) dialog.showModal();
            refresh();
        }

        function updateTeamButton(control) {
            const team = control.dataset.tradeTeam;
            const pending = state ? state.offers.filter(offer =>
                offer.from === team && offer.to === username && offer.status === 'pending').length : 0;
            const label = team === username ? 'Open trades' : `Trade with ${team}`;
            const description = `${label}${pending ? ` (${pending} pending)` : ''} - local prototype`;
            control.setAttribute('aria-label', description);
            control.title = description;
            const badge = control.children[1];
            badge.textContent = String(pending);
            badge.hidden = pending === 0;
        }

        function createTeamButton(team) {
            const control = createIconButton('Open trades');
            control.className += ' trade-team-btn';
            control.dataset.tradeTeam = team;
            updateTeamButton(control);
            control.addEventListener('click', event => {
                event.stopPropagation();
                open(team === username ? undefined : team);
            });
            return control;
        }

        button.onclick = () => open();
        socket.on('tradeStateUpdated', apply);
        socket.on('connect', refresh);
        for (const event of ['roundResults', 'roundStarted', 'roundTimerScheduled', 'liveAuctionStarted', 'liveAuctionsCompleted', 'waiversStarted']) {
            socket.on(event, refresh);
        }
        refresh();
        const timer = setInterval(() => {
            if (document.visibilityState === 'visible' && !busy) refresh();
        }, 8000);
        window.addEventListener('pagehide', () => clearInterval(timer), { once: true });
        return { open, refresh, createTeamButton };
    }

    window.HushTrades = { create };
})();
