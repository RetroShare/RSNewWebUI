"use strict";

var m = require("mithril");

var rsJsonApiUrl = "http://127.0.0.1:9092"
var loginKey = {    
                    username: "",
                    passwd: "",
                };

function rsJsonApiRequest(path, data, callback, async, failCallback)
{
	console.log("rsJsonApiRequest(path, data, callback)", path, data, callback)
		var xhr = new XMLHttpRequest();
	xhr.onreadystatechange = function()
	{
		if(xhr.readyState === 4)
		{
			console.log( path, "callback", xhr.status, xhr.responseText.replace(/\s+/g, " ").substr(0, 60).replace(/\r?\n|\r/g," ") )
                        if(xhr.status === 200)
                        {
			        if(typeof(callback) === "function") callback(xhr.responseText);
                        }
                        else
                                if(typeof(failCallback) === "function") failCallback(xhr.status);
		}
	}
	xhr.open('POST', rsJsonApiUrl + path, async);
	xhr.setRequestHeader("Accept", "application/json");
	xhr.setRequestHeader("Authorization", "Basic "+btoa(loginKey.username + ":" + loginKey.passwd));
	xhr.send(data);
}

function validateLogin(username, password, callback) {
    var xhr = new XMLHttpRequest();
	xhr.onreadystatechange = function() {
		if(xhr.readyState === 4) {

                    if(xhr.status === 200) {
                        loginKey.username = username;
                        loginKey.passwd = password;
                        callback(true);
                    }
                    else
                        callback(false);
                    
		}
	}
	xhr.open('POST', rsJsonApiUrl +  "/rsPeers/GetRetroshareInvite", true);
	xhr.setRequestHeader("Accept", "application/json");
	xhr.setRequestHeader("Authorization", "Basic "+btoa(username + ":" + password));
	xhr.send("");
}

// These constants are the onces listed in retroshare/rsfiles.h. I would like to make them "members" of Downloads
// but I dont know how to do this.

var RS_FILE_CTRL_PAUSE		= 0x00000100;
var RS_FILE_CTRL_START		= 0x00000200;
var RS_FILE_CTRL_FORCE_CHECK= 0x00000400;

var	FT_STATE_FAILED			= 0x0000 ;
var	FT_STATE_OKAY			= 0x0001 ;
var	FT_STATE_WAITING 		= 0x0002 ;
var	FT_STATE_DOWNLOADING	= 0x0003 ;
var	FT_STATE_COMPLETE 		= 0x0004 ;
var	FT_STATE_QUEUED   		= 0x0005 ;
var	FT_STATE_PAUSED   		= 0x0006 ;
var	FT_STATE_CHECKING_HASH	= 0x0007 ;

var Downloads = {
    list: [],

    // Load function for files. Populates the "list" array with Objects of type corresponding to rsfiles.h:FileInfo

    load: function() {
		function addDLInfo(p)
        {
            var jsonData = JSON.parse(p)

            if(jsonData.retval === "false")
                console.warning("Cannot retrieve info!!");

            console.log("adding "+jsonData.info.hash + ": size=" + jsonData.info.size + ": progress=" + jsonData.info.avail + "\n");

            Downloads.list.push(jsonData.info);
        }

        function requestDLData(hash)
		{
            var json_params = {
                hash: hash,
                hintflags: 16		// = RS_FILE_HINTS_DOWNLOAD
            }
            console.log("requesting DL data for hash: "+hash)
			rsJsonApiRequest("/rsFiles/FileDetails", JSON.stringify(json_params), addDLInfo,false)
        }
		function handleHashesList(p)
        {
            var jsonData = JSON.parse(p)

            // now for each hash, request the current progress
            jsonData.hashs.forEach(requestDLData);
        }
        Downloads.list = [];
		console.log("requesting downloads...");

		rsJsonApiRequest("/rsFiles/FileDownloads", "", handleHashesList,false)
    },

    // Control function for files. Hash is the file hash and control_action is the action to perform to be chosen as { "cancel", "pause", "resume" }

    control: function(hash,control_action){
        var req_action = "" ;						// action requested to jsonapi
        var json_params = { hash: hash,flags: 0 } ;	// params for that action

        switch(control_action)
        {
			case "cancel":  req_action = "/rsFiles/FileCancel" ;
                			break;

            case "pause":   req_action = "/rsFiles/FileControl" ;
                			json_params.flags = RS_FILE_CTRL_PAUSE ;
                			break ;

            case "resume":  req_action = "/rsFiles/FileControl" ;
                			json_params.flags = RS_FILE_CTRL_START ;
                			break ;

            case "force_check":  req_action = "/rsFiles/FileControl" ;
                			json_params.flags = RS_FILE_CTRL_FORCE_CHECK ;
                			break ;

            default:
                console.log("Unknown action in Downloads.control()");
                return ;
        };

		rsJsonApiRequest(req_action, JSON.stringify(json_params),false)
    }
}

module.exports = {
    requestCertificate:function(callback) {

		function setNodeCertificate(p)
		{
			var jsonData = JSON.parse(p)
            callback(jsonData.retval)
		}
		rsJsonApiRequest("/rsPeers/GetRetroshareInvite", "", setNodeCertificate,true)
	},
    validateLogin,

    Downloads,

	RS_FILE_CTRL_PAUSE		,
	RS_FILE_CTRL_START		,
	RS_FILE_CTRL_FORCE_CHECK,

	FT_STATE_FAILED			,
	FT_STATE_OKAY			,
	FT_STATE_WAITING 		,
	FT_STATE_DOWNLOADING	,
	FT_STATE_COMPLETE 		,
	FT_STATE_QUEUED   		,
	FT_STATE_PAUSED   		,
	FT_STATE_CHECKING_HASH	,
};


