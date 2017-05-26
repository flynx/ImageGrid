/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

var object = require('lib/object')
var actions = require('lib/actions')
var features = require('lib/features')

var core = require('features/core')

var ribbons = require('imagegrid/ribbons')


/*********************************************************************/

var RibbonsClassPrototype = {
}
RibbonsClassPrototype.__proto__ = ribbons.BaseRibbons.prototype.__proto__


var RibbonsPrototype = {
}
RibbonsPrototype.__proto__ = ribbons.BaseRibbons.prototype


var Ribbons =
module.Ribbons =
object.makeConstructor('Ribbons', 
	RibbonsClassPrototype,
	RibbonsPrototype)



/*********************************************************************/

var RenderActions = actions.Actions({
	load: [
		function(data){
			// XXX setup .ribbons
		}],
	reload: [
		function(){
			// XXX
		}],
	refresh: [
		function(){
			// XXX
		}],
	clear: [
		function(){
			// XXX
		}],

	resizing: [
		core.notUserCallable(function(unit, size, overflow){
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
			if(scale == null || scale == '?'){
				return // XXX get scale...
			}

			this.resizing.chainCall(this, function(){
				// XXX set scale...
			}, 'scale', scale)
		}],
	fitImage: ['Zoom/Fit image',
		function(count, overflow){ 
			if(count == '?'){
				return // XXX get size...
			}

			this.resizing.chainCall(this, function(){
				// XXX
			}, 'screenwidth', count, overflow)
		}],
	fitRibbon: ['Zoom/Fit ribbon vertically',
		function(count, whole){ 
			if(count == '?'){
				return // XXX get size...
			}

			this.resizing.chainCall(this, function(){
				// XXX set size...
			}, 'screenheight', count, whole)
		}],

	centerImage: ['- Interface/Center an image in ribbon horizontally',
		function(target, align, offset, scale){ 
			// XXX
		}],
	centerRibbon: ['- Interface/Center a ribbon vertically',
		function(target){ 
			// XXX
		}],

	ribbonRotation: ['- Interface|Ribbon/', 
		function(angle){ 
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
		// XXX
	],
})




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
