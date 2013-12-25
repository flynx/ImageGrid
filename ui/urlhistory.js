/**********************************************************************
* 
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true


/*********************************************************************/

var BASE_URL_HISTORY = []
var BASE_URL_LIMIT = 15



/**********************************************************************
* URL history...
*/

// XXX this depends on fs.existsSync(...)
function pruneBaseURLHistory(){
	if(window.fs == null){
		return BASE_URL_HISTORY
	}
	BASE_URL_HISTORY = BASE_URL_HISTORY.filter(function(e){
		return fs.existsSync(osPath(e))
	})
	return BASE_URL_HISTORY
}


function getNonExistingBaseURLs(){
	if(window.fs == null){
		return BASE_URL_HISTORY
	}
	return BASE_URL_HISTORY.filter(function(e){
		return !fs.existsSync(osPath(e))
	})
}


// Setup history event handlers...
//
// NOTE: this will save history state to localStorage...
function setupBaseURLHistory(){
	$('.viewer')
		.on('baseURLChanged', function(evt, old_url, new_url){
			var updated = false

			//pruneBaseURLHistory()

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
	var non_existing = getNonExistingBaseURLs()
	var i = getURLHistoryPosition() + 1 
	var res = BASE_URL_HISTORY[i]
	while(non_existing.indexOf(res) >= 0){
		i += 1
		var res = BASE_URL_HISTORY[i]
	}
	return res == null ? BASE_URL : res
}
function getURLHistoryPrev(){
	var non_existing = getNonExistingBaseURLs()
	var i = getURLHistoryPosition() - 1 
	var res = BASE_URL_HISTORY[i]
	while(non_existing.indexOf(res) >= 0){
		i -= 1
		var res = BASE_URL_HISTORY[i]
	}
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


// NOTE: this can accept either path or history index...
// NOTE: this will not reload an already loaded url...
//
// XXX need to somehow skip unavailable urls...
function loadURLHistoryAt(a){
	a = a < 0 ? BASE_URL_HISTORY.length + a : a
	var url = typeof(a) == typeof(123) ? Math.min(a < 0 ? 0 : a, BASE_URL_HISTORY.length-1) : a
	if(url != BASE_URL){
		statusNotify(loadDir(url))
	}
	return url
}



/**********************************************************************
* Dialogs...
*/

function recentlyOpenedDialog(){

	updateStatus('Recently opened...').show()

	var dict = {}
	var title = '<b>Recently opened:</b> | '+
		'Shortcuts ctrl-shift-Left and ctrl-shift-Right can be used\n'+
		'to move through this list from ribbon view.'

	var not_available = getNonExistingBaseURLs()

	var cfg = {}
	cfg[title] = BASE_URL_HISTORY.map(function(e){
		// cleanup the urls...
		var ee = e.replace('file:///', '')
		var disabled = not_available.indexOf(e) >= 0

		// mark disabled...
		if(disabled){
			ee = '<span class="disabled-text">'+ee+'</span>'
			if(e == BASE_URL){
				dict[ee] = e
				return ee + ' | disabled | Currently loaded, path not available.'

			} else {
				dict[ee] = e
				return ee + ' | disabled | Not available.'
			}

		// mark the current path...
		} else if(e == BASE_URL){
			ee = ee.italics()
			dict[ee] = e
			return ee + ' | default | Currently loaded data.'
		}

		dict[ee] = e
		return ee
	})

	if(not_available.length > 0){
		cfg['spacer'] = '---'
		cfg[''] = {
			text: 'Clear unavailable paths',
			button: function(){
				pruneBaseURLHistory()
				saveLocalStorageBaseURLHistory()
				$('.recentlyOpenedDialog')
					.find('.item.disabled')
						.remove()
			},
		}
	}

	var dialog = formDialog(null, '', 
			cfg,
			'OK', 
			'recentlyOpenedDialog')
		.done(function(res){
			res = dict[res[title]]

			loadURLHistoryAt(res)

			if(res == BASE_URL){
				showStatusQ('Already at: '+res+'...')
			} else {
				showStatusQ('Opening: '+res+'...')
			}
		})
		.fail(function(){
			showStatusQ('Keeping current...')
		})
}



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
