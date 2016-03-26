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

var util = require('lib/util')
var toggler = require('lib/toggler')
var tasks = require('lib/tasks')
var keyboard = require('lib/keyboard')

var actions = require('lib/actions')
var core = require('features/core')
var base = require('features/base')

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
var MetadataReaderActions = actions.Actions({
	// XXX should this be sync???
	// XXX add support to taskqueue...
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

							// convert to a real dict...
							// NOTE: exiftool appears to return an array 
							// 		object rather than an actual dict/object
							// 		and that is not JSON compatible....
							var m = {}
							Object.keys(data).forEach(function(k){ m[k] = data[k] })

							that.images[gid].metadata = m
							that.markChanged && that.markChanged(gid)

							resolve(data)
						}

						resolve(data)
					})
				})
			})
		}],

	// XXX STUB: add support for this to .readMetadata(..)
	_readAllMetadata: ['- Image/Read all metadata',
		function(){
			var that = this
			// XXX make this a global API...
			var q = this.__reader_queue = this.__reader_queue || tasks.Queue()

			var read = function(gid){ 
				return function(){ return that.readMetadata(gid) } }

			q.start()

			this.images 
				&& this.images.forEach(function(gid){
					q.enqueue('metadata', read(gid))
				})
			
			return q
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
// NOTE: this is by-design platform independent...
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

// XXX add ability to manually sort fields -- moving a field up/down 
// 		edits .config...
// 		...not sure how to go about this yet...
// XXX add combined fields...
// 		'Make' + 'Camera Model Name'
// XXX add identical fields -- show first available and hide the rest...
// 		'Shutter Speed', 'Exposure Time',
// 		'Lens ID', 'Lens'
// XXX show all fields but make some of them hidden/disabled 
// 		-- togglable via D
// XXX add field editing... (open)
// XXX might be good to split this to sections...
// 		- base info
// 		- general metadata
// 		- full metadata
// 			- EXIF
// 			- IPTC
// 			- ...
// XXX should this be a panel or a list (as is now...)????
var MetadataUIActions = actions.Actions({
	config: {
		'metadata-auto-select-modes': [
			'none',
			'on select',
			'on open',
		],
		'metadata-auto-select-mode': 'on select',

		'metadata-editable-fields': [
			'Artist',
			'Copyright',
			'Comment',
		],
		'metadata-field-order': [
			// base
			'GID', 
			'File Name', 'Parent Directory', 'Full Path',

			// metadata...
			'Make', 'Camera Model Name', 'Lens ID', 'Lens', 'Lens Profile Name', 'Focal Length',

			'Metering Mode', 'Exposure Program', 'Exposure Compensation', 
			'Shutter Speed Value', 'Aperture Value', 'Iso',

			'Artist', 'Copyright',

			'Date/time Original', 'Create Date', 'Modify Date',

			'Mime Type',
		],
	},

	toggleMetadataAutoSelect: ['Interface/Toggle metadata value auto-select',
		base.makeConfigToggler('metadata-auto-select-mode', 
			function(){ return this.config['metadata-auto-select-modes'] })],

	// XXX should we replace 'mode' with nested set of metadata???
	// XXX make this support multiple images...
	showMetadata: ['Image/Show metadata',
		function(image, mode){
			var that = this
			image = this.data.getImage(image)
			mode = mode || 'disabled'

			var field_order = this.config['metadata-field-order'] || []
			var x = field_order.length + 1

			var img = this.images && this.images[image] || null
			// get image metadata...
			var metadata = img && img.metadata || {} 

			// helpers...
			var _cmp = function(a, b){
				a = field_order.indexOf(a[0].replace(/: $/, ''))
				a = a == -1 ? x : a
				b = field_order.indexOf(b[0].replace(/: $/, ''))
				b = b == -1 ? x : b
				return a - b
			}
			var _selectElemText = function(elem){
				var range = document.createRange()
				range.selectNodeContents(elem)
				var sel = window.getSelection()
				sel.removeAllRanges()
				sel.addRange(range)
			}


			// XXX move these to an info feature...
			// base fields...
			var base = [
				['GID: ', image],
				// NOTE: these are 1-based and not 0-based...
				['Index (ribbon): ', 
					this.data.getImageOrder('ribbon', image) + 1
					+'/'+ 
					this.data.getImages(image).len],
				// show this only when cropped...
				['Index (global): ', 
					this.data.getImageOrder(image) + 1
					+'/'+ 
					this.data.getImages('all').len],
			]
			// crop-specific stuff...
			if(this.crop_stack && this.crop_stack.len > 0){
				base = base.concat([
					['Index (crop): ', 
						this.data.getImageOrder('loaded', image) + 1
						+'/'+ 
						this.data.getImages('loaded').len],
				])
			}
			// fields that expect that image data is available...
			var info = ['---']
			if(img){
				// XXX should these be here???
				var _normalize = typeof(path) != 'undefined' ? 
					path.normalize
					: function(e){ return e.replace(/\/\.\//, '') }
				var _basename = typeof(path) != 'undefined' ?
					path.basename
					: function(e){ return e.split(/[\\\/]/g).pop() }
				var _dirname = typeof(path) != 'undefined' ?
					function(e){ return path.normalize(path.dirname(e)) }
					: function(e){ return _normalize(e.split(/[\\\/]/g).slice(0, -1).join('/')) }

				base = base.concat([
					['File Name: ', 
						_basename(img.path)],
					['Parent Directory: ', 
						_dirname((img.base_path || '.') +'/'+ img.path)],
					['Full Path: ', 
						_normalize((img.base_path || '.') +'/'+ img.path)],
				])

				// comment and tags...
				info.push(['Comment', 
					function(){ return img.comment || '' }]) 
			}

			info.push(['Tags', 
				function(){ return that.data.getTags().join(', ') || '' }])

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
			base.sort(_cmp)
			fields.sort(_cmp)

			// add separator to base...
			fields.length > 0 && info.push('---')

			// XXX might be a good idea to directly bind ctrl-c to copy value...
			var o = overlay.Overlay(this.ribbons.viewer, 
				browse.makeList(
						null,
						base
							.concat(info)
							.concat(fields),
						{
							showDisabled: false,
						})
					// select value of current item...
					.on('select', function(evt, elem){
						if(that.config['metadata-auto-select-mode'] == 'on select'){
							_selectElemText($(elem).find('.text').last()[0])
						}
					})
					// path selected...
					.open(function(evt, path){ 
						var editable = RegExp(that.config['metadata-editable-fields']
							.map(function(f){ return util.quoteRegExp(f) })
							.join('|'))

						var elem = o.client.filter(path).find('.text').last()

						// handle select...
						if(that.config['metadata-auto-select-mode'] == 'on open'){
							_selectElemText(elem[0])
						}

						// skip non-editable fields...
						if(editable.test(path)){
							elem
								.prop('contenteditable', true)
								.focus()
								.keydown(function(){ 
									event.stopPropagation() 

									var n = keyboard.toKeyName(event.keyCode)

									// reset to original value...
									if(n == 'Esc'){
										// XXX

									// save value...
									} else if(n == 'Enter' && event.ctrlKey){
										event.preventDefault()

										// XXX
									}
								})
						}
					}))
					.close(function(){
						// XXX
					})
			o.client.dom.addClass('metadata-view')

			return o
		}]
})

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
