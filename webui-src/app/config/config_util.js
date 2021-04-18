const m = require('mithril');
const rs = require('rswebui');

function tooltip(text) {
  return m('.tooltip', [m('i.fas.fa-info-circle'), m('.tooltiptext', text)]);
}

async function getSslId() {
  let id = '';
  await rs.rsJsonApiRequest('/rsIdentity/GetOwnSignedIds', {}, (data) => (id = data.ids[0]));
  return id;
}

module.exports = {
  tooltip,
  getSslId,
};
