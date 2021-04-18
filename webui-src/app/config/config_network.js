const m = require('mithril');
const rs = require('rswebui');

const util = require('config/config_util'); // for future use

/* eslint-disable no-unused-vars */ const SetNwMode = () => {
  let mode = undefined;
  let sslId = undefined;
  const setMode = () => rs.rsJsonApiRequest('/');
  return {
    oninit: util.getSslId().then((val) => {
      sslId = val;
      rs.rsJsonApiRequest('/');
    }),
    view: () => [
      m('p', 'Network mode:'),
      m(
        'select',
        {
          oninput: (e) => (mode = e.target.value),
          value: mode,
          onchange: setMode,
        },
        ['Discovery on(recommended)', 'Discovery off'].map((val, i) =>
          m('option[value=' + (i + 1) + ']', val)
        )
      ),
    ],
  };
};

const SetLimits = () => {
  let dlim = undefined;
  let ulim = undefined;
  const setMaxRates = () =>
    rs.rsJsonApiRequest('/rsConfig/SetMaxDataRates', {
      downKb: dlim,
      upKb: ulim,
    });
  return {
    oninit: () =>
      rs.rsJsonApiRequest('/rsConfig/GetMaxDataRates', {}, (data) => {
        dlim = data.inKb;
        ulim = data.outKb;
      }),
    view: () => [
      m(
        'p',
        util.tooltip(
          'The download limit covers the whole application. ' +
            'However, in some situations, such as when transfering ' +
            'many files at once, the estimated bandwidth becomes ' +
            'unreliable and the total value reported by Retroshare ' +
            'might exceed that limit.'
        ),
        'Download limit(KB/s):'
      ),
      m('input[type=number][name=download]', {
        value: dlim,
        oninput: (e) => (dlim = Number(e.target.value)),
        onchange: setMaxRates,
      }),
      m(
        'p',
        util.tooltip(
          'The upload limit covers the entire software. ' +
            'Too small an upload limit may eventually block ' +
            'low priority services(forums, channels). ' +
            'A minimum recommended value is 50KB/s.'
        ),
        'Upload limit(KB/s):'
      ),
      m('input[type=number][name=upload]', {
        value: ulim,
        oninput: (e) => (ulim = Number(e.target.value)),
        onchange: setMaxRates,
      }),
    ],
  };
};

const SetOpMode = () => {
  let opmode = undefined;
  const setmode = () =>
    rs.rsJsonApiRequest(
      '/rsconfig/SetOperatingMode',
      {
        opMode: Number(opmode),
      },
      () => {}
    );
  return {
    oninit: () =>
      rs.rsJsonApiRequest('/rsConfig/getOperatingMode', {}, (data) => (opmode = data.retval)),
    view: () => [
      m(
        'p',
        'Operating mode:',
        util.tooltip(
          `No Anon D/L: Switches off file forwarding\n
Gaming Mode: 25% standard traffic and TODO: Reduced popups\n
Low traffic: 10% standard traffic and TODO: pause all file transfers\n`
        )
      ),
      m(
        'select',
        {
          oninput: (e) => (opmode = e.target.value),
          value: opmode,
          onchange: setmode,
        },
        ['Normal', 'No Anon D/L', 'Gaming', 'Low traffic'].map((val, i) =>
          m('option[value=' + (i + 1) + ']', val)
        )
      ),
    ],
  };
};

const Component = () => {
  return {
    view: () =>
      m('.widget.widget-half', [
        m('h3', 'Network Configuration'),
        m('hr'),
        m('.grid-2col', [
          m(SetLimits),
          m(SetOpMode),
          // m(SetNwMode),
        ]),
      ]),
  };
};

module.exports = Component;
