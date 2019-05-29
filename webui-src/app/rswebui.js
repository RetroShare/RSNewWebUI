'use strict';

var m = require('mithril');

const API_URL = 'http://127.0.0.1:9092';
var loginKey = {
    username: '',
    passwd: '',
    isVerified: false,
};

function setKeys(username, password, verified = true) {
    loginKey.username = username;
    loginKey.passwd = password;
    loginKey.isVerified = verified;
}

function rsJsonApiRequest(path, data, callback, async = true, headers = {}) {
    // retroshare will crash if data is not of object type.
    console.log(
        'rsJsonApiRequest(path, data, callback):', path, data, callback);
    headers['Accept'] = 'application/json';
    if (loginKey.isVerified) {
        headers['Authorization'] =
            'Basic ' + btoa(loginKey.username + ':' + loginKey.passwd);
    }
    m.request({
         method: 'POST',
         url: API_URL + path,
         async: async,
         extract: (xhr) => {
             // empty string is not valid json and fails on parse
             if (xhr.responseText === '') xhr.responseText = '""';
             return {
                 status: xhr.status,
                 body: JSON.parse(xhr.responseText),
             };
         },
         headers: headers,
         data: data,
     })
        .then((result) => {
            // console.log("request success:", path, "callback", result.status,
            // result.body.replace(/\s+/g, " ").substr(0,
            // 60).replace(/\r?\n|\r/g," ") );
            if (typeof(callback) === 'function') {
                if (result.status === 200) {
                    callback(result.body, true);
                } else {
                    loginKey.isVerified = false;
                    callback(result.body, false);
                }
            }
        })
        .catch(function(e) {
            callback({}, false);
            console.log('Error sending request: ', e);
        });
}

// These constants are the onces listed in retroshare/rsfiles.h. I would like to
// make them "members" of Downloads but I dont know how to do this.

var RS_FILE_CTRL_PAUSE = 0x00000100;
var RS_FILE_CTRL_START = 0x00000200;
var RS_FILE_CTRL_FORCE_CHECK = 0x00000400;

var FT_STATE_FAILED = 0x0000;
var FT_STATE_OKAY = 0x0001;
var FT_STATE_WAITING = 0x0002;
var FT_STATE_DOWNLOADING = 0x0003;
var FT_STATE_COMPLETE = 0x0004;
var FT_STATE_QUEUED = 0x0005;
var FT_STATE_PAUSED = 0x0006;
var FT_STATE_CHECKING_HASH = 0x0007;

var Downloads = {
    list: [],

    // Load function for files. Populates the "list" array with Objects of type
    // corresponding to rsfiles.h:FileInfo

    load: function() {
        function addDLInfo(p) {
            var jsonData = p;

            if (jsonData.retval === 'false')
                console.warning('Cannot retrieve info!!');

            console.log(
                'adding ' + jsonData.info.hash +
                ': size=' + jsonData.info.size +
                ': progress=' + jsonData.info.avail + '\n');

            Downloads.list.push(jsonData.info);
        }

        function requestDLData(hash) {
            var json_params = {
                hash: hash,
                hintflags: 16  // = RS_FILE_HINTS_DOWNLOAD
            };
            console.log('requesting DL data for hash: ' + hash);
            rsJsonApiRequest(
                '/rsFiles/FileDetails', json_params, addDLInfo, false);
        }
        function handleHashesList(p) {
            var jsonData = p;
            // now for each hash, request the current progress
            jsonData.hashs.forEach(requestDLData);
        }
        Downloads.list = [];
        console.log('requesting downloads...');
        rsJsonApiRequest('/rsFiles/FileDownloads', {}, handleHashesList, false);
    },

    // Control function for files. Hash is the file hash and control_action is
    // the action to perform to be chosen as { "cancel", "pause", "resume" }

    control: function(hash, control_action) {
        var req_action = '';  // action requested to jsonapi
        var json_params = {hash: hash, flags: 0};  // params for that action

        switch (control_action) {
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
        rsJsonApiRequest(req_action, json_params, null, false);
    },
};

module.exports = {
    requestCertificate: function(callback) {
        function setNodeCertificate(p) {
            var jsonData = p;
            callback(jsonData.retval);
        }
        rsJsonApiRequest(
            '/rsPeers/GetRetroshareInvite', {}, setNodeCertificate, true);
    },

    rsJsonApiRequest,
    Downloads,
    setKeys,

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
};

