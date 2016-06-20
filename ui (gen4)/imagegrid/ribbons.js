/**********************************************************************
* 
* Minimal UI API...
*
*
**********************************************************************/

define(function(require){ var module = {}

if(typeof(window) == 'undefined'){
	return
}

//var DEBUG = DEBUG != null ? DEBUG : true

// XXX is this correct...
//require('ext-lib/jquery')

var util = require('lib/util')
var transform = require('lib/transform')
var object = require('lib/object')

var data = require('imagegrid/data')
var images = require('imagegrid/images')


var IMAGE = '.image:not(.clone)'
var RIBBON = '.ribbon:not(.clone)'




/*********************************************************************/
//
// This expects the following HTML structure...
//
// Unpopulated:
//
//	<div class="viewer">
//	</div>
//
//
// Populated:
//
//	<div class="viewer">
//		<div class="ribbon-set">
//			<div class="ribbon">
//				<div class="image" gid="a"></div>
//				<div class="image" gid="b"></div>
//				...
//			</div>
//			<div class="ribbon">
//				<div class="image" gid="c"></div>
//
//				<!-- current image -->
//				<div class="current image" gid="d"></div>
//
//				<!-- image with mark... -->
//				<div class="image" gid="e"></div>
//				<div class="mark selected" gid="f"></div>
//
//				<div class="image" gid="g"></div>
//
//				...
//			</div>
//			...
//		</div>
//	</div>
//
//
// NOTE: there can be only one .ribbon-set element.
//
//
//
/*********************************************************************/
// Low Level dom access...
//
// XXX think if a way to manage animation timings...
// XXX not sure if this is the right way to go...

var legacyDOMAdapter =
module.legacyDOMAdapter = {
	getOrigin: getElementOrigin,
	// XXX this is not used here...
	setOrigin: setElementOrigin, 

	getScale: getElementScale,
	setScale: setElementScale,

	getOffset: getElementOffset,
	setOffset: setElementOffset,

	// a bit higher level...
	shiftOrigin: shiftOriginTo,
	relativeOffset: getRelativeOffset,
}


var DOMAdapter =
module.DOMAdapter = {
	getOrigin: function(elem){
		var o = $(elem).origin() || [0, 0] 
		return { left: o[0], top: o[1], }
	},
	setOrigin: function(elem, left, top){
		return $(elem).origin(left, top, 0)
	},
	setOriginSync: function(elem, x, y, z){
		x = x == null ? '50%' : x
		y = y == null ? '50%' : y
		z = z == null ? '0' : z
		var value = x +' '+ y +' '+ z

		elem = $(elem)
		var e = elem[0]

		e.style.display = 'none'
		// now kick the browser into recognition of our changes NOW ;)
		getComputedStyle(e).display

		e.style['-o-transform-origin'] =  value
		e.style['-ms-transform-origin'] =  value
		e.style['-moz-transform-origin'] =  value
		e.style['-webkit-transform-origin'] =  value
		e.style['transform-origin'] = value

		e.style.display = ''
		getComputedStyle(e).display

		return $(elem)
	},

	getScale: function(elem){ 
		return $(elem).scale() || 1 },
	setScale: function(elem, scale){
		return $(elem).scale(scale || 1) },

	getOffset: function(elem){
		var o = $(elem).transform('x', 'y') 
		return { left: o.x, top: o.y, }
	},
	setOffset: function(elem, left, top){
		return $(elem).transform({x: left || 0, y: top || 0, z: 0}) 
	},

	shiftOrigin: function(elem, left, top, scale){
		var o = this.getOrigin(elem)
		var scale = scale || this.getScale(elem)
		var offset = this.getOffset(elem)

		// calculate the offset change and compensate...
		var cl = offset.left + ((o.left - o.left*scale) - (left - left*scale))
		var ct = offset.top + ((o.top - o.top*scale) - (top - top*scale))

		this.setOffset(elem, cl, ct)

		return this.setOriginSync(elem, left+'px', top+'px')
	},
	// see docs in jli.js
	relativeOffset: function(container, block, point){
		point = point == null ? {} : point
		var l = point.left
		var t = point.top
		var scale = point.scale

		// get the input data...
		var s = this.getScale(block) || 1
		var o = this.getOrigin(block)
		// get only the value we need...
		var W = container.width()
		var H = container.height()
		// we need this to make everything relative to the container...
		var co = container.offset()
		var offset = this.getOffset(block)
		var bo = block.offset()

		scale = scale == 'screen' ? 1 
			: scale == 'elem' ? s
			: scale == null ? s
			: scale

		// normalize the l,t to element scale...
		if(l != null && t != null){

			// get only the value we need...
			// NOTE: width and height are used to calculate the correction
			//		due to origin/scale...
			var w = block.width()
			var h = block.height()
			o = {
				// target offset scale...
				top: t*scale 
					// set origin to top left corner of element (compensate
					// for scaling)...
					+ (h - h*s) / (h / o.top), 
				left: l*scale 
					+ (w - w*s) / (w / o.left),
			}
		}

		return {
			top: offset.top + (H/2 - offset.top) - o.top,
			left: offset.left + (W/2 - offset.left) - o.left,
		}
	},
}



/*********************************************************************/

var RibbonsClassPrototype = {
	// Generic getters...
	getElemGID: function(elem){
		return JSON.parse('"' 
			+ (elem instanceof jQuery ? 
					elem.attr('gid') 
				: elem.getAttribute('gid'))
			+ '"')
	},
	setElemGID: function(elem, gid){
		return $(elem)
			.attr('gid', JSON.stringify(gid)
					// this removes the extra quots...
					.replace(/^"(.*)"$/g, '$1'))
	},

	// DOM Constructors...
	// NOTE: these will return unattached objects...
	createViewer: function(){
		return $('<div>')
			.addClass('viewer')
			//.append($('<div>')
			//	.addClass('ribbon-set'))
	},
	// XXX NOTE: quots removal might render this incompatible with older data formats...
	createRibbon: function(gids){
		gids = gids || []
		gids = gids.constructor !== Array ? [gids] : gids
		var that = this
		return $(gids.map(function(gid){
			gid = gid != null ? gid+'' : gid

			return that.setElemGID($('<div>')
				.addClass('ribbon'), gid)[0]
			//return $('<div>')
			//	.addClass('ribbon-container')
			//	.append(that.setElemGID($('<div>')
			//		.addClass('ribbon'), gid))[0]
		}))
	},
	// XXX NOTE: quots removal might render this incompatible with older data formats...
	createImage: function(gids){
		gids = gids || []
		gids = gids.constructor !== Array ? [gids] : gids
		var that = this
		return $(gids.map(function(gid){
			gid = gid != null ? gid+'' : gid
			return that.setElemGID($('<div>')
					.addClass('image'), gid)[0]
		}))
	},
	createMark: function(cls, gid){
		gid = gid != null ? gid+'' : gid
		return this.setElemGID($('<div class="mark">')
			.addClass(cls), gid)
	},
} 


// NOTE: this is a low level interface, not a set of actions...
var RibbonsPrototype = {
	//
	//	.viewer (jQuery object)
	//
	//	.images (Images object)
	//
	// XXX to update images we need to know about images...
	
	__init__: function(viewer, images){
		this.viewer = $(viewer)
		this.images = images
	},

	// XXX
	clone: function(){
		var o = new this.constructor()
		if(this.viewer){
			// XXX does this completely detach from the orriginal???
			// XXX do we need to reattach something???
			o.viewer = this.viewer.clone()
		}
		if(this.images){
			o.images = this.images.clone()
		}
		return o
	},

	// DOM Adapter...
	dom: DOMAdapter,
	
	// Constructors...
	createViewer: RibbonsClassPrototype.createViewer,
	createRibbon: RibbonsClassPrototype.createRibbon,
	createImage: RibbonsClassPrototype.createImage,
	createMark: RibbonsClassPrototype.createMark,

	// Generic getters...
	getElemGID: RibbonsClassPrototype.getElemGID,
	setElemGID: RibbonsClassPrototype.setElemGID,


	get parent(){
		return this.__parent
	},
	// NOTE: this will reset locally referenced .images to .parent.images
	set parent(parent){
		this.__parent = parent

		delete this.__images
	},

	// maintain images in .parent.images if available...
	//
	// NOTE: images can be stored locally if no parent is set but will 
	// 		get overridden as soon as .parent is set.
	get images(){
		return this.parent ? this.parent.images : this.__images
	},
	set images(images){
		if(this.parent){
			this.parent.images = images
			delete this.__images

		} else {
			this.__images = images
		}
	},


	// Helpers...

	// Prevent CSS transitions...
	//
	// 	Prevent transitions globally (.viewer):
	// 	.preventTransitions()
	// 		-> data
	//
	// 	Prevent transitions on elem:
	// 	.preventTransitions(elem)
	// 		-> data
	//
	//
	// NOTE: this will set a .no-transitions CSS class and force 
	// 		recalculation on the given element
	// NOTE: for this to have effect proper CSS configuration is needed.
	preventTransitions: function(target){
		target = target || this.viewer
		//prevent_nested = prevent_nested || false
		if(target.length == 0){
			return this
		}
		var t = target[0]

		// handle nesting...
		var l = t.getAttribute('__prevent_transitions')
		if(l != null){
			t.getAttribute('__prevent_transitions', l+1)
			return this
		}
		t.getAttribute('__prevent_transitions', 0)

		target.addClass('no-transitions')

		var s = getComputedStyle(t)
		s.webkitTransition
		s.mozTransition
		s.msTransition
		s.oTransition
		s.transition

		return this
	},

	// Restore CSS transitions...
	//
	// This is a companion to .preventTransitions(..)
	//
	// 	Restore transitions globally (.viewer):
	// 	.restoreTransitions()
	// 		-> data
	//
	// 	Restore transitions on elem: 
	// 	.restoreTransitions(elem)
	// 		-> data
	//
	// 	Restore transitions on elem (force sync): 
	// 	.restoreTransitions(elem, true)
	// 		-> data
	//
	// 	Force restore transitions: 
	// 	.restoreTransitions(.., .., true)
	// 		-> data
	//
	// When at least one .preventTransitions(..) is called with 
	// prevent_nested set to true, this will be a no-op on all nested
	// levels.
	// This can be overridden via setting the force to true.
	//
	// NOTE: the implementation of this method might seem ugly, but the 
	// 		code is speed-critical, thus we access the DOM directly and
	// 		the two branches are unrolled...
	restoreTransitions: function(target, now, force){
		if(target === true || target === false){
			now = target
			target = this.viewer
		} else {
			target = target || this.viewer
		}
		if(target.length == 0){
			return this
		}
		var t = target[0]

		// sync...
		if(now){
			// handle nesting...
			var l = t.getAttribute('__prevent_transitions')
			if(l != null && !force && l != '0'){
				t.getAttribute('__prevent_transitions', l-1)
				return this
			}
			t.removeAttribute('__prevent_transitions')

			target.removeClass('no-transitions')

			var s = getComputedStyle(t)
			s.webkitTransition
			s.mozTransition
			s.msTransition
			s.oTransition
			s.transition

		// on next exec frame...
		} else {
			var that = this
			setTimeout(function(){
				// handle nesting...
				var l = t.getAttribute('__prevent_transitions')
				if(l != null && !force && l != '0'){
					t.getAttribute('__prevent_transitions', l-1)
					return this
				}
				t.removeAttribute('__prevent_transitions')

				target.removeClass('no-transitions')

				var s = getComputedStyle(t)
				s.webkitTransition
				s.mozTransition
				s.msTransition
				s.oTransition
				s.transition
			}, 0)
		}

		return this
	},

	// Shorthand wrappers of the above...
	//
	// XXX do we need custom target support here???
	noTransitions: function(func){
		this.preventTransitions()
		func.apply(this, args2array(arguments).slice(1))
		this.restoreTransitions(true)
		return this
	},
	noTransitionsDeep: function(func){
		this.preventTransitions(null, true)
		func.apply(this, args2array(arguments).slice(1))
		this.restoreTransitions(true)
		return this
	},

	// Scale...
	//
	// 	Get scale...
	// 	.scale()
	// 		-> <scale>
	//
	// 	Set scale...
	// 	.scale(<scale>)
	// 	.scale(<scale>, <image>|'current'|'closest')
	// 	.scale(<scale>, 'top'|'center'|'bottom'|<px>|%, 'left'|'center'|'right'|<px>|%)
	// 		-> <ribbons>
	//
	// NOTE: this will also set origin...
	//
	// XXX if chrome 38 renders images blurry uncomment the fix...
	scale: function(scale, t, l){
		// get...
		if(arguments.length == 0){
			return this.dom.getScale(this.getRibbonSet()) || 1

		// set...
		} else {
			var ribbon_set = this.getRibbonSet()  

			if(ribbon_set.length == 0){
				return this
			}

			// default origin -- center...
			if(t == null && l == null){
				this.origin('center', 'center')

			// an image...
			} else if(l == null){
				t = t == 'current' ? this.getImage()
					: t == 'closest' ? this.getImageByPosition()
					: t
				this.origin(t)

			// explicit...
			} else {
				this.origin(t, l)
			}

			// XXX experimental: not sure if this is the right place for this...
			// 		...think this is a good place because its one spot 
			// 		that gets used everywhere...
			// 		...think this is a bad spot because we lose control ho many
			// 		images of what size get loaded, and wee need to minimize 
			// 		loading...
			//this.updateImage('*', null, this.getVisibleImageSize('height', 1) * scale)

			this.dom.setScale(ribbon_set, scale)


			/*
			ribbon_set
				.velocity('stop')
				// XXX get the time from config...
				.velocity({scale: scale}, 200)
			*/

			/* XXX not sure if this is needed yet...
			// XXX fix a render bug in chrome 38...
			var v = this.viewer[0]
			if(v.style.transform == ''){
				v.style.transform = 'translateZ(0)'
			} else {
				v.style.transform = ''
			}
			*/

			return this
		}
	},
	
	// Origin...
	//
	// 	Get origin...
	// 	.origin()
	// 		-> <origin>
	//
	//	Set origin to center of image:
	//	.origin(image)
	//		-> ribbons
	//
	//	Set origin to screen coordinates:
	//	.origin(x|%|'left'|'center'|'right', x|%|'top'|'center'|'bottom')
	//		-> ribbons
	//
	// NOTE: this will also compensate for scaling.
	//
	// XXX DEBUG: remove point updating when not needed...
	origin: function(a, b){
		// get...
		if(arguments.length == 0){
			return this.dom.getOrigin(this.getRibbonSet())

		// set...
		} else {
			var ribbon_set = this.getRibbonSet()

			if(ribbon_set.length == 0){
				return this
			}

			var ro = ribbon_set.offset()
			var s = this.scale()

			if(a != null && b != null){
				var vo = this.viewer.offset()

				a = a == 'left' ? 0
					: a == 'right' ? this.viewer.width()
					: a == 'center' ? this.viewer.width()/2
					: /[0-9.]*%/.test(a) ? this.viewer.width()*(parseFloat(a)/100)
					: a

				b = b == 'top' ? 0
					: b == 'bottom' ? this.viewer.height()
					: b == 'center' ? this.viewer.height()/2
					: /[0-9.]*%/.test(b) ? this.viewer.height()*(parseFloat(b)/100)
					: b

				var l = (a - ro.left)/s + vo.left
				var t = (b - ro.top)/s + vo.top

			// image...
			} else {
				var img = this.getImage(a)
				var io = img.offset()
				// XXX jQuery3: should we compensate for scale here???
				var w = img.width()
				var h = img.height()

				var l = (io.left - ro.left)/s + w/2
				var t = (io.top - ro.top)/s + h/2
			}

			this.dom.shiftOrigin(ribbon_set, l, t)

			// XXX DEBUG: remove when done...
			if($('.point').length > 0){
				this.dom.setOffset($('.point'), l, t)
			}

			return this
		}
	},
	
	// Get visible image tile size...
	//
	//	.getVisibleImageSize()
	//	.getVisibleImageSize('width')
	//		-> size
	//
	//	.getVisibleImageSize('height')
	//		-> size
	//
	//	.getVisibleImageSize('max')
	//	.getVisibleImageSize('min')
	//		-> size
	//
	// NOTE: this is similar to vh, vw, vmin and vmax CSS3 units, but
	// 		gets the visible size of the image tile in pixels.
	//
	// XXX this might break when no images are loaded and proportions 
	// 		are not square...
	getVisibleImageSize: function(dim, scale, img){
		dim = dim == null ? 'width' : dim
		img = img || this.viewer.find(IMAGE)

		// if no images are loaded create one temporarily....
		var tmp
		if(img.length == 0){
			img = tmp = this.createImage('__tmp_image__')
				.css({
					position: 'absolute',
					visibility: 'hidden',
					top: '-200%',
					left: '-200%',
				})
				.appendTo(this.viewer)
		}


		// do the calc...
		scale = scale || this.scale()
		var css = getComputedStyle(img[0])
		var res = dim == 'height' ? parseFloat(css.height)
			: dim == 'width' ? parseFloat(css.width)
			: dim == 'max' ?  Math.max(parseFloat(css.height), parseFloat(css.width))
			: dim == 'min' ?  Math.min(parseFloat(css.height), parseFloat(css.width))
			: null
		// get size for given scale...
		res = res ? res * scale : res

		// remove the tmp image we created...
		if(tmp != null){
			tmp.remove()
		}

		return res
	},

	getScreenWidthImages: function(scale, min){
		scale = scale || this.scale()

		var W = this.viewer.width()
		var w = this.getVisibleImageSize(min ? 'min' : 'width', scale)

		return W/w
	},
	// XXX this does not account for ribbon spacing...
	getScreenHeightRibbons: function(scale){
		scale = scale || this.scale()

		var H = this.viewer.height()
		var h = this.getVisibleImageSize('height', scale)

		return H/h
	},

	// Make a "shadow" image for use with image oriented animations...
	//
	//	.makeShadow([<image>][, <animate>][, <delay>])
	//		-> <finalize>
	//
	// A shadow is a clone of <image> placed directly above it while it 
	// is hidden (transparent), calling <finalize> will remove the shadwo
	// and restore the original image, if <animate> is set then the shadow
	// will be moved to the image location, and <delay> sets the time delay
	// to provision for shadow animations.
	//
	// <finalize> is a function, that when called will remove the shadow
	// and restore image state.
	//
	// <image> is the target image to clone
	//
	// <animate> if is set, <finalize> will shift the shadow to target 
	// image offset before removing it (default: false).
	//
	// <delay> sets the delay before the shadow is removed and the target 
	// state is restored (default: 200).
	//
	//
	// NOTE: if a previous shadow if the same image exists this will recycle
	// 		the existing shadow and cancel it's removal.
	// 		...this is useful for when a second consecutive action with
	// 		the same image is issued before the previous has time to
	// 		complete, recycling the shadow will enable a single flowing 
	// 		animation for such series of commands.
	// 		Example: several fast consecutive horizontal shifts will result
	// 			in a single shadow "flowing" through the ribbon.
	// NOTE: multiple shadows of different images are supported...
	// NOTE: the .shadow element is essentially a ribbon.
	//
	// XXX should we also have a ribbon shadow???
	// XXX when this cant find a target it will return an empty function,
	// 		not sure if this is correct...
	// XXX should we use transforms instead of css positions???
	makeShadow: function(target, animate, delay){
		delay = delay || 200
		var img = this.getImage(target)

		if(img.length == 0){
			// XXX is this correct???
			return function(){}
		}

		var gid = this.getElemGID(img)
		var s = this.scale()
		var vo = this.viewer.offset()
		var io = img.offset()

		// get the shadow if it exists...
		var shadow = this.viewer.find('.shadow[gid="'+gid+'"]')

		// recycle the shadow...
		if(shadow.length > 0){
			// cancel previous shadow removal ticket...
			var ticket = shadow.attr('ticket') + 1
			shadow
				// reset ticket...
				// NOTE: this is a possible race condition... (XXX)
				.attr('ticket', ticket)
				// place it over the current image...
				.css({
					top: io.top - vo.top,
					left: io.left - vo.left,
				})

		// create a new shadow...
		} else {
			// removal ticket...
			var ticket = 0

			// make a shadow element...
			// ...we need to scale it to the current scale...
			var shadow = this.dom.setScale(
				$('<div>')
					.addClass('shadow ribbon clone')
					.attr({
						gid: gid,
						ticket: ticket,
					})
					.append(
						// clone the target into the shadow..
						img
							.clone()
							.addClass('clone')
							.removeClass('current')
							.attr('gid', null)),
					s)
				// place it over the current image...
				.css({
					top: io.top - vo.top,
					left: io.left - vo.left,
				})
				.append(this.getImageMarks(img)
						.clone()
						.attr('gid', null))
				// place in the viewer...
				// NOTE: placing the shadow in the viewer is a compromise that
				// 		lets us do simpler positioning 
				.appendTo(this.viewer)
		}

		img.addClass('moving')
		var that = this

		// function to clear the shadow...
		return function(){
			// remove only the item with the correct ticket...
			if(ticket == shadow.attr('ticket')){
				var s = that.scale()
				var img = that.getImage(gid)
				var vo = that.viewer.offset()
				var io = img.offset()
				if(animate){
					shadow.css({
						top: io.top - vo.top,
						left: io.left - vo.left,
					})
				}
				setTimeout(function(){
					// remove only the item with the correct ticket...
					if(ticket == shadow.attr('ticket')){
						img.removeClass('moving')
						shadow.remove()
					}
				}, delay)
			}
			return img
		}
	},


	// Contextual getters...
	
	// Get ribbon-set...
	//
	// 	Get ribbon set if it exists
	// 	.getRibbonSet()
	// 		-> ribbon-set
	//
	// 	Get ribbon set if it exists or create it if not
	// 	.getRibbonSet(true)
	// 		-> ribbon-set
	//
	getRibbonSet: function(create){
		var ribbon_set = this.viewer.find('.ribbon-set')
		if(ribbon_set.length == 0 && create){
			ribbon_set = $('<div/>')
				.addClass('ribbon-set')
				.appendTo(this.viewer)
		}
		return ribbon_set
	},

	// Get image...
	//
	// Get current image:
	//	.getImage()
	//	.getImage('current')
	//		-> image
	//
	// Get image by gid:
	//	.getImage(gid)
	//		-> image
	//
	// Get image at offset relative to current image:
	//	.getImage('next')
	//	.getImage('prev')
	//	.getImage(offset)
	//		-> image
	//
	// Get image at offset relative to image:
	//	.getImage(image, 'next')
	//	.getImage(image, 'prev')
	//	.getImage(image, offset)
	//		-> image
	//
	// Get images from list:
	//	.getImage($(..))
	//	.getImage([..])
	//		-> image(s)
	//		NOTE: this will filter the list but not search the tree...
	//
	getImage: function(target, offset){
		var img = null

		// relative to current -- target is offset...
		if(target == 'next' 
				|| target == 'prev' 
				|| typeof(target) == typeof(123)){
			offset = target
			target = 'current'
		}
		
		// get the base image...
		// current...
		if(target == null || target == 'current') {
			img = this.viewer.find('.current.image')

		// gid...
		} else if(typeof(target) == typeof('str')){
			//return this.viewer.find('.image[gid="'+JSON.stringify(target)+'"]')
			img = this.viewer.find('.image[gid='+JSON.stringify(target)+']')
		}

		// we got a collection...
		if(img == null){
			return $(target).filter(IMAGE)
		}

		// get the offset...
		if(offset != null && offset != 0){
			// relative keywords...
			offset = offset == 'next' ? 1
				: offset == 'prev' ? -1
				: offset
			var list = offset > 0 ? 'nextAll' : 'prevAll'
			offset = Math.abs(offset)-1
			var res = img[list](IMAGE)
			// handle overflow...
			res = res.eq(Math.min(offset, res.length-1))
			img = res.length == 0 ? img : res
		}

		return img
	},

	// Get image marks...
	//
	//	.getImageMarks(gid)
	//	.getImageMarks(image)
	//		-> marks
	//
	//	.getImageMarks(gid, cls)
	//	.getImageMarks(image, cls)
	//		-> marks
	//
	// XXX should this be here or in a marks plugin...
	getImageMarks: function(img, cls){
		img = img || this.getImage()
		gid = typeof(img) == typeof('str') ? img : null
		gid = gid == null ? this.getElemGID(img) : gid

		var marks = this.viewer.find('.mark[gid='+JSON.stringify(gid)+']')

		if(cls != null){
			return marks.filter('.'+cls)
		}
		return marks
	},

	// Get an image at a relative to viewer position...
	//
	//	Get central image in current ribbon:
	//	.getImageByPosition()
	//		-> image
	//
	//	Get central image closest to current:
	//	.getImageByPosition('current'[, <ribbon>])
	//		-> image
	//
	//	Get central image closest to html element:
	//	.getImageByPosition(<elem>[, <ribbon>])
	//		-> image
	//
	//	Get image in a specific ribbon:
	//	.getImageByPosition('left'[, <ribbon>])
	//	.getImageByPosition('center'[, <ribbon>])
	//	.getImageByPosition('right'[, <ribbon>])
	//		-> image
	//
	// This can return a pair of images when position is either 'center',
	// 'current' or a jquery object, this can happen when the two 
	// candidates are closer to the target than delta.
	//
	//
	// NOTE: if no ribbon is given, current ribbon is assumed.
	// NOTE: <ribbon> is the same as expected by .getRibbon(..)
	// NOTE: position can also be an image...
	// NOTE: delta is used ONLY if position is either 'center', 'current'
	// 		or an jQuery object...
	getImageByPosition: function(position, ribbon, delta){
		position = position || 'center'	
		ribbon = this.getRibbon(ribbon) 

		var viewer = this.viewer

		var W = viewer.outerWidth()
		var L = viewer.offset().left

		var target = position == 'current' ? this.getImage()
			: position == 'center' ? viewer
			: position == 'left' ? L
			: position == 'right' ? L + W
			: position

		// unknown keyword...
		if(target == null){
			return $()

		// center of an element...
		} else if(typeof(target) != typeof(123)){
			target = $(target)
			var w = target.hasClass('image') ? 
				this.getVisibleImageSize('width', null, target) : 
				target.outerWidth()
			// NOTE: we will need delta only in this branch, i.e. when
			// 		position is either 'current', 'center' or a jQuery 
			// 		object...
			delta = delta || w / 10
			target = target.offset().left + w/2
		}

		var that = this
		var res = ribbon.find(IMAGE)
			.toArray()
			.map(function(img){
				img = $(img)
				var l = img.offset().left
				var w = that.getVisibleImageSize('width', null, img)

				// skip images not fully shown in viewer...
				// NOTE: we explicitly leave partial images here so as to
				// 		include at least two.
				// 		This is done so as to include at least a couple 
				// 		of images at large magnifications when nothing 
				// 		other than the current image fully fit...
				if(L > l+w || l > L+W){
					return
				}

				// distance between centers...
				if(position == 'center' || position == 'current'){
					return [target - (l + w/2), img]

				// distance between left edges...
				} else if(position == 'left'){
					return [target - l, img]

				// distance between right edges...
				} else {
					return [target - (l + w), img]
				}
			})
			// drop images outside the viewer...
			.filter(function(e){ return e != null })
			// sort images by distance...
			.sort(function(a, b){ return Math.abs(a[0]) - Math.abs(b[0]) })

		var a = res[0] ? res[0][0] : null
		var b = res[1] ? res[1][0] : null

		// we have two images that are about the same distance from 
		// target...
		// NOTE: this is a one-dimentional filter so there can not be 
		// 		more than two hits...
		// NOTE: delta is used ONLY if position is either 'center', 
		// 		'current' or an jQuery object...
		if(b && (a >= 0) != (b >= 0) && Math.abs(a + b) < delta){
			return $([res[0][1][0], res[1][1][0]])

		// a single hit...
		} else {
			// NOTE: if no image is on screen this will get nothing...
			return res[0] ? res[0][1] : null
		}
	},

	// Get ribbon...
	//
	// Get current ribbon:
	//	.getRibbon()
	//	.getRibbon('current')
	//		-> ribbon
	//
	// Get base ribbon:
	//	.getRibbon('base')
	//		-> ribbon
	//
	// Get ribbon by its index/gid:
	//	.getRibbon(index)
	//	.getRibbon(gid)
	//		-> ribbon
	//
	// Get ribbon by image:
	//	.getRibbon(image)
	//		-> ribbon
	//		NOTE: image must be .getImage(..) compatible.
	//
	// Get ribbons from list:
	//	.getRibbon($(..))
	//	.getRibbon([..])
	//		-> ribbon(s)
	//		NOTE: this will filter the list but not search the tree...
	//
	//
	// NOTE: if current image is unset then this will not be able to 
	// 		get it.
	// NOTE: if base ribbon is unset this will return the first ribbon.
	getRibbon: function(target){
		// current...
		if(target == null || target == 'current') {
			return this.getImage().parents('.ribbon').first()

		// dom element...
		} else if(target instanceof $
				&& target.hasClass('image')){
			return this.getImage(target).parents('.ribbon').first()

		// base...
		} else if(target == 'base'){
			var r = this.viewer.find('.base.ribbon').first()
			if(r.length == 0){
				return this.viewer.find(RIBBON).first()
			}
			return r

		// index...
		} else if(typeof(target) == typeof(123)){
			return this.viewer.find(RIBBON).eq(target)

		// gid...
		} else if(typeof(target) == typeof('str')){
			//return this.viewer.find('.ribbon[gid="'+JSON.stringify(target)+'"]')
			var r = this.viewer.find('.ribbon[gid='+JSON.stringify(target)+']')
			// if no ribbon is found, try and get an image and it's ribbon...
			return r.length == 0 
				? this.getImage(target).parents('.ribbon').first()
				: r
		}
		return $(target).filter(RIBBON)
	},
	// Like .getRibbon(..) but returns ribbon index instead of the actual 
	// ribbon object...
	getRibbonOrder: function(target){
		return this.viewer.find(RIBBON).index(this.getRibbon(target))
	},


	// Basic manipulation...

	// Place a ribbon...
	//
	// Append target ribbon:
	//	.placeRibbon(target)
	//		-> ribbon
	//
	// Place target ribbon at position:
	//	.placeRibbon(target, index)
	//	.placeRibbon(target, ribbon-gid)
	//	.placeRibbon(target, ribbon)
	//		-> ribbon
	//
	// The ribbon will be placed at the new position shifting the next 
	// ribbon(s), if present, by one.
	//
	// Indexes if used, can be negative. Negative indexes are relative 
	// to the end, e.g. -1 is the same as length-1.
	// Placing an element at a negative index will place it AFTER the 
	// target element, this is in contrast to positive indexes where an
	// element is placed before the target. In both of the above cases
	// (positive and negative indexes) the resulting target position 
	// will AT the passed position.
	//
	// NOTE: negative and positive indexes overflow to 0 and length
	// 		respectively.
	// NOTE: both target and position must be .getRibbon(..) compatible.
	// NOTE: if target ribbon does not exist a new ribbon will be created.
	// NOTE: if position ribbon (gid,ribbon) does not exist or is not 
	// 		attached then the target will be appended to the end.
	// NOTE: this uses the DOM data for placement, this may differ from 
	// 		the actual data.
	placeRibbon: function(target, position){
		// get create the ribbon...
		var ribbon = this.getRibbon(target)
		var i = this.getRibbonOrder(ribbon)
		ribbon = ribbon.length == 0 ? this.createRibbon(target) : ribbon
		var ribbon_set = this.getRibbonSet(true) 

		var ribbons = this.viewer.find(RIBBON)

		// normalize the position...
		if(typeof(position) == typeof(123)){
			position = position < 0 ? ribbons.length + position + 1 : position
			position = position < 0 ? 0 : position
		} else {
			position = this.getRibbonOrder(position)
			// XXX what do we do if the target does not exist, i.e. p == -1 ????
		}

		if(i == position){
			return ribbon
		}

		// place the ribbon...
		if(ribbons.length == 0 || ribbons.length <= position){
			ribbon_set.append(ribbon)

		} else if(i == -1 || i > position) {
			ribbons.eq(position).before(ribbon)

		// for placing after need to account for target ribbon removal...
		} else if(i < position) {
			ribbons.eq(position).after(ribbon)
		}

		// XXX do we need to update the ribbon here???
		return ribbon
	},

	// Place an image...
	//
	// Place target at at offset from current position:
	//	.placeImage(target, offset)
	//		-> image
	//
	// Place target at image position:
	//	.placeImage(target, image)
	//	.placeImage(target, image, 'before')
	//	.placeImage(target, image, 'after')
	//		-> image
	//
	// Place target at ribbon start/end:
	//	.placeImage(target, ribbon)
	//	.placeImage(target, ribbon, 'before')
	//	.placeImage(target, ribbon, 'after')
	//		-> image
	//
	// NOTE: mode defaults to 'before'.
	// NOTE: if image gid does not exist it will be created.
	// NOTE: if target is a list of gids, this will place the gids in 
	// 		the same order as given, not as they were before placing...
	//
	// XXX is this too complicated???
	placeImage: function(target, to, mode){
		mode = mode == null ? 'before' : mode

		if(this.getRibbonSet().length == 0){
			return
		}

		target = target == null || target.constructor !== Array ? [target] : target

		// get or make images...
		var that = this
		var img = $($(target)
			.map(function(_, e){
				var i = that.getImage(e)
				return (i.length == 0 ? that.createImage(e) : i)[0]
			}))
	
		var i = this.getImage(to)
		var r = this.getRibbon(to)

		// offset on same ribbon...
		if(typeof(to) == typeof(123)){
			// moving the image to itself...
			if(to == 0){
				return img
			}
			var i = to
			var images = img[i > 0 ? 'last' : 'first']()
				[i > 0 ? 'nextAll' : 'prevAll'](IMAGE)
			to = images.length > 0 
				? images.eq(Math.min(Math.abs(i), images.length)-1) 
				: img

		// append/prepend to ribbon...
		} else if(i.length == 0 && r.length > 0 && r.hasClass('ribbon')){
			if(mode == 'before'){
				r.append(img)
			} else {
				r.prepend(img)
			}
			return this.updateImage(img)

		// relative to image...
		} else {
			var i = mode == 'before' ? -1 : 1
			to = this.getImage(to)
			// moving the image to itself...
			if(to[0] == img[0]){
				return img
			}
			var images = to[mode](IMAGE)
		}

		// place the image...
		if(images.length <= i){
			to.parents('.ribbon')
				.append(img)
		// after...
		} else if(i > 0){
			// XXX this stumbles on non-images...
			//to.next(IMAGE)
			// XXX is this fast enough??
			to.nextAll(IMAGE).first()
				.before(img)
		// before...
		} else {
			to
				.before(img)
		}

		// cleanup source ribbons...
		this.clearEmptyRibbons()

		return this.updateImage(img)
	},


	// Loading and updating...

	// Replace image gid...
	//
	// XXX should this work for ribbon gids???
	replaceGid: function(from, to){
		var img = this.getImage(from)

		img && img.length > 0 
			&& this.setElemGID(img, to)

		return this
	},

	// XXX is .__image_updaters the right way to go???
	updateImageIndicators: function(gid, image){
		gid = gid == null ? this.getElemGID() : gid
		image = image == null ? this.getImage() : $(image)

		// collect marks...
		image.after(this.getImageMarks(gid))


		if(this.__image_updaters != null){
			this.__image_updaters.forEach(function(update){
				update(gid, image)
			})
		}

		return image
	},

	_loadImagePreviewURL: function(image, url){
		url = util.path2url(url)
		// pre-cache and load image...
		// NOTE: this will make images load without a blackout...
		var img = new Image()
		img.onload = function(){
			var i = image[0]
			i.style.backgroundImage = 'url("'+ url +'")',

			// NOTE: these do not account for rotation...
			i.setAttribute('preview-width', img.width)
			i.setAttribute('preview-height', img.height)
		}
		img.src = url
		return img
	},

	// Update image(s)...
	//
	// Update current image:
	//	.updateImage()
	//		-> image
	//
	// Update specific image:
	//	.updateImage(gid)
	//	.updateImage(image)
	//		-> image
	//
	// Update all image:
	//	.updateImage('*')
	//		-> image
	//
	// NOTE: this can update collections of images by passing either a 
	// 		list of gids, images or a jQuery collection...
	//
	// If this is set to true image previews will be loaded synchronously...
	load_img_sync: false,
	//
	// XXX this depends on .images...
	// 		...a good candidate to move to images, but not yet sure...
	updateImage: function(image, gid, size, sync){
		image = (image == '*' ? this.viewer.find(IMAGE)
			: image == null 
				|| typeof(image) == typeof('str') ? this.getImage(image)
			: $(image))
		var lst = image.toArray()
		sync = sync == null ? this.load_img_sync : sync
		size = size == null ? this.getVisibleImageSize('max') : size

		var that = this
		return $(image.map(function(){
			var image = this instanceof String 
					|| typeof(this) == typeof('str') 
				? that.getImage(this+'') 
				: $(this)
			if(image.length == 0){
				return
			}
			var old_gid = that.getElemGID(image)

			// same image -- update...
			if(old_gid == gid || gid == null){
				var gid = old_gid

			// reuse for different image -- reconstruct...
			} else {
				// remove old marks...
				if(typeof(old_gid) == typeof('str')){
					that.getImageMarks(old_gid).remove()
				}
				// reset gid...
				image
					.attr('gid', JSON.stringify(gid)
						// this removes the extra quots...
						.replace(/^"(.*)"$/g, '$1'))
					.css({
						// clear the old preview...
						'background-image': '',
					})
			}

			// if not images data defined drop out...
			if(that.images == null){
				return image[0]
			}

			// get the image data...
			var img_data = that.images[gid]
			if(img_data == null){
				img_data = images.IMAGE_DATA
			}

			// if we are a group, get the cover...
			// NOTE: groups can be nested...
			var seen = []
			while(img_data.type == 'group'){
				// error, recursive group...
				if(seen.indexOf(img_data.id) >= 0){
					img_data = images.IMAGE_DATA
					console.error('Recursive group:', gid)
					break
				}
				seen.push(img_data.id)

				img_data = that.images[img_data.cover]
			}

			// image state...
			that.rotateImage(image, img_data.orientation == null ? 0 : img_data.orientation)
			that.flipImage(image, img_data.flipped == null ? [] : img_data.flipped)

			// preview...
			var p_url = that.images.getBestPreview(img_data.id, size, img_data, true).url

			// update the preview if it's a new image or...
			// XXX this should be pushed as far back as possible...
			if(old_gid != gid 
					// the new preview (p_url) is different to current...
					// NOTE: this may not work correctly for relative urls...
					//|| image.css('background-image').indexOf(encodeURI(p_url)) < 0){
					|| image.css('background-image').indexOf(util.path2url(p_url)) < 0){
				// sync load...
				if(sync){
					that._loadImagePreviewURL(image, p_url)

				// async load...
				} else {
					// NOTE: storing the url in .data() makes the image load the 
					// 		last requested preview and in a case when we manage to 
					// 		call updateImage(...) on the same element multiple times 
					// 		before the previews get loaded...
					// 		...setting the data().loading is sync while loading an 
					// 		image is not, and if several loads are done in sequence
					// 		there is no guarantee that they will happen in the same
					// 		order as requested...
					image.data().loading = p_url
					setTimeout(function(){ 
						that._loadImagePreviewURL(image, image.data().loading)
					}, 0)
				}
			}

			// NOTE: this only has effect on non-square image blocks...
			// XXX this needs the loaded image, thus should be done right after preview loading...
			that.correctImageProportionsForRotation(image)

			// marks and other indicators...
			that.updateImageIndicators(gid, image)

			return image[0]
		}))
	},

	// Update ribbon content...
	//
	// This will reuse the images that already exist, thus if updating or
	// adding images to an already loaded set this should be very fast.
	//
	// If reference is given then this will compensate ribbon offset to
	// keep the reference image in the same position (XXX ???) 
	//
	// gids must be a list of gids.
	//
	// ribbons must be .getRibbon(..) compatible.
	//
	// reference must be .getImage(..) compatible or null to disable 
	// offset compensation.
	//
	// NOTE: this will change ribbon size and compensate for it, but this 
	// 		will not disable transitions, which at this point is the 
	// 		responsibility of the caller...
	// NOTE: offset calculation depends on image blocks being square...
	// NOTE: the argument force is currently ignored, it serves as a 
	// 		place holder for overloading...
	//
	// XXX this depends on image size being fixed for compensating 
	// 		position shift...
	// 		...a simpler way to go is to check .position().left of the 
	// 		reference image before and after the chage and add the delta
	// 		to the offset...
	// XXX make this add images in chunks of adjacent images...
	// XXX might be a good idea to do the actual adding in requestAnimationFrame(..)
	updateRibbon: function(gids, ribbon, reference, force){
		var that = this
		var place = false
		// get/create the ribbon...
		var r = this.getRibbon(ribbon)

		if(r.length == 0){
			place = true
			// no such ribbon exists, then create and append it in the end...
			// NOTE: this effectively makes the update offline and pushes
			// 		the new ribbon on the dom in one go...
			r = this.createRibbon(ribbon)
		}

		var loaded = r.find(IMAGE)

		// compensate for new/removed images...
		if(reference != null){
			var ref = this.getImage(reference)

			// align only if ref is loaded...
			if(ref.length > 0){
				var gid = this.getElemGID(ref)
				var w = this.getVisibleImageSize('width', 1, ref)

				// calculate offset...
				// NOTE: this will not work for non-square images...
				var dl = loaded.index(ref) - gids.indexOf(gid)

				if(dl != 0){
					this.dom.setOffset(r, this.dom.getOffset(r).left + dl * w)
				}
			}
		}

		// remove all images that we do not need...
		var unloaded = []
		var unload_marks = []
		loaded = loaded
			.filter(function(i, img){ 
				var g = that.getElemGID(img)
				if(gids.indexOf(g) >= 0){
					return true
				}
				unloaded.push(img)
				unload_marks = unload_marks.concat(that.getImageMarks(g).toArray())
				return false
			})

		// detach/remove everything in one go...
		$(unloaded)
			.detach()
			.removeClass('moving current')
			// blank out images to prevent wrong image flashing...
			.css('background-image', 'none')
		// clear marks...
		$(unload_marks)
			.remove()

		$(gids).each(function(i, gid){
			// support for sparse ribbons...
			if(gid == null){
				return 
			}
			// get/create image...
			// NOTE: as this will get a loaded image if it's loaded in 
			// 		a different ribbon this WILL affect that ribbon...
			var img = that.getImage(gid)
			if(img.length == 0){
				img = unloaded.length > 0 
					// reuse an image we just detached...
					? that.setElemGID(unloaded.pop(), gid) 
					// create a new image...
					: that.createImage(gid)
			}

			// see of we are loaded in the right position...
			// NOTE: loaded is maintained current later, thus it always 
			// 		contains a set of images representative of the ribbon...
			var g = loaded.length > i ? that.getElemGID(loaded.eq(i)) : null

			// check if we need to reattach the image...
			if(gid != g){
				// append the image to set...
				if(loaded.length == 0 || loaded.length <= i){
					r.append(img.detach())

				// attach the image at i...
				} else {
					// update the DOM...
					loaded.eq(i).before(img.detach())

					// update the loaded list...
					var l = loaded.index(img)
					if(l >= 0){
						loaded.splice(l, 1)
					}
					loaded.splice(i, 0, img)
				}
			}

			that.updateImage(img)
		})

		if(place){
			this.placeRibbon(r, this.viewer.find(RIBBON).length)
		}

		return this
	},

	// Resize ribbon...
	//
	// 	.resizeRibbon(ribbon, left, right)
	// 		-> ribbons
	//
	// left/right can be:
	// 	- negative number		- the number of images to trim
	// 	- list of gids			- the images to add
	//
	// NOTE: this is a less general but simpler/faster alternative to 
	// 		.updateRibbon(..)
	// NOTE: this needs the ribbon to exist...
	resizeRibbon: function(ribbon, left, right, transitions, reference){
		ribbon = this.getRibbon(ribbon)
		left = left || 0
		right = right || 0
		reference = this.getImage(reference)
		//scale = scale || this.scale()

		var w = this.getVisibleImageSize('width', 1, reference)

		var that = this

		var images = ribbon.find(IMAGE)
		var unloaded = $()

		// trim right...
		if(right < 0){
			var marks = []
			var unloaded = images.slice(images.length + right)
				// remove marks...
				.each(function(_, img){
					marks = marks.concat(
						that.getImageMarks(that.getElemGID(img)).toArray())
				})
				
			// clear stuff...
			$(marks)
				.remove()
			unloaded
				.detach()
				.removeClass('moving current')
				// blank out images to prevent wrong image flashing 
				// when reusing...
				.css('background-image', 'none')
		} 

		// trim left...
		// NOTE: this affects ribbon placement, thus we'll need to compensate...
		if(left < 0){
			var marks = []
			// NOTE: we do not need to append or conserve previous unloaded
			// 		images as we will need them only if we are trimming from 
			// 		one side and growing the other...
			var unloaded = images.slice(0, -left)
				// remove marks...
				.each(function(_, img){
					marks = marks.concat(
						that.getImageMarks(that.getElemGID(img)).toArray())
				})

			// calculate the compensation...
			// XXX this assumes that all widths are equal...
			// 		...we can't calculate image width unless it is attached...
			//var l = -left * (reference.outerWidth() / scale)
			var l = -left * w 

			// clear stuff...
			$(marks)
				.remove()

			requestAnimationFrame(function(){
				transitions || that.preventTransitions(ribbon)

				unloaded
					.detach()
					.removeClass('moving current')
					// blank out images to prevent wrong image flashing 
					// when reusing...
					.css('background-image', 'none')
				// compensate for the offset...
				that.dom.setOffset(ribbon, that.dom.getOffset(ribbon).left + l)

				transitions || that.restoreTransitions(ribbon, true)
			})
		}

		// grow right...
		if(right.length > 0 || right > 0){
			var c = right.length || right

			// build set of empty images...
			var loading = unloaded.slice(0, c)
			while(loading.length < c){
				loading.push(that.createImage([''])[0])
			}

			// update images...
			right instanceof Array && right.forEach(function(gid, i){
				var img = loading.eq(i)
				that.setElemGID(img, gid) 
				// XXX for some reason this does not add indicators...
				that.updateImage(img)
			})

			ribbon.append(loading)

			// XXX this is here to update the indicators...
			// 		...indicators seem to not be attached above...
			loading.each(function(_, img){
				that.updateImage(img)
			})
		}

		// grow left...
		// NOTE: this affects ribbon placement, thus we'll need to compensate...
		if(left.length > 0 || left > 0){
			var c = left.length || left

			// build set of empty images...
			var loading = unloaded.slice(0, c)
			while(loading.length < c){
				loading.push(that.createImage([''])[0])
			}

			// update images...
			left instanceof Array && left.forEach(function(gid, i){
				var img = loading.eq(i)
				that.setElemGID(img, gid) 
				// XXX for some reason this does not add indicators...
				that.updateImage(img)
			})

			// calculate the compensation...
			// XXX this assumes that all widths are equal...
			// 		...we can't calculate image with unless it is attached...
			//var l = c * (reference.outerWidth() / scale)
			var l = c * w 

			requestAnimationFrame(function(){
				transitions || that.preventTransitions(ribbon)

				ribbon.prepend(loading)

				// XXX this is here to update the indicators...
				// 		...indicators seem to not be attached above...
				loading.each(function(_, img){
					that.updateImage(img)
				})

				// compensate for the offset...
				that.dom.setOffset(ribbon, that.dom.getOffset(ribbon).left - l)

				transitions || that.restoreTransitions(ribbon, true)
			})
		}

		return this
	},

	// Update the data in ribbons...
	//
	// 	.updateData(data, settings)
	// 		-> ribbons
	//
	//
	// This uses .updateRibbon(..) to load individual ribbons, for
	// more info see docs for that.
	//
	// This uses data.ribbon_order to place the ribbons and data.ribbons
	// to place the images.
	//
	// This uses data.base and data.current to set the base ribbon and 
	// current image respectively.
	//
	// All the data fields are optional, but for this to make a change 
	// at least one must be present.
	//
	//
	// Settings format:
	// 	{
	// 		// if true keep the unchanged ribbons (default: false)
	// 		// NOTE: untouched ribbons are the ones loaded into DOM but
	// 		//		not included in any of:
	// 		//			- data.ribbon_order
	// 		//			- data.ribbons
	// 		//			- data.base
	// 		keep_ribbons: bool,
	//
	// 		// if true do not update the base ribbon (default: false)
	// 		keep_base: bool,
	//
	// 		// if true do not update the current image (default: false)
	// 		keep_current: bool,
	//
	//
	//		// a shorthand setting all the above to true (default: false).
	//		// NOTE: if this is set to true all other settings will be 
	//		//		ignored...
	// 		keep_all: bool,
	// 	}
	//
	// NOTE: this will not clear the ribbons object explicitly.
	// NOTE: this will never remove the ribbons included in any of the
	// 		data.base, data.ribbon_order or data.ribbons...
	updateData: function(data, settings){
		settings = settings == null ? {} : settings
		// load the data...
		var that = this

		// update ribbons -- place images...
		if(data.ribbons != null){
			// see if we've got a custom ribbon updater...
			var updateRibbon = settings.updateRibbon || this.updateRibbon.bind(this)

			Object.keys(data.ribbons).forEach(function(gid){
				updateRibbon(data.ribbons[gid], gid)
			})
		}

		// place ribbons...
		if(data.ribbon_order != null){
			data.ribbon_order.forEach(function(gid, i){
				that.placeRibbon(gid, i)
			})
		}

		if(!settings.keep_all){
			// set base ribbon...
			if(!settings.keep_base && data.base != null){
				this.setBaseRibbon(data.base)
			}

			// set base ribbon...
			if(!settings.keep_current && data.current != null){
				this.focusImage(data.current)
			}

			// clear the ribbons that did not get updated...
			if(!settings.keep_ribbons 
					&& (data.ribbon_order != null || data.ribbons != null)){
				var ribbons = data.ribbon_order != null ? data.ribbon_order.slice() 
					: data.ribbons != null ? Object.keys(data.ribbons)
					: []

				that.viewer.find(RIBBON).each(function(){
					var r = $(this)
					if(ribbons.indexOf(that.getElemGID(r)) < 0){
						r.remove()
					}
				})
			}
		}

		return this
	},

	clearEmptyRibbons: function(){
		this.viewer.find(RIBBON).filter(function(_, e){
			return $(e).children().length == 0 
		}).remove()
		return this
	},

	// Clear elements...
	//
	// Clear all elements:
	// 	.clear()
	// 	.clear('*')
	// 		-> Ribbons
	//
	// Clear an image or a ribbon by gid:
	// 	.clear(gid)
	// 		-> Ribbons
	//
	// Clear a set of elements:
	// 	.clear([gid, ...])
	// 		-> Ribbons
	//
	// Clear ribbon-set -- full rest:
	// 	.clear('full')
	// 		-> Ribbons
	// 		NOTE: this will lose any state stored in the ribbon set, this
	// 			includes vertical align and scaling...
	//
	//
	// NOTE: another way to remove a ribbon or an image just to use 
	// 		.getRibbon(..).remove() and .getImage(...).remove() respectivly.
	clear: function(gids){
		if(gids == 'full'){
			this.getRibbonSet().remove()

		// clear all...
		} else if(gids == null || gids == '*'){
			this.preventTransitions()
			this.dom.setOffset(this.getRibbonSet(), 0, 0).children().detach()
			this.restoreTransitions()

		// clear one or more gids...
		} else {
			gids = gids.constructor !== Array ? [gids] : gids
			var that = this
			gids.forEach(function(g){
				that.viewer.find('[gid='+JSON.stringify(g)+']').detach()
			})
		}
		return this
	},


	// Focus image...
	//
	// Focus image by gid:
	//	.focusImage(gid)
	//		-> image
	//
	// Focus next/prev image relative to current:
	//	.focusImage('next')
	//	.focusImage('prev')
	//		-> image
	//
	// Focus image at offset from current:
	//	.focusImage(offset)
	//		-> image
	//
	// NOTE: gid must be a .getImage(..) compatible object.
	// NOTE: for keyword and offset to work an image must be focused.
	// NOTE: overflowing offset will focus first/last image.
	focusImage: function(target){
		var cur = this.viewer
			.find('.current.image')
		var next = this.getImage(target)

		cur.removeClass('current')
		return next.addClass('current')
	},

	// Set base ribbon...
	//
	// XXX is this really needed here???
	// XXX should this support keywords a-la .focusImage(..)???
	setBaseRibbon: function(gid){
		this.viewer.find('.base.ribbon').removeClass('base')
		return this.getRibbon(gid).addClass('base')
	},


	// Image manipulation...

	// Toggle image mark...
	//
	// Toggle current image cls mark:
	// 	.toggleImageMark(cls)
	// 	.toggleImageMark(cls, 'toggle')
	// 		-> mark
	//
	// Set current image cls mark on or off explicitly:
	// 	.toggleImageMark(cls, 'on')
	// 	.toggleImageMark(cls, 'off')
	// 		-> mark
	//
	// Toggle image cls mark:
	// 	.toggleImageMark(image, cls)
	// 	.toggleImageMark(image, cls, 'toggle')
	// 		-> mark
	//
	// Set image cls mark on or off explicitly:
	// 	.toggleImageMark(image, cls, 'on')
	// 	.toggleImageMark(image, cls, 'off')
	// 		-> mark
	//
	// Get image cls mark state:
	// 	.toggleImageMark(cls, '?')
	// 	.toggleImageMark(image, cls, '?')
	// 		-> 'on'
	// 		-> 'off'
	// 		NOTE: this will only test the first image.
	//
	//
	// NOTE: cls can be a list...
	// NOTE: this can operate on multiple images...
	// NOTE: this will reuse existing marks...
	toggleImageMark: function(image, cls, action){
		var that = this
		if(cls == null || ['toggle', 'on', 'off', '?'].indexOf(cls) >= 0 ){
			action = cls
			cls = image
			image = null
		}
		image = this.getImage(image) 
		cls = cls.constructor !== Array ? [cls] : cls
		action = action == null ? 'toggle' : action

		// no image is loaded...
		if(image.length == 0){
			return
		}

		// get marked state...
		if(action == '?'){
			var gid = this.getElemGID(image)
			var res = 0
			cls.forEach(function(cls){
				res += that.getImageMarks(gid, cls).length != 0 ? 1 : 0
			})
			return res == cls.length ? 'on' : 'off'
		}

		// set the marks...
		image.each(function(){
			var image = $(this)
			var gid = that.getElemGID(image)
			cls.forEach(function(cls){
				var mark = that.getImageMarks(gid, cls)

				// set the mark...
				if(mark.length == 0 
						&& (action == 'toggle' 
							|| action == 'on')){
					that.createMark(cls, gid)
						.insertAfter(image)

				// clear the mark...
				} else if(action != 'on') {
					mark.remove()
				}
			})
		})

		return image
	},

	// Get image rotation...
	//
	getImageRotation: function(target){
		return (this.getImage(target).attr('orientation') || 0)*1
	},
	// Rotate an image...
	//
	// Rotate image clockwise:
	//	.rotateImage(target, 'cw')
	//		-> image
	//
	// Rotate image counterclockwise:
	//	.rotateImage(target, 'ccw')
	//		-> image
	//
	// Set explicit image rotation angle:
	//	.rotateImage(target, 0|90|180|270)
	//	.rotateImage(target, -90|-180|-270)
	//		-> image
	//
	// NOTE: target must be .getImage(..) compatible.
	// NOTE: this can be applied in bulk, e.g. 
	// 		this.rotateImage($('.image'), 'cw') will rotate all the 
	// 		loaded images clockwise.
	rotateImage: function(target, direction){
		target = target == null || target.constructor !== Array ? [target] : target

		// validate direction...
		if(images.calcRelativeRotation(direction) == null){
			return target
		}

		var that = this
		$(target).each(function(i, e){
			var img = that.getImage(e)
			var o = (direction == 'cw' || direction == 'ccw')
				? images.calcRelativeRotation(img.attr('orientation'), direction)
				: direction*1
			if(o == 0){
				img.removeAttr('orientation')
			} else {
				img.attr('orientation', o)
			}
			// account for proportions...
			that.correctImageProportionsForRotation(img)
			// XXX this is a bit of an overkill but it will update the 
			// 		preview if needed...
			//that.updateImage(img)
		})

		return this
	},

	// Get image flip...
	//
	getImageFlip: function(target){
		return (this.getImage(target).attr('flipped') || '')
			.split(',')
			.map(function(e){ return e.trim() })
			.filter(function(e){ return e != '' })
	},
	// Flip an image...
	//
	// Flip image relative to view:
	// 	.flipImage(target, 'horizontal')
	// 	.flipImage(target, 'vertical')
	// 	.flipImage(target, 'horizontal', 'view')
	// 	.flipImage(target, 'vertical', 'view')
	// 		-> image
	//
	// Flip image relative to image:
	// 	.flipImage(target, 'horizontal', 'image')
	// 	.flipImage(target, 'vertical', 'image')
	// 		-> image
	//
	// Set an explicit state:
	// 	.flipImage(target, [ .. ])
	// 		-> image
	//
	// NOTE: target must be .getImage(..) compatible.
	// NOTE: this can be applied in bulk, e.g. 
	// 		this.flipImage($('.image'), 'vertical') will rotate all the 
	// 		loaded images vertically.
	// NOTE: this is relative to how the image is viewed and not to 
	// 		it's original orientation by default...
	// 		...this makes things consistent both visually and internally
	flipImage: function(target, direction, reference){
		reference = reference || 'view'
		target = target == null || target.constructor !== Array ? [target] : target

		var set_state = direction.constructor === Array ? direction : null

		var that = this
		$(target).each(function(i, e){
			var img = that.getImage(e)

			// update existing state...
			if(set_state == null){
				var d = direction
				if(reference == 'view' && [90, 270].indexOf(that.getImageRotation(img)) > -1){
					d = direction == 'vertical' ? 'horizontal' : 'vertical'
				}
				var state = img.attr('flipped')
				state = (state == null ? '' : state)
					.split(',')
					.map(function(e){ return e.trim() })
					.filter(function(e){ return e != '' })
				// toggle the specific state...
				var i = state.indexOf(d)
				if(i >= 0){
					state.splice(i, 1)
				} else {
					state.push(d)
				}

			// set an explicit state...
			} else {
				var state = set_state.slice()
			}

			// write the state...
			if(state.length == 0){
				img.removeAttr('flipped')
			} else {
				img.attr('flipped', state.join(', '))
			}
		})

		return this
	},

	// shorthands...
	// XXX should these be here???
	rotateCW: function(target){ return this.rotateImage(target, 'cw') },
	rotateCCW: function(target){ return this.rotateImage(target, 'ccw') },
	flipVertical: function(target, reference){
		return this.flipImage(target, 'vertical', reference) },
	flipHorizontal: function(target, reference){ 
		return this.flipImage(target, 'horizontal', reference) },


	// UI manipulation...
	
	// Compensate for viewer proportioned and rotated images.
	//
	// This will set the margins so as to make the rotated image offset the
	// same space as it is occupying visually...
	//
	// NOTE: this is not needed for square image blocks.
	// NOTE: if an image block is square, this will remove the margins.
	correctImageProportionsForRotation: function(images){
		// XXX
		var W = this.viewer.innerWidth()
		var H = this.viewer.innerHeight()

		var images = images || this.viewer.find(IMAGE)

		var viewer_p = W > H ? 'landscape' : 'portrait'

		var scale = this.scale()

		return $(images).each(function(i, e){
			var image = $(this)
			// orientation...
			var o = image.attr('orientation')
			o = o == null ? 0 : o
			var w = image.outerWidth() / scale
			var h = image.outerHeight() / scale

			// non-square image...
			if(w != h){

				var image_p = w > h ? 'landscape' : 'portrait'

				// when the image is turned 90deg/270deg and its 
				// proportions are the same as the screen...
				if((o == 90 || o == 270) && image_p == viewer_p){
					image.css({
						width: h,
						height: w,

						margin: -((w - h)/2) +'px '+ (w - h)/2 + 'px'
					})

				} else if((o == 0 || o == 180) && image_p != viewer_p){
					image.css({
						//width: h,
						//height: w,
						width: '',
						height: '',

						margin: '',
					})
				}

			// square image...
			} else {
				image.css({
					width: '',
					height: '',

					margin: '',
				})
			}
		})
	},

	// center a ribbon vertically...
	// 
	// XXX offset and scale are not used...
	// XXX custom align point woud also be nice... 
	// 		(top, bottom, center, %, px)
	// XXX need to account for margins...
	centerRibbon: function(target, offset, scale){
		target = this.getImage(target)
		scale = scale || this.scale()
		var ribbon_set = this.getRibbonSet() 

		if(ribbon_set.length == 0 || target.length == 0){
			return this
		}

		//this.origin(target)
		
		var ro = ribbon_set.offset().top
		// NOTE: this appears to account for margins...
		var io = target.offset().top 
		var h = target.outerHeight() / scale 
			+ parseFloat(target.css('margin-top'))
			+ parseFloat(target.css('margin-bottom'))

		var t = (io - ro)/scale + h/2

		var offset = this.dom.relativeOffset(this.viewer, ribbon_set, {
			top: t,
			left: 0,
		}).top
		
		this.dom.setOffset(ribbon_set, 0, offset)

		return this
	},

	// center an image horizontally...
	// 
	// XXX offset is not used...
	// XXX custom align point would also be nice... 
	// 		(top, bottom, center, %, px)
	// XXX need to account for margins...
	centerImage: function(target, mode, offset, scale){
		target = this.getImage(target)
		scale = scale || this.scale()
		var ribbon = this.getRibbon(target)

		if(ribbon.length == 0){
			return this
		}

		var rl = ribbon.offset().left
		// NOTE: this appears to account for margins...
		var il = target.offset().left 
		var W = this.viewer.width() * scale
		var w = (target.outerWidth() / scale
			+ parseFloat(target.css('margin-left'))
			+ parseFloat(target.css('margin-right'))) * scale

		var image_offset = mode == 'before' ? w/2
			: mode == 'after' ? -w/2
			: 0

		this.dom.setOffset(ribbon, ((rl + ((W-w)/2 + image_offset) - il) / scale))

		return this
	},

	// Fit image to view...
	//
	// If n is given this will fit n images (default: 1)
	//
	// NOTE: this will never scale the view in a wat that an image 
	// 		overflows either in height nor width.
	//
	// XXX might be useful to set origin before scaling...
	fitImage: function(n, min){
		n = n || 1

		// NOTE: this is width oriented...
		var scale = this.getScreenWidthImages(1, min) / n

		// check bounds...
		var H = this.viewer.height()
		var h = this.getVisibleImageSize('height', 1)

		// n images will be higher than the viewer, adjust for height...
		if(h*scale >= H){
			scale = H/h 
		}

		this
			.scale(scale)
			//.centerRibbon(null, null, scale)
			//.centerImage(null, null, null, scale)
		
		return this
	},
	// NOTE: if fit_whole_images is true (default) this will fit a discrete
	// 		number of images in width...
	// XXX this does not account for ribbon spacing...
	fitRibbon: function(n, fit_whole_images){
		n = n || 1
		fit_whole_images = fit_whole_images == null ? true : false

		var scale = this.getScreenHeightRibbons(1) / n

		var w = this.getVisibleImageSize('width', 1)
		var W = this.viewer.width()

		// n ribbons will be wider than the viewer...
		if(w*scale >= W){
			scale = W/w
		}

		// shift the scale to the point where screen width is a whole 
		// number of images...
		if(fit_whole_images){
			var d = this.getScreenWidthImages(scale)
			d = d / Math.ceil(d)

			scale *= d
		}

		this.scale(scale)

		return this
	},


	setEmptyMsg: function(msg, help){
		this.getRibbonSet()
			.attr({
				'empty-msg': msg || '',
				'empty-help': help || '',
			})
	},
} 



/*********************************************************************/

var Ribbons = 
module.Ribbons = 
object.makeConstructor('Ribbons', 
		RibbonsClassPrototype, 
		RibbonsPrototype)



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
