/**********************************************************************
* 
*
*
**********************************************************************/

// XXX this is a hack...
// 		...need a way to escape these so as not to load them in browser...
if(typeof(process) != 'undefined'){
	var fs = require('fs')
	var path = require('path')
	var exiftool = require('exiftool')
	var promise = require('promise')
}


define(function(require){ var module = {}

//var DEBUG = DEBUG != null ? DEBUG : true

var actions = require('lib/actions')
var core = require('features/core')



/*********************************************************************/
// XXX rename: EXIF -> Metadata
// XXX make metadata a prop of image...

var EXIFActions = actions.Actions({
	getExif: ['- Image/Get exif data',
		function(image){
			var gid = this.data.getImage(image)

			if(this.images && this.images[gid]){
				return this.images[gid].metadata || {}
			}
			return null
		}],
	setExif: ['- Image/Set exif data',
		function(image, metadata, merge){
			var that = this
			var gid = this.data.getImage(image)

			if(this.images && this.images[gid]){
				if(merge){
					var m = this.images[gid].metadata
					Object.keys(metadata).forEach(function(k){
						m[k] = metadata[k]
					})

				} else {
					this.images[gid].metadata = metadata
				}
			}
		}]
})

var EXIF = 
module.EXIF = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'exif',
	depends: [
		'base',
	],

	isApplicable: function(){ 
		return this.runtime == 'nw' || this.runtime == 'node' },

	actions: EXIFActions,
})


//---------------------------------------------------------------------
// Exif reader/writer...


// XXX add exif writer...
var EXIFReaderActions = actions.Actions({
	// XXX should this be sync???
	// XXX should this process multiple images???
	// XXX also check the metadata/ folder (???)
	// XXX this uses .markChanged(..) form filesystem.FileSystemWriter 
	// 		feature, but technically does not depend on it...
	// XXX should we store metadata in an image (current) or in fs???
	readExif: ['- Image/Get exif data',
		function(image, force){
			var that = this

			var gid = this.data.getImage(image)
			var img = this.images[gid]
			var full_path = path.normalize(img.base_path +'/'+ img.path)

			return new promise(function(resolve, reject){
				if(!force && img.metadata){
					return resolve(img.metadata)
				}

				fs.readFile(full_path, function(err, file){
					if(err){
						return reject(err)
					}

					exiftool.metadata(file, function(err, data){
						if(err){
							reject(err)

						} else if(data.error){
							reject(data)

						} else {
							// store metadata...
							// XXX 
							that.images[gid].metadata = data
							that.markChanged && that.markChanged(gid)

							resolve(data)
						}
					})
				})
			})
		}],

	// XXX take image exif and write it to target...
	writeExif: ['- Image/Set exif data',
		function(image, target){
			// XXX
		}]
})

var EXIFReader = 
module.EXIF = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'exif-reader',
	depends: [
		'base',
	],

	isApplicable: function(){ 
		return this.runtime == 'nw' || this.runtime == 'node' },

	actions: EXIFReaderActions,
})



//---------------------------------------------------------------------
// Exif editor/viewer...
//
// XXX first instinct is to use browse with editable fields as it will
// 		give us: 
// 			- searchability
// 			- navigation
// 			- ...
// 		missing functionality:
// 			- editor/form on open event
// 				- inline (preferred)
// 				- modal-form
// 			- table-like layout
// 				- template???
// 				- script layout tweaking (post-update)
//
// 		...need to think about this...

// XXX this should basically be platform independent...
var EXIFUIActions = actions.Actions({
	showExif: ['Image/Show exif',
		function(image, force){
			image = this.data.getImage(image)
			var exif = !force 
				&& this.images[image].metadata 
				|| this.getExif(image, force)

			// XXX make a list with two .text elements per list item:
			// 			.text.field		- exif field name
			// 			.text.value		- exif field value 
			// 		Add CSS:
			// 			.exif-browser .list>div .text {
			// 				display: inline-block;
			// 				width: 50%;
			// 			}
			// 			.exif-browser .list>div .text:first-child {
			// 				text-align: right; 
			// 			}
			// 			.exif-browser .list>div .text:first-child:after {
			// 				content: ": ";
			// 			}
			// 			.exif-browser .list>div .text:last-child {
			// 			}
		}]
})

// XXX
var EXIFUI = 
module.EXIFUI = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-exif',
	depends: [
		'ui',
		'exif',
	],

	actions: EXIFUIActions,
})



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
