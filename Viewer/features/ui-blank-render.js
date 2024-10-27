/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

// XXX should we guard against loading in node???
if(typeof(window) == 'undefined'){
	return
}


var object = require('lib/object')
var actions = require('lib/actions')
var features = require('lib/features')

var core = require('features/core')

var ribbons = require('imagegrid/ribbons')



/*********************************************************************/

var RibbonsClassPrototype = {
	// This is needed to calculate image size when no images are loaded... 
	createImage: function(){
		// XXX
	},

	// XXX
}
RibbonsClassPrototype.__proto__ = ribbons.BaseRibbons.prototype.__proto__


var RibbonsPrototype = {
	viewer: null,

	createImage: RibbonsClassPrototype.createImage,

	// XXX
	
	__init__: function(viewer, images){
		// XXX
	},
}
RibbonsPrototype.__proto__ = ribbons.BaseRibbons.prototype


var Ribbons =
module.Ribbons =
object.Constructor('Ribbons', 
	RibbonsClassPrototype,
	RibbonsPrototype)



/*********************************************************************/
// NOTE: some features that depend on ribbon geometry will not work 
// 		with this...

var RenderActions = actions.Actions({
	get dom(){
		return this.ribbons ? this.ribbons.viewer : undefined },

	load: [
		function(data){
			return function(){
				// XXX setup .ribbons
				var viewer = data.viewer
				viewer = viewer == null && this.ribbons != null 
					? this.dom 
					: viewer

				if(this.ribbons == null){
					this.ribbons = Ribbons(viewer, this.images)
					// XXX is this correct???
					//this.ribbons.__image_updaters = [this.updateImage.bind(this)]

					this.dom.trigger('ig.attached')

				} else {
					//this.ribbons.clear()
					this.ribbons.images = this.images
				}

				this.reload()
			}
		}],
	reload: [
		function(){
			// full reload...
			if(force == 'full'){
				//this.stop()
				/*
				killAllWorkers()
					.done(function(){
						reload() 
					})
				*/
				return location.reload()
			}

			if(!this.ribbons){
				return
			}

			// XXX
		}],
	refresh: [
		function(){
			if(!this.ribbons){
				return
			}
			// XXX
		}],
	clear: [
		function(){
			if(!this.ribbons){
				return
			}
			// XXX
		}],

	resizing: [
		core.Event(function(unit, size, overflow){
			// This is a resizing protocol root function.
			//
			// This will never be used directly, but will wrap protocol user
			// functions.
			//
			// As an example see: .viewScale(..)

			// XXX stop current animation...
			// XXX

			// XXX call .resizingDone(..) when animations done...
			// XXX
		})],

	viewScale: ['- Zoom/',
		function(scale){ 
			if(!this.ribbons){
				return
			}
			if(scale == null || scale == '?'){
				return // XXX get scale...
			}

			this.resizing.chainCall(this, function(){
				// XXX set scale...
			}, 'scale', scale)
		}],
	fitImage: ['Zoom/Fit image',
		function(count, overflow){ 
			if(!this.ribbons){
				return
			}
			if(count == '?'){
				return // XXX get size...
			}

			this.resizing.chainCall(this, function(){
				if(count != null){
					overflow = overflow == false ? 0 : overflow
					var o = overflow != null ? overflow 
						: count % 2 != 1 ? 0
						: (this.config['fit-overflow'] || 0)
					count += o
				}

				// set the scale...
				// XXX

				// refresh image previews...
				// XXX
			}, 'screenwidth', count, overflow)
		}],
	fitRibbon: ['Zoom/Fit ribbon vertically',
		function(count, whole){ 
			if(!this.ribbons){
				return
			}
			if(count == '?'){
				return // XXX get size...
			}

			this.resizing.chainCall(this, function(){
				// XXX set size...

				// XXX refresh image previews...
				
			}, 'screenheight', count, whole)
		}],

	// XXX do we need updateImage here???

	centerImage: ['- Interface/Center an image in ribbon horizontally',
		function(target, align, offset, scale){ 
			if(!this.ribbons){
				return
			}
			// XXX
		}],
	centerRibbon: ['- Interface/Center a ribbon vertically',
		function(target){ 
			if(!this.ribbons){
				return
			}
			// XXX
		}],

	ribbonRotation: ['- Interface|Ribbon/', 
		function(angle){ 
			if(!this.ribbons){
				return
			}
			// XXX
		}],
})

var Render = 
module.Render = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-blank-render',
	exclusive: ['ui-render'],
	depends: [
		// XXX
	],

	actions: RenderActions, 

	handlers: [
		[[
			'shiftImageTo',
			'shiftImageUp',
			'shiftImageDown',
			'shiftImageLeft',
			'shiftImageRight',
		], function(){
			// XXX stub...
			//this.reload()
		}],

		// XXX
	],
})




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
