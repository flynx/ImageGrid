/**********************************************************************
* 
*
*
**********************************************************************/

((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

// XXX this is a hack...
// 		...need a way to escape these so as not to load them in browser...
if(typeof(process) != 'undefined'){
	var fs = requirejs('fs')
	var path = requirejs('path')
	var exiftool = requirejs('exiftool')

	// XXX EXPERIMENTAL: graph...
	// do this only if browser is loaded...
	var graph = typeof(window) != 'undefined' ?
		requirejs('lib/components/ig-image-graph')
		: null
}


var util = require('lib/util')
var toggler = require('lib/toggler')
var tasks = require('lib/tasks')
var keyboard = require('lib/keyboard')

var actions = require('lib/actions')
var core = require('features/core')
var base = require('features/base')
var widgets = require('features/ui-widgets')

var browse = require('lib/widget/browse')
var overlay = require('lib/widget/overlay')



/*********************************************************************/
// XXX make metadata a prop of image... (???)
// XXX Q: should we standardise metadata field names and adapt them to 
// 		lib???

var MetadataActions = actions.Actions({
	// XXX 
	metadata: ['- Image/',
		function(target, data){
			// XXX
		}],

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
	suggested: [
		'fs-metadata',
		'ui-metadata',
		'ui-fs-metadata',
	],

	actions: MetadataActions,
})


//---------------------------------------------------------------------
// Metadata reader/writer...


// XXX add Metadata writer...
var MetadataReaderActions = actions.Actions({
	// NOTE: this will read both stat and metadata...
	//
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

			if(!image && !img){
				return false
			}

			//var full_path = path.normalize(img.base_path +'/'+ img.path)
			var full_path = this.getImagePath(gid)

			return new Promise(function(resolve, reject){
				if(!force && img.metadata){
					return resolve(img.metadata)
				}

				fs.readFile(full_path, function(err, file){
					if(err){
						return reject(err)
					}

					// read stat...
					if(!that.images[gid].birthtime){
						var img = that.images[gid]
						var stat = fs.statSync(full_path)
						
						img.atime = stat.atime
						img.mtime = stat.mtime
						img.ctime = stat.ctime
						img.birthtime = stat.birthtime

						img.size = stat.size
					}

					// read image metadata...
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

							// XXX
							that.markChanged && that.markChanged('images', [gid])
						}

						resolve(data)
					})
				})
			})
		}],

	// XXX STUB: add support for this to .readMetadata(..)
	readAllMetadata: ['File/Read all metadata',
		function(){
			var that = this
			// XXX make this a global API...
			var q = this.__reader_queue = this.__reader_queue || tasks.Queue()

			var logger = this.logger && this.logger.push('Read metadata')

			// XXX is this the right way to go???
			q.on('taskQueued', function(t){ logger.emit('queued', t) })
			q.on('taskDone', function(t){ logger.emit('done', t) })
			q.on('taskFailed', function(t){ logger.emit('error', t) })

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
		'fs-info',
		'metadata',
	],

	isApplicable: function(){ return this.runtime.node },

	actions: MetadataReaderActions,

	handlers: [
		// XXX STUB: need a better strategy to read metadata...
		// 		Approach 1 (target):
		// 			read the metadata on demand e.g. on .showMetadata(..)
		// 				+ natural approach
		// 				- not sync
		// 					really complicated to organize...
		//
		// 		Approach 2:
		// 			lazy read -- timeout and overwrite on next image
		// 				- hack-ish
		// 				+ simple
		//
		// 		Approach 3:
		// 			index a dir
		/*
		['focusImage', 
			function(){
				var gid = this.current
				metadata = this.images && this.images[gid] && this.images[gid].metadata
				metadata = metadata && (Object.keys(metadata).length > 0)

				if(!metadata){
					this.readMetadata(gid)
				}
			}]
		*/
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
// XXX add field editing... (open)
// XXX might be good to split this to sections...
// 		- base info
// 		- general metadata
// 		- full metadata
// 			- EXIF
// 			- IPTC
// 			- ...
var MetadataUIActions = actions.Actions({
	config: {
		'metadata-preview-size': 150,

		'metadata-auto-select-modes': [
			'none',
			'on focus',
			'on open',
		],
		'metadata-auto-select-mode': 'on focus',

		// XXX
		'metadata-editable-fields': [
			//'Artist',
			//'Copyright',
			'Comment',
			'Tags',
		],
		'metadata-field-order': [
			// base
			'GID', 
			'File Name', 'Parent Directory', 'Full Path',

			'Date created', 'ctime', 'mtime', 'atime',

			'Index (ribbon)', 'Index (crop)', 'Index (global)',

			// metadata...
			'Make', 'Camera Model Name', 'Lens ID', 'Lens', 'Lens Profile Name', 'Focal Length',

			'Metering Mode', 'Exposure Program', 'Exposure Compensation', 
			'Shutter Speed Value', 'Exposure Time', 
			'Aperture Value', 'F Number', 
			'Iso',
			'Quality', 'Focus Mode', 

			'Rating',

			'Artist', 'Copyright',

			'Date/time Original', 'Create Date', 'Modify Date',

			'Mime Type',
		],

		// XXX EXPERIMENTAL: graph...
		'metadata-graph': 'on',
		'metadata-graph-config': {
			graph: 'waveform',
			mode: 'luminance',
		},
	},

	toggleMetadataAutoSelect: ['Interface/Metadata value select',
		core.makeConfigToggler('metadata-auto-select-mode', 
			function(){ return this.config['metadata-auto-select-modes'] })],

	toggleMetadataGraph: ['Interface/Metadata graph display',
		{ mode: function(){
			return (!graph || this.config['browse-advanced-mode'] != 'on') && 'hidden' }},
		core.makeConfigToggler('metadata-graph', ['on', 'off'])],

	// XXX show only graph...
	// XXX might be a good idea to show directly in main menu...
	// XXX reuse in .showMetadata(..)
	// XXX should be floating...
	showGraph: ['- Image/',
		function(make){
			// XXX
		}],

	// NOTE: this will extend the Browse object with .updateMetadata(..)
	// 		method to enable updating of metadata in the list...
	//
	// XXX should we replace 'mode' with nested set of metadata???
	// XXX make this support multiple images...
	// XXX make things editable only in when edit is loaded...
	// XXX BUG: .dialog.updatePreview() is stealing marks from 
	// 		the original image in ribbon...
	// 		...see inside...
	showMetadata: ['Image/Metadata...',
		widgets.makeUIDialog(function(image, mode){
			var that = this
			image = this.data.getImage(image)
			mode = mode || 'disabled'
			data = this.images[image]

			var preview_size = this.config['metadata-preview-size'] || 150

			var _normalize = typeof(path) != 'undefined' ? 
				path.normalize
				: function(e){ return e.replace(/\/\.\//, '') }

			return browse.makeLister(null, 
				function(p, make){
					// helper...
					// NOTE: we intentionally rewrite this on each update,
					// 		this is done to keep the ref to make(..) up-to-date...
					make.dialog.wait = function(){
						make.Separator()
						make.Spinner() }
					// XXX BUG: this when attached is stealing marks from 
					// 		the original image in ribbon...
					make.dialog.updatePreview = function(){
						var preview = this.preview = 
							this.preview 
								|| that.ribbons.createImage(image)
						return that.ribbons.updateImage(preview, image, preview_size, false, {
								nochrome: true,
								pre_updaters_callback: function([p]){
									p.classList.add('clone', 'preview')
									p.style.height = preview_size +'px'
									p.style.width = preview_size +'px'
								},
							}) }
					// XXX EXPERIMENTAL: graph
					// XXX do the calculations in a worker...
					make.dialog.updateGraph = function(gid, size){
						// prevent from updating too often...
						if(this.__graph_updating){
							// request an update...
							this.__graph_updating = [gid, size]
							return this.graph }
						this.__graph_updating = true
						setTimeout(function(){
							// update was requested while we were out -> update now...
							this.__graph_updating instanceof Array
								&& this.updateGraph(...this.__graph_updating)
							delete this.__graph_updating }.bind(this), 200)

						// graph disabled...
						if(!graph || that.config['metadata-graph'] != 'on'){
							return }

						// data...
						gid = that.data.getImage(gid || 'current')
						var config = that.config['metadata-graph-config'] || {}
						var url = that.images[gid].preview ?
							that.images.getBestPreview(gid, size || 300, null, true).url
							: that.getImagePath(gid)
						var flipped = (that.images[gid] || {}).flipped || []
						flipped = flipped.length == 1 ? 
								flipped[0]
							: flipped.length == 2 ?
								'both'
							: null

						// build the element...
						var elem = this.graph = 
							Object.assign(
								this.graph 
									|| document.createElement('ig-image-graph'), 
								config,
								// orientation....
								{
									orientation: (that.images[gid] || {}).orientation || 0,
									flipped: flipped, 
								})
						Object.assign(elem.style, {
							width: '500px',
							height: '200px',
						})
						// delay drawing a bit...
						setTimeout(function(){
							elem.src = url }, 0)
						return elem }

					// preview...
					make(['Preview:', this.updatePreview()], 
						{ cls: 'preview' })
					// XXX EXPERIMENTAL: graph
					// graph...
					graph 
						&& that.config['metadata-graph'] == 'on'
						&& make(['Graph:', $(this.updateGraph())], 
							{ cls: 'preview' })
					// NOTE: these are 1-based and not 0-based...
					make(['Position: ', 
						$('<small>')
							.addClass('text')
							.css({
								whiteSpace: 'pre',
							})
							.html([
								// ribbon...
								that.data.getImageOrder('ribbon', image) + 1
									+'/'+ 
									that.data.getImages(image).len
									+ '<small>R</small>',
								...((that.crop_stack && that.crop_stack.len > 0) ?
									// crop...
									[that.data.getImageOrder('loaded', image) + 1
										+'/'+ 
										that.data.getImages('loaded').len
										+ '<small>C</small>']
									// global...
									: [that.data.getImageOrder(image) + 1
										+'/'+ 
										that.data.getImages('all').len
										+ '<small>G</small>']),
								// ribbon...
								'<span>R:</span>'+
									(that.data.getRibbonOrder(image) + 1)
									+'/'+
									Object.keys(that.data.ribbons).length,
							].join('   ')) ],
						{ cls: 'index' })
					make.Separator()

					// comment...
					make.Editable(['$Comment: ', 
						function(){ 
							return data && data.comment || '' }], 
						{
							start_on: 'open',
							edit_text: 'last',
							multiline: true,
							reset_on_commit: false,
							editdone: function(evt, value){
								if(value.trim() == ''){
									return }
								data = that.images[image] = that.images[image] || {}
								data.comment = value
								// mark image as changed...
								that.markChanged 
									&& that.markChanged('images', [image])
							},
						}) 
					make.Separator()

					// gid...
					make(['$GID: ', image])


					if(data){
						// some abstractions...
						var _basename = typeof(path) != 'undefined' ?
							path.basename
							: function(e){ return e.split(/[\\\/]/g).pop() }
						var _dirname = typeof(path) != 'undefined' ?
							function(e){ return path.normalize(path.dirname(e)) }
							: function(e){ 
								return _normalize(e.split(/[\\\/]/g).slice(0, -1).join('/')) }

						// paths...
						data.path 
							&& make(['File $Name: ', 
								_basename(data.path)])
							&& make(['Parent $Directory: ', 
								_dirname((data.base_path || '.') +'/'+ data.path)])
							&& make(['Full $Path: ', 
								_normalize((data.base_path || '.') +'/'+ data.path)])
						// times...
						data.birthtime 
							&& make(['Date created: ', 
								data.birthtime && new Date(data.birthtime).toShortDate()])
						data.ctime
							&& make(['- ctime: ', 
								data.ctime && new Date(data.ctime).toShortDate()],
								{disabled: true})
						data.mtime
							&& make(['- mtime: ',
								data.mtime && new Date(data.mtime).toShortDate()],
								{disabled: true})
						data.atime
							&& make(['- atime: ', 
								data.atime && new Date(data.atime).toShortDate()],
								{disabled: true})
					}

					// get other sections...
					that.callSortedAction('metadataSection', make, image, data, mode)
				}, {
					cls: 'table-view metadata-view',
					showDisabled: false,
				})
				.on('attached', function(){ 
					this.updatePreview() 
					graph
						&& this.updateGraph()
				})
				.on('update', function(){ 
					this.updatePreview() 
					graph
						&& this.updateGraph()
				})
				// select value of current item...
				.on('select', function(evt, elem){
					that.config['metadata-auto-select-mode'] == 'on focus'
						&& $(elem).find('.text').last().selectText() })
				.close(function(){
					// XXX handle comment and tag changes...
					// XXX

					that.refresh(image)

					// XXX EXPERIMENTAL: graph...
					// save graph settings...
					this.graph
						&& (that.config['metadata-graph-config'] = {
							graph: this.graph.graph,
							mode: this.graph.mode,
						})
				})
		})],

	metadataSection: ['- Image/',
		{ sortedActionPriority: 'normal' },
		core.notUserCallable(function(make, gid, image, mode){
			var that = this
			var metadata = this.getMetadata(gid) || {} 
			var field_order = this.config['metadata-field-order'] || []
			var x = field_order.length + 1

			make.dialog.updateMetadata = 
				function(metadata){
					metadata = metadata || that.getMetadata()

					// build new data set and update view...
					//this.options.data = _buildInfoList(image, metadata)
					this.update()

					return this
				}

			// build fields...
			var fields = []
			Object.keys(metadata)
				.forEach(function(k){
					var n =  k
						// convert camel-case to human-case ;)
						.replace(/([A-Z]+)/g, ' $1')
						.capitalize()
					var opts = {}

					// skip metadata stuff in short mode...
					if(mode != 'full' 
							&& field_order.indexOf(n) == -1){
						if(mode == 'short'){
							return

						} else if(mode == 'disabled') {
							opts.disabled = true
						}
					}

					fields.push([
						[ n + ': ', metadata[k] ], 
						opts,
					])
				})

			// make fields...
			fields
				.sort(function(a, b){
					a = field_order.indexOf(a[0][0]
						.replace(/\$(\w)/g, '$1')
						.replace(/^- |: $/g, ''))
					a = a == -1 ? x : a
					b = field_order.indexOf(b[0][0]
						.replace(/\$(\w)/g, '$1')
						.replace(/^- |: $/g, ''))
					b = b == -1 ? x : b
					return a - b })
				.run(function(){
					this.length > 0
						&& make.Separator() })
				.forEach(function(e){
					make(...e) })
		})],
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



// Load etdata on demand...
//
var MetadataFSUI = 
module.MetadataFSUI = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-fs-metadata',
	depends: [
		'ui',
		'metadata',
		'fs-metadata',
	],

	handlers: [
		// Read metadata and when done update the list...
		['showMetadata.pre',
			function(image){
				var that = this
				var reader = this.readMetadata(image)

				return reader 
					&& function(client){
						// add a loading indicator...
						// NOTE: this will get overwritten when calling .updateMetadata()
						client.wait()

						reader
							.then(function(data){
								client.updateMetadata() })
							.catch(function(){
								client.update() })
					} }],
	],
})


/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
