const m = require('mithril');
const rs = require('rswebui');
const util = require('config/config_util');

const SharedDirectories = () => {
  let directories = [];
  return {
    oninit: () => {
      rs.rsJsonApiRequest('/rsFiles/getSharedDirectories', {}, (data) => (directories = data.dirs));
    },
    view: () =>
      m('.widget', [
        m('h3', 'Shared Directories'),
        m('hr'),
        directories.map((dir) =>
          m('input[type=text].stretched', {
            value: dir.filename,
          })
        ),
      ]),
  };
};

const DownloadDirectory = () => {
  let dlDir = '';
  const setDir = () => {
    rs.rsJsonApiRequest('rsFiles/setDownloadDirectory', {
      path: dlDir,
    });
  };
  return {
    oninit: () => {
      rs.rsJsonApiRequest('/rsFiles/getDownloadDirectory', {}, (data) => (dlDir = data.retval));
    },
    view: () =>
      m('.widget', [
        m('h3', 'Downloads Directory'),
        m('hr'),
        m('input[type=text].stretched#dl-dir-input', {
          oninput: (e) => (dlDir = e.target.value),
          value: dlDir,
          onchange: setDir,
        }),
      ]),
  };
};

const PartialsDirectory = () => {
  let partialsDir = '';
  const setDir = () => {
    // const path = document.getElementById('partial-dir-input').value; // unused?

    rs.rsJsonApiRequest('rsFiles/setPartialsDirectory', {
      path: partialsDir,
    });
  };
  return {
    oninit: () =>
      rs.rsJsonApiRequest(
        '/rsFiles/getPartialsDirectory',
        {},
        (data) => (partialsDir = data.retval)
      ),
    view: () =>
      m('.widget.widget-halfwidth', [
        m('h3', 'Partials Directory'),
        m('hr'),
        m('input[type=text].stretched#partial-dir-input', {
          oninput: (e) => (partialsDir = e.target.value),
          value: partialsDir,
          onchange: setDir,
        }),
      ]),
  };
};

const TransferOptions = () => {
  let queueSize = undefined;
  let maxUploadSlots = undefined;
  let strategy = undefined;
  let diskLimit = undefined;
  let encryptionPolicy = undefined;
  let directDLPerm = undefined;
  const setMaxSimultaneousDownloads = () =>
    rs.rsJsonApiRequest('/rsFiles/setQueueSize', {
      s: parseInt(queueSize),
    });
  const setMaxUploadSlots = () =>
    rs.rsJsonApiRequest('/rsFiles/setMaxUploadSlotsPerFriend', {
      n: parseInt(maxUploadSlots),
    });
  const setChunkStrat = () =>
    rs.rsJsonApiRequest('/rsFiles/setDefaultChunkStrategy', {
      strategy: parseInt(strategy),
    });
  const setFreeLimit = () =>
    rs.rsJsonApiRequest('/rsFiles/setFreeDiskSpaceLimit', {
      minimumFreeMB: parseInt(diskLimit),
    });
  const setDefaultEncryption = () => {
    rs.rsJsonApiRequest('/rsFiles/setDefaultEncryptionPolicy', {
      policy: parseInt(encryptionPolicy),
    });
  };
  const setDirectDLPerm = () => {
    rs.rsJsonApiRequest('/rsFiles/setFilePermDirectDL', {
      perm: parseInt(directDLPerm),
    });
  };
  return {
    oninit: () => {
      rs.rsJsonApiRequest('/rsFiles/getQueueSize').then((res) => (queueSize = res.body.retval));
      rs.rsJsonApiRequest('/rsFiles/defaultChunkStrategy', {}, (data) => (strategy = data.retval));
      rs.rsJsonApiRequest('/rsFiles/getMaxUploadSlotsPerFriend').then(
        (res) => (maxUploadSlots = res.body.retval)
      );
      rs.rsJsonApiRequest('/rsFiles/freeDiskSpaceLimit', {}, (data) => (diskLimit = data.retval));
      rs.rsJsonApiRequest('/rsFiles/defaultEncryptionPolicy').then(
        (res) => (encryptionPolicy = res.body.retval)
      );
      rs.rsJsonApiRequest('/rsFiles/filePermDirectDL').then(
        (res) => (directDLPerm = res.body.retval)
      );
    },
    view: () =>
      m('.widget.widget-half', [
        m('h3', 'Transfer options'),
        m('hr'),
        m('.grid-2col', [
          m('p', 'Maximum simultaneous downloads:'),
          m('input[type=number]', {
            value: queueSize,
            oninput: (e) => (queueSize = e.target.value),
            onchange: setMaxSimultaneousDownloads,
          }),
          m('p', 'Default chunk strategy:'),
          m(
            'select[name=strategy]',
            {
              value: strategy,
              oninput: (e) => (strategy = e.target.value),
              onchange: setChunkStrat,
            },
            ['Streaming', 'Random', 'Progressive'].map((val, i) =>
              m('option[value=' + i + ']', val)
            )
          ),
          m('p', 'Maximum uploads per friend:'),
          m('input[type=number]', {
            value: maxUploadSlots,
            oninput: (e) => (maxUploadSlots = e.target.value),
            onchange: setMaxUploadSlots,
          }),
          m('p', 'Safety disk space limit(MB):'),
          m('input[type=number]', {
            value: diskLimit,
            oninput: (e) => (diskLimit = e.target.value),
            onchange: setFreeLimit,
          }),
          m('p', 'End-to-end encryption:'),
          m(
            'select',
            {
              value: encryptionPolicy,
              oninput: (e) => (encryptionPolicy = e.target.value),
              onchange: setDefaultEncryption,
            },
            [
              m(
                'option',
                {
                  value: util.RS_FILE_CTRL_ENCRYPTION_POLICY_STRICT,
                },
                'Enforced'
              ),
              m(
                'option',
                {
                  value: util.RS_FILE_CTRL_ENCRYPTION_POLICY_PERMISSIVE,
                },
                'Accepted'
              ),
            ]
          ),
          m('p', 'Allow Direct Download:'),
          m(
            'select',
            {
              value: directDLPerm,
              oninput: (e) => (directDLPerm = e.target.value),
              onchange: setDirectDLPerm,
            },
            [
              m(
                'option',
                {
                  value: util.RS_FILE_PERM_DIRECT_DL_YES,
                },
                'Yes'
              ),
              m(
                'option',
                {
                  value: util.RS_FILE_PERM_DIRECT_DL_NO,
                },
                'No'
              ),
              m(
                'option',
                {
                  value: util.RS_FILE_PERM_DIRECT_DL_PER_USER,
                },
                'Per User'
              ),
            ]
          ),
        ]),
      ]),
  };
};

const Layout = () => {
  return {
    view: () => [
      m(SharedDirectories),
      m(DownloadDirectory),
      m(PartialsDirectory),
      m(TransferOptions),
    ],
  };
};

module.exports = Layout;
