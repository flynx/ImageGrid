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
	var outputFile = file.denodeify(fse.outputFile)
	var createFile = file.denodeify(fse.createFile)
}



/*********************************************************************/

var IndexFormatActions = actions.Actions({
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

	// XXX might be a good idea to replace 'full' with changes to 
	// 		override .changes...
	prepareIndexForWrite: ['- File/Prepare index for writing',
		core.doc`Convert json index to a format compatible with file.writeIndex(..)

			Prepare current state...
			.prepareIndexForWrite()
				-> data
				NOTE: this will account for .changes 
					(see: core.Changes.markChanged(..))

			Prepare a specific state...
			.prepareIndexForWrite(json)
				-> data

			Prepare a state overwriting changes...
			.prepareIndexForWrite(null, changes)
			.prepareIndexForWrite(json, changes)
				-> data
				NOTE: this will disregard .changes


		This is here so as other features can participate in index
		preparation...
		This is done in two stages:
			1) .json(..) action
				- serialise the state in a consistent manner,
				- compatible with .load(..) action
				- defines the global high level serialization format
			2) .prepareIndexForWrite(..) action
				- takes the output of .json(..) and converts to a format 
					ready for writing/serialization...
				- compatible with .prepareIndexForLoad(..)
				- this directly affects the index structure 
					(see: file.writeIndex(..))

		This will get the base index, ignoring the cropped state.

		Returns:
			{
				// Timestamp...
				// NOTE: this is the timestamp used to write the index.
				date: <timestamp>,

				// normalized changes...
				// 	- true			- everything changed
				//	- false			- nothing changes/disabled
				/	- <object>		- specific changes
				changes: <changes>,

				// This is the original json object, either the one passed as
				// an argument or the one returned by .json('base')
				raw: <original-json>,

				// this is the prepared index object, the one that is going to be
				// saved.
				index: <index-json>,

				...
			}


		The format for the <prapared-json> is as follows:
			{
				<keyword>: <data>,
				...
			}

		The <index-json> is written out to a fs index in the following
		way:
				<index-dir>/<timestamp>-<keyword>.json

			<index-dir>		- taken from .config['index-dir'] (default: '.ImageGrid')
			<timestamp>		- as returned by Date.timeStamp() (see: jli)

		`,
		function(json, changes){
			json = json || this.json('base')
			changes = changes !== undefined ? changes
				: json.changes
				//: this.hasOwnProperty('changes') ? this.changes
				//: null
			changes = changes === null ? true : changes
			return {
				date: json.date || Date.timeStamp(),
				changes: changes,
				raw: json,
				index: {},
			}
		}],
	// XXX should this return {} or json???
	prepareIndexForLoad: ['- File/Prepare JSON for loading',
		core.doc`Prepare JSON for loading...

			.prepareIndexForLoad(json)
			.prepareIndexForLoad(json, base_path)
				-> data

		Prepare the loaded JSON data to be loaded via the .load(..) action.

		It is the participating action's responsibility to transfer the 
		data from the input json to the result object.

		NOTE: this is a symmetrical function to .prepareIndexForWrite(..),
			see it for more info.
		NOTE: also see: file.loadIndex(..) and file.loadIndex(..)
		`,
		function(json, base_path){ return {} }],
})


var IndexFormat = 
module.IndexFormat = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'index-format',

	actions: IndexFormatActions,
})



/*********************************************************************/

var FileSystemInfoActions = actions.Actions({
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

	isApplicable: function(){ return this.runtime.node },
})



/*********************************************************************/
// Loader... 


// NOTE: this will also manage .location.from
var FileSystemLoaderActions = actions.Actions({
	config: {
		// NOTE: this will not match "dot filenames", this is done 
		// 		intentionally to avoid the previews MAC computers 
		// 		generate all over the place...
		'image-file-pattern': '*.@(jpg|jpeg|png|svg|JPG|JPEG|PNG|svg)',

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
					var force_full_save = false

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
						// XXX should we rebuild or list here???
						if(res[k].data == null && res[k].images == null){
							continue
						}

						// build the data from images...
						if(res[k].data == null){
							res[k].data = {
								order: Object.keys(res[k].images),
							}
						}

						// prepare to do a full save if format version updated...
						if(res[k].data.version != that.data.version){
							// compensate for a typo that was discovered in v3.1
							var v = res[k].data.version || res[k].data.varsion
							logger && logger.emit('Data version changed:',
								v, '->', that.data.version)

							force_full_save = true
						}

						var part = that.prepareIndexForLoad(res[k], k)

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


					// XXX BUG?: some times we reach this point with index
					// 		equaling null
					// 		...we are not fixing this here as the cause of 
					// 		this issue is likely someplace else and that 
					// 		needs investigating...
					// XXX REMOVE WHEN ISSUE FIXED...
					!index
						&& console.error('Failed to load index from:', paths)


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
						.then(function(){
							force_full_save
								// XXX remove as soon as merged index save is done...
								&& loaded.length == 1
								&& that.markChanged('all')
						})
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
				glob(path + '/'+ that.config['image-file-pattern'], {
						stat: !!read_stat,
						strict: false,
					})
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
					return that.loadOrRecover({
							images: imgs,
							data: data.Data.fromArray(imgs.keys()),

							location: {
								path: path,
								method: 'loadImages',
							}
						})
						.then(function(){
							that.markChanged('none')
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
					that.data = new_data.join(that.data)
					that.data.current = cur

					that.images.join(imgs)

					that.reload()

					// XXX report that we are done...
					logger && logger.emit('loaded', imgs)

					return imgs
				})
		}],

	// XXX update index for removed images...
	// 		- remove non-existing previews from index
	// 		- replace non-existing originals with the largest preview (in index)
	// 		...do not touch the fs
	// XXX this does not give the logger to render... can't seem to make this
	// 		not block the browser render...
	// XXX set changes...
	checkIndex: ['File/Check index consistency',
		core.doc`Check index consistency...

		Check currently loaded index for missing references and fix them
		if found.

		This will:
			- remove references to non-existing preview images (image.preview)
			- remove references to non-existing .path (image.path)
			- if .path removed, set to largest available preview


		NOTE: currently this is disabled for merged indexes, need to load
			and check individually...

		`,
		function(logger){
			var that = this
			logger = logger || this.logger
			logger = logger && logger.push('Checking index')

			// XXX can we remove this restriction...
			if(this.location.loaded.length != 1){
				throw new Error('.fixIndex(): combined indexes not supported.')
			}

			logger 
				&& this.images
					.forEach(function(gid){ 
						logger.emit('queued', gid)})

			// XXX get this from config...
			//var chunk_size = 50
			var chunk_size = '100C'

			return this.images
				.map(function(gid, image){ 
					return [gid, image] })
				.mapChunks(chunk_size, function(e){
					var gid = e[0]
					var image = e[1]
					var updated = false

					var previews = image.preview || {}
					Object.entries(previews)
						.forEach(function(p){
							!fse.existsSync(image.base_path +'/'+ p[1])
								&& (updated = true)
								&& (delete previews[p[0]]) })

					!fse.existsSync(image.base_path +'/'+ image.path)
						&& (updated = true)
						&& (delete image.path)

					logger && logger.emit('done', gid)

					return updated ? gid : []
				})
				.then(function(res){
					return res.flat() })
		}],
})


var FileSystemLoader = 
module.FileSystemLoader = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'fs-loader',
	depends: [
		'base',
		'edit',
		'index-format',
		'location',
		'recover',
		'fs-info',
		'tasks',
	],
	suggested: [
		'ui-fs-loader',
		'fs-url-history',
		'fs-save-history',
	],

	actions: FileSystemLoaderActions,

	isApplicable: function(){ return this.runtime.node },

	handlers: [
		// clear changes when loading an index...
		['loadIndex',
			function(res, path){
				if(path){
					var that = this
					res.then(function(){ 
						that.markChanged('none') })
				}
			}],
		// mark everything changed when loading images...
		['loadImages',
			function(res){
				var that = this
				res.then(function(){ 
					that.markChanged('all') })
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
							.markChanged('images', imgs.keys()) })
			}],
		['checkIndex',
			function(res){
				var that = this
				res.then(function(gids){
					gids.length > 0
						&& that.markChanged('images', gids) }) }],
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
			}) }) }


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

			disableDotFiles: 'on',
			//disableHiddenFiles: false,

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
			// normalize...
			cfg.disableDotFiles = cfg.disableDotFiles == 'on'

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
						var config = 
							that.config['file-browser-settings'] = 
							that.config['file-browser-settings'] || {}

						config.disableFiles = o.options.disableFiles
						config.showDisabled = o.options.showDisabled
						config.showNonTraversable = o.options.showNonTraversable
						// normalize...
						config.disableDotFiles = o.options.disableDotFiles ? 'on' : 'off'
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
	browseIndex: ['- File/Load index...', makeBrowseProxy('loadIndex')],
	browseImages: ['- File/Load images...', makeBrowseProxy('loadImages')],

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

	toggleDotFileDrawing: ['Interface/File browser/Hide dot files',
		core.makeConfigToggler(
			'file-browser-settings.disableDotFiles',
			['on', 'off'])],
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
			var index_dir = this.config['index-dir']
			path = path || this.location.loaded
			path = path instanceof Array ? path : [path]

			var res = {}
			return Promise
				.all(this.location.loaded
					.map(function(path){
						return file.loadSaveHistoryList(path +'/'+ index_dir)
							.then(function(data){
								res[path] = data }) }))
				.then(function(){
					return res })
		}],
})


var FileSystemSaveHistory = 
module.FileSystemSaveHistory = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'fs-save-history',
	depends: [
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
			function(res){
				var changed = res.changes === true || res.changes.comments

				if(changed){
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
				var comments = this.comments && this.comments.save

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
			}, {
				cls: 'save-history',
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
		}] }

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

		'export-include-virtual': true,
		'export-clean-target': true,

		// NOTE: file extension is added automatically...
		// NOTE: see .formatImageName(..) for format docs...
		'export-preview-name-pattern': '%(fav)l%n%(-%c)c',
		'export-preview-name-patterns': [
			'%(fav)l%n%(-bookmarked)b%(-%c)c',
			'%(fav)l%n%(-bookmarked)b%(-m)m%(-%c)c',
			'%(fav)l%n%(-%c)c',
			'%(fav)l%i-%n',
			'%(fav)l%g-%n',
		],

		// This is used in .exportIndex(..) to resolve name conflicts...
		//
		// NOTE: this is applied ONLY if there is a naming conflict...
		// NOTE: see .formatImageName(..) for format docs...
		// XXX adding a %c is more human-readable but is unstable as
		// 		depends on gid order, %g resolves this problem but is 
		// 		not very intuitive...
		//'export-conflicting-image-name': '%n%(-%g)c',
		'export-conflicting-image-name': '%n%(-%c)c',

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
			'no limit',
			'900',
			'1000',
			'1280',
			'1920',
		],
		'export-preview-size-limit': 'no limit',
	},

	// XXX should this be sync???
	backupDir: ['- File/',
		function(path, logger){
			// XXX get a logger...
			logger = logger || this.logger
			logger = logger && logger.push('Backup')

			do{
				var d = Date.timeStamp()
				var backup_dir = `${pathlib.dirname(path)}/.${pathlib.basename(path)}.${d}`
			} while(fse.existsSync(backup_dir))

			logger && logger.emit(backup_dir)

			fse.moveSync(path, backup_dir)

			typeof(process) != 'undefined' 
				&& (process.platform == 'win32' 
					|| process.platform == 'win64')
				&& child_process
					.spawn('attrib', ['+h', backup_dir]) }],

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

	// XXX add name conflict resolution strategies (pattern)...
	// 		...use the same strategy as for .exportDirs(..)
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
	//
	// NOTE: if max_size is given the base image in the target path will
	// 		be replaced with the largest preview under max_size.
	//
	// XXX resolve env variables in path...
	// XXX what should happen if no path is given???
	// XXX handle .image.path and other stack files...
	// XXX local collections???
	//
	// XXX BUG: this does not remove previews correctly...
	// 		to reproduce:
	// 			open: L:\media\img\my\2019
	// 			exportIndex: with max_size=400
	// 				-> main preview is not replaced
	// 				-> preivew size 350px not copied but kept in index...
	// 		temporary workaround:
	//			ig.getPreviews('*')
	//				.then(function(){
	//					ig.markChanged('images')
	//					console.log('done.') })
	// XXX when no previews present this should create at least one file
	// 		of max_size...
	exportIndex: ['- File/Export/Export index',
		function(path, max_size, include_orig, clean_target_dir, logger){
			var that = this
			logger = logger || this.logger
			logger = logger && logger.push('Export index')

			max_size = parseInt(max_size || this.config['export-preview-size-limit']) || null
			// XXX make this dependant on max_size....
			include_orig = include_orig || true

			// XXX is this correct???
			// 		...get this from config...
			path = path || './exported'
			path = util.normalizePath(path)

			// XXX resolve env variables in path...
			// 		...also add ImageGrid specifics: $IG_INDEX, ...
			// XXX
			
			// clear/backup target...
			clean_target_dir = clean_target_dir === undefined ? 
				this.config['export-clean-target'] 
				: clean_target_dir
			clean_target_dir
				&& fse.existsSync(path)
				&& this.backupDir(path, logger)


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


			// check if we have naming conflicts...
			var conflicts = this.imageNameConflicts()

			var pattern = this.config['export-conflicting-image-name'] || '%n%(-%g)c%e'
			var total_len = this.data.length


			var queue = []

			gids.map(function(gid){
				var img = json.images[gid]
				var img_base = img.base_path
				var previews = img.preview

				var from_path = img.path
				var to_path = img.path

				// resolve name conflicts...
				if(conflicts){
					var base = pathlib.dirname(img.path || '')
					var name = pathlib.basename(img.path || (img.name + img.ext))

					// update name via pattern...
					name = that.formatImageName(pattern, 
						gid, 
						{
							total_len: total_len,
							conflicts: conflicts.conflicts,
						})

					// update name...
					if(img.name){
						img.name = img.name == img.path ? 
								pathlib.join(base, name)
							// name without extension...
							: img.path == (img.name + img.ext) ? 
								pathlib.join(base, name)
									.split(/\./g)
									.slice(0, -1)
									.join('.')
							// other name...
							: img.name }

					// update path...
					to_path = img.path = pathlib.join(base, name)

					// update previews...
					// NOTE: this is needed if some of the previews are the 
					// 		same as .path
					Object.keys(img.preview)
						.forEach(function(s){ 
							var p = img.preview[s]
							img.preview[s] = p == from_path ? to_path : p
						})
				}

				// NOTE: we are copying everything to one place so no 
				// 		need for a base path...
				delete img.base_path

				if(previews || img.path){
					var seen = new Set()
					var max
					var replace_orig = false
					Object.keys(previews || {})
						// limit preview size...
						// NOTE: also remove the preview resolution if 
						// 		it's smaller...
						.filter(function(res){ 
							// no size limit or match...
							if(!max_size || parseInt(res) <= max_size){
								// get the biggest remaining preview...
								max = (max == null 
										|| parseInt(res) > parseInt(max)) ?
									res
									: max
								return true
							}

							// skip and remove...
							delete previews[res]
							replace_orig = true
						})
						// get paths...
						.map(function(res){ 
							return res != max ?
								decodeURI(previews[res]) 
								// NOTE: we will skip including the preview 
								// 		we are using as the primary image to
								// 		save space...
								: null })
						// add primary image...
						.concat(include_orig && img.path ? 
							[[
								(replace_orig && max != null) ? 
									// replace the base image with the 
									// largest available preview...
									previews[max]
									: from_path, 
								img.path
							]] 
							: null)
						// build the from/to paths...
						.forEach(function(preview_path){
							var to
							if(preview_path == null){
								return
							}
							if(preview_path instanceof Array){
								to = preview_path[1]
								preview_path = preview_path[0]
							}

							// we got a preview that is the same image as .path
							if(preview_path == to_path){
								to = to_path
								preview_path = from_path	
							}

							var from = (img_base || base_dir) +'/'+ preview_path
							to = path +'/'+ (to || preview_path)

							// we do not need to report repeats...
							// NOTE: these can occur because the same image can
							// 		be included as a preview and as .path...
							if(seen.has(to)){
								return
							}
							seen.add(to)

							// XXX use queue for progress reporting...
							logger && logger.emit('queued', to)

							// destination exists...
							if(fse.existsSync(to)){
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
										logger && logger.emit('error', err) }))
							}
						})
				}
			})

			// prep the index...
			var index = this.prepareIndexForWrite(json, true)

			// NOTE: if we are to use .saveIndex(..) here, do not forget
			// 		to reset .changes
			queue.push(
					file.writeIndex(
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
							.spawn('attrib', ['+h', index_path]) }))

			return Promise.all(queue)
		}],

	// XXX document data format...
	// XXX should %T / %I be global or current crop???
	// XXX add comments...
	// 		%comment - add comment if present
	// 		%(...%comment )comment - add comment if present
	// 		...need a better name...
	// XXX add tags/keywords... 
	// 		%(tag|...)k - if image is tagged with tag add text
	formatImageName: ['- File/',
		core.doc`

		Filename patterns:
		 	%n		- name without extension
		
		 	%gid	- full image gid
		 	%g		- short gid
		
		 	%i		- image index in ribbon
		 	%I		- global image index

			%r		- ribbon number
			%R		- ribbon number counting from the bottom
		
		 	%t 		- total number of images in ribbon
		 	%T		- total number of images
		
		 	%(...)m	- add text in braces if image marked
		 	%(...)b	- add text in braces if image is bookmark
		
		 	%(...)C	- add text in braces if there are name conflicts.
						NOTE: this will be added to all images.
		 	%(...)c	- add text in braces if there are name conflicts 
						present, but only if the current image has a 
						conflicting name.
		 	%c		- number in set of conflicting names (default: 0).
						NOTE: this is not stable and can change depending
							on image order.

			%(...)l	- image level path, level depth corresponds to ribbon 
						number counting from the bottom
						NOTE: if level is 0 this resolves to '/'
						Example: '%(x)lz.jop' will resolve to '/z.jpg' for bottom 
							ribbon and to 'x/x/x/z.jpg' for ribbon #3 from the
							bottom.
			%(...)L	- image level path, level depth corresponds to ribbon 
						number counting from the top
						NOTE: if level is 0 this resolves to '/'

		NOTE: file extension is added automatically.
		NOTE: all group patterns (i.e. '%(..)x') can include other patterns.


		Examples:
			These examples are for image 123.jpg at position 2 of 10 (15th
			of 100 total), bookmarked but not marked, in ribbon 1 in a 
			set of 3 ribbons.

			'%(fav)l%i-%n'		-> 'fav/02-123.jpg'

			'%(other)L/%I-John-Smith-%n%(-b)b%(-m)m'
								-> '/10-John-Smith-123-b.jpg'

			'%(best)b/%i of %t - J. Smith - %n'
								-> 'best/02 of 10 - J. Smith - 123.jpg'

		`,
		function(pattern, name, data){
			pattern = pattern || '%f'
			data = data || {}
			var gid = data.gid
			if(!gid && name in this.images){
				gid = name
				name = null
			}
			gid = gid || this.current
			var ribbon = this.data.getRibbon(gid)
			data = Object.assign({}, 
				this.images[gid] || {}, 
				data)

			name = name 
				|| pathlib.basename(
					data.path || ((data.name || '') + (data.ext || '')))
			name = name == '' ? 
				gid 
				: name
			var ext = pathlib.extname(name)
			var to_ext = data.ext 
				|| ext

			var tags = data.tags || this.data.getTags(gid)

			// XXX revise defaults...
			var len = data.len || this.data.ribbons[ribbon].len
			var total_len = data.total_len || this.data.length
			var r_len = data.r_len || Object.keys(this.data.ribbons).length

			var i = data.i || this.data.getImageOrder('ribbon', gid)
			var I = data.I || this.data.getImageOrder('loaded', gid)
			var r = data.r || this.data.getRibbonOrder(gid)
			var R = data.R || r_len - r - 1

			// pad with zeros...
			i = (i+'').padStart((len + '').length, '0')
			I = (I+'').padStart((total_len + '').length, '0')
			r = (r+'').padStart((r_len + '').length, '0')
			R = (R+'').padStart((r_len + '').length, '0')
			//i = ((('1e'+(len+'').length)*1 + i) + '').slice(1)
			//I = ((('1e'+(total_len+'').length)*1 + I) + '').slice(1)

			var conflicts = data.conflicts

			return pattern
				// file name...
				.replace(/%n/, name.replace(ext, ''))

				// gid...
				.replace(/%gid/, gid)
				// XXX get the correct short gid length...
				.replace(/%g/, gid.slice(-6))

				// order...
				.replace(/%i/, i)
				.replace(/%I/, I)

				// ribbon order...
				.replace(/%r/, r)
				.replace(/%r/, R)
				
				// totals...
				.replace(/%t/, len)
				.replace(/%T/, total_len)

				// conflict count...
				.replace(/%c/, (conflicts && conflicts[gid]) ? 
					conflicts[gid].indexOf(gid) 
					: 0)

				// metadata...
				// XXX


				// Group patterns...

				// tags...
				// XXX test: %n%(b)b%(m)m%e
				.replace(
					/%\(([^)]*)\)m/, tags.indexOf('marked') >= 0 ? '$1' : '')
				.replace(
					/%\(([^)]*)\)b/, tags.indexOf('bookmark') >= 0 ? '$1' : '')
				// XXX
				//.replace(
				//	/%\(([^)]*)\)k/, tags.indexOf('bookmark') >= 0 ? '$1' : '')

				// conflicts...
				.replace(
					/%\(([^)]*)\)C/, conflicts ? '$1' : '')
				.replace(
					/%\(([^)]*)\)c/, (conflicts || {})[gid] ? '$1' : '')

				// level...
				.replace(
					/%\(([^)]*)\)L/, 
					function(match, level, offset, str){
						return (offset == 0 ? '' : '/') 
							+(new Array(r*1)).fill(level).join('/')
							+(match.length + offset == str.length ? '' : '/') })
				.replace(
					/%\(([^)]*)\)l/,
					function(match, level, offset, str){
						return (offset == 0 ? '' : '/') 
							+(new Array(r_len - r*1 - 1)).fill(level).join('/')
							+(match.length + offset == str.length ? '' : '/') })

				+ to_ext
		}],
	
	// XXX might also be good to save/load the export options to .ImageGrid-export.json
	// XXX resolve env variables in path... (???)
	// XXX make custom previews (option)...
	// 		...should this be a function of .images.getBestPreview(..)???
	// XXX report errors...
	// XXX stop the process on errors...
	// XXX use tasks...
	// XXX check global index ('%I') in crop...
	// XXX add option to "clean" destination...
	// 		...i.e. if destination exists then move it to .removed/<date>/
	// XXX make clean_target more error tolerant...
	exportDirs: ['- File/Export/Export ribbons as directories',
		core.doc`Export ribbons as directories

		NOTE: see .formatImageName(..) for pattern syntax details.
		`,
		function(path, pattern, level_dir, size, include_virtual, clean_target_dir, logger){
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
			level_dir = level_dir === undefined ?
				level_dir 
				: (level_dir || this.config['export-level-directory-name'] || 'fav')
			size = size || this.config['export-preview-size'] || 1000
			pattern = pattern || this.config['export-preview-name-pattern'] || '%f'
			include_virtual = include_virtual === undefined ?
				this.config['export-include-virtual']
				: include_virtual

			// clear/backup target...
			clean_target_dir = clean_target_dir === undefined ? 
				this.config['export-clean-target'] 
				: clean_target_dir
			clean_target_dir
				&& fse.existsSync(to_dir)
				&& this.backupDir(to_dir, logger)

			// check if we have naming conflicts...
			var conflicts = this.imageNameConflicts()

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

								// XXX get/form image name... 
								// XXX might be a good idea to connect this to the info framework...
								var name = that.formatImageName(pattern, 
									gid, 
									{
										len: len,
										total_len: total_len,
										conflicts: conflicts.conflicts,
									})

								// handle virtual blocks...
								if(img.type == 'virtual'){
									name = (img.ext || pathlib.extname(name) != '') ? 
										name 
										: name +'.txt'
									to = img_dir +'/'+ name

									logger && logger.emit('queued', to)

									var res = include_virtual 
										&& !fse.existsSync(to)
										&& outputFile(to, img.text || '')

								// normal images...
								} else {
									// NOTE: we are intentionally losing image dir 
									// 		name here -- we do not need to preserve 
									// 		topology when exporting...
									var img_name = pathlib.basename(img.path || (img.name + img.ext))

									// get best preview...
									var from = (img.base_path || base_dir) 
											+'/'
											+ that.images.getBestPreview(gid, size).url


									// XXX see if we need to make a preview (sharp)
									// XXX

									var to = img_dir +'/'+ name

									logger && logger.emit('queued', to)

									var res = !fse.existsSync(to)
										&& copy(from, to)
								}

								// destination exists...
								if(!res){
									logger && logger.emit('skipping', to)

								} else {
									return res 
										.then(function(){
											logger && logger.emit('done', to) })
										.catch(function(err){
											logger && logger.emit('error', err) })
								}
							})
						})

					to_dir += level_dir != null ? 
						'/'+level_dir
						: ''

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
	],
	suggested: [
		'ui-fs-writer',
	],

	actions: FileSystemWriterActions,

	isApplicable: function(){ return this.runtime.node },

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
				alias: 'save',
				action: 'saveIndexHere',
				data: [
					'comment'
				],
			},
			'Current state as index': {
				alias: 'index',
				action: 'exportIndex',
				data: [
					'base_path',
					'target_dir',
					'clean_target_dir',
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
				alias: 'images',
				action: 'exportDirs',
				data: [
					'pattern',
					'size',
					'include_virtual',
					'base_path',
					'target_dir',
					'clean_target_dir',
					// XXX add option to disable this...
					//'level_dir',
				],
			},
		},

		// XXX format:
		// 	[
		// 		{
		// 			// XXX key in .config['export-dialog-modes']
		// 			type: <preset-tipe>,
		// 			...
		// 		}
		// 	]
		// XXX should this be a dict or a list???
		// 		...a dict would require keys (gid/title??)
		// XXX should this api be accessible from outside the ui???
		'export-presets': [],
	},

	// XXX this needs feedback...
	// XXX should this return a promise???
	saveIndexHere: ['File/$Save',
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
	saveFullIndex: ['File/Save ($full)',
		function(){
			return this
				.markChanged('all')
				.saveIndexHere()}],
	saveWithCommentDialog: ['File/Save with $comment...', 
		'exportDialog: "save"'],


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
			var img = actions.current
			var pattern = actions.config['export-preview-name-pattern'] || '%f'

			var showExaples = function(pattern, img){
				img = img || actions.current
				return actions.showList([
					// current...
					['Current:', 
						actions.formatImageName(pattern, img)],
					['Marked:', 
						actions.formatImageName(pattern, 
							img, 
							{tags: ['marked']})],
					['Bookmarked:', 
						actions.formatImageName(pattern, 
							img, 
							{tags: ['bookmark']})],
					['Repeating:', 
						actions.formatImageName(pattern, 
							img, 
							{conflicts: {[actions.current]: ['', actions.current], }} )],
					['All:', 
						actions.formatImageName(pattern, 
							img, 
							{
								tags: [
									'marked',
									'bookmark',
								],
								conflicts: {
									[img]: ['', img],
								}
							} )],
				], {
					cls: 'table-view',
				})
			}

			// XXX make this a dialog...
			var res = make(['Filename $pattern: ', pattern], {
				open: widgets.makeNestedConfigListEditor(actions, parent,
					'export-preview-name-patterns',
					'export-preview-name-pattern', {
						length_limit: 10,
						events: {
							menu: function(_, p){ showExaples(p) },
						},
						buttons: [
							['i', function(p){ showExaples(p) }],
						],
					}, function(){
						this.showExaples = function(){ showExaples(this.selected) }
						this.keyboard.handler('General', 'i', 'showExaples')
						this.showDoc = function(){ actions.showDoc('formatImageName') }
						this.keyboard.handler('General', '?', 'showDoc')
					}),
				buttons: [
					['?', function(){
						actions.showDoc('formatImageName')
					}],
				],
			})

			// show example generated names...
			make(['Filename:', 
				function(){ return actions.formatImageName(pattern, img) }],
				{
					open: function(){ 
						showExaples(actions.config['export-preview-name-pattern'] || '%f') },
				})

			return res
		},
		// XXX add option not to create level dirs...
		'level_dir': function(actions, make, parent){
			return make(['$Level directory: ', 
					function(){ 
						return actions.config['export-level-directory-name'] || 'fav' }])
				.on('open', 
					widgets.makeNestedConfigListEditor(actions, parent,
						'export-level-directory-names', 
						'export-level-directory-name', {
							length_limit: 10,
						})) },
		// XXX should we merge this with 'size_limit'????
		'size': function(actions, make, parent){
			return make(['Image $size: ', 
					function(){ 
						return actions.config['export-preview-size'] || 1000 }])
				.on('open', 
					widgets.makeNestedConfigListEditor(actions, parent,
						'export-preview-sizes',
						'export-preview-size',
						{
							length_limit: 10,
							sort: function(a, b){ return parseInt(a) - parseInt(b) },
							check: function(e){
								return !!parseInt(e) },
						}))

		},
		'size_limit': function(actions, make, parent){
			return make(['Limit image $size: ', 
					function(){ 
						return actions.config['export-preview-size-limit'] || 'no limit' }],
					{ buttons: [
						['clear', function(p){
							actions.config['export-preview-size-limit'] = 'no limit'
							parent.update()
						}],
					] })
				.on('open', 
					widgets.makeNestedConfigListEditor(actions, parent,
						'export-preview-size-limits',
						'export-preview-size-limit',
						{
							length_limit: 10,
							// sort ascending + keep 'no limit' at top...
							sort: function(a, b){ 
								return a == 'no limit' ?
										-1
									: b == 'no limit' ?
										1
									: parseInt(a) - parseInt(b) },
							check: function(e){
								return e == 'no limit' 
									|| !!parseInt(e) },
							remove: function(e){
								return e != 'no limit' },
						}))
		},
		// XXX should this be editable???
		'base_path': function(actions, make, parent){
			var elem = make(['Current path: ', this.location.path], 
				{
					select: function(){
						elem.find('.text').last().selectText() },
					deselect: function(){
						elem.find('.text').last().selectText(null) },
				}) },
		// XXX BUG: history closing errors -- non-critical...
		'target_dir': function(actions, make, parent){
			var elem = make(['$To: ', 
				function(){ return actions.config['export-path'] || './' }], 
				{ 
					buttons: [
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
					],
					// XXX make this editable???
					open: function(){
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
					},
				})
		},
		'comment': function(actions, make, parent){
			var elem = make(['$Comment: ', 
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
		'include_virtual': function(actions, make, parent){
			var elem = make([
					'Include $virtual: ', 
					actions.config['export-include-virtual'] ?
						'yes' 
						: 'no'], 
				{ open: function(){
					var v = actions.config['export-include-virtual'] = 
						!actions.config['export-include-virtual'] 
					elem.find('.text').last()
						.text(v ? 'yes' : 'no') }, }) },
		'clean_target_dir': function(actions, make, parent){
			var elem = make([
					'$Clean target: ', 
					actions.config['export-clean-target'] ?
						'yes' 
						: 'no'], 
				{ open: function(){
					var v = actions.config['export-clean-target'] = 
						!actions.config['export-clean-target'] 
					elem.find('.text').last()
						.text(v ? 'yes' : 'no') }, }) },
	},
	// XXX update export state: index, crop, image...
	// XXX should this be visible directly???
	exportDialog: ['- File/Export...',
		widgets.makeUIDialog(function(mode){
			var that = this

			// mode aliases...
			var mode_aliases = Object.entries(that.config['export-dialog-modes'] || {})
				.reduce(function(res, [key, value]){
					res[value.alias || key] = key
					return res
				}, {})
			var show_mode = mode_aliases[mode] || mode

			var o = browse.makeLister(null, function(path, make){
				var dialog = this

				mode = show_mode 
					|| that.config['export-dialog-mode'] 
					|| 'Images only'
				// if invalid mode get the first...
				mode = !that.config['export-dialog-modes'][mode] ?
					Object.keys(that.config['export-dialog-modes']).shift()
					: mode
				var data = that.config['export-dialog-modes'][mode].data

				// mode selector...
				!show_mode
					&& make(['Export $mode: ', 
							function(){ 
								return mode }], 
						{
							// XXX for some reason o is initially undefined when
							// 		it should be set to the dialog...
							//widgets.makeNestedConfigListEditor(that, o,
							open: widgets.makeNestedConfigListEditor(that, make.dialog,
									'export-dialog-modes',
									'export-dialog-mode',
									{
										length_limit: 10,
										new_item: false,
										itemButtons: [],
									}),
						})

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
						return mode == mode_aliases['save'] ? 
							'$Save' 
							: '$Export' }], 
					{
						cls: 'selected',
						open: function(){
							var mode = 
								that.config['export-dialog-modes'][that.config['export-dialog-mode']]
							that[mode.action](
								that.config['export-path'] || undefined)
							dialog.close()
						},
					}) 

				make.done()
			})

			o.dom.addClass('table-view tail-action')

			return o
		})],

	// aliases...
	// NOTE: .saveWithCommentDialog(..) is another alias (see above)...
	exportIndexDialog: ['File/$Export index...', 
		'exportDialog: "index"'],
	exportImagesDialog: ['File/Export $images...', 
		'exportDialog: "images"'],


	// XXX export using a preset...
	// 		- display a list of presets accessible with 1-9 keys + title 
	// 			hotkeys...
	// 			a-la collection list + location history...
	// 			- edit, remove buttons
	// 			- sortable
	// 			- pinnable?
	// 				...thought of prioritizing based on path (relative vs. 
	// 				absolute) but this seems to be wrong...
	// 				prioritizing based on title (optional) is logical 
	// 				on the other hand, but not sure if having a title here
	// 				is a good idea in the first place -- overcomplicating things
	// 				...having a note/comment on the other hand is a good idea...
	// 			- fixed number???
	// 			- select last used
	// 		- use .exportDialog(..) as preset editor
	// 			- add optional 'title'
	// 		- "New/Custom..." button
	// 		- single image mode:
	// 			- disable index exporting for single images
	// 		- add option to export only current image from any view...
	// XXX need a means to save/manage/run presets...
	exportPresets: ['- File/Export...',
		widgets.makeUIDialog(function(mode){
			// XXX
		})],

	// XXX these do note need the ui -- move to a separate feature...
	// XXX these are essentially the same as the history API, make a 
	// 		generic list manager???
	saveExportPreset: ['- File/', 
		function(){}],
	deleteExportPreset: ['- File/', 
		function(){}],
	runExportPreset: ['- File/', 
		function(){}],
})


var FileSystemWriterUI = 
module.FileSystemWriterUI = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-fs-writer',
	depends: [
		'ui-fs-loader',
		'fs-writer', 
	],

	actions: FileSystemWriterUIActions,
})



//---------------------------------------------------------------------

// NOTE: this is not a trivial meta-feature purely for aesthetic reasons,
// 		when the fs stuff is not applicable it's really confusing to see
// 		an 'fs' feature loaded in the feature list... at least to me ;)
// 		XXX should we do anything about this?
core.ImageGridFeatures.Feature({
	tag: 'fs', 
	suggested: [
		'index-format',
		'fs-info',
		'fs-loader',
		'fs-writer',
	],
	isApplicable: FileSystemInfo.isApplicable,
})




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
