const m = require('mithril');
const rs = require('rswebui');
const widget = require('widgets');
const icon = require('icon');
const toast = require('toast');

const RS_FILE_CTRL_PAUSE = 0x00000100;
const RS_FILE_CTRL_START = 0x00000200;
const RS_FILE_CTRL_FORCE_CHECK = 0x00000400;

const FT_STATE_FAILED = 0x0000;
const FT_STATE_OKAY = 0x0001;
const FT_STATE_WAITING = 0x0002;
const FT_STATE_DOWNLOADING = 0x0003;
const FT_STATE_COMPLETE = 0x0004;
const FT_STATE_QUEUED = 0x0005;
const FT_STATE_PAUSED = 0x0006;
const FT_STATE_CHECKING_HASH = 0x0007;

const RS_FILE_REQ_ANONYMOUS_ROUTING = 0x00000040;
const RS_FILE_HINTS_REMOTE = 0x00000008;
const RS_FILE_HINTS_LOCAL = 0x00000004;

// Flags for directory sharing permissions.
const DIR_FLAGS_ANONYMOUS_SEARCH = 0x0800;
const DIR_FLAGS_ANONYMOUS_DOWNLOAD = 0x0080;
const DIR_FLAGS_BROWSABLE = 0x0400;

const RsSharedDirectoriesEventCode = {
  UNKNOWN                  : 0x00,
  HASHING_PROCESS_STARTED  : 0x01,
  HASHING_PROCESS_PAUSED   : 0x02,
  HASHING_PROCESS_RESUMED  : 0x04,
  HASHING_PROCESS_FINISHED : 0x05,
  HASHING_FILE             : 0x06,
  SAVING_FILE_INDEX        : 0x07,
  EXTRA_LIST_FILE_ADDED    : 0x08,
  EXTRA_LIST_FILE_REMOVED  : 0x09,
  SHARED_DIRS_LIST_CHANGED : 0x0a,
  FRIEND_DIR_LIST_UPDATED  : 0x0b,
  OWN_DIR_LIST_UPDATED     : 0x0c,
  OWN_DIR_LIST_PROCESSING  : 0x0d,
};

/* eslint-disable no-unused-vars */

// Access Permission calculated by performing OR operation on the above three flags.
const DIR_FLAGS_PERMISSIONS_MASK =
  DIR_FLAGS_ANONYMOUS_SEARCH | DIR_FLAGS_ANONYMOUS_DOWNLOAD | DIR_FLAGS_BROWSABLE;

/* eslint-enable no-unused-vars */

// parent_groups visibility
const RsNodeGroupId = {
  '00000000000000000000000000000001': 'Friends',
  '00000000000000000000000000000002': 'Family',
  '00000000000000000000000000000003': 'Co-Workers',
  '00000000000000000000000000000004': 'Other Contacts',
  '00000000000000000000000000000005': 'Favorites',
};

function loadRsNodeGroupId() {
  rs.rsJsonApiRequest('/rsPeers/getGroupInfoList').then((res) => {
    const { groupInfoList } = res.body;
    groupInfoList.forEach((groupItem) => {
      if (!Object.prototype.hasOwnProperty.call(RsNodeGroupId, groupItem.id)) {
        RsNodeGroupId[groupItem.id] = groupItem.name;
      }
    });
  });
}

function calcIndividualFlags(shareFlagsVal) {
  const isAnonymousSearch = (shareFlagsVal & DIR_FLAGS_ANONYMOUS_SEARCH) !== 0;
  const isAnonymousDownload = (shareFlagsVal & DIR_FLAGS_ANONYMOUS_DOWNLOAD) !== 0;
  const isBrowsable = (shareFlagsVal & DIR_FLAGS_BROWSABLE) !== 0;
  return {
    isAnonymousSearch,
    isAnonymousDownload,
    isBrowsable,
  };
}

function calcShareFlagsValue(shareFlagsObj) {
  // calculate shareFlagsVal by performing OR operation on the Flags that have true value
  const shareFlagsVal =
    (shareFlagsObj.isAnonymousSearch && DIR_FLAGS_ANONYMOUS_SEARCH) |
    (shareFlagsObj.isAnonymousDownload && DIR_FLAGS_ANONYMOUS_DOWNLOAD) |
    (shareFlagsObj.isBrowsable && DIR_FLAGS_BROWSABLE);
  return shareFlagsVal;
}

const createArrayProxy = (arr, onChange) => {
  return new Proxy(arr, {
    set: (target, property, value, reciever) => {
      const success = Reflect.set(target, property, value, reciever);
      if (success && onChange) {
        onChange();
      }
      return success;
    },
  });
};

const createProxy = (obj, onChange) => {
  return new Proxy(obj, {
    get: (target, property, reciever) => {
      const value = Reflect.get(target, property, reciever);
      return typeof value === 'object' && value !== null
        ? Array.isArray(value)
          ? createArrayProxy(value, onChange)
          : createProxy(value, onChange)
        : value;
    },
    set: (target, property, value, reciever) => {
      const success = Reflect.set(target, property, value, reciever);
      if (success && onChange) {
        onChange();
      }
      return success;
    },
  });
};

function calcRemainingTime(bytes, rate) {
  if (rate <= 0 || bytes < 1) {
    return '--';
  } else {
    let secs = bytes / rate / 1024;
    if (secs < 60) {
      return secs.toFixed() + 's';
    }
    let mins = secs / 60;
    secs = secs - Math.floor(mins) * 60;
    if (mins < 60) {
      return mins.toFixed() + 'm ' + secs.toFixed() + 's';
    }
    let hours = mins / 60;
    mins = mins - Math.floor(hours) * 60;
    if (hours < 24) {
      return hours.toFixed() + 'h ' + mins.toFixed() + 'm';
    }
    const days = hours / 24;
    hours = hours - Math.floor(days) * 24;
    return days.toFixed() + 'd ' + hours.toFixed() + 'h';
  }
}

function fileAction(hash, action) {
  const jsonParams = {
    hash,
    flags: 0,
  };
  switch (action) {
    case 'pause':
      jsonParams.flags = RS_FILE_CTRL_PAUSE;
      break;

    case 'resume':
      jsonParams.flags = RS_FILE_CTRL_START;
      break;

    case 'force_check':
      jsonParams.flags = RS_FILE_CTRL_FORCE_CHECK;
      break;

    default:
      console.error('Unknown action in Downloads.control()');
      return;
  }
  rs.rsJsonApiRequest('/rsFiles/FileControl', jsonParams);
}

const ProgressBar = () => {
  return {
    view: (v) =>
      //  The percentage sits beside the bar, not centred inside it: the bar
      //  is a few pixels tall now, and a label over it was the reason it had
      //  to be 32px in the first place.
      m('.progress-bar-row', [
        m('.progress-bar-chunks',
          v.attrs.chunksInfo.chunks.map((item) => m(`span.chunk[data-chunkVal=${item}]`))),
        m('span.progress-bar-row__percent', `${v.attrs.rate.toFixed(1)}%`),
      ]),
  };
};

const File = () => {
  let chunkStrat;
  const chunkStrats = {
    // rstypes.h :: 366
    0: 'Sequential', // CHUNK_STRATEGY_SEQUENTIAL
    1: 'Random', // CHUNK_STRATEGY_RANDOM
    2: 'Progressive', // CHUNK_STRATEGY_PROGRESSIVE
    3: 'Streaming', // CHUNK_STRATEGY_STREAMING
  };
  function fileCancel(hash) {
    rs.rsJsonApiRequest('/rsFiles/FileCancel', { hash }).then((res) =>
      toast.info(`Download Cancel ${res ? 'Successful' : 'Failed'}`)
    );
  }
  function cancelFileDownload(hash) {
    widget.confirmMessage({
      title: 'Cancel download',
      message: 'The partial file will be discarded.',
      cancelLabel: 'Keep downloading',
      confirmLabel: 'Cancel download',
      danger: true,
      onConfirm: () => fileCancel(hash),
    });
  }
  function actionButton(file, action) {
    return m(
      'button.is-icon',
      { title: action, onclick: () => fileAction(file.hash, action) },
      icon(action === 'resume' ? 'play' : action)
    );
  }

  return {
    oninit: async (v) => {
      chunkStrat = await v.attrs.strategy;
    },
    view: (v) => {
      const { info, direction, transferred, chunksInfo } = v.attrs;
      function changeChunkStrategy(e) {
        chunkStrat = e.target.selectedIndex;
        rs.rsJsonApiRequest('/rsFiles/setChunkStrategy', {
          hash: info.hash,
          newStrategy: chunkStrat,
        });
      }
      return m('.file-view', { style: { display: info.isSearched ? 'block' : 'none' } }, [
        m('.file-view__heading', [
          m('h6', info.fname),
          chunkStrat !== undefined &&
          direction === 'down' && [
            m('.file-view__heading-chunk', [
              //  Keyed by hash: one `chunkTag` id was shared by every row, so
              //  the label focused whichever select happened to render last.
              m(`label[for=chunk-${info.hash}]`, 'Chunk strategy'),
              m(`select[id=chunk-${info.hash}]`, { value: chunkStrat, onchange: changeChunkStrategy }, [
                Object.keys(chunkStrats).map((strat) =>
                  m('option', { value: strat }, chunkStrats[strat])
                ),
              ]),
            ]),
          ],
        ]),
        m('.file-view__body', [
          m(
            '.file-view__body-progress',
            direction === 'down' &&
            m(ProgressBar, { rate: (transferred / info.size.xint64) * 100, chunksInfo })
          ),
          m('.file-view__body-details', [
            m('.file-view__body-details-stat', [
              m('span', { title: 'downloaded size' }, [
                icon('download'),
                rs.formatBytes(transferred),
              ]),
              m('span', { title: 'total size' }, [
                icon('file'),
                rs.formatBytes(info.size.xint64),
              ]),
              m('span', { title: 'speed' }, [
                icon(`arrow-circle-${direction}`),
                `${rs.formatBytes(info.tfRate * 1024)}/s`,
              ]),
              direction === 'down' &&
              m('span', { title: 'time remaining' }, [
                icon('clock'),
                calcRemainingTime(info.size.xint64 - transferred, info.tfRate),
              ]),
              m('span', { title: 'peers' }, [icon('users'), info.peers.length]),
            ]),
            m(
              '.file-view__body-details-action',
              info.downloadStatus !== FT_STATE_COMPLETE && [
                actionButton(info, info.downloadStatus === FT_STATE_PAUSED ? 'resume' : 'pause'),
                m(
                  'button.red.is-icon',
                  { title: 'Cancel download', onclick: () => cancelFileDownload(info.hash) },
                  icon('times')
                ),
              ]
            ),
          ]),
        ]),
      ]);
    },
  };
};

const SearchBar = () => {
  let searchString = '';
  return {
    view: (v) =>
      m(widget.SearchField, {
        placeholder: 'Search',
        value: searchString,
        oninput: (e) => {
          searchString = e.target.value.toLowerCase();
          for (const hash in v.attrs.list) {
            v.attrs.list[hash].isSearched =
              v.attrs.list[hash].fname.toLowerCase().indexOf(searchString) > -1;
          }
        },
      }),
  };
};

function compareArrays(big, small) {
  // Use filter on bigger array
  // Pass `new Set(array_to_compare)` as second param to filter
  // Source: https://stackoverflow.com/a/40538072/7683374
  return big.filter(function (val) {
    return !this.has(val);
  }, new Set(small));
}

const MyFilesTable = () => {
  return {
    view: (v) =>
      m('table.myfiles', [
        //  No separate twist column: the chevron lives in the name cell, so
        //  it indents with the row it belongs to.
        m('tr', [m('th', 'My Directories'), m('th', 'Size')]),
        v.children,
      ]),
  };
};

const FriendsFilesTable = () => {
  return {
    view: (v) =>
      m('table.friendsfiles', [
        m('tr', [
          m('th', 'Friends Directories'),
          m('th', 'Size'),
          m('th', 'Download'),
        ]),
        v.children,
      ]),
  };
};

module.exports = {
  RS_FILE_CTRL_PAUSE,
  RS_FILE_CTRL_START,
  RS_FILE_CTRL_FORCE_CHECK,
  FT_STATE_FAILED,
  FT_STATE_OKAY,
  FT_STATE_WAITING,
  FT_STATE_DOWNLOADING,
  FT_STATE_COMPLETE,
  FT_STATE_QUEUED,
  FT_STATE_PAUSED,
  FT_STATE_CHECKING_HASH,
  RS_FILE_REQ_ANONYMOUS_ROUTING,
  RS_FILE_HINTS_REMOTE,
  RS_FILE_HINTS_LOCAL,
  DIR_FLAGS_ANONYMOUS_SEARCH,
  DIR_FLAGS_ANONYMOUS_DOWNLOAD,
  DIR_FLAGS_BROWSABLE,
  RsSharedDirectoriesEventCode,
  RsNodeGroupId,
  loadRsNodeGroupId,
  File,
  SearchBar,
  compareArrays,
  MyFilesTable,
  FriendsFilesTable,
  createProxy,
  calcIndividualFlags,
  calcShareFlagsValue,
};
