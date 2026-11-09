const m = require('mithril');
const rs = require('rswebui');
const widget = require('widgets');
const futil = require('files/files_util');
const cutil = require('config/config_util');
const icon = require('icon');
const toast = require('toast');

const shareManagerInfo = `
  This is a list of shared folders. You can add and remove folders using the buttons at the bottom.
  e.g- You can click on Edit button and then modify any field. When you add a new folder, initially
  all files in that folder are shared. You can separately share flags for each shared directory.
`;

const accessTooltipText = [
  'Manage Control Access for Directories, The three options are for the following purpose.',
  icon('search'),
  ' Directory can be searched anonymously, ',
  icon('download'),
  ' Directory can be accessed anonymously, ',
  icon('eye'),
  ' Directory can be browsed by designated friends',
];

let sharedDirArr = [];
let isEditDisabled = true;

function loadSharedDirectories() {
  rs.rsJsonApiRequest('/rsFiles/getSharedDirectories').then((res) => {
    if (res.body.retval) sharedDirArr = res.body.dirs;
  });
}

// Update Shared Directories when there is a corresponding event
rs.events[rs.RsEventsType.SHARED_DIRECTORIES] = {
  handler: (event) => {
    switch (event.mEventCode) {
      case futil.RsSharedDirectoriesEventCode.SHARED_DIRS_LIST_CHANGED:
        loadSharedDirectories();
        break;
    }
  },
};

const AddSharedDirForm = () => {
  let newDirPath = '';

  function addNewSharedDirectory() {
    // check if newDirPath already exists
    const sharedDirArrExists = sharedDirArr.find((item) => item.filename === newDirPath);
    if (sharedDirArrExists) {
      toast.warning('That path is already shared');
      return;
    }
    const newSharedDir = {
      dir: {
        filename: newDirPath,
        virtualname: '',
        shareflags: futil.DIR_FLAGS_ANONYMOUS_SEARCH | futil.DIR_FLAGS_ANONYMOUS_DOWNLOAD,
        parent_groups: [],
      },
    };
    rs.rsJsonApiRequest('/rsFiles/addSharedDirectory', { ...newSharedDir }).then((res) => {
      if (res.body.retval) {
        loadSharedDirectories();
        widget.closePopupMessage();
      }
      toast.result(res.body.retval,
        'Directory shared',
        'The directory could not be added to the shared list.');
    });
  }

  return {
    view: () =>
      m('form.share-manager__form', { onsubmit: addNewSharedDirectory }, [
        m('.share-manager__form_input', [
          m('label', 'Enter absolute directory path :'),
          m('input[type=text]', {
            value: newDirPath,
            oninput: (e) => (newDirPath = e.target.value),
          }),
        ]),
        m('.modal__foot', [
          m('button[type=button]', { onclick: () => widget.closePopupMessage() }, [icon('times'), 'Cancel']),
          m('button[type=submit]', 'Add directory'),
        ]),
      ]),
  };
};

const ManageVisibility = () => {
  function handleSubmit() {
    m.redraw();
    const mContainer = document.getElementById('modal-container');
    mContainer.style.display = 'none';
  }
  return {
    view: (v) => {
      const { parentGroups } = v.attrs;
      return m('.widget', [

        m('form.widget__body', { onsubmit: handleSubmit }, [
          Object.keys(futil.RsNodeGroupId).map((groupId) =>
            m('div.manage-visibility', [
              m(`label[for=${futil.RsNodeGroupId[groupId]}]`, futil.RsNodeGroupId[groupId]),
              m(`input[type=checkbox][id=${futil.RsNodeGroupId[groupId]}]`, {
                // if parentGroups is empty it means All friends nodes have Visibility
                checked: parentGroups.includes(groupId),
                onclick: () => {
                  if (parentGroups.includes(groupId)) {
                    const groupItemIndex = parentGroups.indexOf(groupId);
                    parentGroups.splice(groupItemIndex, 1);
                  } else {
                    parentGroups.push(groupId);
                  }
                },
              }),
            ])
          ),
          m('button[type=submit]', 'OK'),
        ]),
      ]);
    },
  };
};

const ShareDirTable = () => {
  return {
    oninit: futil.loadRsNodeGroupId,
    view: () => {
      return m('table.share-manager__table', [
        m(
          'thead.share-manager__table_heading',
          m('tr', [
            m('td', 'Shared Directories'),
            m('td', 'Visible Name'),
            m('td', 'Access', cutil.tooltip(accessTooltipText)),
            m('td', 'Visibility'),
          ])
        ),
        m(
          'tbody.share-manager__table_body',
          sharedDirArr.length
            ? sharedDirArr.map((sharedDirItem, index) => {
            const {
              filename,
              virtualname,
              shareflags,
              parent_groups: parentGroups,
            } = sharedDirItem;
            const sharedFlags = futil.calcIndividualFlags(shareflags);
            return m('tr', [
              m(
                'td',
                m('input[type=text]', {
                  value: filename,
                  disabled: isEditDisabled,
                  oninput: (e) => {
                    sharedDirArr[index].filename = e.target.value;
                  },
                })
              ),
              m(
                'td',
                m('input[type=text]', {
                  value: virtualname,
                  disabled: isEditDisabled,
                  oninput: (e) => {
                    sharedDirArr[index].virtualname = e.target.value;
                  },
                })
              ),
              m(
                'td.share-flags',
                Object.keys(sharedFlags).map((flag) => {
                  return [
                    m(`input.share-flags-check[type=checkbox][id=${flag}]`, {
                      checked: sharedFlags[flag],
                      disabled: isEditDisabled,
                    }),
                    m(
                      `label.share-flags-label[for=${flag}]`,
                      {
                        onclick: () => {
                          if (isEditDisabled) return;
                          sharedFlags[flag] = !sharedFlags[flag];
                          sharedDirArr[index].shareflags = futil.calcShareFlagsValue(sharedFlags);
                        },
                        class: isEditDisabled ? 'is-disabled' : '',
                      },
                      (
                        // check the flag type then if its value is true then only render the icon
                        flag === 'isAnonymousSearch'
                          ? sharedFlags[flag]
                            ? icon('search')
                            : m('span')
                          : flag === 'isAnonymousDownload'
                            ? sharedFlags[flag]
                              ? icon('download')
                              : m('span')
                            : sharedFlags[flag]
                              ? icon('eye')
                              : m('span')
                      )
                    ),
                  ];
                })
              ),
              m(
                'td',
                {
                  //  Not an input, so the disabled look has to be asked for.
                  class: isEditDisabled ? 'is-disabled' : '',
                  onclick: () =>
                    !isEditDisabled && widget.popupMessage(m(ManageVisibility, { parentGroups }), '', {
                      title: 'Visibility',
                      lead: 'Choose which groups of friends can see this directory.',
                    }),
                },
                parentGroups.length === 0
                  ? 'All Friend nodes'
                  : parentGroups.map((groupFlag) => futil.RsNodeGroupId[groupFlag]).join(', ')
              ),
            ]);
              })
            : m('tr.share-manager__empty', m('td[colspan=4]', 'No shared folders yet.'))
        ),
      ]);
    },
  };
};

const ShareManager = () => {
  function setNewSharedDirectories() {
    rs.rsJsonApiRequest('/rsFiles/setSharedDirectories', {
      dirs: sharedDirArr,
    });
  }
  return {
    oninit: loadSharedDirectories,
    view: () => {
      return m('.widget', [
        m('.widget__heading', m('h3', 'ShareManager')),
        m('form.widget__body.share-manager', { onsubmit: setNewSharedDirectories }, [
          m('blockquote.info', shareManagerInfo),
          m(ShareDirTable),
          m('.share-manager__actions', [
            m('button.is-primary', { onclick: () => widget.popupMessage(m(AddSharedDirForm), '', {
              title: 'Share a Directory',
              lead: 'Browsers cannot read a directory, so paste its absolute path.',
            }) }, [icon('plus'), 'Add New']),
            m('button.is-primary',
              { onclick: () => (isEditDisabled = !isEditDisabled) }, [icon('pen'), isEditDisabled ? 'Edit' : 'Apply and Close']),
          ]),
        ]),
      ]);
    },
  };
};

module.exports = ShareManager;
