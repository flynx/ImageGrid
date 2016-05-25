/**********************************************************************
* 
*
*
**********************************************************************/

define(function(require){ var module = {}

//var DEBUG = DEBUG != null ? DEBUG : true

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
	var file = requirejs('./file')
}



/*********************************************************************/

if(typeof(process) != 'undefined'){
	var ensureDir = file.denodeify(fse.ensureDir)
}


/*********************************************************************/

var SharpActions = actions.Actions({
	config: {
		'preview-path-template': '${INDEX}/${RESOLUTION}px/${GID} - ${NAME}.jpg',

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
		function(images, sizes, base_path, logger){
			var that = this
			logger = logger || this.logger


			// get/normalize images...
			images = images || this.current
			// keywords...
			images = images == 'all' ? this.data.getImages('all')
				: images == 'current' ? this.current
				: images
			images = images instanceof Array ? images : [images]

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
				})
			})


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
				sizes = cfg_sizes
			}

			var path_tpl = that.config['preview-path-template']
				.replace(/\$INDEX|\$\{INDEX\}/g, that.config['index-dir'] || '.ImageGrid')


			// now do the work...
			return Promise.all(Object.keys(data).map(function(base_path){
				return preview.makePreviews(
					data[base_path], 
					sizes, 
					base_path, 
					path_tpl, 
					function(err, data){
						if(data.status == 'done' || data.status == 'skipped'){
							// get/make preview list...
							var preview = that.images[data.gid].preview =
								that.images[data.gid].preview || {}

							preview[data.res + 'px'] = data.path

							that.markChanged(data.gid)
						}	

						logger && logger.emit(data.status, data.path)
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
