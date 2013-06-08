/**********************************************************************
* 
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true



/**********************************************************************
* File storage (Extension API -- CEF/PhoneGap/...)
*
* XXX need to cleanup this section...
*/


/********************************************************* Helpers ***/

// Report deferred progress
//
// This uses showStatus(...) and showErrorStatus(...) to report actions.
//
// Will use showErrorStatus(...) iff "Error" is the last argument of the
// progress/notify action, removing it (string 'Error') from the arguments.
//
// Will return the original deferred.
function statusNotify(prefix, loader, not_queued){
	var report = not_queued == true ? showStatus : showStatusQ
	if(loader == null){
		loader = prefix
		prefix = null
	}
	return loader
		.progress(function(){
			var args = Array.apply(null, arguments)
			if(prefix != null && prefix != ''){
				args.splice(0, 0, prefix)
			}
			if(args.indexOf('Error') >= 0){
				args.pop()
				return showErrorStatus(args.join(': '))
			}
			return report(args.join(': '))
		})
}


// Bubble up actions in the deferred chain
//
// Will chain progress/notify and if only_progress is not set, also
// done/resolve and fail/reject from "from" to "to" deferred objects.
//
// Will add prefix to the list of arguments of progress/notify and
// fail/reject (if not disabled), unless it is set to null.
//
// Will return "from" object.
function bubbleProgress(prefix, from, to, only_progress){
	from
		.progress(function(){ 
			var args = Array.apply(null, arguments)
			prefix != null && args.splice(0, 0, prefix)
			to.notify.apply(to, args) 
		})

	if(only_progress == null){
		from
			.done(function(){
				var args = Array.apply(null, arguments)
				to.resolve.apply(to, args) 
			})
			.fail(function(){
				var args = Array.apply(null, arguments)
				prefix != null && args.splice(0, 0, prefix)
				to.reject.apply(to, args) 
			})
	}

	return from
}


// Semi-generic deferred file loader
//
// if pattern is given, then search for the latest (ordered last) file 
// and load that.
// else load the dfl file.
//
// if diff_pattern is given, then merge all matching files in order 
// (first to last) with the loaded "main" file
//
// NOTE: if neither of dfl, pattern or diff_pattern are given, then this
// 		is essentially the same as $.getJSON(...)
// NOTE: this needs listDir(...) to search for latest versions of files.
function loadLatestFile(path, dfl, pattern, diff_pattern){
	dfl = dfl == null ? path.split(/[\/\\]/).pop() : dfl
	path = path == dfl ? '.' : path

	var res = $.Deferred()
	
	// can't find diffs if can't list dirs...
	if(window.listDir == null && (pattern != null || diff_pattern != null)){
		res.notify('Unsupported', 'directory listing.')
		return res.reject('listDir unsupported.')
	}

	// find the latest...
	if(pattern != null){
		pattern = RegExp(pattern)
		var file = $.map(listDir(path), function(e){ 
			return pattern.test(e) ? e : null
		}).sort().reverse()[0]
	}
	var file = file == null ? dfl : file
	
	var diff_data = {}
	var diff = true

	// collect and merge diffs...
	if(diff_pattern != null){
		diff_pattern = RegExp(diff_pattern)
		var diff_data = [diff_data]
		var diffs_names = $.map(listDir(path), function(e){ 
			return diff_pattern.test(e) ? e : null
		}).sort()
		diff = $.when.apply(null, $.map(diffs_names, function(e, i){
					return $.getJSON(path +'/'+ e)
						.done(function(data){
							diff_data[i+1] = data
							res.notify('Loaded', e)
						})
						.fail(function(){
							// XXX should we kill the load here???
							res.notify('Loading', e, 'Error')
						})
				}))
			// NOTE: .then(...) handlers get different signature args 
			// 		depending on the number of arguments to .when(...)...
			.then(function(){
				$.extend.apply(null, diff_data)
				diff_data = diff_data[0]
			})
	} 

	// load the main file and merge the diff with it...
	$.when(diff, $.getJSON(path +'/'+ file))
		.done(function(_, json){
			json = json[0]

			res.notify('Loaded', file)

			// merge diffs...
			if(Object.keys(diff_data).length != 0){
				$.extend(json, diff_data)
				res.notify('Merged')
			}

			res.resolve(json)
		})
		.fail(function(){
			res.notify('Loading', file, 'Error')

			return res.reject(file)
		})

	return res
}



/*********************************************************************/

// Load images from file
//
// This will also merge all diff files.
function loadFileImages(path, no_load_diffs){
	no_load_diffs = window.listDir == null ? true : no_load_diffs 

	var res = $.Deferred()

	// default locations...
	if(path == null){
		var base = normalizePath(CACHE_DIR) 
		var loader = loadLatestFile(base, 
				IMAGES_FILE_DEFAULT, 
				IMAGES_FILE_PATTERN, 
				IMAGES_DIFF_FILE_PATTERN)
	
	// explicit path...
	// XXX need to account for paths without a CACHE_DIR
	} else {
		path = normalizePath(path)
		var base = path.split(CACHE_DIR)[0]
		base += '/'+ CACHE_DIR

		// XXX is this correct???
		var loader = loadLatestFile(base, 
				path.split(base)[0], 
				RegExp(path.split(base)[0]))
	}

	bubbleProgress('Images', loader, res)

	res.done(function(images){
		IMAGES = images
	})

	return res
}


// Save current images list to file
//
// If not name is given this will merge all the diffs and save a "clean"
// (full) images.json file. Also removing the diff files.
//
// NOTE: if an explicit name is given then this will not remove anything.
// NOTE: this will uses CACHE_DIR as the location if no name is given.
function saveFileImages(name){
	var remove_diffs = (name == null)
	name = name == null ? normalizePath(CACHE_DIR +'/'+ Date.timeStamp()) : name

	if(window.dumpJSON == null){
		showErrorStatus('Can\'t save to file.')
		return
	}

	// remove the diffs...
	if(remove_diffs){
		$.each($.map(listDir(normalizePath(CACHE_DIR)), function(e){ 
				return IMAGES_DIFF_FILE_PATTERN.test(e) ? e : null
			}), function(i, e){
				showStatusQ('removeing:', e)
				removeFile(normalizePath(CACHE_DIR +'/'+ e))
			})
		IMAGES_UPDATED = []
	}

	// XXX use the pattern...
	dumpJSON(name + '-images.json', IMAGES)
	//DATA.image_file = normalizePath(name + '-images.json', null, 'relative')
}


// Load image marks form file
function loadFileMarks(path){
	var res = $.Deferred()
	// default locations...
	if(path == null){
		var base = normalizePath(CACHE_DIR)
		var loader = loadLatestFile(base, 
				MARKED_FILE_DEFAULT, 
				MARKED_FILE_PATTERN)
	
	// explicit path...
	// XXX need to account for paths without a CACHE_DIR
	} else {
		path = normalizePath(path)
		var base = path.split(CACHE_DIR)[0]
		base += '/'+ CACHE_DIR

		// XXX is this correct???
		var loader = loadLatestFile(base, 
				path.split(base)[0], 
				RegExp(path.split(base)[0]))
	}

	bubbleProgress('Marks', loader, res)

	res.done(function(images){
		MARKED = images
	})

	return res
}


// Save image marks to file
function saveFileMarks(name){
	name = name == null ? normalizePath(CACHE_DIR +'/'+ Date.timeStamp()) : name

	dumpJSON(name + '-marked.json', MARKED)
}


// Load images, ribbons and marks from cache
//
// XXX add support for explicit filenames...
function loadFileState(path, prefix){
	prefix = prefix == null ? 'Data' : prefix
	prefix = prefix === false ? null : prefix

	// XXX explicit data file path...
	if(/\.json$/i.test(path)){
		// XXX at this 
		var base = path.split(CACHE_DIR)[0]
		base = base == path ? '.' : base
	} else {
		var base = path.split(CACHE_DIR)[0]
		base = base == path ? '.' : base
	}

	var res = $.Deferred()

	bubbleProgress(prefix,
			loadLatestFile(path, 
				DATA_FILE_DEFAULT, 
				DATA_FILE_PATTERN), res, true)
		.done(function(json){
			BASE_URL = base

			// legacy format...
			if(json.version == null){
				json = convertDataGen1(json)
				DATA = json.data
				IMAGES = json.images
				MARKED = []
				reloadViewer()
				res.resolve()

			// version 2.0
			} else if(json.version == '2.0') {
				DATA = json
				$.when(
						// XXX load config...
						// load images...
						bubbleProgress(prefix,
							loadFileImages(DATA.image_file == null ?
									normalizePath(DATA.image_file, base) 
									: null), res, true),
						// load marks if available...
						bubbleProgress(prefix,
							loadFileMarks(), res, true))
					.done(function(){
						reloadViewer()
						res.resolve()
					})
					// XXX fail???

			// unknown format...
			} else {
				res.reject('unknown format.')
			}
		})
		.fail(function(){
			res.reject('Loading', path, 'Error')
		})

	return res
}


// Save, ribbons and marks to cache
//
// NOTE: this will NOT save images, that operation must be explicitly 
// 		performed by saveFileImages(...)
function saveFileState(name, no_normalize_path){
	name = name == null ? Date.timeStamp() : name

	if(!no_normalize_path){
		name = normalizePath(CACHE_DIR +'/'+ name)

	// write .image_file only if saving data to a non-cache dir...
	// XXX check if this is correct...
	} else {
		if(DATA.image_file == null){
			DATA.image_file = name + '-images.json'
		}
	}

	dumpJSON(name + '-data.json', DATA)
	// XXX do we need to do this???
	saveFileMarks(name)

	// save the updated images...
	if(IMAGES_UPDATED.length > 0){
		var updated = {}
		$.each(IMAGES_UPDATED, function(i, e){
			updated[e] = IMAGES[e]
		})
		dumpJSON(name + '-images-diff.json', updated)
		IMAGES_UPDATED = []
	}
}


// Load a directory as-is
//
// XXX check if we need to pass down sorting settings to the generators...
function loadRawDir(path, prefix){
	prefix = prefix == null ? 'Data' : prefix
	prefix = prefix === false ? null : prefix

	var files = listDir(path)

	var res = $.Deferred()

	var image_paths = $.map(files, function(e){
		return IMAGE_PATTERN.test(e) ? e : null
	})

	if(image_paths.length == 0){
		// no images in path...
		res.notify(prefix, 'Load', path, 'Error')
		return res.reject()
	}

	BASE_URL = path

	IMAGES = imagesFromUrls(image_paths)
	res.notify(prefix, 'Loaded', 'Images.')

	DATA = dataFromImages(IMAGES)
	res.notify(prefix, 'Loaded', 'Data.')

	updateRibbonsFromFavDirs()
	res.notify(prefix, 'Loaded', 'Fav dirs.')

	MARKED = []

	reloadViewer()

	return res.resolve()
}


// Load a path
//
// This will try and do one of the following in order:
// 	1) look for a cache and load it,
// 	2) load data from within the directory
// 	3) load a directory as-is
// 		load fav dirs
//
function loadDir(path, prefix){
	prefix = prefix == null ? 'Data' : prefix
	prefix = prefix === false ? null : prefix

	path = normalizePath(path)
	var orig_path = path
	var data

	var res = $.Deferred()

	res.notify(prefix, 'Loading', path)

	var files = listDir(path)

	if(files == null){
		//showErrorStatus('No files in path: ' + path)
		res.notify('load_error', path)
		return res.reject()
	}

	// see if there is a cache...
	if(files.indexOf(CACHE_DIR) >= 0){
		path = path +'/'+ CACHE_DIR
	}

	bubbleProgress(prefix, 
			loadFileState(path, false), res, true)
		.done(function(){
			res.resolve()
		})
		.fail(function(){
			bubbleProgress('Raw directory', loadRawDir(orig_path), res)
		})

	return res
}


// Load ribbon structure from fav directory tree
//
// XXX loads duplicate images....
function updateRibbonsFromFavDirs(){
	DATA.ribbons = ribbonsFromFavDirs(null, null, imageOrderCmp)
	sortImagesByDate()
	reloadViewer()
}



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
