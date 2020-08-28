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

// NOTE: this needs preact.js to be loaded by index.html
if(typeof(preact) == 'undefined'){
	console.error('Preact.js required but not present.')
}
var h = preact.h

var object = require('lib/object')
var actions = require('lib/actions')
var features = require('lib/features')

var core = require('features/core')

var ribbons = require('imagegrid/ribbons')



/*********************************************************************/
// Preact Components...
// 
// XXX at this point this is an experiment...
// XXX Questions:
// 		- do we do align in the Preact render or outside?
// 		- do we update preview in Preact render or outside?
// 		


class IGRibbonSet extends preact.Component {
	render(props, state){
		var data = props.data
		var ribbons = data.ribbon_order.map(function(gid){
			return h(IGRibbon, {
				gid: gid, 
				current: data.current, 
				base: data.base, 
				data: data
			}) })
		var s = props.scale || 1

		return h('div',
			{
				className: 'ribbon-set', 
				style: {
					transform: 'scale('+ s +', '+ s +')',
				},
			}, [
				h('div', {className: 'current-marker'}),
				h('div', {className: 'ribbon-locator'}, ribbons),
			])
	}
}

// render:
// 	- ribbon
// 	- images
// 	- image marks
//
// XXX needs horizontal align...
class IGRibbon extends preact.Component {
	render(props, state){
		var data = props.data
		var ribbon = props.gid

		var images = data.ribbons[ribbon]
			.map(function(gid){
				var marks = data.tags.marked.indexOf(gid) >= 0 ?
					h(IGImageMark, {
						gid: gid,
						type: 'selected',
						data: data,
					})
					: []
				return [
					h(IGImage, { 
						gid: gid, 
						data: data, 
					})].concat(marks)
				})
			.reduce(function(a, b){ return a.concat(b) })
			.filter(function(a){ return !!a })

		var base = data.base == ribbon ? ['base'] : [] 

		return h('div',
			{
				classList: ['ribbon'].concat(base).join(' '),

				gid: props.gid,
				style: {
					// XXX offset...
				},
			}, images)
	}
}

// render:
// 	- image
class IGImage extends preact.Component {
	render(props, state){
		var data = props.data || {}
		var gid = props.gid

		return h('div',
			{
				classList: ['image']
					.concat(data.current == gid ? ['current'] : [])
					.join(' '),
				gid: gid || '',
				style: {
					// XXX background-image...
				},

				// XXX handle clicks???
			})
	}
}

// render:
// 	- image mark
class IGImageMark extends preact.Component {
	render(props, state){
		var gid = props.gid
		var type = props.type
		var data = props.data

		return h('div',
			{
				classList: ['mark'].concat([type]).join(' '),
				gid: gid,
			})
	}
}



//---------------------------------------------------------------------

var RibbonsClassPrototype = {
	// XXX this is almost exclusively needed for determining scale...
	createImage: function(){
		return preact.render(h(IGImage)) },
}
RibbonsClassPrototype.__proto__ = ribbons.BaseRibbons.prototype.__proto__


var RibbonsPrototype = {
	viewer: null,
	dom: null,

	createImage: RibbonsClassPrototype.createImage,

	update: function(data, full){
		if(!data){
			return
		}

		full
			&& this.clear()

		this.dom = preact.render(
			h(IGRibbonSet, {
				data: data,
				images: this.images || {},
				scale: this.scale() || 1,
			}), 
			this.viewer[0],
			this.dom)

		return this
	},
	clear: function(){
		if(this.dom){
			this.dom.remove()
			delete this.dom
		}
		return this
	},
}
RibbonsPrototype.__proto__ = ribbons.BaseRibbons.prototype


var Ribbons =
module.Ribbons =
object.Constructor('Ribbons', 
	RibbonsClassPrototype,
	RibbonsPrototype)



/*********************************************************************/
// Checklist:
// 	- full ribbons:
// 		- build the initial DOM		- DONE
// 		- centering					- DONE
// 		- scaling					- DONE (save/restore does not work)
// 		- ribbon up/down navigation - XXX 
// 										XXX BUG: up does not hit limit on top ribbon,
// 											similar thing sometimes happened on down... 
// 										XXX see if we need to put .focusRibbon(..) in ui???
// 		- shifting images			- XXX
// 		- preview setting			- 
// 		- marks						- 
// 	- partial ribbons:
// 		- XXX
// 	
// 	

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
	// XXX do a full reload...
	reload: [
		function(force){
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

			// XXX is this correct here???
			this.ribbons.preventTransitions()

			if(!this.ribbons){
				return
			}
			// XXX need to get the data...
			// XXX

			this.ribbons.update(this.data, force)

			this.ribbons.restoreTransitions()
		}],
	// XXX refresh the previews...
	refresh: [
		function(){
			if(!this.ribbons){
				return
			}
			// XXX need to get the data...
			// XXX

			this.ribbons.update(this.data)
		}],
	clear: [
		function(){ this.ribbons && this.ribbons.clear() }],

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
				return this.ribbons.scale()
			}

			this.resizing.chainCall(this, function(){
				this.ribbons.scale(scale)
			}, 'scale', scale)
		}],
	fitImage: ['Zoom/Fit image',
		function(count, overflow){ 
			if(!this.ribbons){
				return
			}
			if(count == '?'){
				return this.ribbons.getScreenWidthImages()
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
				this.ribbons.fitImage(count)

				// XXX refresh image previews...

			}, 'screenwidth', count, overflow)
		}],
	fitRibbon: ['Zoom/Fit ribbon vertically',
		function(count, whole){ 
			if(!this.ribbons){
				return
			}
			if(count == '?'){
				return this.ribbons.getScreenHeightRibbons()
			}

			this.resizing.chainCall(this, function(){
				this.ribbons.fitRibbon(count, whole)

				// XXX refresh image previews...
				
			}, 'screenheight', count, whole)
		}],

	// XXX do we need updateImage here???

	centerImage: ['- Interface/Center an image in ribbon horizontally',
		function(target, align, offset, scale){ 
			this.ribbons && this.ribbons.centerImage(target, align, offset, scale) }],
	centerRibbon: ['- Interface/Center a ribbon vertically',
		function(target){ 
			this.ribbons && this.ribbons.centerRibbon(target) }],

	ribbonRotation: ['- Interface|Ribbon/', 
		function(angle){ 
			// XXX
		}],


	// XXX should these be here, in ui or in ribbons???
	// XXX these are identical to features/ui-ribbons.js
	focusRibbon: [
		function(target, mode){
			mode = mode || this.config['ribbon-focus-mode']

			var c = this.data.getRibbonOrder()
			var i = this.data.getRibbonOrder(target)
			// NOTE: we are not changing the direction here based on 
			// 		this.direction as swap will confuse the user...
			var direction = c < i ? 'before' : 'after'

			if(mode == 'visual'){
				var ribbons = this.ribbons
				var r = this.data.getRibbon(target)
				var t = ribbons.getImageByPosition('current', r)

				if(t.length > 1){
					t = t.eq(direction == 'before' ? 0 : 1)
				}

				t = ribbons.elemGID(t)

				this.focusImage(t, r)
			}
		}],


})

var Render = 
module.Render = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-preact-render',
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
			this.reload()
		}],
	],
})




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
