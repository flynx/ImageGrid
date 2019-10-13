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

var widgets = require('features/ui-widgets')

var browse = require('lib/widget/browse')



/*********************************************************************/

// XXX should these be sortable and how???
// 		...relative placement (i.e. "before <GID>")???
// XXX should these be importable from fs???
// 		i.e. exported as json to <title>.virt and imported back...
// 		...might be a good idea to add custom import/export handlers...
// 
var VirtualBlocksActions = actions.Actions({
	// construction of new "virtual images"...
	//
	// XXX do better arg processing -- handle metadata correctly...
	// XXX add export support for this type of stuff...
	// 		text -> file.txt
	makeVirtualBlock: ['- $Virtual block/',
		function(ref, offset, metadata){
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
			metadata = arguments[arguments.length-1] instanceof Object ?
				arguments[arguments.length-1]
				: null

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

			// update metadata...
			metadata
				&& (this.images[gid] = metadata)
			this.markChanged
				&& this
					.markChanged('data')
					.markChanged('images', [gid])

			// focus new image...
			// NOTE: this should update the view too...
			this.focusImage(gid)
		}],

	// XXX this is enabled only in crop mode as there is no way to delete 
	// 		a block but possible to create one...
	// 		...should we add a .removeBlock(..) action???
	makeVirtualBlank: ['Virtual block/50:Add blank $after',
		core.doc`
		
		`,
		{ browseMode: function(){ return !this.collection && 'disabled' }, },
		function(ref, offset){
			this.makeVirtualBlock(ref, offset, {
				type: 'virtual',
				path: null, 
			}) }],
	makeVirtualBlankBefore: ['Virtual block/51:Add blank $before',
		{ browseMode: 'makeVirtualBlank', },
		'makeVirtualBlank: $0 "before"'],

	// XXX export...
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
			text.style.width = '100%'

			return dom
		},
	},
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
			this.editVirtualBlockText ?
				// editable... 
				this.editVirtualBlockText(make, gid, image)
				// view only...
				: make(['Te$xt:', image.text])
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
	// XXX should we also add a preview (preview constructor from metadata)???
	// XXX should we do a sanity check for image type???
	editVirtualBlockText: ['Virtual block/$Edit text...',
		{ browseMode: function(){ 
			return (this.image || {}).type != 'virtual' && 'disabled' }, },
		widgets.makeUIDialog(function(gid){
			var that = this

			var _make = function(make, gid, image){
				make.Editable(['Te$xt:', image.text], {
					start_on: 'open',
					edit_text: 'last',
					multiline: true,
					reset_on_commit: false,
					editdone: function(evt, value){
						image.text = value 
						// mark image as changed...
						that.markChanged 
							&& that.markChanged('images', [gid])
						// refresh views...
						make.dialog.updatePreview
							&& make.dialog.updatePreview()
						that.refresh(gid)
					}, }) }

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
