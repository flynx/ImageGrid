/**********************************************************************
* 
* Minomal UI API...
*
*
**********************************************************************/

// XXX this is a stub, here untill image.js is done...
_UPDATE_IMAGE = false

define(function(require){ var module = {}
console.log('>>> ribbons')

//var DEBUG = DEBUG != null ? DEBUG : true

// XXX is this correct...
require('ext-lib/jquery')

var data = require('data')
var image = require('image')



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

	// Constructors...
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
} 


// NOTE: this is a low level interface, not a set of actions...
var RibbonsPrototype =
module.RibbonsPrototype = {
	//
	//	.viewer (jQuery object)
	//
	// XXX to update images we need to know about images...
	
	// Constructors...
	createViewer: RibbonsClassPrototype.createViewer,
	createRibbon: RibbonsClassPrototype.createRibbon,
	createImage: RibbonsClassPrototype.createImage,

	// Generic getters...
	getElemGID: RibbonsClassPrototype.getElemGID,


	// Contextual getters...
	
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
	getRibbonIndex: function(target){
		return this.viewer.find('.ribbon').index(this.getRibbon(target))
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
	//
	// XXX interaction animation...
	placeRibbon: function(target, position){
		// get create the ribbon...
		var ribbon = this.getRibbon(target)
		var i = this.getRibbonIndex(ribbon)
		ribbon = ribbon.length == 0 ? this.createRibbon(target) : ribbon

		var ribbons = this.viewer.find('.ribbon')
		// normalize the position...
		if(typeof(position) == typeof(123)){
			position = position < 0 ? ribbons.length + position + 1 : position
			position = position < 0 ? 0 : position
		} else {
			var p = this.getRibbonIndex(position)
			// XXX what do we do if the target does not exist, i.e. p == -1 ????
		}

		// place the ribbon...
		if(ribbons.length == 0 || ribbons.length <= position){
			this.viewer.find('.ribbon-set').append(ribbon)

		} else if(i != position) {
			ribbons.eq(position).before(ribbon)
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
	// NOTE: mode is defaults to 'before'.
	// NOTE: if image gid does not exist it will be created.
	//
	// XXX interaction animation...
	// XXX mode is ugly...
	placeImage: function(target, to, mode){
		mode = mode == null ? 'before' : mode
		var img = this.getImage(target)
		img = img.length == 0 ? this.createImage(target) : img

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
			to.parents('.ribbon').append(img)
		// after...
		} else if(i > 0){
			to.next('.image').before(img)
		// before...
		} else {
			to.before(img)
		}

		return _UPDATE_IMAGE ? image.updateImage(img) : img
	},


	// Bulk manipulation...

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

			_UPDATE_IMAGE && image.updateImage(img)
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
	//
	// XXX interaction animation...
	focusImage: function(gid){
		var cur = this.viewer
			.find('.current.image')

		// relative keywords...
		gid = gid == 'next' ? 1
			: gid == 'prev' ? -1
			: gid

		// offset...
		if(typeof(gid) == typeof(123)){
			return this.focusImage(this.getImage(gid))
		}

		cur.removeClass('current')
		return this.getImage(gid)
			.addClass('current')
	},

	// XXX should this support keywords a-la .focusImage(..)???
	setBaseRibbon: function(gid){
		this.viewer.find('.base.ribbon').removeClass('base')
		return this.getRibbon(gid).addClass('base')
	},


	// Image manipulation...

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
	//
	// NOTE: target must be .getImage(..) compatible.
	// NOTE: this can be applied in bulk, e.g. 
	// 		this.rotateImage($('.image'), 'cw') will rotate all the 
	// 		loaded images clockwise.
	//
	// Rotation tables...
	_cw: {
		null: 90,
		0: 90,
		90: 180,
		180: 270,
		//270: 0,
		270: null,
	},
	_ccw: {
		null: 270,
		0: 270,
		//90: 0,
		90: null,
		180: 90,
		270: 180,
	},
	// NOTE: setting a value to null will remove the attribute, 0 will 
	// 		set 0 explicitly...
	rotateImage: function(target, direction){
		var r_table = direction == 'cw' ? this._cw : this._ccw
		target = this.getImage(target)
		target.each(function(i, e){
			var img = $(this)
			var o = img.attr('orientation')
			o = r_table[ o == null ? null : o ]
			if(o == null){
				img.removeAttr('orientation')
			} else {
				img.attr('orientation', o)
			}
			// account for proportions...
			image.correctImageProportionsForRotation(img)
			// XXX this is a bit of an overkill but it will update the 
			// 		preview if needed...
			//image.updateImage(img)
		})
		return target
	},

	// Flip an image...
	//
	// 	.flipImage(target, 'horizontal')
	// 	.flipImage(target, 'vertical')
	// 		-> image
	//
	// NOTE: target must be .getImage(..) compatible.
	// NOTE: this can be applied in bulk, e.g. 
	// 		this.flipImage($('.image'), 'vertical') will rotate all the 
	// 		loaded images vertically.
	flipImage: function(target, direction){
		target = this.getImage(target)
		target.each(function(i, e){
			var img = $(this)

			// get the state...
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
	//rotateCW: function(target){ return this.rotateImage(target, 'cw') },
	//rotateCCW: function(target){ return this.rotateImage(target, 'ccw') },
	//flipVertical: function(target){ return this.flipImage(target, 'vertical') },
	//flipHorizontal: function(target){ return this.flipImage(target, 'horizontal') },


	// UI manipulation...
	
	// XXX try and make image size the product of vmin and scale...
	// XXX is this the right place for this???
	// XXX uses jli.js getElementScale(..)
	getVisibleImageSize: function(dim){
		dim = dim == null ? 'width' : dim
		var img = this.viewer.find('.image')
		var scale = getElementScale(this.viewer.find('.ribbon-set'))
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

	// XXX if target is an image align the ribbon both vertically and horizontally...
	alignRibbon: function(target, mode){
		// XXX
	},

	// XXX
	fitNImages: function(n){
		// XXX
	},


	_setup: function(viewer){
		this.viewer = $(viewer)
	},
} 


// Main Ribbons object...
//
var Ribbons =
module.Ribbons =
function Ribbons(viewer){
	// in case this is called as a function (without new)...
	if(this.constructor.name != 'Ribbons'){
		return new Ribbons(viewer)
	}

	this._setup(viewer)

	return this
}
Ribbons.__proto__ = RibbonsClassPrototype
Ribbons.prototype = RibbonsPrototype
Ribbons.prototype.constructor = Ribbons



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
