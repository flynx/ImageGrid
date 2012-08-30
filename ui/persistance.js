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

function loadJSONfile(path){
	// XXX CEF (file) - binding
	if(CEF_loadJSON != null){
		return CEF_loadJSON(path)
	}
	// XXX PhoneGap (file) - binding
	// XXX browser - open file dialog
}

function dumpJSONfile(path, value){
	// XXX CEF (file) - binding
	if(CEF_dumpJSON != null){
		return CEF_dumpJSON(path, value)
	}
	// XXX PhoneGap (file) - binding
	// XXX browser - download file dialog
}


