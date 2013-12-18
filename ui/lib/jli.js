/**********************************************************************
* JavaScript Lib
* at this point this is just a place I put most of the generic stuff I 
* use.
* 
* P.S. the name "jli" just stands for Java script LIb, like how it 
* looks...
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true



/*********************************************************************/

// This will create a function that will cycle through a class_list on elem 
// calling the optional callbacks before and/or after.
// If class_list is given as a string, then this will create a toggler that 
// will turn the given class on the element on and off.
//
// Elem is a jquery compatible object; default use-case: a css selector.
//
// This will return a function with the folowing signature:
//
// 	func() -> <state>
// 	func(<action>) -> <state>
// 	func(<target>, <action>) -> <state>
//
//
// In the first form this just toggles the state.
//
// In forms 2 and 3, if class_list is a string, the <action> can be :
// 	- <index>		: 0 for 'off' and 1 for 'on' (see below)
// 	- 'on'			: switch mode on -- add class
// 	- 'off'			: switch mode off -- remove class
// 	- '!'			: reload current state, same as toggler(toggler('?'))
// 	- '?'			: return current state ('on'|'off')
//
// In forms 2 and 3, if class_list is a list of strings, the <action> can be:
//  - <index>		: explicitly set the state to index in class_list
//  - <class-name>	: explicitly set a class from the list
// 	- '!'			: reload current state, same as toggler(toggler('?'))
// 	- '?'			: return current state ('on'|'off')
//
//
// In the third form the <target> is a jquery-compatible object.
//
// In all forms this will return the current state string or null if the
// action argument given is invalid.
//
// NOTE: action '?' is handled internally and not passed to the callbacks.
// NOTE: there is a special action 'next', passing it will have the same
// 		effect as not passing any action -- we will change to the next 
// 		state.
// NOTE: if it is needed to apply this to an explicit target but with 
// 		no explicit action, just pass 'next' as the second argument.
// NOTE: a special class name 'none' means no class is set, if it is present 
// 		in the class_list then that state will be with all other state 
// 		classes removed.
// NOTE: <class-name> must be an exact match to a string given in class_list
// NOTE: of only one callback is given then it will be called after the 
// 		class change...
// 		a way around this is to pass an empty function as callback_b
// NOTE: leading dots in class names in class_list are optional. 
// 		this is due to several times I've repeated the same mistake of 
// 		forgetting to write the classes without leading dots, the class 
// 		list is not normalized...
// NOTE: the toggler can be passed a non-jquery object, but then only an
// 		explicit state is supported as the second argument, the reason 
// 		being that we can not determain the current state without a propper
// 		.hasClass(..) test...
//
//
// This also takes one or two callbacks. If only one is given then it is
// called after (post) the change is made. If two are given then the first
// is called before the change and the second after the change.
//
// The callbacks are passed two arguments:
// 	- <action>		: the state we are going in
// 	- <target>		: the target element or the element passed to the 
// 					  toggler
// 
//
// The callback function will have 'this' set to the same value as the 
// toggler itself, e.g. if the toggler is called as a method, the 
// callback's 'this' will reference it's parent object.
//
// NOTE: the pre-callback will get the "intent" action, i.e. the state the
// 		we are changing into but the changes are not yet made.
// NOTE: if the pre-callback explicitly returns false, then the change will
// 		not be made.
function createCSSClassToggler(elem, class_list, callback_a, callback_b){
	var bool_action = false
	if(typeof(class_list) == typeof('')){
		class_list = ['none', class_list]
		bool_action = true
	}
	// Normalize classes -- remove the dot from class names...
	// NOTE: this is here because I've made the error of including a 
	// 		leading "." almost every time I use this after I forget 
	// 		the UI...
	class_list = $(class_list).map(function(_, e){
		return $(e.split(' ')).map(function(_, c){
			c = c.trim()
			return c[0] == '.' ? c.slice(1) : c
		}).toArray().join(' ')
	}).toArray()
	// normalize the callbacks...
	if(callback_b == null){
		var callback_pre = null
		var callback_post = callback_a
	} else {
		var callback_pre = callback_a
		var callback_post = callback_b
	}

	// XXX make this generic...
	var func = function(a, b){
		if(b == null){
			var action = a == 'next' ? null : a
			var e = elem
		} else {
			var e = a
			var action = b == 'next' ? null : b
		}
		var args = args2array(arguments).slice(2)
		e = $(e)
		// option number...
		if(typeof(action) == typeof(1)){
			// range check...
			if(action < 0 || action >= class_list.length){
				return null
			}
			if(bool_action){
				action = action == 0 ? 'off' : 'on'
			} else {
				action = class_list[action]
			}
		}
		// we need to get the current state...
		if(action == null || action == '?' || action == '!'){
			// get current state...
			var cur = 'none'
			for(var i=0; i < class_list.length; i++){
				if(e.hasClass(class_list[i])){
					cur = class_list[i]
					break
				}
			} 
			// just asking for info...
			if(action == '?'){
				return bool_action ? (cur == 'none' ? 'off' : 'on') : cur
			}

			// force reload of current state...
			if(action == '!'){
				action = bool_action ? (cur == 'none' ? 'off' : 'on') : cur
			}

		// invalid action...
		} else if((bool_action && ['on', 'off'].indexOf(action) == -1)
				|| (!bool_action && class_list.indexOf(action) == -1)){
			return null
		}

		var cls = bool_action ? class_list[1] : action
		// get the right class...
		if(action == null){
			var i = class_list.indexOf(cur)+1
			i = i == -1 ? 0 : i
			i = i == class_list.length ? 0 : i
			cls = class_list[i]

			if(bool_action){
				action = cls == 'none' ? 'off' : 'on'
			} else {
				action = cls
			}
		}

		// NOTE: the callbacks are passed the same this as the calling 
		// 		function, this will enable them to act as metods correctly
		// pre callback...
		if(callback_pre != null){
			if(callback_pre.apply(this, [action, e].concat(args)) === false){
				// XXX should we return action here???
				//return
				return func('?')
			}
		}
		// update the element...
		e.removeClass(class_list.join(' '))
		if(cls != 'none' && action != 'off'){
			e.addClass(cls)
		}
		// post callback...
		if(callback_post != null){
			callback_post.apply(this, [action, e].concat(args))
		}

		return action
	}

	func.class_list = class_list
	if(bool_action){
		func.doc = 'With no arguments this will toggle between "on" and '+
			'"off".\n'+
			'If either "on" or "off" are given then this will switch '+
			'to that mode.\n'+
			'If "?" is given, this will return either "on" or "off" '+
			'depending on the current state.'
	}else{
		func.doc = 'With no arguments this will toggle between '+
			class_list +' in cycle.\n' + 
			'if any of the state names or its number is given then that '+
			'state is switched on.'+
			'If "?" is given, this will return the current state.'
	}

	return func
}



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
			time = 5
		}	
		obj = $(obj)
		obj.addClass('unanimated')
		var res = func.apply(func, arguments)
		setTimeout(function(){obj.removeClass('unanimated')}, time)
		return res
	}
}


// NOTE: this will only use the first element in a set.
// NOTE: if no element is given this will return null.
function makeCSSVendorAttrGetter(attr, dfl, callback){
	return function(elem){
		elem = $(elem)
		if(elem.length == 0){
			return null
		}
		// using the attr...
		var vendors = ['O', 'Moz', 'ms', 'webkit']
		var data = elem[0].style[attr]

		// go through vendor prefixes... (hate this!)
		if(!data || data == 'none'){
			for(var i in vendors){
				data = elem[0].style[vendors[i] + attr.capitalize()]
				if(data && data != 'none'){
					break
				}
			}
		}
		// no data is set...
		if(!data || data == 'none'){
			return dfl
		}
		return callback(data)
	}
}


// Return a scale value for the given element(s).
// NOTE: this will only return a single scale value...
var getElementScale = makeCSSVendorAttrGetter(
		'transform',
		1,
		function(data){
			return parseFloat((/(scale|matrix)\(([^),]*)\)/).exec(data)[2])
		})

var getElementShift = makeCSSVendorAttrGetter(
		'transform',
		{left: 0, top: 0},
		function(data){
			res = /(translate\(|matrix\([^,]*,[^,]*,[^,]*,[^,]*,)([^,]*),([^\)]*)\)/.exec(data)
			return {
				left: parseFloat(res[2]),
				top: parseFloat(res[3])
			}
		})


var DEFAULT_TRANSITION_DURATION = 200

var getElementTransitionDuration = makeCSSVendorAttrGetter(
		'transitionDuration', 
		DEFAULT_TRANSITION_DURATION, 
		parseInt)



var USE_TRANSFORM = true
var USE_3D_TRANSFORM = true

// NOTE: at this point this works only on the X axis...
function setElementTransform(elem, offset, scale, duration){
	elem = $(elem)
	//var t3d = USE_3D_TRANSFORM ? 'translateZ(0px)' : ''
	var t3d = USE_3D_TRANSFORM ? 'translate3d(0,0,0)' : ''

	if(offset == null){
		offset = getElementShift(elem)
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
		}
	}
	if(scale == null){
		var scale = getElementScale(elem)
	}
	if(USE_TRANSFORM){
		var transform = 'translate('+ 
				Math.round(offset.left) +'px, '+
				Math.round(offset.top) +'px) scale('+ scale +') ' + t3d
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
		var transform = 'translate(0px, 0px) scale('+ scale +') ' + t3d
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
		}, duration)
	}
	return elem
}


// XXX this affects only the innertial part, not setCurrentPage...
var USE_TRANSITIONS_FOR_ANIMATION = false

// XXX make this a drop-in replacement for setElementTransform...
// XXX cleanup, still flacky...
function animateElementTo(elem, to, duration, easing, speed, use_transitions){
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
			}
		}
		if(typeof(speed) == typeof(2)){
			speed = {
				x: speed,
				y: 0,
			}
		}
		if(duration == null){
			duration = getElementTransitionDuration(elem)
		}

		setTransitionDuration(elem, 0)

		var start = Date.now()
		var then = start + duration
		var from = getElementShift(elem)
		var cur = {
			top: from.top,
			left: from.left
		}
		var dist = {
			top: to.top - from.top,
			left: to.left - from.left,
		}
		elem.animating = true

		function animate(){
			var t = Date.now()
			// end of the animation...
			if(t >= then){
				setElementTransform(elem, to)
				return
			}
			if(!elem.animating){
				// XXX jittery...
				setElementTransform(elem, cur)
				return
			}

			// do an intermediate step...
			// XXX do propper easing...
			// XXX sometimes results in jumping around...
			// 		...result of jumping over the to position...
			if(speed != null){

				// XXX the folowing two blocks are the same...
				// XXX looks a bit too complex, revise...
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
						cur.top = to.top
					}
				}

				// XXX looks a bit too complex, revise...
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
						cur.left = to.left
					}
				}

			// XXX this is a staright forward linear function...
			} else {
				var r = (t - start) / duration
				cur.top = Math.round(from.top + (dist.top * r))
				cur.left = Math.round(from.left + (dist.left * r)) 
			}
			setElementTransform(elem, cur)
			// sched next frame...
			elem.next_frame = getAnimationFrame(animate)
		}

		animate()
	}
}

function stopAnimation(elem){
	if(elem.next_frame){
		cancelAnimationFrame(elem.next_frame)
	}
}


// XXX account for other transitions...
function setElementScale(elem, scale){
	return setElementTransform(elem, null, scale)
}


function setElementOrigin(elem, x, y, z){
	x = x == null ? '50%' : x
	y = y == null ? '50%' : y
	z = z == null ? '0' : z
	var value = x +' '+ y +' '+ z

	return $(elem).css({
		'transform-origin': value, 
		'-ms-transform-origin':  value,
		'-webkit-transform-origin':  value,
	})
}


function setTransitionEasing(elem, ease){
	if(typeof(ms) == typeof(0)){
		ms = ms + 'ms'
	}
	return $(elem).css({
		'transition-timing-function': ease, 
		'-moz-transition-timing-function': ease,
		'-o-transition-timing-function': ease,
		'-ms-transition-timing-function': ease,
		'-webkit-transition-timing-function': ease
	})
}


function setTransitionDuration(elem, ms){
	if(typeof(ms) == typeof(0)){
		ms = ms + 'ms'
	}
	return elem.css({
		'transition-duration': ms, 
		'-moz-transition-duration': ms,
		'-o-transition-duration': ms,
		'-ms-transition-duration': ms,
		'-webkit-transition-duration': ms
	})
}



/************************************************ jQuery extensions **/

jQuery.fn.reverseChildren = function(){
	return $(this).each(function(_, e){
		return $(e).append($(e).children().detach().get().reverse())
	})
}



jQuery.fn.sortChildren = function(func){
	return $(this).each(function(_, e){
		return $(e).append($(e).children().detach().get().sort(func))
	})
}



/************************************************** Deferred utils ***/

// Deferred worker queue
//
// This will either create a new queue or attach to the tail of an 
// existing queue (deferred) if given.
//
// This will return a deferred object with several extensions:
//
// 		.enqueue(worker, ...)
// 			Add a worker to the queue.
// 			A worker is triggered by the previous worker in queue 
// 			getting resolved. 
// 			NOTE: A worker must return a deferred.
// 			NOTE: all the arguments to this except for the first (the 
// 				worker itself) will be passed to the worker when it is 
// 				called.
//
// 		.start()
// 			Start the first worker.
//
// 		.kill()
// 			Stop the queue, preventing any new workers from starting.
// 			NOTE: this will not kill the currently running worker.
// 			NOTE: after a queue is killed it can not be restarted.
//
// 		.isWorking()
// 			will return true if there is at least one worker still not
// 			resolved, false otherwise.
// 			NOTE: if the queue is killed, this will always return false.
//
//
// NOTE: the queue is not started by default.
// NOTE: one queue is guaranteed to work in a sequence, to run several 
// 		pipelines in parallel use two or more queues.
// NOTE: running queues in parallel depends on the actual context in
// 		use (browser/node.js/...).
//
// XXX should this be restartable???
// XXX check if this leaks used nodes...
function makeDeferredsQ(first){
	first = first == null ? $.Deferred() : first

	var last = first

	// XXX make this a deferred-like cleanly, rather than by monkey patching...
	var queue = $.Deferred()

	// Add a worker to queue...
	//
	// NOTE: .enqueue(...) accepts a worker and any number of the arguments
	// 		to be passed to the worker when it's its turn.
	// NOTE: the worker must porduce a deffered/promice.
	queue.enqueue = function(worker){
		var cur = $.Deferred()
		var args = Array.apply(null, arguments).slice(1)

		function run(){
			return worker.apply(null, args)
				.done(function(o){ 
					cur.resolve(o) 
				})
				.fail(function(){ 
					cur.resolve('fail') 
				})
		}

		last.done(function(){

			// XXX one way to stop and resume the queue execution is:
			// 		1) add a "suspended" state
			// 		2) in the "suspended" state bind the worker start to 
			// 			.resume(...)
			if(queue.state() == 'suspended'){
				queue.resumed(function(){
					run()
				})

			// if we are killed drop the work...
			} else if(queue.state() == 'resolved'){
				// this will kill the queue as we continue only on success...
				cur.reject() 
				return

			// do the work now...
			} else {
				run()
			}
		})

		last = cur

		return cur
	}

	// Start the work...
	queue.start = function(){
		first.resolve()
		return this
	}

	// Kill the queue...
	queue.kill = function(){
		this.resolve()
		return this
	}

	/* XXX suspend interface...
	// XXX change the state...
	queue.suspend = function(){
		// XXX 
		return this
	}
	// XXX change the state...
	queue.resume = function(){
		// XXX 
		return this
	}
	// XXX change the state...
	queue.resumed = function(){
		// XXX 
		return this
	}
	*/

	// Report work state...
	// XXX make this a proper state, or integrate into the deferred in 
	// 		a more natural way...
	// 		...need a way to bind to this state change...
	queue.isWorking = function(){
		if(queue.state() != 'resolved' && last.state() != 'resolved'){
			return true
		}
		return false
	}

	return queue
}



/**************************************************** JS utilities ***/

String.prototype.capitalize = function(){
	return this[0].toUpperCase() + this.slice(1)
}


// XXX not sure if this has to be a utility or a method...
Object.get = function(obj, name, dfl){
	var val = obj[name]
	if(val === undefined && dfl != null){
		return dfl
	}
	return val
}


// convert JS arguments to Array...
function args2array(args){
	return Array.apply(null, args)
}


var getAnimationFrame = (window.requestAnimationFrame
		|| window.webkitRequestAnimationFrame 
		|| window.mozRequestAnimationFrame
		|| window.oRequestAnimationFrame
		|| window.msRequestAnimationFrame
		|| function(callback){ 
			setTimeout(callback, 1000/60) 
		})


var cancelAnimationFrame = (window.cancelRequestAnimationFrame 
		|| window.webkitCancelAnimationFrame 
		|| window.webkitCancelRequestAnimationFrame 
		|| window.mozCancelRequestAnimationFrame
		|| window.oCancelRequestAnimationFrame
		|| window.msCancelRequestAnimationFrame
		|| clearTimeout)


Date.prototype.toShortDate = function(){
	var y = this.getFullYear()
	var M = this.getMonth()+1
	M = M < 10 ? '0'+M : M
	var D = this.getDate()
	D = D < 10 ? '0'+D : D
	var H = this.getHours()
	H = H < 10 ? '0'+H : H
	var m = this.getMinutes()
	m = m < 10 ? '0'+m : m
	var s = this.getSeconds()
	s = s < 10 ? '0'+s : s

	return ''+y+'-'+M+'-'+D+' '+H+':'+m+':'+s
}
Date.prototype.getTimeStamp = function(no_seconds){
	var y = this.getFullYear()
	var M = this.getMonth()+1
	M = M < 10 ? '0'+M : M
	var D = this.getDate()
	D = D < 10 ? '0'+D : D
	var H = this.getHours()
	H = H < 10 ? '0'+H : H
	var m = this.getMinutes()
	m = m < 10 ? '0'+m : m
	var s = this.getSeconds()
	s = s < 10 ? '0'+s : s

	return ''+y+M+D+H+m+s
}
Date.prototype.setTimeStamp = function(ts){
	ts = ts.replace(/[^0-9]*/g, '')
	this.setFullYear(ts.slice(0, 4))
	this.setMonth(ts.slice(4, 6)*1-1)
	this.setDate(ts.slice(6, 8))
	this.setHours(ts.slice(8, 10))
	this.setMinutes(ts.slice(10, 12))
	this.setSeconds(ts.slice(12, 14))
	return this
}
Date.timeStamp = function(){
	return (new Date()).getTimeStamp()
}
Date.fromTimeStamp = function(ts){
	return (new Date()).setTimeStamp(ts)
}


function logCalls(func, logger){
	var that = this
	var _func = function(){
		logger(func, arguments)
		return func.apply(that, arguments)
	}
	_func.name = func.name
	return _func
}


function assyncCall(func){
	var that = this
	var _func = function(){
		var res = $.Deferred()
		setTimeout(function(){
			res.resolve(func.apply(that, arguments))
		}, 0)
		return res
	}
	_func.name = func.name
	return _func
}



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
