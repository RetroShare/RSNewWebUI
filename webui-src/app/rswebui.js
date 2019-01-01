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
		rsJsonApiRequest("/rsPeers/GetRetroshareInvite", "", setNodeCertificate,true)	// call is synced because we want to return the result
	}
};


