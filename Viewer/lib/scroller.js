/**********************************************************************
* 
* General Swipe/Scroll handler lib 
*
* TODO a demo page to show/test the features...
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true

// click threshold in pixels, if the distance between start and end is 
// less than this, the whole event is considered a click and not a 
// drag/swipe...
var CLICK_THRESHOLD = 10

// if the amount of time to wait bteween start and end is greater than
// this the event is considered a long click.
// NOTE: this will not auto-fire the event, the user MUST release first.
var LONG_CLICK_THRESHOLD = 400

// the maximum amount of time between clicks to count them together.
// NOTE: if multi-clicks are disabled this has no effect.
// NOTE: this is reset by the timeout explicitly set in the handler...
// NOTE: this is the timeout between two consecutive clicks and not the 
// 		total.
// NOTE: if multiple clicks are enabled this will introduce a lag after
// 		each click (while we wait for the next), so keep this as small 
// 		as possible, but not too small as to rush the user too much.
var MULTI_CLICK_TIMEOUT = 200

// the amount of time between finger releases.
// NOTE: when this is passed all the fingers released before are ignored.
var MULTITOUCH_RELEASE_THRESHOLD = 100



/*********************************************************************/

// Scroll handler
//
// This will take two elements a root (container) and a scrolled (first
// child of the container) and implement drag-scrolling of the scrolled
// within the root.
//
// This calls the following callbacks if they are defined.
// 	- preCallback (unset)
// 	- scrollCallback (unset)
// 	- postCallback (set to postScrollCallback)
//
// See scroller.options for configuration.
//
//
// XXX add a resonable cancel scheme...
// 		... something similar to touch threshold but bigger...
// XXX setup basic styles for the contained element...
// XXX revise...
// XXX test on other devices...
function makeScrollHandler(root, config){
	root = $(root)

	// local data...
	var ignoring = false
	// XXX this and scroller.state are redundent...
	var scrolling = false
	var touch = false
	var touches = 0
	var max_dx = 0
	var max_dy = 0

	var cancelThreshold, scrolled
		// initial state...
		, start_x, start_y, start_t
		// previous state...
		, prev_x, prev_y, prev_t
		// current state...
		, x, y, t
		// state delta...
		, dx, dy, dt

		, shift
		, scale
		//, bounds

	function startMoveHandler(evt){
		var options = scroller.options
		// ignore...
		if(options.ignoreElements 
				&& $(evt.target).closest(options.ignoreElements).length > 0
				|| scroller.state == 'paused'){
			ignoring = true
			return
		} else {
			ignoring = false
		}
		if(event.touches != null){
			touch = true
		}
		cancelThreshold = options.scrollCancelThreshold
		touches = touch ? event.touches.length : 1
		// if we are already touching then just skip on this...
		// XXX test this...
		if(touches > 1){
			return false
		}
		prev_t = event.timeStamp || Date.now();
		start_t = prev_t
		/*
		if(options.autoCancelEvents){
			bounds = {
				left: options.eventBounds,
				right: root.width() - options.eventBounds,
				top: options.eventBounds,
				bottom: root.height() - options.eventBounds 
			}
		}
		*/
		//scrolled = $(root.children()[0])
		scrolled = root.children().first()
		setTransitionDuration(scrolled, 0)
		// XXX these two are redundant...
		scrolling = true
		scroller.state = 'scrolling'
		// XXX do we need to pass something to this?
		options.preCallback && options.preCallback()

		shift = getElementShift(scrolled)
		scale = getElementScale(scrolled)
		// get the user coords...
		prev_x = touch ? event.touches[0].pageX : evt.clientX
		start_x = prev_x
		prev_y = touch ? event.touches[0].pageY : evt.clientY
		start_y = prev_y

		return false
	}

	// XXX try and make this adaptive to stay ahead of the lags...
	// NOTE: this does not support limiting the scroll, might be done in
	// 		the future though.
	// 		The way to go about this is to track scrolled size in the 
	// 		callback...
	function moveHandler(evt){
		if(ignoring){
			return
		}
		var options = scroller.options
		evt.preventDefault()
		t = event.timeStamp || Date.now();
		// get the user coords...
		x = touch ? event.touches[0].pageX : evt.clientX
		y = touch ? event.touches[0].pageY : evt.clientY
		touches = touch ? event.touches.length : 1

		/*
		// XXX needs testing...
		// XXX do we need to account for scrollDisabled here???
		// check scroll bounds...
		if(bounds != null){
			if(options.hScroll && (x <= bounds.left || x >= bounds.right)
					|| options.vScroll && (y <= bounds.top || y >= bounds.bottom)){
				// XXX cancel the touch event and trigger the end handler...
				return endMoveHandler(evt)
			}
		}
		*/

		// do the actual scroll...
		if(!options.scrollDisabled && scrolling){
			if(options.hScroll){
				shift.left += x - prev_x
			}
			if(options.vScroll){
				shift.top += y - prev_y
			}
			setElementTransform(scrolled, shift, scale)

			// XXX these should be done every time the event is caught or 
			// 		just while scrolling?
			dx = x - prev_x
			dy = y - prev_y
			max_dx += Math.abs(dx)
			max_dy += Math.abs(dy)
			dt = t - prev_t
			prev_x = x
			prev_y = y
			prev_t = t

			// XXX do we need to pass something to this?
			options.scrollCallback && options.scrollCallback()
		}
		return false
	}

	function endMoveHandler(evt){
		t = event.timeStamp || Date.now();
		touches = touch ? event.touches.length : 0
		if(ignoring){
			if(touches == 0){
				ignoring = false
			}
			return
		}
		var options = scroller.options

		// XXX get real transition duration...
		scroller.resetTransitions()

		x = touch ? event.changedTouches[0].pageX : evt.clientX
		y = touch ? event.changedTouches[0].pageY : evt.clientY
		// check if we are canceling...
		if(cancelThreshold 
				&& Math.abs(start_x-x) < cancelThreshold 
				&& Math.abs(start_y-y) < cancelThreshold
				&& (max_dx > cancelThreshold 
					|| max_dy > cancelThreshold)){
			scroller.state = 'canceling'
		}

		var data = {
			orig_event: evt, 
			scroller: scroller, 
			speed: {
				x: dx/dt,
				y: dy/dt
			},
			distance: {
				x: start_x-x,
				y: start_y-y
			},
			duration: t-start_t, 
			// current touches...
			touches: touches,
			clicks: null,
		}
		// XXX stop only if no fingers are touching or let the callback decide...
		if(options.postCallback 
				// XXX revise this....
				&& options.postCallback(data) === false 
				|| touches == 0){
			// cleanup and stop...
			touch = false
			scrolling = false
			scroller.state = 'waiting'
			scrolled = null 
			//bounds = null
			max_dx = 0
			max_dy = 0
		}

		return false
	}


	var scroller = {
		options: {
			// if one of these is false, it will restrict scrolling in 
			// that direction. hScroll for horizontal and vScroll for 
			// vertical.
			// NOTE: to disable scroll completely use scrollDisabled, see
			// 		below for details.
			hScroll: true,
			vScroll: true,

			// this will disable scroll.
			// NOTE: this is the same as setting both vScroll and hScroll 
			// 		to false, but can be set and reset without affecting 
			// 		the actual settings individually...
			// NOTE: this takes priority over hScroll/vScroll.
			scrollDisabled: false,

			// sets the default transition settings while not scrolling...
			transitionDuration: 200,
			transitionEasing: 'ease',

			// items to be ignored by the scroller...
			// this is a jQuery compatible selector.
			ignoreElements: '.noScroll',
			// this is the side of the rectangle in px, if the user moves
			// out of it, and then returns back, the action will get cancelled.
			// i.e. the callback will get called with the "cancelling" state.
			scrollCancelThreshold: 100,

			/*
			// XXX padding within the target element moving out of which 
			// 		will cancell the action...
			// XXX needs testing...
			autoCancelEvents: false,
			eventBounds: 5,
			*/

			// callback to be called when the user first touches the screen...
			preCallback: null,
			// callback to be called when a scroll step is done...
			scrollCallback: null,
			// callback to be called when the user lifts a finger/mouse.
			// NOTE: this may happen before the scroll is done, for instance
			// 		when one of several fingers participating in the action
			// 		gets lifted.
			// NOTE: if this returns false explicitly, this will stop scrolling.
			postCallback: postScrollCallback,

			// These are used by the default callback...
			//
			// if true then doubleClick and multiClick events will get 
			// triggered.
			// NOTE: this will introduce a lag needed to wait for next 
			// 		clicks in a group.
			// NOTE: when this is false, shortClick is triggered for every 
			// 		single click separately.
			enableMultiClicks: false,
			// NOTE: if these are null, respective values from the env will
			// 		be used.
			clickThreshold: null,
			longClickThreshold: null,
			multiClickTimeout: null,
			multitouchTimeout: null,
		},
		state: 'stopped',
		root: root,

		start: function(){
			if(this.state == 'paused'){
				this.state = 'waiting'
			} else {
				this.state = 'waiting'

				// NOTE: if we bind both touch and mouse events, on touch devices they 
				//		might start interfering with each other...
				if('ontouchmove' in window){
					root
						.on('touchstart', startMoveHandler)
						.on('touchmove', moveHandler) 
						.on('touchend', endMoveHandler)
						.on('touchcancel', endMoveHandler)
				} else {
					root
						.on('mousedown', startMoveHandler) 
						.on('mousemove', moveHandler) 
						.on('mouseup', endMoveHandler) 
				}
			}

			// setup transitions...
			this.resetTransitions()

			return this
		},
		// XXX test...
		pause: function(){
			this.state = 'paused'
			return this
		},
		stop: function(){
			if('ontouchmove' in window){
				root
					.off('touchstart', startMoveHandler)
					.off('touchmove', moveHandler) 
					.off('touchend', endMoveHandler)
					.off('touchcancel', endMoveHandler)
			} else {
				root
					.off('mousedown', startMoveHandler) 
					.off('mousemove', moveHandler) 
					.off('mouseup', endMoveHandler) 
			}
			this.state = 'stopped'
			return this
		},
		resetTransitions: function(){
			var scrolled = this.root.children().first()
			setTransitionDuration(scrolled, this.options.transitionDuration)
			setTransitionEasing(scrolled, this.options.transitionEasing)

			return this
		}
	}

	// merge the config with the defaults...
	if(config != null){
		$.extend(scroller.options, config)
	}

	return scroller
}



// default callback...
//
// This will provide support for the following events on the scroll root
// element:
// 		- scrollCancelled
//
// 		- shortClick
// 		- doubleClick
// 		- multiClick
// 			this will store the number of clicks in data.clicks
// 		- longClick
//
// 		- swipeLeft
// 		- swipeRight
// 		- swipeUp
// 		- swipeDown
//
// 		- screenReleased
//
// NOTE: data.touches passed to the event is the number of touches 
// 		released within the multitouchTimeout.
// 		this differs from what postScrollCallback actually gets in the 
// 		same field when it receives the scroll data object.
// XXX add generic snap
// XXX add generic inertial scroll 
// 		...see jli.js/animateElementTo for a rough implementation
// XXX test multiple touches...
function postScrollCallback(data){
	var scroller = data.scroller
	var options = scroller.options
	var root = scroller.root
	var clickThreshold = options.clickThreshold || CLICK_THRESHOLD
	var longClickThreshold = options.longClickThreshold || LONG_CLICK_THRESHOLD
	var multitouchTimeout = options.multitouchTimeout || MULTITOUCH_RELEASE_THRESHOLD
	var enableMultiClicks = options.enableMultiClicks
	var multiClickTimeout = options.multiClickTimeout || MULTI_CLICK_TIMEOUT

	var now = Date.now();

	// cancel event...
	if(scroller.state == 'canceling'){
		return root.trigger('scrollCancelled', data)
	}

	// handle multiple touches...
	if(data.touches > 0){
		var then = scroller._last_touch_release
		if(then == null || now - then < multitouchTimeout){
			if(scroller._touches == null){
				scroller._touches = 1
			} else {
				scroller._touches += 1
			}
		} else {
			scroller._touches = null
		}
		// wait for the next touch release...
		scroller._last_touch_release = now
		return

	// calculate how many touches did participate... 
	} else {
		data.touches = scroller._touches ? scroller._touches + 1 : 1
		scroller._last_touch_release = null
		scroller._touches = null
	}

	// clicks, double-clicks, multi-clicks and long-clicks...
	if(Math.max(
			Math.abs(data.distance.x), 
			Math.abs(data.distance.y)) < clickThreshold){
		if(data.duration > longClickThreshold){
			return root.trigger('longClick', data) 
		}
		if(!enableMultiClicks){
			return root.trigger('shortClick', data)

		} else {
			// count the clicks so far...
			if(scroller._clicks == null){
				scroller._clicks = 1
			} else {
				scroller._clicks += 1
			}

			// kill any previous waits...
			if(scroller._click_timeout_id != null){
				clearTimeout(scroller._click_timeout_id)
			}

			// wait for the next click...
			scroller._click_timeout_id = setTimeout(function(){
				var clicks = scroller._clicks
				data.clicks = clicks
				if(clicks == 1){
					root.trigger('shortClick', data)
				} else if(clicks == 2){
					root.trigger('doubleClick', data)
				} else {
					root.trigger('multiClick', data)
				}					
				scroller._clicks = null
				scroller._click_timeout_id = null
			}, multiClickTimeout)

			return
		}
	}

	// swipes...
	// XXX might be a good idea to chain these with swipe and screenReleased
	if(Math.abs(data.distance.x) > Math.abs(data.distance.y)){
		if(data.distance.x <= -clickThreshold && root.data('events').swipeLeft){
			return root.trigger('swipeLeft', data)
		} else if(data.distance.x >= clickThreshold && root.data('events').swipeRight){
			return root.trigger('swipeRight', data)
		}
	} else {
		if(data.distance.y <= -clickThreshold && root.data('events').swipeUp){
			return root.trigger('swipeUp', data)
		} else if(data.distance.y >= clickThreshold && root.data('events').swipeDown){
			return root.trigger('swipeDown', data)
		}
	}

	// this is triggered if no swipes were handled...
	return root.trigger('screenReleased', data)
} 




/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
