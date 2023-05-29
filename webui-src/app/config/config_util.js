const m = require('mithril');
const rs = require('rswebui');

/* Visibility parameter for discovery */
const RS_VS_DISC_OFF = 0x0000;
const RS_VS_DISC_MINIMAL = 0x0001;
const RS_VS_DISC_FULL = 0x0002;

const RS_VS_DHT_OFF = 0x0000;
const RS_VS_DHT_PASSIVE = 0x0001;
const RS_VS_DHT_FULL = 0x0002;

const MAX_TAG_ID_VAL = 1000000;
const MIN_TAG_ID_VAL = 100;

function getRandomId(tagArr) {
  const random = Math.floor(Math.random() * (MAX_TAG_ID_VAL - MIN_TAG_ID_VAL) + MIN_TAG_ID_VAL);
  tagArr.forEach((tag) => {
    if (tag.key === random) {
      return getRandomId();
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
};
