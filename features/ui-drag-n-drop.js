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

var DragAndDrop = 
module.DragAndDrop = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-drag-n-drop',
	depends: [
		'ui',
	],

	handlers: [
		// XXX add type/handler registry -- might be a good idea to add 
		// 		an action attribute/handler...
		// XXX would be nice to load a directory tree as ribbons...
		// XXX HACK-ish...
		['start', function(){
			var that = this
			function handleDrop(evt){
				event.stopPropagation()
				event.preventDefault()

				var files = event.dataTransfer.files
				var lst = {}
				var paths = []

				// files is a FileList of File objects. List some properties.
				var output = []
				for (var i = 0, f; f = files[i]; i++) {
					// only images...
					if (!f.type.match('image.*')) {
						continue
					}

					if(f.path){
						paths.push(f.path)

					} else {
						// XXX get the metadata...
						lst[f.name] = {}

						var reader = new FileReader()

						reader.onload = (function(f){
							return function(e){
								// update the data and reload...
								var gid = lst[f.name].gid
								that.images[gid].path = e.target.result
								that.ribbons.updateImage(gid)
							} })(f)

						reader.readAsDataURL(f)
					}
				}

				if(paths.length > 0){
					that.loadURLs(paths)

				} else {
					that.loadURLs(Object.keys(lst))

					// add the generated stuff to the list -- this will help us id the 
					// images when they are loaded later...
					that.images.forEach(function(gid, img){
						lst[img.path].gid = gid
						img.name = img.path.split('.').slice(0, -1).join('.')
					})
				}
			}
			function handleDragOver(evt) {
				evt.stopPropagation()
				evt.preventDefault()
				// Explicitly show this is a copy...
				evt.dataTransfer.dropEffect = 'copy'
			}

			// handle drop events...
			this.ribbons.viewer[0]
				.addEventListener('dragover', handleDragOver, false);
			this.ribbons.viewer[0]
				.addEventListener('drop', handleDrop, false)
		}]
	],
})




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
