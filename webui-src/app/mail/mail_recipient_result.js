const m = require('mithril');
const peopleUtil = require('people/people_util');

//  A hidden autocomplete list can hold the entire address book, and
//  IdentityAvatar fetches details per identity. Rows start on the cheap
//  UserAvatar and only upgrade once they are actually on screen.
module.exports = () => {
  let visible = false;
  let observer;
  return {
    oncreate: (vnode) => {
      if (typeof IntersectionObserver === 'undefined') return;
      observer = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        visible = true;
        observer.disconnect();
        m.redraw();
      });
      observer.observe(vnode.dom);
    },
    onremove: () => { if (observer) observer.disconnect(); },
    view: ({ attrs: { item } }) => m('.mail-recipient-result', [
      m(visible ? peopleUtil.IdentityAvatar : peopleUtil.UserAvatar, {
        identityId: item.mGroupId,
        name: item.mGroupName,
        avatar: item.mAvatar,
        firstLetter: item.mGroupName,
        size: 32,
      }),
      m('.mail-recipient-result__details', [
        m('span.mail-recipient-result__name', item.mGroupName || 'Unknown identity'),
        m('span.mail-recipient-result__id', item.mGroupId),
      ]),
    ]),
  };
};
