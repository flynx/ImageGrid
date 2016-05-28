/**********************************************************************
* 
*
*
**********************************************************************/

define(function(require){ var module = {}

//var DEBUG = DEBUG != null ? DEBUG : true

// XXX this should not be imported!!!
// 		...something wrong with requirejs(..)
if(typeof(process) != 'undefined'){
	var fse = requirejs('fs-extra')
	var pathlib = requirejs('path')
	var glob = requirejs('glob')

	var file = require('file')
}

var data = require('data')
var images = require('images')

var util = require('lib/util')

var actions = require('lib/actions')
var features = require('lib/features')
var keyboard = require('lib/keyboard')

var core = require('features/core')

var widgets = require('features/ui-widgets')

var overlay = require('lib/widget/overlay')
var browse = require('lib/widget/browse')
var browseWalk = require('lib/widget/browse-walk')



/*********************************************************************/

if(typeof(process) != 'undefined'){
	var copy = file.denodeify(fse.copy)
	var ensureDir = file.denodeify(fse.ensureDir)
}



/*********************************************************************/

var IndexFormat = 
module.IndexFormat = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'index-format',

	config: {
		'index-dir': '.ImageGrid',

		'preview-sizes': [
			75,
			150,
			350,
			900,
			1000,
			1280,
			1920,
		],

		// Supported fields:
		// 	$INDEX			- index directory name
		// 	$RESOLUTION		- preview resolution
		// 	$GID			- image GID
		// 	$NAME			- image name
		//
		// XXX make this used in loader too...
		'preview-path-template': '${INDEX}/${RESOLUTION}px/${GID} - ${NAME}.jpg',
	},
})



/*********************************************************************/

var FileSystemInfoActions = actions.Actions({
	getImagePath: ['- System/',
		function(gid, type){
			gid = this.data.getImage(gid)

			var img = this.images[gid]

			return pathlib.join(img.base_path || this.location.path, img.path)
		}],
})


var FileSystemInfo = 
module.FileSystemInfo = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'fs-info',
	depends: [
		'location',
		'index-format',
	],

	actions: FileSystemInfoActions,

	isApplicable: function(){ 
		return this.runtime == 'node' || this.runtime == 'nw' },
})



/*********************************************************************/
// Loader... 


// NOTE: this will also manage .location.from
var FileSystemLoaderActions = actions.Actions({
	config: {
		'image-file-pattern': '*+(jpg|jpeg|png|JPG|JPEG|PNG)',

		'image-file-read-stat': true,

		// XXX if true and multiple indexes found, load only the first 
		// 		without merging...
		'load-first-index-only': false,
	},

	clone: [function(full){
		return function(res){
			if(this.location){
				res.__location = JSON.parse(JSON.stringify(this.__location))
			}
		}
	}],

	// XXX should this be more general???
	reloadState: ['File/Reload viewer state...',
		function(){
			if(this.location 
					&& this.location.method 
					&& this.location.path){
				return this[this.location.method](this.location.path)
			}
		}],

	// XXX is this a hack???
	// XXX need a more generic form...
	checkPath: ['- File/',
		function(path){ return fse.existsSync(path) }],

	// 
	// This maintains:
	// 	.location.loaded		- list of loaded URLs...
	//
	// NOTE: when passed no path this will not do anything...
	// NOTE: this will add a .from field to .location, this will indicate
	// 		the date starting from which saves are loaded.
	//
	// XXX BUG: if no <keyword>.json files exist this will not load 
	// 		anything...
	// 		To reproduce:
	// 			.loadImages(..)
	// 			.saveIndex()
	// 			.loadIndex(..)
	// XXX add a symmetric equivalent to .prepareIndexForWrite(..) so as 
	// 		to enable features to load their data...
	// XXX should this return a promise??? ...a clean promise???
	// XXX look inside...
	loadIndex: ['- File/Load index',
		function(path, from_date, logger){
			var that = this

			if(path == null){
				return
			}
			if(from_date && from_date.emit != null){
				logger = from_date
				from_date = null
			}

			// XXX get a logger...
			logger = logger || this.logger

			// XXX make this load incrementally (i.e. and EventEmitter
			// 		a-la glob)....
			//file.loadIndex(path, this.config['index-dir'], logger)
			return file.loadIndex(path, this.config['index-dir'], from_date, logger)
				.catch(function(err){
					// XXX
					console.error(err)
				})
				.then(function(res){
					// XXX if res is empty load raw...

					// XXX use the logger...
					//console.log('FOUND INDEXES:', Object.keys(res).length)

					// skip nested paths...
					// XXX make this optional...
					// XXX this is best done BEFORE we load all the 
					// 		indexes, e.g. in .loadIndex(..)
					var paths = Object.keys(res)
					var skipped = []
					paths
						.sort()
						.forEach(function(p){
							// already removed...
							if(skipped.indexOf(p) >= 0){
								return
							}

							paths
								// get all paths that fully contain p...
								.filter(function(o){
									return o != p && o.indexOf(p) == 0
								})
								// drop all longer paths...
								.forEach(function(e){
									skipped.push(e)
									delete res[e]
								})
						})
					//console.log('SKIPPING NESTED:', skipped.length)

					var index
					var base_path
					var loaded = []

					// NOTE: res may contain multiple indexes...
					//for(var k in res){
					for(var i=0; i < paths.length; i++){
						var k = paths[i]

						// skip empty indexes...
						// XXX should we rebuild  or list here???
						if(res[k].data == null || res[k].images == null){
							continue
						}

						var part = file.buildIndex(res[k], k)

						// load the first index...
						if(index == null){
							// XXX use the logger...
							//console.log('LOADING:', k, res)
							logger && logger.emit('base index', k, res)

							index = part

						// merge indexes...
						// XXX need to skip sub-indexes in the same sub-tree...
						// 		...skip any path that fully contains an 
						// 		already loaded path..
						// XXX load data in chunks rather than merge...
						} else {
							//console.log('MERGING:', k, part)
							logger && logger.emit('merge index', k, res)

							// merge...
							index.data.join(part.data)
							index.images.join(part.images)
						}

						loaded.push(k)

						// XXX do a better merge and remove this...
						// 		...we either need to lazy-load clustered indexes
						// 		or merge, in both cases base_path should reflet
						// 		the fact that we have multiple indexes...
						if(that.config['load-first-index-only']){
							break
						}
					}

					logger && logger.emit('load index', index)

					that.load(index)

					that.__location = {
						path: path,
						loaded: loaded,
						method: 'loadIndex',
					}

					if(from_date){
						that.__location.from = from_date
					}
				})
		}],
	// XXX use the logger...
	// XXX add a recursive option...
	// 		...might also be nice to add sub-dirs to ribbons...
	// XXX make image pattern more generic...
	// XXX should this return a promise??? ...a clean promise???
	loadImages: ['- File/Load images',
		function(path, logger){
			if(path == null){
				return
			}

			var that = this

			// NOTE: we set this before we start the load so as to let 
			// 		clients know what we are loading and not force them
			// 		to wait to find out...
			// XXX not sure if this is the way to go...
			this.__location = {
				path: path,
				method: 'loadImages',
			}

			return new Promise(function(resolve, reject){
				glob(path + '/'+ that.config['image-file-pattern'], 
						{stat: !!that.config['image-file-read-stat']})
					.on('error', function(err){
						console.log('!!!!', err)
						reject(err)
					})
					/*
					.on('match', function(img){
						// XXX stat stuff...
						fse.statSync(img)
					})
					*/
					.on('end', function(lst){ 
						that.loadURLs(lst, path)
						// XXX do we need to normalize paths after we get them from glob??
						//that.loadURLs(lst.map(pathlib.posix.normalize), path)
						//that.loadURLs(lst
						//	.map(function(p){ return util.normalizePath(p) }), path)

						if(!!that.config['image-file-read-stat']){
							var stats = this.statCache
							var p = pathlib.posix

							that.images.forEach(function(gid, img){
								var stat = stats[p.join(img.base_path, img.path)]

								img.atime = stat.atime
								img.mtime = stat.mtime
								img.ctime = stat.ctime
								img.birthtime = stat.birthtime

								img.size = stat.size

								// XXX do we need anything else???
							})
						}

						// NOTE: we set it again because .loadURLs() does a clear
						// 		before it starts loading...
						// 		XXX is this a bug???
						that.__location = {
							path: path,
							method: 'loadImages',
						}

						resolve(that)
					})
			})
		}],

	// XXX auto-detect format or let the user chose...
	// XXX should this return a promise??? ...a clean promise???
	// XXX should the added section be marked or sorted???
	loadPath: ['- File/Load path (STUB)',
		function(path, logger){
			// XXX check if this.config['index-dir'] exists, if yes then
			// 		.loadIndex(..) else .loadImages(..)

			//this.location.method = 'loadImages'
		}],

	// XXX should this return a promise??? ...a clean promise???
	// XXX revise logger...
	loadNewImages: ['File/Load new images',
		function(path, logger){
			path = path || this.location.path
			logger = logger || this.logger

			if(path == null){
				return
			}

			var that = this

			// cache the loaded images...
			var loaded = this.images.map(function(gid, img){ return img.path })
			var base_pattern = RegExp('^'+path)

			// find images...
			glob(path + '/'+ this.config['image-file-pattern'],
					{stat: !!this.config['image-file-read-stat']})
				.on('end', function(lst){ 
					var stats = this.statCache

					// create a new images chunk...
					lst = lst
						// filter out loaded images...
						.filter(function(p){
							return loaded.indexOf(
								util.normalizePath(p)
									// remove the base path if it exists...
									.replace(base_pattern, '')
									// normalize the leading './'
									.replace(/^[\/\\]+/, './')) < 0
						})


					// nothing new...
					if(lst.length == 0){
						// XXX
						logger && logger.emit('loaded', [])
						return
					}

					// XXX
					logger && logger.emit('queued', lst)

					var new_images = images.Images.fromArray(lst, path)
					var gids = new_images.keys()
					var new_data = that.data.constructor.fromArray(gids)

					new_images.forEach(function(gid, img){
						var stat = stats[p.join(img.base_path, img.path)]

						img.atime = stat.atime
						img.mtime = stat.mtime
						img.ctime = stat.ctime
						img.birthtime = stat.birthtime

						img.size = stat.size

						// XXX do we need anything else???
					})

					// merge with index...
					// NOTE: we are prepending new images to the start...
					// NOTE: all ribbon gids will change here...
					var cur = that.data.current
					// XXX this does not seem to work...
					//that.data = new_data.join(that.data)
					that.data = new_data.join('top', that.data)
					that.data.current = cur

					that.images.join(new_images)

					that.reload()

					// XXX report that we are done...
					logger && logger.emit('loaded', lst)
				})
		}],

	clear: [function(){
		delete this.__location
	}],
})


var FileSystemLoader = 
module.FileSystemLoader = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'fs-loader',
	depends: [
		'fs-info',
		'location',
		'tasks',
	],
	suggested: [
		'ui-fs-loader',
		'fs-url-history',
		'fs-save-history',
	],

	actions: FileSystemLoaderActions,

	isApplicable: function(){ 
		return this.runtime == 'node' || this.runtime == 'nw' },
})



//---------------------------------------------------------------------
// Loader UI...

// XXX would need to delay the original action while the user is 
// 		browsing...
var makeBrowseProxy = function(action, callback){
	return widgets.uiDialog(function(path, logger){
		var that = this
		path = path || this.location.path
		// XXX should we set a start path here to current???
		return this.browsePath(path, 
			function(path){ 
				var res = that[action](path, logger) 
				callback && callback.call(that, path)
				return res
			})
	})
}


// XXX show list of indexes when more than one are found....
// 		Ex:
// 			- <index-1>		x 	- 'x' will strike out the element...
// 			- <index-2>		x
// 			- ...
// 			- load all			- load all non striked out elements
// 		...would be nice to add either ability to sort manually or some 
// 		modes of auto-sorting, or both...
// 		...might be a good idea to add root images with an option to 
// 		load them...
// 			...do not think that recursively searching for images is a 
// 			good idea...
var FileSystemLoaderUIActions = actions.Actions({
	config: {
		// list of loaders to complete .browsePath(..) action
		//
		// NOTE: these will be displayed in the same order as they appear
		// 		in the list.
		// NOTE: the first one is auto-selected.
		'path-loaders': [
			'loadIndex',
			'loadImages',
			//'loadPath',
		],

		'file-browser-settings': {
			disableFiles: true,
			showNonTraversable: true,
			showDisabled: true,
		},
	},

	// FS browser...
	//
	// XXX should the loader list be nested or open in overlay (as-is now)???
	browsePath: ['File/Browse file system...',
		widgets.makeUIDialog(function(base, callback){
			var that = this
			base = base || this.location.path || '/'

			var o = browseWalk.makeWalk(
						null, base, this.config['image-file-pattern'],
						this.config['file-browser-settings'])
					// path selected...
					.open(function(evt, path){ 
						var item = o.selected

						// single loader...
						if(callback && callback.constructor === Function){
							// close self and parent...
							o.parent.close() 

							callback(path)

						// list of loaders...
						} else {
							// user-provided list...
							if(callback){
								var loaders = callback

							// build the loaders list from .config...
							} else {
								var loaders = {}
								that.config['path-loaders'].forEach(function(m){
									loaders[that.getDoc(m)[m][0].split('/').pop()] = function(){ 
										return that[m](path) 
									}
								})
							}

							// show user the list...
							var so = that.Overlay(browse.makeList(null, loaders)
								.on('update', function(){
									// select top element...
									so.client.select(0)
								})
								// close self and parent...
								.open(function(){
									so.close()
									o.parent.close() 
								}))
								// closed menu...
								.close(function(){
									//o.parent.focus()
									o.select(item)
								})

							return so
						}
					})
					// we closed the browser -- save settings to .config...
					.on('close', function(){

						var config = that.config['file-browser-settings']

						config.disableFiles = o.options.disableFiles
						config.showDisabled = o.options.showDisabled
						config.showNonTraversable = o.options.showNonTraversable
					})

			return o
		})],

	// Browse indexes/images...
	//
	// NOTE: if no path is passed (null) these behave just like .browsePath(..)
	// 		with the appropriate callback otherwise it will just load 
	// 		the given path (no UI) while .browsePath(..) will load the 
	// 		UI in all cases but will treat the given path as a base path 
	// 		to start from.
	browseIndex: ['File/Load index...', makeBrowseProxy('loadIndex')],
	browseImages: ['File/Load images...', makeBrowseProxy('loadImages')],

	browseSubIndexes: ['File/List sub-indexes...',
		widgets.makeUIDialog(function(){
			var that = this
			var index_dir = this.config['index-dir']

			var o = browse.makeLister(null, function(path, make){
				var dialog = this
				var path = that.location.path

				if(that.location.method != 'loadIndex'){
					make('No indexes loaded...', null, true)
					return
				}

				// indicate that we are working...
				var spinner = make('...')

				// XXX we do not need to actually read anything....
				//file.loadIndex(path, that.config['index-dir'], this.logger)
				// XXX we need to prune the indexes -- avoid loading nested indexes...
				file.listIndexes(path, index_dir)
					.on('error', function(err){
						console.error(err)
					})
					.on('end', function(res){

						// we got the data, we can now remove the spinner...
						spinner.remove()

						res.forEach(function(p){
							// trim local paths and keep external paths as-is...
							p = p.split(index_dir)[0]
							var txt = p.split(path).pop()
							txt = txt != p ? './'+pathlib.join('.', txt) : txt

							make(txt)
								.on('open', function(){
									that.loadIndex(p)
								})
						})
					})
			})
			.on('open', function(){
				o.parent.close()
			})

			return o
		})],
})


// XXX is this a good name???
var FileSystemLoaderUI = 
module.FileSystemLoaderUI = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-fs-loader',
	depends: [
		'ui',
		'fs-loader'
	],

	actions: FileSystemLoaderUIActions,
})



//---------------------------------------------------------------------
// Save History...

var FileSystemSaveHistoryActions = actions.Actions({
	// Save comments...
	//
	// Format:
	// 	{
	// 		// comment staged for next .saveIndex(..)...
	// 		'current': <comment>,
	//
	// 		<timestamp>: <comment>,
	// 		...
	// 	}
	savecomments: null,

	getSaveComment: ['- File/',
		function(save){
			return this.savecomments && this.savecomments[save || 'current'] || '' }],
	// Comment a save...
	//
	// 	Comment current save...
	// 	.setSaveComment(comment)
	// 		-> actions
	//
	// 	Reset current save comment...
	// 	.setSaveComment(null)
	// 		-> actions
	//
	// 	Comment specific save...
	// 	.setSaveComment(save, comment)
	// 		-> actions
	//
	// 	Reset specific save comment...
	// 	.setSaveComment(save, null)
	// 		-> actions
	//
	// NOTE: "save" is the save format as returned by file.groupByDate(..),
	// 		or .loadSaveHistoryList(..)
	// 		...normally it is Date.timeStamp() compatible string.
	setSaveComment: ['- File/Comment a save',
		function(save, comment){
			var comments = this.savecomments = this.savecomments || {}

			// no explicit save given -- stage a comment for next save...
			if(comment === undefined){
				comment = save
				save = 'current'
			}

			if(comment === undefined){
				return

			} else if(comment == null){
				delete comments[save]

			} else {
				comments[save] = comment
			}

			this.markChanged('savecomments')
		}],

	loadSaveHistoryList: ['- File/',
		function(path){
			path = path || this.location.path

			return file.loadSaveHistoryList(path)
		}],
})


var FileSystemSaveHistory = 
module.FileSystemSaveHistory = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'fs-save-history',
	depends: [
		'fs-loader'
	],
	suggested: [
		'ui-fs-save-history',
	],

	actions: FileSystemSaveHistoryActions,

	handlers: [
		// save/resore .savecomments
		// 
		['json',
			function(res){
				if(this.savecomments != null){
					res.savecomments = JSON.parse(JSON.stringify(this.savecomments))
				}
			}],
		['load',
			function(_, data){
				if(data.savecomments != null){
					this.savecomments = data.savecomments
				}
			}],

		// Prepare comments for writing...
		//
		// NOTE: defining this here enables us to actually post-bind to
		// 		an action that is defined later or may not even be 
		// 		available.
		['prepareIndexForWrite',
			function(res){
				var changed = this.changes == null 
					|| this.changes.savecomments

				if(changed){
					var comments = res.raw.savecomments || {}

					// set the 'current' comment to the correct date...
					if(comments.current){
						comments[res.date] = comments.current
						delete comments.current
					}

					res.prepared.savecomments = comments
				}
			}],
		// replace .savecomments['current'] with .location.from...
		//
		// NOTE: this will also drop any unsaved changes from browsing 
		// 		history...
		['saveIndex',
			function(res){
				var that = this
				var comments = this.savecomments

				if(comments && comments.current){
					res
						.then(function(){
							comments[that.location.from] = comments.current
							delete comments.current
						})
				}

				delete this.unsaved_index
			}],
	]
})



//---------------------------------------------------------------------
// Save History UI...

// XXX add comment editing...
// XXX should this also list journal stuff or have the ability for extending???
var FileSystemSaveHistoryUIActions = actions.Actions({
	// Saved original index state before loading a state from history...
	//
	unsaved_index: null,

	// List save history dialog...
	//
	//	.location.from			- set to timestamp of save state when 
	//								selecting a non-top state.
	//								NOTE: this may be set to last save 
	//									state.
	// 	.location.historic		- set to true when at a non-top state.
	//
	// For multiple indexes this will show the combined history and 
	// selecting a postion will load all the participating indexes to 
	// that specific date or closest earlier state.
	//
	// Unsaved changes will be saved to .unsaved_index when switching 
	// from current to a historic state.
	//
	// NOTE: this will show no history if .location.method is not 'loadIndex'..
	// NOTE: this will set changes to all when loading a historic state
	// 		that the latest and to non otherwise....
	//
	// XXX add comment editing...
	// XXX might be a good idea to show a diff of some kind or at least
	// 		what .changed when writing a save...
	listSaveHistory: ['File/History...',
		widgets.makeUIDialog(function(){
			var that = this

			var _makeTitle = function(title, date, a){
				title = [title]
				date = date || 'current'
				a = a || that

				var comment = a.savecomments && a.savecomments[date] 
				//title.push(comment || '')
				comment && title.push(comment)

				// XXX is this the best format???
				return title.join(' - ')
			}

			var o = browse.makeLister(null, function(path, make){
				var dialog = this

				var from = that.location.from

				if(that.changes !== false){
					make(_makeTitle('Current state (unsaved)', 'current'))	

					make('---')
				}

				// only search for history if we have an index loaded...
				if(that.location.method != 'loadIndex'){
					make('No history...', {disabled: true})	

					// select the 'Unsaved' item...
					dialog.select()
						.addClass('highlighted')

					return
				}

				// indicate that we are working...
				var spinner = make('...')

				that.loadSaveHistoryList()
					.catch(function(err){
						// XXX
						console.error(err)
					})
					.then(function(data){
						var list = []

						// got the data, remove the spinner...
						spinner.remove()

						Object.keys(data).forEach(function(path){
							Object.keys(data[path]).forEach(function(d){
								list.push(d)
							})
						})

						list
							.sort()
							.reverse()

						// Special case: unsaved state...
						if(that.unsaved_index){
							var unsaved = that.unsaved_index

							make(_makeTitle('Original state (unsaved)', 'current', unsaved))	
								.on('open', function(){
									that.load(unsaved)

									delete that.unsaved_index
								})

						// Special case: top save state is the default, 
						// no need to mark anything for change, but only
						// if nothing changed...
						} else if(that.changes === false){
							var first = list.shift()
							first && make(_makeTitle(Date.fromTimeStamp(first).toShortDate(), first))	
								.on('open', function(){
									that.loadIndex(that.location.path, first)
								})
						}

						list
							.forEach(function(d){
								var txt = Date.fromTimeStamp(d).toShortDate()

								make(_makeTitle(Date.fromTimeStamp(d).toShortDate(), d))	
									.attr('timestamp', d)
									.on('open', function(){
										// auto save...
										if(that.changes !== false
												&& !that.location.historic){
											that.unsaved_index = that.json()
										}

										that.loadIndex(that.location.path, d)
											.then(function(){
												that.markChanged('all')

												that.location.historic = true

												// remove 'current' comments
												// from loaded state...
												//
												// NOTE: the original 'current'
												// 		comment is saved to
												// 		.unsaved_index
												delete that.savecomments.current
											})
									})
									// mark the current loaded position...
									.addClass(d == from ? 'selected highlighted' : '')
							})

						make.done()

						// NOTE: here we will select 'Latest' if nothing
						// 		was selected...
						dialog.select()
							.addClass('highlighted')
					})
			})
			.on('open', function(){
				o.parent.close()
			})

			return o
		})],
})


var FileSystemSaveHistoryUI = 
module.FileSystemSaveHistoryUI = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-fs-save-history',
	depends: [
		'ui',
		'fs-save-history',
	],

	actions: FileSystemSaveHistoryUIActions,

	handlers: [
		['saveIndex',
			function(res){
				delete this.unsaved_index
			}],
	]
})



//---------------------------------------------------------------------
// URL History...

var pushToHistory = function(action, to_top, checker){
	return [action, 
		function(_, path){ 
			path = util.normalizePath(path)
			if(path){
				this.pushURLToHistory(
					util.normalizePath(path), 
					action, 
					checker || 'checkPath') 
			}
			if(to_top){
				this.setTopURLHistory(path)
			}
		}]
}

var FileSystemURLHistory = 
module.FileSystemLoaderURLHistory = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'fs-url-history',
	depends: [
		'fs-loader',
		'url-history',
	],
	suggested: [
		'ui-fs-url-history',
	],

	handlers: [
		pushToHistory('loadImages'), 
		pushToHistory('loadIndex'), 
		pushToHistory('loadPath'), 
		//pushToHistory('loadNewImages'), 
	],
})



//---------------------------------------------------------------------
// URL History UI...

// Opening the url via .browsePath(..) if url is in history will move 
// it to top of list...
var FileSystemURLHistoryUI = 
module.FileSystemLoaderURLHistoryUI = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-fs-url-history',
	depends: [
		'ui-fs-loader',
		'fs-url-history',
	],

	handlers: [
		['browsePath', 
			function(res){ 
				var that = this
				res.open(function(_, path){
					that.setTopURLHistory(path) 
				})
			}],
	],
})



//---------------------------------------------------------------------
// Writer...

var FileSystemWriterActions = actions.Actions({
	config: {
		//'index-filename-template': '${DATE}-${KEYWORD}.${EXT}',

		'export-path': null,
		'export-paths': [],

		'export-preview-name-pattern': '%f',
		'export-preview-name-patterns': [
			'%f',
			'%n%(-bookmarked)b%e',
			'%n%(-marked)m%e',
		],

		'export-level-directory-name': 'fav',
		'export-level-directory-names': [
			'fav',
			'select',
		],

		// XXX add options to indicate:
		// 		- long side
		// 		- short side
		// 		- vertical
		// 		- horizontal
		// 		- ...
		// XXX this repeats sharp.SharpActions.config['preview-sizes']
		'export-preview-sizes': [
			'900',
			'1000',
			'1280',
			'1920',
		],
		'export-preview-size': 1000,
	},

	// This can be:
	// 	- null/undefined	- write all
	// 	- true				- write all
	// 	- false				- write nothing
	// 	- {
	//		// write/skip data...
	//		data: <bool>,
	//
	//		// write/skip images or write a diff including the given 
	//		// <gid>s only...
	//		images: <bool> | [ <gid>, ... ],
	//
	//		// write/skip tags...
	//		tags: <bool>,
	//
	//		// write/skip bookmarks...
	//		bookmarked: <bool>,
	//
	//		// write/skip selected...
	//		selected: <bool>,
	// 	  }
	//
	// NOTE: in the complex format all fields ar optional; if a field 
	// 		is not included it is not written (same as when set to false)
	// NOTE: .current is written always.
	chages: null,

	clone: [function(full){
			return function(res){
				res.changes = null
				if(full && this.hasOwnProperty('changes') && this.changes){
					res.changes = JSON.parse(JSON.stringify(this.changes))
				}
			}
		}],

	// Mark data sections as changed...
	//
	//	Mark everything changed...
	//	.markChanged('all')
	//
	//	Mark nothing changed...
	//	.markChanged('none')
	//
	//	Mark a section changed...
	//	.markChanged('data')
	//	.markChanged('tags')
	//	.markChanged('selected')
	//	.markChanged('bookmarked')
	//
	//	Mark image changed...
	//	.markChanged(<gid>, ...)
	//
	//
	// NOTE: when .changes is null (i.e. everything changed, marked via
	// 		.markChanged('all')) then calling this with anything other 
	// 		than 'none' will have no effect.
	markChanged: ['- System/',
		function(section){
			var that = this
			var args = util.args2array(arguments)
			//var changes = this.changes = 
			var changes = 
				this.hasOwnProperty('changes') ?
					this.changes || {}
					: {}

			//console.log('CHANGED:', args)

			// all...
			if(args.length == 1 && args[0] == 'all'){
				// NOTE: this is better than delete as it will shadow 
				// 		the parent's changes in case we got cloned from
				// 		a live instance...
				//delete this.changes
				this.changes = null

			// none...
			} else if(args.length == 1 && args[0] == 'none'){
				this.changes = false 

			// everything is marked changed, everything will be saved
			// anyway...
			// NOTE: to reset this use .markChanged('none') and then 
			// 		manually add the desired changes...
			} else if(this.changes == null){
				return

			} else {
				var images = (changes.images || [])

				args.forEach(function(arg){
					var gid = that.data.getImage(arg)

					// special case: image gid...
					if(gid != -1 && gid != null){
						images.push(gid)
						images = images.unique()

						changes.images = images
						that.changes = changes

					// all other keywords...
					} else {
						changes[arg] = true
						that.changes = changes
					}
				})
			}
		}],

	// Convert json index to a format compatible with file.writeIndex(..)
	//
	// This is here so as other features can participate in index
	// preparation...
	// There are several stages features can control the output format:
	// 	1) .json() action
	// 		- use this for global high level serialization format
	// 		- the output of this is .load(..) compatible
	// 	2) .prepareIndexForWrite(..) action
	// 		- use this for file system write preparation
	// 		- this directly affects the index structure
	//
	// This will get the base index, ignoring the cropped state.
	//
	// Returns:
	// 	{
	// 		// Timestamp...
	// 		// NOTE: this is the timestamp used to write the index.
	// 		date: <timestamp>,
	//
	// 		// This is the original json object, either the one passed as
	// 		// an argument or the one returned by .json('base')
	// 		raw: <original-json>,
	//
	// 		// this is the prepared object, the one that is going to be
	// 		// saved.
	// 		prepared: <prepared-json>,
	// 	}
	//
	//
	// The format for the <prapared-json> is as follows:
	// 	{
	// 		<keyword>: <data>,
	// 		...
	// 	}
	//
	// The <prepared-json> is written out to a fs index in the following
	// way:
	// 		<index-dir>/<timestamp>-<keyword>.json
	//
	// 	<index-dir>		- taken from .config['index-dir'] (default: '.ImageGrid')
	// 	<timestamp>		- as returned by Date.timeStamp() (see: jli)
	//
	// For more info see file.writeIndex(..) and file.loadIndex(..).
	//
	prepareIndexForWrite: ['- File/Prepare index for writing',
		function(json, full){
			json = json || this.json('base')
			var changes = full ? null 
				: this.hasOwnProperty('changes') ? this.changes
				: null
			return {
				date: Date.timeStamp(),
				raw: json,
				prepared: file.prepareIndex(json, changes),
			}
		}],
	
	// NOTE: with no arguments this will save index to .location.path
	// XXX should this return a promise??? ...a clean promise???
	// XXX BUG: after .loadImages(..) and without arguments this produces
	// 		a result that is not loaded....
	saveIndex: ['- File/',
		function(path, logger){
			var that = this

			path = path || this.location.loaded
			path = path && path.length == 1 ? path[0] : path 

			// XXX
			if(path instanceof Array){
				console.error('saving to merged indexes not yet supported...')
				return
			}

			// XXX
			if(path == null && this.location.method != 'loadIndex'){
				path = this.location.path
			}

			// resolve relative paths...
			if(/^(\.\.?[\\\/]|[^\\\/])/.test(path) 
					// and skip windows drives...
					&& !/^[a-z]:[\\\/]/i.test(path)){
				// XXX do we need to normalize???
				path = this.location.path +'/'+ path
			}

			// XXX get a logger...
			logger = logger || this.logger

			// XXX get real base path...
			//path = path || this.location.path +'/'+ this.config['index-dir']

			var index = this.prepareIndexForWrite()

			return file.writeIndex(
					index.prepared, 
					// XXX should we check if index dir is present in path???
					//path, 
					path +'/'+ this.config['index-dir'], 
					index.date,
					this.config['index-filename-template'], 
					logger || this.logger)
				.then(function(){
					that.location.method = 'loadIndex'
					that.location.from = index.date
				})
		}],

	// XXX ways to treat a collection:
	// 		- crop data
	// 		- independent index
	// XXX save to: .ImageGrid/collections/<title>/
	// XXX move to a feature???
	// XXX API: save/load/list/remove
	// 		...need to track save location (not the save as the index)...
	// XXX
	saveCollection: ['- File/Save collection',
		function(title){
			// XXX
		}],

	// Export current state as a full loadable index
	//
	// XXX resolve env variables in path...
	// XXX what sould happen if no path is given???
	// XXX should this return a promise??? ...a clean promise???
	// XXX add preview selection...
	// XXX handle .image.path and other stack files...
	// XXX local collections???
	exportIndex: ['- File/Export/Export index',
		function(path, logger){
			logger = logger || this.logger

			// XXX is this correct???
			path = path || './exported'

			// XXX resolve env variables in path...
			// XXX

			// resolve relative paths...
			if(/^(\.\.?[\\\/]|[^\\\/])/.test(path) 
					// and skip windows drives...
					&& !/^[a-z]:[\\\/]/i.test(path)){
				// XXX do we need to normalize???
				path = this.location.path +'/'+ path
			}

			var json = this.json()

			// get all loaded gids...
			var gids = []
			for(var r in json.data.ribbons){
				this.data.makeSparseImages(json.data.ribbons[r], gids)
			}
			gids = gids.compact()

			// build .images with loaded images...
			// XXX list of previews should be configurable (max size)
			var images = {}
			gids.forEach(function(gid){
				var img = json.images[gid]
				if(img){
					images[gid] = json.images[gid]

					// remove un-needed previews...
					// XXX
				}
			})

			// prepare and save index to target path...
			json.data.order = gids
			json.images = images
			// XXX should we check if index dir is present in path???
			var index_path = path +'/'+ this.config['index-dir']

			// copy previews for the loaded images...
			// XXX should also optionally populate the base dir and nested favs...
			var base_dir = this.location.path

			gids.forEach(function(gid){
				var img = json.images[gid]
				var img_base = img.base_path
				var previews = img.preview

				// NOTE: we are copying everything to one place so no 
				// 		need for a base path...
				delete img.base_path

				// XXX copy img.path -- the main image, especially when no previews present....
				// XXX

				if(previews || img.path){
					Object.keys(previews || {})
						.map(function(res){ return decodeURI(previews[res]) })
						// XXX should we copy this, especially if it's a hi-res???
						.concat([img.path || null])
						.forEach(function(preview_path){
							if(preview_path == null){
								return
							}

							var from = (img_base || base_dir) +'/'+ preview_path
							var to = path +'/'+ preview_path

							// XXX do we queue these or let the OS handle it???
							// 		...needs testing, if node's fs queues the io
							// 		internally then we do not need to bother...
							// XXX
							ensureDir(pathlib.dirname(to))
								.catch(function(err){
									logger && logger.emit('error', err) })
								.then(function(){
									return copy(from, to)
										// XXX do we need to have both of this 
										// 		and the above .catch(..) or can
										// 		we just use the one above (after
										// 		.then(..))
										.then(function(){
											logger && logger.emit('done', to) })
										.catch(function(err){
											logger && logger.emit('error', err) })
								})
						})
				}
			})

			// NOTE: if we are to use .saveIndex(..) here, do not forget
			// 		to reset .changes
			file.writeIndex(
				this.prepareIndexForWrite(json, true).prepared, 
				index_path, 
				this.config['index-filename-template'], 
				logger || this.logger)
			
		}],
	
	// XXX might also be good to save/load the export options to .ImageGrid-export.json
	// XXX resolve env variables in path... (???)
	// XXX make custom previews (option)...
	// 		...should this be a function of .images.getBestPreview(..)???
	// XXX report errors...
	// XXX stop the process on errors...
	// XXX use tasks...
	exportDirs: ['- File/Export/Export ribbons as directories',
		function(path, pattern, level_dir, size, logger){
			logger = logger || this.logger
			var that = this
			var base_dir = this.location.path

			// XXX resolve env variables in path...
			// XXX

			// resolve relative paths...
			if(/^(\.\.?[\\\/]|[^\\\/])/.test(path) 
					// and skip windows drives...
					&& !/^[a-z]:[\\\/]/i.test(path)){
				// XXX do we need to normalize???
				path = this.location.path +'/'+ path
			}

			var to_dir = path

			// get/set the config data...
			// XXX should this store the last set???
			level_dir = level_dir || this.config['export-level-directory-name'] || 'fav'
			size = size || this.config['export-preview-size'] || 1000
			pattern = pattern || this.config['export-preview-name-pattern'] || '%f'


			// XXX need to abort on fatal errors...
			this.data.ribbon_order
				.slice()
				.reverse()
				.forEach(function(ribbon){
					// NOTE: this is here to keep the specific path local to 
					// 		this scope...
					var img_dir = to_dir

					ensureDir(pathlib.dirname(img_dir))
						.catch(function(err){
							logger && logger.emit('error', err) })
						.then(function(){
							that.data.ribbons[ribbon].forEach(function(gid){
								var img = that.images[gid]
								var img_name = pathlib.basename(img.path || (img.name + img.ext))


								// get best preview...
								var from = decodeURI(
									(img.base_path || base_dir) 
										+'/'
										+ that.images.getBestPreview(gid, size).url)

								// XXX see if we need to make a preview (sharp)
								// XXX

								// XXX get/form image name... 
								// XXX might be a good idea to connect this to the info framework...
								var ext = pathlib.extname(img_name)
								var tags = that.data.getTags(gid)

								var name = pattern
									// file name...
									.replace(/%f/, img_name)
									.replace(/%n/, img_name.replace(ext, ''))
									.replace(/%e/, ext)

									// gid...
									.replace(/%gid/, gid)
									// XXX get the correct short gid length...
									.replace(/%g/, gid.slice(-7, -1))

									// order...
									.replace(/%i/, that.data.getImageOrder(gid))
									.replace(/%I/, that.data.getImageOrder(gid, 'global'))

									// tags...
									// XXX test: %n%(b)b%(m)m%e
									.replace(
										/%\((.*)\)m/, tags.indexOf('selected') >= 0 ? '$1' : '')
									.replace(
										/%\((.*)\)b/, tags.indexOf('bookmark') >= 0 ? '$1' : '')

									// metadata...
									// XXX

								var to = img_dir +'/'+ name

								return copy(from, to)
									.then(function(){
										logger && logger.emit('done', to) })
									.catch(function(err){
										logger && logger.emit('error', err) })
							})
						})

					to_dir += '/'+level_dir
				})
		}]
})


var FileSystemWriter = 
module.FileSystemWriter = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'fs-writer',
	// NOTE: this is mostly because of the base path handling...
	depends: [
		'fs-loader',
		'index-format',
	],
	suggested: [
		'ui-fs-writer',
	],

	actions: FileSystemWriterActions,

	isApplicable: function(){ 
		return this.runtime == 'node' || this.runtime == 'nw' },

	// monitor changes...
	// XXX should we use .load(..) to trigger changes instead of .loadURLs(..)???
	// 		...the motivation is that .crop(..) may also trigger loads...
	// 		....needs more thought...
	handlers: [
		// clear changes...
		// XXX currently if no args are passed then nothing is 
		// 		done here, this might change...
		['loadIndex',
			function(res, path){
				if(path){
					//this.markChanged('none')
					var that = this
					res.then(function(){
						that.markChanged('none')
					})
				}
			}],
		['saveIndex',
			function(res, path){
				// NOTE: if saving to a different path than loaded do not
				// 		drop the .changes flags...
				if(!path || path == this.location.path){
					//this.markChanged('none')
					var that = this
					res.then(function(){
						that.markChanged('none')
					})
				}
			}],

		// everything changed...
		[[
			'loadURLs',
			'clear',
		], 
			function(){ 
				this.markChanged('all') 
			}],

		// data...
		[[
			//'clear',
			//'load',

			'setBaseRibbon',

			'shiftImageTo',
			'shiftImageUp',
			'shiftImageDown',
			'shiftImageLeft',
			'shiftImageRight',
			'shiftRibbonUp',
			'shiftRibbonDown',

			'sortImages',
			'reverseImages',
			'reverseRibbons',

			'group',
			'ungroup',
			'expandGroup',
			'collapseGroup',
		], 
			function(_, target){ this.markChanged('data') }],

		// image specific...
		[[
			'rotateCW',
			'rotateCCW',
			'flipHorizontal',
			'flipVertical',
		], 
			function(_, target){ this.markChanged(target) }],

		// tags and images...
		// NOTE: tags are also stored in images...
		['tag untag',
			function(_, tags, gids){
				var changes = []

				gids = gids || [this.data.getImage()]
				gids = gids.constructor !== Array ? [this.data.getImage(gids)] : gids

				tags = tags || []
				tags = tags.constructor !== Array ? [tags] : tags

				// images...
				changes = changes.concat(gids)

				// tags...
				if(tags.length > 0){
					changes.push('tags')

					// selected...
					if(tags.indexOf('selected') >= 0){
						changes.push('selected')
					}

					// bookmark...
					if(tags.indexOf('bookmark') >= 0){
						changes.push('bookmarked')
					}
				}

				this.markChanged.apply(this, changes)
			}],

	]
})


//---------------------------------------------------------------------
// Writer UI...

// XXX add writer UI feature...
// 		- save as.. (browser)
// 		- save if not base path present (browser)
var FileSystemWriterUIActions = actions.Actions({
	config: {
		'export-dialog-mode': 'Full index',

		'export-dialog-modes': {
			// XXX is this the right title???
			// XXX this is not yet working...
			'Save index to current location': {
				action: 'saveIndexHere',
				data: [
					'comment'
				],
			},
			'Full index': {
				action: 'exportIndex',
				data: [
					//'size',
					'target_dir',
					'comment',
				],
			},
			'Images only': {
				action: 'exportDirs',
				data: [
					'pattern',
					'size',
					'level_dir',
					'target_dir',
				],
			},
		},
	},

	// XXX this needs feedback...
	// XXX should this return a promise???
	saveIndexHere: ['File/Save',
		function(){ 
			if(this.location.path){ 
				this.saveIndex() 

			} else {
				this.browseSaveIndex()
			}
		}],
	// XXX should this be a UI action???
	// 		...at this point this depends on .saveIndexHere(..), thus 
	// 		it is here...
	// XXX should this return a promise???
	saveFullIndex: ['File/Save (full)',
		function(){
			return this
				.markChanged('all')
				.saveIndexHere()}],

	// XXX need to be able to make dirs...
	browseExportIndex: ['File/Export/Export Index to...',
		makeBrowseProxy('exportIndex')],
	// XXX need to be able to make dirs...
	browseExportDirs: ['File/Export/Export Images to...',
		makeBrowseProxy('exportDirs')],


	// Export dialog...
	//
	// Export <mode> is set by:
	// 		.config['export-mode']
	//
	// The fields used and their order is determined by:
	// 		.config['export-modes'][<mode>].data	(list)
	//
	// The action used to export is determined by:
	// 		.config['export-modes'][<mode>].action
	//
	//
	// Dialog fields...
	//
	// Format:
	// 	{
	// 		// Arguments:
	// 		//	actions		- the actions object
	// 		//	make		- browse item constructor 
	// 		//					(see: browse.Browser.update(..) for more info)
	// 		//	parent		- the parent dialog
	// 		<key>: function(actions, make, overlay){ ... },
	// 		...
	// 	}
	//
	// NOTE: .__export_dialog_fields__ can be defined both in the feature
	// 		as well as in the instance.
	__export_dialog_fields__: {
		'pattern': function(actions, make, parent){
			return make(['Filename pattern: ', 
					function(){
						return actions.config['export-preview-name-pattern'] || '%f' }])
				.on('open', 
					widgets.makeNestedConfigListEditor(actions, parent,
						'export-preview-name-patterns',
						'export-preview-name-pattern'))
		},
		'level_dir': function(actions, make, parent){
			return make(['Level directory: ', 
					function(){ 
						return actions.config['export-level-directory-name'] || 'fav' }])
				.on('open', 
					widgets.makeNestedConfigListEditor(actions, parent,
						'export-level-directory-names', 
						'export-level-directory-name'))
		},
		'size': function(actions, make, parent){
			return make(['Image size: ', 
					function(){ 
						return actions.config['export-preview-size'] || 1000 }])
				// XXX add validation???
				.on('open', 
					widgets.makeNestedConfigListEditor(actions, parent,
						'export-preview-sizes',
						'export-preview-size',
						{
							sort: function(a, b){ return parseInt(a) - parseInt(b) },
						}))

		},
		// XXX BUG: history closing errors -- non-critical...
		'target_dir': function(actions, make, parent){
			var elem = make(['To: ', 
				function(){ return actions.config['export-path'] || './' }], 
				{ buttons: [
					['browse', function(p){
						var e = this.filter('"'+p+'"', false)
						var path = e.find('.text').last().text()
						var txt = e.find('.text').first().text()

						// XXX add new dir global button...
						return actions.browsePath(path, 
							function(path){ 
								actions.config['export-path'] = path
								actions.config['export-paths'].splice(0, 0, path)

								parent.update()
								parent.select(txt)
							})
					}],
					// XXX BUG: closing this breaks on parant.focus()...
					['histroy', widgets.makeNestedConfigListEditor(actions, parent,
						'export-paths',
						'export-path',
						{
							new_button: false,
						})],
				]})
				// XXX make this editable???
				.on('open', function(){
					event.preventDefault()

					var path = elem.find('.text').last()
						.makeEditable({
							clear_on_edit: false,
							abort_keys: [
								'Esc',
							],
						})
						.on('edit-done', function(_, path){
							actions.config['export-path'] = path
							actions.config['export-paths'].indexOf(path) < 0
								&& actions.config['export-paths'].splice(0, 0, path)

						})
						.on('edit-aborted edit-done', function(evt, path){
							parent.update()
								.then(function(){
									parent.select(path)
								})
						})
				})
		},
		'comment': function(actions, make, parent){
			var elem = make(['Comment: ', 
				// XXX get staged comment???
				function(){ return actions.getSaveComment() }])
				.on('open', function(){
					event.preventDefault()

					// XXX multiline???
					var path = elem.find('.text').last()
						.makeEditable({
							multiline: true,
							clear_on_edit: false,
							abort_keys: [
								'Esc',
							],
						})
						.on('edit-done', function(_, text){
							actions.setSaveComment(text)
						})
						.on('edit-aborted edit-done', function(evt, text){
							parent.update()
								.then(function(){
									parent.select(text)
								})
						})
				})
		},
	},
	// XXX indicate export state: index, crop, image...
	exportDialog: ['File/Export/Export optioons...',
		widgets.makeUIDialog(function(){
			var that = this

			var o = browse.makeLister(null, function(path, make){
				var dialog = this
				var mode = that.config['export-dialog-mode'] || 'Images only'
				// if invalid mode get the first...
				mode = !that.config['export-dialog-modes'][mode] ?
					Object.keys(that.config['export-dialog-modes']).shift()
					: mode
				var data = that.config['export-dialog-modes'][mode].data

				// mode selector...
				make(['Export mode: ', 
						function(){ return mode }])
					.on('open', 
						widgets.makeNestedConfigListEditor(that, o,
							'export-dialog-modes',
							'export-dialog-mode',
							{
								new_button: false,
								itemButtons: [],
							}))

				// get the root and user fields...
				var fields = that.__export_dialog_fields__ || {}
				var base_fields = FileSystemWriterUIActions.__export_dialog_fields__ || {}
				// build the fields...
				data.forEach(function(k){
					(fields[k] 
							&& fields[k].call(that, that, make, dialog))
						|| (base_fields[k] 
								&& base_fields[k].call(that, that, make, dialog))
				})

				// Start/stop action...
				make([function(){
						// XXX indicate export state: index, crop, image...
						return 'Export'}]) 
					.on('open', function(){
						var mode = that.config['export-dialog-modes'][that.config['export-dialog-mode']]
						that[mode.action](
							that.config['export-path'] || undefined)
						dialog.parent.close()
					})
					.addClass('selected')

				make.done()
			})

			o.dom.addClass('metadata-view tail-action')

			return o
		})],
})


var FileSystemWriterUI = 
module.FileSystemWriterUI = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-fs-writer',
	depends: [
		'fs-writer', 
		'ui-fs-loader',
	],

	actions: FileSystemWriterUIActions,
})



//---------------------------------------------------------------------

core.ImageGridFeatures.Feature('fs', [
	'index-format',
	'fs-info',
	'fs-loader',
	'fs-writer',
])



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
