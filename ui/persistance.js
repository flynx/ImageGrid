/*
 * Here we will need several levels of storage:
 * 	- state
 * 	  this can be anything including file or localstorage.
 * 	  this is stored in a unified location.
 * 	  global per user/instance
 * 	- progress
 * 	  this is stored in file location as local config file.
 *
 */

function loadJSONfile(path, escape_urls){
	if(escape_urls == null){
		escape_urls = true
	}
	// XXX CEF (file) - binding
	if(CEF_loadJSON != null){
		var data = CEF_loadJSON(path)
	}
	// XXX PhoneGap (file) - binding
	// XXX browser - open file dialog
	
	// escape the URLs...
	if(escape_urls == true){
		var ribbons = data.ribbons	
		for(var i=0; i<ribbons.length; i++){
			var images = ribbons[i]
			for(var id in images){
				var image = images[id]
				// escape the url ...
				var o = /([a-zA-Z0-9]*:)(.*)/.exec(image.url)
				if(o.length == 3){
					image.url = o[1] + escape(o[2])
				} else {
					console.log('no schema...')
					image.url = escape(image.url)
				}
			}
		}
	}
	return data
}

function dumpJSONfile(path, value){
	// XXX CEF (file) - binding
	if(CEF_dumpJSON != null){
		return CEF_dumpJSON(path, value)
	}
	// XXX PhoneGap (file) - binding
	// XXX browser - download file dialog
}


