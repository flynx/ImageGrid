/**********************************************************************
* 
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true

define(function(require){ var module = {}


/*********************************************************************/
// Actions
//
// Actions are an extension to the JavaScript object model tailored for
// a set of specific tasks.
//
// Goals:
// 	- provide a unified mechanism to define and manage user API's for 
// 	  use in UI-hooks, keyboard mappings, scripting, ...
// 	- a means to generate configuration UI's
// 	- a means to generate documentation
//
//
// The main entities:
//
// 	Action set
// 		- an object containing a number of actions,
// 		- optionally, directly or indirectly inherited from MetaActions
// 		  and/or other action sets,
// 		- the action handlers are bound relative to it (._action_handlers)
//
// 	Action
// 		- a method, created by Action(..),
// 		- calls all the shadowed actions in the inheritance chain in 
// 		  sequence implicitly,
// 		  NOTE: there is no way to prevent an action in the chain from
// 		  		running, this is by design, i.e. no way to full shadow.
// 		- returns the action set (for call chaining),
// 		- can consist of two parts: the first is called before the 
// 		  shadowed action (pre-callback) and the second after (post-callback).
// 		- can be bound to, a-la an event, calling the handlers when it is 
// 		  called, 
//
// 	Action (event) handler
//  	- a function,
// 		- can be bound to run before and/or after the action itself,
// 		- is local to an action set it was bound via,
// 		- when an action is triggered from an action set, all the pre 
// 		  handlers in its inheritance chain will be called before the 
// 		  respective actions they are bound to and all the post handlers
// 		  are called directly after.
//
//
//
// The action system provides three components:
//
// 1) Documentation generation and introspection (MetaActions)
//
// 		<action-set>.getDoc()
// 		<action-set>.getDoc(<action-name>[, ..])
// 				-> dict of action-name, doc
//
// 		<action-set>.actions
// 				-> list of action names
// 	
//
// 2) Event-like callbacks for actions (MetaActions, Action)
//
// 		<action-set>.on('action', function(){ ... })
// 		<action-set>.on('action.post', function(){ ... })
//
// 		<action-set>.on('action.pre', function(){ ... })
//
//
// 3) A mechanism to define and extend already defined actions
// 	This replaces / complements the standard JavaScript overloading 
// 	mechanisms (Action, Actions)
//
// 		// Actions...
// 		var X = Actions({
// 			m: [function(){ console.log('m') }]
// 		})
// 		var O = Actions(X, {
// 			m: [function(){
// 				console.log('pre')
// 				return function(){
// 					console.log('post')
// 				}
// 			}]
// 		})
//
//	NOTE: what is done here is similar to calling O.__proto__.m.call(..)
//		but is implicit, and not dependant on the original containing 
//		object name/reference ('O'), thus enabling an action to be 
//		referenced and called from any object and still chain correctly.
//
//
//
/*********************************************************************/
// helpers...

// XXX
function args2array(args){
	return Array.apply(null, args)
}



/*********************************************************************/

// Construct an action object...
//
// Action function format:
//
// 		// pre event code...
// 		function(){
//			... // pre code
// 		}
//
// 		// pre/post event code...
// 		function(){
//			... // pre code
//			return function(){
//				... // post code
//			}
// 		}
//
// 		// same as above but using a deferred instead of a callback...
// 		function(){
//			... // pre code
//			return $.Deferred()
//				.done(function(){
//					... // post code
//				})
// 		}
//
//
// An action is essentially a method with several additional features:
//
// 	- actions are split into two stages:
// 		pre: 	the code of the method is executed before the action 
// 				event is fired
// 		post:	if the action returns a callback function or a deferred
// 				object it will be executed after the event is fired
//
// 	- actions automatically call the shadowed action, the pre stage is
// 	  executed down-up while the post stage is run in reverse order, 
// 	  i.e. the pre is going down and the post is going up.
//
// 	- actions provide an event-like mechanism to register handlers or 
// 	  callbacks. These callbacks are local to a specific object and will
// 	  be fired on action event/call starting from the current action 
// 	  caller and down the inheritance chain, i.e. all event handlers 
// 	  registered from the current object and up to the base action set
// 	  will be fired.
//
// NOTE: actions once defined do not depend on the inheritance hierarchy, 
// 		other than the .getHandlers(..) method. If this method is not 
// 		found in the inheritance chain (i.e. the link to MetaActions)
// 		was severed, then the default will be used: 
// 			MetaActions.getHandlers(..)
// 		This makes it possible to redefine the method if needed but 
// 		prevents the system from breaking when an action set gets 
// 		disconnected from MetaActions. This can be useful, for example,
// 		to remove .on(..) / .off(..) handler functionality.
// 		XXX is this correct??
// NOTE: by default an action will return 'this', i.e. the action set
// 		object the action was called from.
//
// XXX do we need to return something from an action ever?
var Action =
module.Action =
function Action(name, doc, ldoc, func){
	// we got called without a 'new'...
	if(this == null || this.constructor !== Action){
		// XXX using something like .apply(.., arguemnts) would be more
		// 		generel but have no time to figure out how to pass it 
		// 		to new without the later complaining...
		return new Action(name, doc, ldoc, func)
	}

	// prevent action overloading...
	if(this[name] != null){
		throw 'action "'+name+'" already exists.'
	}

	// create the actual instance we will be returning...
	var meth = function(){
		var that = this
		var args = args2array(arguments)

		var getHandlers = this.getHandlers
		getHandlers = getHandlers == null ? MetaActions.getHandlers : getHandlers

		// get and call handlers -- pre phase...
		//
		// NOTE: using CLASS.__proto__[name].call(this, ...) here is not
		// 		possible as there is no reliable way to get the "class" 
		// 		the current method is referenced from.
		// 		...searching the inheritance chain is not reliable as a
		// 		method can be referenced more than once, both with the 
		// 		same as well as under different names...
		var handlers = getHandlers.call(this, name)
			.map(function(h){ return h.apply(that, args) })

		// NOTE: this action will get included and called by the code 
		// 		above and below...

		// call handlers -- post phase...
		// NOTE: post handlers need to get called last run pre first run post...
		handlers.reverse().forEach(function(h){ 
			// function...
			if(h instanceof Function){
				//h.call(that, res)
				h.call(that)

			// deferred...
			} else if(h != null && h.resolve instanceof Function){
				//h.resolve(res)
				h.resolve()
			} 
		})

		//return res
		return this
	}
	meth.__proto__ = this.__proto__

	// populate the action attributes...
	meth.name = name
	meth.doc = doc
	meth.long_doc = ldoc

	meth.func = func

	return meth
}


// A base action-set object...
//
// This will define a set of action-set specific methods and helpers.
//
// XXX .off(...) needs more work...
var MetaActions =
module.MetaActions = {
	// List actions...
	//
	get actions(){
		var res = []
		for(var k in this){
			// avoid recursion...
			if(k == 'actions' || k == 'length'){
				continue
			}
			// get only actions...
			if(this[k] instanceof Action){
				res.push(k)
			}
		}
		return res
	},

	// Number of defined actions...
	//
	get length(){
		return this.actions.length
	},

	// Get action documentation...
	//
	getDoc: function(actions){
		var res = {}
		var that = this
		actions = actions == null ? this.actions
			: arguments.length > 1 ? args2array(arguments)
			: typeof(actions) == typeof('str') ? [actions]
			: actions
		// get the first defined set of docs in the inheritance chain...
		actions.forEach(function(n){
			var cur = that
			res[n] = []
			while(cur.__proto__ != null){
				if(cur[n] != null && cur[n].doc != null){
					res[n] = [ cur[n].doc, cur[n].long_doc ]
					break
				}
				cur = cur.__proto__
			}
		})
		return res
	},

	// Get action handlers from the inheritance chain...
	//
	// NOTE: this collects both the event handlers (in order of hierarchy,
	// 		then order of definition) and actions (in order of hierarchy)
	// NOTE: this is the correct order for 'pre' calling, but is the 
	// 		reverse of how the 'post' handlers must be called.
	//
	// For more docs on handler sequencing and definition see: .on(..)
	getHandlers: function(name){
		var handlers = []
		var cur = this
		while(cur.__proto__ != null){
			// get action "event" handlers...
			if(cur.hasOwnProperty('_action_handlers') 
					&& name in cur._action_handlers){
				handlers.splice.apply(handlers,
						[handlers.length, 0].concat(cur._action_handlers[name]))
			}

			// get the overloading action...
			// NOTE: this will get all the handlers including the root 
			// 		and the current handlers...
			// NOTE: this will ignore "shadows" that are not actions...
			if(cur.hasOwnProperty(name) && cur[name] instanceof Action){
				handlers.push(cur[name].func)
			}

			cur = cur.__proto__
		}
		return handlers
	},


	// Register an action callback...
	//
	//	Register a post action callback
	// 	.on('action', <function>)
	// 	.on('action.post', <function>)
	// 		-> <action-set>
	//
	// 	Register a pre action callback
	// 	.on('action.pre', <function>)
	// 		-> <action-set>
	//
	// Modes:
	// 	'pre'		- the handler is fired before the action is triggered,
	// 					and if the handler returns a deferred or a function
	// 					then that will get resolved, called resp. after
	// 					the action is done.
	// 	'post'		- the handler is fired after the action is finished.
	// 					this is the default.
	//
	// NOTE: 'post' mode is the default.
	on: function(action, handler){
		// prepare the handler...
		var mode = action.split('.')
		action = mode[0]
		mode = mode[1]

		// a post handler (default)...
		if(mode == null || mode == 'post'){
			var old_handler = handler
			handler = function(){ return old_handler }
			// NOTE: this is set so as to identify the handler for removal
			// 		via. .off(..)
			handler.orig_handler = old_handler

		// mot pre mode...
		} else if(mode != 'pre') {
			throw 'Unknown action mode: '+action+'.'+mode
		}

		// register handlers locally only...
		if(!this.hasOwnProperty('_action_handlers')){
			this._action_handlers = {}
		}
		if(!(action in this._action_handlers)){
			this._action_handlers[action] = []
		}
		// register a handler only once...
		if(this._action_handlers[action].indexOf(handler) < 0){
			// NOTE: last registered is first...
			this._action_handlers[action].splice(0, 0, handler)
		}
		return this
	},

	// Remove an action callback...
	//
	// XXX this will not work for explicit <action>.post...
	off: function(action, handler){
		if(this.hasOwnProperty('_action_handlers')){
			var mode = action.split('.')
			action = mode[0]
			mode = mode[1]

			// get the handlers...
			var h = this._action_handlers[action]

			var i = -1
			if(mode == null || mode == 'post'){
				// XXX find via e.orig_handler == handler && e.mode == 'post'
				h.forEach(function(e, j){
					// NOTE: we will only get the first match...
					if(e.orig_handler == handler && i == -1){
						i = j
					}
				})

			} else if(mode == 'pre'){
				i = h.indexOf(handler)
			}

			// NOTE: unknown modes are skipped...
			if(i >= 0){
				h.splice(i, 1)
			}
		}
		return this
	},
}



// An action set...
//
//	Actions(<object>)
//	Actions(<prototype>, <object>)
//		-> actions
//
// This will pre-process an object to setup the action mechanics.
//
//
// The action format:
// 	{
// 		// full format...
// 		<name> : [
// 			<doc>,
// 			<long-doc>,
// 			<function>
// 		],
//
// 		// short doc only...
// 		<name> : [
// 			<doc>,
// 			<function>
// 		],
//
// 		// only the code...
// 		<name> : [
// 			<function>
// 		],
// 		...
// 	}
//
//
// NOTE: if <prototype> is not given, MetaActions will be used as default.
//
// For more documentation see: Action(..).
var Actions =
module.Actions =
function Actions(a, b){
	var obj = b == null ? a : b
	var proto = b == null ? MetaActions : a

	// NOTE: this is intentionally done only for own attributes...
	Object.keys(obj).forEach(function(k){
		var args = obj[k]

		// skip non-arrays...
		if(args.constructor !== Array 
				// and arrays the last element of which is not a function...
				|| !(args[args.length-1] instanceof Function)){
			return
		}

		var func = args.pop()

		// create a new action...
		obj[k] = new Action(k, args[0], args[1], func)
	})

	if(proto != null){
		obj.__proto__ = proto
	}

	return obj
}



/*********************************************************************/

var test =
module.test =
function test(){
	var TestActions = 
	module.TestActions = 
	Actions({
		testActionGen1: ['baisc test action...',
			'some extra info',
			function(){
				console.log('  test 1!')
				return function(){
					console.log('  test 2!')
				}
			}],

		testActionGen2: ['baisc 2\'nd gen test action...',
			// no extra info...
			function(){
				console.log('  test gen 2!')
				this.testActionGen1()
			}],
	})

	var TestActions2 = 
	module.TestActions2 = 
	Actions(TestActions, {
		// NOTE: this looks like an action and feels like an action but 
		// 		actually this is a callback as an action with this name 
		// 		already exists...
		testActionGen1: [function(){
			console.log('  pre callback!')
			return function(){
				console.log('  post callback!')
			}
		}],

	})

	// XXX the main question here is that there is no way to know if a 
	// 		particular action is going to be a root action or an action
	// 		callback because we do not know if the action in the parent 
	// 		will be available at mix time or not, and the two models 
	// 		are different...
	// 		XXX one way to do this is to make all code a callback and 
	// 			just use the root as an event trigger...
	//
	// 			...but this effectively means we are implementing 
	// 			inheritance ourselves as the traditional name resolution
	// 			will no longer be used, and as in the case we implement
	// 			MRO why not go the whole way and implement multiple 
	// 			inheritance in the first place...
	//
	// 			...let's try and avoid this...
	/*
	var TestActionMixin =
	module.TestActionMixin = 
	ActionMixin({
		// XXX
	})
	*/


	console.log('TestActions.testActionGen1()')
	TestActions.testActionGen1()
	console.log('TestActions.testActionGen2()')
	TestActions.testActionGen2()

		
	// both of these should cet a callback...
	console.log('TestActions2.testActionGen1()')
	TestActions2.testActionGen1()
	console.log('TestActions2.testActionGen2()')
	TestActions2.testActionGen2()

	// and an event-like handler...
	TestActions2.on('testActionGen1.post', 
			function(){ console.log('  post handler! (first defined)') })
	TestActions2.on('testActionGen1', 
			function(){ console.log('  post handler! (last defined)') })

	console.log('TestActions2.testActionGen1()')
	TestActions2.testActionGen1()

	TestActions2.on('testActionGen2.pre', 
			function(){ console.log('  pre handler! (first defined)') })
	TestActions2.on('testActionGen2.pre', 
			function(){ console.log('  pre handler! (last defined)') })

	console.log('TestActions2.testActionGen2()')
	TestActions2.testActionGen2()
}



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
