const m = require('mithril');
const rs = require('rswebui');

const util = require('config/config_util'); // for future use

/* eslint-disable no-unused-vars */

const networkModes = [
  'Public: DHT & Discovery',
  'Private: Discovery only',
  'Inverted: DHT only',
  'Dark Net: None',
];

const SetNwMode = () => {
  let vs_disc = 0;
  let vs_dht = 0;
  let selectedMode;
  let sslId;
  let details;

  return {
    oninit: async () => {
      const res = await rs.rsJsonApiRequest('/rsaccounts/getCurrentAccountId');
      if (res.body.retval) {
        sslId = res.body.id;
      }
      if (sslId) {
        const res2 = await rs.rsJsonApiRequest('/rsPeers/getPeerDetails', {
          sslId: sslId,
        });
        if (res2.body.retval) {
          details = res2.body.det;
        }
      }
      if (details) {
        if (details.vs_dht === util.RS_VS_DHT_FULL && details.vs_disc === util.RS_VS_DISC_FULL) {
          selectedMode = networkModes[0];
        } else if (
          details.vs_dht === util.RS_VS_DHT_OFF &&
          details.vs_disc === util.RS_VS_DISC_FULL
        ) {
          selectedMode = networkModes[1];
        } else if (
          details.vs_dht === util.RS_VS_DHT_FULL &&
          details.vs_disc === util.RS_VS_DISC_OFF
        ) {
          selectedMode = networkModes[2];
        } else if (
          details.vs_dht === util.RS_VS_DHT_OFF &&
          details.vs_disc === util.RS_VS_DISC_OFF
        ) {
          selectedMode = networkModes[3];
        }
      }
    },
    view: (vnode) => [
      m('p', 'Network mode:'),
      m(
        'select',
        {
          value: selectedMode,
          onchange: async (e) => {
            selectedMode = networkModes[e.target.selectedIndex];
            if (e.target.selectedIndex === 0) {
              vs_disc = util.RS_VS_DISC_FULL;
              vs_dht = util.RS_VS_DHT_FULL;
              // Public: DHT & Discovery
            } else if (e.target.selectedIndex === 1) {
              vs_disc = util.RS_VS_DISC_FULL;
              vs_dht = util.RS_VS_DHT_OFF;
              // Private: Discovery only
            } else if (e.target.selectedIndex === 2) {
              vs_disc = util.RS_VS_DISC_OFF;
              vs_dht = util.RS_VS_DHT_FULL;
              // Inverted: DHT only
            } else if (e.target.selectedIndex === 3) {
              vs_disc = util.RS_VS_DISC_OFF;
              vs_dht = util.RS_VS_DHT_OFF;
              // Dark Net: None
            }
            if (sslId) {
              const res2 = await rs.rsJsonApiRequest('/rsPeers/getPeerDetails', {
                sslId: sslId,
              });
              if (res2.body.retval) {
                details = res2.body.det;
              }
            }
            if (
              details &&
              (vs_dht != details.vs_dht || vs_disc != details.vs_disc) &&
              sslId !== undefined
            ) {
              const res = await rs.rsJsonApiRequest('/rsPeers/setVisState', {
                sslId: sslId,
                vsDisc: vs_disc,
                vsDht: vs_dht,
              });
            }
          },
        },
        [networkModes.map((o) => m('option', { value: o }, o))]
      ),
    ],
  };
};

const NATmodes = ['Automatic (UPnP)', 'FireWalled', 'Manually Forwarded Port'];
const SetNAT = () => {
  let sslId;
  let selectedMode = NATmodes[0];

  return {
    oninit: async () => {
      const res = await rs.rsJsonApiRequest('/rsIdentity/GetOwnSignedIds');
      if (res.body.retval) {
        sslId = res.body.ids[0];
      }
    },
    view: () => [
      m('p', 'NAT:'),
      m(
        'select',
        {
          value: selectedMode,
          onchange: (e) => {
            selectedMode = NATmodes[e.target.selectedIndex];
            // console.log(selectedMode, e.target.selectedIndex);
            if (e.target.selectedIndex === 0) {
              // Automatic (UPnP)
            } else if (e.target.selectedIndex === 1) {
              // FireWalled
            } else if (e.target.selectedIndex === 2) {
              // Manually Forwarded Port
            }
          },
        },
        [NATmodes.map((o) => m('option', { value: o }, o))]
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

const displayLocalIPAddress = () => {
  return {
    view: (v) => v.attrs.details && [m('p', 'Local Address: '), m('p', v.attrs.details.localAddr)],
  };
};
const displayExternalIPAddress = () => {
  return {
    view: (v) => v.attrs.details && [m('p', 'External Address: '), m('p', v.attrs.details.extAddr)],
  };
};

const displayIPAddresses = () => {
  return {
    view: (v) =>
      v.attrs.details && [
        m('p', 'External Address: '),
        m(
          'ul',
          {
            style: { height: '200px', overflow: 'hidden', overflowY: 'scroll' },
          },
          v.attrs.details.ipAddressList.map((ip) => m('li', ip))
        ),
      ],
  };
};

const Component = () => {
  let sslId;
  let details;
  return {
    oninit: async () => {
      const res = await rs.rsJsonApiRequest('/rsaccounts/getCurrentAccountId');
      if (res.body.retval) {
        sslId = res.body.id;
      }
      if (sslId) {
        const res2 = await rs.rsJsonApiRequest('/rsPeers/getPeerDetails', {
          sslId: sslId,
        });
        if (res2.body.retval) {
          details = res2.body.det;
        }
      }
    },
    view: () =>
      m('.widget.widget-half', [
        m('h3', 'Network Configuration'),
        m('hr'),

        m('.grid-2col', [
          m(SetNwMode),
          m(SetNAT),
          m(displayLocalIPAddress, { details }),
          m(displayExternalIPAddress, { details }),
          m(SetLimits),
          m(SetOpMode),
          m(displayIPAddresses, { details }),
        ]),
      ]),
  };
};

module.exports = Component;
