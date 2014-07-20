/**********************************************************************
* 
* Minomal UI API...
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true


/*********************************************************************/
//
// This xpects the folowing HTML structure...
//
// Unpopulated:
// NOTE: there can be only .ribbon-set element.
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

var RibbonsClassPrototype = {
	// NOTE: these will return unattached objects...
	createViewer: function(){
		return $('<div>')
			.addClass('viewer')
			.append($('<div>')
				.addClass('ribbon-set'))
	},
	createRibbon: function(gid){
		return $('<div>')
			.addClass('ribbon')
			.setAttribute('gid', JSON.stringify(gid))
	},
	createImage: function(gid){
		return $('<div>')
			.addClass('image')
			.setAttribute('gid', JSON.stringify(gid))
	},
} 


// XXX this is a low level interface, not a set of actions...
// XXX test
var RibbonsPrototype = {
	//
	//	.viewer (jQuery object)
	//
	
	// Constructors...
	createViewer: RibbonsClassPrototype.createViewer,
	createRibbon: RibbonsClassPrototype.createRibbon,
	createImage: RibbonsClassPrototype.createImage,

	// NOTE: these accept gids or jQuery objects...
	getRibbon: function(target){
		if(target == null) {
			return this.viewer.find('.current.image').parents('.ribbon').first()

		} else if(typeof(target) == typeof('str')){
			return this.viewer.find('.ribbon[gid='+JSON.stringify(target)+']')
		}
		return $(target).filter('.ribbon')
	},
	getImage: function(target){
		if(target == null) {
			return this.viewer.find('.current.image')

		} else if(typeof(target) == typeof('str')){
			return this.viewer.find('.image[gid='+JSON.stringify(target)+']')
		}
		return $(target).filter('.image')
	},


	// NOTE: to remove a ribbon or an image just use .getRibbon(..).remove()
	// 		and .getImage(...).remove() respectivly.


	// Place a ribbon...
	//
	// position can be:
	// 	- index
	// 	- ribbon gid
	// 	- ribbon
	//
	// NOTE: if ribbon does not exist a new ribbon will be created...
	// XXX these will place at current loaded position rather than the 
	// 		actual DATA position...
	// 		...is this correct?
	// XXX interaction animation...
	placeRibbon: function(gid, position){
		// get create the ribbon...
		var ribbon = this.getRibbon(gid)
		ribbon = ribbon.length == 0 ? this.createRibbon(gid) : ribbon

		var ribbons = this.viewer.find('.ribbon')
		// normalize the position...
		var p = this.getRibbon(position)
		position = p.hasClass('ribbon') ? ribbons.index(p) : position
		position = position < 0 ? (ribbons.length - position)+1 : position
		position = position < 0 ? 0 : position

		// place the ribbon...
		if(ribbons.length == 0){
			this.viewer.find('ribbon-set').append(ribbon)

		} else if(ribbons.length <= position){
			ribbons.last().after(ribbon)

		} else {
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
	placeImage: function(gid, ribbon, position){
		// get/create the image...
		var image = this.getImage(gid)
		image = image.length == 0 ? this.createImage(gid) : image

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
		position = position < 0 ? (images.length - position)+1 : position
		position = position < 0 ? 0 : position

		// place the image...
		if(images.length == 0 || images.length <= position){
			ribbon.append(image)

		} else {
			images.eq(position).before(image)
		}

		return updateImage(image)
	},

	// XXX do we need shorthands like shiftImageUp/shiftImageDown/... here?

	// XXX this does not align anything, it's just a low level focus...
	// XXX interaction animation...
	focusImage: function(gid){
		this.viewer
			.find('.current.image')
				.removeClass('current')
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
		var r_table = direction == this.CW ? _cw : _ccw
		target = this.getImage(target)
		target.each(function(i, e){
			var img = $(this)
			var o = r_table[img.attr('orientation')]
			if(o == null){
				img.removeAttr('orientation')
			} else {
				img.attr('orientation', o)
			}
			// account for proportions...
			correctImageProportionsForRotation(img)
			// XXX this is a bit of an overkill but it will update the 
			// 		preview if needed...
			//updateImage(img)
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
	//rotateCW: function(target){ return this.rotateImage(target, this.CW) },
	//rotateCCW: function(target){ return this.rotateImage(target, this.CCW) },
	//flipVertical: function(target){ return this.flipImage(target, this.VERTICAL) },
	//flipHorizontal: function(target){ return this.flipImage(target, this.HORIZONTAL) },


	// Bulk manipulation...

	// NOTE: gids and ribbon must be .getImage(..) and .getRibbon(..) 
	// 		compatible...
	// XXX do we need an image pool here???
	showImagesInRibbon: function(gids, ribbon){
		// get/create the ribbon...
		var r = this.getRibbon(ribbon)
		if(r.length == 0){
			r = this.createRibbon(ribbon)
		}

		var loaded = r.find('.image')

		var that = this
		$(gids).each(function(gid, i){
			// get/create image...
			var img = that.getImage(gid)
			if(img.length == 0){
				img = that.createImage(gid)
			}

			// clear images that are not in gids...
			var g = JSON.parse(loaded.eq(i).attr('gid'))
			while(gids.indexOf(g) < 0){
				//r.find('[gid='+JSON.stringify(g)+']')
				//	.remove()
				that.clear(g)
				loaded.splice(i, 1)
				g = JSON.parse(loaded.eq(i).attr('gid'))
			}

			// check if we need to reattach the image...
			if(gid != g){
				// attach the image at i...
				loaded.eq(i).before(img.detach())
			}

			updateImage(img)
		})

		// remove the rest of the stuff in ribbon... 
		if(loaded.length > gids.length){
			loaded.eq(gids.length).nextAll().remove()
			loaded.eq(gids.length).remove()
		}

		return this
	},
	clear: function(gids){
		// clear all...
		if(gids == null){
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
function Ribbons(viewer){
	// in case this is called as a function (without new)...
	if(this.constructor.name != 'Ribbons'){
		return new Ribbons(viewer)
	}

	return this
}
Ribbons.__proto__ = RibbonsClassPrototype
Ribbons.prototype = RibbonsPrototype
Ribbons.prototype.constructor = Ribbons



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
