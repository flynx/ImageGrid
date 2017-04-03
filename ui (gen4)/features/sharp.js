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

			this.previewConstructorWorker.__post_handlers = {}
		}],
	stopPreviewWorker: ['- Sharp/',
		function(){
			this.previewConstructorWorker && this.previewConstructorWorker.kill()
			delete this.previewConstructorWorker
		}],


	//	.makePreviews()
	//	.makePreviews('all')
	//		-> actions
	//
	//	.makePreviews('current')
	//		-> actions
	//
	//	.makePreviews(gid)
	//		-> actions
	//
	//	.makePreviews([gid, gid, ..])
	//		-> actions
	//
	// XXX should this account for non-jpeg images???
	makePreviews: ['Sharp|File/Make image previews',
		function(images, sizes, base_path, logger){
			var that = this
			logger = logger || this.logger
			logger = logger && logger.push('Previews')


			// get/normalize images...
			//images = images || this.current
			images = images || 'all'
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

			var post_handler = function(err, data){
				if(data.status == 'done' || data.status == 'skipped'){
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

				logger && logger.emit(data.status, data.path)
			}

			// now do the work (async)...
			if(this.previewConstructorWorker){
				return Promise.all(Object.keys(data).map(function(base_path){
					return new Promise(function(resolve, reject){
						var ticket = Date.now()
						while(ticket in that.previewConstructorWorker.__post_handlers){
							ticket = Date.now()
						}

						that.previewConstructorWorker.send({
							ticket: ticket,

							images: data[base_path], 
							sizes: sizes, 
							base_path: base_path, 
							target_tpl: path_tpl, 
						})
						that.previewConstructorWorker.__post_handlers[ticket] = function(err, data){
							// XXX
							if(err){
								reject(err)
							}
							if(data == 'completed'){
								resolve()

							} else {
								post_handler(err, data)
							}
						} 
					})
				}))

			// now do the work (sync)...
			} else {
				return Promise.all(Object.keys(data).map(function(base_path){
					return preview.makePreviews(
						data[base_path], sizes, base_path, path_tpl, post_handler)
				}))
			}
		}],
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
