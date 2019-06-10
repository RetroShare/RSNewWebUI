let m = require('mithril');
let rs = require('rswebui');

// These constants are the onces listed in retroshare/rsfiles.h. I would like to
// make them "members" of Downloads but I dont know how to do this.
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

let Downloads = {
    statusMap: new Map(),
    hashes: [],

    loadHashes() {
        rs.rsJsonApiRequest(
            '/rsFiles/FileDownloads',
            {},
            function(d) {
                Downloads.hashes = d.hashs;
            },
        );
    },

    loadStatus() {
        Downloads.loadHashes();
        if(Downloads.hashes.length !== Downloads.statusMap.size)
            Downloads.statusMap.clear();
        for (let hash of Downloads.hashes) {
            let json_params = {
                hash,
                hintflags: 16,//RS_FILE_HINTS_DOWNLOAD
            };
            rs.rsJsonApiRequest(
                '/rsFiles/FileDetails',
                json_params,
                function(fileStat) {
                    Downloads.statusMap.set(hash, fileStat.info);
                },
            );
        }
    },
};

function makeFriendlyUnit(bytes) {
    if (bytes < 1e3) return bytes.toFixed(1) + 'B';
    if (bytes < 1e6) return (bytes / 1e3).toFixed(1) + 'kB';
    if (bytes < 1e9) return (bytes / 1e6).toFixed(1) + 'MB';
    if (bytes < 1e12) return (bytes / 1e9).toFixed(1) + 'GB';
    return (bytes / 1e12).toFixed(1) + 'TB';
}

function progressBar(rate) {
    return m('.progressbar[]',
        {style: {content: rate+'%'}},
        m('span.progress-status',
            {style: {width: rate+'%'}},
        rate + '%')
    );
};

function fileAction(hash, action) {
    let action_header = '';
    let json_params = {hash, flags: 0};
    switch(action) {
         case 'cancel':
             req_action = '/rsFiles/FileCancel';
             break;

         case 'pause':
            req_action = '/rsFiles/FileControl';
            json_params.flags = RS_FILE_CTRL_PAUSE;
            break;

        case 'resume':
            req_action = '/rsFiles/FileControl';
            json_params.flags = RS_FILE_CTRL_START;
            break;

        case 'force_check':
            req_action = '/rsFiles/FileControl';
            json_params.flags = RS_FILE_CTRL_FORCE_CHECK;
            break;

        default:
            console.log('Unknown action in Downloads.control()');
            return;
    };
    rs.rsJsonApiRequest(action_header, json_params, ()=>{});//false
};

function actionButton(file, action) {
    return m('button',
        {onclick: function() {
            fileAction(file.hash, action);
        }},
    action);
};

component = {
    // means we re-load the list everytime we render
    oninit: Downloads.loadStatus,
    onload: Downloads.loadStatus,
    view: function() {
        return m('div.frame', [
            m('h3', 'Downloads (' + Downloads.statusMap.size + ')'),
            m('hr'),
            m('table',
              [
                  m('tr',
                    [
                        m('th', 'Name'),
                        m('th', 'Size'),
                        m('th', 'Progress'),
                        m('th', 'Transfer rate'),
                        m('th', 'Status'),
                        m('th', 'Progress'),
                        m('th', 'Action'),
                    ]),
                  Array.from(Downloads.statusMap, function(fileStatus) {
                      let info = fileStatus[1];
                      let progress = info.transfered / info.size * 100;
                      // Using hash of file as vnode key
                      return m('tr', {key: fileStatus[0]}, 
                          [
                              m('td', info.name),
                              m('td', makeFriendlyUnit(info.size)),
                              m('td', progress.toPrecision(3) + '%'),
                              m('td', makeFriendlyUnit(info.tfRate * 1024) + '/s'),
                              m('td', info.download_status),
                              m('td', progressBar(progress)),
                              m('td',
                                  [
                                      actionButton(info, 
                                          info.downloadStatus === FT_STATE_PAUSED?
                                          'resume' : 'pause'),

                                      actionButton(info, 'cancel'),
                                  ]
                              ),
                          ]);
                  })
              ])
        ]);
    },
};

module.exports = {
    component,
};
