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

var browse = require('lib/widget/browse')
var overlay = require('lib/widget/overlay')



/*********************************************************************/
// XXX make metadata a prop of image... (???)
// XXX Q: should we standardise metadata field names and adapt them to 
// 		lib???

var MetadataActions = actions.Actions({
	getMetadata: ['- Image/Get metadata data',
		function(image){
			var gid = this.data.getImage(image)

			if(this.images && this.images[gid]){
				return this.images[gid].metadata || {}
			}
			return null
		}],
	setMetadata: ['- Image/Set metadata data',
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

var Metadata = 
module.Metadata = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'metadata',
	depends: [
		'base',
	],

	actions: MetadataActions,
})


//---------------------------------------------------------------------
// Metadata reader/writer...


// XXX add Metadata writer...
// XXX need a way to trigger read-metadata...
var MetadataReaderActions = actions.Actions({
	// XXX should this be sync???
	// XXX should this process multiple images???
	// XXX also check the metadata/ folder (???)
	// XXX this uses .markChanged(..) form filesystem.FileSystemWriter 
	// 		feature, but technically does not depend on it...
	// XXX should we store metadata in an image (current) or in fs???
	readMetadata: ['- Image/Get metadata data',
		function(image, force){
			var that = this

			var gid = this.data.getImage(image)
			var img = this.images && this.images[gid]

			if(!image){
				return
			}

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

						resolve(data)
					})
				})
			})
		}],

	// XXX take image Metadata and write it to target...
	writeMetadata: ['- Image/Set metadata data',
		function(image, target){
			// XXX
		}]
})

var MetadataReader = 
module.MetadataReader = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'fs-metadata',
	depends: [
		'metadata',
	],

	isApplicable: function(){ 
		return this.runtime == 'nw' || this.runtime == 'node' },

	actions: MetadataReaderActions,

	handlers: [
		// XXX STUB: need a better strategy to read metadata...
		['focusImage', 
			function(){
				var gid = this.current
				metadata = this.images && this.images[gid] && this.images[gid].metadata
				metadata = metadata && (Object.keys(metadata).length > 0)

				if(!metadata){
					this.readMetadata(gid)
				}
			}]
	],
})



//---------------------------------------------------------------------
// Metadata editor/viewer...
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
// XXX add a way to sort fields...

// XXX this should basically be platform independent...
// XXX add ability to sort fields -- moving a field up/down edits .config...
// 		...not sure how to go about this yet...
// XXX add combined fields...
// 		'Make' + 'Camera Model Name'
// XXX add identical fields -- show first available and hide the rest...
// 		'Shutter Speed', 'Exposure Time',
// 		'Lens ID', 'Lens'
var MetadataUIActions = actions.Actions({
	config: {
		'metadata-field-order': [
			'Make', 'Camera Model Name', 'Lens ID', 'Lens', 'Lens Profile Name', 'Focal Length',

			'Metering Mode', 'Exposure Program', 'Exposure Compensation', 
			'Shutter Speed Value', 'Aperture Value', 'Iso',

			'Artist', 'Copyright',

			'Date/time Original', 'Create Date', 'Modify Date',

			'Mime Type',

			// NOTE: this is here so as not to hide the 'metadata: unavailable'
			// 		message when not metadata is present and .showMetadata(..)
			// 		is called in 'short' mode...
			'Metadata',
		],
	},

	// XXX should we replace 'mode' with nested set of metadata???
	showMetadata: ['Image/Show metadata',
		function(image, mode){
			image = this.data.getImage(image)
			mode = mode || 'short'

			var field_order = this.config['metadata-field-order'] || []
			var x = field_order.length + 1

			// get image metadata...
			var metadata = (this.images 
					&& this.images[image] 
					&& this.images[image].metadata)
				|| { metadata: 'unavailable.' }

			// build fields...
			var fields = []
			Object.keys(metadata).forEach(function(k){
				var n =  k
					// convert camel-case to human-case ;)
					.replace(/([A-Z]+)/g, ' $1')
					.capitalize()

				// skip metadata stuff in short mode...
				if(mode != 'full' 
						&& field_order.indexOf(n) == -1){
					if(mode == 'short'){
						return

					} else if(mode == 'disabled') {
						n = '- ' + n
					}
				}

				fields.push([ n + ': ', metadata[k] ])
			})

			// sort fields...
			fields.sort(function(a, b){
				a = field_order.indexOf(a[0].replace(/: $/, ''))
				a = a == -1 ? x : a
				b = field_order.indexOf(b[0].replace(/: $/, ''))
				b = b == -1 ? x : b
				return a - b
			})

			var o = overlay.Overlay(this.ribbons.viewer, 
				browse.makeList(
						null,
						fields)
					// path selected...
					.open(function(evt, path){ 
						//o.close()
					}))
					.close(function(){
					})
			o.client.dom.addClass('metadata-view')

			return o
		}]
})

// XXX
var MetadataUI = 
module.MetadataUI = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-metadata',
	depends: [
		'ui',
		'metadata',
	],

	actions: MetadataUIActions,
})



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
