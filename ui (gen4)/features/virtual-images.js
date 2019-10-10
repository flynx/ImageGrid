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



/*********************************************************************/

// XXX revise menu placement...
var VirtualImagesActions = actions.Actions({
	// construction of new "virtual images"...
	//
	// XXX should this be restricted to collections???
	// XXX should these be importable from fs???
	// 		i.e. exported as json to <title>.virt and imported back...
	// 		...might be a good idea to add custom import/export handlers...
	// 
	// XXX do better arg processing -- handle metadata correctly...
	// XXX add export support for this type of stuff...
	// 		text -> file.txt
	// XXX add default named templates...
	// XXX add svg templates???
	makeVirtualBlock: ['- Virtual/',
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

			// focus new image...
			// NOTE: this should update the view too...
			this.focusImage(gid)
		}],

	makeVirtualBlankBefore: ['Virtual/Add blank before',
		'makeVirtualBlank: $0 "before"'],
	makeVirtualBlank: ['Virtual/Add blank after',
		core.doc``,
		//{ browseMode: function(){ return !this.collection && 'disabled' }, },
		function(ref, offset){
			this.makeVirtualBlock(ref, offset, {
				type: 'virtual',
				path: null, 
			}) }],

	makeVirtualTextBefore: ['Virtual/Add text before',
		'makeVirtualText: $0 $1 "before"'],
	makeVirtualText: ['Virtual/Add text after',
		core.doc`

			NOTE: this was not designed for complex HTML, only use simple 
				formatted text.`,
		//{ browseMode: function(){ return !this.collection && 'disabled' }, },
		function(text, ref, offset){
			this.makeVirtualBlock(ref, offset, {
				type: 'virtual',
				path: null, 
				text: text || '',
			}) }],

	// XXX export...
})

var VirtualImages = 
module.VirtualImages = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'virtual-images',
	depends: [
		'edit',
	],
	suggested: [
		'ui-virtual-images',
		'ui-virtual-images-edit',
	],

	actions: VirtualImagesActions, 

})



//---------------------------------------------------------------------

var VirtualImagesUIActions = actions.Actions({
	config: {
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
	updateVirtualBlock: ['- Virtual/',
		function(gid, dom, image){
			image = image || this.images[gid] || {}

			if(image.type != 'virtual'){
				return actions.UNDEFINED }

			var p = (this.__virtual_block_processors__ 
				|| VirtualImagesUIActions.__virtual_block_processors__
				|| {})
			p = p[image.format] || p['text']
			return p instanceof Function ?
				p.call(this, image, dom) 
				: dom }],

	// XXX add text format selection...
	// XXX make things editable only when edit is loaded...
	metadataSection: [
		{ sortedActionPriority: 80 },
		function(make, gid, image){
			var that = this
			if(!image || image.type != 'virtual'){
				return }

			make.Separator()
			make.Editable(['Te$xt:', image.text], {
				start_on: 'open',
				edit_text: 'last',
				multiline: true,
				reset_on_commit: false,
				editdone: function(evt, value){
					image.text = value 
					make.dialog.updatePreview()
					that.refresh(gid)
				},
			})
			// XXX add format selection...
			make(['Format:', image.format || 'text'])
		}],
})

// NOTE: this is independent of 'virtual-images'...
var VirtualImagesUI = 
module.VirtualImagesUI = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-virtual-images',
	depends: [
		'ui',
	],
	suggested: [
		'virtual-images',
		'ui-virtual-images-edit',
	],

	actions: VirtualImagesUIActions, 

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

var VirtualImagesEditUIActions = actions.Actions({
	// XXX virtual block editor...
	// XXX
})

// NOTE: this is independent of 'virtual-images'...
var VirtualImagesEditUI = 
module.VirtualImagesEditUI = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-virtual-images-edit',
	depends: [
		'ui',
		'ui-virtual-images',
		'virtual-images',
	],

	actions: VirtualImagesEditUIActions, 
})



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
