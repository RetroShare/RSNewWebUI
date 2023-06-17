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
      if (v.attrs.replyDepth === 1 && parStruct) {
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
        parStruct && Object.keys(parStruct.details.children).length
          ? m(
              'td',
              m('i.fas.fa-angle-right', {
                class: 'fa-rotate-' + (parStruct.showChild ? '90' : '0'),
                style: 'margin-top:12px',
                onclick: () => {
                  if (!loaded) {
                    // if it is not already retrieved.
                    parStruct.details.children.map(async (child) => {
                      const res = await rs.rsJsonApiRequest('/rsfiles/requestDirDetails', {
                        handle: child.handle.xint64,
                        flags: util.RS_FILE_HINTS_REMOTE,
                      });
                      childrenList.push(res.body.details);
                      loaded = true;
                    });
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
              left: `calc(30px*${v.attrs.replyDepth})`,
            },
          },
          isId
            ? nameOfId + ' (' + parStruct.details.name.slice(0, 8) + '...)'
            : parStruct.details.name
        ),
        m('td', util.formatbytes(parStruct.details.size.xint64)),
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
  //  let root_handle;
  let parent;
  return {
    oninit: () => {
      rs.rsJsonApiRequest('/rsfiles/requestDirDetails', {
        flags: util.RS_FILE_HINTS_REMOTE,
      }).then((res) => (parent = res));
    },
    view: () => [
      m('.widget__heading', [m('h3', 'Friends Files')]),
      m('.widget__body', [
        m(
          util.FriendsFilesTable,
          m(
            'tbody',
            parent && // root
              m(displayfiles, {
                par_directory: { details: parent.body.details, showChild: false },
                replyDepth: 0,
              })
          )
        ),
      ]),
    ],
  };
};

module.exports = Layout;
