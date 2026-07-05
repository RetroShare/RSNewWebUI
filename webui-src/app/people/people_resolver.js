const m = require('mithril');
const PeopleLayout = require('people/people');

module.exports = {
  view: (vnode) => {
    const tab = vnode.attrs.tab || 'All';
    return m(PeopleLayout, { tab });
  },
};
