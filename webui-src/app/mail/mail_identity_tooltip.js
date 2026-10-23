const m = require('mithril');
const rs = require('rswebui');
const peopleUtil = require('people/people_util');

function renderIdentityTooltip({ details, gxsId, name, rect, overlapAnchor = false, belowAnchor = false }) {
  if (!details || !rect) return null;

  const avatar = details.mAvatar && details.mAvatar.base64 ? details.mAvatar.base64 : details.mAvatar;
  const votes = details.mReputation
    ? (details.mReputation.mFriendsPositiveVotes || 0) -
      (details.mReputation.mFriendsNegativeVotes || 0)
    : 0;
  const identityName = [details.mNickname, details.mGroupName]
    .find((value) => value && value !== gxsId) || '';
  const nodeId = details.mPgpId;
  const nodeName = nodeId ? rs.userList.username(nodeId) : '';
  const node = nodeName && nodeName !== nodeId ? `${nodeName} [${nodeId}]` : nodeId;
  const gap = 10;
  let left = overlapAnchor ? rect.left + 90 : rect.right + gap;
  let top = overlapAnchor ? rect.top - 10 : rect.top;

  const positionTooltip = ({ dom }) => {
    const bounds = dom.getBoundingClientRect();
    const preferredX = belowAnchor ? rect.left : overlapAnchor ? rect.left + 90 : rect.right + gap;
    const fallbackX = rect.left - bounds.width - gap;
    const x = Math.max(gap, Math.min(
      preferredX + bounds.width <= window.innerWidth - gap ? preferredX : fallbackX,
      window.innerWidth - bounds.width - gap
    ));
    const preferredY = belowAnchor ? rect.bottom + 6 : overlapAnchor ? rect.top - 10 : rect.top;
    const y = Math.max(gap, Math.min(preferredY, window.innerHeight - bounds.height - gap));
    dom.style.left = `${x}px`;
    dom.style.top = `${y}px`;
  };
  if (belowAnchor) {
    left = rect.left;
    top = rect.bottom + 6;
  }

  return m('.user-tooltip', {
    oncreate: positionTooltip,
    onupdate: positionTooltip,
    style: { top: `${top}px`, left: `${left}px` },
  }, [
    m('.tooltip-head', [
      m('.tooltip-avatar', m(peopleUtil.UserAvatar, {
        avatar,
        firstLetter: name,
        identityId: gxsId,
        size: 48,
        isSquare: true,
      })),
      identityName && m('.tooltip-name', identityName),
    ]),
    m('.tooltip-details', [
      m('.tooltip-row', [
        m('span.tooltip-label', 'Votes:'),
        m('span.tooltip-value', {
          class: votes >= 0 ? 'is-positive' : 'is-negative',
        }, `${votes >= 0 ? '+' : ''}${votes}`),
      ]),
      m('.tooltip-row', [m('span.tooltip-label', 'Identity Id:'), m('span.tooltip-value.tooltip-id', gxsId)]),
      nodeId && nodeId !== '0000000000000000' && m('.tooltip-row', [
        m('span.tooltip-label', 'Node:'),
        m('span.tooltip-value', node),
      ]),
    ]),
  ]);
}

module.exports = renderIdentityTooltip;
