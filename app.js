const emptyState = () => ({
  players: [], round: 0, impostors: { ember: [], tide: [] }, impostorCount: 0, revealed: false, phase: 'lobby',
  votes: { ember: {}, tide: {} }, tieVotes: { ember: {}, tide: {} }, resultVotes: { ember: {}, tide: {} }, tieBreakers: {}, tieVoters: {}, teamSelections: {},
  votedOut: { ember: [], tide: [] }, voteHistory: [], notices: {}, lastVoteDisplay: null
});
let state = JSON.parse(localStorage.getItem('darkline-state') || 'null') || emptyState();
let currentId = sessionStorage.getItem('darkline-current') || '';
const $ = s => document.querySelector(s);
const save = () => localStorage.setItem('darkline-state', JSON.stringify(state));
const teamName = t => t === 'ember' ? '912' : t === 'tide' ? '414' : '备战蛆';
const player = () => state.players.find(p => p.id === currentId);
const members = t => state.players.filter(p => p.team === t);
const activeMembers = t => members(t).filter(p => !state.votedOut[t]?.includes(p.id));
const administrator = () => members('ember')[0];
const toast = text => { const el = $('#toast'); el.textContent = text; el.classList.remove('hidden'); setTimeout(() => el.classList.add('hidden'), 2600); };
function removePlayer(id) {
  const leaving = state.players.find(p => p.id === id);
  if (!leaving) return;
  state.players = state.players.filter(p => p.id !== id);
  ['ember', 'tide'].forEach(team => {
    state.impostors[team] = (state.impostors[team] || []).filter(item => item !== id);
    state.votedOut[team] = (state.votedOut[team] || []).filter(item => item !== id);
    [state.votes[team], state.tieVotes[team], state.resultVotes?.[team]].forEach(ballots => Object.entries(ballots || {}).forEach(([voter, target]) => { if (voter === id || target === id) delete ballots[voter]; }));
    if (state.tieBreakers[team]) { state.tieBreakers[team] = state.tieBreakers[team].filter(item => item !== id); if (state.tieBreakers[team].length < 2) delete state.tieBreakers[team]; }
  });
  delete state.notices[id]; save();
  if (state.players.length === 0) {
    state = emptyState();
    save();
  }
}
function startNewMatch() {
  const players = state.players.map(player => ({ id: player.id, team: player.team || 'staging' }));
  state = emptyState();
  state.players = players;
  save();
}
function joinTeam(team) {
  const me = player();
  if (!me) return toast('玩家状态已失效，请重新输入名称');
  if (team !== 'staging' && members(team).length >= 5 && me.team !== team) return toast('该队伍已满');
  me.team = team; save(); toast(`已加入 ${teamName(team)}`); render();
}
function normalize() {
  if (Array.isArray(state.impostors)) state.impostors = { ember: state.impostors.filter(id => members('ember').some(p => p.id === id)), tide: state.impostors.filter(id => members('tide').some(p => p.id === id)) };
  state.impostors ??= { ember: [], tide: [] }; state.impostorCount ??= 0; state.revealed ??= false; state.votes ??= { ember: {}, tide: {} }; state.tieVotes ??= { ember: {}, tide: {} }; state.resultVotes ??= JSON.parse(JSON.stringify(state.votes));
  state.resultVotes.ember ??= { ...state.votes.ember }; state.resultVotes.tide ??= { ...state.votes.tide };
  state.tieBreakers ??= {}; state.tieVoters ??= {}; state.teamSelections ??= {}; state.votedOut ??= { ember: [], tide: [] }; state.voteHistory ??= []; state.notices ??= {}; state.lastVoteDisplay ??= null;
  state.players.forEach(p => { if (!p.team) p.team = 'staging'; });
  Object.entries(state.tieBreakers).forEach(([team, candidates]) => {
    if (state.tieVoters[team] && !Array.isArray(state.tieVoters[team])) state.tieVoters[team] = [state.tieVoters[team]];
    if (!state.tieVoters[team]) state.tieVoters[team] = selectTieVoters(team, candidates, state.votes[team]);
  });
}
function slots(team) { const list = members(team), capacity = team === 'staging' ? 10 : 5; return Array.from({ length: capacity }, (_, i) => list[i] ? `<span class="slot filled" title="${list[i].id}">${list[i].id.slice(0, 4).toUpperCase()}</span>` : '<span class="slot">+</span>').join(''); }
function render() {
  normalize(); const me = player(), count = state.players.length;
  $('#onlineCount').textContent = String(count).padStart(2, '0'); $('#roundCounter').textContent = `ROUND ${String(state.round).padStart(2, '0')}`;
  $('#roundLabel').textContent = state.phase === 'lobby' ? '等待组队' : state.phase === 'voting' ? '投票进行中' : '海克斯乱斗中';
  const needsTeam = me && !me.team;
  $('#welcomeView').classList.toggle('hidden', !!me); $('#lobbyView').classList.toggle('hidden', !me || (state.phase !== 'lobby' && !needsTeam)); $('#missionView').classList.toggle('hidden', !me || state.phase === 'lobby' || needsTeam);
  const admin = administrator();
  const canOpenConsole = Boolean(me && admin && me.id === admin.id);
  $('#adminEntry').classList.toggle('hidden', !canOpenConsole);
  if (!canOpenConsole) $('#adminModal').classList.add('hidden');
  if (me) {
    $('#playerGreeting').textContent = `你的代号 · ${me.id}`; $('#emberSlots').innerHTML = slots('ember'); $('#tideSlots').innerHTML = slots('tide'); $('#stagingSlots').innerHTML = slots('staging');
    const emberCount = members('ember').length, tideCount = members('tide').length, stagingCount = members('staging').length;
    $('#progressFill').style.width = `${Math.min(100, (emberCount + tideCount) * 10)}%`; $('#capacityText').textContent = `912 ${emberCount}/5 · 414 ${tideCount}/5 · 备战蛆 ${stagingCount}`;
    document.querySelectorAll('[data-join]').forEach(btn => {
      const t = btn.dataset.join, full = t !== 'staging' && members(t).length >= 5 && me.team !== t;
      btn.disabled = full; btn.innerHTML = me.team === t ? `已在 ${teamName(t)} <span>✓</span>` : full ? '队伍已满' : `加入 ${teamName(t)} <span>→</span>`;
      btn.onclick = event => { event.preventDefault(); event.stopPropagation(); joinTeam(t); };
    });
    $('#userChip').textContent = me.team ? `${me.id} · ${teamName(me.team)}` : `${me.id} · 待选阵营`; renderMission(me);
  }
  if (!$('#adminModal').classList.contains('hidden')) renderAdmin();
}
function renderMission(me) {
  const imp = state.impostors[me.team]?.includes(me.id), notice = state.notices[me.id];
  let title = '等待管理员安排', hint = '所有人已到位，请耐心等待。';
  if (state.phase === 'active') { title = '海克斯乱斗进行中'; hint = '管理员会在对局结束后开启本队投票。'; }
  if (state.phase === 'voting') { title = '队内投票已开启'; hint = '本次仅投出一名目标，请在本队候选人中选择。'; }
  $('#missionTitle').textContent = title; $('#missionState').textContent = title; $('#missionHint').textContent = hint;
  const identityKnown = state.phase !== 'lobby';
  $('#secretCard').classList.toggle('active', identityKnown);
  $('#secretTitle').textContent = identityKnown ? (imp ? '你的身份：内鬼' : '你的身份：非内鬼') : '情报尚未送达';
  $('#secretText').textContent = identityKnown ? (imp ? '保持隐蔽。你的身份只会向你本人显示。' : '你的身份不是内鬼') : '身份分配后，只有相关玩家会收到私密通知。';
  const notificationBox = $('#notificationBox');
  notificationBox.className = notice ? `notification-box result-notice ${notice.correct ? 'correct' : 'wrong'}` : 'notification-box';
  notificationBox.innerHTML = notice
    ? `<img class="result-image" src="${notice.correct ? 'bixin.jpg' : 'qu.jpg'}" alt="${notice.correct ? '猜中内鬼' : '猜错内鬼'}"><div class="result-copy"><p>${notice.text}</p></div>`
    : state.phase === 'voting' ? `<span>✦</span><p>请为 <b>${teamName(me.team)}</b> 提交一票。</p>${renderPlayerVote(me)}` : '<span>✦</span><p>保持页面开启，等待管理员推送本轮进度。</p>';
}
function renderPlayerVote(me) {
  const team = me.team, tied = state.tieBreakers[team], deciders = state.tieVoters[team] || [];
  const hasTieBreak = Object.keys(state.tieBreakers).length > 0;
  if (state.votedOut[team]?.includes(me.id)) return '<span class="vote-meta">你已在前一轮被排出，本轮无需投票</span>';
  if (state.teamSelections[team]) return '<span class="vote-meta">本队目标已决出，等待另一队完成投票</span>';
  if (hasTieBreak && !tied) {
    return '<span class="vote-meta">本队投票已锁定，等待另一队完成决胜票</span>';
  }
  if (tied) {
    if (!deciders.includes(me.id)) return '<span class="vote-meta">本队初始票已锁定，等待指定队员投出决胜票</span>';
    const pick = state.tieVotes[team][me.id];
    return `<div class="player-vote"><span class="vote-meta">你是决胜投票人：请在平票候选人中选择</span>${tied.map(id => `<button class="vote-btn ${pick === id ? 'selected' : ''}" data-tie-vote="${id}">${id}<span>${pick === id ? '已选择' : '投票'}</span></button>`).join('')}</div>`;
  }
  const pick = state.votes[team][me.id], candidates = activeMembers(team);
  return `<div class="player-vote">${candidates.map(p => `<button class="vote-btn ${pick === p.id ? 'selected' : ''}" data-player-vote="${p.id}">${p.id}<span>${pick === p.id ? '已选择' : '投票'}</span></button>`).join('')}</div>`;
}
function renderAdmin() {
  const allReady = ['ember', 'tide'].every(t => members(t).length === 5);
  let html = `<div class="admin-panel"><h3>玩家就绪情况 <span class="vote-meta">在线 ${state.players.length} 人</span></h3><p>可将异常离线或误入的玩家踢出对局；被踢玩家会返回主界面。</p><div class="identity-list">${state.players.length ? state.players.map(p => `<span class="admin-player"><span class="identity-tag">${p.id} · ${p.team ? teamName(p.team) : '待选队伍'}</span><button class="kick-btn" data-kick="${p.id}">踢出</button></span>`).join('') : '<span class="admin-note">还没有玩家进入备战蛆</span>'}</div><div style="margin-top:18px" class="control-row"><button class="primary-btn" id="newMatchBtn">新的对局</button></div><div class="admin-note">新的对局会保留在线玩家和已选队伍，清空身份、投票与通知，并回到选队状态。</div></div>`;
  if (state.phase === 'lobby') html += `<div class="admin-panel"><h3>生成本局内鬼</h3><p>双方各随机生成 N 名内鬼；N 为 1 至 5。身份将私密推送给对应玩家。</p><div class="control-row"><input class="number-input" id="impostorCount" type="number" min="1" max="5" value="1"><button class="primary-btn" id="generateBtn" ${allReady ? '' : 'disabled'}>随机生成内鬼</button></div>${!allReady ? '<div class="admin-note">需等待 912 与 414 各有 5 名玩家；其他玩家可留在备战蛆。</div>' : ''}</div>`;
  if (state.phase === 'active') html += `<div class="admin-panel"><h3>本局内鬼</h3><p>身份已生成并私密通知对应玩家。管理员可按需查看名单。</p><button class="secondary-btn" id="revealBtn">${state.revealed ? '隐藏内鬼名单' : '查看内鬼'}</button>${state.revealed ? `<div class="identity-list"><span class="identity-tag impostor">912 · ${state.impostors.ember.join('、')}</span><span class="identity-tag impostor">414 · ${state.impostors.tide.join('、')}</span></div>` : ''}</div>${renderLastVoteDisplay()}<div class="admin-panel"><h3>本局投票管理</h3><p>已完成 ${state.voteHistory.length} / ${state.impostorCount} 次投票。每次投票每队只会选出一名目标，结算反馈将只推送给玩家。</p><div class="control-row"><button class="primary-btn" id="startVoteBtn" ${state.voteHistory.length >= state.impostorCount ? 'disabled' : ''}>${state.voteHistory.length >= state.impostorCount ? '本局投票已完成' : `发起第 ${state.voteHistory.length + 1} 次内鬼投票`}</button><button class="secondary-btn" id="nextRoundBtn">结束本局，重新分队</button></div></div>`;
  if (state.phase === 'voting') html += `<div class="admin-panel"><h3>本局内鬼</h3><p>投票结算期间仍可查看内鬼名单；结束本局后会自动隐藏。</p><button class="secondary-btn" id="revealBtn">${state.revealed ? '隐藏内鬼名单' : '查看内鬼'}</button>${state.revealed ? `<div class="identity-list"><span class="identity-tag impostor">912 · ${state.impostors.ember.join('、')}</span><span class="identity-tag impostor">414 · ${state.impostors.tide.join('、')}</span></div>` : ''}</div><div class="admin-panel"><h3>队内投票 · 第 ${state.voteHistory.length + 1} 次</h3><p>每名玩家仅能选择本队一名候选人。若平票，未投给平票双方的队员将在两名候选人之间投出决胜票。</p><div class="vote-area">${['ember', 'tide'].map(renderVoteTeam).join('')}</div><div style="margin-top:16px"><button class="primary-btn" id="settleVoteBtn">结算本次投票并推送反馈</button></div></div>`;
  $('#adminContent').innerHTML = html;
}
function renderVoteTeam(team) {
  const total = {}; Object.values(state.votes[team]).forEach(id => total[id] = (total[id] || 0) + 1);
  const tied = state.tieBreakers[team], deciders = state.tieVoters[team] || [];
  const tieStatus = state.teamSelections[team]
    ? `<div class="vote-meta" style="margin-top:10px">本队已决出目标：${state.teamSelections[team]}</div>`
    : tied ? `<div class="vote-meta" style="margin-top:10px">决胜票 · 已投 ${deciders.filter(id => state.tieVotes[team][id]).length}/${deciders.length}（${deciders.join('、')}）</div>` : '';
  return `<div class="vote-team"><h4>${teamName(team)} <span class="vote-meta">已投 ${Object.keys(state.votes[team]).length}/${activeMembers(team).length}</span></h4><div class="vote-list">${members(team).map(p => `<div class="vote-btn"><span>${p.id}${state.votedOut[team].includes(p.id) ? ' · 已排出' : ''}</span><span class="vote-meta">${total[p.id] || 0} 票</span></div>`).join('')}</div>${tieStatus}</div>`;
}
function renderLastVoteDisplay() {
  const snapshot = state.lastVoteDisplay;
  if (!snapshot) return '';
  return `<div class="admin-panel"><h3>上一轮投票展示</h3><div class="vote-area">${['ember', 'tide'].map(team => {
    const ballots = snapshot.votes[team] || {}, total = totals(team, snapshot.votes);
    const finalTarget = snapshot.selected[team];
    const decisionBallots = snapshot.tieVotes[team] || {};
    const decisionText = Object.keys(decisionBallots).length ? ` · 决胜票：${Object.entries(decisionBallots).map(([voter, target]) => `${voter}→${target}`).join('、')}` : '';
    return `<div class="vote-team"><h4>${teamName(team)} <span class="vote-meta">最终排出：${finalTarget}${decisionText}</span></h4><div class="vote-list">${members(team).map(p => `<div class="vote-btn"><span>${p.id}</span><span class="vote-meta">${total[p.id] || 0} 票</span></div>`).join('')}</div></div>`;
  }).join('')}</div></div>`;
}
function totals(team, source) { const value = {}; Object.values(source[team]).forEach(id => value[id] = (value[id] || 0) + 1); return value; }
function winners(team, source) { const votes = totals(team, source), max = Math.max(...Object.values(votes)); return Object.keys(votes).filter(id => votes[id] === max); }
function completeVote(selected) {
  state.lastVoteDisplay = {
    votes: JSON.parse(JSON.stringify(state.votes)),
    tieVotes: JSON.parse(JSON.stringify(state.tieVotes)),
    selected: { ...selected }
  };
  const results = {};
  ['ember', 'tide'].forEach(team => {
    const target = selected[team];
    const voters = activeMembers(team);
    const remainingImpostors = state.impostors[team].filter(id => !state.votedOut[team].includes(id));
    const targetIsImpostor = remainingImpostors.includes(target);
    results[team] = { target, correct: targetIsImpostor };
    state.votedOut[team].push(target);
    voters.forEach(p => {
      const personalPick = state.resultVotes[team][p.id];
      const correct = remainingImpostors.includes(personalPick);
      state.notices[p.id] = {
        correct,
        text: correct ? '恭喜你抓到了区！' : '连条区都找不出来，我看你也是条究极肥区！'
      };
    });
  });
  state.voteHistory.push({ number: state.voteHistory.length + 1, results }); state.phase = 'active';
  state.votes = { ember: {}, tide: {} }; state.tieVotes = { ember: {}, tide: {} }; state.tieBreakers = {}; state.tieVoters = {}; state.teamSelections = {}; save(); toast('结算反馈已私密推送至所有玩家'); render();
}
function selectTieVoters(team, candidates, source) {
  const eligible = activeMembers(team);
  const remaining = eligible.filter(p => !candidates.includes(source?.[p.id])).map(p => p.id);
  return remaining.length ? remaining : eligible.map(p => p.id);
}
function finishTieVoteIfReady() {
  const teams = ['ember', 'tide'];
  let progressed = false;
  teams.forEach(team => {
    if (!state.tieBreakers[team] || state.teamSelections[team]) return;
    const voters = state.tieVoters[team] || [];
    if (!voters.length || !voters.every(id => state.tieVotes[team][id])) return;
    const top = winners(team, state.tieVotes);
    if (top.length === 1) {
      state.teamSelections[team] = top[0];
      delete state.tieBreakers[team]; delete state.tieVoters[team];
    } else {
      state.tieBreakers[team] = top;
      state.tieVoters[team] = selectTieVoters(team, top, state.tieVotes[team]);
      state.tieVotes[team] = {};
    }
    progressed = true;
  });
  if (teams.every(team => state.teamSelections[team])) { completeVote(state.teamSelections); return true; }
  if (progressed) { save(); render(); }
  return progressed;
}
$('#identityForm').addEventListener('submit', e => {
  e.preventDefault(); const id = $('#playerId').value.trim().toUpperCase();
  if (!id) return toast('请输入召唤师代号');
  if (id === 'ADMIN') {
    currentId = '';
    sessionStorage.removeItem('darkline-current');
    $('#adminModal').classList.remove('hidden');
    renderAdmin();
    return;
  }
  if (state.players.some(p => p.id === id)) return toast('该 ID 已被占用，请更换一个名称');
  if (state.phase !== 'lobby') return toast('本局已开始，请等待管理员开启下一局后再加入');
  state.players.push({ id, team: 'staging' }); currentId = id; sessionStorage.setItem('darkline-current', id); save(); render();
});
document.addEventListener('click', e => {
  const join = e.target.closest('[data-join]'), vote = e.target.closest('[data-player-vote]'), tieVote = e.target.closest('[data-tie-vote]');
  if (join) joinTeam(join.dataset.join);
  if (vote) {
    const me = player();
    if (!me || state.votedOut[me.team]?.includes(me.id)) return;
    state.votes[me.team][me.id] = vote.dataset.playerVote;
    state.resultVotes[me.team][me.id] = vote.dataset.playerVote;
    save(); toast('投票已提交'); render();
  }
  if (tieVote) {
    const me = player();
    if (!state.tieBreakers[me.team] || !(state.tieVoters[me.team] || []).includes(me.id)) return;
    state.tieVotes[me.team][me.id] = tieVote.dataset.tieVote;
    state.resultVotes[me.team][me.id] = tieVote.dataset.tieVote;
    save();
    if (!finishTieVoteIfReady()) { toast('决胜票已提交，等待另一队完成投票'); render(); }
  }
});
$('#adminEntry').onclick = () => {
  const me = player(), admin = administrator();
  if (!me || !admin || me.id !== admin.id) return toast('只有最先加入 912 的玩家可以打开控制台');
  $('#adminModal').classList.remove('hidden'); renderAdmin();
};
$('#closeAdmin').onclick = () => $('#adminModal').classList.add('hidden');
$('#adminModal').onclick = e => { if (e.target === $('#adminModal')) $('#adminModal').classList.add('hidden'); };
$('#adminContent').addEventListener('click', e => {
  const kick = e.target.closest('[data-kick]');
  if (kick) { removePlayer(kick.dataset.kick); toast(`${kick.dataset.kick} 已被踢出对局`); render(); return; }
  if (e.target.id === 'newMatchBtn') { startNewMatch(); toast('新的对局已创建，请调整或确认队伍分配'); render(); return; }
  if (e.target.id === 'generateBtn') {
    const n = +$('#impostorCount').value; if (n < 1 || n > 5) return toast('每队内鬼人数为 1 至 5');
    state.round++; state.impostorCount = n; state.revealed = false; state.impostors = { ember: [...members('ember')].sort(() => Math.random() - .5).slice(0, n).map(p => p.id), tide: [...members('tide')].sort(() => Math.random() - .5).slice(0, n).map(p => p.id) };
    state.phase = 'active'; state.votedOut = { ember: [], tide: [] }; state.voteHistory = []; state.notices = {}; save(); toast('双方内鬼已生成并私密通知'); render();
  }
  if (e.target.id === 'startVoteBtn') { state.phase = 'voting'; state.votes = { ember: {}, tide: {} }; state.tieVotes = { ember: {}, tide: {} }; state.resultVotes = { ember: {}, tide: {} }; state.tieBreakers = {}; state.tieVoters = {}; state.teamSelections = {}; state.notices = {}; save(); render(); }
  if (e.target.id === 'revealBtn') { state.revealed = !state.revealed; save(); render(); }
  if (e.target.id === 'settleVoteBtn') {
    const teams = ['ember', 'tide'];
    if (Object.keys(state.tieBreakers).length) {
      if (!finishTieVoteIfReady()) return toast('请等待各队完成各自的决胜票');
      return;
    }
    if (teams.some(t => Object.keys(state.votes[t]).length < activeMembers(t).length)) return toast('请等待两队所有未排出玩家完成投票');
    const tied = {}, selected = {}; teams.forEach(t => { const top = winners(t, state.votes); top.length === 1 ? selected[t] = top[0] : tied[t] = top; });
    if (Object.keys(tied).length) {
      state.tieBreakers = tied; state.tieVotes = { ember: {}, tide: {} };
      state.tieVoters = {}; state.teamSelections = selected;
      Object.entries(tied).forEach(([team, candidates]) => {
        state.tieVoters[team] = selectTieVoters(team, candidates, state.votes[team]);
      });
      save(); toast('出现平票，已向对应队伍的指定玩家发送决胜投票'); render(); return;
    }
    completeVote(selected);
  }
  if (e.target.id === 'nextRoundBtn') { startNewMatch(); toast('本局已结束，请调整或确认队伍分配'); render(); }
});
window.addEventListener('storage', e => { if (e.key === 'darkline-state' && e.newValue) { state = JSON.parse(e.newValue); render(); } });
window.addEventListener('pagehide', e => { if (!e.persisted && currentId && player()) removePlayer(currentId); });
render();
