/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

// XXX this should not be imported!!!
// 		...something wrong with requirejs(..)
if(typeof(process) != 'undefined'){
	var child_process = requirejs('child_process')
	var fse = requirejs('fs-extra')
	var pathlib = requirejs('path')
	var glob = requirejs('glob')
	var wglob = requirejs('wildglob')

	var file = require('imagegrid/file')
}

var data = require('imagegrid/data')
var images = require('imagegrid/images')

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
		'image-file-skip-previews': false,

		'default-load-method': 'loadIndex',
	},

	// XXX is this a hack???
	// XXX need a more generic form...
	checkPath: ['- File/',
		function(path){ return fse.existsSync(path) }],

	// Load index...
	//
	// 	.loadIndex(path)
	// 		-> promise
	//
	// This maintains:
	// 	.location.loaded		- list of loaded URLs...
	//
	// NOTE: when passed no path this will not do anything...
	// NOTE: this will add a .from field to .location, this will indicate
	// 		the date starting from which saves are loaded.
	//
	// XXX do we need both this and file.buildIndex(..), we essentially create
	// 		a Data object and then create it again in .load()...
	// XXX look inside...
	loadIndex: ['- File/Load index',
		function(path, from_date, logger){
			var that = this
			var index_dir = util.normalizePath(this.config['index-dir'])
			// XXX get a logger...
			logger = logger || this.logger
			logger = logger && logger.push('Load')

			if(path == null){
				return
			}
			path = util.normalizePath(path)

			if(from_date && from_date.emit != null){
				logger = from_date
				from_date = null
			}

			// XXX make this load incrementally (i.e. and EventEmitter
			// 		a-la glob)....
			//file.loadIndex(path, this.config['index-dir'], logger)
			return file.loadIndex(path, index_dir, from_date, logger)
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
					}

					logger && logger.emit('load index', index)

					// prepare the location data...
					index.location = {
						path: path,
						loaded: loaded,
						method: 'loadIndex',
					}
					if(from_date){
						index.location.from = from_date
					}

					// this is the critical section, after this point we
					// are doing the actual loading....
					that.loadOrRecover(index) 
				})
		}],

	// Get image(s) previews...
	//
	//	Load current image previews...
	//	.getPreviews()
	//	.getPreviews('current')
	//		-> promise
	//
	//	Load previews for specific image...
	//	.getPreviews(gid)
	//		-> promise
	//
	//	Load all image previews...
	//	.getPreviews('*')
	//	.getPreviews('all')
	//		-> promise
	//
	//	Load previews that match glob pattern...
	//	.getPreviews(pattern)
	//		-> promise
	//		NOTE: this is useful for finding previews for example by 
	//			image name, e.g. .getPreviews('*' + ig.image[gid].name)
	//
	// NOTE: this will override image .preview and may change .path and
	// 		.base_path...
	// NOTE: if multiple sets of previews are located this will use the 
	// 		last found and set image .base_path and .path accordingly...
	//
	// XXX should this accept a list of gids???
	// XXX revise image .base_path and .path handling: should .base_path 
	// 		and .path be set relative to .located.path or relative to 
	// 		given path???
	getPreviews: ['- File/',
		function(pattern, path, images){
			images = images || this.images
			pattern = pattern == 'current' ? this.current + '*'
				: pattern == 'all' ? '*'
				// explicit gid...
				: pattern in images ? pattern + '*'
				// other pattern...
				: pattern != null ? pattern
				// default...
				: this.current + '*'
			path = path || this.location.path

			var index_dir = this.config['index-dir']

			return file.loadPreviews(path, pattern, null, index_dir)
				.then(function(previews){
					for(var l in previews){
						var p = previews[l]
						p && Object.keys(p).forEach(function(gid){
							if(gid in images){
								var base = pathlib.basename(l) == index_dir ? 
									pathlib.dirname(l) 
									: l

								// update .path and .base_path if they change...
								if(images[gid].base_path != base){
									// XXX
									console.warn('getPreviews(..): changing .base_path of image:', gid)

									var rel = pathlib.relative(images[gid].base_path, base)

									images[gid].path = pathlib.join(rel, images[gid].path) 
									images[gid].base_path = base
								}

								images[gid].preview = p[gid].preview
							}
						})
					}
					return images
				})
		}],

	// Get images in path...
	//
	// This will:
	// 	- get images from path
	// 	- get basic stat data
	// 	- get previews from path if they exist (.getPreviews(..))
	//
	// Returns: Images object
	//
	getImagesInPath: ['- File/',
		function(path, read_stat, skip_preview_search, logger){
			if(path == null){
				return
			}
			read_stat = read_stat == null ?
				this.config['image-file-read-stat']
				: read_stat
			skip_preview_search = skip_preview_search == null ?
				this.config['image-file-skip-previews']
				: skip_preview_search

			// XXX get a logger...
			logger = logger || this.logger
			//logger = logger && logger.push('getImagesInPath')

			var that = this
			path = util.normalizePath(path)

			// get the image list...
			return new Promise(function(resolve, reject){
				glob(path + '/'+ that.config['image-file-pattern'], {stat: !!read_stat})
					.on('error', function(err){
						console.error(err)
						reject(err)
					})
					.on('end', function(lst){ 
						// XXX might be a good idea to make image paths relative to path...
						//lst = lst.map(function(p){ return pathlib.relative(base, p) })
						// XXX do we need to normalize paths after we get them from glob??
						//lst = lst.map(function(p){ return util.normalizePath(p) }), path)

						var imgs = images.Images.fromArray(lst, path)

						if(!!read_stat){
							var stats = this.statCache
							var p = pathlib.posix

							imgs.forEach(function(gid, img){
								var stat = stats[p.join(img.base_path, img.path)]

								img.atime = stat.atime
								img.mtime = stat.mtime
								img.ctime = stat.ctime
								img.birthtime = stat.birthtime

								img.size = stat.size

								// XXX do we need anything else???
							})
						}

						// pass on the result...
						resolve(imgs)
					})
			})
			// load previews if they exist...
			.then(function(imgs){
				var index_dir = that.config['index-dir']
				var index_path = path +'/'+ index_dir

				return !skip_preview_search ? 
					//that.getPreviews('all', path, imgs)
					that.getPreviews('all', index_path, imgs)
					: imgs 
			})
		}],

	// Load images...
	//
	// 	.loadImages(path)
	// 		-> promise
	//
	// NOTE: if path is not given this will do nothing.
	//
	// XXX use the logger...
	// XXX add a recursive option...
	// 		...might also be nice to add sub-dirs to ribbons...
	// XXX add option to preserve/update .data (???)
	// XXX make image pattern more generic...
	loadImages: ['- File/Load images',
		function(path, logger){
			if(path == null){
				return
			}
			logger = logger || this.logger
			logger = logger && logger.push('Load images')

			var that = this
			path = util.normalizePath(path)

			// get the image list...
			return this.getImagesInPath(
					path, 
					that.config['image-file-read-stat'],
					that.config['image-file-skip-previews'],
					logger)
				// load the data...
				.then(function(imgs){
					that.loadOrRecover({
						images: imgs,
						data: data.Data.fromArray(imgs.keys()),

						location: {
							path: path,
							method: 'loadImages',
						}
					})
				})
		}],

	// Load images to new ribbon...
	//
	//	.loadImagesAsRibbon(path[, logger])
	//		-> promise
	//
	//	.loadImagesAsRibbon(path, 'above'[, logger])
	//	.loadImagesAsRibbon(path, 'below'[, logger])
	//		-> promise
	//
	// NOTE: this will clear .location
	//
	// XXX EXPERIMENTAL...
	// XXX should this be usable only in crops???
	// 		....also would be a good idea to add things like .removeRibbon(..)...
	// XXX should this be a crop???
	loadImagesAsRibbon: ['- File/Load images into ribbon',
		function(path, direction, logger){
			var that = this
			if(path == null){
				return
			}

			if(logger === undefined 
					&& direction 
					&& typeof(direction) != typeof('str')){
				logger = direction
				direction = null
			}

			direction = direction || 'below'

			logger = logger || this.logger
			logger = logger && logger.push('Load images to ribbon')

			return this.getImagesInPath(
					path, 
					that.config['image-file-read-stat'],
					that.config['image-file-skip-previews'],
					logger)
				// load the data...
				.then(function(imgs){
					that.clearLoaction()

					var d = that.data
					var nd = data.Data.fromArray(imgs.keys())

					var r = d.getRibbon()

					// splice the order...
					d.order.splice.apply(d.order, 
						[d.order.indexOf(d.current)+1, 0]
							.concat(nd.order))

					// new ribbon and data...
					var n = d.newRibbon(r, direction)
					d.ribbons[n] = nd.ribbons[nd.ribbon_order[0]]

					// sort elements within the new ribbon...
					d.updateImagePositions()

					// join images...
					that.images.join(imgs)

					that.reload(true)
				})
		}],

	// Load new images...
	//
	// 	Load new images from current path...
	// 	.loadNewImages()
	// 		-> promise
	//
	// 	Load new images from path...
	// 	.loadNewImages(path)
	// 		-> promise
	//
	// This will prepend images in path (default .location.path) that 
	// were not loaded in index...
	//
	// NOTE: this will not load images that are already loaded.
	//
	// XXX revise logger...
	// XXX revise alignment...
	loadNewImages: ['File/Load new images',
		function(path, logger){
			path = path || this.location.path

			if(path == null){
				return
			}

			var that = this
			logger = logger || this.logger
			logger = logger && logger.push('Load new images')
			path = util.normalizePath(path)

			// cache the loaded images...
			var loaded = this.images.map(function(gid, img){ return img.path })
			//var base_pattern = RegExp('^'+path)

			return this.getImagesInPath(
					path, 
					that.config['image-file-read-stat'],
					that.config['image-file-skip-previews'],
					logger)
				// load the data...
				.then(function(imgs){
					// remove the images we already have loaded...
					imgs.forEach(function(gid, img){
						// NOTE: we do not need to normalize anything as
						// 		both the current path and loaded paths 
						// 		came from the same code...
						// XXX is this good enough???
						// 		...might be a good idea to compare absolute
						// 		paths...
						if(loaded.indexOf(img.path) >= 0){
							delete imgs[gid]
						}	
					})

					// nothing new...
					if(imgs.length == 0){
						// XXX
						logger && logger.emit('loaded', [])
						return imgs
					}

					// XXX
					logger && logger.emit('queued', imgs)

					var gids = imgs.keys()
					var new_data = that.data.constructor.fromArray(gids)

					// merge with index...
					// NOTE: we are prepending new images to the start...
					// NOTE: all ribbon gids will change here...
					var cur = that.data.current
					// XXX this does not seem to work...
					//that.data = new_data.join(that.data)
					that.data = new_data.join('top', that.data)
					that.data.current = cur

					that.images.join(imgs)

					that.reload()

					// XXX report that we are done...
					logger && logger.emit('loaded', imgs)

					return imgs
				})
		}],
})


var FileSystemLoader = 
module.FileSystemLoader = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'fs-loader',
	depends: [
		'location',
		'recover',
		'fs-info',
		'changes',
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

	handlers: [
		// clear changes when loading an index...
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
		// add new images to changes...
		['loadNewImages',
			function(res){
				var that = this
				res.then(function(imgs){
					imgs 
						&& imgs.length > 0 
						&& that
							.markChanged('data')
							.markChanged(imgs.keys())
				})
			}],
	],
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
		// The loader can be action name or a keyboard.parseActionCall(..) 
		// compatible syntax.
		//
		// If an argument string containing "$PATH" is passed then it 
		// will be replaces by the selected path...
		// 	Example:
		// 		'someAction: "$PATH" -- doc'
		//
		// NOTE: these will be displayed in the same order as they appear
		// 		in the list.
		// NOTE: the first one is auto-selected.
		'path-loaders': [
			'loadIndex: "$PATH"',
			'loadImages: "$PATH"',
			//'loadPath: "$PATH"',
			'---',
			'loadImagesAsRibbon: "$PATH" "above" -- Load images to new ribbon above',
			'loadImagesAsRibbon: "$PATH" "below" -- Load images to new ribbon below',
		],

		'file-browser-settings': {
			disableFiles: true,
			showNonTraversable: true,
			showDisabled: true,

			//actionButton: '&ctdot;', 		// "..."
			//actionButton: '&#11168;', 	// down then left arrow (long)
			//actionButton: '&#9657;',		// right-pointing white triangle
			//actionButton: '&#9721;',		// ne white triangle
			//actionButton: '&#8599;',		// ne arrow
			//actionButton: '&#11171;', 	// up then right arrow
			//actionButton: '&#187;',			// right-pointing double angle
											// quotation mark
			// XXX not sure about this...
			//actionButton: '&#128194;',	// folder icon (color)
		},
	},

	// FS browser...
	//
	// XXX should the loader list be nested or open in overlay (as-is now)???
	browsePath: ['File/Browse file system...',
		widgets.makeUIDialog(function(base, callback){
			var that = this

			var cfg = Object.create(this.config['file-browser-settings'])
			cfg.cls = 'file-browser'

			base = base || this.location.path || '/'
			base = util.normalizePath(base)

			var o = browseWalk.makeWalk(null, 
						base, 
						this.config['image-file-pattern'],
						cfg)
					// path selected...
					.open(function(evt, path){ 
						var item = o.selected

						// single loader...
						if(callback && callback.constructor === Function){
							// close self and parent...
							o.close() 

							callback(path)

						// list of loaders...
						} else {
							// show user the loader list...
							var so = that.showActionList(
									callback 
										|| that.config['path-loaders'],
									{
										path: 0,
										args_dict: { '$PATH': path },
									})
								// close self and parent...
								.open(function(){
									so.close()
									o.close() 
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
				o.close()
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
// Comments...
// XXX these are quite generic, might be a good idea to move them out of fs...

var CommentsActions = actions.Actions({
	// Format:
	// 	{
	// 		// raw loaded comments...
	// 		raw: {
	// 			<path>: <comments>,
	// 			...
	// 		},
	//
	// 		<keywork>: <data>,
	// 		...
	// 	}
	__comments: null,

	get comments(){
		return this.__comments },
	set comments(value){
		this.__comments = value },
})

var Comments = 
module.Comments = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'comments',

	actions: CommentsActions,

	handlers: [
		// save/resore .comments
		['json',
			function(res){
				if(this.comments != null){
					res.comments = JSON.parse(JSON.stringify(this.comments))
				}
			}],
		['load',
			function(_, data){
				if(data.comments != null){
					this.comments = data.comments
				}
			}],

		// prepare comments for saving to "comments/<keyword>"...
		//
		// NOTE: this will skip the 'raw' comment field...
		['prepareIndexForWrite',
			function(res, _, full){
				var changed = this.changes == null 
					|| this.changes.comments

				if((full || changed) && res.raw.comments){
					var comments = res.raw.comments

					Object.keys(comments)
						// skip the raw field...
						.filter(function(k){ return k != 'raw' })
						.forEach(function(k){
							res.index['comments/' + k] = comments[k]
						})
				}
			}],
	],
})



//---------------------------------------------------------------------
// FS Comments... 

// XXX split this to loader and writer???
// XXX might be good to split this to a generic API and a loader...
var FileSystemCommentsActions = actions.Actions({
	config: {
		// This helps prevent the comment loading process from delaying
		// showing the user the images...
		'comments-delay-load': 300,
	},

	/* XXX we do not actually need this...
	// XXX this will not save comments for merged indexes...
	saveComments: ['- File/',
		function(path, date, logger){
			if(this.location.method != 'loadIndex' 
				|| this.location.loaded.length > 1){
				return
			}

			logger = logger || this.logger
			logger = logger && logger.push('saveComments')

			var path = this.location.path
			var comments_dir = this.config['index-dir'] +'/comments'
			var data = JSON.parse(JSON.stringify(this.comments))

			// XXX
			return file.writeIndex(
					data, 
					path +'/'+ comments_dir,
					date || Date.timeStamp(),
					this.config['index-filename-template'], 
					logger)
		}],
	//*/
	loadComments: ['- File/',
		function(path, date, logger){
			if(this.location.method != 'loadIndex'){
				return
			}

			logger = logger || this.logger
			logger = logger && logger.push('Load comments')

			var that = this
			var loaded = this.location.loaded

			// prepare empty comments...
			// XXX should we reset or just merge???
			this.comments = {
				raw: {}
			}

			return Promise.all(loaded.map(function(path){
				var comments_dir = that.config['index-dir'] +'/comments'

				return file.loadIndex(path, that.config['index-dir'] +'/comments', date, logger)
					.then(function(res){
						// no comments present...
						if(res[path] == null){
							return res
						}

						// if we have no sub-indexes just load the 
						// comments as-is...
						if(loaded.length == 1){
							that.comments = JSON.parse(JSON.stringify(res[path]))
							that.comments.raw = {path: res[path]}

						// sub-indexes -> let the client merge their stuff...
						} else {
							that.comments.raw[path] = res[path]
						} 

						return res
					})
			}))
		}],
})


var FileSystemComments = 
module.FileSystemComments = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'fs-comments',
	depends: [
		'comments',
		'fs-loader',
	],

	actions: FileSystemCommentsActions,

	handlers: [
		['loadIndex',
			function(res){
				var that = this

				res.then(function(){
					setTimeout(function(){
						that.loadComments()
					}, that.config['comments-delay-load'] || 0) })
			}],
	],
})



//---------------------------------------------------------------------
// Save History...

var FileSystemSaveHistoryActions = actions.Actions({
	// Save comments...
	//
	// Format:
	// 	.comments.save = {
	// 		// comment staged for next .saveIndex(..)...
	// 		//
	// 		// NOTE: 'current' will get replaced with save timestamp...
	// 		'current': <comment>,
	//
	// 		<timestamp>: <comment>,
	// 		...
	// 	}


	// NOTE: if comments are not loaded yet this will break...
	getSaveComment: ['- File/',
		function(save){
			this.comments == null 
				&& console.error('Comments do not appear to be loaded yet...')

			return (this.comments.save && this.comments.save[save || 'current']) || '' }],

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
	// NOTE: if comments are not loaded yet this will break...
	setSaveComment: ['- File/Comment a save',
		function(save, comment){
			this.comments == null 
				&& console.error('Comments do not appear to be loaded yet...')

			var comments = this.comments.save = this.comments.save || {}

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

			this.markChanged('comments')
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
		'changes',
		'fs-loader',
		'fs-comments',
	],
	suggested: [
		'ui-fs-save-history',
	],

	actions: FileSystemSaveHistoryActions,

	handlers: [
		// Prepare comments for writing...
		//
		// These will replace .comments.save['current'] with .location.from...
		//
		// NOTE: defining this here enables us to actually post-bind to
		// 		an action that is defined later or may not even be 
		// 		available.
		// NOTE: 'loadIndex' will also drop any unsaved changes...
		['prepareIndexForWrite',
			function(res, _, full){
				var changed = this.changes == null || this.changes.comments

				if(full || changed){
					var comments = res.raw.comments && res.raw.comments.save || {}

					// set the 'current' comment to the correct date...
					if(comments.current){
						comments[res.date] = comments.current
						delete comments.current
					}
				}
			}],
		['saveIndex',
			function(res){
				var that = this
				var comments = this.comments.save

				if(comments && comments.current){
					res
						.then(function(res){
							comments[that.location.from] = comments.current
							delete comments.current

							return res
						})
				}

				// drop unsaved changes...
				delete this.unsaved_index
			}],

		// merge save comments...
		['loadComments',
			function(res){
				var that = this

				res.then(function(){
					// NOTE: if we loaded just one index the comments 
					// 		are already loaded and we do not need to do
					// 		anything...
					if(that.location.loaded.length > 1){
						var comments = that.comments
						var raw = comments.raw

						comments.save = {}

						Object.keys(raw).forEach(function(path){
							raw[path] && Object.keys(raw[path].save || {}).forEach(function(date){
								comments.save[date] = raw[path].save[date]
							})
						})
					}
				})
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
	listSaveHistory: ['File/Edit history...',
		widgets.makeUIDialog(function(){
			var that = this

			var _makeTitle = function(title, date, a){
				title = [title]
				date = date || 'current'
				a = a || that

				var comment = a.comments.save && a.comments.save[date] 
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
												delete that.comments.save.current
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
				o.close()
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
		'changes',
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
					path, 
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
			'%i-%f',
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

		'export-preview-size-limits': [
			'900',
			'1000',
			'1280',
			'1920',
		],
		'export-preview-size-limit': 'no limit',
	},


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
	// 		// this is the prepared index object, the one that is going to be
	// 		// saved.
	// 		index: <index-json>,
	//
	// 		...
	// 	}
	//
	//
	// The format for the <prapared-json> is as follows:
	// 	{
	// 		<keyword>: <data>,
	// 		...
	// 	}
	//
	// The <index-json> is written out to a fs index in the following
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
				index: file.prepareIndex(json, changes),
			}
		}],
	
	// Save index...
	//
	// Returns:
	// 	a promise, when resolved will get the location object as argument.
	//
	// NOTE: with no arguments this will save index to .location.path
	//
	// XXX should this return a promise??? ...a clean promise???
	// XXX BUG: after .loadImages(..) and without arguments this produces
	// 		a result that is not loaded....
	saveIndex: ['- File/',
		function(path, logger){
			var that = this
			// XXX get a logger...
			logger = logger || this.logger
			logger = logger && logger.push('Save')

			path = path 
				|| this.location.loaded 
				|| this.location.path
			path = path && path.length == 1 ? path[0] : path 
			path = util.normalizePath(path)

			// merged index...
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

			// XXX get real base path...
			//path = path || this.location.path +'/'+ this.config['index-dir']

			// NOTE: this will prevent us from overwriting the location
			// 		after we have loaded something else...
			var location = this.location
			var index = this.prepareIndexForWrite()

			var full_path = path +'/'+ this.config['index-dir']

			return file.writeIndex(
					index.index, 
					// XXX should we check if index dir is present in path???
					//path, 
					full_path,
					index.date,
					this.config['index-filename-template'], 
					logger)
				// set hidden file attribute on Windows...
				.then(function(){
					typeof(process) != 'undefined' 
						&& (process.platform == 'win32' 
							|| process.platform == 'win64')
						&& child_process
							.spawn('attrib', ['+h', full_path])
				})
				.then(function(){
					location.method = 'loadIndex'
					location.from = index.date

					//return location
					return index
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
	// XXX what should happen if no path is given???
	// XXX add preview selection...
	// XXX handle .image.path and other stack files...
	// XXX local collections???
	exportIndex: ['- File/Export/Export index',
		function(path, max_size, include_orig, logger){
			logger = logger || this.logger
			logger = logger && logger.push('Export index')

			max_size = parseInt(max_size || this.config['export-preview-size-limit']) || null
			// XXX make this dependant on max_size....
			include_orig = include_orig || true

			// XXX is this correct???
			path = path || './exported'
			path = util.normalizePath(path)

			// XXX resolve env variables in path...
			// 		...also add ImageGrid specifics: $IG_INDEX, ...
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
			var images = {}
			gids.forEach(function(gid){
				var img = json.images[gid]
				if(img){
					images[gid] = json.images[gid]
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

			var queue = []

			gids.map(function(gid){
				var img = json.images[gid]
				var img_base = img.base_path
				var previews = img.preview

				// NOTE: we are copying everything to one place so no 
				// 		need for a base path...
				delete img.base_path

				if(previews || img.path){
					Object.keys(previews || {})
						// limit preview size...
						// NOTE: also remove the preview resolution if 
						// 		it's smaller...
						.filter(function(res){ 
							// no size limit or match...
							if(!max_size || parseInt(res) <= max_size){
								return true

							// skip and remove...
							} else {
								delete previews[res]
								return false
							}
						})
						// get paths...
						.map(function(res){ return decodeURI(previews[res]) })
						// XXX might be a good idea to include include 
						// 		the max preview if hires is too large...
						.concat(include_orig ? [img.path || null] : [])
						.forEach(function(preview_path){
							if(preview_path == null){
								return
							}

							var from = (img_base || base_dir) +'/'+ preview_path
							var to = path +'/'+ preview_path

							// XXX use queue for progress reporting...
							logger && logger.emit('queued', to)

							// destination exists...
							if(fs.existsSync(to)){
								logger && logger.emit('skipping', to)

							// copy...
							} else {
								// XXX do we queue these or let the OS handle it???
								// 		...needs testing, if node's fs queues the io
								// 		internally then we do not need to bother...
								queue.push(copy(from, to)
									.then(function(){
										logger && logger.emit('done', to) })
									.catch(function(err){
										logger && logger.emit('error', err)
									}))
							}
						})
				}
			})

			// prep the index...
			var index = this.prepareIndexForWrite(json, true)

			// NOTE: if we are to use .saveIndex(..) here, do not forget
			// 		to reset .changes
			queue.push(file.writeIndex(
					index.index,
					index_path, 
					index.date,
					this.config['index-filename-template'], 
					logger)
					//logger || this.logger)
				// set hidden file attribute on Windows...
				.then(function(){
					typeof(process) != 'undefined' 
						&& (process.platform == 'win32' 
							|| process.platform == 'win64')
						&& child_process
							.spawn('attrib', ['+h', index_path])
				}))

			return Promise.all(queue)
		}],
	
	// 
	// Filename patterns:
	// 	%f		- full file name (same as: %n%e)
	// 	%n		- name without extension
	// 	%e		- extension with leading dot
	//
	// 	%gid	- full image gid
	// 	%g		- short gid (XXX set length in options)
	//
	// 	%i		- image index in ribbon
	// 	%I		- global image index (XXX global or crop???)
	//
	// 	%t 		- total number of images in ribbon
	// 	%T		- total number of images (XXX global or crop???)
	//
	// 	%(...)m	- add text in braces if image marked
	// 	%(...)b	- add text in braces if image is bookmark
	//
	//
	// XXX might also be good to save/load the export options to .ImageGrid-export.json
	// XXX resolve env variables in path... (???)
	// XXX make custom previews (option)...
	// 		...should this be a function of .images.getBestPreview(..)???
	// XXX report errors...
	// XXX stop the process on errors...
	// XXX use tasks...
	// XXX check global index ('%I') in crop...
	exportDirs: ['- File/Export/Export ribbons as directories',
		function(path, pattern, level_dir, size, logger){
			logger = logger || this.logger
			logger = logger && logger.push('Export dirs')
			var that = this
			var base_dir = this.location.path

			path = util.normalizePath(path)

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
			return Promise.all(this.data.ribbon_order
				.slice()
				.reverse()
				.map(function(ribbon){
					// NOTE: this is here to keep the specific path local to 
					// 		this scope...
					var img_dir = to_dir

					var res = ensureDir(pathlib.dirname(img_dir))
						// XXX do we need error handling here???
						.catch(function(err){
							logger && logger.emit('error', err) })
						.then(function(){
							// XXX revise...
							var len = that.data.ribbons[ribbon].len
							var total_len = that.data.length

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

								var i = that.data.getImageOrder('ribbon', gid)
								var I = that.data.getImageOrder('global', gid)

								// pad indexes...
								// XXX should these be optional???
								i = ((('1e'+(len+'').length)*1 + i) + '').slice(1)
								I = ((('1e'+(total_len+'').length)*1 + I) + '').slice(1)

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
									.replace(/%i/, i)
									.replace(/%I/, I)

									// totals...
									.replace(/%t/, len)
									.replace(/%T/, total_len)

									// tags...
									// XXX test: %n%(b)b%(m)m%e
									.replace(
										/%\(([^)]*)\)m/, tags.indexOf('selected') >= 0 ? '$1' : '')
									.replace(
										/%\(([^)]*)\)b/, tags.indexOf('bookmark') >= 0 ? '$1' : '')

									// metadata...
									// XXX

								var to = img_dir +'/'+ name

								logger && logger.emit('queued', to)

								// destination exists...
								if(fs.existsSync(to)){
									logger && logger.emit('skipping', to)

								} else {
									return copy(from, to)
										.then(function(){
											logger && logger.emit('done', to) })
										.catch(function(err){
											logger && logger.emit('error', err) })
								}
							})
						})

					to_dir += '/'+level_dir

					return res
				}))
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
		'changes',	
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
	],
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
			'Current state as index': {
				action: 'exportIndex',
				data: [
					'target_dir',
					// XXX need to add options to size: 'none',
					// XXX use closest preview instead of hi-res when 
					// 		this is set...
					// XXX need to add option to save full index...
					'size_limit',
					// XXX might be a good idea to include source data links
					//'include_source_url', // bool
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
				this.browseExportIndex()
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
	// The fields used and their order is set by:
	// 		.config['export-modes'][<mode>].data	(list)
	//
	// The action used to export is set by:
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
	// NOTE: the export action should get all of its arguments from config
	// 		except for the export path...
	__export_dialog_fields__: {
		'pattern': function(actions, make, parent){
			return make(['Filename pattern: ', 
					function(){
						return actions.config['export-preview-name-pattern'] || '%f' }])
				.on('open', 
					widgets.makeNestedConfigListEditor(actions, parent,
						'export-preview-name-patterns',
						'export-preview-name-pattern', {
							length_limit: 10,
						}))
		},
		'level_dir': function(actions, make, parent){
			return make(['Level directory: ', 
					function(){ 
						return actions.config['export-level-directory-name'] || 'fav' }])
				.on('open', 
					widgets.makeNestedConfigListEditor(actions, parent,
						'export-level-directory-names', 
						'export-level-directory-name', {
							length_limit: 10,
						}))
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
							length_limit: 10,
							sort: function(a, b){ return parseInt(a) - parseInt(b) },
						}))

		},
		'size_limit': function(actions, make, parent){
			return make(['Limit image size: ', 
					function(){ 
						return actions.config['export-preview-size-limit'] || 'no limit' }],
					{ buttons: [
						['&times;', function(p){
							actions.config['export-preview-size-limit'] = 'no limit'
							parent.update()
						}],
					] })
				// XXX add validation???
				.on('open', 
					widgets.makeNestedConfigListEditor(actions, parent,
						'export-preview-size-limits',
						'export-preview-size-limit',
						{
							length_limit: 10,
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
							length_limit: 10,
							new_item: false,
						})],
				]})
				// XXX make this editable???
				.on('open', function(){
					event.preventDefault()

					var path = elem.find('.text').last()
						.makeEditable({
							activate: true,
							clear_on_edit: false,
							abort_keys: [
								'Esc',
							],
						})
						.on('edit-commit', function(_, path){
							actions.config['export-path'] = path
							actions.config['export-paths'].indexOf(path) < 0
								&& actions.config['export-paths'].splice(0, 0, path)

						})
						.on('edit-abort edit-commit', function(evt, path){
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
							activate: true,
							multiline: true,
							clear_on_edit: false,
							abort_keys: [
								'Esc',
							],
						})
						.on('edit-commit', function(_, text){
							actions.setSaveComment(text)
						})
						.on('edit-abort edit-commit', function(evt, text){
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
				make(['Export $mode: ', 
						function(){ return mode }])
					.on('open', 
						widgets.makeNestedConfigListEditor(that, o,
							'export-dialog-modes',
							'export-dialog-mode',
							{
								length_limit: 10,
								new_item: false,
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

				// Start action...
				make([function(){
						// XXX indicate export state: index, crop, image...
						return '$Export'}]) 
					.on('open', function(){
						var mode = 
							that.config['export-dialog-modes'][that.config['export-dialog-mode']]
						that[mode.action](
							that.config['export-path'] || undefined)
						dialog.close()
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
		'changes',	
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
* vim:set ts=4 sw=4 :                               */ return module })
