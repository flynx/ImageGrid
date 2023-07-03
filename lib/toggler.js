/**********************************************************************
*
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/



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
// 	- 'next'		: switch to next state (default)
// 	- 'prev'		: switch to previous state
// 	- '!'			: reload current state, same as toggler(toggler('?'))
// 	- '?'			: return current state ('on'|'off')
// 	- '??'			: return a list of supported states
//
// In forms 2 and 3, if class_list is a list of strings, the <action> can be:
//  - <index>		: explicitly set the state to index in class_list
//  - <class-name>	: explicitly set a class from the list
// 	- 'next'		: switch to next state (default)
// 	- 'prev'		: switch to previous state
// 	- '!'			: reload current state, same as toggler(toggler('?'))
// 	- '?'			: return current state ('on'|'off')
// 	- '??'			: return a list of supported states
//
//
// In the third form the <target> is a jquery-compatible object.
//
// In all forms this will return the current state string or null if the
// action argument given is invalid.
//
// NOTE: action '?' is handled internally and not passed to the callbacks.
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
// 	Toggler(elem, stateGettor, states, post_callback)
// 	Toggler(elem, stateGettor, states, pre_callback, post_callback)
// 		-> toggler
//
// state_accessor signature:
//
// 	Get current state:
// 	state_accessor(<elem>)
// 		-> <current-state>
//
// 	Set new state:
// 	state_accessor(<elem>, <new-state>)
// 		-> <new-state>
//
// state_accessor is calles in the toggler's context.
// 
// The value returned by state_accessor is returned by the toggler. To pass
// control over the return value back to the Toggler logic when setting 
// the state (i.e. when <new_state> is passed) state_accessor has to 
// return null.
// 
// NOTE: for single state toggling, 'none' will get passed to 
// 		state_accessor to indicate an "empty" state...
// NOTE: if elem is a function it will be called in the same context as
// 		the toggler and is expected to return the element.
//
//
// states can be:
// 	<state>				- state string, equivalent to ['none', <state>]
// 							this will produce a bool toggler that will toggle
// 							a single state on and off.
// 	[<state>, ...]		- list of string states that will be toggled 
// 							through, one special state 'none' is supported
// 	function(){ ... }	- function that will return either a state or 
// 							a list of states, `this' will be set to
// 							the toggler's context...
//
//
// Examples:
// 	XXX
//
//
// XXX technically we do not need both elem and state_accessor here, the
// 		later is enough, but as strict mode is not stable enough (sometimes
// 		works and sometimes does not), we can not reliably pass the element
// 		via 'this'.
// XXX add .toString(..) to resulting function to print the source of all
// 		the handlers...
var Toggler =
module.Toggler =
function(elem, state_accessor, states, callback_a, callback_b){
	// normalize states...
	var states_getter = states
	var state_set = typeof(states) == typeof('str') ? ['none', states] : states
	// normalize the callbacks...
	if(callback_b === undefined){
		var callback_pre = null
		var callback_post = callback_a
	} else {
		var callback_pre = callback_a
		var callback_post = callback_b
	}

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

		// see if we got an explicit state list or need to use a getter...
		var states = state_set
		if(states_getter instanceof Function){
			// get the states...
			var states = states_getter.call(this)
			states = typeof(states) == typeof('str') ? 
				['none', states] 
				: states
		}
		var bool_action = (state_set.length == 2 && state_set[0] == 'none')

		// XXX is this correct???
		var args = [].slice.call(arguments).slice(2)

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

		// get the state list...
		if(action == '??'){
			return states

		// we need to get the current state...
		} else if(action == null 
				|| action == 'prev' 
				|| action == '?' 
				|| action == '!'){
			// get current state...
			var cur = state_accessor.call(this, e)

			// just asking for info...
			if(action == '?'){
				return bool_action ? (cur == 'none' ? 'off' : 'on') : cur
				/*
				// NOTE: if cur is not in states then return it as-is...
				return bool_action ? (
						cur == 'none' ? 'off' 
						: cur == states[1-states.indexOf('none')] ? 'on'
						: cur) 
					: cur
				*/
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
		if(action == null || action == 'prev'){
			if(action == 'prev'){
				var i = states.indexOf(cur)-1
				i = i <= -1 ? states.length-1 : i

			} else {
				var i = states.indexOf(cur)+1
				//i = i == -1 ? 0 : i
				i = i == states.length ? 0 : i
			}


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
				// return current state...
				return func.call(this, '?')
			}
		}

		// update the element...
		var res = state_accessor.call(this, e, state)

		// post callback...
		if(callback_post != null){
			var r = callback_post.apply(this, [action, e].concat(args))
			action = r !== undefined ? r : action
		}

		return res || action
	}

	// XXX these are broken -- this is wrong...
	// 		...do not see how to fix this now in a good way...
	if(states_getter instanceof Function){
		Object.defineProperty(func, 'states', {
			get: function(){ return states_getter.apply(this) },
		})
		Object.defineProperty(func, 'doc', {
			get: function(){
				if(func.__doc != null){
					return func.__doc
				}
				var states = states_getter instanceof Function ?
					states_getter.apply(this)
					: state_set

				// bool_action...
				if(states.length == 2 && states[0] == 'none'){
					return 'With no arguments this will toggle between "on" and '
						+'"off".\n'
						+'If either "on" or "off" are given then this will switch '
						+'to that mode.\n'
						+'If "?" is given, this will return either "on" or "off" '
						+'depending on the current state.'

				} else {
					return 'With no arguments this will toggle between '
						+ states +' in cycle.\n'  
						+'if any of the state names or its number is given then that '
						+'state is switched on.'
						+'If "?" is given, this will return the current state.'
				}
			},
			set: function(value){
				func.__doc = value
			},
		})

	} else {
		func.states = state_set
		if(state_set.length == 2 && state_set[0] == 'none'){
			func.doc = 'With no arguments this will toggle between "on" and '
				+'"off".\n'
				+'If either "on" or "off" are given then this will switch '
				+'to that mode.\n'
				+'If "?" is given, this will return either "on" or "off" '
				+'depending on the current state.'

		} else {
			func.doc = 'With no arguments this will toggle between '
				+ state_set +' in cycle.\n'  
				+'if any of the state names or its number is given then that '
				+'state is switched on.'
				+'If "?" is given, this will return the current state.'
		}
	}


	func.__proto__ = Toggler.prototype
	func.constructor = Toggler

	// NOTE: this is not a real (inheritable) methods by design...
	// 		...if this is a generic method we'll need to expose the data
	// 		to the user which in turn make it necessary to make the data 
	// 		live, so adding a custom per-toggler method seems a better 
	// 		idea than overcomplicating lots of code...
	// XXX need to align the functions correctly (core.doc???)
	func.toString = function(){
		return 'Toggler(\n\t' 
			+([
				elem instanceof Function ?
					'// elem getter...'
					: '// elem...',
				elem,
				'// state accessor...',
				state_accessor,
				states_getter instanceof Function ?
					'// states getter...'
					: '// states...',
				states_getter instanceof Function ? states_getter : state_set,
				'// pre-callback...',
				callback_pre || null,
				'// post-callback...',
				callback_post || null,
			]
				.map(function(e){
					// function...
					return e instanceof Function ? (e + ',')
						// comment...
						: typeof(e) == typeof('str') && e.trim().startsWith('//') ? e
						// other...
						: (JSON.stringify(e) + ',')
				})
				.join('\n    '))
				.slice(0, -1)
			+')'
	}

	return func
}
Toggler.prototype.__proto__ = Function.prototype


// XXX this should be drop-in compatible with createCSSClassToggler(..)
// 		test and replace...
var CSSClassToggler =
module.CSSClassToggler =
function CSSClassToggler(elem, classes, callback_a, callback_b){
	var classes_getter = classes
	var classes_set = classes

	var getClasses = function(){
		var classes = typeof(classes_getter) == typeof(function(){}) ? 
				classes_getter.call(this)
				: classes_set
		classes = typeof(classes) == typeof('str') ? ['none', classes] : classes

		// remove the dot from class names...
		// NOTE: this is here because I've made the error of including a 
		// 		leading "." almost every time I use this after I forget 
		// 		the UI...
		// 		...and after I've added this fix I've never repeated the 
		// 		error ;)
		return classes
			.map(function(e){
				return e.split(' ')
					.map(function(c){
						c = c.trim()
						return c[0] == '.' ? c.slice(1) : c
					}).join(' ')
			})
	}

	// normalize...
	// NOTE: this happens here once if we got explicit classes, and on
	// 		each access if we get a getter function...
	classes_set = typeof(classes_getter) != typeof(function(){}) ?
		getClasses.call(this)
		: classes_set
	
	var toggler = Toggler(
		elem,
		function(e, state){
			'use strict'

			var classes = classes_set.constructor === Array ?
				classes_set
				: getClasses.call(this)

			e = $(e == null ? elem : e)
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
		classes_getter instanceof Function ? getClasses : classes_set,
		callback_a, 
		callback_b)

	toggler.__proto__ = CSSClassToggler.prototype
	toggler.constructor = CSSClassToggler

	// NOTE: for general see Toggler.toString(..)
	// XXX this is very similar to Toggler.toString(..)
	toggler.toString = function(){
		// XXX can we avoid this???
		if(callback_b === undefined){
			var callback_pre = null
			var callback_post = callback_a
		} else {
			var callback_pre = callback_a
			var callback_post = callback_b
		}

		return 'CSSClassToggler(\n\t' 
			+([
				elem instanceof Function ?
					'// elem getter...'
					: '// elem...',
				elem,
				classes_getter instanceof Function ? 
					'// classes getter...' 
					: '// classes...',
				classes_getter instanceof Function ? classes_getter : classes_set,
				'// pre-callback...',
				callback_pre || null,
				'// post-callback...',
				callback_post || null,
			]
				.map(function(e){
					// function...
					return e instanceof Function ? (e + ',')
						// comment...
						: typeof(e) == typeof('str') && e.trim().startsWith('//') ? e
						// other...
						: (JSON.stringify(e) + ',')
				})
				.join('\n    '))
				.slice(0, -1)
			+')'
	}


	return toggler
}

CSSClassToggler.prototype.__proto__ = Toggler.prototype



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
