var m = require("mithril");
var rs = require("rswebui");

function makeFriendlyUnit(bytes)
{
	if(bytes < 1e3)
		return bytes.toFixed(1) + "B";
	if(bytes < 1e6)
		return (bytes/1e3).toFixed(1) + "kB";
	if(bytes < 1e9)
		return (bytes/1e6).toFixed(1) + "MB";
	if(bytes < 1e12)
		return (bytes/1e9).toFixed(1) + "GB";
	return (bytes/1e12).toFixed(1) + "TB";
}

function progressBar(file){
    return m("div[style=border:5px solid lime;"
        + 'border-radius:3mm;'
        + 'padding:2mm;'
        + 'height:5mm'
	+ "]", [
	m("div[style="
	    + 'background-color:lime;'
	    + 'height:100%;'
	    + 'width:' + (file.transfered  /  file.size * 100)+'%'
	    + ']'
	,"")
	]);
};

function cntrlBtn(file, act) {
    return(
        m("div.btn",{
            onclick: function(){
                console.log("Control button pushed. Action on file " + file.hash + " is " + act);

                rs.Downloads.control(file.hash,act) ;
            }
        },
        act)
    )
}

module.exports = {
    oninit: rs.Downloads.load(), 	// means we re-load the list everytime we render
    onload: rs.Downloads.load(), 	// means we re-load the list everytime we render
    view:  function() {
		var filestreamer_url = "/fstream/";

        var paths = rs.Downloads.list ;	// after that, paths is a list of FileInfo structures

		if (paths === undefined) {
			return m("div", "Downloads ... please wait ...");
		}

        console.log("List size=" + rs.Downloads.list.length+"\n");
        console.log("List [0]=" + rs.Downloads.list[0]+"\n");

		return m("div",  [
					m("h2","Downloads (" + paths.length +")"),
				 	m("div.btn2",
                      {
					  	 onclick: function(){
							   m.route("/downloads/add");
					   		},
                      }, "add retrohare downloads"),

					   m("hr"),
					   m('table', [
							 m("tr",[
								   m("th","name"),
								   m("th","size"),
								   m("th","progress"),
								   m("th","transfer rate"),
								   m("th","status"),
								   m("th","progress"),
								   m("th","action")
							   ]),
							 paths.map(function (fileInfo){
								 var ctrlBtn = m("div","");
								 var progress = fileInfo.transfered  /  fileInfo.size * 100;

								 console.log("dl status="+fileInfo.downloadStatus + " paused_state="+rs.FT_STATE_PAUSED);
								 return m("tr",[
											  m("td",[
													m("a.filelink",
													  {
														  target: "blank",
														  href: filestreamer_url + fileInfo.hash + "/" + encodeURIComponent(fileInfo.fname)
													  },
													  fileInfo.fname
													  )
												]),
											  m("td", makeFriendlyUnit(fileInfo.size)),
											  m("td", progress.toPrecision(3) + "%"),
											  m("td", makeFriendlyUnit(fileInfo.tfRate*1024)+"/s"),
											  m("td", fileInfo.download_status),
											  m("td", progressBar(fileInfo)),
											  m("td", [
													cntrlBtn(fileInfo, fileInfo.downloadStatus===rs.FT_STATE_PAUSED?"resume":"pause"),
													cntrlBtn(fileInfo, "cancel")]
												)
										  ])
							 })
						 ])
				 ]);
	}
};


