/**********************************************************************
* 
* Minimal UI API...
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

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
// This expects/builds the following HTML structure...
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
//			<div class="ribbon-locator">
//				<div class="ribbon">
//					<div class="image" gid="a"></div>
//					<div class="image" gid="b"></div>
//					...
//				</div>
//				<div class="ribbon">
//					<div class="image" gid="c"></div>
//
//					<!-- current image -->
//					<div class="current image" gid="d"></div>
//
//					<!-- image with mark... -->
//					<div class="image" gid="e"></div>
//					<div class="mark selected" gid="f"></div>
//
//					<div class="image" gid="g"></div>
//
//					...
//				</div>
//				...
//			</div>
//		</div>
//	</div>
//
//
// NOTE: there can be only one .ribbon-set element.
// NOTE: other elements can exist in the structure, but as long as they
// 		use different CSS classes they are ignored by the system, note 
// 		that such elements may affect alignment and placement though this
// 		should be obvious ;)
//
//
//
/*********************************************************************/

var BaseRibbonsClassPrototype = {
	// utils...
	px2v: function(px, mode){
		var ref = mode == 'vw' ? 
				document.body.offsetWidth
			: mode == 'vh' ? 
				document.body.offsetHeight
			: mode == 'vmin' ? 
				Math.min(document.body.offsetWidth, document.body.offsetHeight)
			: mode == 'vmax' ? 
				Math.max(document.body.offsetWidth, document.body.offsetHeight)
			: null
		return ref ? 
			(px / ref) * 100 
			: ref },
	px2vw: function(px){ return this.px2v(px, 'vw') },
	px2vh: function(px){ return this.px2v(px, 'vh') },
	px2vmin: function(px){ return this.px2v(px, 'vmin') },
	px2vmax: function(px){ return this.px2v(px, 'vmax') },

	// Generic getters...
	elemGID: function(elem, gid){
		// get gid...
		return (gid == null || gid == '?') ?
				JSON.parse('"' 
					+ (elem instanceof jQuery ? 
							elem.attr('gid') 
						: elem.getAttribute('gid'))
					+ '"')
			// remove gid...
			: gid == '' ? 
				$(elem)
					.removesAttr('gid')
			// set gid...
			: $(elem)
				.attr('gid', 
					JSON.stringify(gid)
						// this removes the extra quots...
						.replace(/^"(.*)"$/g, '$1')) },
} 

var BaseRibbonsPrototype = {
	//
	//	.viewer (jQuery object)
	//
	//	.images (Images object)
	//
	// XXX to update images we need to know about images...
	
	__init__: function(viewer, images){
		this.viewer = $(viewer)
		this.images = images },

	// utils...
	px2v: BaseRibbonsClassPrototype.px2v,
	px2vw: BaseRibbonsClassPrototype.px2vw,
	px2vh: BaseRibbonsClassPrototype.px2vh,
	px2vmin: BaseRibbonsClassPrototype.px2vmin,
	px2vmax: BaseRibbonsClassPrototype.px2vmax,


	// Generic getters...
	elemGID: BaseRibbonsClassPrototype.elemGID,


	get parent(){
		return this.__parent },
	// NOTE: this will reset locally referenced .images to .parent.images
	set parent(parent){
		this.__parent = parent
		delete this.__images },

	// maintain images in .parent.images if available...
	//
	// NOTE: images can be stored locally if no parent is set but will 
	// 		get overridden as soon as .parent is set.
	get images(){
		return this.parent ? this.parent.images : this.__images },
	set images(images){
		if(this.parent){
			this.parent.images = images
			delete this.__images
		} else {
			this.__images = images } },

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
			return this }
		var t = target[0]

		// handle nesting...
		var l = t.getAttribute('__prevent_transitions')
		if(l != null){
			t.setAttribute('__prevent_transitions', parseInt(l)+1)
			return this
		}
		t.setAttribute('__prevent_transitions', 0)

		target.addClass('no-transitions')

		var s = getComputedStyle(t)
		s.webkitTransition
		s.mozTransition
		s.msTransition
		s.oTransition
		s.transition

		return this },

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
			target = target || this.viewer }
		if(target.length == 0){
			return this }
		var t = target[0]

		// sync...
		if(now){
			// handle nesting...
			var l = t.getAttribute('__prevent_transitions')
			if(l != null && !force && l != '0'){
				t.setAttribute('__prevent_transitions', parseInt(l)-1)
				return this }
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
					t.setAttribute('__prevent_transitions', l-1)
					return this }
				t.removeAttribute('__prevent_transitions')

				target.removeClass('no-transitions')

				var s = getComputedStyle(t)
				s.webkitTransition
				s.mozTransition
				s.msTransition
				s.oTransition
				s.transition
			}, 0) }

		return this },

	// Shorthand wrappers of the above...
	//
	// XXX do we need custom target support here???
	noTransitions: function(func){
		this.preventTransitions()
		func.apply(this, [...arguments].slice(1))
		this.restoreTransitions(true)
		return this },
	noTransitionsDeep: function(func){
		this.preventTransitions(null, true)
		func.apply(this, [...arguments].slice(1))
		this.restoreTransitions(true)
		return this },


	// Scale...
	//
	// 	Get scale...
	// 	.scale()
	// 		-> <scale>
	//
	// 	Set scale...
	// 	.scale(<scale>)
	// 		-> <ribbons>
	//
	// NOTE: this will also set origin...
	//
	// XXX if chrome 38 renders images blurry uncomment the fix...
	scale: function(scale){
		// get...
		if(arguments.length == 0){
			return this.getRibbonSet().scale() || 1 }

		// set...
		var ribbon_set = this.getRibbonSet()  

		if(ribbon_set.length == 0){
			return this }

		ribbon_set.scale(scale)

		return this },

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
	// XXX this depends on .createImage(..)
	getVisibleImageSize: function(dim, scale, img, force){
		dim = dim == null ? 'width' : dim
		img = img || this.viewer.find(IMAGE)

		var tmp

// 		// XXX size cache -- not sure if this needs to be cached...
//		var res = (this.__visible_image_size_cache || {})[dim]
//
//		if(this.__visible_image_size_cache == false 
//				|| img.length > 0 
//				|| force 
//				|| res == null){

			// if no images are loaded create one temporarily....
			if(img.length == 0){
				img = tmp = $(this.createImage('__tmp_image__'))
					.css({
						position: 'absolute',
						visibility: 'hidden',
						top: '-200%',
						left: '-200%',
					})
					.appendTo(this.viewer) }

			// account for image rotation...
			// NOTE: this way we do not need to account for margins...
			var o = img.attr('orientation')
			o = o == null ? 0 : o
			dim = o == 0 || o == 180 ? dim 
				// swap width/height when image is rotated +/- 90deg...
				: dim == 'height' ? 'width' 
				: 'height'

			// do the calc...
			scale = scale || this.scale()
			var css = getComputedStyle(img[0])
			var res = dim == 'height' ? parseFloat(css.height)
				: dim == 'width' ? parseFloat(css.width)
				: dim == 'max' ?  Math.max(parseFloat(css.height), parseFloat(css.width))
				: dim == 'min' ?  Math.min(parseFloat(css.height), parseFloat(css.width))
				: null

// 			// XXX size cache -- not sure if this needs to be cached...
//			if(this.__visible_image_size_cache != false){
//				var cache = this.__visible_image_size_cache = this.__visible_image_size_cache || {}
//				cache[dim] = res
//			}
//		}

		// get size for given scale...
		res = res ? res * scale : res

		// remove the tmp image we created...
		if(tmp != null){
			tmp.remove() }

		return res },

	getScreenWidthImages: function(scale, min){
		scale = scale || this.scale()

		var W = this.viewer.width()
		var w = this.getVisibleImageSize(min ? 'min' : 'width', scale)

		return W/w },
	// XXX this does not account for ribbon spacing...
	getScreenHeightRibbons: function(scale){
		scale = scale || this.scale()

		var H = this.viewer.height()
		var h = this.getVisibleImageSize('height', scale)

		return H/h },

	// Fit image to view...
	//
	// If n is given this will fit n images (default: 1)
	//
	// NOTE: this will never scale the view in a way that an image 
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
			scale = H/h }

		this
			.scale(scale)
			//.centerRibbon(null, null, scale)
			//.centerImage(null, null, null, scale)
		
		return this },
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
			scale = W/w }

		// shift the scale to the point where screen width is a whole 
		// number of images...
		if(fit_whole_images){
			var d = this.getScreenWidthImages(scale)
			d = d / Math.ceil(d)

			scale *= d }

		this.scale(scale)

		return this },


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
	// XXX revise...
	getRibbonSet: function(create){
		// ribbon set...
		var ribbon_set = this.viewer.find('.ribbon-set')
		if(create && ribbon_set.length == 0){
			ribbon_set = $('<div/>')
				.addClass('ribbon-set')
				.appendTo(this.viewer) }

		// ribbon locator...
		var locator = ribbon_set.find('.ribbon-locator')
		if(create && locator.length == 0){
			ribbon_set
				.append($('<div/>')
					.addClass('ribbon-locator')) }

		return ribbon_set },
	getRibbonLocator: function(create){
		return this.getRibbonSet(create)
			.find('.ribbon-locator') },

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
			target = 'current' }
		
		// get the base image...
		// current...
		if(target == null || target == 'current') {
			img = this.viewer.find('.current'+IMAGE)

		// gid...
		} else if(typeof(target) == typeof('str')){
			//return this.viewer.find('.image[gid="'+JSON.stringify(target)+'"]')
			img = this.viewer.find(IMAGE+'[gid='+JSON.stringify(target)+']') }

		// we got a collection...
		if(img == null){
			return $(target).filter(IMAGE) }

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
			img = res.length == 0 ? img : res }

		return img },

	// Get images...
	//
	// 	.getImages()
	// 		-> images
	//
	// 	.getImages(jquery)
	// 	.getImages(ribbon)
	// 		-> images
	//
	// 	.getImages(ribbon-gid)
	// 		-> images
	//
	getImages: function(target){
		return (target instanceof jQuery ?
					target
				// gid...
				: target ?
					this.viewer.find(RIBBON + '[gid='+ target +']')
				// viewer...
				: this.viewer)
			.find(IMAGE) },
	// same as .getImages(..) but returns a list of gids...
	getImageGIDs: function(target){
		return this.getImages(...arguments)
			.map(function(_, e){
				return e.getAttribute('gid') })
   			.toArray() },

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
		var gid = typeof(img) == typeof('str') ? img : null
		gid = gid == null ? this.elemGID(img) : gid

		var marks = this.viewer.find('.mark[gid='+JSON.stringify(gid)+']')

		if(cls != null){
			return marks.filter('.'+cls) }
		return marks },

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
			if(target.length == 0){
				return $() }
			var w = target.hasClass('image') ? 
				this.getVisibleImageSize('width', null, target) : 
				target.outerWidth()
			// NOTE: we will need delta only in this branch, i.e. when
			// 		position is either 'current', 'center' or a jQuery 
			// 		object...
			delta = delta || w / 10
			target = target.offset().left + w/2 }

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
					return }

				// distance between centers...
				if(position == 'center' || position == 'current'){
					return [target - (l + w/2), img]

				// distance between left edges...
				} else if(position == 'left'){
					return [target - l, img]

				// distance between right edges...
				} else {
					return [target - (l + w), img] } })
			// drop images outside the viewer...
			.filter(function(e){ 
				return e != null })
			// sort images by distance...
			.sort(function(a, b){ 
				return Math.abs(a[0]) - Math.abs(b[0]) })

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
			return res[0] ? res[0][1] : null } },

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
				return this.viewer.find(RIBBON).first() }
			return r

		// index...
		} else if(typeof(target) == typeof(123)){
			return this.viewer.find(RIBBON).eq(target)

		// gid...
		} else if(typeof(target) == typeof('str')){
			//return this.viewer.find('.ribbon[gid="'+JSON.stringify(target)+'"]')
			var r = this.viewer.find('.ribbon[gid='+JSON.stringify(target)+']:not(.clone)')
			// if no ribbon is found, try and get an image and it's ribbon...
			return r.length == 0 
				? this.getImage(target).parents('.ribbon').first()
				: r
		}
		return $(target).filter(RIBBON) },
	// Like .getRibbon(..) but returns ribbon index instead of the actual 
	// ribbon object...
	getRibbonOrder: function(target){
		return this.viewer.find(RIBBON).index(this.getRibbon(target)) },


	// Image info...
	//
	// NOTE: these are simply shorthands to image attr access...
	getImageRotation: function(target){
		return (this.getImage(target).attr('orientation') || 0)*1 },
	getImageFlip: function(target){
		return (this.getImage(target).attr('flipped') || '')
			.split(',')
			.map(function(e){ return e.trim() })
			.filter(function(e){ return e != '' }) },


	// UI manipulation...
	
	// Compensate for viewer proportioned and rotated images.
	//
	// This will set the margins so as to make the rotated image offset the
	// same space as it is occupying visually...
	//
	// NOTE: this is not needed for square image blocks.
	// NOTE: if an image block is square, this will remove the margins.
	//
	// XXX this does the same job as features/ui-single-image.js' .updateImageProportions(..)
	_calcImageProportions: function(image, W, H, w, h, o){
		image = image instanceof jQuery ? image[0] : image

		//var s = (!w || !h) ? getComputedStyle(image) : null
		//w = w || parseFloat(s.width)
		//h = h || parseFloat(s.height) 
		//w = this.px2vmin(w || image.offsetWidth)
		//h = this.px2vmin(h || image.offsetHeight)
		w = w || image.offsetWidth
		h = h || image.offsetHeight

		// non-square image...
		if(w != h){
			W = W || this.viewer.innerWidth()
			H = H || this.viewer.innerHeight()
			o = o || image.getAttribute('orientation') || 0

			var viewer_p = W > H ? 'landscape' : 'portrait'

			// NOTE: we need to use the default (CSS) value when 
			// 		possible, to avoid sizing issues...
			var dfl_w = image.style.width == ''
			var dfl_h = image.style.height == ''

			var image_p = w > h ? 'landscape' : 'portrait'

			// when the image is turned 90deg/270deg and its 
			// proportions are the same as the screen...
			if((o == 90 || o == 270) && image_p == viewer_p){
				return {
					width: dfl_h ? '' : (this.px2vmin(h) + 'vmin'),
					height: dfl_w ? '' : (this.px2vmin(w) + 'vmin'),
					margin: 
						this.px2vmin(-((w - h)/2)) +'vmin '
						+ this.px2vmin((w - h)/2) + 'vmin',
				}

			} else if((o == 0 || o == 180) && image_p != viewer_p){
				return {
					width: dfl_h ? '' : (this.px2vmin(h) + 'vmin'),
					height: dfl_w ? '' : (this.px2vmin(w) + 'vmin'),
					margin: '',
				} }

		// square image...
		} else {
			return {
				width: '',
				height: '',
				margin: '',
			} } },
	correctImageProportionsForRotation: function(images, W, H){
		var that = this
		W = W || this.viewer.innerWidth()
		H = H || this.viewer.innerHeight()

		var images = images || this.viewer.find(IMAGE)

		return $(images).each(function(i, e){
			var data = that._calcImageProportions(this, W, H)

			data 
				&& $(this).css(data) }) },

	// center a ribbon vertically...
	//
	// 	Center current ribbon...
	// 	.centerRibbon()
	// 		-> Ribbons
	//
	// 	Center specific ribbon...
	// 	.centerRibbon(image)
	// 	.centerRibbon(ribbon)
	// 		-> Ribbons
	// 
	centerRibbon: function(target){
		var ribbon = this.getRibbon(target)
		var locator = this.getRibbonLocator() 

		if(locator.length == 0 || ribbon.length == 0){
			return this }

		// NOTE: we need to use the same unit here as is used to size 
		// 		the image blocks...
		var unit = 'vmin'

		var t = ribbon[0].offsetTop
		var h = ribbon[0].offsetHeight

		locator.transform({ x: 0, y: this.px2v(-(t + h/2), unit) + unit, z: 0 }) 

		return this },

	// center an image horizontally...
	// 
	// 	Center current ribbon/image...
	// 	.centerImage()
	// 		-> Ribbons
	//
	// 	Center specific image...
	// 	.centerImage(image)
	// 	.centerImage(image, 'center')
	// 		-> Ribbons
	//
	// 	Center ribbon before/after an image...
	// 	.centerImage(image, 'before')
	// 	.centerImage(image, 'after')
	// 		-> Ribbons
	//
	centerImage: function(target, mode){
		target = this.getImage(target)
		var ribbon = this.getRibbon(target)

		if(ribbon.length == 0){
			return this }

		var l = target[0].offsetLeft
		var w = target[0].offsetWidth

		var image_offset = mode == 'before' ? 0
			: mode == 'after' ? w
			: w/2

		ribbon.transform({x: -this.px2vmin(l + image_offset) + 'vmin', y: 0, z: 0}) 

		return this },
}

var BaseRibbons = 
module.BaseRibbons = 
	object.Constructor('BaseRibbons', 
		BaseRibbonsClassPrototype, 
		BaseRibbonsPrototype)



//---------------------------------------------------------------------

var RibbonsClassPrototype = {
	// DOM Constructors...
	// NOTE: these will return unattached objects...
	createViewer: function(){
		return $('<div>')
			.addClass('viewer')
			.attr('tabindex', 0)
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

			return that.elemGID($('<div>')
				.addClass('ribbon'), gid)[0]
			//return $('<div>')
			//	.addClass('ribbon-container')
			//	.append(that.elemGID($('<div>')
			//		.addClass('ribbon'), gid))[0]
		})) },
	// XXX NOTE: quots removal might render this incompatible with older data formats...
	createImage: function(gids){
		gids = gids || []
		gids = gids.constructor !== Array ? [gids] : gids
		var that = this
		return $(gids.map(function(gid){
			gid = gid != null ? gid+'' : gid
			return that.elemGID($('<div>')
					.addClass('image'), gid)[0] })) },
	createMark: function(cls, gid){
		gid = gid != null ? gid+'' : gid
		return this.elemGID($('<div class="mark">')
			.addClass(cls), gid) },
}
RibbonsClassPrototype.__proto__ = BaseRibbonsClassPrototype

var RibbonsPrototype = {
	// XXX
	clone: function(){
		var o = new this.constructor()
		if(this.viewer){
			// XXX does this completely detach from the orriginal???
			// XXX do we need to reattach something???
			o.viewer = this.viewer.clone() }
		if(this.images){
			o.images = this.images.clone() }
		return o },

	// Constructors...
	createViewer: RibbonsClassPrototype.createViewer,
	createRibbon: RibbonsClassPrototype.createRibbon,
	createImage: RibbonsClassPrototype.createImage,
	createMark: RibbonsClassPrototype.createMark,

	// Rotate...
	//
	//	Get ribbon rotation angle...
	//	.rotate()
	//		-> angle
	//
	//	Rotate to angle...
	//	.rotate(20)
	//	.rotate(-10)
	//		-> ribbons
	//
	//	Rotate by angle...
	//	.rotate('-=20')
	//	.rotate('+=30')
	//		-> ribbons
	//
	// NOTE: the angles are not base 360 normalised...
	// NOTE: units are ignored and the final angle is always in deg.
	rotate: function(angle){
		// get...
		if(arguments.length == 0){
			return this.getRibbonSet().rotate() }

		// set...
		var ribbon_set = this.getRibbonSet()  

		if(ribbon_set.length == 0){
			return this }

		angle = typeof(angle) == typeof('str')
			? (/^\+=/.test(angle) ? (ribbon_set.rotate() || 0) + parseFloat(angle.slice(2))
				:/^\-=/.test(angle) ? (ribbon_set.rotate() || 0) - parseFloat(angle.slice(2))
				: parseFloat(angle))
			: angle

		ribbon_set.rotate(angle)

		return this },
	
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
	// XXX add duration configuration...
	// XXX should we also have a ribbon shadow???
	// XXX when this cant find a target it will return an empty function,
	// 		not sure if this is correct...
	// XXX should we use transforms instead of css positions???
	makeShadow: function(target, animate, delay, start_delay){
		delay = delay || 200
		start_delay = start_delay || 10

		var img = this.getImage(target)

		if(img.length == 0){
			// XXX is this correct???
			return function(){} }

		var gid = this.elemGID(img)
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
			var shadow = $('<div>')
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
						.attr('gid', null))
				.scale(s)
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
				.appendTo(this.viewer) }

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
					if(start_delay){
						setTimeout(function(){
							shadow.css({
								top: io.top - vo.top,
								left: io.left - vo.left,
							})
						}, start_delay)

					} else {
						shadow.css({
							top: io.top - vo.top,
							left: io.left - vo.left,
						}) } }
				setTimeout(function(){
					// remove only the item with the correct ticket...
					if(ticket == shadow.attr('ticket')){
						img.removeClass('moving')
						shadow.remove() } }, delay) }
			return img } },


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
		var ribbon_set = this.getRibbonLocator(true) 

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
			return ribbon }

		// place the ribbon...
		if(ribbons.length == 0 || ribbons.length <= position){
			ribbon_set.append(ribbon)

		} else if(i == -1 || i > position) {
			// XXX need to compensate for offset???
			ribbons.eq(position).before(ribbon)

		// for placing after need to account for target ribbon removal...
		} else if(i < position) {
			ribbons.eq(position).after(ribbon) }

		// XXX do we need to update the ribbon here???
		return ribbon },

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
			return }

		target = target == null || target.constructor !== Array ? [target] : target

		// get or make images...
		var that = this
		var img = $($(target)
			.map(function(_, e){
				var i = that.getImage(e)
				return (i.length == 0 ? that.createImage(e) : i)[0] }))
	
		var i = this.getImage(to)
		var r = this.getRibbon(to)

		// offset on same ribbon...
		if(typeof(to) == typeof(123)){
			// moving the image to itself...
			if(to == 0){
				return img }
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
				r.prepend(img) }
			return this.updateImage(img)

		// relative to image...
		} else {
			var i = mode == 'before' ? -1 : 1
			to = this.getImage(to)
			// moving the image to itself...
			if(to[0] == img[0]){
				return img }
			var images = to[mode](IMAGE) }

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
				.before(img) }

		// cleanup source ribbons...
		this.clearEmptyRibbons()

		return this.updateImage(img) },


	// Loading and updating...

	// Replace image gid...
	//
	// XXX should this work for ribbon gids???
	replaceGid: function(from, to){
		var img = this.getImage(from)

		img && img.length > 0 
			&& this.elemGID(img, to)

		return this },

	// XXX is .__image_updaters the right way to go???
	callImageUpdaters: function(gid, image, options){
		gid = gid == null ? this.elemGID() : gid
		image = image == null ? this.getImage() : $(image)

		// collect marks...
		image.after(this.getImageMarks(gid))

		;(this.__image_updaters || [])
			.forEach(function(update){
				update(gid, image, options) })
		return image },

	_loadImagePreviewURL: function(image, url, other, callback){
		url = util.path2url(url)
		// pre-cache and load image...
		// NOTE: this will make images load without a blackout...
		var img = new Image()
		var i = image instanceof jQuery ? image[0] : image
		img.onload = function(){
			i.style.backgroundImage = 'url("'+ img.src +'")',
			// NOTE: these do not account for rotation...
			i.setAttribute('preview-width', img.width)
			i.setAttribute('preview-height', img.height) }
		// error -> try other images -> load placeholder...
		img.onerror = function(){
			other = other instanceof Function ?
				[...other(), images.MISSING]
				: other
			other 
				&& other.length > 0
				&& (img.src = other.shift()) 
			// call the callback once...
			callback
				&& callback() 
			callback = null }
		img.src = url
		return img },

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
	//
	// options format:
	// 	{
	// 		nochrome: <bool>,
	//
	// 		pre_updaters_callback: <function>,
	// 	}
	//
	// NOTE: this can update collections of images by passing either a 
	// 		list of gids, images or a jQuery collection...
	// NOTE: pre_updaters_callback if given is called after image is fully
	// 		constructed but before .callImageUpdaters(..) is called...
	//
	// If this is set to true image previews will be loaded synchronously...
	load_img_sync: false,
	// handle image load errors...
	// XXX revise...
	imageLoadErrorCallback: undefined,
	//
	// XXX this depends on .images...
	// 		...a good candidate to move to images, but not yet sure...
	// XXX things to inline:
	// 		.gid
	// 		.style.backgroundImage
	//
	// 		.getImageMarks(..)
	//
	// 		.rotateImage(..)
	// 		.flipImage(..)
	// 		._loadImagePreviewURL(..)
	// 		.correctImageProportionsForRotation(..)
	//
	// 		.callImageUpdaters(..)
	//
	// XXX add options for images to preload and only then do the update...
	// XXX really slow for very large numbers of input images/gids...
	// XXX add support for basic image templating here...
	// 		...templates for blank images, text blocks and other stuff,
	// 		this would best be done by simply filling in SVG templates...
	updateImage: function(image, gid, size, sync, options){
		var that = this
		var imgs = this.viewer.find(IMAGE)

		options = options || {}
		var pre_updaters_callback = options.pre_updaters_callback
		var error_update_callback = options.error_update_callback
			|| this.imageLoadErrorCallback
		error_update_callback = error_update_callback 
			&& error_update_callback.bind(this)

		// reduce the length of input image set...
		// NOTE: this will make things substantially faster for very large
		// 		input sets...
		if(image instanceof Array && image.length > imgs.length){
			image = imgs
				.filter(function(_, img){
					return image.indexOf(img) >= 0
						|| image.indexOf(that.elemGID(img)) >= 0 })
				.map(function(_, img){
					return that.elemGID(img) })
				.toArray() }
		// normalize...
		image = image == '*' ? 
				imgs
			: (image == null || typeof(image) == typeof('str')) ? 
				this.getImage(image)
			: $(image)
		sync = sync == null ? this.load_img_sync : sync
		size = size == null ? this.getVisibleImageSize('max') : size

		var update = {}

		// build update data...
		image.map(function(_, image){
			image = typeof(image) == typeof('str') ? 
				that.getImage(image) 
				: $(image)
			if(image.length == 0){
				return
			}
			var old_gid = that.elemGID(image)
			var data = update[old_gid] = {
				image: image,
				attrs: {},
				style: {},
			}
			var reset_preview = false

			// same image -- update...
			if(old_gid == gid || gid == null){
				// XXX BUG: we are actually ignoring gid...
				var gid = old_gid

			// reuse for different image -- reconstruct...
			} else {
				// remove old marks...
				typeof(old_gid) == typeof('str')
					&& that.getImageMarks(old_gid).remove()
				// reset gid...
				data.attrs = {
					gid: JSON.stringify(gid)
						// this removes the extra quots...
						.replace(/^"(.*)"$/g, '$1'),
				}
				reset_preview = true }
			data.gid = gid

			// if no images data defined drop out...
			if(that.images == null){
				return }

			// image data...
			var img_data = that.images[gid] || images.IMAGE_DATA
			// if we are a group, get the cover...
			// NOTE: groups can be nested...
			var seen = []
			while(img_data.type == 'group'){
				// error, recursive group...
				if(seen.indexOf(img_data.id) >= 0){
					img_data = images.IMAGE_DATA
					console.error('Recursive group:', gid)
					break }
				seen.push(img_data.id)
				img_data = that.images[img_data.cover] }

			// image state...
			data.attrs.orientation = img_data.orientation == null ? '' : img_data.orientation*1
			data.attrs.flipped = (img_data.flipped == null ? [] : img_data.flipped).join(', ')
			//will_change.push('transform')

			// stage background image update...
			// XXX add support for basic templating here...
			var p_url = (that.images.getBestPreview(img_data.id, size, img_data, true) || {}).url
			// XXX sort the previews by size...
			var alt_url = function(){
				return [...Object.values(img_data.preview || {}), img_data.path]
					.map(function(u){ 
						return (img_data.base_path || '') + u })
					.filter(function(u){ return u != p_url }) }
			// no preview -> reset bg...
			if(p_url == null){
				image[0].style.backgroundImage = ''

			} else if(old_gid != gid 
					// the new preview (p_url) is different to current...
					// NOTE: this may not work correctly for relative urls...
					|| image.css('background-image').indexOf(util.path2url(p_url)) < 0){
				//will_change.push('background-image')
				reset_preview
					&& (image[0].style.backgroundImage = '')

				// sync...
				if(sync){
					that._loadImagePreviewURL(
						image, 
						p_url, 
						alt_url, 
						error_update_callback)

				// async...
				// NOTE: storing the url in .data() makes the image load the 
				// 		last requested preview and in a case when we manage to 
				// 		call updateImage(...) on the same element multiple times 
				// 		before the previews get loaded...
				// 		...setting the data().loading is sync while loading an 
				// 		image is not, and if several loads are done in sequence
				// 		there is no guarantee that they will happen in the same
				// 		order as requested...
				} else {
					image.data().loading = p_url
					setTimeout(function(){ 
						that._loadImagePreviewURL(
							image, 
							image.data().loading, 
							alt_url, 
							error_update_callback) }, 0) } } })

		var W = this.viewer.innerWidth()
		var H = this.viewer.innerHeight()

		// do the update...
		return $(Object.keys(update).map(function(gid){
			var data = update[gid]
			var img = data.image
			var _img = img[0]
			var attrs = data.attrs
			var css = data.style

			attrs && img.attr(attrs)
			css && img.css(css)

			that.correctImageProportionsForRotation(img, W, H)
			pre_updaters_callback 
				&& pre_updaters_callback.call(that, image, data)
			that.callImageUpdaters(data.gid, img, options)

			return _img })) },

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
			r = this.createRibbon(ribbon) }

		var loaded = r.find(IMAGE)

		// compensate for new/removed images...
		if(reference != null){
			var ref = this.getImage(reference)

			// align only if ref is loaded...
			if(ref.length > 0){
				var gid = this.elemGID(ref)
				var W = Math.min(document.body.offsetWidth, document.body.offsetHeight)
				var w = this.getVisibleImageSize('width', 1, ref) / W * 100

				// calculate offset...
				// NOTE: this will not work for non-square images...
				var dl = loaded.index(ref) - gids.indexOf(gid)

				if(dl != 0){
					var x = parseFloat((r.transform('translate3d') || [0])[0]) + w * dl
					r.transform({x: x + 'vmin', y: 0, z: 0}) } } }

		// remove all images that we do not need...
		var unloaded = []
		var unload_marks = []
		loaded = loaded
			.filter(function(i, img){ 
				var g = that.elemGID(img)
				if(gids.indexOf(g) >= 0){
					return true }
				unloaded.push(img)
				unload_marks = unload_marks.concat(that.getImageMarks(g).toArray())
				return false })

		// detach/remove everything in one go...
		$(unloaded)
			.detach()
			.removeClass('moving current')
			// blank out images to prevent wrong image flashing...
			.css('background-image', 'none')
		// clear marks...
		$(unload_marks)
			.remove()

		var images = []
		$(gids).each(function(i, gid){
			// support for sparse ribbons...
			if(gid == null){
				return }
			// get/create image...
			// NOTE: as this will get a loaded image if it's loaded in 
			// 		a different ribbon this WILL affect that ribbon...
			var img = that.getImage(gid)
			if(img.length == 0){
				img = unloaded.length > 0 
					// reuse an image we just detached...
					? that.elemGID(unloaded.pop(), gid) 
					// create a new image...
					: that.createImage(gid) }

			// see of we are loaded in the right position...
			// NOTE: loaded is maintained current later, thus it always 
			// 		contains a set of images representative of the ribbon...
			var g = loaded.length > i ? that.elemGID(loaded.eq(i)) : null

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
					loaded.splice(i, 0, img) } }

			images.push(img[0]) })

		// XXX this appears to be the bottleneck on large numbers of images...
		this.updateImage($(images))

		if(place){
			this.placeRibbon(r, this.viewer.find(RIBBON).length) }

		return this },

	// NOTE: reference must be both present in the loaded ribbon and in
	// 		the given gids...
	updateRibbonInPlace: function(gids, ribbon, reference){
		var that = this
		var r = this.getRibbon(ribbon)
		var loaded = r.find(IMAGE)
		gids = gids.slice(0, loaded.length)

		// update offset...
		if(reference != null){
			var ref = this.getImage(reference)

			// align only if ref is loaded...
			if(ref.length > 0){
				var gid = this.elemGID(ref)
				var W = Math.min(document.body.offsetWidth, document.body.offsetHeight)
				var w = this.getVisibleImageSize('width', 1, ref) / W * 100

				// calculate offset...
				// NOTE: this will not work for non-square images...
				var dl = loaded.index(ref) - gids.indexOf(gid)

				if(dl != 0){
					var x = parseFloat((r.transform('translate3d') || [0])[0]) + w * dl
					r.transform({x: x + 'vmin', y: 0, z: 0}) } } }

		// update gids...
		var unload_marks = []
		for(var i = 0; i < gids.length; i++){
			var gid = gids[i]
		//gids
		//	.forEach(function(gid, i){ 
				if(gid !== undefined){
					var img = loaded.eq(i)

					// cleanup marks...
					var g = that.elemGID(img)
					unload_marks = gids.indexOf(g) < 0 ?
						unload_marks.concat(that.getImageMarks(g).toArray())
						: unload_marks

					// XXX for some reason this is smoother than:
					// 		gid && that.updateImage(img, gid)
					gid && that.updateImage(that.elemGID(img, gid)) }
		//	})
		}
		$(unload_marks)
			.remove()

		return this },

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
	//
	// XXX revize offset compensation + cleanup...
	// 		...at this point offset compensation animates...
	resizeRibbon: function(ribbon, left, right, transitions, reference){
		ribbon = this.getRibbon(ribbon)
		left = left || 0
		right = right || 0
		reference = this.getImage(reference)
		
		var W = Math.min(document.body.offsetWidth, document.body.offsetHeight)
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
						that.getImageMarks(that.elemGID(img)).toArray()) })
				
			// clear stuff...
			$(marks)
				.remove()
			unloaded
				.detach()
				.removeClass('moving current')
				// blank out images to prevent wrong image flashing 
				// when reusing...
				.css('background-image', 'none') } 

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
						that.getImageMarks(that.elemGID(img)).toArray()) })

			// calculate the compensation...
			// XXX this assumes that all widths are equal...
			// 		...we can't calculate image width unless it is attached...
			//var l = -left * (reference.outerWidth() / scale)
			//var l = -left * w

			// clear stuff...
			$(marks)
				.remove()

			requestAnimationFrame(function(){
				transitions || that.preventTransitions(ribbon)

				var a = images[-left].offsetLeft

				unloaded
					.detach()
					.removeClass('moving current')
					// blank out images to prevent wrong image flashing 
					// when reusing...
					.css('background-image', 'none')

				// compensate for the offset...
				var b = images[-left].offsetLeft
				var d = ((a - b) / W) * 100
				var x = parseFloat((ribbon.transform('translate3d') || [0])[0]) + d

				ribbon.transform({x: x + 'vmin', y: 0, z: 0})

				transitions || that.restoreTransitions(ribbon, true) }) }

		// grow right...
		if(right.length > 0 || right > 0){
			var c = right.length || right

			// build set of empty images...
			var loading = unloaded.slice(0, c)
			while(loading.length < c){
				loading.push(that.createImage([''])[0]) }

			// update images...
			right instanceof Array && right.forEach(function(gid, i){
				var img = loading.eq(i)
				that.elemGID(img, gid) 
				// XXX for some reason this does not add indicators...
				that.updateImage(img) })

			ribbon.append(loading)

			// XXX this is here to update the indicators...
			// 		...indicators seem to not be attached above...
			loading.each(function(_, img){
				that.updateImage(img) }) }

		// grow left...
		// NOTE: this affects ribbon placement, thus we'll need to compensate...
		if(left.length > 0 || left > 0){
			var c = left.length || left

			// build set of empty images...
			var loading = unloaded.slice(0, c)
			while(loading.length < c){
				loading.push(that.createImage([''])[0]) }

			// update images...
			left instanceof Array && left.forEach(function(gid, i){
				var img = loading.eq(i)
				that.elemGID(img, gid) 
				// XXX for some reason this does not add indicators...
				that.updateImage(img) })

			// calculate the compensation...
			// XXX this assumes that all widths are equal...
			// 		...we can't calculate image with unless it is attached...
			//var l = c * (reference.outerWidth() / scale)
			//var l = c * w 

			requestAnimationFrame(function(){
				transitions || that.preventTransitions(ribbon)

				// XXX is this the correct reference item -- can it be deleted above???
				var a = images[0].offsetLeft

				ribbon.prepend(loading)

				// XXX this is here to update the indicators...
				// 		...indicators seem to not be attached above...
				loading.each(function(_, img){
					that.updateImage(img) })

				// compensate for the offset...
				// XXX is this the correct reference item -- can it be deleted above???
				var b = images[0].offsetLeft
				var d = ((a - b) / W) * 100
				var x = parseFloat((ribbon.transform('translate3d') || [0])[0]) + d

				ribbon.transform({x: x + 'vmin', y: 0, z: 0})

				transitions || that.restoreTransitions(ribbon, true) }) }

		return this },

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
				updateRibbon(data.ribbons[gid], gid) }) }

		// place ribbons...
		if(data.ribbon_order != null){
			data.ribbon_order.forEach(function(gid, i){
				that.placeRibbon(gid, i) }) }

		if(!settings.keep_all){
			// set base ribbon...
			if(!settings.keep_base && data.base != null){
				this.setBaseRibbon(data.base) }

			// set base ribbon...
			if(!settings.keep_current && data.current != null){
				this.focusImage(data.current) }

			// clear the ribbons that did not get updated...
			if(!settings.keep_ribbons 
					&& (data.ribbon_order != null || data.ribbons != null)){
				var ribbons = data.ribbon_order != null ? data.ribbon_order.slice() 
					: data.ribbons != null ? Object.keys(data.ribbons)
					: []

				that.viewer.find(RIBBON).each(function(){
					var r = $(this)
					if(ribbons.indexOf(that.elemGID(r)) < 0){
						r.remove() } }) } }

		return this },

	clearEmptyRibbons: function(){
		this.viewer.find(RIBBON)
			.filter(function(_, e){
				return $(e).children().length == 0 })
			.remove()
		return this },

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
		// clear all...
		if(gids == 'full' || gids == '*' || gids == null){
			this.getRibbonSet().remove()

		// clear one or more gids...
		} else {
			gids = gids.constructor !== Array ? [gids] : gids
			var that = this
			gids.forEach(function(g){
				that.viewer.find('[gid='+JSON.stringify(g)+']').detach() }) }
		return this },


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
			.find('.current'+IMAGE)
		var next = this.getImage(target)

		cur.removeClass('current')
		return next.addClass('current') },

	// Set base ribbon...
	//
	// XXX is this really needed here???
	// XXX should this support keywords a-la .focusImage(..)???
	setBaseRibbon: function(gid){
		this.viewer.find('.base.ribbon').removeClass('base')
		return this.getRibbon(gid).addClass('base') },


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
		if(cls == null || ['toggle', 'on', 'off', '?'].includes(cls)){
			action = cls
			cls = image
			image = null }
		image = this.getImage(image) 
		cls = cls.constructor !== Array ? [cls] : cls
		action = action == null ? 'toggle' : action

		// no image is loaded...
		if(image.length == 0){
			return }

		// get marked state...
		if(action == '?'){
			var gid = this.elemGID(image)
			var res = 0
			cls.forEach(function(cls){
				res += that.getImageMarks(gid, cls).length != 0 ? 1 : 0 })
			return res == cls.length ? 'on' : 'off' }

		// set the marks...
		image.each(function(){
			var image = $(this)
			var gid = that.elemGID(image)
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
					mark.remove() } }) })

		return image },

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
			return target }

		var that = this
		$(target).each(function(i, e){
			var img = that.getImage(e)
			var o = (direction == 'cw' || direction == 'ccw')
				? images.calcRelativeRotation(img.attr('orientation'), direction)
				: direction*1
			if(o == 0){
				img.removeAttr('orientation')
			} else {
				img.attr('orientation', o) }
			// account for proportions...
			that.correctImageProportionsForRotation(img)
			// XXX this is a bit of an overkill but it will update the 
			// 		preview if needed...
			//that.updateImage(img)
		})

		return this },

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
				if(reference == 'view' && [90, 270].includes(that.getImageRotation(img))){
					d = direction == 'vertical' ? 'horizontal' : 'vertical' }
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
					state.push(d) }

			// set an explicit state...
			} else {
				var state = set_state.slice() }

			// write the state...
			if(state.length == 0){
				img.removeAttr('flipped')
			} else {
				img.attr('flipped', state.join(', ')) } })

		return this },

	// shorthands...
	// XXX should these be here???
	rotateCW: function(target){ return this.rotateImage(target, 'cw') },
	rotateCCW: function(target){ return this.rotateImage(target, 'ccw') },
	flipVertical: function(target, reference){
		return this.flipImage(target, 'vertical', reference) },
	flipHorizontal: function(target, reference){ 
		return this.flipImage(target, 'horizontal', reference) },


} 
RibbonsPrototype.__proto__ = BaseRibbonsPrototype

var Ribbons = 
module.Ribbons = 
	object.Constructor('Ribbons', 
		RibbonsClassPrototype, 
		RibbonsPrototype)




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
