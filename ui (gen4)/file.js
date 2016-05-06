/**********************************************************************
* 
*
*
**********************************************************************/

var pathlib = require('path')
var events = require('events')

var fse = require('fs-extra')
var glob = require('glob')

// XXX seems that we need different buids of this for use with node and nw...
// XXX BUG: nw-gyp does not support msvs2015...
//var sharp = require('sharp') 

var guaranteeEvents = require('guarantee-events')


define(function(require){ var module = {}


//var DEBUG = DEBUG != null ? DEBUG : true

var data = require('data')
var images = require('images')

var tasks = require('lib/tasks')



/*********************************************************************/

var INDEX_DIR = '.ImageGrid'



/*********************************************************************/
// Queue
//
// Task
//



/*********************************************************************/
// helpers...

// Guarantee that the 'end' and 'match' handlers will always get called 
// with all results at least once...
//
// This does two things:
// 	- every 'end' event handler will get the full result set, regardless
// 		of when it was set...
// 	- every 'match' handler will be called for every match found, again
// 		regardless of whether it was set before or after the time of 
// 		match.
//
// This prevents handlers from missing the event they are waiting for, 
// essentially making it similar to how Promise/Deferred handle their
// callbacks.
//
var guaranteeGlobEvents =
module.guaranteeGlobEvents =
function(glob){ return guaranteeEvents('match end', glob) }

var gGlob = 
module.gGlob = function(){
	return guaranteeGlobEvents(glob.apply(null, arguments))
}


/*********************************************************************/
// Reader...


var listIndexes =
module.listIndexes = 
function(base, index_dir){
	return gGlob(base +'/**/'+ index_dir || INDEX_DIR)
}


var listPreviews =
module.listPreviews = 
function(base){
	return gGlob(base +'/*px/*jpg')
}


// XXX return a promise rather than an event emitter (???)
var listJSON =
module.listJSON =
function(path, pattern){
	pattern = pattern || '*'
	return gGlob(path +'/'+ pattern +'.json')
}

// wrap a node style callback function into a Promise...
//
// NOTE: this is inspired by the promise module for node this stopped 
// 		working, and porting one method was simpler that trying to get
// 		to the bottom of the issue, especially with native promises...
// XXX move to someplace generic...
var denodeify = 
module.denodeify =
function(func){
	var that = this
	return function(){
		// XXX for some reason this does not see args2array...
		// XXX and for some reason the error is not reported...
		var args = [].slice.call(arguments)
		return new Promise(function(resolve, reject){
			func.apply(that, args.concat([function(err, res){
				return err ? reject(err) : resolve(res)
			}]))
		})
	}
}

var loadFile = denodeify(fse.readFile)
var writeFile = denodeify(fse.writeFile)
var ensureDir = denodeify(fse.ensureDir)


// XXX handle errors...
function loadJSON(path){
	return loadFile(path).then(JSON.parse)
}


// Format:
// 	{
// 		<date>: [
// 			<path>,
// 			...
// 		],
//
// 		...
//
// 		// root files -- no date...
// 		root: [
// 			<path>,
// 			...
// 		]
// 	}
//
// NOTE: this does not use the fs...
var groupByDate = 
module.groupByDate = 
function(list){
	var res = {}

	list
		.forEach(function(n){
			var b = pathlib.basename(n)
			var s = b.split(/[-.]/g).slice(0, -1)

			// no date set...
			if(s.length == 1){
				res.root = res.root || []
				res.root.push(n)

			} else {
				res[s[0]] = res[s[0]] || []
				res[s[0]].push(n)
			}
		})

	return res
}



// Group file list by keyword...
//
// this will build a structure in the following format:
// 	{
// 		<keyword>: [
// 			// diff files...
// 			// NOTE: the first argument indicates 
// 			//	if this is a diff or not, used to 
// 			//	skip past the last base...
// 			[true, <filename>],
// 			...
//
// 			// base file (non-diff)
// 			[false, <filename>]
// 		],
// 		...
// 	}
//
// This is used to sequence, load and correctly merge 
// the found JSON files.
//
// NOTE: all files past the first non-diff are skipped.
// NOTE: this does not use the fs...
var groupByKeyword = 
module.groupByKeyword = 
function(list, from_date, logger){
	var index = {}
	var queued = 0

	var dates = groupByDate(list)

	Object.keys(dates)
		.sort()
		.reverse()
		// skip dates before from_date...
		// NOTE: from_date is included...
		.filter(function(d){ return from_date ? d <= from_date || d == 'root' : true })
		.forEach(function(d){
			dates[d]
				.sort()
				.reverse()
				.forEach(function(n){
					var b = pathlib.basename(n)
					var s = b.split(/[-.]/g).slice(0, -1)

					// <timestamp>-<keyword>[-diff].json / diff / non-diff
					// NOTE: all files without a timestamp are filtered out
					// 		by groupByDate(..) into a .root section so we 
					// 		do not need to worry about them here...
					var k = s[1]
					var d = s[2] == 'diff'

					// new keyword...
					if(index[k] == null){
						index[k] = [[d, n]]
						logger && logger.emit('queued', n)
						queued += 1

					// do not add anything past the latest non-diff 
					// for each keyword...
					} else if(index[k].slice(-1)[0][0] == true){
						index[k].push([d, n])
						logger && logger.emit('queued', n)
						queued += 1
					}
				}) })

	// add base files back where needed...
	// <keyword>.json / non-diff
	dates.root
		.forEach(function(n){
			var b = pathlib.basename(n)
			var k = b.split(/\./g)[0]

			// no diffs...
			if(index[k] == null){
				index[k] = [[false, n]]
				logger && logger.emit('queued', n)
				queued += 1

			// add root file if no base is found...
			} else if(index[k].slice(-1)[0][0] == true){
				index[k].push([false, n])
				logger && logger.emit('queued', n)
				queued += 1
			}
		})

	// remove the flags...
	for(var k in index){
		index[k] = index[k].map(function(e){ return e[1] })
	}

	logger && logger.emit('files-queued', queued, index)

	return index
}



// Load index data listed by timestamp... 
//
// NOTE: this returns data similar to groupByDate(..) but will replace 
// 		the 'root' key with a timestamp...
// NOTE: this will include the full history. this is different to what
// 		groupByKeyword(..) does.
//
// XXX handle errors....
var loadSaveHistoryList =
module.loadSaveHistoryList =
function(path, index_dir){
	index_dir = index_dir || INDEX_DIR

	return new Promise(function(resolve, reject){
		// direct index...
		if(pathlib.basename(path) == index_dir){
			listJSON(path)
				// XXX handle errors...
				.on('error', function(err){
					logger && logger.emit('error', err)
				})
				.on('end', function(files){
					var data = groupByDate(files)

					// XXX should we mark the root timestamp in any way???
					if('root' in data && data.root.length > 0){
						// XXX handle stat error...
						data[fse.statSync(data.root[0]).birthtime.getTimeStamp()] = data.root
						delete data.root
					}

					resolve(data)
				})

		// need to locate indexes...
		} else {
			var res = {}
			var loaders = []

			// XXX handle 'error' event...
			listIndexes(path, index_dir)
				// XXX handle errors...
				.on('error', function(err){
					logger && logger.emit('error', err)
				})
				// collect the found indexes...
				.on('match', function(path){
					loaders.push(loadSaveHistoryList(path) 
						.then(function(obj){ 
							// NOTE: considering that all the paths within
							// 		the index are relative to the preview 
							// 		dir (the parent dir to the index root)
							// 		we do not need to include the index 
							// 		itself in the base path...
							var p = path.split(index_dir)[0]
							res[p] = obj
						}))
				})
				// done...
				.on('end', function(paths){
					// wait for all the loaders to complete...
					Promise.all(loaders).then(function(){ resolve(res) })
				})
		}
	})
}



// Load index(s)...
//
//	loadIndex(path)
//		-> data
//
//	loadIndex(path, logger)
//		-> data
//
//	loadIndex(path, index_dir, logger)
//		-> data
//
//	loadIndex(path, index_dir, from_date, logger)
//		-> data
//
//
// Procedure:
// 	- locate indexes in path given
// 	- per each index
// 		- get all .json files
// 		- get and load latest base file per keyword
// 		- merge all later than loaded base diff files per keyword
//
// Merging is done by copying the key-value pairs from diff to the
// resulting object.
//
//
// Index format (input):
// 	<index-dir>/
// 		+- [<timestamp>-]<keyword>[-diff].json
// 		+- ...
//
//
// Output format:
// 	{
// 		// one per index found...
// 		<path>/<sub-path>: {
// 			<keyword>: <kw-data>,
// 			...
// 		},
// 		...
// 	}
//
//
// Events emitted on logger if passed:
// 	- path <path>				- path currently being processed
// 	- files-found <n> <files>	- number and list of files found (XXX do we need this?)
// 	- queued <path>				- json file path queued for loading
// 	- files-queued <n> <queue>	- number of files queued and index (XXX do we need this?)
// 	- loaded <keyword> <path>	- done loading json file path
// 	- loaded <keyword>-diff <path>	
// 								- done loading json file path (diff file)
// 	- index <path> <data>		- done loading index at path
// 	- error <err>				- an error occurred...
//
//
//
// NOTE: this is fairly generic and does not care about the type of data
// 		or it's format as long as it's JSON and the file names comply
// 		with the scheme above...
// NOTE: this only loads the JSON data and does not import or process 
// 		anything...
//
// XXX need to do better error handling -- stop when an error is not recoverable...
// XXX really overcomplicated, mostly due to promises...
// 		...see if this can be split into more generic 
// 		sections...
// XXX change path handling:
// 		1) explicit index -- ends with INDEX_DIR (works)
// 			-> load directly...
// 		2) implicit index -- path contains INDEX_DIR (works)
// 			-> append INDEX_DIR and (1)...
// 		3) path is a pattern (contains glob wildcards) (works)
// 			-> search + load
// 		4) non of the above...
// 			a) error
// 			b) append '**' (current behavior)
// 			...(a) seems more logical...
// XXX do a task version...
var loadIndex =
module.loadIndex = 
function(path, index_dir, from_date, logger){
	if(index_dir && index_dir.emit != null){
		logger = index_dir
		index_dir = from_date = null

	} else if(from_date && from_date.emit != null){
		logger = from_date
		from_date = null
	}
	index_dir = index_dir || INDEX_DIR

	// XXX should this be interactive (a-la EventEmitter) or as it is now 
	// 		return the whole thing as a block (Promise)...
	// 		NOTE: one way to do this is use the logger, it will get
	// 				each index data on an index event
	return new Promise(function(resolve, reject){
		// we've got an index...
		// XXX do we need to check if if it's a dir???
		if(pathlib.basename(path) == index_dir){

			logger && logger.emit('path', path)

			listJSON(path)
				// XXX handle errors...
				.on('error', function(err){
					logger && logger.emit('error', err)
				})
				.on('end', function(files){
					var res = {}

					// XXX need to pass a filter date to this...
					var index = groupByKeyword(files, from_date, logger)
	
					// load...
					Promise
						.all(Object.keys(index).map(function(keyword){
							// get relevant paths...
							var diffs = index[keyword]
							var latest = diffs.splice(-1)[0]

							// XXX not sure about this...
							if(keyword == '__dates'){
								res.__dates = index.__dates
								return
							}
							if(keyword == '__date'){
								res.__date = index.__date
								return
							}

							// NOTE: so far I really do not like how nested and
							// 		unreadable the Promise/Deferred code becomes
							// 		even with a small rise in complexity...
							// 		...for example, the following code is quite
							// 		simple, but does not look the part.
							//
							// 		Maybe it's a style thing...

							// load latest...
							return loadJSON(latest)
								.then(function(data){
									logger && logger.emit('loaded', keyword, latest)

									var loading = {}

									// handle diffs...
									return Promise
										// load diffs...
										.all(diffs.map(function(p){
											return loadJSON(p)
												// XXX handle errors...
												// XXX we should abort loading this index...
												.catch(function(err){
													logger && logger.emit('error', err)
												})
												.then(function(json){
													// NOTE: we can't merge here
													// 		as the files can be
													// 		read in arbitrary order...
													loading[p] = json
												})
										}))
										// merge diffs...
										.then(function(){
											diffs
												.reverse()
												.forEach(function(p){
													var json = loading[p]

													for(var n in json){
														data[n] = json[n]
													}

													logger && logger.emit('loaded', keyword+'-diff', p)
												})

											res[keyword] = data
										})
								})
						}))
						.then(function(){
							logger && logger.emit('index', path, res)

							var d = {}
							d[path] = res

							resolve(d)
						})
				})

		// no explicit index given -- find all in sub tree...
		} else {
			var res = {}
			var loaders = []

			// XXX handle 'error' event...
			listIndexes(path, index_dir)
				// XXX handle errors...
				.on('error', function(err){
					logger && logger.emit('error', err)
				})
				// collect the found indexes...
				.on('match', function(path){
					loaders.push(loadIndex(path, index_dir, from_date, logger) 
						.then(function(obj){ 
							// NOTE: considering that all the paths within
							// 		the index are relative to the preview 
							// 		dir (the parent dir to the index root)
							// 		we do not need to include the index 
							// 		itself in the base path...
							var p = path.split(index_dir)[0]
							res[p] = obj[path] 
						}))
				})
				// done...
				.on('end', function(paths){
					// wait for all the loaders to complete...
					Promise.all(loaders).then(function(){ resolve(res) })
				})
		}
	})
}
 

// get/populate the previews...
//
// format:
// 	{
// 		<index-base>: {
// 			<gid>: {
// 				<resolution>: <local-path>,
// 				...
// 			},
// 			...
// 		},
// 		...
// 	}
//
// XXX should this be compatible with loadIndex(..) data???
// XXX handle errors....
var loadPreviews =
module.loadPreviews =
function(base, previews, index_dir, absolute_path){
	previews = previews || {}
	index_dir = index_dir || INDEX_DIR

	return new Promise(function(resolve, reject){
		listIndexes(base)
			// XXX handle errors....
			//.on('error', function(err){
			//})
			.on('match', function(base){
				if(!(base in previews)){
					previews[base] = {}
				}

				var images = previews[base]

				listPreviews(base)
					// XXX handle errors....
					//.on('error', function(err){
					//})
					// preview name syntax:
					// 	<res>px/<gid> - <orig-filename>.jpg
					.on('match', function(path){
						// get the data we need...
						var gid = pathlib.basename(path).split(' - ')[0]
						var res = pathlib.basename(pathlib.dirname(path))

						// build the structure if it does not exist...
						if(!(gid in images)){
							images[gid] = {}
						}
						if(images[gid].preview == null){
							images[gid].preview = {}
						}

						// add a preview...
						// NOTE: this will overwrite a previews if they are found in
						// 		several locations...
						images[gid].preview[res] = index_dir +'/'+ path.split(index_dir)[1]
					})
			})
			.on('end', function(){
				resolve(previews)
			})
	})
}


// XXX
var copyPreviews =
module.copyPreviews = 
function(){
	var q = tasks.Queue.clone()

	// XXX
}



// Build a data and images objects from the json returned by loadIndex(..)
//
// Contrary to loadIndex(..) this expects a specific format of data:
// 	.data
// 	.images
// 	.bookmarked
// 	.marked
// 	.tags
// 	.current
//
//
// XXX need a clear format upgrade path/strategy...
// 		...this can be:
// 			- full upgrade -- full update all data to new format
// 			- format continuation -- store in new format stating with a
// 			  new snapshot keeping the older data as-is...
// 			  XXX will need a "cut-off strategy", i.e. when a keyword 
// 			  	stops being used we need some way to tell the 
// 			  	loader/builder to ignore it...
// 		currently I'm for the second option...
//
// XXX move this to a better spot...
// XXX make this merge if we locate more than one index...
var buildIndex = 
module.buildIndex = function(index, base_path){
	var res = {}

	// we'll handle these in a special way...
	var special = [
		'data',
		'tags',
		'bookmarked',
		'marked',
		'current',
		'images',
	]

	// copy the rest as-is...
	for(var k in index){
		if(special.indexOf(k) > -1){
			continue
		}

		res[k] = index[k]
	}


	// now do the special stuff...

	var d = data.Data.fromJSON(index.data)

	// buildup the data object...
	// NOTE: this is mostly to attach stuff that is stored in separate files...
	
	// .tags + bookmarks + selection...
	d.tags = index.tags || {} 
	d.tags.bookmark = index.bookmarked ? index.bookmarked[0] : []
	d.tags.selected = index.marked || []
	d.sortTags()

	// .current...
	d.current = index.current || d.current


	// images...
	// XXX there seems to be a problem with updated images...
	// 		- in the test set not all rotated manually images are loaded rotated...
	var img = images.Images(index.images)

	if(base_path){
		d.base_path = base_path
		// XXX STUB remove ASAP... 
		// 		...need a real way to handle base dir, possible
		// 		approaches:
		// 			1) .base_path attr in image, set on load and 
		// 				do not save (or ignore on load)...
		// 				if exists prepend to all paths...
		// 				- more to do in view-time
		// 				+ more flexible
		// 			2) add/remove on load/save (approach below)
		// 				+ less to do in real time
		// 				- more processing on load/save
		img.forEach(function(_, img){ img.base_path = base_path })
	}

	res.data = d
	res.images = img

	return res
}



/*********************************************************************/
// Builder...
// 	- read list
// 	- generate previews (use config)
// 	- build images/data
// 		.loadURLs(..)
// 	- write (writer)



/*********************************************************************/
// Writer...
//
// This is just like the loader, done in two stages:
// 	- format dependent de-construction (symetric to buildIndex(..))
// 	- generic writer...
//
// NOTE: for now we'll stick to the current format...

// this will take the output of .json()
//
// 	.data
// 	.images
// 	.bookmarked
// 	.marked
// 	.tags
// 	.current
//
//
// changes can be:
// 	true | null		- write all
// 	false			- write only .current
// 	<detailed-format>
// 					- see below...
//
// changes detailed format:
// 	{
// 		data: <bool>,
//
// 		images: <bool> | [ <gid>, ... ]
//
// 		tags: <bool>,
// 		bookmarked: <bool>,
// 		selected: <bool>,
// 	}
//
// NOTE: this will prepare for version 2.0 file structure...
var prepareIndex =
module.prepareIndex =
function(json, changes){
	changes = changes === false ? false
		// nothing set then save all...
		: changes == null ? true
		: changes

	// always save current...
	var res = {
		current: json.data.current,
	}

	// data...
	if(changes === true || changes && changes.data){
		res.data = json.data
	}

	// tags...
	if((changes === true || changes) && json.data.tags != null){
		// NOTE: we write the whole set ONLY if an item is true or undefined
		// 		i.e. not false...
		if(changes === true || changes.bookmarked){
			res.bookmarked = [
				json.data.tags.bookmark || [], 
				// NOTE: this is for bookmark metadata line comments, text,
				// 		tags, ... etc.
				// XXX currently this is not used...
				json.data.bookmark_data || {},
			]
		}

		if(changes === true || changes.selected){
			res.marked = json.data.tags.selected || []
		}

		if(changes === true || changes.tags){
			res.tags = json.data.tags
		}

		// clean out some stuff from data...
		if(res.data){
			delete res.data.tags.bookmark
			delete res.data.tags.bookmark_data
			delete res.data.tags.selected
			delete res.data.tags
		}
	}

	if(changes === true || changes && changes.images === true){
		res.images = json.images

	} else if(changes && changes.images){
		var diff = res['images-diff'] = {}
		changes.images.forEach(function(gid){
			diff[gid] = json.images[gid]
		})
	}

	return res
}


var FILENAME = '${DATE}-${KEYWORD}.${EXT}'

var writeIndex =
module.writeIndex = 
function(json, path, date, filename_tpl, logger){
	filename_tpl = filename_tpl || FILENAME
	// XXX for some reason this gets the unpatched node.js Date, so we 
	// 		get the patched date explicitly...
	date = date || window.Date.timeStamp()

	var files = []

	// build the path if it does not exist...
	return ensureDir(path)
		.catch(function(err){
			logger && logger.emit('error', err)
		})
		.then(function(){
			logger && logger.emit('path', path)

			// write files...
			// NOTE: we are not doing this sequencilly as there will not
			// 		be too many files...
			return Promise
				.all(Object.keys(json).map(function(keyword){
					var file = path +'/'+ (filename_tpl
						.replace('${DATE}', date)
						.replace('${KEYWORD}', keyword)
						.replace('${EXT}', 'json'))

					return ensureDir(pathlib.dirname(file))
						.then(function(){
							files.push(file)
							var data = JSON.stringify(json[keyword])

							logger && logger.emit('queued', file)

							return writeFile(file, data, 'utf8')
								.catch(function(err){
									logger && logger.emit('error', err)
								})
								.then(function(){
									logger && logger.emit('written', file)
								})
						})
				}))
			.then(function(){
				logger && logger.emit('done', files)
			})
		})
}




/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
