"use strict";

var m = require("mithril");

var rsJsonApiUrl = "http://127.0.0.1:9092"
function rsJsonApiRequest(path, data, callback,async)
{
	console.log("rsJsonApiRequest(path, data, callback)", path, data, callback)
		var xhr = new XMLHttpRequest();
	xhr.onreadystatechange = function()
	{
		if(xhr.readyState === 4)
		{
			console.log( path, "callback", xhr.status, xhr.responseText.replace(/\s+/g, " ").substr(0, 60).replace(/\r?\n|\r/g," ") )
			if(typeof(callback) === "function") callback(xhr.responseText);
		}
	}
	xhr.open('POST', rsJsonApiUrl + path, async);
	xhr.setRequestHeader("Accept", "application/json");
	xhr.setRequestHeader("Authorization", "Basic "+btoa("cyril"+":"+"proutprout233"));
	xhr.send(data);
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

    requestDownloads:function(callback) {

        var downloads_info = ""

        function displayDLInfo(p)
        {
            var jsonData = JSON.parse(p)

            if(jsonData.retval === "false")
                console.warning("Cannot retrieve info!!");

            downloads_info += jsonData.info.hash + ": size=" + jsonData.info.size + ": progress=" + jsonData.info.avail + "\n";
        }
        function requestDLData(hash)
		{
            var json_params = {
                hash: hash,
                hintflags: 16		// = RS_FILE_HINTS_DOWNLOAD
            }
            console.log("requesting DL data for hash: "+hash)
			rsJsonApiRequest("/rsFiles/FileDetails", JSON.stringify(json_params), displayDLInfo,false)
        }

        function setDownloads(p)
        {
            var jsonData = JSON.parse(p)

            // now for each hash, request the current progress

            jsonData.hashs.forEach(requestDLData);

            // and send back the result

            callback(downloads_info);
        }
		rsJsonApiRequest("/rsFiles/FileDownloads", "", setDownloads,true)
    }
};


