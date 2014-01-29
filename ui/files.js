/**********************************************************************
* 
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true

// Flag indicating a new image file was constructed...
// XXX do we need this?
var IMAGES_CREATED = false

var IMAGE_PATTERN = /.*\.(jpg|jpeg|png|gif)$/i

var FILE_LOADERS = []
var FILE_SAVERS = {}
var FILES_UPDATED = []



/**********************************************************************
* File storage (Extension API -- CEF/PhoneGap/...)
*
* XXX need to cleanup this section...
*/


/********************************************************* Helpers ***/

function makeBaseFilename(base, ext){
	ext = ext == null ? CONFIG.json_ext : ext

	return CONFIG.base_file_pattern
		.replace('${BASE}', base)
		.replace('${EXT}', ext)
}
function makeFilename(base, date, ext){
	date = date == null ? Date.timeStamp() : date
	ext = ext == null ? CONFIG.json_ext : ext

	return CONFIG.file_pattern
			.replace('${DATE}', date)
			.replace('${BASE}', base)
			.replace('${EXT}', ext)
}
function makeFilenamePattern(base, ext){
	return RegExp(makeFilename(base, '^[0-9]*', ext)+'$')
}

function makeDiffFilename(base, date, diff, ext){
	date = date == null ? Date.timeStamp() : date
	diff = diff == null ? CONFIG.diff_suffix : diff
	ext = ext == null ? CONFIG.json_ext : ext

	return CONFIG.diff_file_pattern
			.replace('${DATE}', date)
			.replace('${BASE}', base)
			.replace('${DIFF_SUFIX}', diff)
			.replace('${EXT}', ext)
}
function makeDiffFilePattern(base, diff, ext){
	return RegExp(makeDiffFilename(base, '^[0-9]*', ext)+'$')
}


// Report deferred progress
//
// This uses showStatus(...) and showErrorStatus(...) to report actions.
//
// Will use showErrorStatus(...) iff "Error" is the last argument of the
// progress/notify action, removing it (string 'Error') from the arguments.
//
// Will return the original deferred.
function statusNotify(prefix, loader, not_queued){
	not_queued = not_queued == null ? true : not_queued
	var report = not_queued == true ? showStatus : showStatusQ
	if(loader == null){
		loader = prefix
		prefix = null
	}
	return loader
		.progress(function(){
			var args = $.makeArray(arguments)

			var getter = args[args.length-1]
			if(getter != null && getter.isResolved != null){
				args.pop()
					.done(function(){
						report(args.join(': '))
					})
					.fail(function(){
						showErrorStatus(args.join(': '))
					})
				return
			}

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


// XXX
function statusProgress(msg, tracker){
	tracker = tracker == null ? $.Deferred() : null

	var progress = progressBar(msg)
	var total = 0
	var done = 0

	return tracker
		.done(function(){
			// XXX why does this close the progress bar right away???
			closeProgressBar(progress)
		})
		.progress(function(){
			var args = $.makeArray(arguments)
			var getter = args[args.length-1]
			total += 1

			// the getter is a deferred...
			if(getter != null && getter.isResolved != null){
				args.pop()
					.always(function(){
						done += 1
						updateProgressBar(progress, done, total)
					})

			// no getter...
			} else {
				done += 1
			}

			updateProgressBar(progress, done, total)
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
	only_progress = only_progress == null ? false : only_progress

	from
		.progress(function(){ 
			var args = $.makeArray(arguments)
			prefix != null && args.splice(0, 0, prefix)
			to.notify.apply(to, args) 
		})

	if(!only_progress){
		from
			.done(function(){
				var args = $.makeArray(arguments)
				to.resolve.apply(to, args) 
			})
			.fail(function(){
				var args = $.makeArray(arguments)
				prefix != null && args.splice(0, 0, prefix)
				to.reject.apply(to, args) 
			})
	}

	return from
}


// Semi-generic deferred JSON file loader
//
// if pattern is given, then search for the latest (ordered last) file 
// and load that.
// else load the dfl file.
//
// if diff_pattern is given, then merge all matching files in order 
// (first to last) with the loaded "main" file
//
// if default_data is then not finding a file will not fail, instead the
// default_data will be the resolved data.
//
// NOTE: if diffs are available this expects the file to contain an object,
// 		and will extend ($.extend(..)) that object.
// NOTE: if neither of dfl, pattern or diff_pattern are given, then this
// 		is essentially the same as $.getJSON(...)
// NOTE: this needs listDir(...) to search for latest versions of files.
function loadLatestJSONFile(path, dfl, pattern, diff_pattern, default_data, tracker){
	var pparts = path.split(/[\/\\]/)
	dfl = dfl == null ? pparts.pop() : dfl
	//path = path == dfl ? '.' : path
	path = pparts.join('/')

	var res = $.Deferred()
	
	if(dfl == ''){
		return res.reject()
	}

	// can't find diffs if can't list dirs...
	if(window.listDir == null && (pattern != null || diff_pattern != null)){
		return res.reject('listDir unsupported.')
	}

	var file_list = null

	// find the latest...
	if(pattern != null){
		file_list = listDir(path)
		pattern = RegExp(pattern)
		var file = $.map(file_list, function(e){ 
			return pattern.test(e) ? e : null
		}).sort().reverse()[0]
	}
	var file = file == null ? dfl : file
	var base_date = file.split('-')[0]
	base_date = base_date == file ? '' : base_date
	
	var diff_data = {}
	var diff = true

	// collect and merge diffs...
	if(diff_pattern != null){
		file_list = file_list == null ? listDir(path) : file_list
		diff_pattern = RegExp(diff_pattern)
		var diff_data = [diff_data]
		var diffs_names = $.map(file_list, function(e){ 
			return diff_pattern.test(e) && e.split('-')[0] >= base_date ? e : null
		}).sort()
		diff = $.when.apply(null, $.map(diffs_names, function(e, i){
					var getter = $.getJSON(path +'/'+ e)
						.done(function(data){
							// NOTE: we are not using push here so as to
							// 		keep the sort order...
							diff_data[i+1] = data
						})
						.always(function(){
							res.notify(e, getter)
						})

					tracker != null && tracker.notify(e, getter)

					return getter
				}))
			// merge the diffs...
			// NOTE: .then(...) handlers get different signature args 
			// 		depending on the number of arguments to .when(...)...
			.then(function(){
				$.extend.apply(null, diff_data)
				diff_data = diff_data[0]
			})
	} 

	// load the main file and merge the diff with it...
	var getter = $.getJSON(path +'/'+ file)
		.always(function(){
			res.notify(file, getter)
			tracker != null && tracker.notify(file, getter)
		})
	$.when(diff, getter)
		.done(function(_, json){
			json = json[0]

			// merge diffs...
			if(Object.keys(diff_data).length != 0){
				$.extend(json, diff_data)
			}

			res.resolve(json)
		})
		.fail(function(){
			if(default_data != null){
				res.resolve(default_data)
			} else {
				res.reject()
			}
		})

	return res
}


// NOTE: config change to name will not affect this...
function makeFileLoader(title, name, default_data, set_data, error, evt_name, skip_reg){
	var _loader = function(path, tracker){
		var res = $.Deferred()

		// NOTE: these are static!!
		var file_dfl = makeBaseFilename(name)
		var file_pattern = makeFilenamePattern(name)

		// default locations...
		if(path == null){
			var base = normalizePath(CONFIG.cache_dir_var)
			var loader = loadLatestJSONFile(base, 
					file_dfl, 
					file_pattern,
					null,
					default_data,
					tracker)
		
		// explicit path...
		// XXX need to account for paths without a CONFIG.cache_dir
		} else {
			path = normalizePath(path)
			var base = path.split(CONFIG.cache_dir)[0]
			//base = normalizePath(path +'/'+ CONFIG.cache_dir_var)
			base = path +'/'+ CONFIG.cache_dir

			// XXX is this correct???
			var loader = loadLatestJSONFile(base, 
					path.split(base)[0], 
					RegExp(path.split(base)[0]),
					null,
					default_data,
					tracker)
		}

		res.done(set_data)

		bubbleProgress(title, loader, res)

		if(error != null){
			res.fail(error)
		}
		if(evt_name != null){
			res.done(function(){ $('.viewer').trigger(evt_name) })
		}
		return res
	}
	!skip_reg && FILE_LOADERS.push(_loader)
	return _loader
}


// XXX make this check for updates -- no need to re-save if nothing 
// 		changed...
function makeFileSaver(title, file_dfl, get_data, skip_reg){
	var _saver = function(path, date){
		path = path == null 
			? normalizePath(CONFIG.cache_dir_var +'/'+ makeFilename(file_dfl, date)) 
			: path

		dumpJSON(path, get_data())
	}
	if(!skip_reg){
		FILE_SAVERS[title] = _saver
	}
	return _saver
}


// mark file type as updated...
function fileUpdated(name){
	if(FILES_UPDATED.indexOf(name) < 0 && name in FILE_SAVERS){
		FILES_UPDATED.push(name)
	}
}


function runFileLoaders(prefix, res){
	FILES_UPDATED = []
	return $.when.apply(null, FILE_LOADERS.map(function(load){
		return bubbleProgress(prefix, load(), res, true)
	}))
}


// NOTE: if all is set, this will force save everything...
// XXX do we need bubbleProgress(..) here???
function runFileSavers(path, date, all){
	var updated = FILES_UPDATED
	FILES_UPDATED = []
	for(var n in FILE_SAVERS){
		if(all || updated.indexOf(n) >= 0){
			showStatusQ('Saving: File:', n)
			FILE_SAVERS[n](path, date)
		}
	}
}



/*********************************************************************/
// XXX should this be here or in data.js???

var saveFileData = makeFileSaver(
		'Data',
		CONFIG.data_file, 
		function(){ 
			var data = getAllData()
			data.current = DATA.current
			return data
		})


// NOTE: this will set the updated flag ONLY of out of cropped mode...
function dataUpdated(){
	if(!isViewCropped()){
		fileUpdated('Data')
		$('.viewer').trigger('dataUpdated')
	}
}



/*********************************************************************/

// Construct a ribbons hierarchy from the fav dirs structure
//
// NOTE: this depends on listDir(...)
// NOTE: this assumes that images contain ALL the images...
// NOTE: this assumes that all file names are unique...
function ribbonsFromFavDirs(path, images, cmp, dir_name){
	path = path == null ? getBaseURL() : path
	images = images == null ? IMAGES : images
	dir_name = dir_name == null ? 'fav' : dir_name

	// build a reverse name-gid index for fast access...
	var index = {}
	var name
	for(var gid in images){
		name = getImageFileName(gid)
		// XXX we assume that names are unique...
		index[name] = gid
	}

	var ribbons = []
	// add the base row...
	var base = Object.keys(images)
	ribbons.push(base)

	var files = listDir(path)	
	var cur_path = path
	while(files.indexOf(dir_name) >= 0){
		cur_path += '/' + dir_name
		files = listDir(cur_path)
		ribbon = []
		// collect the images...
		$.each(files, function(i, e){
			var _gid = index[e]
			// skip files not in index...
			// NOTE: we do not need to filter the files by name as we 
			// 		trust the index...
			if(_gid == null){
				return 
			}
			// remove the found item from each of the below ribbons...
			$.each(ribbons, function(i ,e){
				if(e.indexOf(_gid) != -1){
					e.splice(e.indexOf(_gid), 1)
				}
			})

			ribbon.push(_gid)
		})
		ribbons.push(ribbon)
	}

	// remove empty ribbons and sort the rest...
	ribbons = $.map(ribbons, function(e){ 
		return e.length > 0 ? [cmp == null ? e : e.sort(cmp)] : null 
	})

	return ribbons.reverse()
}



/*********************************************************************/

// Load images from file
//
// This will also merge all diff files.
function loadFileImages(path, tracker, no_load_diffs){
	no_load_diffs = window.listDir == null ? true : no_load_diffs 

	var res = $.Deferred()

	// default locations...
	if(path == null){
		var base = normalizePath(CONFIG.cache_dir_var) 
		var loader = loadLatestJSONFile(base, 
				makeBaseFilename(CONFIG.images_file), 
				makeFilenamePattern(CONFIG.images_file), 
				makeDiffFilePattern(CONFIG.images_file),
				null,
				tracker)
	
	// explicit base dir...
	} else if(!/\.json$/i.test(path)) {
		var base = normalizePath(path +'/'+ CONFIG.cache_dir_var) 
		var loader = loadLatestJSONFile(base, 
				makeBaseFilename(CONFIG.images_file), 
				makeFilenamePattern(CONFIG.images_file), 
				makeDiffFilePattern(CONFIG.images_file),
				null,
				tracker)

	// explicit path...
	} else {
		var loader = loadLatestJSONFile(normalizePath(path), null, null, null, null, tracker)
	}

	bubbleProgress('Images', loader, res)

	res.done(function(images){
		IMAGES = images
		IMAGES_UPDATED = []
		IMAGES_CREATED = false

		// XXX is this the correct spot to do this???
		$('.viewer').trigger('imagesLoaded')
	})

	return res
}


// Save current images list to file
//
// If no name is given this will merge all the diffs and save a "clean"
// (full) images.json file. Also removing the diff files.
//
// NOTE: this will use CONFIG.cache_dir as the location if no name is given.
function saveFileImages(name, date, remove_diffs){
	remove_diffs = remove_diffs == null ? false : remove_diffs
	name = name == null ? normalizePath(CONFIG.cache_dir_var +'/'+ makeFilename(CONFIG.images_file, date)) : name

	if(window.dumpJSON == null){
		showErrorStatus('Can\'t save to file.')
		return
	}

	// remove the diffs...
	if(remove_diffs){
		var diff_pattern = makeDiffFilePattern(CONFIG.images_file) 
		$.each($.map(listDir(normalizePath(CONFIG.cache_dir_var)), function(e){ 
				return diff_pattern.test(e) ? e : null
			}), function(i, e){
				showStatusQ('Removeing:', e)
				removeFile(normalizePath(CONFIG.cache_dir_var +'/'+ e))
			})
	}

	dumpJSON(name, IMAGES)

	IMAGES_UPDATED = []
	IMAGES_CREATED = false
}


function saveFileImagesDiff(name, date){
	var path = normalizePath(CONFIG.cache_dir_var)
	name = name == null 
		? normalizePath(path +'/'+ makeDiffFilename(CONFIG.images_file, date)) 
		: name

	var updated = {}
	$.each(IMAGES_UPDATED, function(i, e){
		updated[e] = IMAGES[e]
	})

	dumpJSON(name, updated)

	IMAGES_UPDATED = []
}


// Load images, ribbons and run registered load callbacks...
//
// XXX add support for explicit filenames...
function loadFileState(path, prefix, tracker){
	prefix = prefix == null ? 'Data' : prefix
	prefix = prefix === false ? null : prefix

	// XXX explicit data file path...
	if(/\.json$/i.test(path)){
		// XXX at this 
		var base = path.split(CONFIG.cache_dir)[0]
		base = base == path ? '.' : base
	} else {
		var base = path.split(CONFIG.cache_dir)[0]
		base = base == path ? '.' : base
	}

	var res = $.Deferred()

	bubbleProgress(prefix,
			loadLatestJSONFile(path, 
				makeBaseFilename(CONFIG.data_file), 
				makeFilenamePattern(CONFIG.data_file),
				null,
				null,
				tracker), 
			res, 
			true)
		.done(function(json){
			setBaseURL(base)

			// legacy format...
			if(json.version == null){
				json = convertDataGen1(json)
				DATA = json.data
				IMAGES = json.images
				MARKED = []
				reloadViewer()
				res.resolve()

			// version 2.*
			} else if(/2\.[0-9]*/.test(json.version)) {
				DATA = json
				$.when(
						// XXX load config...

						// load current position...
						// added on 2.2
						bubbleProgress(prefix,
								loadLatestJSONFile(path, 
									makeBaseFilename(CONFIG.current_file),
									null,
									null,
									DATA.current,
									tracker), 
								res, 
								true)
							.done(function(cur){
								DATA.current = cur
							}),
						// load images...
						bubbleProgress(prefix,
							loadFileImages(base, tracker), res, true),
							//loadFileImages(DATA.image_file != null ?
							//		normalizePath(DATA.image_file, base) 
							//		: null), res, true),
						// run registered loaders...
						// added on 2.1
						// XXX bubbleProgress???
						runFileLoaders(prefix, res))
					.done(function(){
						$('.viewer').trigger('fileStateLoaded')
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


// Save, ribbons and run registered save callbacks...
//
// NOTE: this will NOT save images, that operation must be explicitly 
// 		performed by saveFileImages(...)
//
// XXX do propper reporting...
// XXX check if name is needed and how it works...
function saveFileState(name, no_normalize_path){
	var date = Date.timeStamp()

	if(!no_normalize_path){
		var path = normalizePath(CONFIG.cache_dir_var)
	}

	var cur_file = makeBaseFilename(CONFIG.current_file)
	showStatusQ('Saving: File:', cur_file)
	// allways update the current position...
	dumpJSON(path +'/'+ cur_file, DATA.current)

	// save created images...
	if(IMAGES_CREATED){
		showStatusQ('Saving: File: Images.')
		saveFileImages(name, date)

	// save the updated images...
	} else if(IMAGES_UPDATED.length > 0){
		showStatusQ('Saving: File: Images diff.')
		saveFileImagesDiff(name, date)
	}

	// save the rest of the data...
	runFileSavers(name, date)
}


// Load a directory as-is
//
// XXX check if we need to pass down sorting settings to the generators...
function loadRawDir(path, no_preview_processing, prefix){
	prefix = prefix == null ? 'Data' : prefix
	prefix = prefix === false ? null : prefix

	var files = listDir(path)

	var res = $.Deferred()

	// filter images...
	var image_paths = $.map(files, function(e){
		return IMAGE_PATTERN.test(e) ? e : null
	})

	if(image_paths.length == 0){
		// no images in path...
		res.notify(prefix, 'Load', path, 'Error')
		return res.reject()
	}

	setBaseURL(path)

	IMAGES = imagesFromUrls(image_paths)
	res.notify(prefix, 'Loaded', 'Images.')
	IMAGES_CREATED = true

	DATA = dataFromImages(IMAGES)
	res.notify(prefix, 'Loaded', 'Data.')

	// XXX this will reload viewer...
	//updateRibbonsFromFavDirs()
	DATA.ribbons = ribbonsFromFavDirs(null, null, imageOrderCmp)
	res.notify(prefix, 'Loaded', 'Fav dirs.')

	MARKED = []

	reloadViewer()

	// read orientation form files...
	res.notify(prefix, 'Loading', 'Images metadata.')
	var o = $.when(
			readImagesOrientationQ(),
			readImagesDatesQ()
		)
		.done(function(){
			res.notify(prefix, 'Loaded', 'Images metadata.')
		})

	// load/generate previews...
	if(!no_preview_processing){
		res.notify(prefix, 'Loading/Generating', 'Previews.')
		var p = makeImagesPreviewsQ()
			.depleted(function(){
				res.notify(prefix, 'Loaded', 'Previews.')
			})

	} else {
		var p = 0
	}

	// NOTE: we are not waiting for previews and orientation...
	return res.resolve()

	/* XXX do we need to make everyone wait for previews and orientation???
	$.when(o, p).done(function(){
		res.resolve()
	})
	return res
	*/
}


// Load a path
//
// This will try and do one of the following in order:
// 	1) look for a cache and load it,
// 	2) load data from within the directory
// 	3) load a directory as-is
// 		load fav dirs
//
// NOTE: this will create an images.json file in cache on opening an 
// 		un-cached dir (XXX is this correct???)
// NOTE: if tracker === false no tracker will get created...
function loadDir(path, no_preview_processing, prefix, tracker){
	prefix = prefix == null ? 'Data' : prefix
	prefix = prefix === false ? null : prefix

	var res = $.Deferred()

	if(tracker == null){
		var tracker = statusProgress('Loading')
		// XXX is this the right way to go???
		res.done(function(){
			tracker.resolve()
		})
	}
	if(tracker == false){
		tracker == null
	}

	// stop all workers running on current image set before we 
	// move to the next...
	// XXX is this the correct spot for this???
	killAllWorkers()

	IMAGES_CREATED = false

	path = normalizePath(path)
	var orig_path = path
	var data

	res.notify(prefix, 'Loading', path)

	var files = listDir(path)

	if(files == null){
		//showErrorStatus('No files in path: ' + path)
		res.notify('load_error', path)
		return res.reject()
	}

	// see if there is a cache...
	if(files.indexOf(CONFIG.cache_dir) >= 0){
		path = path +'/'+ CONFIG.cache_dir
	}

	bubbleProgress(prefix, 
			loadFileState(path, false, tracker), res, true)
		.done(function(){
			res.resolve()
		})
		.fail(function(){
			bubbleProgress('Raw directory', 
				loadRawDir(orig_path, no_preview_processing), res)
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


function exportImageTo(gid, path, im_name, size){
	path = path == null ? BASE_URL : path
	im_name = im_name == null ? '%f' : im_name
	size = size == null ? 1000 : size

	// get correct preview...
	var src = getBestPreview(gid, size).url
	var orig = getImageFileName(gid)

	// XXX might be a good idea to combine this with docs as a 
	// 		single mechanism...
	// form image name...
	var dest = im_name
	// full filename...
	dest = dest.replace('%f', orig)
	// file name w.o. ext...
	dest = dest.replace('%n', orig.split('.')[0])
	// ext...
	dest = dest.replace('%e', '.'+src.split('.').pop())
	// marked status...
	dest = dest.replace(/%\(([^)]*)\)m/, MARKED.indexOf(gid) >= 0 ? '$1' : '')
	// bookmarked status...
	dest = dest.replace(/%\(([^)]*)\)b/, BOOKMARKS.indexOf(gid) >= 0 ? '$1' : '')
	// gid...
	dest = dest.replace('%gid', gid)
	dest = dest.replace('%g', gid.slice(34))

	dest = path +'/'+ dest

	// copy... 
	// NOTE: the sad smily face here is here for JS compatibility ;)
	return (function(src, dest){
		return copyFile(src, dest)
			.done(function(){
				// XXX do we actually need this???
				console.log(src, 'done.')
			})
			.fail(function(err){
				// XXX do we actually need this???
				console.warn(src, 'err:', err)
			})
	})(src, dest)
}


// Export current state to directory...
//
// XXX this copies the files in parallel, make it sync and sequential...
// 		...reason is simple, if we stop the copy we need to end up with 
// 		part of the files copied full rather than all partially...
function exportImagesTo(path, im_name, dir_name, size){
	path = path == null ? BASE_URL : path
	im_name = im_name == null ? '%f' : im_name
	dir_name = dir_name == null ? 'fav' : dir_name
	size = size == null ? 1000 : size

	var res = $.Deferred()

	var base_path = path
	path = normalizePath(path)

	var order = DATA.order
	var Z = (('10e' + (order.length + '').length) * 1 + '').slice(2)

	// mainly used for file naming, gives us ability to number images 
	// in the current selection...
	var selection = []
	$.each(DATA.ribbons, function(_, e){
		selection = selection.concat(e)
	})
	selection.sort(imageOrderCmp)
	var z = (('10e' + (selection.length + '').length) * 1 + '').slice(2)

	// use an external pool...
	//var pool = makeDeferredPool()
	var pool = getWorkerQueue('Export previews', 64)
		.depleted(function(){
			showStatusQ('Export: done.')
			res.resolve()
		})

	// go through ribbons...
	for(var i=DATA.ribbons.length-1; i >= 0; i--){
		var ribbon = DATA.ribbons[i]
		// go through images...
		for(var j=0; j < ribbon.length; j++){
			var gid = ribbon[j]

			// do global naming...
			var dest = im_name
			// global order...
			var o = order.indexOf(gid) + ''
			dest = dest.replace('%I', (Z + o).slice(o.length))
			// current order...
			var o = selection.indexOf(gid) + ''
			dest = dest.replace('%i', (z + o).slice(o.length))

			pool.enqueue(exportImageTo, gid, path, dest, size)
		}

		path = normalizePath(path +'/'+ dir_name)
	}

	return res
}



/**********************************************************************
* Metadata readers...
*/

// NOTE: this will overwrite current image orientation...
//
// XXX this depends on getImageOrientation(...)
function readImageOrientation(gid, no_update_loaded){
	gid = gid == null ? getImageGID() : gid
	var img = IMAGES[gid]

	if(img == null){
		return
	}

	return getImageOrientation(normalizePath(img.path))
		.done(function(o){
			var o_o = img.orientation
			var o_f = img.flipped

			img.orientation = o.orientation
			img.flipped = o.flipped

			// mark image dirty...
			if(o_o != o.orientation || o_f != o.flipped){
				imageUpdated(gid)
			}

			// update image if loaded...
			if(!no_update_loaded){
				var o = getImage(gid)
				if(o.length > 0){
					updateImage(o)
				}
			}
		})
}
function readImagesOrientation(gids, no_update_loaded){
	gids = gids == null ? getClosestGIDs() : gids
	var res = []

	$.each(gids, function(_, gid){
		res.push(readImageOrientation(gid, no_update_loaded))
	})

	return $.when.apply(null, res)
}
// queued version of readImagesOrientation(...)
//
function readImagesOrientationQ(gids, no_update_loaded){
	gids = gids == null ? getClosestGIDs() : gids

	var queue = getWorkerQueue('Read images orientation', 4)

	var last = null

	// attach workers to queue...
	$.each(gids, function(_, gid){
		last = queue.enqueue(readImageOrientation, gid, no_update_loaded)
	})

	return queue
}


function readImageDate(gid, images){
	images = images == null ? IMAGES : images
	var img = images[gid]
	return getEXIFDate(normalizePath(img.path))
		.done(function(date){
			img.ctime = Date.fromTimeStamp(date).getTime()/1000
		})
}
function readImagesDates(images){
	images = images == null ? IMAGES : images

	return $.when.apply(null, $.map(images, function(_, gid){
		return readImageDate(gid, images)
			.done(function(){
				imageUpdated(gid)
			})
	}))
}
function readImagesDatesQ(images){
	images = images == null ? IMAGES : images

	var queue = getWorkerQueue('Read images dates', 4)

	$.each(images, function(gid, img){
		queue.enqueue(readImageDate, gid, images)
			.always(function(){ 
				imageUpdated(gid)
				//queue.notify(gid, 'done') 
			})
	})

	return queue
}


// XXX deleting images is not sported, we need to explicitly re-save...
// XXX need to reload the viewer...
// XXX not tested...
function updateImageGID(gid, images, data){
	images = images == null ? IMAGES : images
	var img = images[gid]
	return getEXIFGID(normalizePath(img.path))
		.done(function(gid){
			img.id = gid
			// images...
			images[gid] = images[key]
			delete images[key]
			imageUpdated(gid)

			// data...
			if(data != null){
				// replace current...
				if(data.current == key){
					data.current = gid
				}
				// replace in order...
				data.order[data.order.indexOf(key)] = gid
				// replace in ribbons...
				for(var i=0; i < data.ribbons; i++){
					var r = data.ribbons[i]
					var k = r.indexOf(key)
					if(k >= 0){
						r[k] = gid
					}
				}
			}
		})
}
function updateImagesGIDs(images, data){
	images = images == null ? IMAGES : images

	return $.when.apply(null, $.map(images, function(_, key){
		return updateImageGID(key, images, data)
	}))
}
function updateImagesGIDsQ(images, data){
	images = images == null ? IMAGES : images

	var queue = getWorkerQueue('Update GIDs', 4)

	$.each(images, function(_, key){
		queue.enqueue(updateImageGID, key, images, data)
			.always(function(){ 
				//queue.notify(key, 'done') 
			})
	})

	return queue
}



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
