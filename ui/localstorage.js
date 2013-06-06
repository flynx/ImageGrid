/**********************************************************************
* 
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true


/**********************************************************************
* localStorage
*
* XXX should we use jStorage here?
*/

function loadLocalStorageData(attr){
	attr = attr == null ? DATA_ATTR : attr
	var data = localStorage[attr]
	if(data == null){
		data = '{}'
	}
	var base = localStorage[attr + '_BASE_URL']
	base = base == null ? '.' : base
	return {
		data: JSON.parse(data),
		base_url: base,
	}
}
function saveLocalStorageData(attr){
	attr = attr == null ? DATA_ATTR : attr
	localStorage[attr] = JSON.stringify(DATA)
	localStorage[attr + '_BASE_URL'] = BASE_URL
}


function loadLocalStorageImages(attr){
	attr = attr == null ? DATA_ATTR : attr
	attr += '_IMAGES'
	var images = localStorage[attr]
	if(images == null){
		images = '{}'
	}
	return JSON.parse(images)
}
function saveLocalStorageImages(attr){
	attr = attr == null ? DATA_ATTR : attr
	attr += '_IMAGES'
	localStorage[attr] = JSON.stringify(IMAGES)
}


function loadLocalStorageMarks(attr){
	attr = attr == null ? DATA_ATTR : attr
	attr += '_MARKED'
	var marked = localStorage[attr]
	if(marked == null){
		marked = '[]'
	}
	MARKED = JSON.parse(marked)
	return reloadViewer()
}
function saveLocalStorageMarks(attr){
	attr = attr == null ? DATA_ATTR : attr
	attr += '_MARKED'
	localStorage[attr] = JSON.stringify(MARKED)
}


function loadLocalStorageSettings(attr){
	attr = attr == null ? DATA_ATTR : attr
	attr += '_SETTINGS'
	SETTINGS = JSON.parse(localStorage[attr])

	loadSettings()
}
function saveLocalStorageSettings(attr){
	attr = attr == null ? DATA_ATTR : attr
	attr += '_SETTINGS'
	localStorage[attr] = JSON.stringify(SETTINGS)
}


// generic save/load...
function loadLocalStorage(attr){
	attr = attr == null ? DATA_ATTR : attr
	var d = loadLocalStorageData(attr)
	BASE_URL = d.base_url
	DATA = d.data
	IMAGES = loadLocalStorageImages(attr)
	return reloadViewer()
}
function saveLocalStorage(attr){
	attr = attr == null ? DATA_ATTR : attr
	saveLocalStorageData(attr)
	saveLocalStorageImages(attr)
}



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
