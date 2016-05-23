/**********************************************************************
* 
*
*
**********************************************************************/

define(function(require){ var module = {}

//var DEBUG = DEBUG != null ? DEBUG : true

var actions = require('lib/actions')
var features = require('lib/features')

var core = require('features/core')

try{
	var sharp = requirejs('sharp')

} catch(err){
	sharp = null
}

if(typeof(process) != 'undefined'){
	var cp = requirejs('child_process')
	var fse = requirejs('fs-extra')
	var pathlib = requirejs('path')
	var glob = requirejs('glob')
	var file = requirejs('./file')
}



/*********************************************************************/

if(typeof(process) != 'undefined'){
	var ensureDir = file.denodeify(fse.ensureDir)
}


/*********************************************************************/

var SharpActions = actions.Actions({
	config: {
		'preview-path': '$INDEX/$RESOLUTIONpx',

		'preview-normalized': true,

		// XXX this repeats filesystem.FileSystemWriterActions.config['export-preview-sizes']
		'preview-sizes': [
			1920,
			1280,
			900,
			350,
			150,
			75,
		]
	},

	// XXX BUG (nw.js): this does not work until child_process.fork(..) is fixed...
	startPreviewWorker: ['- Sharp/',
		function(){
			if(this.previewConstructorWorker){
				return
			}
			this.previewConstructorWorker = cp.fork('./workers/preview-constructor.js')
		}],
	stopPreviewWorker: ['- Sharp/',
		function(){
			this.previewConstructorWorker && this.previewConstructorWorker.kill()
			delete this.previewConstructorWorker
		}],


	//	.makePreviews()
	//	.makePreviews('current')
	//		-> actions
	//
	//	.makePreviews(gid)
	//		-> actions
	//
	//	.makePreviews([gid, gid, ..])
	//		-> actions
	//
	//	.makePreviews('all')
	//		-> actions
	//
	// XXX should this account for non-jpeg images???
	// XXX do this in the background...
	makePreviews: ['Sharp/Make image previews',
		function(images, sizes, logger){
			logger = logger || this.logger

			images = images || this.current
			// keywords...
			images = images == 'all' ? this.data.getImages('all')
				: images == 'current' ? this.current
				: images
			images = images instanceof Array ? images : [images]

			var cfg_sizes = this.config['preview-sizes'] || []
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
				sizes = cfg_sizes
			}

			var that = this
			return Promise.all(images.map(function(gid){
				var data = that.images[gid]
				var path = that.getImagePath(gid)

				var preview = data.preview = data.preview || {}

				var img = sharp(path)
				return img.metadata().then(function(metadata){
					var orig_res = Math.max(metadata.width, metadata.height)

					return Promise.all(sizes.map(function(res){
						// skip if image is smaller than res...
						if(res >= orig_res){
							return 
						}

						var ext = data.ext || ''

						// build the target path...
						var target = (that.config['preview-path'] || '$INDEX')
							.replace(/\$INDEX|\$\{INDEX\}/g, that.config['index-dir'])
							.replace(/\$RESOLUTION|\$\{RESOLUTION\}/g, res)
						// XXX do we need to account for non-jpeg extensions???
						var target = pathlib.join(target, gid +' - '+ data.name + ext)

						var base = data.base_path || that.location.path
						var path = pathlib.join(base, target)

						logger && logger.emit('queued', target)

						return ensureDir(pathlib.dirname(path))
							.then(function(){
								// check if image exists...
								if(fse.existsSync(path)){
									preview[res + 'px'] = target
									that.markChanged(gid)

									logger && logger.emit('skipped', target)

									return
								}
							
								return img.clone()
									.resize(res, res)
									.max()
									.interpolateWith('nohalo')
									.withMetadata()
									.toFile(path)
										.then(function(){
											preview[res + 'px'] = target
											that.markChanged(gid)

											logger && logger.emit('done', target)
										})
							})
					}))
				})
			}))
		}],
})

var Sharp = 
module.Sharp = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'sharp',
	depends: [
		'location',
	],

	actions: SharpActions, 

	isApplicable: function(){ return !!sharp },

	handlers: [
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
* vim:set ts=4 sw=4 :                                                */
return module })
