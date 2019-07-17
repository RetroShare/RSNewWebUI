let m = require('mithril');
let rs = require('rswebui');

function tooltip(text) {
  return m('.tooltip', [
    m('i.fas.fa-info-circle'),
    m('.tooltiptext', text)
  ]);
};

function setMaxRates() {
  let download = document.getElementById('download-limit')
    .value;
  let upload = document.getElementById('upload-limit')
    .value;
  if(isNaN(download) || isNaN(upload)) {
    // TODO display error on setting non-numeric value
    return;
  }
  rs.rsJsonApiRequest('/rsConfig/SetMaxDataRates', {
      downKb: Number(download),
      upKb: Number(upload),
    },
    //TODO display success animation(fontawesome)
    () => {},
  );
};

let Network = {
  oninit: function() {
    rs.rsJsonApiRequest('/rsConfig/GetMaxDataRates', {}, function(
      data) {
      document.getElementById('download-limit')
        .value = data.inKb;
      document.getElementById('upload-limit')
        .value = data.outKb;
    });
  },
  view: function() {
    return [
      m('.widget.widget-half', [
        m('h3', 'Network Configuration'),
        m('hr'),
        m('.grid-2col', [
          m('p', tooltip(
            'The download limit covers the whole application. However, in some situations, such as when transfering many files at once, the estimated bandwidth becomes unreliable and the total value reported by Retroshare might exceed that limit.'
          ), 'Download limit(KB/s):'),
          m(
            'input#download-limit[type=number][name=download]', {
              onblur: setMaxRates,
            }),
          m('p', tooltip(
            'The upload limit covers the entire software. Too small an upload limit may eventually block low priority services(forums, channels). A minimum recommended value is 50KB/s.'
          ), 'Upload limit(KB/s):'),
          m('input#upload-limit[type=number][name=upload]', {
            onblur: setMaxRates,
          }),
        ]),
      ]),
    ];
  },
};

module.exports = Network;
