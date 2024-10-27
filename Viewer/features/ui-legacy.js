/**********************************************************************
* 
* This is here for reference...
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
// Mouse...

// XXX add setup/taredown...
var Clickable = 
module.Clickable = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-clickable',
	depends: ['ui'],

	config: {
		'click-threshold': {
			t: 100,
			d: 5,
		},
	},

	handlers: [
		// setup click targets...
		// XXX click only if we did not drag...
		['updateImage', 
			function(res, gid){
				var that = this
				var img = this.ribbons.getImage(gid)

				// set the clicker only once...
				if(!img.prop('clickable')){
					var x, y, t, last, threshold
					img
						.prop('clickable', true)
						.on('mousedown touchstart', function(evt){ 
							threshold = that.config['click-threshold']
							x = evt.clientX
							y = evt.clientY
							t = Date.now()
						})
						.on('mouseup touchend', function(evt){ 
							if(that.__control_in_progress){
								return
							}
							// prevent another handler within a timeout...
							// XXX not too sure about this...
							if(t - last < threshold.t){
								return
							}
							// constrain distance between down and up events...
							if(x != null 
								&& Math.max(
									Math.abs(x - evt.clientX), 
									Math.abs(y - evt.clientY)) < threshold.d){
								// this will prevent double clicks...
								x = null
								y = null
								that.focusImage(that.ribbons.elemGID($(this)))
								last = Date.now()
							}
						})
				}
			}],
	],
})



/*********************************************************************/
// Touch/Control...

// XXX add zoom...
// XXX add vertical pan to ribbon-set...
var DirectControlHammer = 
module.DirectControlHammer = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-direct-control-hammer',
	exclusive: ['ui-control'],
	depends: [
		'ui',
		// this is only used to trigger reoad...
		//'ui-partial-ribbons',
	],

	config: {
		// This can be:
		// 	'silent'	- silently focus central image after pan
		// 	true		- focus central image after pan
		// 	null		- do nothing.
		'focus-central-image': 'silent',
	},

	// XXX add setup/taredown...
	// XXX add inertia...
	// XXX hide current image indicator on drag...
	// XXX add swipe up/down control...
	// XXX add mode switching....
	// XXX BUG: after panning and silent focus, marking works correctly 
	// 		but image is not updated -- mark not drawn...
	handlers: [
		// setup ribbon dragging...
		// XXX it is possible to drag over the loaded ribbon section with
		// 		two fingers, need to force update somehow...
		// 		...and need to try and make the update in a single frame...
		// 		Ways to go:
		// 			- update on touchdown
		// 			- update on liftoff
		// XXX drag in single image mode ONLY if image is larger than screen...
		['updateRibbon', 
			function(_, target){
				var that = this
				var r = this.ribbons.getRibbon(target)

				// setup dragging...
				if(r.length > 0 && !r.hasClass('draggable')){
					r
						.addClass('draggable')
						.hammer()
						.on('pan', function(evt){
							//evt.stopPropagation()

							// XXX stop all previous animations...
							//r.velocity("stop")

							var d = that.ribbons.dom
							var s = that.scale
							var g = evt.gesture


							var data = r.data('drag-data')

							// we just started...
							if(!data){
								that.__control_in_progress = (that.__control_in_progress || 0) + 1

								// hide and remove current image indicator...
								// NOTE: it will be reconstructed on 
								// 		next .focusImage(..)
								var m = that.dom
									.find('.current-marker')
										.velocity({opacity: 0}, {
											duration: 100,
											complete: function(){
												m.remove()
											},
										})

								// store initial position...
								var data = {
									left: d.getOffset(this).left
								}
								r.data('drag-data', data)
							}

							// do the actual move...
							d.setOffset(this, data.left + (g.deltaX / s))

							// when done...
							if(g.isFinal){
								r.removeData('drag-data')

								// XXX this seems to have trouble with off-screen images...
								var central = that.ribbons.getImageByPosition('center', r)

								// load stuff if needed...
								that.updateRibbon(central)
								
								// XXX add inertia....
								//console.log('!!!!', g.velocityX)
								//r.velocity({
								//	translateX: (data.left + g.deltaX + (g.velocityX * 10)) +'px'
								//}, 'easeInSine')

								// silently focus central image...
								if(that.config['focus-central-image'] == 'silent'){
									that.data.current = that.ribbons.elemGID(central)
									
								// focus central image in a normal manner...
								} else if(that.config['focus-central-image']){
									that.focusImage(that.ribbons.elemGID(central))
								}

								setTimeout(function(){
									that.__control_in_progress -= 1
									if(that.__control_in_progress <= 0){
										delete that.__control_in_progress
									}
								}, 50)
							}
						})
				}
			}],
	],
})


// XXX try direct control with hammer.js
// XXX load state from config...
// XXX sometimes this makes the indicator hang for longer than needed...
// XXX BUG: this conflicts a bit whith ui-clickable...
// 		...use this with hammer.js taps instead...
// XXX might be a good idea to make a universal and extensible control 
// 		mode toggler...
// 		...obvious chice would seem to be a meta toggler:
// 			config['control-mode'] = {
// 				<mode-name>: <mode-toggler>
// 			}
// 			and the action will toggle the given mode on and the previous
// 			off...
// 			XXX this seems a bit too complicated...
var IndirectControl = 
module.IndirectControl = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-indirect-control',
	// XXX is this correct???
	exclusive: ['ui-control'],
	depends: ['ui'],

	config: {
	},

	actions: actions.Actions({
		toggleSwipeHandling:['Interface/Toggle indirect control swipe handling',
			toggler.Toggler(null,
				function(_, state){

					if(state == null){
						return (this.ribbons 
								&& this.dom 
								&& this.dom.data('hammer')) 
							|| 'none'

					// on...
					} else if(state == 'handling-swipes'){
						var that = this
						var viewer = this.dom

						// prevent multiple handlers...
						if(viewer.data('hammer') != null){
							return
						}

						viewer.hammer()

						var h = viewer.data('hammer')
						h.get('swipe').set({direction: Hammer.DIRECTION_ALL})

						viewer
							.on('swipeleft', function(){ that.nextImage() })
							.on('swiperight', function(){ that.prevImage() })
							.on('swipeup', function(){ that.shiftImageUp() })
							.on('swipedown', function(){ that.shiftImageDown() })

					// off...
					} else {
						this.dom
							.off('swipeleft')
							.off('swiperight')
							.off('swipeup')
							.off('swipedown')
							.removeData('hammer')
					}

				},
				'handling-swipes')],
	}),

	handlers: [
		['load', 
			function(){ a.toggleSwipeHandling('on') }],
		['stop', 
			function(){ a.toggleSwipeHandling('off') }],
	],
})



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
