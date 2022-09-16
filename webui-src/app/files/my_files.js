const m = require('mithril');
const rs = require('rswebui');
const util = require('files/files_util');

function displayfiles() {
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
        parStruct && Object.keys(parStruct.details.children).length
          ? m(
              'td',
              m('i.fas.fa-angle-right', {
                class: 'fa-rotate-' + (parStruct.showChild ? '90' : '0'),
                style: 'margin-top:12px',
                onclick: () => {
                  if (!loaded) {  // if it is not already retrieved
                    parStruct.details.children.map(async (child) => {
                      const res = await rs.rsJsonApiRequest('/rsfiles/requestDirDetails', {
                        handle: child.handle.xint64,
                        flags: util.RS_FILE_HINTS_LOCAL,
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
          parStruct.details.name
        ),
        m('td', util.formatbytes(parStruct.details.size.xint64)),
      ]),
      parStruct.showChild &&
        childrenList.map((child) =>
          m(displayfiles, { // recursive call
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
    oninit: async () => {
      const res = await rs.rsJsonApiRequest('/rsfiles/requestDirDetails', {});
      parent = res;
    },
    view: (v) => [
      m('.widget', [
        m('h3', 'My Files'),
        m(
          util.MyFilesTable,
          m(
            'tbody',
            parent &&
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
