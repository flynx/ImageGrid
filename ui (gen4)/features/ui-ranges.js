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

var core = require('features/core')



/*********************************************************************/

var RangeActions = actions.Actions({

	// 	.makeBrace('open')
	// 	.makeBrace('open', image)
	// 	.makeBrace('close')
	// 	.makeBrace('close', image)
	//
	// XXX this should not be here...
	makeBrace: ['- Range/',
		function(type, gid){
			var cls = type == 'open' ? 'brace-open' : 'brace-close'
			var r = this.dom.find('.ribbon')

			var brace = this.ribbons.getRibbon(gid).find('.mark.'+cls)

			if(brace.length == 0){
				brace = $('<span>')
					.addClass('mark brace '+cls)

			} else if(brace.length > 1){
				brace = brace.detach().first()
			}

			brace
				.attr('gid', gid)

			this.ribbons.getImage(gid)[type == 'open' ? 'before' : 'after'](brace)

			// XXX this does not work for non-current images ...
			this.ribbons.preventTransitions(r)
			// XXX is this correct here???
			this.focusImage()
			this.ribbons.restoreTransitions(r)
		}],

	// XXX add "brace off screen" indicators....
	updateRangeIndicators: ['- Range/',
		function(){
			var update = false
			var range = this.data.__range

			// XXX not sure if this sweeping action is the right way to 
			// 		go but it sure makes things simpler...
			if(range == null){
				update = true
				this.dom
					.find('.ribbon .mark.brace')
						.remove()

			} else {
				var that = this

				this.data.ribbon_order.forEach(function(r){
					var a = that.data.getImage(range[0], 'after', r)
					var b = that.data.getImage(range[1], 'before', r)

					// only draw braces if some part of the ribbon is 
					// in range...
					if(a != null && b != null){
						that
							.makeBrace('open', a)
							.makeBrace('close', b)

					// remove braces from ribbon...
					} else {
						update = true
						that.ribbons.getRibbon(r)
							.find('.mark.brace')
								.remove()
					}
				})
			}

			if(update){
				var r = this.dom.find('.ribbon')

				// XXX this does not work for non-current images ...
				this.ribbons.preventTransitions(r)
				// XXX is this correct here???
				this.focusImage()
				this.ribbons.restoreTransitions(r)
			}
		}],
	clearRange: ['Range/Clear range',
		// XXX not sure if this is the right way to go...
		{mode: function(){ return !this.data.__range && 'disabled' }},
		function(image){
			var r = this.dom.find('.ribbon')

			delete this.data.__range
			this.updateRangeIndicators()
		}],
	// procedure:
	// 	- set brace 
	// 		when no braces set:
	// 			- sets two braces around target image
	// 		When a brace is set:
	// 			- check brace orientation and set open/close to target
	// 	- update braces on all ribbons
	setRangeBorder: ['Range/Set range border',
		function(image, type){
			var image = this.data.getImage(image)
			var range = this.data.__range = this.data.__range || []
			
			// no range...
			if(range.length == 0){
				range.push(image)
				range.push(image)

			// range set...
			} else {
				var a = this.data.getImageOrder(range[0])
				var b = this.data.getImageOrder(range[1])
				var t = this.data.getImageOrder(image)


				var i = 
					// type/range conflict...
					type == 'close' && t < a ? null
					: type == 'open' && t > b ? null
					// extend left/right...
					: t <= a ? 0 
					: t >= b ? 1
					// set left/right limit...
					: type == 'open' ? 0
					: type == 'close' ? 1
					// narrow to the closest brace...
					: a - t < b - t ? 0
					: 1

				if(i == null){
					return
				}

				range[i] = image
			}

			this.updateRangeIndicators()
		}],
	openRange: ['Range/Open range',
		function(image){ this.setRangeBorder(image, 'open') }],
	closeRange: ['Range/Close range',
		function(image){ this.setRangeBorder(image, 'close') }],

	cropRange: ['Range|Crop/Crop range',
		// XXX not sure if this is the right way to go...
		{mode: function(){ return !this.data.__range && 'disabled' }},
		function(){
			var range = this.data.__range
			var order = this.data.order

			range ? 
				this.crop(order.slice(
					order.indexOf(range[0]), 
					order.indexOf(range[1])+1))
				: this.crop([])
		}],
	cropRangeOut: ['Range|Crop/Crop out range',
		// XXX not sure if this is the right way to go...
		{mode: function(){ return !this.data.__range && 'disabled' }},
		function(){
			var range = this.data.__range
			var order = this.data.order

			range ? 
				this.crop(order
					.slice(0, order.indexOf(range[0]))
					.concat(order.slice(order.indexOf(range[1])+1)))
				: this.crop()
		}],
})


var Range = 
module.Range = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-range',
	depends: [
		'ui',
	],

	actions: RangeActions,

	handlers: [
		[[
			'crop',
			'reload',
		], 
			function(){ this.updateRangeIndicators() }],
		['updateImage', 
			function(_, gid){
				var range = this.data.__range

				if(this.ribbons && range && gid){
					var r = this.data.getRibbon(gid)

					var a = gid == range[0] ? 
						this.makeBrace('open', gid)
						: this.data.getImage(range[0], 'after', r)
					
					var b = gid == range[1] ? 
						this.makeBrace('close', gid)
						: this.data.getImage(range[1], 'before', r)

					if(a != null && b != null){
						gid == a 
							&& this.makeBrace('open', gid)

						gid == b
							&& this.makeBrace('close', gid)
					}
				}
			}],
		['shiftImage.pre',
			function(gid){ 
				var range = this.data.__range

				if(this.ribbons && range){
					this.ribbons.getImageMarks(gid).filter('.brace').remove()

					return function(){
						this.updateRangeIndicators() 
					}
				}
			}], 

		// show/hide off-screen indicators...
		// XXX STUB: should we animate indicators???
		['viewScale.pre',
			function(scale){
				var range = this.data.__range
				if(!this.ribbons || !range){
					return 
				}

				this.ribbons.getRibbonLocator()
					.find('.range-offscreen-indicator')
						.hide()
			}],
		[[
			'focusImage',
			'viewScale',
			'updateRangeIndicators',
		],
			function(_, gid){
				gid = gid || this.current
				var that = this
				var locator = this.ribbons.getRibbonLocator()
				var range = this.data.__range

				if(!this.ribbons || !range){
					locator.find('.range-offscreen-indicator').remove()
					return
				}

				var Wr = this.dom.width()
				var W = (Wr / this.scale) / 2

				var a = this.data.getImageOrder(range[0])
				var b = this.data.getImageOrder(range[1])

				var _make = function(gid, ribbon, direction){
					var t = ribbon[0].offsetTop 
					var h = ribbon[0].offsetHeight / 2

					var i = that.data.getImageOrder(gid)

					var indicator = locator
						.find('.range-offscreen-indicator.'+direction+'[gid="'+gid+'"]')

					// XXX this only works if brace is loaded...
					if(direction == 'left'){
						var brace = ribbon.find('.mark.brace-open')
						if(brace.length == 0 || brace.offset().left >= 0){
							return indicator.remove()
						}

					} else if(direction == 'right'){
						var brace = ribbon.find('.mark.brace-close')
						if(brace.length == 0 || brace.offset().left < Wr){
							return indicator.remove()
						}
					}

					if(indicator.length == 0){
						locator.append($('<div>')
							.addClass('range-offscreen-indicator '+direction)
							.attr('gid', gid))
					}

					var css = {}

					css.left = (direction == 'left' ? 
						-W 
						: W-(indicator[0] && indicator[0].offsetWidth)) + 'px'
					css.top = (t + h) + 'px'

					that.ribbons.preventTransitions(indicator)
					indicator
						.css(css)
						.show()
					that.ribbons.restoreTransitions(indicator)

					return indicator
				}


				setTimeout(function(){
					that.data.ribbon_order.forEach(function(gid){
						var ribbon = that.ribbons.getRibbon(gid)

						_make(gid, ribbon, 'left')
						_make(gid, ribbon, 'right')
					})
				}, 400)
			}],
	],
})



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
