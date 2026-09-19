const m = require('mithril');
const rs = require('rswebui');
const util = require('files/files_util');
const manager = require('files/files_manager');
const icon = require('icon');
const widget = require('widgets');

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
        //  The twist, the type icon and the name are one cell, indented by
        //  padding. Not two cells with the name shifted by `position: relative;
        //  left:`, which moves the text without moving the chevron and leaves
        //  every level's arrow in the same column.
        m(
          'td.file-tree__name',
          { style: { paddingLeft: `calc(var(--s2) + ${v.attrs.replyDepth} * 1.25rem)` } },
          //  The flex row is inside the cell, not the cell itself: `display:
          //  flex` on a td drops it out of the table box model, and this
          //  table is `table-layout: fixed`.
          m('.file-tree__row', [
            parStruct && parStruct.details.children && parStruct.details.children.length
              ? icon('angle-right', {
                class: parStruct.showChild ? 'file-tree__twist icon--rot-90' : 'file-tree__twist',
                title: parStruct.showChild ? 'Collapse' : 'Expand',
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
              : m('span.file-tree__twist.is-empty'),
            //  `children !== undefined` was true for a file too -- the core
            //  sends an empty array -- so every shared file wore a folder.
            //  A non-zero hash is what makes an entry a file, the same test
            //  Friends' Files already used.
            Number(parStruct.details.hash) !== 0
              ? icon('file', { title: 'File', class: 'files-file-icon' })
              : icon(parStruct.showChild ? 'folder-open' : 'folder', {
                  title: 'Folder',
                  class: 'files-folder-icon',
                }),
            m('span.file-tree__label', translateName(parStruct.details.name || '')),
          ])
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
      m(widget.PageHead, {
        title: 'My Files',
        lead: 'The directories you share with your friends.',
        actions: m(
          'button.my-files__configure-shares.is-primary',
          {
            onclick: () => (showShareManager = true),
            title: 'Configure shared directories',
            'aria-label': 'Configure shared directories',
          },
          [icon('folder-plus'), m('span', 'Configure shared directories')]
        ),
      }),
      m('.widget__body', [
        m(
          util.MyFilesTable,
          m(
            'tbody',
            isLoading
              ? m('tr', m('td[colspan=2]', 'Loading…'))
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
              icon('times')
            )
          )
        ),
      ]),
    ],
  };
};

module.exports = Layout;
