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

	var file = require('imagegrid/file') }

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

var containers = require('lib/types/containers')



/*********************************************************************/

if(typeof(process) != 'undefined'){
	var copy = file.denodeify(fse.copy)
	var ensureDir = file.denodeify(fse.ensureDir)
	var outputFile = file.denodeify(fse.outputFile)
	var createFile = file.denodeify(fse.createFile)
}



/*********************************************************************/
// Index Format...

var IndexFormatActions = actions.Actions({
	config: {
		'index-dir': '.ImageGrid',

		// XXX should these be 'p' or 'px' (current)???
		'preview-sizes': [
			//75,
			200,
			480,
			//900,
			1080,
			//1440,
			//2160,
		],
		'preview-sizes-priority': [
			//75,
			//200,
			1080,
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



//---------------------------------------------------------------------
// FS Info... (XXX cleanup???)

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
		// XXX make the pattern case-agnostic (see .imageFilePattern)
		'image-file-pattern': '*.@(jpg|jpeg|png|svg|gif)',

		'image-file-read-stat': true,
		'image-file-skip-previews': false,

		'default-load-method': 'loadIndex',
	},

	// NOTE: this is not called too often thus there is not need to cache...
	get imageFilePattern(){
		return this.config['image-file-pattern']
			.replace(/([a-z]+)/g, 
				function(e){ 
					return e +'|'+ e.toUpperCase() }) },
	set imageFilePattern(value){
		this.config['image-file-pattern'] = value },


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
	loadIndex: ['- File/Load index',
		function(path, from_date, logger){
			var that = this
			var index_dir = util.normalizePath(this.config['index-dir'])

			logger = logger || this.logger
			logger = logger && logger.push('Load')

			if(path == null){
				logger && logger.emit('error: no path given')
				return Promise.reject('no path given') }
			path = util.normalizePath(path)

			if(from_date && from_date.emit != null){
				logger = from_date
				from_date = null }

			return file.loadIndex(path, index_dir, from_date, logger)
				.then(function(res){
					var force_full_save = false

					// skip nested paths...
					// XXX make this optional...
					var skipped = new Set()
					var paths = Object.keys(res)
					// no indexes found...
					if(paths.length == 0){
						logger && logger.emit('error: no index in', path)
						return Promise.reject('no index in: '+ path) }
					paths
						.forEach(function(p){
							// already removed...
							if(skipped.has(p) >= 0){
								return }
							paths
								// get all paths that fully contain p...
								.filter(function(o){
									return o != p 
										&& o.indexOf(p) == 0 })
								// drop all nested (longer) paths...
								.forEach(function(e){
									skipped.add(e)
									delete res[e] }) })
					// keep only the valid paths...
					paths = Object.keys(res).sort()

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
							continue }

						// build the data from images...
						if(res[k].data == null){
							res[k].data = {
								order: Object.keys(res[k].images),
							} }

						// prepare to do a full save if format version updated...
						if(res[k].data.version != that.data.version){
							// compensate for a typo that was discovered in v3.1
							var v = res[k].data.version || res[k].data.varsion
							logger && logger.emit('Data version changed:',
								v, '->', that.data.version)

							force_full_save = true }

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
							index.images.join(part.images) }

						loaded.push(k) }

					logger && logger.emit('load index', index)


					// prepare the location data...
					index.location = 
						Object.assign(
							index.location || {},
							{
								path: path,
								loaded: loaded,
								load: 'loadIndex',
							})
					from_date
						&& (index.location.from = from_date)

					// this is the critical section, after this point we
					// are doing the actual loading....
					//that.loadOrRecover(index) 
					return that.loadOrRecover(index) 
						.then(function(){
							force_full_save
								// XXX remove as soon as merged index save is done...
								&& loaded.length == 1
								&& that.markChanged('all') }) }) }],

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
			var that = this
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
									images[gid].base_path = base }

								images[gid].preview = p[gid].preview 
								// XXX should we check if things have changed???
								that.markChanged('images', [gid]) } }) }
					return images }) }],
	// XXX indicate progress???
	getAllPreviews: ['File/Update image preview list',
		'getPreviews: "all"'],

	// Get images in path...
	//
	// This will:
	// 	- get images from path
	// 	- get basic stat data
	// 	- get previews from path if they exist (.getPreviews(..))
	//
	// Returns: Images object
	//
	// XXX revise logging...
	getImagesInPath: ['- File/',
		function(path, read_stat, skip_preview_search, logger){
			if(path == null){
				return }
			read_stat = read_stat == null ?
				this.config['image-file-read-stat']
				: read_stat
			skip_preview_search = skip_preview_search == null ?
				this.config['image-file-skip-previews']
				: skip_preview_search

			logger = logger || this.logger

			var that = this
			path = util.normalizePath(path)

			// progress...
			var found = []
			var update_interval
			if(logger){
				that.showProgress 
					&& that.showProgress(logger.path)
				update_interval = setInterval(function(){
					found.length > 0
						&& logger.emit('found', found) 
						&& (found = []) }, 50) }

			// get the image list...
			return new Promise(function(resolve, reject){
				var files = {}
				glob.globStream(path +'/'+ that.imageFilePattern, {
						stat: !!read_stat,
						withFileTypes: true,
						strict: false,
					})
					.on('data', function(e){ 
						var p = e.fullpath()
							// normalize win paths...
							.replace(/\\/g, '/')
						files[p] = e
						found.push(p) })
					.on('error', function(err){
						update_interval
							&& clearInterval(update_interval)
						console.error(err)
						reject(err) })
					.on('end', function(){ 
						update_interval
							&& clearInterval(update_interval)
						logger && found.length > 0
							&& logger.emit('found', found)
							&& (found = [])

						var lst = Object.keys(files)

						// XXX might be a good idea to make image paths relative to path...
						//lst = lst.map(function(p){ return pathlib.relative(base, p) })
						// XXX do we need to normalize paths after we get them from glob??
						//lst = lst.map(function(p){ return util.normalizePath(p) }), path)

						var imgs = images.Images.fromArray(lst, path)

						if(!!read_stat){
							var p = pathlib.posix

							imgs.forEach(function(gid, img){
								var stat = files[
									img.base_path ?
										p.join(img.base_path, img.path)
										: img.path]

								img.atime = stat.atime
								img.mtime = stat.mtime
								img.ctime = stat.ctime
								img.birthtime = stat.birthtime

								img.size = stat.size

								// XXX do we need anything else???
							}) }

						// pass on the result...
						resolve(imgs) }) })
			// load previews if they exist...
			.then(function(imgs){
				var index_dir = that.config['index-dir']
				var index_path = path +'/'+ index_dir

				return !skip_preview_search ? 
					//that.getPreviews('all', path, imgs)
					that.getPreviews('all', index_path, imgs)
					: imgs }) }],

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
					logger && logger.emit('loaded', imgs.keys()) 
					return that.loadOrRecover({
							images: imgs,
							data: data.Data.fromArray(imgs.keys()),

							location: {
								path: path,
								load: 'loadImages',
								sync: 'syncIndexWithDir',
							}
						})
						.then(function(){
							that.markChanged('none') }) }) }],

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
				return }

			if(logger === undefined 
					&& direction 
					&& typeof(direction) != typeof('str')){
				logger = direction
				direction = null }

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
					logger && logger.emit('loaded', imgs.keys()) 

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

					that.reload(true) }) }],

	// XXX revise logger...
	// XXX revise alignment...
	loadNewImages: ['File/Load new images to index',
		core.doc`Load new images...
		
			Load new images from current path...
			.loadNewImages()
				-> promise
		
			Load new images from path...
			.loadNewImages(path)
				-> promise
		
		This will prepend images in path (default .location.path) that 
		were not loaded in index...
		
		NOTE: this will not load images that are already loaded.
		`,
		{ locationSync: true,
			mode: function(){ 
				return ['loadIndex', 'loadImages'].includes(this.location.load) 
					|| 'disabled' }, },
		function(path, logger){
			var that = this
			path = path || this.location.path

			if(path == null){
				return }

			logger = logger || this.logger
			logger = logger && logger.push('Load new images')
			path = util.normalizePath(path)

			// cache the loaded images...
			var loaded = new Set(this.images
				.map(function(gid, img){ 
					return img.path }))
			//var base_pattern = RegExp('^'+path)

			return this.getImagesInPath(
					path, 
					that.config['image-file-read-stat'],
					that.config['image-file-skip-previews'],
					logger)
				// load the data...
				.then(function(imgs){
					var added = []
					var skipped = []
					var progress = function(){
						skipped.length > 0
							&& logger.emit('skipped', skipped)
							&& (skipped = [])
						added.length > 0
							&& logger.emit('done', added)
							&& (added = []) }

					// remove the images we already have loaded...
					var t = Date.now()
					imgs.forEach(function(gid, img){
						// XXX this does not let the browser update progress...
						Date.now() - t > 200
							&& (t = Date.now())
							&& progress()
						// NOTE: we do not need to normalize anything as
						// 		both the current path and loaded paths 
						// 		came from the same code...
						// XXX is this good enough???
						// 		...might be a good idea to compare absolute
						// 		paths...
						if(loaded.has(img.path) 
								|| loaded.has(pathlib.normalize(img.path))){
							delete imgs[gid] 
							skipped.push(gid)
						} else {
							added.push(gid) } })

					// finalize progress...
					if(logger){
						skipped.length > 0
							&& logger.emit('skipped', skipped)
						added.length > 0
							&& logger.emit('done', added) }

					// nothing new...
					if(imgs.length == 0){
						// XXX
						logger && logger.emit('loaded', [])
						return imgs }

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

					return imgs }) }],


	// Index checking...
	//
	// XXX move this to base.js???
	get indexCheckerActions(){
		var that = this
		return this.cache('indexCheckerActions', function(cached){
			return cached instanceof Array ? 
				cached.slice() 
				: this.actions
					.filter(function(action){
						return that.getActionAttr(action, 'checkIndex') }) }) },
	// NOTE: this is not implemented as an overloadable action because it
	// 		would require collection each action's results for post processing
	// 		which in turn would necessitate a second wrapper action that would
	// 		call the first as well as requiring the user not to call the 
	// 		overloaded action, and if each of the individual checks can be run
	// 		independently it would require a separate wrapper...
	// 		...this seems quire a bit more convoluted than the current
	// 		.indexCheckerActions + .checkIndex(..) pair...
	checkIndex: ['File/Check index consistency',
		core.doc`


		Protocol:
			- this will call all the actions in .indexCheckerActions 
			- each of the above actions should comply with:
				.<index-check-action>()
					-> promise
			- actions should set .changes appropriately
			- the returned promise should yield an array of changes -- empty
				array indicates that no changes were made.

		`,
		function(options={}){
			var context = 
				options.linked === false ? 
					this 
					: this.link()
			return Promise.all(
					context.indexCheckerActions
						.map(function(action){
							return context[action]() }))
				.then(function(res){
					res.flat().length > 0
						&& context.saveIndex() 
					// XXX BUG?: this is not returned by the action for some reason...
					return res }) }],

	// XXX might be a good idea to also search for previews here...
	// XXX is this different from .removeMissingImages(..)???
	checkIndexPaths: ['- File/',
		core.doc`Check index image path consistency

		Check currently loaded index for missing references and fix them
		if found.

		This will:
			- remove references to non-existing preview images (image.preview)
			- remove references to non-existing .path (image.path)


		NOTE: currently this is disabled for merged indexes, need to load
			and check individually...
		`,
		{checkIndex: true},
		core.sessionQueueHandler('checkIndex',
			function(queue, ...args){
				// XXX ignore merged index...
				//if((this.location.loaded || []).length > 1){
				//	throw new Error('.checkIndex(): combined indexes not supported.') }
				return [this.images.keys(), ...args] },
			function(gid, ...args){
				var image = this.images[gid]
				var updated = false
				// image .previews...
				var previews = image.preview || {}
				Object.entries(previews)
					.forEach(function(p){
						!fse.existsSync(image.base_path +'/'+ p[1])
							&& (updated = true)
							&& (delete previews[p[0]]) })
				// cleanup...
				Object.keys(previews).length == 0
					&& (delete image.preview)
				// image .path...
				!fse.existsSync(image.base_path +'/'+ image.path)
					&& (updated = true)
					&& (delete image.path)
				return updated ? 
					gid 
					: [] })],


	// XXX should this take a path argument???
	// XXX not yet sure about this...
	removeMissingImages: ['File/Remove missing images from index',
		core.doc`Remove missing images from index

			.removeMissingImages()
				-> promise
		
		This will remove images that are not found via their original 
		path/name from the index.

		NOTE: no actual data is removed.
		NOTE: this will not remove generated previews from index.
		`,
		{ locationSync: true,
			mode: 'loadNewImages', },
		function(logger){
			var that = this
			logger = logger || this.logger
			rem_logger = logger && logger.push('Remove missing')
			logger = logger && logger.push('Check missing')

			logger 
				&& logger.emit('queued', this.images.keys())

			var chunk_size = '100C'
			var removed = []

			return this.images
				.map(function(gid, image){ 
					return [gid, image] })
				.mapChunks(chunk_size, [
					function([gid, image]){
						var updated = false

						image.path 
							&& !fse.existsSync(image.base_path +'/'+ image.path)
							&& (updated = true)
							&& logger 
								&& removed.push(gid)

						return updated ? gid : [] },
					// do the logging per chunk...
					function(chunk, res){
						logger 
							&& logger.emit('done', chunk.map(function([gid]){ return gid })) 
							&& rem_logger.emit('queued', removed)
							&& (removed = []) }])
				.then(function(res){
					res = res.flat()
					return res.length > 0 ?
						res
							.mapChunks(chunk_size, [
								// clear images...
								function(gid){
									delete that.images[gid] }, 
								// log...
								function(chunk){
									logger && rem_logger.emit('done', chunk) }])
							// clear data...
							.then(function(){
								that.data.clear(res) 
								return res })
						: res })
				// clear out progress...
				.then(function(res){
					logger && rem_logger.emit('done')
					return res }) }],


	// XXX EXPERIMENTAL...
	// shorthand...
	syncIndexWithDir: ['File/Synchronize index to path',
		core.doc`Load new and remove deleted images...

			.syncIndexWithDir()
				-> promise


		This will call:
			.loadNewImages()
			.removeMissingImages()
		`,
		{ locationSync: true,
			mode: 'loadNewImages', },
		function(logger){
			return Promise.all([
				this.loadNewImages(),
				this.removeMissingImages(), ]) }],
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
					res.then(
						function(){ 
							// NOTE: this repeats the functionality in 
							// 		base.js' 'edit' feature...
							// 		this is needed to go around the async
							// 		loading and .loadOrRecover(..)
							// 		XXX can we make this cleaner?
							// 			...a post-load event??
							that.data.version_updated ?
								that.markChanged('all') 
								: that.markChanged('none') },
						function(){}) } }],
		// mark everything changed when loading images...
		['loadImages',
			function(res){
				var that = this
				res.then(
					function(){ 
						that.markChanged('all') },
					function(){}) }],
		// add new images to changes...
		['loadNewImages',
			function(res){
				var that = this
				res.then(
					function(imgs){
						imgs 
							&& imgs.length > 0 
							&& that
								.markChanged('data')
								.markChanged('images', imgs.keys()) },
					function(){}) }],
		['checkIndexPaths',
			function(res){
				var that = this
				res.then(
					function(gids){
						gids.length > 0
							&& that.markChanged('images', gids) },
					function(){}) }],
		['removeMissingImages',
			function(res){
				var that = this
				res.then(
					function(gids){
						gids.length > 0
							&& that
								.markChanged('data')
								.markChanged('images') 
								.reload(true) },
					function(){}) }],
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
				return res }) }) }


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

			// XXX add option to build and load index...
			//loadNewIndex: "$PATH",

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
						this.imageFilePattern,
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
									o.close() })
							return so } })
					// we closed the browser -- save settings to .config...
					.on('close', function(){
						var config = 
							that.config['file-browser-settings'] = 
							that.config['file-browser-settings'] || {}

						config.disableFiles = o.options.disableFiles
						config.showDisabled = o.options.showDisabled
						config.showNonTraversable = o.options.showNonTraversable
						// normalize...
						config.disableDotFiles = 
							o.options.disableDotFiles ?
								'on' 
								: 'off' })
			return o })],

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
		widgets
			.makeUIDialog(function(){
				var that = this
				var index_dir = this.config['index-dir']

				var o = browse.makeLister(null, function(path, make){
					var dialog = this
					var path = that.location.path

					if(that.location.load != 'loadIndex'){
						make('No indexes loaded...', null, true)
						return }

					// indicate that we are working...
					var spinner = make('...')

					// XXX we do not need to actually read anything....
					//file.loadIndex(path, that.config['index-dir'], this.logger)
					// XXX we need to prune the indexes -- avoid loading nested indexes...
					var res = []
					file.listIndexes(path, index_dir)
						.on('error', function(err){
							console.error(err) })
						.on('data', function(path){
							res.push(path) })
						.on('end', function(){
							// we got the data, we can now remove the spinner...
							spinner.remove()

							res.forEach(function(p){
								// trim local paths and keep external paths as-is...
								p = p.split(index_dir)[0]
								var txt = p.split(path).pop()
								txt = txt != p ? './'+pathlib.join('.', txt) : txt

								make(txt)
									.on('open', function(){
										that.loadIndex(p) }) }) }) })
				.on('open', function(){
					o.close() })
			return o })],

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
			return ((this.comments || {}).save 
					&& this.comments.save[save || 'current']) 
				|| '' }],

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
	// NOTE: this will show no history if .location.load is not 'loadIndex'..
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
				if(that.location.load != 'loadIndex'){
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
								list.push(d) }) })

						list
							.sort()
							.reverse()

						// Special case: unsaved state...
						if(that.unsaved_index){
							var unsaved = that.unsaved_index

							make(_makeTitle('Original state (unsaved)', 'current', unsaved))	
								.on('open', function(){
									that.load(unsaved)
									delete that.unsaved_index })

						// Special case: top save state is the default, 
						// no need to mark anything for change, but only
						// if nothing changed...
						} else if(that.changes === false){
							var first = list.shift()
							first && make(_makeTitle(Date.fromTimeStamp(first).toShortDate(), first))	
								.on('open', function(){
									that.loadIndex(that.location.path, first) }) }

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
												delete that.comments.save.current }) })
									// mark the current loaded position...
									.addClass(d == from ? 'selected highlighted' : '') })

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

var EXPORT_PREVIEW_NAME = '%(fav)l%n%(-%c)c'


// XXX rename: 'clean-target' -> 'merge-to-target'
var FileSystemWriterActions = actions.Actions({
	config: {

		// main settings...
		'export-settings': {
			'path': null,

			'include-virtual': true,
			// XXX rename to 'merge-to-target'
			'clean-target': true,

			// NOTE: file extension is added automatically...
			// NOTE: see .formatImageName(..) for format docs...
			'preview-name-pattern': '%(fav)l%n%(-%c)c',

			// XXX is this used???
			//'level-directory-name': 'fav',

			// XXX do we need both???
			'preview-size': 1000,
			'preview-size-limit': 'no limit',
		},

		// history / presets...
		'export-paths': [],
		'export-preview-name-patterns': [
			// XXX should we auto-append %C to everything???
			'%(fav)l%n%(-bookmarked)b%C',
			'%(fav)l%n%(-bookmarked)b%(-m)m%C',
			'%(fav)l%n%C',
			'%(fav)l%i-%n%C',
			'%(fav)l%g-%n%C',
		],
		'export-%C-value': '%(-%c)c%(.%f)f',
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
		'export-preview-size-limits': [
			'no limit',
			'900',
			'1000',
			'1280',
			'1920',
		],
		'export-level-directory-names': [
			'fav',
			'select',
		],

		//'index-filename-template': '${DATE}-${KEYWORD}.${EXT}',
		
		// This is used in .exportIndex(..) to resolve name conflicts...
		//
		// NOTE: this is applied ONLY if there is a naming conflict...
		// NOTE: see .formatImageName(..) for format docs...
		// XXX adding a %c is more human-readable but is unstable as
		// 		depends on gid order, %g resolves this problem but is 
		// 		not very intuitive...
		// XXX is this used???
		//'export-conflicting-image-name': '%n%(-%g)c',
		'export-conflicting-image-name': '%n%(-%c)c',

		/* XXX LEGACY...
		'export-path': null,
		'export-include-virtual': true,
		'export-clean-target': true,
		'export-preview-name-pattern': '%(fav)l%n%(-%c)c',
		'export-level-directory-name': 'fav',
		'export-preview-size': 1000,
		'export-preview-size-limit': 'no limit',
		//*/
	},

	
	// XXX %c should also be able to handle output collisions, i.e. when 
	// 		a file already exists...
	// 		...or should this be a different placeholder handled 
	// 		externally???
	// XXX %c should be local to current crop -- now seems to be global...
	// XXX document data format...
	// XXX should %T / %I be global or current crop???
	// XXX add comments...
	// 		%comment - add comment if present
	// 		%(...%comment )comment - add comment if present
	// XXX add tags/keywords... 
	// 		%(tag|...)k - if image is tagged with tag add text
	formatImageName: ['- File/Format image filename',
		core.doc`

		Filename patterns:
			%n		- name without extension
		
			%gid	- full image gid
			%g		- short gid
		
			%i		- image index in ribbon
			%I		- global image index

			%r		- ribbon number
			%R		- ribbon number counting from the bottom

			%t		- total number of images in ribbon
			%T		- total number of images

			%(...)m	- add text in braces if image marked
			%(...)b	- add text in braces if image is bookmark

			%C		- shorthand for '%(-%c)c%(.%f)f'.
						(set in .config['export-%C-value'])
			%(...)c	- add text in braces if there are name conflicts 
						present in current index, but only if the current 
						image has a conflicting name.
			%c		- number in set of conflicting names (default: 0).
						NOTE: this is not stable and can change depending
							on image order.
			%(...)f - same as %{...}c but for conflitcs in output directory
						with pre-existing files.
			%f 		- same as %c but for conflicts in output directory with
						pre-existing files.

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
			pattern = pattern 
				|| EXPORT_PREVIEW_NAME
			data = data || {}
			var gid = data.gid
			if(!gid && name in this.images){
				gid = name
				name = null }
			gid = gid || this.current || ''
			var ribbon = this.data.getRibbon(gid)
			data = Object.assign({}, 
				this.images[gid] || {}, 
				data)

			name = name 
				|| pathlib.basename(
					data.path 
						|| ((data.name || '') + (data.ext || '')))
			name = name == '' ? 
				gid || '' 
				: name
			var ext = name != '' ?
				pathlib.extname(name)
				: ''
			var to_ext = data.ext 
				|| ext

			var tags = data.tags || this.data.getTags(gid)

			// XXX revise defaults...
			var len = data.len 
				|| (this.data.ribbons[ribbon] || []).len
			var total_len = data.total_len 
				|| this.data.length
			var r_len = data.r_len 
				|| Object.keys(this.data.ribbons).length

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
				.replace(/%C/, this.config['export-%C-value'] ?? '%(-%c)c%(.%f)f')
				.replace(/%c/, (conflicts && conflicts[gid]) ? 
					conflicts[gid].indexOf(gid) 
					: 0)
				.replace(/%f/, data.number ?? 0)

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

				// in conflicts...
				.replace(
					/%\(([^)]*)\)c/, (conflicts || {})[gid] ? '$1' : '')
				// out conflicts...
				.replace(
					/%\(([^)]*)\)f/, data.number > 0 ? '$1' : '')

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

				+ to_ext }],
	formatImageNameIter: ['- File/Format image filename (iter)',
		core.doc`Same as .formatImageName(..) but returns an iterator advancing 
		the %f value.

			data.number sets the initial count for %f

		`,
		function*(format, name, data){
			var n = data.number ?? 0
			var prev, cur
			while(true){
				cur = this.formatImageName(format, name, {__proto__: data, number: n++})
				if(cur == prev){
					break }
				yield cur
				prev = cur } }],
	

	// XXX should this be sync???
	backupDir: ['- File/',
		function(path, logger){
			// XXX get a logger...
			logger = logger || this.logger
			logger = logger && logger.push('Backup')

			do {
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

			// merged index... (XXX)
			if(path instanceof Array){
				console.error('saving to merged indexes not yet supported...')
				return }

			// no path given -> local save...
			if(path == null && this.location.load != 'loadIndex'){
				path = this.location.path }

			// resolve relative paths...
			if(/^(\.\.?[\\\/]|[^\\\/])/.test(path) 
					// and skip windows drives...
					&& !/^[a-z]:[\\\/]/i.test(path)){
				// XXX do we need to normalize???
				path = this.location.path +'/'+ path }

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
					;(process.platform == 'win32' 
							|| process.platform == 'win64')
						&& child_process
							.spawn('attrib', ['+h', full_path]) })
				.then(function(){
					location.load = 'loadIndex'
					location.from = index.date
					//return location
					return index }) }],

	// XXX add name conflict resolution strategies (pattern)...
	// 		...use the same strategy as for .exportImages(..)
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
	// XXX ASAP test settings['export-mode'] = 'copy best match'
	// XXX BUG: max_size is measured by preview size and ignores main 
	// 		image size...
	// 		...this results in exported images being previews ONLY IF 
	// 		they have previews larger than max_size...
	// XXX when no previews present this should create at least one file
	// 		of max_size...
	// XXX might also be good to save/load the export options to .ImageGrid-export.json
	// XXX log gid count instead of file count...
	exportIndex: ['- File/Export/Export index',
		core.doc`

			.exportIndex(path)
			.exportIndex(settings)

		settings format:
			{
			}

		`,
		function(path, max_size, include_orig, clean_target_dir, logger){
			var that = this
			var settings
			logger = logger || this.logger
			logger = logger && logger.push('Export index')

			if(path && typeof(path) != typeof('str')){
				settings = path
				path = settings.path }
			settings = settings 
				|| this.config['export-settings'] 
				|| {}
			// XXX resolve env variables in path...
			// 		...also add ImageGrid specifics: $IG_INDEX, ...
			// XXX
			path = path || './exported'
			path = util.normalizePath(path)

			max_size = parseInt(max_size 
					|| settings['preview-size-limit']) 
				|| null
			// XXX make this dependant on max_size....
			include_orig = include_orig || true
			var resize = max_size 
				&& this.makeResizedImage
				&& settings['export-mode'] != 'copy best match'

			// clear/backup target...
			clean_target_dir = clean_target_dir === undefined ? 
				settings['clean-target'] 
				: clean_target_dir
			clean_target_dir
				&& fse.existsSync(path)
				&& this.backupDir(path, logger)


			// resolve relative paths...
			if(/^(\.\.?[\\\/]|[^\\\/])/.test(path) 
					// and skip windows drives...
					&& !/^[a-z]:[\\\/]/i.test(path)){
				// XXX do we need to normalize???
				path = this.location.path +'/'+ path }

			var json = this.json()

			// get all loaded gids...
			var gids = []
			for(var r in json.data.ribbons){
				this.data.makeSparseImages(json.data.ribbons[r], gids) }
			gids = gids.compact()

			// build .images with loaded images...
			var images = {}
			gids.forEach(function(gid){
				var img = json.images[gid]
				if(img){
					images[gid] = json.images[gid] } })

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
					Object.keys(img.preview || {})
						.forEach(function(s){ 
							var p = img.preview[s]
							img.preview[s] = p == from_path ? 
								to_path 
								: p }) }

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
								return true }
							// skip and remove...
							delete previews[res]
							replace_orig = true })
						// get paths...
						.map(function(res){ 
							if(res != max){
								return decodeURI(previews[res]) }
							// NOTE: we will skip including the preview 
							// 		we are using as the primary image to
							// 		save space...
							delete previews[res] })
						// add primary image (copy)...
						// XXX check if any of the previews/main images 
						// 		matches the size and copy instead of resize...
						.concat((!resize
								&& include_orig 
								&& img.path) ? 
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
								return }
							if(preview_path instanceof Array){
								to = preview_path[1]
								preview_path = preview_path[0] }

							// we got a preview that is the same image as .path
							if(preview_path == to_path){
								to = to_path
								preview_path = from_path }

							var from = (img_base || base_dir) +'/'+ preview_path
							to = path +'/'+ (to || preview_path)

							// we do not need to report repeats...
							// NOTE: these can occur because the same image can
							// 		be included as a preview and as .path...
							if(seen.has(to)){
								return }

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
								queue
									.push(copy(from, to)
										.then(function(){
											logger && logger.emit('done', to) })
										.catch(function(err){
											logger && logger.emit('error', err) })) } }) } })

			// primary image (resize)...
			resize
				&& include_orig
				&& queue
					.push(this.makeResizedImage(gids, max_size, path, { 
						// NOTE: we do not transform here so as to keep 
						// 		the index as-is, minimizing changes...
						transform: false, 
						logger, 
					}))

			// index...
			var index = this.prepareIndexForWrite(json, true)
			// NOTE: if we are to use .saveIndex(..) here, do not forget
			// 		to reset .changes
			queue
				.push(
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

			return Promise.all(queue) }],

	// XXX ASAP transform images on export when "copy best preview"...
	// XXX ASAP test settings['export-mode'] = 'copy best match'
	// XXX resolve env variables in path... (???)
	// XXX report errors...
	// XXX use tasks (???)
	// XXX check global index ('%I') in crop...
	// XXX make clean_target more error tolerant...
	// XXX BUG: exporting and generating previews does odd things... (see keep)
	exportImages: ['- File/Export/Export ribbons as directories',
		core.doc`Export ribbons as directories

			.exportImages([images, ]path)
			.exportImages([images, ]settings)


		settings format:
			{
				path: <path>,

				'include-virtual': <bool>,

				'clean-target': <bool>,

				// NOTE: file extension is added automatically...
				// NOTE: see .formatImageName(..) for format docs...
				'preview-name-pattern': <str>,

				'export-mode': 'copy best match' | 'resize',

				'preview-size': <size>,
			}


		NOTE: see .formatImageName(..) for pattern syntax details.
		`,
		function(path, pattern, level_dir, size, include_virtual, clean_target_dir, logger){
			logger = logger || this.logger
			logger = logger && logger.push('Export dirs')
			var that = this
			var base_dir = this.location.path

			var images
			if(path == 'current' 
					|| path instanceof Array){
				images = path
				;[path, pattern, level_dir, size, include_virtual, clean_target_dir, logger] 
					= [...arguments].slice(1) }

			var settings
			if(path && typeof(path) != typeof('str')){
				settings = path
				path = settings.path }
			settings = settings 
				|| this.config['export-settings'] 
				|| {}

			images = (images 
					?? settings.images) 
				|| images
			if(images != null){
				images = 
					typeof(images) == 'string' ?
						(this.data.getImage(images) 
							?? this.data.getImages(images))
					: this.data.getImages(images) 
				images = new Set(
					images instanceof Array ?
						images
						: [images] ) }

			// XXX resolve env variables in path...
			// 		...also add ImageGrid specifics: $IG_INDEX, ...
			// XXX
			path = path || './exported-dirs'
			path = util.normalizePath(path)

			// XXX resolve env variables in path...
			// XXX

			// resolve relative paths...
			if(/^(\.\.?[\\\/]|[^\\\/])/.test(path) 
					// and skip windows drives...
					&& !/^[a-z]:[\\\/]/i.test(path)){
				// XXX do we need to normalize???
				path = this.location.path +'/'+ path }

			var to_dir = path

			// get/set the config data...
			// XXX should this store the last set???
			level_dir = level_dir === undefined ?
				level_dir 
				: (level_dir 
					|| settings['level-directory-name'] 
						|| 'fav')
			size = size 
				|| settings['preview-size'] 
				|| 1000
			var resize = this.makeResizedImage
				&& settings['export-mode'] != 'copy best match'
			pattern = pattern 
				|| settings['preview-name-pattern'] 
				|| EXPORT_PREVIEW_NAME
			include_virtual = include_virtual === undefined ?
				settings['include-virtual']
				: include_virtual

			// clear/backup target...
			clean_target_dir = clean_target_dir === undefined ? 
				settings['clean-target'] 
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
								if(images != null
										&& ! images.has(gid)){
									return }

								var img = that.images[gid]

								// XXX get/form image name... 
								// XXX might be a good idea to connect this to the info framework...
								// XXX generate next name if write failed...
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

								// normal images (resize)...
								} else if(resize){
									// XXX should this be sync???
									return that.makeResizedImage(gid, size, img_dir, { name, logger })

								// normal images (copy)...
								} else {
									//*/
									// NOTE: we are intentionally losing image dir 
									// 		name here -- we do not need to preserve 
									// 		topology when exporting...
									var img_name = pathlib.basename(img.path || (img.name + img.ext))

									// get best preview...
									var from = (img.base_path || base_dir) 
											+'/'
											+ that.images.getBestPreview(gid, size).url

									var to = img_dir +'/'+ name

									logger && logger.emit('queued', to)

									var res = !fse.existsSync(to)
										&& copy(from, to) }

								// destination exists...
								if(!res){
									logger && logger.emit('skipping', to)

								} else {
									return res 
										.then(function(){
											logger && logger.emit('done', to) })
										.catch(function(err){
											logger && logger.emit('error', err) }) } }) })

					to_dir += level_dir != null ? 
						'/'+level_dir
						: ''

					return res })) }],
	exportImage: ['- File/Export/Export current image',
		'exportImages: "current" ... -- '],
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
						// XXX should be done for all things that save...
						that.saved()
						that.markChanged('none') }) } }],
	],
})



//---------------------------------------------------------------------
// Writer UI...

// XXX add writer UI feature...
// 		- save as.. (browser)
// 		- save if not base path present (browser)
// XXX should export history and presets base be here or in the writer???
var FileSystemWriterUIActions = actions.Actions({
	config: {
		// NOTE: for more docs on export settings see FileSystemWriter.config...

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
					//'name',
					'base_path',
					'target_dir',
					'clean_target_dir',
					// XXX need to add options to size: 'none',
					// XXX use closest preview instead of hi-res when 
					// 		this is set...
					// XXX need to add option to save full index...
					'size_limit',
					'export_mode',
					// XXX might be a good idea to include source data links
					//'include_source_url', // bool
					'comment',
				],
			},
			'Images only': {
				alias: 'images',
				action: 'exportImages',
				data: [
					//'name',
					'pattern',
					'size',
					'export_mode',
					'include_virtual',
					'base_path',
					'target_dir',
					'clean_target_dir',
				],
			},
			'Current image': {
				alias: 'image',
				action: 'exportImage',
				data: [
					//'name',
					'pattern',
					'size',
					'export_mode',
					// XXX do we save virtual images???
					//'include_virtual',
					'base_path',
					'target_dir',
					//'clean_target_dir',
				],
			},
			//*/
		},

		//
		// Format:
		// 	{
		//		// NOTE: this is set/used by .exportDialog(..)
		//		// XXX replace this with action...
		//		'mode': 'Images only',
		//
		//		// NOTE: for more info see FileSystemWriter.config['export-settings']...
		//		...
		// 	}
		//
		// XXX this will accumulate settings from all export modes, is this correct???
		// XXX this is not yet used by the actual export actions, only for the UI...
		//'export-settings': {},

		//
		// Format:
		// 	[
		// 		{
		// 			// preset name (optional)...
		// 			name: ...,
		//
		// 			// see: 'export-settings' for more settings...
		// 			...
		// 		},
		// 		...
		// 	]
		//
		// XXX should this api be accessible from outside the ui???
		'export-presets': [
			{
				'mode': 'Images only',
				'path': 'select',
				'include-virtual': true,
				'clean-target': true,
				'preview-name-pattern': '%(fav)l%n%(-%c)c',
				'preview-size': '3000',
				'preview-size-limit': 'no limit',
				'export-mode': 'copy best match',
			},
			{
				'mode': 'Images only',
				'path': 'numbered ribbons',
				'include-virtual': true,
				'clean-target': true,
				'preview-name-pattern': '%r/%i-%n',
				'preview-size': 1000,
				'preview-size-limit': 'no limit',
				'export-mode': 'copy best match',
			},
			{
				'mode': 'Current state as index',
				'path': './state as index',
				'include-virtual': true,
				'clean-target': true,
				'preview-name-pattern': '%(fav)l%n%(-%c)c',
				'preview-size': 1000,
				'preview-size-limit': 'no limit',
			},
		],
		'export-history-length': 50,
		// XXX should this be stored here or like file history in session directly???
		'export-history': [],
	},

	// XXX rename???
	// XXX should this be here or in FileSystemWriter???
	// 		...FileSystemWriter does not define .mode for this to work correctly...
	exportAs: ['- File/',
		core.doc`Get export mode from settings and export via the appropriate
		export method.

			Export via .config['export-settings']...
			.exportAs()

			Export via settings...
			.exportAs(settings)
		
		`,
		function(settings){
			settings = settings 
				|| this.config['export-settings']
			var action = this.config['export-dialog-modes'][settings.mode].action
			return this[action](settings) }],

	// XXX this needs feedback...
	// XXX should this return a promise???
	saveIndexHere: ['File/$Save',
		core.doc`Save changes...

		NOTE: if .location is empty this will prompt user for save path by 
			launching .exportIndexDialog(..)
		`,
		function(){ 
			this.location.path ? 
				this.saveIndex() 
				: this.exportIndexDialog() }],
	// XXX should this be a UI action???
	// 		...at this point this depends on .saveIndexHere(..), thus 
	// 		it is here...
	// XXX should this return a promise???
	saveFullIndex: ['File/Save ($full)',
		core.doc`Save full state...

		NOTE: for more info see: .saveIndexHere(..)`,
		function(){
			return this
				.markChanged('all')
				.saveIndexHere()}],
	saveWithCommentDialog: ['File/Save with $comment...', 
		'exportDialog: "save" -- Save full state with a comment...'],


	// Export dialog...
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
		'pattern': function(actions, make, parent, settings){
			var img = actions.current
			var pattern = 
				settings['preview-name-pattern'] =
					settings['preview-name-pattern'] 
					|| EXPORT_PREVIEW_NAME

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
					['Repeating in index:', 
						actions.formatImageName(pattern, 
							img, 
							{conflicts: {[actions.current]: ['', actions.current], }} )],
					['Repeating in filesystem:', 
						actions.formatImageName(pattern, 
							img, 
							{number: 1})],
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
								},
								number: 1,
							} )],
				], {
					cls: 'table-view',
				})
			}

			// XXX make this a dialog...
			var res = make(['Filename $pattern: ', pattern], {
				open: widgets.makeNestedConfigListEditor(actions, parent,
					'export-preview-name-patterns',
					function(value){
						return arguments.length == 0 ?
							settings['preview-name-pattern']
							: (settings['preview-name-pattern'] = value) },
					{
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
				function(){ 
					return actions.formatImageName(pattern, img) }],
				{ open: function(){ 
						showExaples(settings['preview-name-pattern'] 
							|| EXPORT_PREVIEW_NAME) }, })

			return res },
		// XXX add option not to create level dirs...
		'level_dir': function(actions, make, parent, settings){
			return make(['$Level directory: ', 
					function(){ 
						return settings['level-directory-name'] || 'fav' }])
				.on('open', 
					widgets.makeNestedConfigListEditor(actions, parent,
						'export-level-directory-names', 
						function(value){
							return arguments.length == 0 ?
								settings['level-directory-name']
								: (settings['level-directory-name'] = value) },
						{
							length_limit: 10,
						})) },
		// XXX should we merge this with 'size_limit'????
		'size': function(actions, make, parent, settings){
			return make(['Image $size: ', 
					function(){ 
						return (settings['preview-size'] = 
							settings['preview-size'] 
							|| 1000) }])
				.on('open', 
					widgets.makeNestedConfigListEditor(actions, parent,
						'export-preview-sizes',
						function(value){
							return arguments.length == 0 ?
								settings['preview-size']
								: (settings['preview-size'] = value) },
						{
							length_limit: 10,
							sort: function(a, b){ return parseInt(a) - parseInt(b) },
							check: function(e){
								return !!parseInt(e) },
						})) },
		'size_limit': function(actions, make, parent, settings){
			return make(['Limit image $size: ', 
					function(){ 
						return (settings['preview-size-limit'] =
							settings['preview-size-limit'] 
							|| 'no limit') }],
					{ buttons: [
						['clear', function(p){
							settings['preview-size-limit'] = 'no limit'
							parent.update() }],
					] })
				.on('open', 
					widgets.makeNestedConfigListEditor(actions, parent,
						'export-preview-size-limits',
						function(value){
							return arguments.length == 0 ?
								settings['preview-size-limit']
								: (settings['preview-size-limit'] = value) },
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
						})) },
		// XXX should this be editable???
		'base_path': function(actions, make, parent, settings){
			var elem = make(['Current path: ', this.location.path], 
				{
					select: function(){
						elem.find('.text').last().selectText() },
					deselect: function(){
						elem.find('.text').last().selectText(null) },
				}) },
		// XXX BUG: history closing errors -- non-critical...
		'target_dir': function(actions, make, parent, settings){
			var elem = make(['$To: ', 
				function(){ 
					return (settings['path'] = 
						settings['path'] 
						|| './') }], 
				{ 
					buttons: [
						['browse', function(p){
							var e = this.filter('"'+p+'"', false)
							var path = e.find('.text').last().text()
							var txt = e.find('.text').first().text()

							// XXX add new dir global button...
							return actions.browsePath(path, 
								function(path){ 
									settings['path'] = path
									actions.config['export-paths'].splice(0, 0, path)
									parent.update()
									parent.select(txt)
								})
						}],
						// XXX BUG: closing this breaks on parant.focus()...
						['history', widgets.makeNestedConfigListEditor(actions, parent,
							'export-paths',
							function(value){
								return arguments.length == 0 ?
									settings.path
									: (settings.path = value) },
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
								settings['path'] = path
								actions.config['export-paths'].indexOf(path) < 0
									&& actions.config['export-paths'].splice(0, 0, path) })
							.on('edit-abort edit-commit', function(evt, path){
								parent.update()
									.then(function(){
										parent.select(path) }) }) },
				}) },
		'comment': function(actions, make, parent, settings){
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
									parent.select(text) }) }) }) },
		'include_virtual': function(actions, make, parent, settings){
			settings['include-virtual'] = !!settings['include-virtual']
			var elem = make([
					'Include $virtual: ', 
					settings['include-virtual'] ?
						'yes' 
						: 'no'], 
				{ open: function(){
					var v = settings['include-virtual'] = 
						!settings['include-virtual'] 
					elem.find('.text').last()
						.text(v ? 'yes' : 'no') }, }) },
		'export_mode': function(actions, make, parent, settings){
			if(!actions.makeResizedImage){
				return }
			settings['export-mode'] = 
				settings['export-mode'] 
				|| 'resize'
			var elem = make(['Export $mode: ', settings['export-mode'] ], 
				{ open: function(){
					var v = settings['export-mode'] = 
						settings['export-mode'] == 'resize' ?
							'copy best match'
							: 'resize'
					elem.find('.text')
						.last()
							.text(v) }, }) },
		'clean_target_dir': function(actions, make, parent, settings){
			settings['clean-target'] = !!settings['clean-target']
			var elem = make([
					'$Clean target: ', 
					settings['clean-target'] ?
						'yes' 
						: 'no'], 
				{ open: function(){
					var v = settings['clean-target'] = 
						!settings['clean-target'] 
					elem.find('.text').last()
						.text(v ? 'yes' : 'no') }, }) },
	},
	// XXX update export state: index, crop, image...
	// XXX should this be visible directly???
	exportDialog: ['- File/Export...',
		core.doc`

			.exportDialog()
			.exportDialog(mode)
			.exportDialog(settings)


		NOTE: when saving a preset the dialog will trigger a 'save-preset' event.
		`,
		widgets.makeUIDialog(function(mode){
			var that = this
			var settings

			// explicitly passed settings... 
			if(mode && typeof(mode) != typeof('str')){
				settings = mode
				mode = settings['mode'] }
			settings = settings
				|| (this.config['export-settings'] = 
					this.config['export-settings'] || {})
			// mode aliases...
			var mode_aliases = Object.entries(that.config['export-dialog-modes'] || {})
				.reduce(function(res, [key, value]){
					res[value.alias || key] = key
					return res }, {})
			var show_mode = mode_aliases[mode] || mode

			var o = browse.makeLister(null, function(path, make){
				var dialog = this

				mode = 
					settings['mode'] =
						show_mode 
						|| settings['mode']
						|| 'Images only'
				// if invalid mode get the first...
				mode = !that.config['export-dialog-modes'][mode] ?
					Object.keys(that.config['export-dialog-modes']).shift()
					: mode
				var data = that.config['export-dialog-modes'][mode].data

				// mode selector...
				// NOTE: this is only visible if no mode/settings are given...
				!show_mode
					&& make(['Export $mode: ', 
							function(){ return mode }], 
						{
							// XXX for some reason o is initially undefined when
							// 		it should be set to the dialog...
							//widgets.makeNestedConfigListEditor(that, o,
							open: widgets.makeNestedConfigListEditor(that, make.dialog,
								'export-dialog-modes',
								function(value){
									return arguments.length == 0 ?
										settings.mode
										: (settings.mode = value) },
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
							&& fields[k].call(that, that, make, dialog, settings))
						|| (base_fields[k] 
								&& base_fields[k].call(that, that, make, dialog, settings)) })

				// Start action...
				make([function(){
						// XXX indicate export state: index, crop, image...
						return mode == mode_aliases['save'] ? 
							'$Save' 
							: '$Export' }], 
					{
						cls: 'selected',
						open: function(){
							that.exportAs(settings)
							dialog.close() },
						buttons: [
							['<i><small>Save preset</small></i>',
								function(_, elem){
									that.exportPresetSave(settings)

									// button press feedback...
									var e = elem.find('.button small')
									var text = e.text()
									var reset = function(){
										e.text(text) }
									e.text('Saved.')
									e.one('mouseout', reset)
									setTimeout(reset, 2000)

									make.dialog.trigger('save-preset')
								}] ],
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


	// Export presets...
	//
	// XXX would be nice to be able to "export" (copy) single images as well...
	// 		...and it would be logical to have separate presets for single 
	// 		images and lists... (???)
	// XXX UI:
	// 		- element format:
	// 			TITLE
	// 			mode / destination / format
	// 		- button shortcuts...
	// XXX add a 'name' field to the exportDialog(..) (???)
	// XXX Q: should we be able to change preset type???
	exportPresets: ['- File/Export presets and history...',
		core.doc`
		`,
		widgets.makeUIDialog(function(mode){
			var that = this
			var logger = this.logger && this.logger.push('exportPresets')

			// generic helpers...
			var getName = function(preset){
				var date = preset.date
					&& Date.fromTimeStamp(preset.date).toShortDate()
				date = date ? 
					date + ' - '
					: ''
				var clean = preset['clean-target'] ? 
					'' 
					: ' (merge)'
				return date
					+ (preset.name
						|| ( preset.mode == 'Images only' ?
							`${ preset.mode }: `
								+`"${ preset['preview-name-pattern'] }" → "${ preset.path }"${ clean }`
							: `${ preset.mode }: → "${ preset.path }"${ clean }`)) }
			var buildIndex = function(source){
				var index
				return [
					index = containers.UniqueKeyMap(source
						.map(function(e){ 
							return [getName(e), e] })),
					[...index.keys()], ] }

			// presets...
			var presets = that.config['export-presets'] || []
			var [preset_index, preset_keys] = buildIndex(presets)

			var updatePresetIndex = function(full=false){
				var k
				;[preset_index, k] = full ?
					buildIndex(presets)
					: [preset_index, [...preset_index.keys()]]
				// NOTE: preset_keys must be updated in-place...
				preset_keys.splice(0, preset_keys.length, ...k) }
			var renamePreset = function(from, to){
				to = preset_index.rename(from, to, true)
				// update keys...
				preset_keys[preset_keys.indexOf(from)] = to
				return to }

			// history...
			// NOTE: history is reversed in view...
			var history = 
				(that.config['export-history'] || [])
					.slice()
					.reverse()
			var [history_index, history_keys] = buildIndex(history) 

			// last used preset...
			var last_used = Object.assign({}, history[0] || {})
			// NOTE: this is done for last_used to be matchable with presets...
			// 		XXX a better way to do this is to check for subset match...
			delete last_used.date
			// get the matching preset if available...
			last_used = presets
				.filter(function(preset){
					return Object.match(preset, last_used) })
				.shift() 
			// get the title...
			last_used = last_used ?
				preset_index.keysOf(last_used)[0]
				: history_keys[0]

			return browse.makeLister(null, function(path, make){
				// preset list...
				preset_keys.length > 0
					&& make.EditableList(preset_keys, {
						list_id: 'presets',
						sortable: true,
						update_merge: 'live',
						new_item: false,

						// saving an empty string on item edit will clear .name...
						allow_empty: true,
						itemedit: function(evt, from, to){
							var preset = preset_index.get(from)
							// reset...
							if(to.trim() == ''){
								delete preset.name
								// XXX need to ignore .date here...
								to = getName(preset)
							// set...
							} else {
								to = preset.name = to.trim() }

							to = renamePreset(from, to)

							// select item...
							// NOTE: this is not done automatically because 
							// 		we are changing the title .EditableList(..)
							// 		is expecting...
							make.dialog.one('update', 
								function(){
									make.dialog.select(to) }) },

						buttons: [
							// edit...
							['<small class="show-on-hover view-or-edit">edit</small>', 
								function(title){
									var preset = preset_index.get(title)
									that.exportDialog(preset)
										.close(function(){
											var n = getName(preset)
											// update the list if name is affected...
											if(n != title){
												n = renamePreset(title, n)

												make.dialog.select(n) 
												make.dialog.update() } })}],
							// duplicate...
							//['<span class="show-on-hover">&#x274F;</span>', 
							['<small class="show-on-hover">clone</small>', 
								function(title){
									// clone...
									var preset = JSON.parse(
										JSON.stringify( preset_index.get(title) ))
									preset.name = title + ' (copy)'
									// place new preset in list...
									presets.splice(preset_keys.indexOf(title)+1, 0, preset)
									updatePresetIndex(true)
									make.dialog.update() }],
							['&diams;', 'TO_TOP'],
							'REMOVE'],
						// export...
						open: function(evt, title){
							var preset = preset_index.get(title)
							// export only if we get a good preset...
							if(preset && getName(preset) == title){
								that.exportAs(preset)
								return make.dialog.close() }
							// error...
							logger 
								&& logger.emit('error', `preset not found: "${ title }"`) }, })

				// export dialog...
				make.Separator({ style: { opacity: '0.1' } })
				make('E$xport...', {
					open: function(){
						that.exportDialog()
							// new preset saved...
							.on('save-preset', function(){
								updatePresetIndex(true)
								make.dialog.update() })
							// close dialog on export...
							.close(function(evt, reason){
								reason != 'reject'
									&& make.dialog.close() }) }, })

				// history...
				make.Separator()
				history.length == 0 ?
					make.Empty('No export history...')
					: make.EditableList(history_keys, {
						list_id: 'history',
						sortable: false,
						new_item: false,
						editable_items: false,
						buttons: [
							// view...
							['<small class="show-on-hover view-or-edit">view</small>', 
								function(title){
									var preset = history_index.get(title)
									preset
										&& that.exportDialog(
												// prevent editing history...
												JSON.parse(JSON.stringify( preset )) ) 
											// new preset saved...
											.on('save-preset', function(){
												updatePresetIndex(true)
												make.dialog.update() })
											// close dialog on export...
											.close(function(evt, reason){
												reason != 'reject'
													&& make.dialog.close() }) }],
							// to preset...
							['<small class="show-on-hover">save</small>', 
								 function(title){
									var preset = history_index.get(title)
									if(preset){
										that.exportPresetSave(preset) 
										updatePresetIndex(true)
										make.dialog.update() } }],
							'REMOVE',
						],
						// export...
						open: function(evt, title){
							var preset = history_index.get(title)
							// export only if we get a good preset...
							if(preset && getName(preset) == title){
								that.exportAs(preset)
								return make.dialog.close() }
							// error...
							logger 
								&& logger.emit('error', 
									`history item not found: "${ title }"`) }, })
			})
			// keyboard...
			.run(function(){
				var that = this
				this.keyboard
					// edit/view...
					.on('E', function(){
						that
							.select()
							.find('.view-or-edit')
								.click() }) 
				// select last used...
				// XXX HACK -- for some reason setting path: [last_used] 
				// 		does not work correctly...
				setTimeout(function(){
					that.select(last_used) }, 0) })
			// save things after we are done...
			.close(function(){
				// update preset order and count...
				that.config['export-presets'] = preset_keys
					.map(function(e){
						return preset_index.get(e) })
				// handle history delete...
				history.length != that.config['export-history']
					&& (that.config['export-history'] = history_keys
						.reverse()
						.map(function(e){
							return history_index.get(e) })) }) })],

	// XXX these do note need the ui -- move to a separate feature...
	// XXX these are essentially the same as the history API, make a 
	// 		generic list manager???
	// XXX need to check preset uniqueness... (???)
	exportPresetSave: ['- File/', 
		function(settings){
			settings = settings 
				|| this.config['export-settings']
			// no settings...
			if(!settings){
				console.error('.exportPresets(..): no settings to save.')
				return }
			// isolate and cleanup...
			settings = JSON.parse(JSON.stringify(settings))
			delete settings.date
			// XXX check preset uniqueness...
			;(this.config['export-presets'] = 
					this.config['export-presets'] 
					|| [])
				.push(settings) }],

	// XXX the naming for these two is logical but inconsistent -- can
	// 		we fix this???
	exportHistoryPush: ['- File/', 
		function(settings){
			var l = this.config['export-history-length'] || 50
			var history = 
				this.config['export-history'] = 
					this.config['export-history'] || []
			// add...
			if(settings){
				// set .date...
				settings = Object.assign(
					JSON.parse(JSON.stringify( settings )), 
					{ date: Date.timeStamp(true) })
				// remove all identical settings from history...
				var keys_l = Object.keys(settings).length
				for(var i=history.length-1; i >= 0; i--){
					var item = history[i]
					if(keys_l != Object.keys(item).length){
						continue }
					var match = true
					for(var k in settings){
						// ignore .date...
						if(k == 'date'){
							continue }
						if(item[k] != settings[k]){
							match = false
							break } }
					match
						&& history.splice(i, 1) }
				// add...
				history.push(settings) }
			// trim the history list to length...
			history.length > l
				&& history.splice(0, history.length - l) }],
	clearExportHistory: ['- File/Clear export history',
		function(){
			delete this.config['export-history'] }],
})


var FileSystemWriterUI = 
module.FileSystemWriterUI = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-fs-writer',
	depends: [
		'ui-editor',
		'ui-fs-loader',
		'fs-writer', 
	],

	actions: FileSystemWriterUIActions,

	handlers: [
		// update export history...
		[[
			'exportImage',
			'exportIndex',
			'exportImages',
		], function(_, settings){
			this.exportHistoryPush(
				(!settings || typeof(settings) == typeof('str')) ?
					this.config['export-settings']
					: settings) }]
	],
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
* vim:set ts=4 sw=4 nowrap :                        */ return module })
