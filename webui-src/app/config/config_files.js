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
      m('.panel__body-box', [
        m('.panel__head', m('h3', 'Shared Directories')),
        directories.length
          ? directories.map((dir) =>
            m('input[type=text].stretched', {
              value: dir.filename,
              readonly: true,
            })
          )
          : m('p.cfg-note', 'No directories shared yet. Add them from Files → My Files.'),
      ]),
  };
};

//  Where finished and in-progress downloads live. Two paths, so two rows in
//  the same label column as every other setting -- a heading over a single
//  text field announced a section that was not there.
const DownloadLocations = () => {
  let dlDir = '';
  let partialsDir = '';
  const setDownloadDir = () =>
    rs.rsJsonApiRequest('/rsFiles/setDownloadDirectory', { path: dlDir });
  const setPartialsDir = () =>
    rs.rsJsonApiRequest('/rsFiles/setPartialsDirectory', { path: partialsDir });
  return {
    oninit: () => {
      rs.rsJsonApiRequest('/rsFiles/getDownloadDirectory', {}, (data) => (dlDir = data.retval));
      rs.rsJsonApiRequest(
        '/rsFiles/getPartialsDirectory',
        {},
        (data) => (partialsDir = data.retval)
      );
    },
    view: () =>
      m('.panel__body-box', [
        m('.panel__head', m('h3', 'Download Locations')),
        m('.grid-2col', [
          m('p', 'Downloads directory:'),
          m('input[type=text].cfg-path#dl-dir-input', {
            oninput: (e) => (dlDir = e.target.value),
            value: dlDir,
            onchange: setDownloadDir,
          }),
          m('p', 'Partials directory:'),
          m('input[type=text].cfg-path#partial-dir-input', {
            oninput: (e) => (partialsDir = e.target.value),
            value: partialsDir,
            onchange: setPartialsDir,
          }),
        ]),
      ]),
  };
};

const TransferOptions = () => {
  let queueSize = undefined;
  let maxUploadSlots = undefined;
  let strategy = undefined;
  let diskLimit = undefined;
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
      rs.rsJsonApiRequest('/rsFiles/filePermDirectDL').then(
        (res) => (directDLPerm = res.body.retval)
      );
    },
    view: () =>
      m('.panel__body-box', [
        m('.panel__head', m('h3', 'Transfer options')),
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
    view: () =>
      m('.panel', [
        m('.panel__head', m('h3', 'Files Configuration')),
        m('.panel__body.config-files', [
          m(SharedDirectories),
          m(DownloadLocations),
          m(TransferOptions),
        ]),
      ]),
  };
};

module.exports = Layout;
