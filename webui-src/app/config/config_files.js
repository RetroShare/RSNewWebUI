const m = require('mithril');
const rs = require('rswebui');

const SharedDirectories = () => {
  let directories = [];
  return {
    dirs: [],
    oninit: () => {
      rs.rsJsonApiRequest('/rsFiles/getSharedDirectories', {}, (data) => (directories = data.dirs));
    },
    view: () =>
      m('.widget__body-box', [
        m('.widget__heading', m('h3', 'Shared Directories')),
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
    // const path = document.getElementById('dl-dir-input').value; // unused?

    rs.rsJsonApiRequest('rsFiles/setDownloadDirectory', {
      path: dlDir,
    });
  };
  return {
    oninit: () => {
      rs.rsJsonApiRequest('/rsFiles/getDownloadDirectory', {}, (data) => (dlDir = data.retval));
    },
    view: () =>
      m('.widget__body-box', [
        m('.widget__heading', m('h3', 'Downloads Directory')),
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
      m('.widget__body-box', [
        m('.widget__heading', m('h3', 'Partials Directory')),
        m('input[type=text].stretched#partial-dir-input', {
          oninput: (e) => (partialsDir = e.target.value),
          value: partialsDir,
          onchange: setDir,
        }),
      ]),
  };
};

const TransferOptions = () => {
  let strategy = undefined;
  let diskLimit = undefined;
  const setChunkStrat = () =>
    rs.rsJsonApiRequest('/rsFiles/setDefaultChunkStrategy', {
      strategy: Number(strategy),
    });
  const setFreeLimit = () =>
    rs.rsJsonApiRequest('/rsFiles/setFreeDiskSpaceLimit', {
      MinimumFreeMB: diskLimit,
    });
  return {
    oninit: () => {
      rs.rsJsonApiRequest('/rsFiles/defaultChunkStrategy', {}, (data) => (strategy = data.retval));
      rs.rsJsonApiRequest('/rsFiles/freeDiskSpaceLimit', {}, (data) => (diskLimit = data.retval));
    },
    view: () =>
      m('.widget__body-box', [
        m('.widget__heading', m('h3', 'Transfer options')),
        m('.grid-2col', [
          m('p', 'Default chunk strategy:'),
          m(
            'select[name=strategy]',
            {
              oninput: (e) => (strategy = e.target.value),
              value: strategy,
              onchange: setChunkStrat,
            },
            ['Streaming', 'Random', 'Progressive'].map((val, i) =>
              m('option[value=' + i + ']', val)
            )
          ),
          m('p', 'Safety disk space limit(MB):'),
          m('input[type=number].small', {
            oninput: (e) => (diskLimit = e.target.value),
            value: diskLimit,
            onchange: setFreeLimit,
          }),
        ]),
      ]),
  };
};

const Layout = () => {
  return {
    view: () =>
      m('.widget', [
        m('.widget__heading', m('h3', 'Files Configuration')),
        m('.widget__body.config-files', [
          m(SharedDirectories),
          m(DownloadDirectory),
          m(PartialsDirectory),
          m(TransferOptions),
        ]),
      ]),
  };
};

module.exports = Layout;
