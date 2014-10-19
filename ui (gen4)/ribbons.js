/**********************************************************************
* 
* Minimal UI API...
*
*
**********************************************************************/

define(function(require){ var module = {}
console.log('>>> ribbons')

//var DEBUG = DEBUG != null ? DEBUG : true

// XXX is this correct...
require('ext-lib/jquery')

var data = require('data')
var images = require('images')



// XXX STUB
var IMAGE_UPDATERS =
module.IMAGE_UPDATERS = []


/*********************************************************************/

// XXX add inheritance...
var makeObject =
module.makeObject =
function makeObject(name, cls, obj){
	// NOTE: we are using eval here to name the function correctly as
	// 		simply assigning .name does not work...
	// 		XXX think of a cleaner way...
	var O = function OBJECT(){
		if(this.constructor.name != name){
			return new (Function.prototype.bind.apply(
				OBJECT,
				arguments.length == 1 ? [null, arguments[0]]
					: [null].concat(Array.apply(null, arguments))))
		}
	
		if(this.__init__ != null){
			this.__init__.apply(this, arguments)
		}
	
		return this
	}

	if(name != null){
		O = eval(O
			.toString()
			.replace(/OBJRCT/g, name))
	}

	if(cls != null){
		O.__proto__ = cls
	}
	if(obj != null){
		O.prototype = obj
	}
	O.prototype.constructor = O

	return O
}



/*********************************************************************/
//
// This expects the following HTML structure...
//
// Unpopulated:
//
//	<div class="viewer">
//		<div class="ribbon-set"></div>
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
//				<div class="current image" gid="d"></div>
//				<div class="image" gid="e"></div>
//				<div class="mark selected" gid="f"></div>
//				<div class="image" gid="g"></div>
//				...
//			</div>
//			...
//		</div>
//	</div>
//
//
// NOTE: there can be only one .ribbon-set element.
//
/*********************************************************************/

var RibbonsClassPrototype =
module.RibbonsClassPrototype = {
	// Generic getters...
	getElemGID: function(elem){
		return JSON.parse('"' + elem.attr('gid') + '"')
	},

	// DOM Constructors...
	// NOTE: these will return unattached objects...
	createViewer: function(){
		return $('<div>')
			.addClass('viewer')
			.append($('<div>')
				.addClass('ribbon-set'))
	},
	// XXX NOTE: quots removal might render this incompatible with older data formats...
	createRibbon: function(gid){
		gid = gid != null ? gid+'' : gid
		return $('<div>')
			.addClass('ribbon')
			.attr('gid', JSON.stringify(gid)
					// this removes the extra quots...
					.replace(/^"(.*)"$/g, '$1'))
	},
	// XXX NOTE: quots removal might render this incompatible with older data formats...
	createImage: function(gid){
		gid = gid != null ? gid+'' : gid
		return $('<div>')
			.addClass('image')
			.attr('gid', JSON.stringify(gid)
					// this removes the extra quots...
					.replace(/^"(.*)"$/g, '$1'))
	},
	createMark: function(cls, gid){
		gid = gid != null ? gid+'' : gid
		return $('<div class="mark">')
			.addClass(cls)
			.attr('gid', JSON.stringify(gid)
				// this removes the extra quots...
				.replace(/^"(.*)"$/g, '$1'))
	},
} 


// NOTE: this is a low level interface, not a set of actions...
var RibbonsPrototype =
module.RibbonsPrototype = {
	//
	//	.viewer (jQuery object)
	//
	//	.images (Images object)
	//
	// XXX to update images we need to know about images...
	
	// Constructors...
	createViewer: RibbonsClassPrototype.createViewer,
	createRibbon: RibbonsClassPrototype.createRibbon,
	createImage: RibbonsClassPrototype.createImage,
	createMark: RibbonsClassPrototype.createMark,

	// Generic getters...
	getElemGID: RibbonsClassPrototype.getElemGID,


	// Helpers...

	// XXX need a better way of doing this...
	preventTransitions: function(){
		this.viewer.addClass('no-transitions')
		var v = this.viewer[0]
		getComputedStyle(v).webkitTransition
		getComputedStyle(v).mozTransition
		getComputedStyle(v).msTransition
		getComputedStyle(v).oTransition
		getComputedStyle(v).transition
	},
	restoreTransitions: function(now){
		// sync...
		if(now){
			this.viewer.removeClass('no-transitions')
			var v = this.viewer[0]
			getComputedStyle(v).webkitTransition
			getComputedStyle(v).mozTransition
			getComputedStyle(v).msTransition
			getComputedStyle(v).oTransition
			getComputedStyle(v).transition

		// on next exec frame...
		} else {
			var that = this
			setTimeout(function(){
				that.viewer.removeClass('no-transitions')}, 0)
				var v = that.viewer[0]
				getComputedStyle(v).webkitTransition
				getComputedStyle(v).mozTransition
				getComputedStyle(v).msTransition
				getComputedStyle(v).oTransition
				getComputedStyle(v).transition
		}
	},

	noTransitions: function(func){
		this.preventTransitions()
		func.apply(this, args2array(arguments).slice(1))
		this.restoreTransitions(true)
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
	// XXX try and make image size the product of vmin and scale...
	getVisibleImageSize: function(dim, scale){
		scale = scale || this.getScale()
		dim = dim == null ? 'width' : dim
		var img = this.viewer.find('.image')
		if(dim == 'height'){
			return img.outerHeight(true) * scale
		} else if(dim == 'width'){
			return img.outerWidth(true) * scale
		} else if(dim == 'max'){
			return Math.max(img.outerHeight(true), img.outerWidth(true)) * scale
		} else if(dim == 'min'){
			return Math.min(img.outerHeight(true), img.outerWidth(true)) * scale
		}
	},

	getScreenWidthImages: function(scale){
		var scale = scale == null ? 1 : scale/this.getScale()

		var W = this.viewer.width()
		var w = this.getVisibleImageSize('width') * scale

		return W/w
	},

	// Get ribbon set scale...
	//
	getScale: function(){
		return getElementScale(this.viewer.find('.ribbon-set'))
	},

	// Set ribbon set scale...
	//
	// 	.setScale(<scale>)
	// 	.setScale(<scale>, <image>)
	// 	.setScale(<scale>, 'top'|'center'|'bottom'|<px>|%, 'left'|'center'|'right'|<px>|%)
	// 		-> <ribbons>
	//
	// NOTE: this will also set origin...
	setScale: function(scale, t, l){
		var ribbon_set = this.viewer.find('.ribbon-set')

		if(t != null && l != null){
			this.setOrigin(t, l)

		} else {
			var img = t == null ? this.getImage() : t

			this.setOrigin(img)
		}

		setElementScale(ribbon_set, scale)
		return this
	},

	// Get current ribbon-set origin...
	//
	getOrigin: function(){
		return getElementOrigin(this.viewer.find('.ribbon-set'))
	},
	
	// Set ribbon set origin...
	//
	//	Set origin to center of current image
	//	.setOrigin()
	//		-> ribbons
	//
	//	Set origin to center of elment:
	//	.setOrigin(image)
	//		-> ribbons
	//
	//	Set origin to screen coordinates:
	//	.setOrigin(x|%|'left'|'center'|'right', x|%|'top'|'center'|'bottom')
	//		-> ribbons
	//
	// NOTE: this will also compensate for scaling.
	//
	// XXX DEBUG: remove point updating when not needed...
	setOrigin: function(a, b){
		var ribbon_set = this.viewer.find('.ribbon-set')
		var ro = ribbon_set.offset()
		var s = this.getScale()

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

		} else {
			var img = this.getImage(a)
			var io = img.offset()
			var w = img.width()
			var h = img.height()

			var l = (io.left - ro.left)/s + w/2
			var t = (io.top - ro.top)/s + h/2
		}

		shiftOriginTo(ribbon_set, l, t)

		// XXX DEBUG: remove when done...
		if($('.point').length > 0){
			setElementOffset($('.point'), l, t)
		}

		return this
	},

	// Make a "shadow" image for use with image oriented animations...
	//
	//	.makeShadwo([<image>][, <animate>][, <delay>])
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
	//
	// XXX should we also have a ribbon shadow???
	makeShadow: function(target, animate, delay){
		delay = delay || 200
		var img = this.getImage(target)
		var gid = this.getElemGID(img)
		var s = this.getScale()
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
			var shadow = setElementScale(
				$('<div>')
					.addClass('shadow')
					.attr({
						gid: gid,
						ticket: ticket,
					})
					.append(
						// clone the target into the shadow..
						img
							.clone()
							.removeClass('current')
							.attr('gid', null))
					.css({
						width: img.width(),
						height: img.height(),
					}), s)
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
				var s = that.getScale()
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
			return $(target).filter('.image')
		}

		// get the offset...
		if(offset != null && offset != 0){
			// relative keywords...
			offset = offset == 'next' ? 1
				: offset == 'prev' ? -1
				: offset
			var list = offset > 0 ? 'nextAll' : 'prevAll'
			offset = Math.abs(offset)-1
			var res = img[list]('.image')
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
				return this.viewer.find('.ribbon').first()
			}
			return r

		// index...
		} else if(typeof(target) == typeof(123)){
			return this.viewer.find('.ribbon').eq(target)

		// gid...
		} else if(typeof(target) == typeof('str')){
			//return this.viewer.find('.ribbon[gid="'+JSON.stringify(target)+'"]')
			var r = this.viewer.find('.ribbon[gid='+JSON.stringify(target)+']')
			// if no ribbon is found, try and get an image and it's ribbon...
			return r.length == 0 
				? this.getImage(target).parents('.ribbon').first()
				: r
		}
		return $(target).filter('.ribbon')
	},
	// Like .getRibbon(..) but returns ribbon index instead of the actual 
	// ribbon object...
	getRibbonOrder: function(target){
		return this.viewer.find('.ribbon').index(this.getRibbon(target))
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

		var ribbons = this.viewer.find('.ribbon')
		// normalize the position...
		if(typeof(position) == typeof(123)){
			position = position < 0 ? ribbons.length + position + 1 : position
			position = position < 0 ? 0 : position
		} else {
			var p = this.getRibbonOrder(position)
			// XXX what do we do if the target does not exist, i.e. p == -1 ????
		}

		if(i == position){
			return ribbon
		}

		// place the ribbon...
		if(ribbons.length == 0 || ribbons.length <= position){
			this.viewer.find('.ribbon-set').append(ribbon)

		} else if(i > position) {
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
	placeImage: function(target, to, mode){
		mode = mode == null ? 'before' : mode
		var img = this.getImage(target)
		img = img.length == 0 ? this.createImage(target) : img
		var r = this.getRibbon(to)

		// offset on same ribbon...
		if(typeof(to) == typeof(123)){
			// moving the image to itself...
			if(to == 0){
				return img
			}
			var i = to
			var images = img[i > 0 ? 'nextAll' : 'prevAll']('.image')
			to = images.length > 0 
				? images.eq(Math.min(Math.abs(i), images.length)-1) 
				: img
			if(to === img){
				return to
			}

		// append/prepend to ribbon...
		} else if(r.length > 0 && r.hasClass('ribbon')){
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
			var images = to[mode]('.image')
		}

		// place the image...
		if(images.length <= i){
			to.parents('.ribbon')
				.append(img)
		// after...
		} else if(i > 0){
			to.next('.image')
				.before(img)
		// before...
		} else {
			to
				.before(img)
		}

		return this.updateImage(img)
	},


	// Loading and updating...

	// XXX this needs:
	// 		IMAGE_UPDATERS -- make it a callback/event (node/jquery)...
	updateImageIndicators: function(gid, image){
		gid = gid == null ? this.getElemGID() : gid
		image = image == null ? this.getImage() : $(image)

		// collect marks...
		image.after(this.getImageMarks(gid))

		IMAGE_UPDATERS.forEach(function(update){
			update(gid, image)
		})

		return image
	},
	_loadImagePreviewURL: function(image, url){
		// pre-cache and load image...
		// NOTE: this will make images load without a blackout...
		var img = new Image()
		img.onload = function(){
			image.css({
					'background-image': 'url("'+ url +'")',
				})
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
		image = (image == '*' ? this.viewer.find('.image')
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
				img_data = images.STUB_IMAGE_DATA
			}

			/* XXX does not seem to be needing this...
			// set the current class...
			if(gid == DATA.current){
				image.addClass('current')
			} else {
				image.removeClass('current')
			}
			*/

			/*
			// main attrs...
			image
				.attr({
					orientation: [null, 0].indexOf(img_data.orientation) < 0 
						? img_data.orientation,
						: null 
					flipped: img_data.flipped != null 
						? img_data.flipped.join(', '),
						: null 
				})
			*/

			// image state...
			that.rotateImage(image, img_data.orientation == null ? 0 : img_data.orientation)
			that.flipImage(image, img_data.flipped == null ? [] : img_data.flipped)

			// preview...
			var p_url = that.images.getBestPreview(gid, size, img_data).url

			// update the preview if it's a new image or...
			// XXX this should be pushed as far back as possible...
			if(old_gid != gid 
					// the new preview (p_url) is different to current...
					// NOTE: this may not work correctly for relative urls...
					|| image.css('background-image').indexOf(encodeURI(p_url)) < 0){
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

	// update a set of images in a ribbon...
	//
	// This will reuse the images that already exist, thus if updating or
	// adding images to an already loaded set this should be very fast.
	//
	// NOTE: gids and ribbon must be .getImage(..) and .getRibbon(..) 
	// 		compatible...
	updateRibbon: function(gids, ribbon){
		// get/create the ribbon...
		var r = this.getRibbon(ribbon)
		if(r.length == 0){
			// no such ribbon exists, then create and append it...
			r = this.placeRibbon(ribbon, this.viewer.find('.ribbon').length)
		}

		var loaded = r.find('.image')

		var that = this
		$(gids).each(function(i, gid){
			// support for sparse ribbons...
			if(gid == null){
				return 
			}
			// get/create image...
			var img = that.getImage(gid)
			img = img.length == 0 ? that.createImage(gid) : img

			// clear a chunk of images that are not in gids until one that is...
			var g = loaded.length > i ? that.getElemGID(loaded.eq(i)) : null
			while(g != null && gids.indexOf(g) < 0){
				that.clear(g)
				loaded.splice(i, 1)
				g = loaded.length > i ? that.getElemGID(loaded.eq(i)) : null
			}

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

		// remove the rest of the stuff in ribbon... 
		if(loaded.length > gids.length){
			loaded.eq(gids.length).nextAll().remove()
			loaded.eq(gids.length).remove()
		}

		return this
	},

	// Update a data object in ribbons...
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
		var settings = settings == null ? {} : settings
		// load the data...
		var that = this

		// place images...
		if(data.ribbons != null){
			Object.keys(data.ribbons).forEach(function(gid){
				that.updateRibbon(data.ribbons[gid], gid)
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
				var ribbons = []
				ribbons = data.ribbon_order != null 
					? ribbons.concat(Object.keys(data.ribbon_order)) 
					: ribbons
				ribbons = data.ribbons != null 
					? ribbons.concat(Object.keys(data.ribbons)) 
					: ribbons
				ribbons.push(data.base)

				that.viewer.find('.ribbon').each(function(){
					var r = $(this)
					if(ribbons.indexOf(that.getElemGID(r)) < 0){
						r.remove()
					}
				})
			}
		}

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
	//
	// NOTE: another way to remove a ribbon or an image just to use 
	// 		.getRibbon(..).remove() and .getImage(...).remove() respectivly.
	clear: function(gids){
		// clear all...
		if(gids == null || gids == '*'){
			this.viewer.find('.ribbon').remove()
			// reset offsets...
			this.viewer.find('.ribbon-set').css({
				top: '',
			})

		// clear one or more gids...
		} else {
			gids = gids.constructor.name != 'Array' ? [gids] : gids
			var that = this
			gids.forEach(function(g){
				that.viewer.find('[gid='+JSON.stringify(g)+']').remove()
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
		cls = cls.constructor.name != 'Array' ? [cls] : cls
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
		target = this.getImage(target)

		// validate direction...
		if(images.calcRelativeRotation(direction) == null){
			return target
		}

		var that = this
		target.each(function(i, e){
			var img = $(this)
			var o = direction == 'cw' || direction == 'ccw' 
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
		return target
	},

	// Flip an image...
	//
	// Flip image:
	// 	.flipImage(target, 'horizontal')
	// 	.flipImage(target, 'vertical')
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
	flipImage: function(target, direction){
		target = this.getImage(target)
		var set_state = direction.constructor.name == 'Array' ? direction : null
		target.each(function(i, e){
			var img = $(this)

			// update existing state...
			if(set_state == null){
				var state = img.attr('flipped')
				state = (state == null ? '' : state)
					.split(',')
					.map(function(e){ return e.trim() })
					.filter(function(e){ return e != '' })
				// toggle the specific state...
				var i = state.indexOf(direction)
				if(i >= 0){
					state.splice(i, 1)
				} else {
					state.push(direction)
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
		return target
	},

	// shorthands...
	// XXX should these be here???
	rotateCW: function(target){ return this.rotateImage(target, 'cw') },
	rotateCCW: function(target){ return this.rotateImage(target, 'ccw') },
	flipVertical: function(target){ return this.flipImage(target, 'vertical') },
	flipHorizontal: function(target){ return this.flipImage(target, 'horizontal') },


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

		var viewer_p = W > H ? 'landscape' : 'portrait'

		return $(images).each(function(i, e){
			var image = $(this)
			// orientation...
			var o = image.attr('orientation')
			o = o == null ? 0 : o
			var w = image.outerWidth()
			var h = image.outerHeight()

			// non-square image...
			if(w != h){

				var image_p = w > h ? 'landscape' : 'portrait'

				// when the image is turned 90deg/270deg and its 
				// proportions are the same as the screen...
				if((o == 90 || o == 270) && image_p == viewer_p){
					image.css({
						width: h,
						height: w,
					})
					image.css({
						'margin-top': -((w - h)/2),
						'margin-bottom': -((w - h)/2),
						'margin-left': (w - h)/2,
						'margin-right': (w - h)/2,
					})

				} else if((o == 0 || o == 180) && image_p != viewer_p){
					image.css({
						width: h,
						height: w,
					})
					image.css({
						'margin': '',
					})
				}

			// square image...
			} else {
				image.css({
					'margin': '',
				})
			}
		})
	},

	// center a ribbon vertically...
	// 
	// XXX offset and scale are not used...
	// XXX custom align point woud also be nice... 
	// 		(top, bottom, center, %, px)
	centerRibbon: function(target, offset, scale){
		var ribbon_set = this.viewer.find('.ribbon-set')

		//this.setOrigin(target)
		
		target = this.getImage(target)
		var s = this.getScale()
		var ro = ribbon_set.offset()
		var io = target.offset()
		var h = target.height()

		var t = (io.top - ro.top)/s + h/2

		var offset = getRelativeOffset(this.viewer, ribbon_set, {
			top: t,
			left: 0,
		}).top
		
		setElementOffset(ribbon_set, 0, offset)

		return this
	},

	// center an image horizontally...
	// 
	// XXX offset is not used...
	// XXX custom align point would also be nice... 
	// 		(top, bottom, center, %, px)
	centerImage: function(target, mode, offset, scale){
		target = this.getImage(target)
		scale = scale || this.getScale()
		var ribbon = this.getRibbon(target)

		var rl = ribbon.offset().left
		var il = target.offset().left
		//var rsl = this.viewer.find('.ribbon-set').offset().left
		var W = this.viewer.width() * scale
		var w = target.width() * scale

		var image_offset = mode == 'before' ? w/2
			: mode == 'after' ? -w/2
			: 0

		ribbon
			.css({
				left: (rl + ((W-w)/2 + image_offset) - il) / scale,
			})

		return this
	},

	// Fit image to view...
	//
	// If n is given this will fit n images (default: 1)
	//
	// NOTE: this will never scale the view in a wat that an image 
	// 		overflows either in height nor width.
	//
	// XXX might be usefull to set origin before scaling...
	fitImage: function(n){
		n = n == null ? 1 : n

		// NOTE: this is width oriented...
		var scale = this.getScreenWidthImages(1) / n

		// check bounds...
		var H = this.viewer.height()
		var h = this.getVisibleImageSize('height', 1)

		// n images will be higher than the viewer, adjust for height...
		if(h*scale >= H){
			scale = H/h 
		}

		this
			.setScale(scale)
			//.centerRibbon(null, null, scale)
			//.centerImage(null, null, null, scale)
		
		return this
	},


	_setup: function(viewer, images){
		this.viewer = $(viewer)
		this.images = images
	},
} 


// Main Ribbons object...
//
var Ribbons =
module.Ribbons =
function Ribbons(viewer, images){
	// in case this is called as a function (without new)...
	if(this.constructor.name != 'Ribbons'){
		return new Ribbons(viewer, images)
	}

	this._setup(viewer, images)

	return this
}
Ribbons.__proto__ = RibbonsClassPrototype
Ribbons.prototype = RibbonsPrototype
Ribbons.prototype.constructor = Ribbons



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
