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
var toggler = require('lib/toggler')

var core = require('features/core')



/*********************************************************************/

// helper...
function didAdvance(indicator){
	return function(){
		var img = this.data ? this.data.current : null
		return function(){
			if(img == null || img == this.data.current){
				this.flashIndicator(indicator)
			}
		}
	}
}

var BoundsIndicatorsActions = actions.Actions({
	flashIndicator: ['- Interface/Flash an indicator',
		function(direction){
			if(this.ribbons.getRibbonSet().length == 0){
				return
			}
			var cls = {
				// shift up/down...
				up: '.up-indicator',
				down: '.down-indicator',
				// hit start/end/top/bottom of view...
				start: '.start-indicator',
				end: '.end-indicator',
				top: '.top-indicator',
				bottom: '.bottom-indicator',
			}[direction]

			var indicator = this.dom.find(cls)

			if(indicator.length == 0){
				indicator = $('<div>')
					.addClass(cls.replace('.', ''))
					.appendTo(this.dom)
			}

			return indicator
				// NOTE: this needs to be visible in all cases and key press 
				// 		rhythms... 
				.show()
				.delay(100)
				.fadeOut(300)
		}],
})

var BoundsIndicators = 
module.BoundsIndicators = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-bounds-indicators',
	depends: ['ui'],

	actions: BoundsIndicatorsActions,

	handlers: [
		// basic navigation...
		['nextImage.pre lastImage.pre', didAdvance('end')],
		['prevImage.pre firstImage.pre', didAdvance('start')],
		['nextRibbon.pre lastRibbon.pre', didAdvance('bottom')],
		['prevRibbon.pre firstRibbon.pre', didAdvance('top')],

		// vertical shifting...
		['shiftImageUp.pre',
			function(target){ 
				target = target || this.current
				var r = this.data.getRibbonOrder(target)

				var l = this.data.getImages(r).length
				var l0 = this.data.getImages(0).length

				return function(){
					// when shifting last image of top ribbon (i.e. length == 1)
					// up the state essentially will not change...
					if((r == 0 && l == 1) 
							// we are shifting to a new empty ribbon...
							|| (r == 1 && l == 1 && l0 == 0)){
						this.flashIndicator('top')
					} else {	
						this.flashIndicator('up')
					}
				}
			}],
		['shiftImageDown.pre',
			function(target){ 
				target = target || this.current
				var r0 = this.data.getRibbonOrder(target)
				var l = this.data.getImages(r0).length

				return function(){
					var r1 = this.data.getRibbonOrder(target)
					if(r0 == r1 && r0 == this.data.ribbon_order.length-1 && l == 1){
						this.flashIndicator('bottom')
					} else {
						this.flashIndicator('down') 
					}
				}
			}],

		// horizontal shifting...
		['shiftImageLeft.pre',
			function(target){ 
				if(target == null 
						//&& actions.data.getImageOrder('ribbon') == 0){
						&& this.data.getImage('prev') == null){
					this.flashIndicator('start')
				}
			}],
		['shiftImageRight.pre',
			function(target){ 
				if(target == null 
						&& this.data.getImage('next') == null){
					this.flashIndicator('end')
				}
			}],
	],
})



//---------------------------------------------------------------------

var CurrentImageIndicatorActions = actions.Actions({
	config: {
		'current-image-border': 3,
		'current-image-min-border': 2,

		'current-image-border-timeout': 200,
		'current-image-shift-timeout': 200,

		'current-image-indicator-fadein': 500,

		'current-image-indicator-restore-delay': 500,

		// this can be:
		// 	'hide'			- simply hide on next/prev screen action
		// 					  and show on focus image.
		// 	'hide-show'		- hide on fast scroll through screens and 
		// 					  show when slowing down.
		'current-image-indicator-screen-nav-mode': 'hide',
	},

	updateCurrentImageIndicator: ['- Interface/Update current image indicator',
		function(target, update_border, scale){
			var ribbon_set = this.ribbons.getRibbonSet()
			var locator = this.ribbons.getRibbonLocator()
			var shifting_ribbon = false

			// NOTE: we will update only the attrs that need to be updated...
			var css = {}

			if(ribbon_set.length == 0){
				return
			}

			scale = scale || this.scale

			var cur = this.ribbons.getImage(target)
			// NOTE: cur may be unloaded...
			var ribbon = this.ribbons.getRibbon(cur.length > 0 ? target : this.current_ribbon)

			var marker = ribbon_set.find('.current-marker')

			// remove marker if current image is not loaded...
			if(cur.length == 0){
				marker.hide()
				return

			} else {
				marker.show()
			}

			// create marker if it does not exist...
			if(marker.length == 0 && ribbon_set.length > 0){
				$('<div/>')
					.addClass('current-marker')
					.prependTo(ribbon_set)
			}

			// get config...
			var border = this.config['current-image-border']
			var min_border = this.config['current-image-min-border']
			var border_timeout = this.config['current-image-border-timeout']

			/*/ XXX at this point we do not need size updating...
			var w = cur.outerWidth(true)
			var h = cur.outerHeight(true)

			// accommodate for non-square images... 
			// XXX this might have problems when scaling...
			if(Math.floor(w) != Math.floor(h)){
				css.width = w / scale
				// XXX do we ever need to set height in a ribbon???
				//css.height = h / scale

			// square image -> let CSS do the work...
			} else {
				css.width = ''
				css.height = ''
			}
			//*/

			// update border...
			if(update_border !== false){
				var border = Math.max(min_border, border / scale)

				// set border right away...
				if(update_border == 'before'){
					//css.borderWidth = border
					marker.css({ borderWidth: border }) 

				// set border with a delay...
				// NOTE: this is to prevent the ugly border resize before
				// 		the scale on scale down animation starts...
				} else {
					setTimeout(function(){ 
						marker.css({ borderWidth: border }) 
					}, border_timeout)
				}
			}

			marker.css(css)
		}],
})


var CurrentImageIndicator = 
module.CurrentImageIndicator = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-current-image-indicator',
	depends: [
		'ui',
	],

	actions: CurrentImageIndicatorActions,

	handlers: [
		// show the indicator...
		['load', 
			function(){
				var fadein = this.config['current-image-indicator-fadein']
				this.updateCurrentImageIndicator()
				this.dom.find('.current-marker')
					.css({
						display: 'block',
						opacity: 0,
					})
					.delay(100)
					.animate({
						opacity: 1
					}, fadein)
			}],

		// Change border size in the appropriate spot in the animation:
		// 	- before animation when scaling up
		// 	- after when scaling down
		// This is done to make the visuals consistent...
		['resizing.pre',
			function(unit, w1){ 
				var w0 = this[unit]
				w1 = w1 || 1

				w0 > w1 
					&& this.updateCurrentImageIndicator(null, 
						'before', 
						// NOTE: we need to get the target scale as we 
						// 		have not started resizing yet...
						(w0 / w1) * this.scale) 
			}],
		['resizingDone',
			function(){ 
				this.updateCurrentImageIndicator(null, 'before') }],

		// hide and remove current image indicator...
		['ribbonPanning.pre',
			function(){
				//* XXX do we need to restore after pan??? 
				this.__current_image_indicator_restore_timeout
					&& clearTimeout(this.__current_image_indicator_restore_timeout)
				delete this.__current_image_indicator_restore_timeout
				//*/

				this.dom
					.find('.current-marker')
						.velocity({opacity: 0}, { duration: 100 })
			}],
		// XXX need to animate this...
		['centerImage.pre',
			function(){
				var m = this.dom.find('.current-marker')[0]
				m 
					&& (m.style.marginLeft = '')
			}],
		['ribbonPanning.post',
			function(){
				var that = this
				this.__current_image_indicator_restore_timeout = setTimeout(function(){
					that.updateCurrentImageIndicator()

					var cur = that.ribbons.getImage()
					var marker = that.dom.find('.current-marker')

					marker[0].style.marginLeft = ''

					var m = -marker[0].offsetWidth/2 
					var d = (marker.offset().left - cur.offset().left) / that.scale

					marker[0].style.marginLeft = (m - d) + 'px'

					marker
						.velocity({opacity: 1}, { duration: 100 })
				}, this.config['current-image-indicator-restore-delay'] || 500)
			}],

		// single image view -- fade in indicator after exit...
		['toggleSingleImage',
			function(){
				if(this.toggleSingleImage('?') == 'off'){
					this.dom.find('.current-marker')
						.delay(150)
						.animate({opacity: 1}, 100)

				} else {
					this.dom.find('.current-marker')
						.css({ opacity: 0 })
				}
			}],
	],
})


// XXX is it a good idea to used the same timers for all instances???
var makeIndicatorHiderOnFastAction = function(hide_timeout){
	return function(){ 
		if(this.toggleSingleImage && this.toggleSingleImage('?') == 'on'){
			return
		}

		var that = this
		var m = this.dom.find('.current-marker')
		var t = this.config[hide_timeout]

		var cur = this.current

		return function(){
			// delay fadeout...
			if(cur != this.current 
					&& m.css('opacity') == 1
					&& this.__current_indicator_t0 == null){
				this.__current_indicator_t0 = setTimeout(function(){
					delete that.__current_indicator_t0
					m.css({ opacity: 0 })
				}, t)
			}

			// cancel/delay previous fadein...
			this.__current_indicator_t1 != null
				&& clearTimeout(this.__current_indicator_t1)

			// cancel fadeout and do fadein...
			this.__current_indicator_t1 = setTimeout(function(){
				delete that.__current_indicator_t1

				// cancel fadeout...
				that.__current_indicator_t0 != null
					&& clearTimeout(that.__current_indicator_t0)
				delete that.__current_indicator_t0

				// show...
				m.animate({ opacity: 1 })
			}, t-50)
		}
	}
}

var CurrentImageIndicatorHideOnFastScreenNav = 
module.CurrentImageIndicatorHideOnFastScreenNav = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-current-image-indicator-hide-on-fast-screen-nav',


	depends: [
		'ui',
		'ui-current-image-indicator'
	],
	exclusive: ['ui-current-image-indicator-hide'],

	config: {
		'current-image-indicator-hide-threshold': 100,

		'current-image-indicator-screen-hide-threshold': 100,
	},

	handlers: [
		// hide indicator on next/prev...
		['prevImage.pre nextImage.pre',
			makeIndicatorHiderOnFastAction('current-image-indicator-hide-threshold')],
		['prevScreen.pre nextScreen.pre',
			makeIndicatorHiderOnFastAction('current-image-indicator-screen-hide-threshold')],
	],
})

var CurrentImageIndicatorHideOnScreenNav = 
module.CurrentImageIndicatorHideOnScreenNav = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-current-image-indicator-hide-on-screen-nav',


	depends: [
		'ui',
		'ui-current-image-indicator'
	],
	exclusive: ['ui-current-image-indicator-hide'],


	handlers: [
		// 	this does the following:
		// 		- hide on screen jump
		// 		- show on any other action
		//
		// NOTE: we use .pre events here to see if we have moved...
		['prevScreen.post nextScreen.post',
			function(){ 
				var m = this.dom.find('.current-marker')

				m.css({ opacity: 0 })
			}],
		['focusImage.post',
			function(){ 
				var m = this.dom.find('.current-marker')

				m.css({ opacity: '' })
			}],
	],
})



//---------------------------------------------------------------------
// XXX this should:
// 	- float to the left of a ribbon if image #1 is fully visible (working)
// 	- float at left of viewer if image #1 is off screen...
// 	- float on the same level as the base ribbon...

// XXX make this an action...
var updateBaseRibbonIndicator = function(img){
	var scale = this.scale
	var base = this.ribbons.getRibbon('base')
	img = this.ribbons.getImage(img)
	var m = base.find('.base-ribbon-marker')

	if(base.length == 0){
		return
	}

	if(m.length == 0){
		m = this.dom.find('.base-ribbon-marker')

		// make the indicator...
		if(m.length == 0){
			m = $('<div>')
				.addClass('base-ribbon-marker')
				.text('base ribbon')
		}

		m.prependTo(base)
	}

	// XXX this is wrong -- need to calculate the offset after the move and not now...
	if(base.offset().left < 0){
		m.css('left', (img.position().left + img.width()/2 - this.dom.width()/2) / scale)

	} else {
		m.css('left', '')
	}
}

var BaseRibbonIndicator = 
module.BaseRibbonIndicator = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-base-ribbon-indicator',
	depends: ['ui'],

	handlers: [
		// move marker to current image...
		['focusImage.pre',
			function(target){ 
				updateBaseRibbonIndicator.call(this, target)
			}],
		// prevent animations when focusing ribbons...
		['focusRibbon.pre setBaseRibbon',
			function(){
				updateBaseRibbonIndicator.call(this)

				/*
				this.ribbons.preventTransitions(m)
				return function(){
					this.ribbons.restoreTransitions(m)
				}
				*/
			}],
	]
})


var PassiveBaseRibbonIndicator = 
module.PassiveBaseRibbonIndicator = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-passive-base-ribbon-indicator',
	depends: ['ui'],

	config: {
		'ui-show-passive-base-ribbon-indicator': true,
	},

	actions: actions.Actions({
		togglePassiveBaseRibbonIndicator: ['Interface/Passive base ribbon indicator',
			toggler.CSSClassToggler(
				function(){ return this.dom }, 
				'show-passive-base-ribbon-indicator',
				function(state){ 
					this.config['ui-show-passive-base-ribbon-indicator'] = state == 'on' }) ],
	}),

	handlers: [
		['start',
			function(){
				this.togglePassiveBaseRibbonIndicator(
					this.config['ui-show-passive-base-ribbon-indicator'] ?
						'on' : 'off')
			}]
	],
})



//---------------------------------------------------------------------

// XXX make this work in browser
var UIScaleActions = actions.Actions({
	config: {
		// XXX
		'ui-scale-modes': {
			desktop: 0,
			touch: 3,
		},
	},

	// XXX need to account for scale in PartialRibbons
	// XXX should this be browser API???
	// XXX this does not re-scale the ribbons correctly in nw0.13
	toggleInterfaceScale: ['Interface/Interface modes',
		core.makeConfigToggler('ui-scale-mode', 
			function(){ return Object.keys(this.config['ui-scale-modes']) },
			function(state){ 
				var gui = requirejs('nw.gui')
				var win = gui.Window.get()


				this.ribbons.preventTransitions()

				var w = this.screenwidth

				// NOTE: scale = Math.pow(1.2, zoomLevel)
				// XXX in nw0.13 this appears to be async...
				win.zoomLevel = this.config['ui-scale-modes'][state] || 0

				this.screenwidth = w
				this.centerViewer()

				this.ribbons.restoreTransitions()
			})],
})


// XXX enable scale loading...
// 		...need to make this play nice with restoring scale on startup...
var UIScale = 
module.UIScale = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-scale',
	depends: [
		'ui',
	],

	actions: UIScaleActions,

	// XXX test if in:
	// 	- chrome app
	// 	- desktop
	// 	- mobile
	isApplicable: function(){ return this.runtime.desktop },

	// XXX show main window...
	handlers: [
		['start',
			function(){ 
				// XXX this messes up ribbon scale...
				// 		...too close/fast?
				//this.toggleInterfaceScale('!')
			}],
	],
})




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
