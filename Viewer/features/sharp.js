/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

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

var exifReader2exiftool = 
module.exifReader2exiftool =
function(data){
	return Object.entries(EXIF_FORMAT)
		// handle exif/image/...
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
					return res && res[e] }, data)
			// set the value...
			if(value !== undefined){
				res[to] = handler ?
					handler(value)
					: value }
			return res }, {})
		// handle xmp...
		.run(function(){
			var rating = data.xmp 
				// NOTE: we do not need the full XML 
				// 		fluff here, just get some values...
				&& parseInt(
					(data.xmp.toString()
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
		function(images, size, path, options={}){
			var that = this

			// sanity check...
			if(arguments.length < 3){
				throw new Error('.makeResizedImage(..): '
					+'need at least images, size and path.') }
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
			logger = logger && logger.push('Resize')

			// backup...
			// XXX make backup name pattern configurable...
			var backupName = function(to){
				var i = 0
				while(fse.existsSync(`${to}.${timestamp}.bak`+ (i || ''))){
					i++ }
				return `${to}.${timestamp}.bak`+ (i || '') }

			return Promise.all(images
				.map(function(gid){
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
										logger && logger.emit('skipping', to)
										return false }
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
												logger && logger.emit('skipping', to)
												return false } }

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
												return img }) }) }) })) }],

	// XXX test against .makePreviews(..) for speed...
	// XXX this does not update image.base_path -- is this correct???
	// XXX do we need to be able to run this in a worker???
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
		function(images, sizes, base_path, logger){
			var that = this

			var logger_mode = this.config['preview-progress-mode'] || 'gids'
			logger = logger !== false ?
				(logger || this.logger)
				: false
			var gid_logger = logger && logger.push('Images')
			logger = logger && logger.push('Previews')


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

			return Promise.all(images
				.map(function(gid){
					var img = that.images[gid]
					var base = base_path 
						|| img.base_path 
						|| that.location.path

					gid_logger && gid_logger.emit('queued', gid)

					return sizes
						.map(function(size, i){
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
										that.markChanged('images', [gid]) }

									return [gid, size, name] }) }) })
				.flat()) }],


	// XXX add support for offloading the processing to a thread/worker...
	// XXX would be nice to be able to abort this...
	// 		...and/or have a generic abort protocol triggered when loading...
	// 		...use task queue???
	// XXX make each section optional...
	// XXX revise name...
	cacheImageMetadata: ['- Sharp|Image/',
		core.doc`
		`,
		function(images, logger){
			var that = this

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
			images = images instanceof Array ? 
				images 
				: [images]

			logger = logger !== false ?
				(logger || this.logger)
				: false
			logger = logger && logger.push('Caching image metadata')
			logger && logger.emit('queued', images)

			// NOTE: we are caching this to avoid messing things up when 
			// 		loading before this was finished...
			var cached_images = this.images

			var loaded = this.ribbons
				&& new Set(this.ribbons.getImageGIDs())

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
				.mapChunks(function(gid){
					return sharp(that.getImagePath(gid))
						.metadata()
						.catch(function(){
							logger && logger.emit('skipping', gid) })
						.then(function(metadata){
							// XXX what should we return in case of an error???
							if(metadata == null){
								return }

							var img = cached_images[gid]

							var o = normalizeOrientation(metadata.orientation)
							// NOTE: we need to set orientation to something
							// 		or we'll check it again and again...
							img.orientation = o.orientation || 0
							img.flipped = o.flipped

							// read the metadata...
							var exif = metadata.exif 
								&& exifReader(metadata.exif) 
							exif
								&& Object.assign(
									(img.metadata = img.metadata || {}), 
									exifReader2exiftool(exif),
									// mark metadata as partial read...
									//
									// NOTE: partial metadata will get reread by 
									// 		the metadata feature upon request...
									// XXX revise name...
									{ ImageGridPartialMetadata: true })

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

							that.markChanged('images', [gid])

							logger && logger.emit('done', gid)

							// update loaded image to use the orientation...
							loaded
								&& loaded.has(gid)
								&& that.ribbons.updateImage(gid) 

							return gid }) }) }],
})


// XXX need to auto-generate previews for very large images...
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
		/* XXX not sure if we need this...
		// XXX this is best done in a thread + needs to be abortable...
		['loadImages',
			function(){
				//this.cacheImageMetadata('all', false) }],
				this.cacheImageMetadata('all') }],
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
				var img = this.images[gid]
				img
					&& img.orientation == null
					&& this.cacheImageMetadata(gid, false) 
					&& this.logger 
						&& this.logger.emit('Caching metadata for', gid) }],

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
