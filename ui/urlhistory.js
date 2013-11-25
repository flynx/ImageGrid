/**********************************************************************
* 
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true


/*********************************************************************/

var BASE_URL_HISTORY = []
var BASE_URL_LIMIT = 10



/**********************************************************************
* URL history...
*/

// Setup history event handlers...
//
// NOTE: this will save history state to localStorage...
function setupBaseURLHistory(){
	$('.viewer')
		.on('baseURLChanged', function(evt, old_url, new_url){
			var updated = false

			// store the old and new urls in history unless they already
			// exist...
			if(BASE_URL_HISTORY.indexOf(old_url) < 0){
				BASE_URL_HISTORY.splice(0, 0, old_url)
				updated = true
			}
			if(BASE_URL_HISTORY.indexOf(new_url) < 0){
				BASE_URL_HISTORY.splice(0, 0, new_url)
				updated = true
			}

			// truncate the history if needed...
			if(BASE_URL_HISTORY.length > BASE_URL_LIMIT){
				BASE_URL_HISTORY.splice(BASE_URL_LIMIT, BASE_URL_HISTORY.length)
				updated = true
			}

			// XXX is this the right place for this???
			if(updated){
				saveLocalStorageBaseURLHistory()	
			}
		})
}


// Push a url to top of history...
//
// NOTE: this does not care if a url exists or not, all other instances 
// 		will get removed...
// NOTE: this will not do any loading...
// NOTE: this will save history state to localStorage...
function pushURLHistory(url){
	url = url == null ? BASE_URL : url

	while(BASE_URL_HISTORY.indexOf(url) >= 0){
		BASE_URL_HISTORY.splice(BASE_URL_HISTORY.indexOf(url), 1)
	}

	BASE_URL_HISTORY.splice(0, 0, url)

	// XXX is this the right place for this???
	saveLocalStorageBaseURLHistory()	

	return url
}


// Get current position in history...
//
function getURLHistoryPosition(){
	return BASE_URL_HISTORY.indexOf(BASE_URL)
}


// Get next/prev relative position in history...
//
function getURLHistoryNext(){
	var res = BASE_URL_HISTORY[ getURLHistoryPosition() - 1]
	return res == null ? BASE_URL : res
}
function getURLHistoryPrev(){
	var res = BASE_URL_HISTORY[ getURLHistoryPosition() + 1 ]
	return res == null ? BASE_URL : res
}



/**********************************************************************
* Actions...
*/

// Make a history load action...
//
// NOTE: this will not affect history url order...
function makeURLHistoryLoader(get, end_msg){
	return function(){
		var url = get()
		if(url != BASE_URL){
			statusNotify(loadDir(url))
		} else {
			showStatusQ('History: '+ end_msg +'...')
		}
		return url
	}
}
var loadURLHistoryNext = makeURLHistoryLoader(getURLHistoryNext, 'at last URL')
var loadURLHistoryPrev = makeURLHistoryLoader(getURLHistoryPrev, 'at first URL')



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
