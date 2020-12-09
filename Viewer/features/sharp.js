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
	'exif.FNumber': [
		'fNumber', 
		function(v){ 
			return 'f/'+v }],
	'exif.ExposureTime': [
		'exposureTime',
		// NOTE: this is a bit of a brute-fore approach but for shutter 
		// 		speeds this should not matter...
		function(v){
			if(v > 0.5){
				return ''+ v }
			for(var d = 1; (v * d) % 1 != 0; d++){}
			return (v * d) +'/'+ d }],

	// dates...
	'exif.DateTimeOriginal': [
		'date/timeOriginal',
		function(v){
			return v.toShortDate() }],
	'image.ModifyDate': [
		'modifyDate', 
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

	// XXX either make this a session task or make this survive loading 
	// 		a new index...
	// XXX revise return values...
	// XXX make backup name pattern configurable...
	// XXX CROP ready for crop support...
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
				// output image name / name pattern...
				//
				// NOTE: for multiple images this should be a pattern and not an
				// 		explicit name...
				// NOTE: if not given this defaults to: "%n"
				name: null | <str>,

				// image name pattern data...
				//
				// NOTE: for more info on pattern see: .formatImageName(..)
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
		core.sessionQueueHandler('Make resized image', 
			// get/normalize images...
			// XXX if this is to be a global task (i.e. .queueHandler(..)) we'll 
			// 		need to get all the image data here...
			// 		...paths and orientation data...
			function(queue, images, size, path, options){
				// sanity check...
				if(arguments.length < 4){
					throw new Error('.makeResizedImage(..): '
						+'need at least: images, size and path.') }
				return [
					(images == null || images == 'all') ? 
							this.data.getImages('all')
						: images == 'current' ? 
							[this.current]
						: images instanceof Array ? 
							images 
						: [images],
					...[...arguments].slice(2),
				]},
			function(gid, size, path, options={}){
				var that = this

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
					data, 

					// file handling...
					enlarge,
					skipSmaller,
					overwrite,

					// transformations...
					transform, 
					// XXX CROP not implemented...
					//crop, 

					timestamp,
					//logger, 
				} = options
				// defaults...
				name = name || '%n'
				transform = transform === undefined ? 
					true 
					: transform
				timestamp = timestamp || Date.timeStamp()

				// backup...
				// XXX make backup name pattern configurable...
				var backupName = function(to){
					var i = 0
					while(fse.existsSync(`${to}.${timestamp}.bak`+ (i || ''))){
						i++ }
					return `${to}.${timestamp}.bak`+ (i || '') }

				// skip non-images...
				if(!['image', null, undefined]
						.includes(this.images[gid].type)){
					// XXX what should we return???
					return Promise.resolve() }

				// paths...
				var source = this.getImagePath(gid)
				var to = pathlib.resolve(
					this.location.path,
					pathlib.join(
						path, 
						// if name is not a pattern do not re-format it...
						name.includes('%') ?
							this.formatImageName(name, gid, data || {})
							: name))

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
											return Promise.reject('target exists') } }

									// write...
									return img
										.clone()
										// handle transform (.orientation / .flip) and .crop...
										.run(function(){
											var img = that.images[gid]
											if(transform && (img.orientation || img.flipped)){
												img.orientation
													&& this.rotate(img.orientation)
												img.flipped
													&& img.flipped.includes('horizontal')
													&& this.flip() }
												img.flipped
													&& img.flipped.includes('vertical')
													&& this.flop() 
											// XXX CROP
											//if(crop){
											//	// XXX
											//}
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
											// XXX what should we return???
											return to }) }) }) })],

	// XXX this does not update image.base_path -- is this correct???
	// XXX add support for offloading the processing to a thread/worker...
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
		NOTE: currently this is a core.sessionQueueHandler(..) and not a .queueHandler(..)
			mainly because we need to add the preview refs back to the index and this
			would need keeping the index in memory even if we loaded a different index,
			this is possible but needs more thought.
		`,
		core.sessionQueueHandler('Make image previews', 
			function(queue, images, ...args){
				// get/normalize images...
				return [
					(images == null || images == 'all') ? 
							this.data.getImages('all')
						: images == 'current' ? 
							[this.current]
						: images instanceof Array ? 
							images 
						: [images],
					...args,
				] },
			function(gid, sizes, base_path, logger){
				var that = this

				var logger_mode = this.config['preview-progress-mode'] || 'gids'

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
					.replace(/\$INDEX|\$\{INDEX\}/g, this.config['index-dir'] || '.ImageGrid')

				var img = this.images[gid]
				var base = base_path 
					|| img.base_path 
					|| this.location.path

				return Promise.all(
					sizes
						.map(function(size, i){
							var name = path = path_tpl
								.replace(/\$RESOLUTION|\$\{RESOLUTION\}/g, parseInt(size))
								.replace(/\$GID|\$\{GID\}/g, gid) 
								.replace(/\$NAME|\$\{NAME\}/g, img.name)
							// NOTE: we are 'sync' here for several reasons, mainly because
							// 		this is a small list and in this way we can take 
							// 		advantage of OS file caching, and removing the queue
							// 		overhead, though small makes this noticeably faster...
							return that.makeResizedImage('sync', gid, size, base, { 
									name, 
									skipSmaller: true,
									transform: false,
									logger: logger_mode == 'gids' ? 
										false 
										: logger,
								})
								// XXX handle errors -- rejected because image exists...
								.then(
									function(res){
										// update metadata...
										if(!base_path){
											var preview = img.preview = img.preview || {} 
											preview[parseInt(size) + 'px'] = name
											that.markChanged
												&& that.markChanged('images', [gid]) }
										return [gid, size, name] },
									function(err){
										// XXX error
										logger && logger.emit('skipped', gid)
									}) })) })],

	// XXX add support for offloading the processing to a thread/worker...
	// XXX revise logging and logger passing...
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
		core.sessionQueueHandler('Cache image metadata', 
			// XXX timeouts still need tweaking...
			{quiet: true, pool_size: 2, busy_timeout: 400}, 
			//{quiet: true, pool_size: 2, busy_timeout_scale: 10}, 
			// parse args...
			function(queue, image, ...args){
				var force = false
				if(image === true){
					var [force, image, ...args] = arguments }
				return [
					...(force ? [true] : []),
					// expand images..
					image == 'all' ?
							this.images.keys()
						: image == 'loaded' ?
							this.data.getImages('loaded')
						: (image || 'current'),
					...args,
				] },
			function(image, logger){
				var that = this
				if(image === true){
					var [force, image, logger] = arguments }

				// XXX cache the image data???
				var gid = this.data.getImage(image)
				var img = this.images[gid]
				var path = img && that.getImagePath(gid)

				// XXX
				//var base_path = that.location.load == 'loadIndex' ?
				//	null
				//	: tmp
				//var base_path = img && img.base_path
				var base_path
		
				// skip...
				if(!(img && path
						&& (force
							// high priority must be preset...
							|| (img.orientation == null
								&& img.flipped == null)
							// update metadata...
							|| (img.metadata || {}).ImageGridMetadata == null))){
					return }

				// XXX handle/report errors...
				return sharp(that.getImagePath(gid))
					.metadata()
					.then(function(metadata){
						// no metadata...
						if(metadata == null){
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

						return gid }) })],
	cacheAllMetadata: ['- Sharp/Image/',
		'cacheMetadata: "all" ...'],

	// shorthands...
	/*/ XXX do we need these???
	// 		...better have a task manager UI...
	// XXX if these are kept, would be fun to show them only if the respective
	// 		tasks are running...
	abortMakeResizedImage: ['- Sharp/',
		'tasks.stop: "makeResizedImage"'],
	abortMakePreviews: ['- Sharp/',
		'tasks.stop: "makePreviews"'],
	abortCacheMetadata: ['- Sharp/',
		'tasks.stop: "cacheMetadata"'],
	//*/
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
		//* XXX this needs to be run in the background...
		// XXX this is best done in a thread 
		[['loadImages', 
				'loadNewImages'],
			'cacheMetadata: "all"'],
		//*/

		// set orientation if not defined...
		// NOTE: progress on this is not shown so as to avoid spamming 
		// 		the UI...
		['updateImage',
			function(_, gid){
				var that = this
				// NOTE: as this directly affects the visible lag, this 
				// 		must be as fast as possible...
				// NOTE: running .cacheMetadata(..) in sync mode here forces
				// 		the image to update before it gets a change to get
				// 		drawn...
				;((this.images[gid] || {}).metadata || {}).ImageGridMetadata
					|| this.cacheMetadata('sync', gid, false) }],

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
