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

function loadLocalStorageBaseURL(attr){
	attr = attr == null ? DATA_ATTR : attr
	setBaseURL(localStorage[attr + '_BASE_URL'])
}
function saveLocalStorageBaseURL(attr){
	attr = attr == null ? DATA_ATTR : attr
	localStorage[attr + '_BASE_URL'] = getBaseURL()
}


function loadLocalStorageBaseURLHistory(attr){
	attr = attr == null ? DATA_ATTR : attr
	BASE_URL_HISTORY = JSON.parse(localStorage[attr + '_BASE_URL_HISTORY'])
	return BASE_URL_HISTORY
}
function saveLocalStorageBaseURLHistory(attr){
	attr = attr == null ? DATA_ATTR : attr
	localStorage[attr + '_BASE_URL_HISTORY'] = JSON.stringify(BASE_URL_HISTORY)
}


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

	var data = getAllData()
	data.current = DATA.current

	localStorage[attr] = JSON.stringify(data)
	saveLocalStorageBaseURL(attr)
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
	loadLocalStorageBaseURLHistory(attr)
	setBaseURL(d.base_url)
	DATA = d.data
	IMAGES = loadLocalStorageImages(attr)
	return reloadViewer()
}
function saveLocalStorage(attr){
	attr = attr == null ? DATA_ATTR : attr
	saveLocalStorageData(attr)
	saveLocalStorageImages(attr)
	saveLocalStorageBaseURLHistory()
}



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
