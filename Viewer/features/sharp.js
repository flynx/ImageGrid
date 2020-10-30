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
var preview = require('lib/preview')

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

	var file = require('imagegrid/file')
}



/*********************************************************************/

if(typeof(process) != 'undefined'){
	var copy = file.denodeify(fse.copy)
	var ensureDir = file.denodeify(fse.ensureDir)
}

function normalizeOrientation(orientation){
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
	}
}



/*********************************************************************/

var SharpActions = actions.Actions({
	config: {
		'preview-normalized': true,

		// can be:
		// 	'gids'
		// 	'files'
		'preview-progress-mode': 'gids',

		// NOTE: this uses 'preview-sizes' and 'preview-path-template' 
		// 		from filesystem.IndexFormat...
	},

	// NOTE: post handlers are pushed in .makePreviews(..)
	// XXX might be a good idea to make this a bit more generic...
	// XXX might be a good idea to use tasks to throttle....
	startPreviewWorker: ['- Sharp/',
		function(){
			var that = this
			if(this.previewConstructorWorker){
				return
			}
			this.previewConstructorWorker = cp.fork(
				'./workers/preview-constructor.js', {
					cwd: process.cwd(),
				})
				.on('message', function(res){
					if(res.err){
						// XXX
						console.error(res)
					
					} else {
						var ticket = res.ticket
						// clear listener...
						if(res.status == 'completed'){
							that.previewConstructorWorker.__post_handlers[res.ticket](null, 'completed')
							delete that.previewConstructorWorker.__post_handlers[res.ticket]
						
						} else {
							that.previewConstructorWorker.__post_handlers[res.ticket](res.err, res.data)
						}
					}
				})

			this.previewConstructorWorker.__post_handlers = {} }],
	stopPreviewWorker: ['- Sharp/',
		function(){
			this.previewConstructorWorker && this.previewConstructorWorker.kill()
			delete this.previewConstructorWorker }],

	// XXX Q: if skipSmaller and overwrite: 'backup' and image smaller (skiped) do we backup???
	// 		...I think no...
	// XXX make backup name pattern configurable...
	// XXX add transform/crop support...
	// XXX revise logging...
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

				logger: ...
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
				// XXX not implemented...
				transform, 
				// XXX not implemented...
				crop, 

				logger, 
			} = options
			// defaults...
			pattern = pattern || '%n'
			/* XXX
			transform = transform === undefined ? 
				true 
				: transform
			//*/
			logger = logger || this.logger
			logger = logger && logger.push('Resize')

			// backup...
			// XXX make backup name pattern configurable...
			var timestamp = Date.timeStamp()
			var backupName = function(to){
				var i = 0
				while(fse.existsSync(`${to}.${timestamp}.bak`+ (i || ''))){
					i++ }
				return `${to}.${timestamp}.bak`+ (i || '') }

			return Promise.all(images
				.map(function(gid){
					// skip non-images...
					if(that.images[gid].type != undefined){
						return }

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
												logger && logger.emit('skipping', to)
												return } }

										// write...
										return img
											.clone()
											// handle transform (.orientation / .flip) and .crop...
											.run(function(){
												// XXX
												if(transform || crop){
													throw new Error('.makeResizedImage(..): '
														+[
															transform ? 'transform' : [],
															crop ? 'crop' : [],
														].flat().join(' and ')
														+' not implemented...') } 
												// XXX need clear spec defining what 
												// 		order transforms are applied 
												// 		and in which coordinates we 
												// 		crop (i.e. pre/post transform)...
												if(transform){
													// XXX
												}
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
													&& logger.emit('done', to) }) }) }) })) }],
										
	// XXX use .makeResizedImage(..)
	// XXX should this account for non-jpeg images???
	// XXX BUG?: this breaks on PNG images...
	// XXX log: count gids and not specific images...
	makePreviews: ['Sharp|File/Make image $previews',
		core.doc`Make image previews

			Make previews for all images...
			.makePreviews()
			.makePreviews('all')
				-> actions

			Make previews for current image...
			.makePreviews('current')
				-> actions

			Make previews for specific image(s)...
			.makePreviews(gid)
			.makePreviews([gid, gid, ..])
				-> actions
	
		`,
		function(images, sizes, base_path, logger){
			var that = this
			var logger_mode = this.config['preview-progress-mode'] || 'gids'
			logger = logger || this.logger
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

			//
			// Format:
			// 	{
			// 		<base_path>: [
			// 			{
			// 				source: <image-path>,
			// 				gid: <gid>,
			// 			},
			// 			...
			// 		],
			// 		...
			// 	}
			//
			// NOTE: if base_path is not provided this will base the 
			// 		previews in .base_path for each image, usually this
			// 		is where the index resides but might not be the 
			// 		case for compound indexes...
			var data = {}
			images.forEach(function(gid){
				var img = that.images[gid]
				var base = base_path || img.base_path || that.location.path

				var d = data[base] = data[base] || []
				d.push({
					source: that.getImagePath(gid),
					gid: gid,
				}) })


			// get/normalize sizes....
			var cfg_sizes = this.config['preview-sizes'].slice() || []
			cfg_sizes
				.sort()
				.reverse()

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


			var post_handler = function(err, data){
				if(data.res != 'all' 
						&& (data.status == 'done' 
							|| data.status == 'skipped')){
					// get/make preview list...
					var img = that.images[data.gid]
					var preview = img.preview =
						img.preview || {}

					// save previews...
					preview[data.res + 'px'] = data.path

					var o = normalizeOrientation(data.orientation)

					// save orientation...
					img.orientation = o.orientation
					img.flipped = o.flipped

					that.markChanged('images', [data.gid])
				}	

				// NOTE: this will handle both 'queue' and 'resolved' statuses...
				logger && 
					( logger_mode == 'gids' ?
						// report gid-level progress...
						(data.res == 'all' 
							&& logger.emit(data.status, data.gid))
						// report preview-level progress...
						: (data.res != 'all' 
							&& logger.emit(data.status, data.path)) ) }


			// now do the work (async)...
			if(this.previewConstructorWorker){
				return Promise.all(
					Object.keys(data)
						.map(function(base_path){
							return new Promise(function(resolve, reject){
								do {
									var ticket = Date.now()
								} while(ticket in that.previewConstructorWorker.__post_handlers)

								that.previewConstructorWorker.send({
									ticket: ticket,
									images: data[base_path], 
									sizes: sizes, 
									base_path: base_path, 
									target_tpl: path_tpl, 
								})
								that.previewConstructorWorker.__post_handlers[ticket] = 
									function(err, data){
										if(err){
											return reject(err)
										}
										data == 'completed' ?
											resolve()
											: post_handler(err, data) }
							}) }))

			// now do the work (sync)...
			} else {
				return Promise.all(
					Object.keys(data)
						// NOTE: this will handle images batched by .base_path...
						.map(function(base_path){
							return preview.makePreviews(
								data[base_path], 
								sizes, 
								base_path, 
								path_tpl, 
								post_handler) }))} }],
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
		// set orientation if not defined...
		['updateImage',
			function(_, gid){
				var that = this
				var img = this.images[gid]

				if(img && img.orientation == null){
					img.orientation = 0

					sharp(this.getImagePath(gid))
						.metadata()
						.then(function(data){
							var o = normalizeOrientation(data.orientation)

							// NOTE: we need to set orientation to something
							// 		or we'll check it again and again...
							img.orientation = o.orientation || 0
							img.flipped = o.flipped

							that.markChanged('images', [gid])

							// update image to use the orientation...
							// XXX this might be a source for recursion 
							// 		as it triggers .updateImage(..) again...
							that.ribbons && that.ribbons.updateImage(gid)
						})
				}
			}],

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
