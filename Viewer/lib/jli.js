/**********************************************************************
* JavaScript Lib
* at this point this is just a place I put most of the generic stuff I 
* use.
* 
* P.S. the name "jli" just stands for Java script LIb, like how it 
* looks...
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true

var POOL_SIZE = 64

var DEFAULT_TRANSITION_DURATION = 200

// XXX this affects only the innertial part, not setCurrentPage...
var USE_TRANSITIONS_FOR_ANIMATION = false

var USE_TRANSFORM = true
var USE_3D_TRANSFORM = true




/*
// show a jQuary opject in viewer overlay...
// XXX need to set .scrollTop(0) when showing different UI... 
// 		...and not set it when the UI is the same
// XXX this must create it's own overlay...
function showInOverlay(obj){
	obj.click(function(){ return false })
	// XXX 
	$('.viewer').addClass('overlay-mode')
	// clean things up...
	$('.overlay .content').children().remove()
	// put it in the overlay...
	$('.overlay .content').append(obj)
	// prepare the overlay...
	$('.overlay')
		.one('click', function(){
			$('.overlay')
				.fadeOut(function(){
					$('.overlay .content')
						.children()
							.remove()
					$('.overlay-mode').removeClass('overlay-mode')
				})
		})
		.fadeIn()
	return obj
}



function overlayMessage(text){
	return showInOverlay($('<div class="overlay-message">' +text+ '</div>'))
}
*/



function unanimated(obj, func, time){
	return function(){
		if(time == null){
			time = 5 }	
		obj = $(obj)
		obj.addClass('unanimated')
		var res = func.apply(func, arguments)
		setTimeout(function(){obj.removeClass('unanimated')}, time)
		return res } }


// NOTE: this will only use the first element in a set.
// NOTE: if no element is given this will return null.
function makeCSSVendorAttrGetter(attr, dfl, callback){
	return function(elem){
		elem = $(elem)
		if(elem.length == 0){
			return null }
		// using the attr...
		var vendors = ['O', 'Moz', 'ms', 'webkit']
		var data = elem[0].style[attr]

		// go through vendor prefixes... (hate this!)
		if(!data || data == 'none'){
			for(var i in vendors){
				data = elem[0].style[vendors[i] + attr.capitalize()]
				if(data && data != 'none'){
					break } } }
		// no data is set...
		if(!data || data == 'none'){
			return dfl }
		return callback(data) } }



var getElementOrigin = makeCSSVendorAttrGetter(
		'transformOrigin',
		{top: 0, left: 0},
		function(data){
			var res = /(-?[0-9.]*(px|%)) (-?[0-9.]*(px|%))/.exec(data)
			return {
				left: res[1].slice(-2) == 'px' ? parseFloat(res[1]) : res[1],
				top: res[3].slice(-2) == 'px' ? parseFloat(res[3]) : res[3],
			} })


// Return a scale value for the given element(s).
// NOTE: this will only return a single scale value...
var getElementScale = makeCSSVendorAttrGetter(
		'transform',
		1,
		function(data){
			return parseFloat((/(scale|matrix)\(([^),]*)\)/).exec(data)[2]) })


var getElementOffset = makeCSSVendorAttrGetter(
		'transform',
		{left: 0, top: 0},
		function(data){
			var res = /(translate\(|matrix\([^,]*,[^,]*,[^,]*,[^,]*,)([^,]*),([^\)]*)\)/.exec(data)
			return {
				left: parseFloat(res[2]),
				top: parseFloat(res[3])
			} })


var getElementTransitionDuration = makeCSSVendorAttrGetter(
		'transitionDuration', 
		DEFAULT_TRANSITION_DURATION, 
		parseInt)


// Get relative offset...
//
// This is like jQuery.offset() but takes into account:
//	- scale
//	- origin
//	- actual relative offset
//
// point can be:
//	- {
//		top: <top>, 
//		left: <left>,
//		[scale: 'screen'|'elem'|<scale>,]
//	  }
//	- 'origin' (default)
//
// This expects: 
// 	- the block is directly nested in the container
// 	- the block can be scaled
// 	- the block has an origin set
//
function getRelativeOffset(container, block, point){
	point = point == null ? {} : point
	var l = point.left
	var t = point.top
	var scale = point.scale

	// get the input data...
	var s = getElementScale(block)
	var o = getElementOrigin(block)
	// get only the value we need...
	var W = container.width()
	var H = container.height()
	// we need this to make everything relative to the container...
	var co = container.offset()
	var offset = getElementOffset(block)
	var bo = block.offset()

	scale = scale == 'screen' ? 1 
		: scale == 'elem' ? s
		: scale == null ? s
		: scale

	// normalize the l,t to element scale...
	if(l != null && t != null){

		// get only the value we need...
		// NOTE: width and height are used to calculate the correction
		//		due to origin/scale...
		var w = block.width()
		var h = block.height()
		o = {
			// target offset scale...
			top: t*scale 
				// set origin to top left corner of element (compensate
				// for scaling)...
				+ (h - h*s) / (h / o.top), 
			left: l*scale 
				+ (w - w*s) / (w / o.left),
		} }

	return {
		top: offset.top + (H/2 - offset.top) - o.top,
		left: offset.left + (W/2 - offset.left) - o.left,
	} }


// NOTE: at this point this works only on the X axis...
function setElementTransform(elem, offset, scale, duration){
	elem = $(elem)
	//var t3d = USE_3D_TRANSFORM ? 'translateZ(0)' : ''
	var t3d = USE_3D_TRANSFORM ? 'translate3d(0,0,0)' : ''
	//var translate = USE_3D_TRANSFORM ? 'translate3d' : 'translate'
	var translate = 'translate'

	if(offset == null){
		offset = getElementOffset(elem)
	// number -- only the x coord...
	} else if(typeof(offset) == typeof(1)){
		offset = {
			left: offset,
			top: 0
		}
	// array...
	} else if(offset.indexOf){
		offset = {
			left: offset[0] ? offset[0] : 0,
			top: offset[1] ? offset[1] : 0
		} }
	if(scale == null){
		var scale = getElementScale(elem) }
	if(USE_TRANSFORM){
		var transform = translate+'('+ 
				Math.round(offset.left) +'px, '+
				//Math.round(offset.top) +'px'+ (USE_3D_TRANSFORM && ', 0px' || '') +') '
				Math.round(offset.top) +'px) '
			+'scale('+ scale +') '
			+ t3d
		elem.css({
			'-ms-transform' : transform, 
			'-webkit-transform' : transform, 
			'-moz-transform' : transform, 
			'-o-transform' : transform, 
			'transform' : transform, 

			// XXX can we avoid this here?? 
			left: 0,
			// XXX is this correct???
			top: ''
		}, duration)
	} else {
		//var transform = translate+'(0px, 0px'+ (USE_3D_TRANSFORM && ', 0px' || '') +') '
		var transform = translate+'(0px, 0px) '
			+'scale('+ scale +') '
			+ t3d
		elem.css({
			// NOTE: this will be wrong during a transition, that's why we 
			// 		can pass the pre-calculated offset as an argument...
			left: Math.round(offset.left),
			top: Math.round(offset.top),

			// XXX can we avoid this here?? 
			'-ms-transform' : transform, 
			'-webkit-transform' : transform, 
			'-moz-transform' : transform, 
			'-o-transform' : transform, 
			'transform' : transform, 
		}, duration) }
	return elem }


// Run a function controllably in an animation frame
//
// NOTE: we do not need to make this run several callbacks as the 
// 		browser already does this and will do the loop faster...
function animationFrameRunner(func){
	var next
	var _nop = function(){ return this }
	var frame

	self = this === window ?
		new animationFrameRunner
		: this

	self.func = func

	var _tick = function(){
		func(Date.now())
		frame = getAnimationFrame(next) }

	// main user interface...
	var start = function(){
		next = _tick
		this.start = _nop
		this.stop = stop

		// start things up...
		// NOTE: we are not calling _tick here directly to avoid stray,
		// 		off-frame call to func...
		frame = getAnimationFrame(next)

		return this }
	var stop = function(){
		if(frame != null){
			cancelAnimationFrame(frame)
			frame = null }
		next = _nop
		this.start = start
		this.stop = _nop 
		return this }

	// setup the ticker in stopped state...
	stop.call(self)

	return self }


// XXX make this a drop-in replacement for setElementTransform...
// XXX cleanup, still flacky...
function animateElementTo(elem, to, duration, easing, speed, callback, use_transitions){
	// stop all ongoing animations on the current elem...
	stopAnimation(elem)
	use_transitions = use_transitions != null ? 
							use_transitions 
							: USE_TRANSITIONS_FOR_ANIMATION
	// use transition for animation...
	if(use_transitions){
		setTransitionEasing(elem, easing)
		duration == null && setTransitionDuration(elem, duration)
		setElementTransform(elem, to)

	// manually animate...
	} else {
		if(typeof(to) == typeof(1)){
			to = {
				left: to,
				top: 0,
			} }
		if(typeof(speed) == typeof(2)){
			speed = {
				x: speed,
				y: 0,
			} }
		if(duration == null){
			duration = getElementTransitionDuration(elem) }

		setTransitionDuration(elem, 0)

		var start = Date.now()
		var then = start + duration
		var from = getElementOffset(elem)
		var cur = {
			top: from.top,
			left: from.left
		}
		var dist = {
			top: to.top - from.top,
			left: to.left - from.left,
		}

		// XXX are we using this...
		elem.animating = true
		elem.next_frame = null

		// remember step start position...
		var s_t = cur.top
		var s_l = cur.left

		function animate(){
			// prevent running animations till next call of animateElementTo(..)
			if(elem.next_frame === false){
				return }
			var t = Date.now()
			// end of the animation...
			if(t >= then){
				setElementTransform(elem, to)
				return }
			if(!elem.animating){
				// XXX jittery...
				setElementTransform(elem, cur)
				return }

			// remember step start position...
			s_t = cur.top
			s_l = cur.left

			// animate a step with speed...
			if(speed != null){
				// NOTE: these are almost identical, they are inlined 
				// 		for speed...
				if(Math.abs(dist.top) >= 1){
					dy = ((t - start) * speed.y)
					if(Math.abs(dist.top) > Math.abs(dy)){
						dist.top -= dy
						cur.top = Math.round(cur.top + dy)
						// normalize...
						cur.top = Math.abs(dist.top) <= 1 ? to.top : cur.top
						// calc speed for next step...
						speed.y = dist.top / (duration - (t - start))
					} else {
						cur.top = to.top } }
				if(Math.abs(dist.left) >= 1){
					dx = ((t - start) * speed.x)
					if(Math.abs(dist.left) > Math.abs(dx)){
						dist.left -= dx
						cur.left = Math.round(cur.left + dx)
						// normalize...
						cur.left = Math.abs(dist.left) <= 1 ? to.left : cur.left
						// calc speed for next step...
						speed.x = dist.left / (duration - (t - start))
					} else {
						cur.left = to.left } }

			// liner animate...
			} else {
				var r = (t - start) / duration
				cur.top = Math.round(from.top + (dist.top * r))
				cur.left = Math.round(from.left + (dist.left * r)) 
			}
			setElementTransform(elem, cur)

			callback != null && callback({
				x: cur.left - s_l,
				y: cur.top - s_t,
			})

			// sched next frame...
			elem.next_frame = getAnimationFrame(animate) }

		animate() } }


function stopAnimation(elem){
	if(elem.next_frame){
		cancelAnimationFrame(elem.next_frame)
		elem.next_frame = false
		return } }


// XXX account for other transitions...
// XXX make a sync version...
function setElementOffset(elem, l, t, scale){
	return setElementTransform(elem, [l, t], scale) }


function setElementScale(elem, scale){
	return setElementTransform(elem, null, scale) }


function setElementOrigin(elem, x, y, z){
	x = x == null ? '50%' : x
	y = y == null ? '50%' : y
	z = z == null ? '0' : z
	var value = x +' '+ y +' '+ z

	return $(elem).css({
		'transform-origin': value, 
		'-o-transform-origin':  value,
		'-ms-transform-origin':  value,
		'-moz-transform-origin':  value,
		'-webkit-transform-origin':  value,
	}) }


// a sync version of setElementOrigin(..), this will not trigger transforms...
function setElementOriginSync(elem, x, y, z){
	x = x == null ? '50%' : x
	y = y == null ? '50%' : y
	z = z == null ? '0' : z
	var value = x +' '+ y +' '+ z

	elem = $(elem)
	var e = elem[0]

	e.style.display = 'none'
	// now kick the browser into recognition of our changes NOW ;)
	getComputedStyle(e).display

	e.style['-o-transform-origin'] =  value
	e.style['-ms-transform-origin'] =  value
	e.style['-moz-transform-origin'] =  value
	e.style['-webkit-transform-origin'] =  value
	e.style['transform-origin'] = value

	e.style.display = ''
	getComputedStyle(e).display

	return $(elem) }


// this is like setElementOrigin(..) but will compensate for element 
// shift when scaled...
// NOTE: this will work only of translate is used for positioning...
function shiftOriginTo(elem, l, t, scale){
	var o = getElementOrigin(elem)
	var scale = scale || getElementScale(elem)
	var offset = getElementOffset(elem)

	// calculate the offset change and compensate...
	var cl = offset.left + ((o.left - o.left*scale) - (l - l*scale))
	var ct = offset.top + ((o.top - o.top*scale) - (t - t*scale))

	setElementOffset(elem, cl, ct)

	return setElementOriginSync(elem, l+'px', t+'px') }


function setTransitionEasing(elem, ease){
	if(typeof(ms) == typeof(0)){
		ms = ms + 'ms' }
	return $(elem).css({
		'transition-timing-function': ease, 
		'-moz-transition-timing-function': ease,
		'-o-transition-timing-function': ease,
		'-ms-transition-timing-function': ease,
		'-webkit-transition-timing-function': ease
	}) }


function setTransitionDuration(elem, ms){
	if(typeof(ms) == typeof(0)){
		ms = ms + 'ms' }
	return elem.css({
		'transition-duration': ms, 
		'-moz-transition-duration': ms,
		'-o-transition-duration': ms,
		'-ms-transition-duration': ms,
		'-webkit-transition-duration': ms
	}) }



/************************************************ jQuery extensions **/

jQuery.fn.reverseChildren = function(){
	return $(this).each(function(_, e){
		return $(e).append($(e).children().detach().get().reverse()) }) }



jQuery.fn.sortChildren = function(func){
	return $(this).each(function(_, e){
		return $(e).append($(e).children().detach().get().sort(func)) }) }



/************************************************** Deferred utils ***/

// Deferred worker pool...
//
// 		makeDeferredPool([size][, paused]) -> pool
//
//
// This will create and return a pooled queue of deferred workers.
//
//
// The pool can be in one of the folowing states:
//
// 	- filling
// 		This state prevents .depleted() from triggering until the pool 
// 		exits the filling state.
// 		This helps us to prevent premature depletion of the pool in 
// 		cases where the queue is depleted faster than it is being filled.
//
// 	- paused
// 		This state prevents any new queued workers from starting.
//
//
// Public interface:
//
// 		.enqueue(obj, func, args) -> deferred
// 			Add a worker to queue.
// 			If the pool is not filled and not paused, this will run the
// 			worker right away.
// 			If the pool is full the worker is added to queue (FIFO) and
// 			ran in its turn.
//
// 		.dropQueue() -> pool
// 			Drop the queued workers.
// 			NOTE: this will not stop the already running workers.
//
//
//		.filling()
//			Enter the filling state
//
//		.doneFilling()
//			Exit the filling state
//			NOTE: this will trigger .depleted() if at the time of call
//				both the pool and queue are empty.
//
//
// 		.pause() -> pool
// 			Pause the queue.
// 			NOTE: this also has a second form: .pause(func), see below.
//
// 		.resume() -> pool
// 			Restart the queue.
//
//
//		.isFilling() -> bool
//			Test if the pool is being filled -- filling state.
//
// 		.isRunning() -> bool
// 			Test if any workers are running in the pool.
// 			NOTE: this will return false ONLY when the pool is empty.
//
// 		.isPaused() -> bool
// 			Test if pool is in a paused state.
// 			NOTE: some workers may sill be finishing up so if you want
// 					to test whether any workers are still running use
// 					.isRunning()
//
//
// Event handler/callback registration:
//
// 		.on(evt, func) -> pool
// 			Register a handler (func) for an event (evt).
//
// 		.off(evt[, func]) -> pool
// 			Remove a handler (func) form and event (evt).
// 			NOTE: if func is omitted, remove all handlers from the given
// 					event...
//
// 		.progress(func) -> pool
// 			Register a progress handler.
// 			The handler is called after each worker is done and will get
// 			passed:
// 				- workers done count
// 				- workers total count
// 			Short hand for:
// 				.on('progress', func) -> pool
// 			NOTE: the total number of workers can change as new workers
// 					are added or the queue is cleared...
// 			
// 		.fail(func) -> pool
// 			Register a worker fail handler.
// 			The handler is called when a worker goes into the fail state.
// 			This will get passed:
// 				- workers done count
// 				- workers total count
// 			Short hand for:
// 				.on('fail', func) -> pool
// 			NOTE: this will not stop the execution of other handlers.
//
// 		.pause(func) -> pool
// 			Register a pause handler.
// 			This handler is called after the last worker finishes when 
// 			the queue is paused.
// 			Short hand for:
// 				.on('progress', func) -> pool
//
// 		.resume(func) -> pool
// 			Short hand for:
// 				.on('resume', func) -> pool
//
// 		.depleted(func) -> pool
// 			Register a depleted pool handler.
// 			The handler will get called when the queue and pool are empty
// 			(depleted) and the last worker is done.
// 			Short hand for:
// 				.on('deplete', func) -> pool
//
// XXX should this be an object or a factory???
function makeDeferredPool(size, paused){
	size = size == null ? POOL_SIZE : size
	size = size < 0 ? 1 
		: size > 512 ? 512
		: size
	paused = paused == null ? false : paused


	var Pool = {
		pool: [],
		queue: [],
		size: size,

		// XXX do we need to hide or expose them and use their API???
		_event_handlers: {
			deplete: $.Callbacks(),
			progress: $.Callbacks(),
			pause: $.Callbacks(),
			resume: $.Callbacks(),
			fail: $.Callbacks()
		},

		_paused: paused,
	}

	// Run a worker...
	//
	// This will:
	// 	- create and add a worker to the pool, which will:
	// 		- run an element from the queue
	// 		- remove self from pool
	// 		- if the pool is not full, create another worker (call 
	// 		  ._run(..)) else exit
	// 		- call ._fill() to replenish the pool
	Pool._run = function(deferred, func, args){
		var that = this
		var pool = this.pool
		var pool_size = this.size
		var queue = this.queue
		var run = this._run

		// run an element from the queue...
		var worker = func.apply(null, args)
		pool.push(worker)

		// NOTE: this is explicitly after the pool push to avoid the 
		// 		possible race condition of the worker exiting and 
		// 		triggering .always(..) before being added to the pool...
		worker
			.always(function(){
				// prepare to remove self from pool...
				var i = pool.indexOf(this)

				Pool._event_handlers.progress.fire(pool.length - pool.len, pool.length + queue.length)

				// remove self from queue...
				delete pool[i]

				// shrink the pool if it's overfilled...
				// i.e. do not pop another worker and let the "thread" die.
				if(pool.len > pool_size){
					// remove self...
					return }
				// pause the queue -- do not do anything else...
				if(that._paused == true){
					// if pool is empty fire the pause event...
					if(pool.len == 0){
						Pool._event_handlers.pause.fire() }
					return }

				// get the next queued worker...
				var next = queue.splice(0, 1)[0]

				// run the next worker if it exists...
				if(next != null){
					run.apply(that, next)

				// empty queue AND empty pool mean we are done...
				} else if(pool.len == 0){
					var l = pool.length
					// NOTE: potential race condition -- something can be
					// 		pushed to pool just before it's "compacted"...
					pool.length = 0
				
					if(!that._filling){
						that._event_handlers.deplete.fire(l) } }

				// keep the pool full...
				that._fill() })
			.fail(function(){
				Pool._event_handlers.fail.fire(pool.length - pool.len, pool.length + queue.length)
				deferred.reject.apply(deferred, arguments) })
			.progress(function(){
				deferred.notify.apply(deferred, arguments) })
			.done(function(){
				deferred.resolve.apply(deferred, arguments) })

		return worker }

	// Fill the pool...
	//
	Pool._fill = function(){
		var that = this
		var pool_size = this.size
		var run = this._run
		var l = this.pool.len

		if(this._paused != true 
				&& l < pool_size 
				&& this.queue.length > 0){
			this.queue.splice(0, pool_size - l)
				.forEach(function(e){
					run.apply(that, e) }) }

		return this }


	// Public methods...

	// Add a worker to queue...
	//
	Pool.enqueue = function(func){
		var deferred = $.Deferred()

		// add worker to queue...
		this.queue.push([deferred, func, [...arguments].slice(1)])

		// start work if we have not already...
		this._fill()

		//return this
		return deferred }

	// Drop the queued workers...
	//
	// NOTE: this will not stop the running workers...
	// XXX should this return the pool or the dropped queue???
	Pool.dropQueue = function(){
		this.queue.splice(0, this.queue.length)
		return this }

	// Filling state...
	//
	// When this mode is set, it will prevent the queue from triggering
	// the depleated action until .doneFilling() is called...
	//
	// This is to prevent the pool depleting before the queue is filled
	// in the case of tasks ending faster than they are added...
	Pool.filling = function(){
		this._filling = true
		return this }
	Pool.doneFilling = function(){
		delete this._filling
		// trigger depleted if we are empty...
		if(this.pool.len == 0 && this.queue.length == 0){
			that._event_handlers.deplete.fire(l) }
		return this }
	Pool.isFilling = function(){
		return this._filling == true }

	// Paused state...
	//
	// NOTE: this will not directly cause .isRunning() to return false 
	// 		as this will not directly spot all workers, it will just 
	// 		pause the queue and the workers that have already started
	// 		will keep running until they are done, and only when the 
	// 		pool is empty will the .isRunning() return false.
	//
	// XXX test...
	Pool.pause = function(func){
		if(func == null){
			this._paused = true
		} else {
			this.on('pause', func) }
		return this }

	// XXX test...
	Pool.resume = function(func){
		if(func == null){
			this._paused = false
			this._event_handlers['resume'].forEach(function(f){ f() })
			this._fill()
		} else {
			this.on('resume', func) }
		return this }

	Pool.isPaused = function(){
		return this._paused }
	Pool.isRunning = function(){
		return this.pool.len > 0 }


	// Generic event handlers...
	Pool.on = function(evt, handler){
		this._event_handlers[evt].add(handler)
		return this }
	// NOTE: if this is not given a handler, it will clear all handlers 
	// 		from the given event...
	Pool.off = function(evt, handler){
		if(handler != null){
			this._event_handlers[evt].remove(handler)
		} else {
			this._event_handlers[evt].empty() }
		return this }

	// Register a queue depleted handler...
	//
	// This occurs when a populated queue is depleted and the last worker
	// is done.
	//
	// NOTE: this is similar to jQuery.Deferred().done(..) but differs in
	// 		that the pool can fill up and get depleted more than once, 
	// 		thus, the handlers may get called more than once per pool 
	// 		life...
	// NOTE: it is recommended to fill the queue faster than the workers
	// 		finish, as this may get called after last worker is done and
	// 		the next is queued...
	Pool.depleted = function(func){
		return this.on('deplete', func) }

	// Deferred compatibility...
	//
	// NOTE: the key difference between this and the deferred is that this
	// 		does not have memory and can get called multiple times...
	// XXX is this correct???
	//Pool.done = Pool.depleted

	// Register queue progress handler...
	//
	// This occurs after each worker is done.
	//
	// handler will be passed:
	// 	- the pool object
	// 	- workers done
	// 	- total workers (done + queued)
	Pool.progress = function(func){
		return this.on('progress', func) }

	// Register worker fail handler...
	//
	Pool.fail = function(func){
		return this.on('fail', func) }


	return Pool
}



/**************************************************** JS utilities ***/


// Get screen dpi...
//
// This will calculate the value and save it to screen.dpi
//
// if force is true this will re-calculate the value.
//
// NOTE: this needs the body loaded to work...
// NOTE: this may depend on page zoom...
// NOTE: yes, this is a hack, but since we have no other reliable way to
// 		do this...
function getDPI(force){
	if(screen.dpi == null || force){
		var e = $('<div id="inch">')
			.css({
				position: 'absolute',
				width: '1in',
				left: '-100%',
				top: '-100%'
			})
			.appendTo($('body'))
		var res = e.width()
		e.remove()
		screen.dpi = res
		return res	
	} else {
		return screen.dpi } }
// XXX is this correct???
$(getDPI)


// return 1, -1, or 0 depending on sign of x
function sign(x){
	return (x > 0) - (x < 0) }


var getAnimationFrame = (window.requestAnimationFrame
		|| window.webkitRequestAnimationFrame 
		|| window.mozRequestAnimationFrame
		|| window.oRequestAnimationFrame
		|| window.msRequestAnimationFrame
		|| function(callback){ 
			setTimeout(callback, 1000/60) })


var cancelAnimationFrame = (window.cancelAnimationFrame 
		|| window.webkitCancelAnimationFrame 
		|| window.mozCancelAnimationFrame
		|| window.oCancelAnimationFrame
		|| window.msCancelAnimationFrame
		|| clearTimeout)


function logCalls(func, logger){
	var that = this
	var _func = function(){
		logger(func, arguments)
		return func.apply(that, arguments) }
	_func.name = func.name
	return _func }


function assyncCall(func){
	var that = this
	var _func = function(){
		var res = $.Deferred()
		setTimeout(function(){
			res.resolve(func.apply(that, arguments))
		}, 0)
		return res }
	_func.name = func.name
	return _func }


// Quote a string and convert to RegExp to match self literally.
function quoteRegExp(str){
	return str.replace(/([\.\\\/\(\)\[\]\$\*\+\-\{\}\@\^\&\?\<\>])/g, '\\$1') }




/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
