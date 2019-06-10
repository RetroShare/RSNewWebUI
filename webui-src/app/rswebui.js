'use strict';

var m = require('mithril');

const API_URL = 'http://127.0.0.1:9092';
let loginKey = {
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
    setKeys,
};

