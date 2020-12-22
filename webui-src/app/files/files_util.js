let m = require('mithril');
let rs = require('rswebui');

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

const RS_FILE_REQ_ANONYMOUS_ROUTING = 0x00000040

function makeFriendlyUnit(bytes) {
  if(bytes < 1e3)
    return bytes.toFixed(1) + 'B';
  if(bytes < 1e6)
    return (bytes / 1e3)
      .toFixed(1) + 'kB';
  if(bytes < 1e9)
    return (bytes / 1e6)
      .toFixed(1) + 'MB';
  if(bytes < 1e12)
    return (bytes / 1e9)
      .toFixed(1) + 'GB';
  return (bytes / 1e12)
    .toFixed(1) + 'TB';
}

function fileAction(hash, action) {
  let action_header = '';
  let json_params = {
    hash,
    flags: 0
  };
  switch (action) {
    case 'cancel':
      action_header = '/rsFiles/FileCancel';
      break;

    case 'pause':
      action_header = '/rsFiles/FileControl';
      json_params.flags = RS_FILE_CTRL_PAUSE;
      break;

    case 'resume':
      action_header = '/rsFiles/FileControl';
      json_params.flags = RS_FILE_CTRL_START;
      break;

    case 'force_check':
      action_header = '/rsFiles/FileControl';
      json_params.flags = RS_FILE_CTRL_FORCE_CHECK;
      break;

    default:
      console.error('Unknown action in Downloads.control()');
      return;
  };
  rs.rsJsonApiRequest(action_header, json_params, () => {});
};

function actionButton(file, action) {
  switch (action) {
    case 'resume':
      return m('button', {
        title: 'resume',
        onclick: function() {
          fileAction(file.hash, 'resume');
        },
      }, m('i.fas.fa-play'));

    case 'pause':
      return m('button', {
        title: 'pause',
        onclick: function() {
          fileAction(file.hash, 'pause');
        },
      }, m('i.fas.fa-pause'));

    case 'cancel':
      return m('button.red', {
        title: 'cancel',
        onclick: function() {
          fileAction(file.hash, 'cancel');
        },
      }, m('i.fas.fa-times'));
  }
};

const ProgressBar = () => {
  return {
    view: (v) => m('.progressbar', {
        style: {
          content: v.attrs.rate + '%'
        }
      },
      m('span.progress-status', {
        style: {
          width: v.attrs.rate + '%'
        }
      }, v.attrs.rate.toPrecision(3) + '%'))
  };
};

const File = () => {
  return {
    view: (v) => m('.file-view', {
      key: v.attrs.info.hash,
      style: {
        display: v.attrs.info.isSearched ? "block" : "none",
      }
    }, [
      m('p', v.attrs.info.fname),
      actionButton(v.attrs.info, 'cancel'),
      actionButton(v.attrs.info,
        v.attrs.info.downloadStatus === FT_STATE_PAUSED ?
        'resume' : 'pause'),
      m(ProgressBar, {
        rate: v.attrs.info.transfered.xint64 / v.attrs.info.size.xint64 *
          100,
      }),
      m('span', m('i.fas.fa-file'), makeFriendlyUnit(
        v.attrs.info.size.xint64)),
      m('span', m('i.fas.fa-arrow-circle-down'),
        makeFriendlyUnit(v.attrs.info.tfRate * 1024) + '/s'),
    ]),
  }
};

const SearchBar = () => {
  let searchString = '';
  return {
    view: (v) =>
      m('input[type=text][placeholder=search].searchbar', {
        value: searchString,
        oninput: (e) => {
          searchString = e.target.value.toLowerCase();
          for(let hash in v.attrs.list) {
            if(v.attrs.list[hash].fname.toLowerCase().indexOf(
                searchString) > -1) {
              v.attrs.list[hash].isSearched = true;
            } else {
              v.attrs.list[hash].isSearched = false;
            }
          }
        },
      }),
  };
};

function compareArrays(big, small) {
  // Use filter on bigger array
  // Pass `new Set(array_to_compare)` as second param to filter
  // Source: https://stackoverflow.com/a/40538072/7683374
  return big.filter(function(val) {
    return !this.has(val);
  }, new Set(small));
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
  makeFriendlyUnit,
  File,
  SearchBar,
  compareArrays,
};

