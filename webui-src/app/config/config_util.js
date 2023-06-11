const m = require('mithril');

/* Visibility parameter for discovery */
const RS_VS_DISC_OFF = 0x0000;
const RS_VS_DISC_MINIMAL = 0x0001;
const RS_VS_DISC_FULL = 0x0002;

const RS_VS_DHT_OFF = 0x0000;
const RS_VS_DHT_PASSIVE = 0x0001;
const RS_VS_DHT_FULL = 0x0002;

const MAX_TAG_ID_VAL = 1000000;
const MIN_TAG_ID_VAL = 100;

// Distant Messaging Permission Flags to define who we accept to talk to.
// Each flag *removes* some people.
const RS_DISTANT_MESSAGING_PERMISSION_FLAG_FILTER_NONE = 0;
const RS_DISTANT_MESSAGING_PERMISSION_FLAG_FILTER_NON_CONTACTS = 1;
const RS_DISTANT_MESSAGING_PERMISSION_FLAG_FILTER_EVERYBODY = 2;

// Hidden Service Configuration Type
const RS_HIDDEN_TYPE_NONE = 0;
const RS_HIDDEN_TYPE_UNKNOWN = 1;
const RS_HIDDEN_TYPE_TOR = 2;
const RS_HIDDEN_TYPE_I2P = 4;

/* NAT Net Mode */
const RS_NETMODE_UDP = 1;
const RS_NETMODE_UPNP = 2;
const RS_NETMODE_EXT = 3;

function getRandomId(tagArr) {
  const random = Math.floor(Math.random() * (MAX_TAG_ID_VAL - MIN_TAG_ID_VAL) + MIN_TAG_ID_VAL);
  tagArr.forEach((tag) => {
    if (tag.key === random) {
      return getRandomId(tagArr);
    }
  });
  return random;
}

function tooltip(text) {
  return m('.tooltip', [m('i.fas.fa-info-circle'), m('.tooltiptext', text)]);
}

module.exports = {
  getRandomId,
  tooltip,
  RS_VS_DHT_FULL,
  RS_VS_DHT_OFF,
  RS_VS_DISC_FULL,
  RS_VS_DHT_PASSIVE,
  RS_VS_DISC_OFF,
  RS_VS_DISC_MINIMAL,
  RS_DISTANT_MESSAGING_PERMISSION_FLAG_FILTER_NONE,
  RS_DISTANT_MESSAGING_PERMISSION_FLAG_FILTER_NON_CONTACTS,
  RS_DISTANT_MESSAGING_PERMISSION_FLAG_FILTER_EVERYBODY,
  RS_HIDDEN_TYPE_NONE,
  RS_HIDDEN_TYPE_UNKNOWN,
  RS_HIDDEN_TYPE_TOR,
  RS_HIDDEN_TYPE_I2P,
  RS_NETMODE_UDP,
  RS_NETMODE_UPNP,
  RS_NETMODE_EXT,
};
