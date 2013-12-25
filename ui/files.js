/**********************************************************************
* 
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true

// Flag indicating a new image file was constructed...
// XXX do we need this?
var IMAGES_CREATED = false

// XXX make these usable for both saving and loading...
// XXX get these from config...
var IMAGES_FILE_DEFAULT = 'images.json'
var IMAGES_FILE_PATTERN = /^[0-9]*-images.json$/
var IMAGES_DIFF_FILE_PATTERN = /^[0-9]*-images-diff.json$/

var DATA_FILE_DEFAULT = 'data.json'
var DATA_FILE_PATTERN = /^[0-9]*-data.json$/

var CURRENT_FILE = 'current.json'

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
// if default_data is then not finding a file will not fail, instead the
// default_data will be the resolved data.
//
// NOTE: this expects a file to be JSON.
// NOTE: if diffs are available this expects the file to contain an object,
// 		and will extend that object.
// NOTE: if neither of dfl, pattern or diff_pattern are given, then this
// 		is essentially the same as $.getJSON(...)
// NOTE: this needs listDir(...) to search for latest versions of files.
function loadLatestFile(path, dfl, pattern, diff_pattern, default_data){
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

			if(default_data != null){
				return res.resolve(default_data)
			} else {
				return res.reject(file)
			}
		})

	return res
}


function makeFileLoader(title, file_dfl, file_pattern, set_data, evt_name, skip_reg){
	var _loader = function(path){
		var res = $.Deferred()
		// default locations...
		if(path == null){
			var base = normalizePath(CONFIG.cache_dir_var)
			var loader = loadLatestFile(base, 
					file_dfl, 
					file_pattern,
					null,
					[])
		
		// explicit path...
		// XXX need to account for paths without a CONFIG.cache_dir
		} else {
			path = normalizePath(path)
			var base = path.split(CONFIG.cache_dir)[0]
			//base = normalizePath(path +'/'+ CONFIG.cache_dir_var)
			base = path +'/'+ CONFIG.cache_dir

			// XXX is this correct???
			var loader = loadLatestFile(base, 
					path.split(base)[0], 
					RegExp(path.split(base)[0]),
					null,
					[])
		}

		bubbleProgress(title, loader, res)

		res.done(set_data)

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
	var _saver = function(name){
		name = name == null 
			? normalizePath(CONFIG.cache_dir_var +'/'+ Date.timeStamp()) 
			: name

		dumpJSON(name + '-' + file_dfl, get_data())
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
function runFileSavers(name, all){
	var updated = FILES_UPDATED
	FILES_UPDATED = []
	for(var n in FILE_SAVERS){
		if(all || updated.indexOf(n) >= 0){
			showStatusQ('Saving: File:', n)
			FILE_SAVERS[n](name)
		}
	}
}



/*********************************************************************/
// XXX should this be here or in data.js???

var saveFileData = makeFileSaver(
		'Data',
		DATA_FILE_DEFAULT, 
		function(){ 
			var data = getAllData()
			data.current = DATA.current
			return data
		})


// NOTE: this will set the updated flag ONLY of out of cropped mode...
function dataUpdated(){
	if(!isViewCropped()){
		fileUpdated('Data')
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
function loadFileImages(path, no_load_diffs){
	no_load_diffs = window.listDir == null ? true : no_load_diffs 

	var res = $.Deferred()

	// default locations...
	if(path == null){
		var base = normalizePath(CONFIG.cache_dir_var) 
		var loader = loadLatestFile(base, 
				IMAGES_FILE_DEFAULT, 
				IMAGES_FILE_PATTERN, 
				IMAGES_DIFF_FILE_PATTERN)
	
	// explicit base dir...
	} else if(!/\.json$/i.test(path)) {
		var base = normalizePath(path +'/'+ CONFIG.cache_dir_var) 
		var loader = loadLatestFile(base, 
				IMAGES_FILE_DEFAULT, 
				IMAGES_FILE_PATTERN, 
				IMAGES_DIFF_FILE_PATTERN)

	// explicit path...
	} else {
		var loader = loadLatestFile(normalizePath(path))
	}

	bubbleProgress('Images', loader, res)

	res.done(function(images){
		IMAGES = images
		IMAGES_UPDATED = []

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
// NOTE: if an explicit name is given then this will not remove anything.
// NOTE: this will use CONFIG.cache_dir as the location if no name is given.
function saveFileImages(name){
	var remove_diffs = (name == null)
	name = name == null ? normalizePath(CONFIG.cache_dir_var +'/'+ Date.timeStamp()) : name

	if(window.dumpJSON == null){
		showErrorStatus('Can\'t save to file.')
		return
	}

	// remove the diffs...
	if(remove_diffs){
		$.each($.map(listDir(normalizePath(CONFIG.cache_dir_var)), function(e){ 
				return IMAGES_DIFF_FILE_PATTERN.test(e) ? e : null
			}), function(i, e){
				showStatusQ('removeing:', e)
				removeFile(normalizePath(CONFIG.cache_dir_var +'/'+ e))
			})
		IMAGES_UPDATED = []
	}

	// XXX use the pattern...
	dumpJSON(name + '-images.json', IMAGES)
	//DATA.image_file = normalizePath(name + '-images.json', null, 'relative')
}


// Load images, ribbons and run registered load callbacks...
//
// XXX add support for explicit filenames...
function loadFileState(path, prefix){
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
			loadLatestFile(path, 
				DATA_FILE_DEFAULT, 
				DATA_FILE_PATTERN), res, true)
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
								loadLatestFile(path, 
									CURRENT_FILE,
									null,
									null,
									DATA.current), res, true)
							.done(function(cur){
								DATA.current = cur
							}),
						// load images...
						bubbleProgress(prefix,
							loadFileImages(base), res, true),
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
function saveFileState(name, no_normalize_path){
	name = name == null ? Date.timeStamp() : name

	if(!no_normalize_path){
		var path = normalizePath(CONFIG.cache_dir_var)
		name = normalizePath(path +'/'+ name)

	// write .image_file only if saving data to a non-cache dir...
	// XXX check if this is correct...
	} else {
		if(DATA.image_file == null){
			DATA.image_file = name + '-images.json'
		}
	}

	/*
	var data = getAllData()
	data.current = DATA.current

	dumpJSON(name + '-data.json', data)
	*/

	// allways update the current position...
	dumpJSON(path + '/current.json', DATA.current)

	// save the updated images...
	if(IMAGES_UPDATED.length > 0){
		var updated = {}
		$.each(IMAGES_UPDATED, function(i, e){
			updated[e] = IMAGES[e]
		})
		dumpJSON(name + '-images-diff.json', updated)
		IMAGES_UPDATED = []
	}

	// save the rest of the data...
	runFileSavers(name)
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
			.done(function(){
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
function loadDir(path, no_preview_processing, prefix){
	prefix = prefix == null ? 'Data' : prefix
	prefix = prefix === false ? null : prefix

	// stop all workers running on current image set before we 
	// move to the next...
	// XXX is this the correct sopot for this???
	killAllWorkers()

	IMAGES_CREATED = false

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
	if(files.indexOf(CONFIG.cache_dir) >= 0){
		path = path +'/'+ CONFIG.cache_dir
	}

	bubbleProgress(prefix, 
			loadFileState(path, false), res, true)
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
	// gid...
	dest = dest.replace('%gid', gid)
	dest = dest.replace('%g', gid.slice(34))
	// XXX Metadata...
	// XXX

	dest = path +'/'+ dest

	// copy... 
	// NOTE: the sad smily face here is here for JS compatibility ;)
	;(function(src, dest){
		copyFile(src, dest)
			.done(function(){
				console.log(src, 'done.')
			})
			.fail(function(err){
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

	// starting point...
	//var deferred = $.Deferred().resolve()

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

			exportImageTo(gid, path, dest, size)
		}

		path = normalizePath(path +'/'+ dir_name)
	}
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

	var queue = getWorkerQueue('image_orientation_reader')

	var last = null

	// attach workers to queue...
	$.each(gids, function(_, gid){
		last = queue.enqueue(readImageOrientation, gid, no_update_loaded)
			.done(function(){ queue.notify(gid, 'done') })
			.fail(function(){ queue.notify(gid, 'fail') })
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

	var queue = getWorkerQueue('date_reader')

	$.each(images, function(gid, img){
		queue.enqueue(readImageDate, gid, images)
			.always(function(){ 
				imageUpdated(gid)
				queue.notify(gid, 'done') 
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

	var queue = getWorkerQueue('gid_updater')

	$.each(images, function(_, key){
		queue.enqueue(updateImageGID, key, images, data)
			.always(function(){ queue.notify(key, 'done') })
	})

	return queue
}



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
