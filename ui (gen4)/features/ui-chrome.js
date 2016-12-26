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

			var indicator = this.ribbons.viewer.find(cls)

			if(indicator.length == 0){
				indicator = $('<div>')
					.addClass(cls.replace('.', ''))
					.appendTo(this.ribbons.viewer)
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

		'current-image-indicator-hide-timeout': 250,

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

			var marker = ribbon.find('.current-marker')

			// remove marker if current image is not loaded...
			if(cur.length == 0){
				marker.remove()
				return
			}

			// get config...
			var border = this.config['current-image-border']
			var min_border = this.config['current-image-min-border']
			var border_timeout = this.config['current-image-border-timeout']
			var fadein = this.config['current-image-indicator-fadein']

			// no marker found -- either in different ribbon or not created yet...
			if(marker.length == 0){
				// get marker globally...
				marker = this.ribbons.viewer.find('.current-marker')

				// no marker exists -- create a marker...
				if(marker.length == 0){
					var marker = $('<div/>')
						.addClass('current-marker ui-current-image-indicator')
						.css({
							opacity: '0',
							// NOTE: these are not used for positioning
							// 		but are needed for correct absolute
							// 		placement...
							top: '0px',
							left: '0px',
						})
						.appendTo(ribbon)
						.animate({
							'opacity': 1
						}, fadein)
					this.ribbons.dom.setOffset(marker, 0, 0)

				// add marker to current ribbon...
				} else {
					css.display = ''
					marker
						// NOTE: this will prevent animating the marker 
						// 		in odd ways when switching ribbons...
						.css({ display: 'none' })
						.appendTo(ribbon)
				}
			}

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

			/* // set absolute offset...
			this.ribbons.dom.setOffset(marker, 
					cur[0].offsetLeft - (parseFloat(cur[0].style.marginLeft) || 0), 
					0)
			*/
			// set relative offset...
			var W = Math.min(document.body.offsetWidth, document.body.offsetHeight)
			var x = ((cur[0].offsetLeft - (parseFloat(cur[0].style.marginLeft) || 0))/W)*100 + 'vmin'
			marker.transform({x: x, y: 0, z: 0})

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
		// move marker to current image...
		['focusImage.post',
			function(){ this.updateCurrentImageIndicator() }],
		// prevent animations when focusing ribbons...
		['focusRibbon.pre',
			function(){
				var m = this.ribbons.viewer.find('.current-marker')
				this.ribbons.preventTransitions(m)
				return function(){
					this.ribbons.restoreTransitions(m)
				}
			}],
		// this is here to compensate for position change on ribbon 
		// resize...
		// NOTE: hide/show of indicator on resize appears to have solved
		// 		the jumpy animation issue.
		// 		this might cause some blinking on slow resizes (visible 
		// 		only on next/prev screen)... 
		// 		...still not sure why .preventTransitions(m) did not
		// 		do the job.
		['resizeRibbon.pre',
			function(target, s){
				var m = this.ribbons.viewer.find('.current-marker')
				var c = this.current
				var r = this.current_ribbon

				// only update if marker exists and we are in current ribbon...
				if(m.length != 0
						// XXX not sure if target handling here is the 
						// 		right way to go -- we manually check things
						// 		when .data.getImage(..) nad friends to this
						// 		better and in one spot...
						// 		...the down side is that they are slower...
						&& (target == 'current' 
							|| target == c
							|| target == r 
							// XXX this seems to be slow enough to push 
							// 		the frame-rate down...
							|| this.data.getRibbon(target) == r
							|| target == null)){
					m.hide()

					return function(){
						this.updateCurrentImageIndicator(target, false)
						m
							.show()
							// NOTE: keeping display in inline style will
							// 		prevent the element from being hidden
							// 		by css...
							.css({display: ''})
					}
				}
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

		['shiftImageLeft.pre shiftImageRight.pre',
			function(){
				this.ribbons.viewer.find('.current-marker').hide()
				if(this._current_image_indicator_timeout != null){
					clearTimeout(this._current_image_indicator_timeout)
					delete this._current_image_indicator_timeout
				}
				return function(){
					var ribbons = this.ribbons
					var fadein = this.config['current-image-indicator-fadein']
					this._current_image_indicator_timeout = setTimeout(function(){ 
						var m = ribbons.viewer.find('.current-marker')
						m.fadeIn(fadein, function(){
							m.css({display: ''})
						})
					}, this.config['current-image-shift-timeout'])
				}
			}],

		// hide and remove current image indicator...
		// NOTE: it will be reconstructed on 
		// 		next .focusImage(..)
		['ribbonPanning.pre',
			function(){
				this.__current_image_indicator_restore_timeout
					&& clearTimeout(this.__current_image_indicator_restore_timeout)
				delete this.__current_image_indicator_restore_timeout

				var m = this.ribbons.viewer
					.find('.current-marker')
						.velocity({opacity: 0}, {
							duration: 100,
							complete: function(){
								m.remove()
							},
						})

			}],
		['ribbonPanning.post',
			function(){
				var that = this
				this.__current_image_indicator_restore_timeout = setTimeout(function(){
					that.updateCurrentImageIndicator()
				}, this.config['current-image-indicator-restore-delay'] || 500)
			}],

		// single image view -- fade in indicator after exit...
		['toggleSingleImage',
			function(){
				if(this.toggleSingleImage('?') == 'off'){
					var m = this.ribbons.viewer.find('.current-marker')
					m.hide()

					this.updateCurrentImageIndicator()

					m
						.delay(150)
						.fadeIn(200, function(){ 
							m.css({display: ''})})
				}
			}],
	],
})


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


	handlers: [
		// hide indicator on screen next/prev...
		//
		// XXX experimental -- not sure if we need this...
		// XXX need to think about the trigger mechanics here and make 
		// 		them more natural...
		['prevScreen.pre nextScreen.pre',
			function(){ 
				var m = this.ribbons.viewer.find('.current-marker')
				var t = this.config['current-image-indicator-hide-timeout']

				var cur = this.current

				return function(){
					var that = this

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
					if(this.__current_indicator_t1 != null){
						clearTimeout(this.__current_indicator_t1)
					}

					// cancel fadeout and do fadein...
					this.__current_indicator_t1 = setTimeout(function(){
						delete that.__current_indicator_t1

						// cancel fadeout...
						if(that.__current_indicator_t0 != null){
							clearTimeout(that.__current_indicator_t0)
							delete that.__current_indicator_t0
						} 

						// show...
						m.animate({ opacity: '1' })
					}, t-50)
				}
			}],
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
				var m = this.ribbons.viewer.find('.current-marker')

				m.css({ opacity: 0 })
			}],
		['focusImage.post',
			function(){ 
				var m = this.ribbons.viewer.find('.current-marker')

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
	var scale = this.ribbons.scale()
	var base = this.ribbons.getRibbon('base')
	img = this.ribbons.getImage(img)
	var m = base.find('.base-ribbon-marker')

	if(base.length == 0){
		return
	}

	if(m.length == 0){
		m = this.ribbons.viewer.find('.base-ribbon-marker')

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
		m.css('left', (img.position().left + img.width()/2 - this.ribbons.viewer.width()/2) / scale)

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
		togglePassiveBaseRibbonIndicator: ['Interface/Toggle passive base ribbon indicator',
			toggler.CSSClassToggler(
				function(){ return this.ribbons.viewer }, 
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
	toggleInterfaceScale: ['Interface/Toggle interface modes',
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
	// 	- nw
	// 	- mobile
	isApplicable: function(){ return this.runtime == 'nw' },

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
