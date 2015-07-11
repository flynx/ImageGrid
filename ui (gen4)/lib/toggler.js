/**********************************************************************
*
**********************************************************************/



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
// 		being that we can not determine the current state without a proper
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
//
// XXX revize/update this doc for Toggler(..)



// Make a generic toggler function/method...
//
// state_accessor signature:
//
// 	Get current state:
// 	state_accessor()
// 		-> <current-state>
//
// 	Set new state:
// 	state_accessor(<new-state>)
// 		-> <new-state>
//
// NOTE: for single state toggling, 'none' will get passed to 
// 		state_accessor to indicate an "empty" state...
// NOTE: if elem is a function it will be called in the same context as
// 		the toggler and is expected to return the element.
//
// XXX technically we do not need both elem and state_accessor here, the
// 		later is enough, but as strict mode is not stable enough (sometimes
// 		works and sometimes does not), we can not reliably pass the element
// 		via 'this'.
function Toggler(elem, state_accessor, states, callback_a, callback_b){
	// normalize states...
	states = typeof(states) == typeof('str') ? ['none', states] : states
	// normalize the callbacks...
	if(callback_b === undefined){
		var callback_pre = null
		var callback_post = callback_a
	} else {
		var callback_pre = callback_a
		var callback_post = callback_b
	}

	var bool_action = (states.length == 2 && states[0] == 'none')

	// NOTE: this needs to be strict so as to be able to distinguish 
	// 		between a method and a root context in a simple manner...
	var func = function(a, b){
		// XXX for some magical reason this does not work...
		'use strict'

		// parse arguments...
		if(b == null){
			var action = a == 'next' ? null : a
			// XXX is this correct???
			//var e = this
			var e = elem
		} else {
			var e = a
			var action = b == 'next' ? null : b
		}

		e = e instanceof Function ? e.call(this) : e

		// XXX is this correct???
		var args = args2array(arguments).slice(2)

		// option number...
		if(typeof(action) == typeof(1)){
			// range check...
			if(action < 0 || action >= states.length){
				return null
			}
			if(bool_action){
				action = action == 0 ? 'off' : 'on'
			} else {
				action = states[action]
			}
		}

		// we need to get the current state...
		if(action == null || action == '?' || action == '!'){
			// get current state...
			var cur = state_accessor.call(e)

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
				|| (!bool_action && states.indexOf(action) == -1)){
			return null
		}

		var state = bool_action ? states[action == 'off' ? 0 : 1] : action
		// get the right class...
		if(action == null){
			var i = states.indexOf(cur)+1
			i = i == -1 ? 0 : i
			i = i == states.length ? 0 : i
			state = states[i]

			if(bool_action){
				action = state == 'none' ? 'off' : 'on'
			} else {
				action = state
			}
		}

		// NOTE: the callbacks are passed the same this as the calling 
		// 		function, this will enable them to act as metods correctly
		// pre callback...
		if(callback_pre != null){
			if(callback_pre.apply(this, [action, e].concat(args)) === false){
				//return
				return func('?')
			}
		}

		// update the element...
		state_accessor.call(e, state)

		// post callback...
		if(callback_post != null){
			var res = callback_post.apply(this, [action, e].concat(args))
			if(res !== undefined){
				action = res
			}
		}

		return action
	}

	func.states = states
	if(bool_action){
		func.doc = 'With no arguments this will toggle between "on" and '+
			'"off".\n'+
			'If either "on" or "off" are given then this will switch '+
			'to that mode.\n'+
			'If "?" is given, this will return either "on" or "off" '+
			'depending on the current state.'
	}else{
		func.doc = 'With no arguments this will toggle between '+
			states +' in cycle.\n' + 
			'if any of the state names or its number is given then that '+
			'state is switched on.'+
			'If "?" is given, this will return the current state.'
	}

	func.__proto__ = Toggler.prototype
	func.constructor = Toggler

	return func
}
Toggler.prototype.__proto__ = Function.prototype


// XXX this should be drop-in compatible with createCSSClassToggler(..)
// 		test and replace...
function CSSClassToggler(elem, classes, callback_a, callback_b){
	// normalize the states...
	classes = typeof(classes) == typeof('str') ? ['none', classes] : classes
	// remove the dot from class names...
	// NOTE: this is here because I've made the error of including a 
	// 		leading "." almost every time I use this after I forget 
	// 		the UI...
	classes = classes
		.map(function(e){
			return e.split(' ')
				.map(function(c){
					c = c.trim()
					return c[0] == '.' ? c.slice(1) : c
				}).join(' ')
		})
	
	var toggler = Toggler(
		elem,
		function(state){
			'use strict'
			var e = $(this == null ? elem : this)
			// get the state...
			if(state == null){
				var cur = 'none'
				for(var i=0; i < classes.length; i++){
					// XXX make this faster by getting the class list once 
					// 		and checking in that rather than doing a 
					// 		.hasClass(..) per iteration...
					if(e.hasClass(classes[i])){
						cur = classes[i]
						break
					}
				} 
				return cur

			// set the state...
			} else {
				e.removeClass(classes.join(' '))
				if(state != 'none' && state != 'off'){
					e.addClass(state)
				}
			}
		}, 
		classes, 
		callback_a, 
		callback_b)

	toggler.__proto__ = CSSClassToggler.prototype
	toggler.constructor = CSSClassToggler

	return toggler
}

CSSClassToggler.prototype.__proto__ = Toggler.prototype



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
