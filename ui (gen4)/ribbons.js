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

var data = require('data')
var image = require('image')



/*********************************************************************/
//
// This xpects the folowing HTML structure...
//
// Unpopulated:
// NOTE: there can be only one .ribbon-set element.
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
//				<div class="image"></div>
//				<div class="image"></div>
//				...
//			</div>
//			<div class="ribbon">
//				<div class="image"></div>
//				<div class="current image"></div>
//				<div class="image"></div>
//				<div class="mark selected"></div>
//				<div class="image"></div>
//				...
//			</div>
//			...
//		</div>
//	</div>
//
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
	//		-> ribbon
	//
	// Get ribbon by index/gid:
	//	.getRibbon(index)
	//	.getRibbon(gid)
	//		-> ribbon
	//
	// Get ribbons from list:
	//	.getRibbon($(..))
	//	.getRibbon([..])
	//		-> ribbon(s)
	//		NOTE: this will filter the list but not search the tree...
	//
	getRibbon: function(target){
		// current...
		if(target == null) {
			return this.viewer.find('.current.image').parents('.ribbon').first()

		// index...
		} else if(typeof(target) == typeof(123)){
			return this.viewer.find('.ribbon').eq(target)

		// gid...
		} else if(typeof(target) == typeof('str')){
			//return this.viewer.find('.ribbon[gid="'+JSON.stringify(target)+'"]')
			return this.viewer.find('.ribbon[gid='+JSON.stringify(target)+']')
		}
		return $(target).filter('.ribbon')
	},

	// Like .getRibbon(..) but returns ribbon index instead of the actual 
	// ribbon object...
	getRibbonIndex: function(target){
		return this.viewer.find('.ribbon').index(this.getRibbon(target))
	},

	// Get ribbon...
	//
	// Get current image:
	//	.getImage()
	//		-> image
	//
	// Get image by gid:
	//	.getImage(gid)
	//		-> image
	//
	// Get images from list:
	//	.getImage($(..))
	//	.getImage([..])
	//		-> image(s)
	//		NOTE: this will filter the list but not search the tree...
	//
	getImage: function(target){
		// current...
		if(target == null) {
			return this.viewer.find('.current.image')

		// gid...
		} else if(typeof(target) == typeof('str')){
			//return this.viewer.find('.image[gid="'+JSON.stringify(target)+'"]')
			return this.viewer.find('.image[gid='+JSON.stringify(target)+']')
		}
		return $(target).filter('.image')
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
	// Place gid at image position and image ribbon:
	//	.placeImage(gid, image)
	//		-> image
	//
	// Place gid at index in current ribbon:
	//	.placeImage(gid, position)
	//		-> image
	//
	// Place gid at position in ribbon:
	//	.placeImage(gid, ribbon, position)
	//		-> image
	//
	//
	// NOTE: if image gid does not exist it will be created.
	// NOTE: index can be negative indicating the position from the tail.
	// NOTE: if index is an image or a gid then the ribbon argument will
	// 		be ignored and the actual ribbon will be derived from the 
	// 		image given.
	// XXX interaction animation...
	placeImage: function(target, ribbon, position){
		// get/create the image...
		var img = this.getImage(target)
		img = img.length == 0 ? this.createImage(target) : img

		// normalize the position, ribbon and images...
		if(position == null){
			position = ribbon
			ribbon = null
		}
		var p = this.getImage(position)
		ribbon = p.hasClass('image') 
			? p.parents('.ribbon').first() 
			: this.getRibbon(ribbon)
		var images = ribbon.find('.image')
		position = p.hasClass('image') ? images.index(p) : position
		position = position < 0 ? images.length + position + 1 : position
		position = position < 0 ? 0 : position

		// place the image...
		if(images.length == 0 || images.length <= position){
			ribbon.append(img)

		} else {
			images.eq(position).before(img)
		}

		return _UPDATE_IMAGE ? image.updateImage(img) : img
	},

	// XXX do we need shorthands like shiftImageUp/shiftImageDown/... here?


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
	// This uses .updateRibbon(..) to load individual ribbons, for
	// more info see docs for that.
	//
	// This uses data.ribbon_order to place the ribbons and data.ribbons
	// place the images, either is optional, but at least one of the two
	// must exist for this to work.
	//
	// NOTE: this will not clear the ribbons object explicitly.
	// NOTE: this will clear the ribbons that are not present in 
	// 		data.ribbon_order (if given) unless keep_untouched_ribbons 
	// 		is set.
	updateData: function(data, keep_untouched_ribbons){
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

		// clear the ribbons that did not get updated...
		if(!keep_untouched_ribbons && data.ribbon_order != null){
			var ribbons = data.ribbon_order
			that.viewer.find('.ribbon').each(function(){
				var r = $(this)
				if(ribbons.indexOf(that.getElemGID(r)) < 0){
					r.remove()
				}
			})
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
			if(gid != 0){
				var list = gid > 0 ? 'nextAll' : 'prevAll'
				gid = Math.abs(gid)-1
				var target = cur[list]('.image')
				// handle overflow...
				target = target.eq(Math.min(gid, target.length-1))
				if(target.length > 0){
					return this.focusImage(target)
				}
			}
			return cur
		}

		cur.removeClass('current')
		return this.getImage(gid)
			.addClass('current')
	},


	// Image manipulation...

	// Rotate an image...
	//
	// direction can be:
	// XXX not sure if we need these as attrs...
	CW: 'cw',
	CCW: 'ccw',
	//
	// rotation tables...
	// NOTE: setting a value to null will remove the attribute, 0 will 
	// 		set 0 explicitly...
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
	rotateImage: function(target, direction){
		var r_table = direction == this.CW ? this._cw : this._ccw
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
	// direction can be:
	// XXX not sure if we need these as attrs...
	VERTICAL: 'vertical',
	HORIZONTAL: 'horizontal',
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
	rotateCW: function(target){ return this.rotateImage(target, this.CW) },
	rotateCCW: function(target){ return this.rotateImage(target, this.CCW) },
	flipVertical: function(target){ return this.flipImage(target, this.VERTICAL) },
	flipHorizontal: function(target){ return this.flipImage(target, this.HORIZONTAL) },


	// UI manipulation...
	
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
