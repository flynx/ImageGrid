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

// XXX add exif writer...
var EXIFActions = actions.Actions({
	// XXX cache the result and see if it is cached before running exiftool... 
	// XXX also check the metadata/ folder (???)
	// XXX this uses .markChanged(..) form filesystem.FileSystemWriter 
	// 		feature, but technically does not depend on it...
	// XXX should we store metadata in an image (current) or in fs???
	getExif: ['- Image/Get exif data',
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
	setExif: ['- Image/Set exif data',
		function(image, target){
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
// Exif editor/viewer...

// XXX


/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
