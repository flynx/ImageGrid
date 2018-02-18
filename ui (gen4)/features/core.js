/**********************************************************************
* 
* Core features...
* 	Setup the life-cycle and the base interfaces for features to use...
*
* Defined here:
* 	- protocol action constructor
* 	- config value toggler constructor
* 	- meta actions
* 		- .isToggler(..) predicate
* 		- .preActionHandler(..) used to toggler special args
* 	- ImageGrid root object/constructor
* 	- ImageGridFeatures object
*
*
* Features:
* 	- introspection
* 	- lifecycle
* 		base life-cycle events (start/stop/..)
*	- serialization
*		base methods to handle loading, serialization and cloning...
*	- cache
*		basic action/prop caching api...
*	- timers
*		wrapper around setInterval(..), setTimeout(..) and friends, 
*		provides persistent timer triggers and introspection...
* 	- util
* 	- journal
* 		action journaling and undo/redo functionality
* 		XXX needs revision...
* 	- changes
* 		change tracking
* 	- workspace
* 		XXX needs revision...
* 	- tasks
* 		XXX not yet used
* 	- self-test
* 		basic framework for running test actions at startup...
*
*
* XXX some actions use the .clone(..) action/protocol, should this be 
* 	defined here???
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

// XXX
var DEBUG = typeof(DEBUG) != 'undefined' ? DEBUG : true

var util = require('lib/util')
var object = require('lib/object')
var actions = require('lib/actions')
var features = require('lib/features')
var toggler = require('lib/toggler')



/*********************************************************************/

// NOTE: if no toggler state is set this assumes that the first state 
// 		is the default...
// NOTE: default states is [false, true]
var makeConfigToggler = 
module.makeConfigToggler = 
function(attr, states, a, b){

	states = states || [false, true]
	var pre = a
	// XXX is this a good default???
	//var post = b || function(action){ action != null && this.focusImage() }
	var post = b

	return toggler.Toggler(null,
		function(_, action){
			var lst = states instanceof Array ? states 
				: states instanceof Function ? states.call(this)
				: states

			if(action == null){
				var cfg = this.config[attr]
				return cfg == null ? 
					(lst[lst.indexOf('none')] || lst[0])
					: cfg 

			} else {
				this.config[attr] = action
			}
		},
		states, pre, post)
}



/*********************************************************************/

// Root ImageGrid.viewer object constructor...
//
// This adds:
// 	- toggler as action compatibility
//
var ImageGridMetaActions =
module.ImageGridMetaActions = {
	// Test if the action is a Toggler...
	//
	isToggler: actions.doWithRootAction(function(action){
		return action instanceof toggler.Toggler }),

	// Handle special cases where we need to get the action result early,
	// without calling handlers...
	//
	// These include:
	// 	- toggler action special command handling (like: '?', '??', ..)
	//
	preActionHandler: actions.doWithRootAction(function(action, name, handlers, args){
		// Special case: do not call handlers for toggler state queries...
		//
		// NOTE: if the root handler is instance of Toggler (jli) and 
		// 		the action is called with '?'/'??' as argument, then the
		// 		toggler will be called with the argument and return the
		// 		result bypassing the handlers.
		// NOTE: an action is considered a toggler only if it's base action
		// 		is a toggler (instance of Toggler), thus, the same "top"
		// 		action can be or not be a toggler in different contexts.
		//
		// For more info on togglers see: lib/toggler.js
		if(this.isToggler(name)
				&& args.length == 1 
				&& (args[0] == '?' || args[0] == '??')){
			return {
				result: handlers.slice(-1)[0].pre.apply(this, args),
			}
		}
	}),
} 
ImageGridMetaActions.__proto__ = actions.MetaActions

var ImageGrid = 
module.ImageGrid = 
	object.makeConstructor('ImageGrid', ImageGridMetaActions)

// Root ImageGrid feature set....
var ImageGridFeatures =
module.ImageGridFeatures = new features.FeatureSet()

// setup base instance constructor...
ImageGridFeatures.__actions__ = 
	function(){ return actions.Actions(ImageGrid()) }



//---------------------------------------------------------------------
// Setup runtime info...
// XXX add chrome-app...
// XXX add cordova...
// XXX add mobile...
// XXX add widget...

// XXX should this contain feature versions???
var runtime = ImageGridFeatures.runtime = {}

// nw or node...
if(typeof(process) != 'undefined'){
	// node...
	runtime.node = true

	// Electron...
	if(process.versions['electron'] != null){
		runtime.electron = true
		runtime.desktop = true

	// nw.js 0.13+
	} else if(typeof(nw) != 'undefined'){
		runtime.nw = true
		runtime.desktop = true

		// NOTE: jli is patching the Date object and with two separate 
		// 		instances we'll need to sync things up...
		// XXX HACK: if node and chrome Date implementations ever 
		// 		significantly diverge this will break things + this is 
		// 		a potential data leak between contexts...
		//global.Date = window.Date

		// XXX this is less of a hack but it is still an implicit
		util.patchDate(global.Date)
		util.patchDate(window.Date)

	// node...
	} else {
		// XXX patch Date...
		// XXX this will not work directly as we will need to explicitly
		// 		require jli...
		//patchDate(global.Date)
	}
}

// browser...
// NOTE: we're avoiding detecting browser specifics for as long as possible,
// 		this will minimize the headaches of supporting several non-standard
// 		versions of code...
if(typeof(window) != 'undefined'){
	runtime.browser = true
}



/*********************************************************************/
// Introspection...

// Normalize doc strings...
// 
// This will remove indent padding from all lines in a doc string.
// 
// This is useful for documenting actions using ES6 template/multi-line
// strings and keep them sane in terms of indent...
// 
// 	Example:
// 		someAction: ['Test/Some action title',
// 			core.doc`This is an example...
// 			mult-iline...
// 			...doc string that will be normalized and look the same but`
// 			without the indent...`,
// 			function(){ ... }]
// 			
// NOTE: this will ignore the first line's indent so it can be started 
// 		right at the string start.
// 		
// XXX might be a good idea to move this to a more generic spot like lib/util.js...
var doc = 
module.doc =
function(strings, ...values){
	var lines = strings
		.map(function(s, i){ return s + (values[i] || '') })
		.join('')
		.split(/\n/g)

	// get the common whitespae offset...
	var l = -1
	lines.forEach(function(line, i){ 
		if(line.trim().length == 0){
			return
		}

		// get the indent...
		var a = line.length - line.trimLeft().length

		// if line 0 is not indented, ignore it...
		if(i == 0 && a == 0){
			return
		}

		l = l < 0 ? a : Math.min(l, a)
	})

	return lines
		.map(function(line, i){ return i == 0 ? line : line.slice(l) })
		.join('\n')
}


// Indicate that an action is not intended for direct use...
//
// NOTE: this will not do anything but mark the action.
var notUserCallable =
module.notUserCallable = 
function(func){
	func.__not_user_callable__ = true
	return func
}

// NOTE: this is the same as event but user-callable...
var UserEvent =
module.UserEvent = 
function(func){
	func.__event__ = true
	return func
}

// XXX rename???
var Event =
module.Event = 
function(func){
	func.__event__ = true
	return notUserCallable(func)
}


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

var IntrospectionActions = actions.Actions({
	get useractions(){
		return this.cache('useractions', function(d){
			return d instanceof Array ? 
				d.slice() 
				: this.actions.filter(this.isUserCallable.bind(this)) }) },
	get events(){
		return this.cache('events', function(d){
			return d instanceof Array ? 
				d.slice() 
				: this.actions.filter(this.isEvent.bind(this)) }) },

	isUserCallable: ['- System/',
		doc`Test if an action is callable by user.

			.isUserCallable(<action-name>)
		`,
		// XXX should this check only the root action or the whole set???
		// 		...in other words: can we make an action non-user-callable
		// 		anywhere other than the root action?
		// 		IMO no...
		//function(action){ 
		//	return this.getActionAttr(action, '__not_user_callable__') != true }],
		actions.doWithRootAction(function(action){
			return action.__not_user_callable__ != true })],
	isEvent: ['- System/',
		actions.doWithRootAction(function(action){
			return !!action.__event__ })],
})


var Introspection = 
module.Introspection = ImageGridFeatures.Feature({
	title: '',

	tag: 'introspection',
	depends: [
		'cache'
	],

	actions: IntrospectionActions,
})



//---------------------------------------------------------------------
// System life-cycle...

// XXX should his have state???
// 		...if so, should this be a toggler???
var LifeCycleActions = actions.Actions({
	start: ['- System/', 
		doc`Start core action/event

			.start()

		This action triggers system start, sets up basic runtime, prepares
		for shutdown (stop) and handles the .ready() event.

		Attributes set here:
			.runtime		- indicates the runtime ImageGrid is running.
								this currently supports:
									node, browser, nw, unknown

		This will trigger .declareReady() if no action called 
		.requestReadyAnnounce()

		NOTE: .runtime attribute will not be available on the .pre handler
			phase.
		NOTE: .requestReadyAnnounce() should be called exclusively on the
			.pre handler phase as this will check and trigger the .ready()
			event before the .post phase starts.
		`,
		function(){
			var that = this
			this.logger && this.logger.emit('start')

			// NOTE: jQuery currently provides no way to check if an event
			// 		is bound so we'll need to keep track manually...
			if(this.__stop_handler == null){
				var stop = this.__stop_handler = function(){ that.stop() }

			} else {
				return
			}

			// set the runtime...
			var runtime = this.runtime = ImageGridFeatures.runtime

			// nw.js...
			if(runtime.nw){
				// this handles both reload and close...
				$(window).on('beforeunload', stop)

				// NOTE: we are using both events as some of them do not
				// 		get triggered in specific conditions and some do,
				// 		for example, this gets triggered when the window's
				// 		'X' is clicked while does not on reload...
				this.__nw_stop_handler = function(){
					var w = this
					try{
						that
							// wait till ALL the handlers finish before 
							// exiting...
							.on('stop.post', function(){
								// XXX might be broken in nw13 -- test!!!
								//w.close(true)
								nw.App.quit()
							})
							.stop()

					// in case something breaks exit...
					// XXX not sure if this is correct...
					} catch(e){
						console.log('ERROR:', e)

						DEBUG || nw.App.quit()
						//this.close(true)
					}
				}
				nw.Window.get().on('close', this.__nw_stop_handler)


			// electron...
			} else if(runtime.electron){
				$(window).on('beforeunload', stop)

			// node...
			} else if(runtime.node){
				process.on('exit', stop)

			// browser...
			} else if(runtime.browser){
				$(window).on('beforeunload', stop)

			// other...
			} else {
				// XXX
				console.warn('Unknown runtime:', runtime)
			}

			// handle ready event...
			// ...if no one requested to do it.
			if(this.__ready_announce_requested == null
					|| this.__ready_announce_requested <= 0){
				if(runtime.browser){
					$(function(){ that.declareReady() })

				} else {
					this.declareReady()
				}
			}
		}],

	ready: ['- System/System ready event',
		doc`Ready core event

		The ready event is fired right after start is done.

		Any feature can request to announce 'ready' itself when it is 
		done by calling .requestReadyAnnounce().
		If .requestReadyAnnounce() is called, then the caller is required
		to also call .declareReady().
		.ready() will actually be triggered only after when .declareReady()
		is called the same number of times as .requestReadyAnnounce().

		NOTE: at this point the system does not track the caller 
			"honesty", so it is the caller's responsibility to follow
			the protocol.
		`,
	   	Event(function(){
			// System ready event...
			//
			// Not intended for direct use, use .declareReady() to initiate.
			this.logger && this.logger.emit('ready')
		})],
	// NOTE: this calls .ready() once per session.
	declareReady: ['- System/Declare system ready', 
		doc`Declare ready state

			.declareReady()

		This will call .ready() but only in the following conditions:
			- .requestReadyAnnounce() has not been called.
			- .requestReadyAnnounce() has been called the same number of
				times as .declareReady()

		NOTE: this will call .ready() only once per start/stop cycle.
		`,
		function(){
			this.__ready_announce_requested
				&& (this.__ready_announce_requested -= 1)

			if(!this.__ready_announce_requested 
					|| this.__ready_announce_requested == 0){
				this.__ready = this.__ready || !!this.ready() 
				delete this.__ready_announce_requested
			}
		}],
	requestReadyAnnounce: ['- System/',
		doc`Request to announce the .ready() event.

			.requestReadyAnnounce()

		This enables a feature to delay the .ready() call until it is 
		ready, this is useful for async or long stuff that can block
		or slow down the .ready() phase.

		To indicate readiness, .declareReady() should be used.

		The system will call .ready() automatically when the last 
		subscriber who called .requestReadyAnnounce() calls 
		.declareReady(), i.e. .declareReady() must be called at least
		as many times as .requestReadyAnnounce()

		The actual .ready() should never get called directly.

		NOTE: if this is called, .ready() will not get triggered 
			automatically by the system.
		`,
		function(){
			return this.__ready_announce_requested = (this.__ready_announce_requested || 0) + 1
		}],

	stop: ['- System/', 
		doc`Stop core action

			.stop()

		This will cleanup and unbind stop events.

		The goal of this is to prepare for system shutdown.

		NOTE: it is good practice for the bound handlers to set the 
			system to a state from which their corresponding start/ready
			handlers can run cleanly.
		`,
		function(){
			// browser...
			if(this.__stop_handler && this.runtime.browser){
				$(window).off('beforeunload', this.__stop_handler)
			}

			// nw...
			if(this.__nw_stop_handler && this.runtime.nw){
				nw.Window.get().removeAllListeners('close')
				delete this.__nw_stop_handler
			}

			// node...
			if(this.__stop_handler && this.runtime.node){
				process.removeAllListeners('exit')
			}

			delete this.__ready
			delete this.__stop_handler

			this.logger && this.logger.emit('stop')
		}],
})

var LifeCycle = 
module.LifeCycle = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'lifecycle',
	priority: 'high',

	actions: LifeCycleActions,
})


//---------------------------------------------------------------------
// Serialization...

var SerializationActions = actions.Actions({
	clone: ['- System/',
		function(full){ return actions.MetaActions.clone.call(this, full) }],
	json: ['- System/',
		function(){ return {} }],
	load: ['- System/',
		function(data, merge){ !merge && this.clear() }],
	clear: ['- Sustem/',
		function(){ }],
})

var Serialization = 
module.Serialization = ImageGridFeatures.Feature({
	title: '',

	tag: 'serialization',

	actions: SerializationActions,
})


//---------------------------------------------------------------------
// Cache...
	
// XXX should this be in actions.js???
// XXX should we invalidate the cache automatically???
// XXX the cache can also be saved to localStorage and loaded until either
// 		the version changes or the feature list...
var CacheActions = actions.Actions({
	config: {
		// Enable/disable caching...
		'cache': true,

		// Control pre-caching...
		//
		// This can be:
		// 		true	- sync pre-cache (recursion)
		// 		0		- semi-sync pre-cache
		// 		number	- delay in milliseconds between pre-cache chunks
		// 		false	- pre-caching disabled
		'pre-cache': 0,

		// Cache chunk length in ms...
		//
		// Caching is done in a series of chunks set by this separated by 
		// timeouts set by .config['pre-cache'] to let other stuff run...
		'pre-cache-chunk': 8,

		// Control pre-cache progress display...
		//
		// This can be:
		// 	false		- never show progress
		// 	true		- always show progress
		// 	number		- show progress if number of milliseconds has 
		// 					passed and we are not done yet...
		//
		// NOTE: progress will only be displayed if .showProgress(..) 
		// 		action is available...
		'pre-cache-progress': 3000,
	},

	// Cache utility method...
	//
	// Example use:
	// 	someAction: [
	// 		function(){
	// 			return this.cache('someAction', 
	// 				function(data){
	// 					if(data){
	// 						// clone/update the data...
	// 						// NOTE: this should be faster than the construction
	// 						//		branch below or this will defeat the purpose 
	// 						//		of caching...
	// 						...
	//
	// 					} else {
	// 						// get the data...
	// 						...
	// 					}
	// 					return data
	// 				}) }],
	//
	cache: function(title, lister){
		if(!this.config.cache){
			return lister.call(this)
		}
		var cache = this.__cache = this.__cache || {}
		return (cache[title] = 
			title in cache ? 
				// pass the cached data for cloning/update to the lister...
				lister.call(this, cache[title])
				: lister.call(this))
	},

	preCache: ['System/Run pre-cache',
		doc`Run pre-cache...

			Do an async pre-cache...
			.preCache()

			Do a sync pre-cache...
			.preCache(true)

		NOTE: both "modes" of doing a pre-cache run in the main thread,
			the difference is that the "async" version lets JS run frames
			between processing sync chunks...
		NOTE: this will not drop the existing cache, to do this run 
			.clearCache() first or run .reCache(..).
		`,
		function(t){
			if(this.config.cache){
				var t = t || this.config['pre-cache'] || 0
				var c = this.config['pre-cache-chunk'] || 8
				var done = 0
				var attrs = []
				for(var k in this){
					attrs.push(k)
				}
				var l = attrs.length

				var started = Date.now()
				var show = this.config['pre-cache-progress']

				var tick = function(){
					var a = Date.now()
					var b = a
					if(attrs.length == 0){
						return
					}

					while(b - a < c){
						this[attrs.pop()]
						b = Date.now()
						done += 1

						this.showProgress
							&& (show === true || (show && b - started > show))
							&& this.showProgress('Caching', done, l)
					}

					t === true ?
						tick()
						: setTimeout(tick, t)
				}.bind(this)

				tick()
			}
		}],
	clearCache: ['System/Clear cache',
		function(title){
			if(title){
				delete (this.__cache|| {})[title]

			} else {
				delete this.__cache
			}
		}],

	// XXX do we need this...
	reCache: ['System/Re-cache',
		function(t){
			this
				.clearCache()
				.preCache(t) }],
})

var Cache = 
module.Cache = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'cache',
	// NOTE: we use .showProgress(..) of 'ui-progress' but we do not 
	// 		need it to work, thus we do not declare it as a dependency...
	//depends: [],

	actions: CacheActions,

	handlers: [
		['start.pre', 
			function(){ 
				var t = this.config['pre-cache']
				t === true ?
					this.preCache('now') 
				: t >= 0 ?
					this.preCache() 
				: false
			}],
	],
})


//---------------------------------------------------------------------
// Timers...

var TimersActions = actions.Actions({
	config: {
		//
		// Format:
		// 	{
		// 		<id>: {
		// 			// action code (string)...
		// 			action: <action>,
		// 			// interval in milliseconds...
		// 			ms: <ms>,
		// 		},
		// 		...
		// 	}
		'persistent-intervals': null,
	},

	// XXX should we store more metadata (ms?) and provide introspection 
	// 		for these???
	__timeouts: null,
	__intervals: null,
	__persistent_intervals: null,


	// Introspection...
	//
	// NOTE: these are not editable...
	get timeouts(){
		return Object.assign({}, this.__timeouts || {}) },
	get intervals(){
		return {
			volatile: Object.assign({}, this.__intervals || {}),
			persistent: JSON.parse(JSON.stringify(
				this.config['persistent-intervals'] || {})),
		} },

	// XXX should these be  actions???
	isTimeout: function(id){
		return id in (this.__timeouts || {}) },
	isInterval: function(id){
		return id in (this.__intervals || {}) },
	isPersistentInterval: function(id){
		return id in (this.config['persistent-intervals'] || {}) },
	isPersistentIntervalActive: function(id){
		return this.isPersistentInterval(id) 
			&& (id in (this.__persistent_intervals || {})) },
	isTimer: function(id){
		return this.isInterval(id) 
			|| this.isPersistentInterval(id)
			|| this.isTimeout(id) },


	// General API...
	// 
	// NOTE: we are not trying to re-implement the native scheduler here
	// 		just extend it and unify it's uses...
	setTimeout: ['- System/', 
		function(id, func, ms){
			var timeouts = this.__timeouts = this.__timeouts || {}

			this.clearTimeout(id)

			timeouts[id] = setTimeout(
				function(){
					// cleanup...
					// NOTE: we are doing this before we run to avoid 
					// 		leakage due to errors...
					delete timeouts[id]

					// run...
					func instanceof Function ? 
						func.call(this) 
						: this.call(func)
				}.bind(this),
				ms || 0)
		}],
	clearTimeout: ['- System/',
		function(id){
			var timeouts = this.__timeouts = this.__timeouts || {}
			clearTimeout(timeouts[id])
			delete timeouts[id]	
		}],

	setInterval: ['- System/',
		function(id, func, ms){
			var intervals = this.__intervals = this.__intervals || {}

			id in  intervals
				&& clearInterval(intervals[id])

			intervals[id] = setInterval(
				(func instanceof Function ? func : function(){ this.call(func) })
					.bind(this),
				ms || 0)
		}],
	clearInterval: ['- System/',
		function(id){
			var intervals = this.__intervals = this.__intervals || {}
			clearInterval(intervals[id])
			delete intervals[id]	
		}],

	setPersistentInterval: ['- System/',
		doc`

			Restart interval id...
			.setPersistentInterval(id)

			Save/start interval id...
			.setPersistentInterval(id, action, ms)

		`,
		function(id, action, ms){
			var intervals = 
				this.__persistent_intervals = 
					this.__persistent_intervals || {}
			// NOTE: we set this later iff we make a change...
			var cfg = this.config['persistent-intervals'] || {}

			// get defaults...
			action = action ? action : cfg[id].action
			ms = ms ? ms : cfg[id].ms

			// checks...
			if(!ms || !action){
				console.error('Persistent interval: both action and ms must be set.')
				return
			}
			if(typeof(action) != typeof('str')){
				console.error('Persistent interval: handler must be a string.')
				return
			}

			id in  intervals
				&& clearInterval(intervals[id])

			this.config['persistent-intervals'] = cfg
			cfg[id] = {
				action: action, 
				ms: ms,
			}

			intervals[id] = setInterval(
				function(){ this.call(action) }.bind(this), 
				ms || 0)
		}],
	clearPersistentInterval: ['- System/',
		function(id, stop_only){
			var intervals = 
				this.__persistent_intervals = 
					this.__persistent_intervals || {}
			clearInterval(intervals[id])
			delete intervals[id]	
			if(!stop_only){
				delete this.config['persistent-intervals'][id]
			}
		}],
	// XXX revise name (???)
	// XXX do we need actions other than start/stop ???
	persistentIntervals: ['- System/',
		doc`

			Start/restart all persistent interval timers...
			.persistentIntervals('start')
			.persistentIntervals('restart')

			Stop all persistent interval timers...
			.persistentIntervals('stop')
		
		NOTE: 'start' and 'restart' are the same, both exist for mnemonics.
		`,
		function(action){
			var ids = Object.keys(this.config['persistent-intervals'] || {})

			// start/restart...
			;(action == 'start' || action == 'restart') ?
				ids.forEach(function(id){
					this.setPersistentInterval(id) }.bind(this))
			// stop...
			: action == 'stop' ?
				ids.forEach(function(id){
					this.clearPersistentInterval(id, true) }.bind(this))
			// unknown action...
			: console.error('persistentIntervals: unknown action:', action)
		}],

	// Events...
	//
	// XXX should these be "aligned" to real time???
	// 		...i.e. everyHour is triggered on the XX:00:00 and not relative
	// 		to start time?
	// XXX should we macro these???
	/*/ XXX would be nice to trigger these ONLY if there are handlers...
	everySecond: ['- System/',
		Event(function(){
			// XXX
		})],
	//*/
	everyMinute: ['- System/',
		Event(function(){
			// XXX
		})],
	every2Minutes: ['- System/',
		Event(function(){
			// XXX
		})],
	every5Minutes: ['- System/',
		Event(function(){
			// XXX
		})],
	every10Minutes: ['- System/',
		Event(function(){
			// XXX
		})],
	every30Minutes: ['- System/',
		Event(function(){
			// XXX
		})],
	everyHour: ['- System/',
		Event(function(){
			// XXX
		})],
})

var Timers = 
module.Timers = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'timers',
	depends: [
	],

	actions: TimersActions,

	handlers: [
		// start persistent timers...
		// XXX should this be start or ready???
		['start', 
			function(){ this.persistentIntervals('start') }],
		// stop all timers...
		['stop', 
			function(){ 
				Object.keys(this.__intervals || {})
					.forEach(function(id){ this.clearInterval(id) }.bind(this))
				Object.keys(this.__timeouts || {})
					.forEach(function(id){ this.clearTimeout(id) }.bind(this))

				this.persistentIntervals('stop') 
			}],

		// fixed timer actions...
		// XXX not sure about these...
		['start',
			function(){
				var m = 1000*60
				this
					.setInterval('everyMinute', 'everyMinute', m)
					.setInterval('every2Minutes', 'every2Minutes', m*2)
					.setInterval('every5Minutes', 'every5Minutes', m*5)
					.setInterval('every10Minutes', 'every10Minutes', m*10)
					.setInterval('every30Minutes', 'every30Minutes', m*30)
					.setInterval('everyHour', 'everyHour', m*60)
			}],
	],
})


//---------------------------------------------------------------------
// Util...

var UtilActions = actions.Actions({
	mergeConfig: ['- System/', 
		doc`Merge a config object into .config
		`,
		function(config){
			config = config instanceof Function ? config.call(this)
				: typeof(config) == typeof('str') ? this.config[config]
				: config
			var that = this
			Object.keys(config).forEach(function(key){
				that.config[key] = config[key]
			})
		}],
})

var Util = 
module.Util = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'util',

	actions: UtilActions,
})


//---------------------------------------------------------------------
// Journal...
//
// This feature logs actions that either have the journal attribute set 
// to true or have an undo method/alias...
// 
//	Example:
// 		someAction: ['Path/to/Some action',
// 			// just journal the action, but it can't be undone...
// 			{journal: true},
// 			function(){ 
// 				... 
// 			}],
//
// 		otherAction: ['Path/to/Other action',
// 			// journal and provide undo functionality...
// 			{undo: function(){ 
// 				...
// 			}},
// 			function(){ 
// 				... 
// 			}],
//
// 		someOtherAction: ['Path/to/Some other action',
// 			// use .otherAction(..) to undo...
// 			{undo: 'otherAction'},
// 			function(){ 
// 				... 
// 			}],
//
// NOTE: .undo has priority over .journal, so there is no point of 
// 		defining both .journal and .undo action attributes, one is 
// 		enough.
//
//

// XXX would be great to add a mechanism define how to reverse actions...
// 		...one way to do this at this point is to revert to last state
// 		and re-run the journal until the desired event...
// XXX need to define a clear journaling strategy in the lines of:
// 		- save state clears journal and adds a state load action
// 		- .load(..) clears journal
// XXX need a way to store additional info in the journal...
// 		can either be done as: 
// 			- a hook (action handler and/or attr)
// 			- inline code inside the action...
//		can't say I like #2 as it will mess the code up...
// XXX needs careful testing...
var JournalActions = actions.Actions({

	clone: [function(full){
			return function(res){
				res.rjournal = null
				res.journal = null
				if(full && this.hasOwnProperty('journal') && this.journal){
					res.journal = JSON.parse(JSON.stringify(this.journal))
				}
			}
		}],

	journal: null,
	rjournal: null,

	journalable: null,

	// XXX doc supported attrs:
	// 		undo
	// 		undoable
	//		getUndoState
	// XXX should the action have control over what gets journaled and how???
	// XXX should aliases support explicit undo???
	updateJournalableActions: ['System/Update list of journalable actions',
		doc`
		
		NOTE: action aliases can not handle undo.
		`,
		function(){
			var that = this

			var handler = function(action){
				return function(){
					var cur = this.current
					var args = util.args2array(arguments)

					var data = {
						type: 'basic',

						action: action, 
						args: args,
						// the current image before the action...
						current: cur, 
						// the target (current) image after action...
						target: this.current, 
					}

					// test if we need to journal this action signature...
					var test = that.getActionAttr(action, 'undoable')
					if(test && !test.call(that, data)){
						return
					}

					// get additional undo state...
					var update = that.getActionAttr(action, 'getUndoState')
					while(typeof(update) == typeof('str')){
						update = that.getActionAttr(update, 'getUndoState')
					}
					update 
						&& update instanceof Function
						&& update.call(that, data)

					// journal after the action is done...
					return function(){ this.journalPush(data) }
				}
			}

			this.journalable = this.actions
				.filter(function(action){
					// skip aliases...
					return !(that[action] instanceof actions.Alias)
						&& (!!that.getActionAttr(action, 'undo') 
							|| !!that.getActionAttr(action, 'journal'))
				})
				// reset the handler
				.map(function(action){
					that
						.off(action+'.pre', 'journal-handler')
						.on(action+'.pre', 'journal-handler', handler(action))
					return action
				})
		}],

	journalPush: ['- System/Journal/Add an item to journal',
		function(data){
			// clear the reverse journal...
			this.rjournal
				&& (this.rjournal = null)

			this.journal = (this.hasOwnProperty('journal') || this.journal) ? 
				this.journal || []
				: []
			this.journal.push(data)
		}],
	clearJournal: ['System/Journal/Clear the action journal',
		function(){
			// NOTE: overwriting here is better as it will keep
			// 		shadowing the parent's .journal in case we 
			// 		are cloned.
			// NOTE: either way this will have no effect as we 
			// 		only use the local .journal but the user may
			// 		get confused...
			//delete this.journal
			this.journal
				&& (this.journal = null)
			this.rjournal
				&& (this.rjournal = null)
		}],
	runJournal: ['- System/Journal/Run journal',
		//{journal: true},
		function(journal){
			var that = this
			journal.forEach(function(e){
				// load state...
				that
					.focusImage(e.current)
					// run action...
					[e.action].apply(that, e.args)
			})
		}],

	// XXX needs very careful revision...
	// 		- should this be thread safe??? (likely not)
	// 		- should the undo action have side-effects on the 
	// 			journal/rjournal or should we clean them out??? 
	// 			(currently cleaned)
	// XXX should we control what gets pushed to the journal???
	// XXX should we run undo of every action that supports it in the chain???
	// 		...i.e. multiple extending actions can support undo
	// 		XXX will also need to handle aliases in chain...
	undo: ['Edit/Undo',
		doc`Undo last action from .journal that can be undone

			.undo()

		This will shift the action from .journal to .rjournal preparing 
		it for .redo()

		NOTE: this will remove all the non undoable actions from the 
			.journal up until and including the undone action.
		NOTE: only the undone action is pushed to .rjournal
		`,
		{browseMode: function(){ 
			return (this.journal && this.journal.length > 0) || 'disabled' }},
		function(){
			var journal = this.journal.slice() || []

			var rjournal = this.rjournal = 
				(this.hasOwnProperty('rjournal') || this.rjournal) ? 
					this.rjournal || [] 
					: []

			for(var i = journal.length-1; i >= 0; i--){
				var a = journal[i]

				// see if the action has an explicit undo attr...
				var undo = this.getActionAttr(a.action, 'undo')

				// general undo...
				if(undo){
					// restore focus to where it was when the action 
					// was called...
					this.focusImage(a.current)

					// call the undo method/action...
					// NOTE: this is likely to have side-effect on the 
					// 		journal and maybe even rjournal...
					// NOTE: these side-effects are cleaned out later.
					var undo = undo instanceof Function ?
							// pass the action name...
							undo.call(this, a)
						: typeof(undo) == typeof('str') ? 
							// XXX pass journal structure as-is... (???)
							this[undo].apply(this, a.args)
						: null

					// push the undone command to the reverse journal...
					rjournal.push(journal.splice(i, 1)[0])

					// restore journal state...
					// NOTE: calling the undo action would have cleared
					// 		the rjournal and added stuff to the journal
					// 		so we will need to restore things...
					this.journal = journal
					this.rjournal = rjournal

					break
				}
			}
		}],
	redo: ['Edit/Redo',
		doc`Redo an action from .rjournal

			.redo()

		Essentially this will remove and re-run the last action in .rjournal
		`,
		{browseMode: function(){ 
			return (this.rjournal && this.rjournal.length > 0) || 'disabled' }},
		function(){
			if(!this.rjournal || this.rjournal.length == 0){
				return
			}

			this.runJournal([this.rjournal.pop()])
		}],
})


var Journal = 
module.Journal = ImageGridFeatures.Feature({
	title: 'Action Journal',

	tag: 'journal',
	depends: [
		'serialization',
	],

	actions: JournalActions,

	// XXX need to drop journal on save...
	// XXX rotate/truncate journal???
	// XXX need to check that all the listed actions are clean -- i.e.
	// 		running the journal will produce the same results as user 
	// 		actions that generated the journal.
	handlers: [
		// log state, action and its args... 
		['start',
			function(){ this.updateJournalableActions() }],
	],
})



//---------------------------------------------------------------------
// Changes API... 

var ChangesActions = actions.Actions({
	// This can be:
	// 	- null/undefined	- write all
	// 	- true				- write all
	// 	- false				- write nothing
	// 	- {
	//		// write/skip data...
	//		data: <bool>,
	//
	//		// write/skip images or write a diff including the given 
	//		// <gid>s only...
	//		images: <bool> | [ <gid>, ... ],
	//
	//		// write/skip tags...
	//		tags: <bool>,
	//
	//		// write/skip bookmarks...
	//		bookmarked: <bool>,
	//
	//		// write/skip selected...
	//		selected: <bool>,
	//
	//		// feature specific custom flags...
	//		...
	// 	  }
	//
	// NOTE: in the complex format all fields ar optional; if a field 
	// 		is not included it is not written (same as when set to false)
	// NOTE: .current is written always.
	chages: null,

	clone: [function(full){
			return function(res){
				res.changes = null
				if(full && this.hasOwnProperty('changes') && this.changes){
					res.changes = JSON.parse(JSON.stringify(this.changes))
				}
			}
		}],

	markChanged: ['- System/',
		doc`Mark data sections as changed...

			Mark everything changed...
			.markChanged('all')

			Mark nothing changed...
			.markChanged('none')

			Mark section(s) as changed...
			.markChanged(<section>)
			.markChanged(<section>, ..)
			.markChanged([<section>, ..])

			Mark item(s) of section as changed...
			.markChanged(<section>, [<item>, .. ])

		NOTE: when marking section items, the new items will be added to
			the set of already marked items.
		NOTE: when .changes is null (i.e. everything changed, marked via
			.markChanged('all')) then calling this with anything other 
			than 'none' will have no effect.
		`,
		function(section, items){
			var that = this
			var args = section instanceof Array ? 
				section 
				: util.args2array(arguments)
			//var changes = this.changes = 
			var changes = 
				this.hasOwnProperty('changes') ?
					this.changes || {}
					: {}

			// all...
			if(args.length == 1 && args[0] == 'all'){
				this.changes = true

			// none...
			} else if(args.length == 1 && args[0] == 'none'){
				this.changes = false 

			// everything is marked changed, everything will be saved
			// anyway...
			// NOTE: to reset this use .markChanged('none') and then 
			// 		manually add the desired changes...
			} else if(this.changes == null){
				return

			// section items...
			} else if(items instanceof Array) {
				if(changes[section] === true){
					return
				}
				changes[section] = (changes[section] || []).concat(items).unique()
				this.changes = changes

			// section(s)...
			} else {
				args.forEach(function(arg){
					changes[arg] = true
				})
				this.changes = changes
			}
		}],
})


var Changes = 
module.Changes = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'changes',
	depends: [
		'serialization',
	],

	actions: ChangesActions,

	handlers: [
		// handle changes...
		['json',
			function(res, mode){
				if(this.changes != null){
					res.changes = JSON.parse(JSON.stringify(this.changes))
				}
			}],
		['load',
			function(_, data){
				if(data.changes){
					this.changes = JSON.parse(JSON.stringify(data.changes))
				}
			}],
	],
})



//---------------------------------------------------------------------
// Workspace...
//
// Basic protocol:
// 	A participating feature should:
// 	- react to .saveWorkspace(..) by saving it's relevant state data to the 
// 		object returned by the .saveWorkspace() action.
// 		NOTE: it is recommended that a feature save its relevant .config
// 			data as-is.
// 		NOTE: no other action or state change should be triggered by this.
// 	- react to .loadWorkspace(..) by loading it's state from the returned
// 		object...
// 		NOTE: this can be active, i.e. a feature may call actions when 
// 			handling this.
// 	- react to .toggleChrome(..) and switch on and off the chrome 
// 		visibility... (XXX)
//
//


// Helpers...
var makeWorkspaceConfigWriter =
module.makeWorkspaceConfigWriter = function(keys, callback){
	return function(workspace){
		var that = this

		var data = keys instanceof Function ? keys.call(this) : keys

		// store data...
		data.forEach(function(key){
			workspace[key] = JSON.parse(JSON.stringify(that.config[key]))
		})

		callback && callback.call(this, workspace)
	}
}

// XXX should this delete a prop if it's not in the loading workspace???
// XXX only replace a prop if it has changed???
// XXX handle defaults -- when a workspace was just created...
var makeWorkspaceConfigLoader =
module.makeWorkspaceConfigLoader = function(keys, callback){
	return function(workspace){
		var that = this

		var data = keys instanceof Function ? keys.call(this) : keys

		// load data...
		data.forEach(function(key){
			// the key exists...
			if(key in workspace){
				that.config[key] = JSON.parse(JSON.stringify(workspace[key]))

			// no key set...
			// XXX is this the right way to go???
			} else {
				delete that.config[key]
			}
		})

		callback && callback.call(this, workspace)
	}
}


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

// XXX need a way to handle defaults...
var WorkspaceActions = actions.Actions({
	config: {
		'load-workspace': 'default',

		'workspace': 'default',
		'workspaces': {},
	},

	get workspace(){
		return this.config.workspace },
	set workspace(value){
		this.loadWorkspace(value) },

	get workspaces(){
		return this.config.workspaces },

	getWorkspace: ['- Workspace/',
		function(){ return this.saveWorkspace(null) }],

	// NOTE: these are mainly triggers for other features to save/load
	// 		their specific states...
	// NOTE: handlers should only set data on the workspace object passively,
	// 		no activity is recommended.
	// NOTE: if null is passed this will only get the data, but will 
	// 		save nothing. this us useful for introspection and temporary
	// 		context storage.
	//
	// XXX for some reason this does not get saved with .config...
	saveWorkspace: ['Workspace/Save Workspace',
		function(name){
			if(!this.config.hasOwnProperty('workspaces')){
				this.config['workspaces'] = JSON.parse(JSON.stringify(this.config['workspaces']))
			}

			var res = {}

			if(name !== null){
				this.config['workspaces'][name || this.config.workspace] = res
			}

			return res
		}],
	// NOTE: merging the state data is the responsibility of the feature
	// 		...this is done so as not to restrict the feature to one 
	// 		specific way to do stuff...
	loadWorkspace: ['Workspace/Load Workspace',
		function(name){
			name = name || this.config.workspace

			// get a workspace by name and load it...
			if(typeof(name) == typeof('str')){
				this.config.workspace = name

				return this.workspaces[name] || {}

			// we got the workspace object...
			} else {
				return name
			}
		}],

	// NOTE: this will not save the current workspace...
	toggleWorkspace: ['Workspace/workspace',
		makeConfigToggler('workspace',
			function(){ return Object.keys(this.config['workspaces']) },
			function(state){ this.loadWorkspace(state) })],

	// XXX should we keep the stack unique???
	pushWorkspace: ['- Workspace/',
		function(name){
			name = name || this.workspace
			var stack = this.__workspace_stack = this.__workspace_stack || []

			this.saveWorkspace()

			if(stack.slice(-1)[0] == name){
				return
			}

			this.workspace != name && this.loadWorkspace(name)
			stack.push(name)
		}],
	popWorkspace: ['- Workspace/',
		function(){
			var stack = this.__workspace_stack

			if(!stack || stack.length == 0){
				return
			}

			this.saveWorkspace()
			this.loadWorkspace(stack.pop())
		}],
})


var Workspace = 
module.Workspace = ImageGridFeatures.Feature({
	title: '',

	tag: 'workspace',

	depends: [
		'lifecycle',
	],

	actions: WorkspaceActions,

	handlers: [
		['start', 
			function(){ 
				this.loadWorkspace(this.config['load-workspace'] || 'default') }],
		['stop', 
			function(){ 
				this.saveWorkspace() }],
	],
})



//---------------------------------------------------------------------
// Tasks...
// XXX should this be a separate module???

var tasks = require('lib/tasks')

// XXX see if a protocol can be practical here to:
// 		- serialize/restore jobs
// 		- ...
var TaskActions = actions.Actions({
	config: {
	},

	get jobs(){
		return this.__jobs },

	getJob: ['- Jobs/',
		function(name){
			name = name || this.data.newGID()

			// get/init task dict...
			var t = this.__jobs = this.__jobs || {}
			// get/init task...
			var job = t[name] = t[name] || tasks.Queue()
			job.name = name

			return job
		}],

	// XXX stop
})


var Tasks = 
module.Tasks = ImageGridFeatures.Feature({
	title: '',

	tag: 'tasks',

	depends: [ ],

	actions: TaskActions,

	handlers: [
		['start', 
			function(){ 
				// XXX prepare for recovery and recover...
			}],
		['stop', 
			function(){ 
				// XXX stop tasks and prepare for recovery...
			}],
	],
})



//---------------------------------------------------------------------
// Self test framework...

// Indicate an action to be a self-test action...
// 
// Self test actions are run by .selfTest(..)
// 
// XXX should we set an action attr or a func attr here???
var selfTest =
module.selfTest = function(func){
	func.__self_test__ = true
	return func
}

var SelfTestActions = actions.Actions({
	config: {
		'run-selftest-on-start': true,
	},

	selfTest: ['System/Run self test',
		selfTest(function(mode){
			var that = this
			var logger = this.logger && this.logger.push('Self test')

			var tests = this.actions
				.filter(function(action){ 
					return action != 'selfTest'
			   			&& (that[action].func.__self_test__ 
							|| that.getActionAttr(action, 'self_test'))})

			logger 
				&& tests.forEach(function(action){ 
					logger.emit('found', action) })


			tests.forEach(function(action){
				that[action]()

				logger 
					&& logger.emit('done', action)
			})
		})],
})

var SelfTest = 
module.SelfTest = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'self-test',
	depends: [
		'lifecycle'	
	],
	priority: 'low',

	actions: SelfTestActions, 

	handlers: [
		['start',
			function(){ 
				this.config['run-selftest-on-start'] 
					&& this.selfTest() }]
	],
})




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
