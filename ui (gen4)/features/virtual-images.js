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

	// XXX
	makeVirtualBlank: ['Virtual/Add blank after',
		core.doc``,
		//{ browseMode: function(){ return !this.collection && 'disabled' }, },
		function(ref, offset){
			this.makeVirtualBlock(ref, offset, {
				type: 'virtual',
				path: null, 
			}) }],
	makeVirtualText: ['Virtual/Add text block after',
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
		// XXX
	],
	suggested: [
		'ui-virtual-images',
	],

	actions: VirtualImagesActions, 

})



//---------------------------------------------------------------------

var VirtualImagesUIActions = actions.Actions({

	// XXX virtual block editor UI...
	// XXX

})

var VirtualImagesUI = 
module.VirtualImagesUI = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-virtual-images',
	depends: [
		'ui',
		'virtual-images'
	],

	actions: VirtualImagesUIActions, 

	handlers: [
		['updateImage',
			function(res, gid, img){
				var image = this.images[gid] || {}

				// set image content...
				if(image.type == 'virtual' && image.text){
					var text = document.createElement('div')
					text.innerHTML = image.text
					img[0].innerHTML = ''
					img[0].appendChild(text)

					// threshold after which we try to fill the volume...
					var C = 100

					// scale the text if it is small...
					var R = img[0].offsetHeight * 0.8
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

				// clear reused image content...
				} else if(img[0].innerHTML != ''){
					img[0].innerHTML = ''
				}
			}],
	],
})




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
