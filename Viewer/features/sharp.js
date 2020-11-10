/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

var array = require('lib/types/Array')

var actions = require('lib/actions')
var features = require('lib/features')

var core = require('features/core')

try{
	var sharp = requirejs('sharp')

} catch(err){
	var sharp = null
}

if(typeof(process) != 'undefined'){
	var cp = requirejs('child_process')
	var fse = requirejs('fs-extra')
	var pathlib = requirejs('path')
	var glob = requirejs('glob')
	var exifReader = requirejs('exif-reader')

	var file = require('imagegrid/file')
}



/*********************************************************************/
// helpers...

if(typeof(process) != 'undefined'){
	var copy = file.denodeify(fse.copy)
	var ensureDir = file.denodeify(fse.ensureDir)
}


//---------------------------------------------------------------------

var normalizeOrientation =
module.normalizeOrientation =
function(orientation){
	return {
		orientation: ({
				0: 0,
				1: 0,
				2: 0,
				3: 180,
				4: 0,
				5: 90,
				6: 90,
				7: 90, 
				8: 270,
			})[orientation],
		flipped: ({
				0: null,
				1: null,
				2: ['horizontal'],
				3: null,
				4: ['vertical'],
				5: ['vertical'],
				6: null,
				7: ['horizontal'],
				8: null,
			})[orientation],
	} }



//---------------------------------------------------------------------
// Convert image metadata from exif-reader output to format compatible 
// with exiftool (features/metadata.js)

// Format:
// 	{
// 		// simple key-key pair...
// 		'path.to.value': 'output-key',
//
// 		// key with value handler...
// 		'path.to.other.value': ['output-key', handler],
//
// 		// alias to handler...
// 		'path.to.yet.another.value': ['output-key', 'path.to.other.value'],
// 	}
//
var EXIF_FORMAT =
module.EXIF_FORMAT = {
	// camera / lens...
	'image.Make': 'make',
	'image.Model': 'cameraModelName',
	'image.Software': 'software',
	'exif.LensModel': 'lensModel',

	// exposure...
	'exif.ISO': 'iso',
	'exif.FNumber': ['fNumber', 
		function(v){ return 'f/'+v }],
	'exif.ExposureTime': ['exposureTime',
		// NOTE: this is a bit of a brute-fore approach but for shutter 
		// 		speeds this should not matter...
		function(v){
			if(v > 0.5){
				return ''+ v }
			for(var d = 1; (v * d) % 1 != 0; d++){}
			return (v * d) +'/'+ d }],

	// dates...
	'exif.DateTimeOriginal': ['date/timeOriginal',
		function(v){
			return v.toShortDate() }],
	'image.ModifyDate': ['modifyDate', 
		'exif.DateTimeOriginal'],

	// IPCT...
	'image.Artist': 'artist',
	'image.Copyright': 'copyright',

	// XXX anything else???
}

// NOTE: this only reads the .rating from xmp...
var exifReader2exiftool = 
module.exifReader2exiftool =
function(exif, xmp){
	return Object.entries(EXIF_FORMAT)
		// handle exif...
		.reduce(function(res, [path, to]){
			var handler
			;[to, handler] = to instanceof Array ?
				to
				: [to]
			// resolve handler reference/alias...
			while(typeof(handler) == typeof('str')){
				handler = EXIF_FORMAT[handler][1] }
			// resolve source path...
			var value = path.split(/\./g)
				.reduce(function(res, e){ 
					return res && res[e] }, exif)
			// set the value...
			if(value !== undefined){
				res[to] = handler ?
					handler(value)
					: value }
			return res }, {})
		// handle xmp...
		.run(function(){
			var rating = xmp 
				// NOTE: we do not need the full XML 
				// 		fluff here, just get some values...
				&& parseInt(
					(xmp.toString()
							.match(/(?<match><(xmp:Rating)[^>]*>(?<value>.*)<\/\2>)/i) 
						|| {groups: {}})
					.groups.value)
			rating
				&& (this.rating = rating) }) }




/*********************************************************************/

var SharpActions = actions.Actions({
	config: {
		'preview-normalized': true,

		// can be:
		// 	'gids'
		// 	'files'
		'preview-progress-mode': 'gids',

		'preview-generate-threshold': 2000,

		// NOTE: this uses 'preview-sizes' and 'preview-path-template' 
		// 		from filesystem.IndexFormat...
	},

	// XXX need to distinguish if something was written in the promise chain...
	// 		...return false???
	// 		......should the return value be a bit more informative???
	// 		something like:
	// 			{
	// 				gid: ..
	// 				path: ..
	// 				status: ..
	// 				...
	// 			}
	// XXX make backup name pattern configurable...
	// XXX add crop support...
	makeResizedImage: ['- Image/',
		core.doc`Make resized image(s)...

			.makeResizedImage(gid, size, path[, options])
			.makeResizedImage(gids, size, path[, options])
				-> promise


		Image size formats:
			500px		- resize to make image's *largest* dimension 500 pixels (default).
			500p		- resize to make image's *smallest* dimension 500 pixels.
			500			- same as 500px


		options format:
			{
				// output image name...
				//
				// Used if processing a single image, ignored otherwise.
				name: null | <str>,

				// image name pattern and data...
				//
				// NOTE: for more info on pattern see: .formatImageName(..)
				pattern: null | <str>,
				data: null | { .. },

				// if true and image is smaller than size enlarge it...
				// 
				// default: null / false
				enlarge: null | true,

				// overwrite, backup or skip (default) existing images...
				//
				// default: null / false
				overwrite: null | true | 'backup',

				// if true do not write an image if it's smaller than size...
				// 
				// default: null / false
				skipSmaller: null | true,

				// XXX not implemented...
				transform: ...,
				crop: ...,

				timestamp: ...,
				logger: ...,
,			}


		NOTE: all options are optional.
		NOTE: this will not overwrite existing images.
		`,
		core.abortablePromise('makeResizedImage', function(abort, images, size, path, options={}){
			var that = this

			// sanity check...
			if(arguments.length < 3){
				throw new Error('.makeResizedImage(..): '
					+'need at least images, size and path.') }

			var CHUNK_SIZE = 4

			abort.cleanup(function(reason, res){
				logger 
					&& logger.emit('done')
					&& reason == 'aborted'
						&& logger.emit(res) })

			// get/normalize images...
			//images = images || this.current
			images = images 
				|| 'all'
			// keywords...
			images = images == 'all' ? 
					this.data.getImages('all')
				: images == 'current' ? 
					this.current
				: images
			images = images instanceof Array ? 
				images 
				: [images]
			// sizing...
			var fit = 
				typeof(size) == typeof('str') ?
					(size.endsWith('px') ?
						'inside'
					: size.endsWith('p') ?
						'outside'
					: 'inside')
				: 'inside'
			size = parseInt(size)
			// options...
			var {
				// naming...
				name, 
				pattern, 
				data, 

				// file handling...
				enlarge,
				skipSmaller,
				overwrite,

				// transformations...
				transform, 
				// XXX not implemented...
				crop, 

				timestamp,
				logger, 
			} = options
			// defaults...
			pattern = pattern || '%n'
			transform = transform === undefined ? 
				true 
				: transform
			timestamp = timestamp || Date.timeStamp()
			logger = logger !== false ?
				(logger || this.logger)
				: false
			logger = logger && logger.push('Resize', {onclose: abort})

			// backup...
			// XXX make backup name pattern configurable...
			var backupName = function(to){
				var i = 0
				while(fse.existsSync(`${to}.${timestamp}.bak`+ (i || ''))){
					i++ }
				return `${to}.${timestamp}.bak`+ (i || '') }

			return images
				.mapChunks(CHUNK_SIZE, function(gid){
					if(abort.isAborted){
						throw array.StopIteration('aborted') }

					// skip non-images...
					if(!['image', null, undefined]
							.includes(that.images[gid].type)){
						return false }

					// paths...
					var source = that.getImagePath(gid)
					var to = pathlib.join(
						path, 
						(images.length == 1 && name) ?
							name
							: that.formatImageName(pattern, gid, data || {}))

					logger && logger.emit('queued', to)

					var img = sharp(source)
					return (skipSmaller ?
							// skip if smaller than size...
							img
								.metadata()
								.then(function(m){
									// skip...
									if((fit == 'inside'
												&& Math.max(m.width, m.height) < size)
											|| (fit == 'outside'
												&& Math.min(m.width, m.height) < size)){
										logger && logger.emit('skipping', gid)
										return }
									// continue...
									return img })
							: Promise.resolve(img))
						// prepare to write...
						.then(function(img){
							return img 
								&& ensureDir(pathlib.dirname(to))
									.then(function(){
										// handle existing image...
										if(fse.existsSync(to)){
											// rename...
											if(overwrite == 'backup'){
												fse.renameSync(to, backupName(to))
											// remove...
											} else if(overwrite){
												fse.removeSync(to)
											// skip...
											} else {
												logger && logger.emit('skipping', gid)
												return } }

										// write...
										return img
											.clone()
											// handle transform (.orientation / .flip) and .crop...
											.run(function(){
												var img_data = that.images[gid]
												if(transform && (img_data.orientation || img_data.flipped)){
													img_data.orientation
														&& this.rotate(img_data.orientation)
													img_data.flipped
														&& img_data.flipped.includes('horizontal')
														&& this.flip() }
													img_data.flipped
														&& img_data.flipped.includes('vertical')
														&& this.flop() 
												// XXX
												if(crop){
													// XXX
												}
											})
											.resize({
												width: size,
												height: size,
												fit: fit,
												withoutEnlargement: !enlarge,
											})
											.withMetadata()
											.toFile(to) 
											.then(function(){
												logger 
													&& logger.emit('done', to) 
												return img }) }) }) }) })],

	// XXX this does not update image.base_path -- is this correct???
	// XXX add support for offloading the processing to a thread/worker...
	// XXX should we use task.Queue()???
	makePreviews: ['Sharp|File/Make image $previews',
		core.doc`Make image previews

			Make previews for all images...
			.makePreviews()
			.makePreviews('all')
				-> promise

			Make previews for current image...
			.makePreviews('current')
				-> promise

			Make previews for specific image(s)...
			.makePreviews(gid)
			.makePreviews([gid, gid, ..])
				-> promise


			Make previews of images, size and at base_path...
			.makePreviews(images, sizes)
			.makePreviews(images, sizes, base_path)
				-> promise

	
		NOTE: if base_path is given .images will not be updated with new 
			preview paths...
		`,
		core.abortablePromise('makePreviews', function(abort, images, sizes, base_path, logger){
			var that = this

			var CHUNK_SIZE = 4

			abort.cleanup(function(reason, res){
				gid_logger
					&& gid_logger.emit('done')
					&& reason == 'aborted'
						&& gid_logger.emit(res)
				logger 
					&& logger.emit('done')
					&& reason == 'aborted'
						&& logger.emit(res) })

			var logger_mode = this.config['preview-progress-mode'] || 'gids'
			logger = logger !== false ?
				(logger || this.logger)
				: false
			var gid_logger = logger && logger.push('Images', {onclose: abort})
			logger = logger && logger.push('Previews', {onclose: abort})

			// get/normalize images...
			images = images 
				|| 'all'
			// keywords...
			images = images == 'all' ? 
					this.data.getImages('all')
				: images == 'current' ? 
					this.current
				: images
			images = images instanceof Array ? 
				images 
				: [images]
			// get/normalize sizes....
			var cfg_sizes = this.config['preview-sizes'].slice() || []
			cfg_sizes
				.sort()
				.reverse()
			// XXX revise...
			if(sizes){
				sizes = sizes instanceof Array ? sizes : [sizes]
				// normalize to preview size...
				sizes = (this.config['preview-normalized'] ? 
					sizes
						.map(function(s){ 
							return cfg_sizes.filter(function(c){ return c >= s }).pop() || s })
					: sizes)
						.unique()
			} else {
				sizes = cfg_sizes }

			var path_tpl = that.config['preview-path-template']
				.replace(/\$INDEX|\$\{INDEX\}/g, that.config['index-dir'] || '.ImageGrid')

			gid_logger && gid_logger.emit('queued', images)

			return images
				.mapChunks(CHUNK_SIZE, function(gid){
					if(abort.isAborted){
						throw array.StopIteration('aborted') }

					var img = that.images[gid]
					var base = base_path 
						|| img.base_path 
						|| that.location.path

					return sizes
						.map(function(size, i){
							if(abort.isAborted){
								throw array.StopIteration('aborted') }

							var name = path = path_tpl
								.replace(/\$RESOLUTION|\$\{RESOLUTION\}/g, parseInt(size))
								.replace(/\$GID|\$\{GID\}/g, gid) 
								.replace(/\$NAME|\$\{NAME\}/g, img.name)
							return that.makeResizedImage(gid, size, base, { 
									name, 
									skipSmaller: true,
									transform: false,
									logger: logger_mode == 'gids' ? 
										false 
										: logger,
								})
								.then(function([res]){
									i == sizes.length-1
										&& gid_logger && gid_logger.emit('done', gid)

									// did not create a preview...
									if(!res){
										return false }

									// update metadata...
									if(!base_path){
										var preview = img.preview = img.preview || {} 
										preview[parseInt(size) + 'px'] = name
										that.markChanged
											&& that.markChanged('images', [gid]) }

									return [gid, size, name] }) }) })
				.then(function(res){
					return res.flat() }) })],

	// XXX add support for offloading the processing to a thread/worker...
	// XXX should we use task.Queue()???
	__cache_metadata_reading: null,
	cacheMetadata: ['- Sharp|Image/',
		core.doc`Cache metadata

			Cache metadata for current image...
			.cacheMetadata()
			.cacheMetadata('current')
				-> promise([ gid | null ])

			Force cache metadata for current image...
			.cacheMetadata(true)
			.cacheMetadata('current', true)
				-> promise([ gid | null ])

			Cache metadata for all images...
			.cacheMetadata('all')
				-> promise([ gid | null, .. ])

			Force cache metadata for all images...
			.cacheMetadata('all', true)
				-> promise([ gid | null, .. ])

			Cache metadata for specific images...
			.cacheMetadata([ gid, .. ])
				-> promise([ gid | null, .. ])

			Force cache metadata for specific images...
			.cacheMetadata([ gid, .. ], true)
				-> promise([ gid | null, .. ])


		This will:
			- quickly reads/caches essential (.orientation and .flipped) metadata
			- quickly read some non-essential but already there values
			- generate priority previews for very large images (only when in index)


		This will overwrite/update if:
			- .orientation and .flipped iff image .orientation AND .flipped 
				are unset or force is true
			- metadata if image .metadata is not set or 
				.metadata.ImageGridMetadata is not set
			- all metadata if force is set to true


		NOTE: this will effectively update metadata format to the new spec...
		NOTE: for info on full metadata format see: .readMetadata(..)
		`,
		core.abortablePromise('cacheMetadata', function(abort, images, logger){
			var that = this

			var CHUNK_SIZE = 4

			abort.cleanup(function(reason, res){
				logger 
					&& logger.emit('done')
					&& reason == 'aborted'
						&& logger.emit(res)
				delete that.__cache_metadata_reading })

			// handle logging and processing list...
			// NOTE: these will maintain .__cache_metadata_reading helping 
			// 		avoid processing an image more than once at the same 
			// 		time...
			var done = function(gid, msg){
				logger && logger.emit(msg || 'done', gid)
				if(that.__cache_metadata_reading){
					that.__cache_metadata_reading.delete(gid) }
				return gid }
			var skipping = function(gid){
				return done(gid, 'skipping') }

			var force = false
			if(images === true){
				force = true
				images = null

			} else if(logger === true){
				force = true
				logger = arguments[2] }

			// NOTE: we are caching this to avoid messing things up when 
			// 		loading before this was finished...
			var cached_images = this.images

			// get/normalize images...
			//images = images || this.current
			images = images 
				|| 'current'
			// keywords...
			images = 
				images == 'all' ? 
					this.data.getImages('all')
				: images == 'loaded' ?
					(this.ribbons ?
						this.ribbons.getImageGIDs()
						: this.data.getImages('all'))
				: images == 'current' ? 
					this.current
				: images
			images = (images instanceof Array ? 
					images 
					: [images])
				.filter(function(gid){
					return !that.__cache_metadata_reading
						|| !that.__cache_metadata_reading.has(gid) })

			logger = logger !== false ?
				(logger || this.logger)
				: false
			logger = logger 
				&& logger.push('Caching image metadata', {onclose: abort, quiet: true})
			logger && logger.emit('queued', images)

			/*/ XXX set this to tmp for .location.load =='loadImages'
			// XXX add preview cache directory...
			// 		- user defined path
			// 		- cleanable 
			// 			partially (remove orphans) / full...
			// 		- not sure how to index...
			var base_path = that.location.load == 'loadIndex' ?
				null
				: tmp
			/*/
			var base_path
			//*/

			return images
				.mapChunks(CHUNK_SIZE, function(gid){
					// abort...
					if(abort.isAborted){
						throw array.StopIteration('aborted') }

					var img = cached_images[gid]
					var path = img && that.getImagePath(gid)
					;(that.__cache_metadata_reading = 
							that.__cache_metadata_reading || new Set())
						.add(gid)

					// skip...
					if(!(img && path
							&& (force
								// high priority must be preset...
								|| (img.orientation == null
									&& img.flipped == null)
								// update metadata...
								|| (img.metadata || {}).ImageGridMetadata == null))){
						skipping(gid)
						return }

					return sharp(that.getImagePath(gid))
						.metadata()
						.catch(function(){
							skipping(gid) })
						.then(function(metadata){
							// no metadata...
							if(metadata == null){
								skipping(gid)
								return }

							var o = normalizeOrientation(metadata.orientation)
							;(force || img.orientation == null)
								// NOTE: we need to set orientation to something
								// 		or we'll check it again and again...
								&& (img.orientation = o.orientation || 0)
							;(force || img.flipped == null)
								&& (img.flipped = o.flipped)

							// mark metadata as partially read...
							// NOTE: this will intentionally overwrite the 
							// 		previous reader mark/mode...
							img.metadata =
								Object.assign(
									img.metadata || {}, 
									{ 
										ImageGridMetadataReader: 'sharp/exif-reader/ImageGrid',
										// mark metadata as partial read...
										// NOTE: partial metadata will get reread by 
										// 		the metadata feature upon request...
										ImageGridMetadata: 'partial', 
									})

							// read the metadata...
							var exif = metadata.exif 
								&& exifReader(metadata.exif) 
							exif
								&& Object.assign(
									img.metadata, 
									exifReader2exiftool(exif, metadata.xmp))

							// if image too large, generate preview(s)...
							// XXX EXPERIMENTAL...
							var size_threshold = that.config['preview-generate-threshold']
							if(size_threshold
									&& img.preview == null
									&& Math.max(metadata.width, metadata.height) > size_threshold){
								logger && logger.emit('Image too large', gid)
								// XXX make this more generic...
								// 		...if 'loadImages' should create previews in tmp...
								that.location.load == 'loadIndex'
									&& that.makePreviews(gid, 
										that.config['preview-sizes-priority'] || 1080,
										base_path,
										logger) }

							that.markChanged
								&& that.markChanged('images', [gid])
							that.ribbons
								&& that.ribbons.updateImage(gid) 

							return done(gid) }) }) })],
	cacheAllMetadata: ['- Sharp|Image/',
		core.doc`Cache all metadata
		NOTE: this is a shorthand to .cacheMetadata('all', ..)`,
		'cacheMetadata: "all" ...'],


	// shorthands...
	// XXX do we need these???
	abortMakeResizedImage: ['- Sharp/',
		'abort: "makeResizedImage"'],
	abortMakePreviews: ['- Sharp/',
		'abort: "makePreviews"'],
	abortCacheMetadata: ['- Sharp/',
		'abort: "cacheMetadata"'],
})


var Sharp = 
module.Sharp = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'sharp',
	depends: [
		'location',
		'index-format',
	],

	actions: SharpActions, 

	isApplicable: function(){ return !!sharp },

	handlers: [
		// XXX
		['load.pre',
			function(){
				this.abort([
					'makeResizedImage',
					'makePreviews',
					'cacheMetadata',
				]) }],

		//* XXX this needs to be run in the background...
		// XXX this is best done in a thread + needs to be abortable (on .load(..))...
		[['loadImages', 
				'loadNewImages'],
			function(){
				this.cacheMetadata('all') }],
		//*/

		// set orientation if not defined...
		// NOTE: progress on this is not shown so as to avoid spamming 
		// 		the UI...
		// XXX should this be pre or post???
		// 		...creating a preview would be more logical than trying 
		// 		to load a gigantic image, maybe even loading a placeholder
		// 		while doing so...
		//['updateImage.pre',
		//	function(gid){
		['updateImage',
			function(_, gid){
				var that = this
				// NOTE: as this directly affects the visible lag, this 
				// 		must be as fast as possible...
				;((this.images[gid] || {}).metadata || {}).ImageGridMetadata
					|| this.cacheMetadata(gid, false) 
						.then(function([res]){
							res 
								&& that.logger 
									&& that.logger.emit('Cached metadata for', gid) }) }],

		// XXX need to:
		// 		- if image too large to set the preview to "loading..."
		// 		- create previews...
		// 		- update image...
		/*
		['updateImage.pre',
			function(gid){
				var that = this
				if(this.images[gid].preview == null){
					sharp(this.getImagePath(gid))
						.metadata()
						.then(function(metadata){
							// current image is larger than any of the previews...
							if(Math.max(metadata.width, metadata.height) 
									> Math.max.apply(Math, that.config['preview-sizes'])){
								// create the currently needed preview first...
								that.makePreviews(gid, that.ribbons.getVisibleImageSize())
									.then(function(){
										// load the created preview...
										that.ribbons.updateImage(gid)

										// create the rest...
										that.makePreviews(gid)
									})
							}
						})
				}
			}]
		//*/
	],
})



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
