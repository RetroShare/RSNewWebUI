const m = require('mithril');
const rs = require('rswebui');
const futil = require('files/files_util');
const cutil = require('config/config_util');

const shareManagerInfo = `
    This is a list of shared folders. You can add and remove folders using the buttons at the bottom.
    When you add a new folder, initially all files in that folder are shared. You can separately
    share flags for each shared directory.
  `;

function calcShareFlags(shareFlags) {
  const isAnonymousSearch = (shareFlags & futil.DIR_FLAGS_ANONYMOUS_SEARCH) !== 0;
  const isAnonymousDownload = (shareFlags & futil.DIR_FLAGS_ANONYMOUS_DOWNLOAD) !== 0;
  const isBrowsable = (shareFlags & futil.DIR_FLAGS_BROWSABLE) !== 0;
  return {
    isAnonymousSearch,
    isAnonymousDownload,
    isBrowsable,
  };
}

const ShareManager = () => {
  let sharedDirArr = [];
  let isEditDisabled = true;
  return {
    oninit: () => {
      rs.rsJsonApiRequest('/rsFiles/getSharedDirectories').then(
        (res) => (sharedDirArr = res.body.dirs)
      );
    },
    view: () => {
      return m('.widget', [
        m('.widget__heading', m('h3', 'ShareManager')),
        m('.widget__body.shareManager', [
          m('blockquote.info', shareManagerInfo),
          m('table.shareManager__table', [
            m(
              'thead.shareManager__table_heading',
              m('tr', [
                m('td', 'Shared Directories'),
                m('td', 'Visible Name'),
                m(
                  'td',
                  'Access',
                  cutil.tooltip(`Manage Control Access for Directories, The three options
                    are for the following purpose. 1. Directory can be searched anonymously, 2.
                    Directory can be accessed anonymously, 3. Directory can be browsed anonymously
                    `)
                ),
                m('td', 'Visibility'),
              ])
            ),
            m(
              'tbody.shareManager__table_body',
              sharedDirArr &&
                sharedDirArr.map((sharedDirItem) => {
                  const sharedFlags = calcShareFlags(sharedDirItem.shareflags);
                  return m('tr', [
                    m(
                      'td',
                      m('input[type=text]', {
                        value: sharedDirItem.filename,
                        disabled: isEditDisabled,
                      })
                    ),
                    m(
                      'td',
                      m('input[type=text]', {
                        value: sharedDirItem.virtualname,
                        disabled: isEditDisabled,
                      })
                    ),
                    m(
                      'td',
                      Object.keys(sharedFlags).map((flag) => {
                        return m('input[type=checkbox]', {
                          checked: sharedFlags[flag],
                          disabled: isEditDisabled,
                        });
                      })
                    ),
                    m(
                      'td',
                      sharedDirItem.parent_groups.length === 0
                        ? m('td', 'All Friend nodes')
                        : m(
                            'td',
                            sharedDirItem.parent_groups.map(
                              (group) => `${futil.RsNodeGroupId[group]},`
                            )
                          )
                    ),
                  ]);
                })
            ),
          ]),
          m(
            '.shareManager__actions',
            m('.shareManager__actions-add', m('button', 'Add New')),
            m('.shareManager__actions-edit', [
              isEditDisabled && m('button', { onclick: () => (isEditDisabled = false) }, 'Edit'),
              !isEditDisabled &&
                m('button', { onclick: () => (isEditDisabled = true) }, 'Apply and Close'),
            ])
          ),
        ]),
      ]);
    },
  };
};

module.exports = ShareManager;
