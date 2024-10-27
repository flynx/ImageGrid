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
var browse = require('lib/widget/browse')

var widgets = require('features/ui-widgets')




/*********************************************************************/
//
//
// XXX should these be sortable and how???
// 		...relative placement (i.e. "before <GID>")???
// 		.....might be a good idea to add option to "pair" images as a 
// 		generic sort thing -- is this grouping???
// XXX should the export mechanism be extensible???
// XXX add undo...
//
// 
var VirtualBlocksActions = actions.Actions({

	// XXX do we need to pre-cache this???
	get virtual(){
		var that = this
		return this.data.order
			.filter(function(gid){ 
				var img = that.images[gid] || {}
				return img.type == 'virtual' }) },

	// construction of new "virtual images"...
	//
	// XXX add undo...
	// XXX do better arg processing -- handle data correctly...
	makeVirtualBlock: ['Virtual block/Add blank $after',
		core.doc`Add virtual block...

				Add virtual block after current image...
				.makeVirtualBlock()
				.makeVirtualBlock('current')
				.makeVirtualBlock('current', 'after')
					-> this

				Add virtual block before current image...
				.makeVirtualBlock('current')
				.makeVirtualBlock('current', 'after')

				Add virtual block at offset relative to reference image,
				optionally containing data...
				.makeVirtualBlock(reference, offset)
				.makeVirtualBlock(reference, offset, data)
					-> this

			NOTE: reference if not given defaults to 'current'
			NOTE: data if not given will default to:
				{
					type: 'virtual',
					path: null,
				}


			Virtual Block Format (Image):
				{
					// block type...
					type: 'virtual',

					// Block name (optional)...
					//
					// NOTE: this is a standard Image attribute used to generate 
					//		exported image filename...
					// NOTE: if it is required to change exported file extension 
					//		from '.txt' add the extension to the name...
					//			Example:
					//				name: 'virtual-image.tex'
					name: <String>,

					// Block text (optional)...
					text: <String>,

					// export constructor action...
					//
					// XXX not implemented yet...
					//export: <action>,

					// optional image attributes...
					// for more info see: imagegrid/images.js
					...
				}
			`,
		{ mode: function(){ return !this.collection && 'disabled' }, },
		function(ref, offset, img){
			ref = ref || 'current'
			offset = offset || 'after'	
			offset = offset == 'after' ? 
					1 
				: offset == 'before' ? 
					0
				: typeof(offset) == typeof(123) ?
					offset
				: 0
			// XXX revise...
			img = arguments[arguments.length-1] instanceof Object ?
				arguments[arguments.length-1]
				: undefined
			img = img === null ? 
				img 
				: Object.assign({
						type: 'virtual', 
						path: null,
					},
					img || {})

			var data = this.data

			ref = data.getImage(ref)
			var r = data.getRibbon(ref)

			var gid = data.newGID()

			// place image into data...
			var order = data.order
			order.splice(order.indexOf(ref)+offset,0, gid)
			var ribbon = data.ribbons[r]
			ribbon.splice(ribbon.indexOf(ref)+offset,0, gid)

			// update data...
			data.updateImagePositions()

			// update data...
			img
				&& (this.images[gid] = img)
			this.markChanged
				&& this
					.markChanged('data')
					.markChanged('images', [gid])

			// focus new image...
			// NOTE: this should update the view too...
			this.focusImage(gid)
		}],
	makeVirtualBlockBefore: ['Virtual block/Add blank $before',
		core.doc`Add block before...
		
			This is the same as .makeVirtualBlock(.., 'before', ..)`,
		{ mode: 'makeVirtualBlock', },
		'makeVirtualBlock: $0 "before" ...'],

	cloneVirtualBlock: ['Virtual block/$Clone block',
		{ mode: function(){ 
			return (this.image || {}).type != 'virtual' && 'disabled' }, },
		function(ref, offset, img){
			var img = Object.assign({}, 
				this.images[this.data.getImage(ref)] || {}, 
				img || {})
			delete img.gid
			this.makeVirtualBlock(ref, offset, img) }],

	// crop...
	// XXX would be nice to avoid these and just register a list and context...
	cropVirtualBlocks: ['Virtual block|Crop/$Crop $virtual $blocks',
		{ mode: 'makeVirtualBlock' },
		'crop: "virtual" ...'],
	cropVirtualBlocksOut: ['Virtual block|Crop/Crop virtual blocks out',
		{ mode: 'cropVirtualBlocks' },
		'crop: "!virtual" ...'],

	// marks...
	toggleMarkVirtualBlocks: ['Virtual block|Mark/Toggle $mark on $virtual blocks',
		{ mode: 'makeVirtualBlock' },
		'toggleMark: "virtual"'],

	// remove...
	// XXX alias to "remove from crop/collection" ???
})

var VirtualBlocks = 
module.VirtualBlocks = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'virtual-blocks',
	depends: [
		'edit',
	],
	suggested: [
		'ui-virtual-blocks',
		'ui-virtual-blocks-edit',
	],

	actions: VirtualBlocksActions, 

})



//---------------------------------------------------------------------

var VirtualBlocksUIActions = actions.Actions({
	config: {
		// Threshold text length at which 
		'virtual-text-fit-area-threshold': 100,

		// Editable virtual block fields...
		//
		// XXX if we need to add types try and re-use existing editor 
		// 		constructors in features/ui-widgets.js....
		'virtual-text-fields': {
			'Tit$le': 'name',
			'Te$xt': 'text',
		},
	},

	__virtual_block_processors__: {
		// Text handler is designed to process plain or lightly 
		// formatted text.
		//
		// This will:
		// 	- replace '\n' with '<br>'
		// 	- adjust font size to fit the image block
		//
		// NOTE: the processor is allowed to only modify image block 
		// 		content, anything else would require cleanup...
		//
		// XXX might be a good idea to add action param to enable 
		// 		handlers to do things like 'setup', 'cleanup', ...	
		text: function(image, dom){
			if(!image.text){
				return dom }

			// threshold after which we try to fill the volume...
			var C = this.config['virtual-text-fit-area-threshold'] || 100

			// construct a basic text element...
			var text = document.createElement('div')
			text.innerHTML = image.text
				.replace(/\n/g, '<br>\n')
			dom[0].innerHTML = ''
			dom[0].appendChild(text)

			// scale the text if it is small...
			var R = dom[0].offsetHeight * 0.8
			var r = image.text.length > C ?
				Math.max(
					text.offsetWidth, 
					text.offsetHeight, 
					// keep large text blocks roughly square-ish...
					Math.sqrt(text.scrollHeight * text.scrollWidth))
				: Math.max(
					text.offsetWidth, 
					text.offsetHeight, 
					text.scrollHeight,
					text.scrollWidth)
			var s = R/r
			text.style.fontSize = `${ 100*s }%`

			// prioritize width... 
			text.style.width = '95%'

			// justify larger blocks...
			image.text.length > C
				&& (text.style.textAlign = 'justify')

			return dom
		},

		/* XXX
		html: function(image, dom){},
		svg: function(image, dom){},
		markdown: function(image, dom){},
		pwiki: function(image, dom){},
		//*/
	},
	// XXX add format auto-detection -- first line announce (a-la pWiki)...
	updateVirtualBlock: ['- Virtual block/',
		function(gid, dom, image){
			image = image || this.images[gid] || {}

			if(image.type != 'virtual'){
				return actions.UNDEFINED }

			var p = (this.__virtual_block_processors__ 
				|| VirtualBlocksUIActions.__virtual_block_processors__
				|| {})
			p = p[image.format] || p['text']
			return p instanceof Function ?
				p.call(this, image, dom) 
				: dom }],

	metadataSection: [
		{ sortedActionPriority: 80 },
		function(make, gid, image){
			var that = this
			if(!image || image.type != 'virtual'){
				return }

			make.Separator()
			this.editVirtualBlock ?
				// editable... 
				this.editVirtualBlock(make, gid, image)
				// view only...
				: Object.entries(this.config['virtual-text-fields'] || {})
					.forEach(function([title, attr]){
						make([title +':', image[attr]]) })
		}],
})

// NOTE: this is independent of 'virtual-blocks'...
var VirtualBlocksUI = 
module.VirtualBlocksUI = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-virtual-blocks',
	depends: [
		'ui',
	],
	suggested: [
		'virtual-blocks',
		'ui-virtual-blocks-edit',
	],

	actions: VirtualBlocksUIActions, 

	handlers: [
		['updateImage',
			function(_, gid, dom){
				var image = this.images[gid] || {}

				// set image content...
				if(image.type == 'virtual' && image.text){
					this.updateVirtualBlock(gid, dom, image)

				// clear reused image content...
				} else if(dom[0].innerHTML != ''){
					dom[0].innerHTML = ''
				}
			}],
	],
})



//---------------------------------------------------------------------

var VirtualBlocksEditUIActions = actions.Actions({
	// XXX this is a good candidate for inlineing (browse2)
	// XXX should we also add a preview (preview constructor from features/metadata.js)???
	// XXX should we do a sanity check for image type???
	editVirtualBlock: ['Virtual block/$Edit...',
		{ mode: 'cloneVirtualBlock' },
		widgets.makeUIDialog(function(gid){
			var that = this

			var _make = function(make, gid, image){
				var Editable = function(title, attr){
					make.Editable([title +':', image[attr] || ''], {
						start_on: 'open',
						edit_text: 'last',
						multiline: true,
						reset_on_commit: false,
						editdone: function(evt, value){
							if(value == ''){
								delete image[attr]
							} else {
								image[attr] = value 
							}

							// mark image as changed...
							that.markChanged 
								&& that.markChanged('images', [gid])
							// refresh views...
							make.dialog.updatePreview
								&& make.dialog.updatePreview()
							that.refresh(gid)
						}, }) }
				// build the list...
				Object.entries(that.config['virtual-text-fields'] || {})
					.forEach(function([title, attr]){
						Editable(title, attr) }) }

			// XXX should this be a more specific test???
			return arguments[0] instanceof Function?
				// inline...
				_make.call(this, ...arguments)
				// dialog...
				: browse.makeLister(null, 
					function(p, make){
						var gid = gid || that.current
						var data = data || that.images[gid]

						_make(make, gid, data) 
					}, {
						cls: 'table-view',
					})
					.close(function(){
						that.refresh(gid) }) })],

	// virtual block templates...
	//
	// XXX implementation vs. UI
	// 		implementation:
	// 			- this looks like a special collection with local .images
	// 				- hidden?
	// 				- can this be global or shared between indexes?
	// 			- this can be just a list in .config or .data (global/local)
	// 		UI:
	// 			- this can be loaded and/or edited as a collection
	// 			- this can be a dialog...
	cloneVirtualBlockFromTemplate: ['- Virtual block/Clone from template...',
		function(){ 
		}],
	saveVirtualBlockAsTemplate: ['- Virtual block/Save as template',
		function(gid){
		}],

	// XXX list existing non-blank v-blocks...
	cloneVirtualBlockFrom: ['- Virtual block/Clone...',
		function(position){ 
		}],

	// XXX add alias to remove...
})

// NOTE: this is independent of 'virtual-blocks'...
var VirtualBlocksEditUI = 
module.VirtualBlocksEditUI = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-virtual-blocks-edit',
	depends: [
		'ui',
		'ui-virtual-blocks',
		'virtual-blocks',
	],

	actions: VirtualBlocksEditUIActions, 
})




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
