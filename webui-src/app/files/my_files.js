const m = require('mithril');
const rs = require('rswebui');
const util = require('files/files_util');
const manager = require('files/files_manager');

const translateName = (name) => {
  const n = name.toLowerCase().trim();
  if (n === 'extra list' || n === '[extra list]') return 'Temporary shared files';
  // Match hex strings (IDs) or pure numeric strings
  if (/^[0-9a-fA-F]{16,}$/.test(name) || /^\d+$/.test(name)) return 'My Files';
  return name;
};

const DisplayFiles = () => {
  const childrenList = []; // stores children details
  let loaded = false; // checks whether we have loaded the children details or not.
  let parStruct; // stores current struct(details, showChild)
  return {
    oninit: (v) => {
      if (v.attrs.par_directory) {
        parStruct = v.attrs.par_directory;
      }
    },
    view: (v) => [
      m('tr', [
        parStruct && parStruct.details.children && parStruct.details.children.length
          ? m(
            'td',
            m('i.fas.fa-angle-right', {
              class: `fa-rotate-${parStruct.showChild ? '90' : '0'}`,
              style: 'margin-top: 0.5rem',
              onclick: async () => {
                if (!loaded) {
                  // if it is not already retrieved
                  const results = await Promise.all(
                    parStruct.details.children.map((child) =>
                      rs.rsJsonApiRequest('/rsfiles/requestDirDetails', {
                        handle: child.handle.xint64,
                        flags: util.RS_FILE_HINTS_LOCAL,
                      })
                    )
                  );
                  results.forEach((res) => {
                    if (res && res.body && res.body.details) {
                      childrenList.push(res.body.details);
                    }
                  });
                  loaded = true;
                }
                parStruct.showChild = !parStruct.showChild;
              },
            })
          )
          : m('td', ''),
        m(
          'td',
          {
            style: {
              position: 'relative',
              '--replyDepth': v.attrs.replyDepth,
              left: `calc(1.5rem*${v.attrs.replyDepth})`,
            },
          },
          [
            parStruct.details.children !== undefined
              ? m('i.fas', {
                  class: parStruct.showChild ? 'fa-folder-open' : 'fa-folder',
                  title: 'Folder',
                  style: 'margin-right: 0.45rem; color: #d69e2e;',
                })
              : null,
            translateName(parStruct.details.name || ''),
          ]
        ),
        m('td', rs.formatBytes((parStruct.details.size && parStruct.details.size.xint64) || 0)),
      ]),
      parStruct.showChild &&
      childrenList.map((child) =>
        m(DisplayFiles, {
          // recursive call
          par_directory: { details: child, showChild: false },
          replyDepth: v.attrs.replyDepth + 1,
        })
      ),
    ],
  };
};

const Layout = () => {
  let displayList = [];
  let isLoading = true;
  let showShareManager = false; // Retain original declaration

  return {
    oninit: () => {
      rs.rsJsonApiRequest('/rsfiles/requestDirDetails', {}).then(async (res) => {
        if (res && res.body && res.body.details) {
          if (res.body.details.name === 'root') {
            // Skip root and fetch full details for each child (Location ID, Extra list, etc)
            const results = await Promise.all(
              res.body.details.children.map((child) =>
                rs.rsJsonApiRequest('/rsfiles/requestDirDetails', {
                  handle: child.handle.xint64,
                  flags: util.RS_FILE_HINTS_LOCAL,
                })
              )
            );
            displayList = results.map((r) => r.body.details);
          } else {
            displayList = [res.body.details];
          }
        }
        isLoading = false;
        m.redraw();
      });
    },
    view: () => [
      m('.widget__heading', [
        m('h3', 'My Files'),
        m(
          'button.my-files__configure-shares',
          {
            onclick: () => (showShareManager = true),
            title: 'Configure shared directories',
            'aria-label': 'Configure shared directories',
          },
          [m('i.fas.fa-folder-plus'), m('span', 'Configure shared directories')]
        ),
      ]),
      m('.widget__body', [
        m(
          util.MyFilesTable,
          m(
            'tbody',
            isLoading
              ? m('tr', m('td[colspan=3]', 'Loading...'))
              : displayList.map((details) =>
                m(DisplayFiles, {
                  par_directory: { details, showChild: false },
                  replyDepth: 0,
                })
              )
          )
        ),
        m(
          '.shareManagerPopupOverlay#shareManagerPopup',
          { style: { display: showShareManager ? 'block' : 'none' } },
          m(
            '.shareManagerPopup',
            m(manager),
            m(
              'button.red.close-btn',
              { onclick: () => (showShareManager = false) },
              m('i.fas.fa-times')
            )
          )
        ),
      ]),
    ],
  };
};

module.exports = Layout;
