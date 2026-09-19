const m = require('mithril');
const rs = require('rswebui');
const util = require('files/files_util');
const widget = require('widgets');
const fileDown = require('files/files_downloads');
const icon = require('icon');
const toast = require('toast');

//  The transfer figures as one line of text, for the info tooltip. The full
//  File card cannot live inside a table cell, but the numbers it shows can.
function transferSummary(info, transferred) {
  const total = info.size.xint64;
  return [
    `${rs.formatBytes(transferred)} of ${rs.formatBytes(total)}`,
    `${rs.formatBytes(info.tfRate * 1024)}/s`,
    `${info.peers.length} peer${info.peers.length === 1 ? '' : 's'}`,
  ].join('  ·  ');
}

function transferStatus(info) {
  const transferred = info.transfered.xint64;
  const total = Number(info.size.xint64) || 0;
  const pct = total ? Math.min(100, (transferred / total) * 100) : 0;
  return m('span.friends-files__progress', [
    m('span.friends-files__progress-pct', `${pct.toFixed(0)}%`),
    icon('info-circle', {
      class: 'friends-files__progress-info',
      title: transferSummary(info, transferred),
    }),
  ]);
}

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
        //  Twist, type icon and name in one cell, indented by padding: the
        //  chevron has to step right with the name, and the old
        //  `position: relative; left:` moved only the text.
        m(
          'td.file-tree__name',
          { style: { paddingLeft: `calc(var(--s2) + ${v.attrs.replyDepth} * 1.25rem)` } },
          //  The flex row is inside the cell, not the cell itself: `display:
          //  flex` on a td drops it out of the table box model, and this
          //  table is `table-layout: fixed`.
          m('.file-tree__row', [
            parStruct && parStruct.details.children && Object.keys(parStruct.details.children).length
              ? icon('angle-right', {
                class: parStruct.showChild ? 'file-tree__twist icon--rot-90' : 'file-tree__twist',
                title: parStruct.showChild ? 'Collapse' : 'Expand',
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
              : m('span.file-tree__twist.is-empty'),
            icon(
              //  `users`, which has the duotone the friend row asks for
              //  (`user-friends` maps to the same glyph but has no -duo).
              isId ? 'users' : !isFile ? (parStruct.showChild ? 'folder-open' : 'folder') : 'file',
              {
                // A friend node is the one icon here that carries reach, so it
                // is the one that ships duotone.
                duo: isId,
                class: isId
                  ? 'friends-files__friend-icon'
                  : !isFile
                    ? 'friends-files__folder-icon'
                    : 'friends-files__file-icon',
                title: isId ? 'Friend' : isFile ? 'File' : 'Folder',
              }
            ),
            m('span.file-tree__label',
              isId
                ? `${nameOfId || parStruct.details.name} (${parStruct.details.name.slice(0, 8)}…)`
                : parStruct.details.name),
          ])
        ),
        m('td', rs.formatBytes(parStruct.details.size.xint64)),
        isFile &&
          m(
            'td',
            //  The whole File card does not belong in a table cell. The row
            //  says how far along it is; the figures live in the info tooltip.
            fileDown.list[parStruct.details.hash]
              ? transferStatus(fileDown.list[parStruct.details.hash])
              : haveFile
                ? m('span.friends-files__have', [icon('check'), 'Downloaded'])
                : m('button.is-primary',
                  {
                    style: { fontSize: '0.9em' },
                    onclick: () => widget.confirmMessage({
                      title: 'Start Download?',
                      message: parStruct.details.name,
                      confirmLabel: 'Start download',
                      onConfirm: async () => {
                        if (haveFile) return;
                        const res = await rs.rsJsonApiRequest('/rsFiles/FileRequest', {
                          fileName: parStruct.details.name,
                          hash: parStruct.details.hash,
                          flags: util.RS_FILE_REQ_ANONYMOUS_ROUTING,
                          size: {
                            xstr64: parStruct.details.size.xstr64,
                          },
                        });
                        res.body.retval === false
                          ? toast.error(res.body.errorMessage)
                          : toast.success('Download Started');
                        m.redraw();
                      },
                    }),
                  },

                  [m('span', 'Download'), icon('download')]
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
      m(widget.PageHead, {
        title: 'Friends\' Files',
        lead: 'Browse what the friends you are connected to are sharing.',
      }),
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
