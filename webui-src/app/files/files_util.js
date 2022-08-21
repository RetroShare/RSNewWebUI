const m = require('mithril');
const rs = require('rswebui');

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

function makeFriendlyUnit(bytes) {
  let cnt = bytes;
  for (const s of ['', 'k', 'M', 'G']) {
    if (cnt < 1000) {
      return cnt.toFixed(1) + ' ' + s + 'B';
    } else {
      cnt = cnt / 1024;
    }
  }
  return cnt.toFixed(1) + 'TB';
}

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

async function fileAction(hash, action) {
  let actionHeader = '';
  const jsonParams = {
    hash,
    flags: 0,
  };
  switch (action) {
    case 'cancel':
      actionHeader = '/rsFiles/FileCancel';
      break;

    case 'pause':
      actionHeader = '/rsFiles/FileControl';
      jsonParams.flags = RS_FILE_CTRL_PAUSE;
      break;

    case 'resume':
      actionHeader = '/rsFiles/FileControl';
      jsonParams.flags = RS_FILE_CTRL_START;
      break;

    case 'force_check':
      actionHeader = '/rsFiles/FileControl';
      jsonParams.flags = RS_FILE_CTRL_FORCE_CHECK;
      break;

    default:
      console.error('Unknown action in Downloads.control()');
      return;
  }
  const res = await rs.rsJsonApiRequest(actionHeader, jsonParams, () => {});
  return res.body.retval;
}
function popupmessage(message) {
  const container = document.getElementById('modal-container');
  container.style.display = 'block';
  m.render(
    container,
    m('.modal-content', [
      m(
        'button.red',
        {
          onclick: () => (container.style.display = 'none'),
        },
        m('i.fas.fa-times')
      ),
      message,
    ])
  );
}
function actionButton(file, action) {
  switch (action) {
    case 'resume':
      return m(
        'button',
        {
          title: 'resume',

          onclick() {
            fileAction(file.hash, 'resume');
          },
        },
        m('i.fas.fa-play')
      );

    case 'pause':
      return m(
        'button',
        {
          title: 'pause',

          onclick() {
            fileAction(file.hash, 'pause');
          },
        },
        m('i.fas.fa-pause')
      );

    case 'cancel':
      return m(
        'button.red',
        {
          title: 'cancel',

          onclick() {
            popupmessage(
              m('Cancelpop', [
                m('p', 'Are you sure you want to cancel download?'),
                m(
                  'button',
                  {
                    onclick: () => {
                      if (fileAction(file.hash, 'cancel')) {
                        popupmessage(m('p', 'Download Cancelled Successfully'));
                      } else {
                        popupmessage(m('p', 'Download Cancel Failed'));
                      }

                      m.redraw();
                    },
                  },
                  'Cancel'
                ),
              ])
            );
            // fileAction(file.hash, 'cancel');
          },
        },
        m('i.fas.fa-times')
      );
  }
}

const ProgressBar = () => {
  return {
    view: (v) =>
      m(
        '.progressbar',
        {
          style: {
            content: v.attrs.rate + '%',
          },
        },
        m(
          'span.progress-status',
          {
            style: {
              width: v.attrs.rate + '%',
            },
          },
          v.attrs.rate.toPrecision(3) + '%'
        )
      ),
  };
};

const chunkStrats = [
  'CHUNK_STRATEGY_STREAMING',
  'CHUNK_STRATEGY_RANDOM',
  'CHUNK_STRATEGY_PROGRESSIVE',
];
const chunkStratsOptions = ['Streaming', 'Random', 'Progressive'];
//rstypes.h :: 366

const File = () => {
  let chunkStrat;
  return {
    view: (v) =>
      m(
        '.file-view',
        {
          key: v.attrs.info.hash,
          style: {
            display: v.attrs.info.isSearched ? 'block' : 'none',
          },
        },
        [
          m('p', v.attrs.info.fname),
          v.attrs.direction === 'up' || v.attrs.info.downloadStatus === FT_STATE_COMPLETE
            ? []
            : [
                actionButton(v.attrs.info, 'cancel'),
                actionButton(
                  v.attrs.info,
                  v.attrs.info.downloadStatus === FT_STATE_PAUSED ? 'resume' : 'pause'
                ),

                m(
                  'select[id=chunkTag]',
                  {
                    value: chunkStrat,
                    onchange: async (e) => {
                      chunkStrat = chunkStrats[e.target.selectedIndex];
                      const res = await rs.rsJsonApiRequest('/rsFiles/setChunkStrategy', {
                        hash: v.attrs.info.hash,
                        newStrategy: chunkStrat,
                      });
                    },
                  },
                  [chunkStratsOptions.map((opt) => m('option', { value: opt }, opt))]
                ),
                m('label[for=chunkTag]', 'Set Chunk Strategy: '),
              ],
          v.attrs.direction === 'up'
            ? []
            : m(ProgressBar, {
                rate: (v.attrs.transferred / v.attrs.info.size.xint64) * 100,
              }),
          m('span.filestat', m('i.fas.fa-download'), makeFriendlyUnit(v.attrs.transferred)),

          m('span.filestat', m('i.fas.fa-file'), makeFriendlyUnit(v.attrs.info.size.xint64)),
          m(
            'span.filestat',
            m('i.fas.fa-arrow-circle-' + v.attrs.direction),
            makeFriendlyUnit(v.attrs.info.tfRate * 1024) + '/s'
          ),
          v.attrs.direction === 'up'
            ? []
            : m('span.filestat', { title: 'time remaining' }, [
                m('i.fas.fa-clock'),
                calcRemainingTime(
                  v.attrs.info.size.xint64 - v.attrs.transferred,
                  v.attrs.info.tfRate
                ),
              ]),
          m(
            'span.filestat',
            { title: 'peers' },
            [m('i.fas.fa-users'), v.attrs.info.peers.length],
            v.attrs.parts.reduce((a, e) => [...a, ' - ' + makeFriendlyUnit(e)], [])
          ),
        ]
      ),
  };
};

const SearchBar = () => {
  let searchString = '';
  return {
    view: (v) =>
      m('input[type=text][placeholder=search].searchbar', {
        value: searchString,
        oninput: (e) => {
          searchString = e.target.value.toLowerCase();
          for (const hash in v.attrs.list) {
            if (v.attrs.list[hash].fname.toLowerCase().indexOf(searchString) > -1) {
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
  return big.filter(function (val) {
    return !this.has(val);
  }, new Set(small));
}

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
