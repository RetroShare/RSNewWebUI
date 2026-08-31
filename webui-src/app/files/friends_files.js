const m = require('mithril');
const rs = require('rswebui');
const util = require('files/files_util');
const widget = require('widgets');
const fileDown = require('files/files_downloads');

function displayfiles() {
  const childrenList = []; // stores children details
  let loaded = false; // checks whether we have loaded the children details or not.
  let parStruct; // stores current struct(details, showChild)
  let isFile = false;
  let haveFile = false;
  let isId = false;
  let nameOfId;
  return {
    oninit: async (v) => {
      if (v.attrs.par_directory) {
        parStruct = v.attrs.par_directory;
        if (Number(parStruct.details.hash) !== 0) {
          isFile = true;
          const res = await rs.rsJsonApiRequest('/rsfiles/alreadyHaveFile', {
            // checks if the file is already there with the user
            hash: parStruct.details.hash,
          });
          haveFile = res.body.retval;
        }
      }
      if (v.attrs.replyDepth === 0 && parStruct) {
        isId = true;
        const res = await rs.rsJsonApiRequest('/rsPeers/getPeerDetails', {
          sslId: parStruct.details.name,
        });
        if (res.body.retval) {
          nameOfId = res.body.det.name;
        }
      }
    },
    view: (v) => [
      m('tr', [
        parStruct && parStruct.details.children && Object.keys(parStruct.details.children).length
          ? m(
              'td',
              m('i.fas.fa-angle-right', {
                class: 'fa-rotate-' + (parStruct.showChild ? '90' : '0'),
                style: 'margin-top:12px',
                onclick: async () => {
                  if (!loaded) {
                    // Retrieve the directory entries before displaying the nested rows.
                    const entries = await Promise.all(
                      parStruct.details.children.map(async (child) => {
                        const res = await rs.rsJsonApiRequest('/rsfiles/requestDirDetails', {
                          handle: child.handle.xint64,
                          flags: util.RS_FILE_HINTS_REMOTE,
                        });
                        return res.body.details;
                      })
                    );
                    childrenList.push(...entries);
                    loaded = true;
                  }
                  parStruct.showChild = !parStruct.showChild;
                  m.redraw();
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
              left: `calc(30px*${v.attrs.replyDepth})`,
            },
          },
          [
            m('i.fas', {
              class: isId
                ? 'fa-user-friends friends-files__friend-icon'
                : !isFile
                  ? parStruct.showChild
                    ? 'fa-folder-open friends-files__folder-icon'
                    : 'fa-folder friends-files__folder-icon'
                  : 'fa-file friends-files__file-icon',
              title: isId ? 'Friend' : isFile ? 'File' : 'Folder',
              style: 'margin-right:0.45rem',
            }),
            isId
              ? (nameOfId || parStruct.details.name) +
                ' (' +
                parStruct.details.name.slice(0, 8) +
                '...)'
              : parStruct.details.name,
          ]
        ),
        m('td', rs.formatBytes(parStruct.details.size.xint64)),
        isFile &&
          m(
            'td',
            // using the file from files_util to display download.
            fileDown.list[parStruct.details.hash]
              ? m(util.File, {
                  info: fileDown.list[parStruct.details.hash],
                  direction: 'down',
                  transferred: fileDown.list[parStruct.details.hash].transfered.xint64,
                  parts: [],
                })
              : m(
                  'button',
                  {
                    style: { fontSize: '0.9em' },
                    onclick: async () => {
                      widget.popupMessage([
                        m('p', 'Start Download?'),
                        m(
                          'button',
                          {
                            onclick: async () => {
                              if (!haveFile) {
                                const res = await rs.rsJsonApiRequest('/rsFiles/FileRequest', {
                                  fileName: parStruct.details.name,
                                  hash: parStruct.details.hash,
                                  flags: util.RS_FILE_REQ_ANONYMOUS_ROUTING,
                                  size: {
                                    xstr64: parStruct.details.size.xstr64,
                                  },
                                });
                                res.body.retval === false
                                  ? widget.popupMessage([
                                      m('h3', 'Error'),
                                      m('hr'),
                                      m('p', res.body.errorMessage),
                                    ])
                                  : widget.popupMessage([
                                      m('h3', 'Success'),
                                      m('hr'),
                                      m('p', 'Download Started'),
                                    ]);
                                m.redraw();
                              }
                            },
                          },
                          'Start Download'
                        ),
                      ]);
                    },
                  },

                  haveFile ? 'Open File' : ['Download', m('i.fas.fa-download')]
                )
          ),
      ]),
      parStruct.showChild && // recursive call to show children
        childrenList.map((child) =>
          m(displayfiles, {
            par_directory: { details: child, showChild: false },
            replyDepth: v.attrs.replyDepth + 1,
          })
        ),
    ],
  };
}

const Layout = () => {
  let directories = [];
  return {
    oninit: async () => {
      const res = await rs.rsJsonApiRequest('/rsfiles/requestDirDetails', {
        flags: util.RS_FILE_HINTS_REMOTE,
      });
      const root = res.body.details;

      // The remote API returns a synthetic "root" directory.  It is not a
      // friend and only adds an unnecessary level to this view, so begin at
      // its children instead.
      if (root && root.name === 'root' && root.children) {
        directories = await Promise.all(
          root.children.map(async (child) => {
            const childRes = await rs.rsJsonApiRequest('/rsfiles/requestDirDetails', {
              handle: child.handle.xint64,
              flags: util.RS_FILE_HINTS_REMOTE,
            });
            return childRes.body.details;
          })
        );
      } else if (root) {
        directories = [root];
      }
      m.redraw();
    },
    view: () => [
      m('.widget__heading', [m('h3', 'Friends Files')]),
      m('.widget__body', [
        m(
          util.FriendsFilesTable,
          m(
            'tbody',
            directories.map((directory) =>
              m(displayfiles, {
                par_directory: { details: directory, showChild: false },
                replyDepth: 0,
              })
            )
          )
        ),
      ]),
    ],
  };
};

module.exports = Layout;
