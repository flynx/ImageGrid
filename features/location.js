/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

var util = require('lib/util')
var object = require('lib/object')

var actions = require('lib/actions')
var features = require('lib/features')
var toggler = require('lib/toggler')

var core = require('features/core')



/*********************************************************************/
// XXX experimental...

// XXX need the other .location stuff to be visible/accessible...
// 		...now this only shows path...
var Location = 
//module.Location =
object.Constructor('Location', {
	get path(){
		return this.__actions.__location.path },
	set path(value){
		this.__actions.location = value },

	__init__: function(actions){
		this.__actions = actions },
})




/*********************************************************************/
// XXX add url scheme support...
// 		<method>://<path>#<current>?<other>
// XXX add .hash support for in-location .current setting when no index
// 		available... 
// XXX this should provide mechaincs to define location handlers, i.e.
// 		a set for loader/saver per location type (.method)
// XXX revise the wording...
// 		.path or .url

var LocationActions = actions.Actions({
	config: {
		'default-load-method': null,

		'location-stored-attrs': [
			'sync',
		],
	},

	// Format:
	// 	{
	// 		current: <current-gid>,
	// 		load: <load-method>,
	// 		sync: <sync-method>,
	// 		path: <base-path>,
	// 		...
	// 	}
	//
	// NOTE: these will remove the trailing '/' (or '\') from .path 
	// 		unless the path is root (i.e. "/")...
	// 		...this is mainly to facilitate better browse support, i.e.
	// 		to open the dir (open parent + select current) and not 
	// 		within the dir
	__location: null,

	get location(){
		this.__location = this.__location || {}

		var b = this.__location.path
		if(b && b != '/' && b != '\\'){
			b = util.normalizePath(b)
		}

		if(b){
			this.__location.path = b
		}

		this.__location.current = this.current

		return this.__location
		//return Location(this) 
	},
	// NOTE: this is a shorthand for .loadLocation(..)
	// NOTE: the method is needed to enable us to get the action return
	// 		value...
	set location(value){
		this.loadLocation(value) },


	// Load location...
	//
	// 	Reload current location...
	// 	.loadLocation()
	// 		-> result
	//
	//	Load new path using current location method and data...
	//	.loadLocation(path)
	// 		-> result
	//
	//	Load new location...
	//	.loadLocation(location)
	// 		-> result
	// 		NOTE: this is almost the same as .location = location but
	// 			here we can access the call return value.
	//
	// NOTE: .location will be set by the .load handler...
	//
	// XXX not sure about where to set the .__location -- see inside...
	loadLocation: ['- File/Load location',
		function(location){
			location = location || this.location

			// got a path -> load using current location data...
			if(typeof(location) == typeof('str')){
				location = {
					path: path,
					load: (this.__location && this.__location.load) 
						|| this.config['default-load-method'],
					current: this.current,
				}

			// got an object...
			} else {
				// clone the location...
				location = JSON.parse(JSON.stringify(location))
			}

			var load = location.load 
				|| this.location.load 
				|| this.config['default-load-method']
			var cur = location.current
			var path = location.path

			// normalize path if it's not root...
			if(path != '/' && path != '\\'){
				path = location.path = util.normalizePath(path)
			}


			// XXX ???
			//this.__location = location 

			// NOTE: the method should set the proper location if it uses .clear()...
			var res = load && this[load](path)


			// load current...
			if(cur){
				if(res && res.then != null){
					var that = this
					res.then(function(){
						that.current = cur
					})

				} else {
					this.current = cur
				}
			}

			return res
		}],

	clearLoaction: ['File/Clear location',
		function(){ delete this.__location }],


	// XXX
	// XXX should these have the same effect as .dispatch('location:*:load', location)???
	// 		...another way to put it is should we call this from dispatch?
	// 			...feels like yes -- this will turn into another Action-like
	// 			protocol...
	// 				...or we can use this to wrap the actual matching action...
	_loadLocation: ['- File/Save location',
		{protocol: 'location:*:load'},
		function(location){
			this.location.load = this.locationMethod(location)
			this.dispatch('location:*:load', location) 
		}],
	_saveLocation: ['- File/Save location',
		{protocol: 'location:*:save'},
		function(location){
			this.location.load = this.locationMethod(location)
			this.dispatch('location:*:save', location) }],
	_locationMethod: ['- File/',
		{protocol: 'location:?'},
		function(location){ 
			return (location || this.location).load || null }],
	// 
	// format:
	// 	{
	// 		'protocol:method': 'actionName',
	//
	// 		'family:protocol:method': 'actionName',
	//
	// 		'family:*': 'actionName',
	// 		...
	// 	}
	get protocols(){
		var cache = this.__location_protocol_cache = this.__location_protocol_cache 
			|| this.cacheProtocols()
		return cache },
	cacheProtocols: ['- File/',
		function(){
			var that = this
			var res = {}
			this.actions.forEach(function(n){
				var proto = that.getActionAttr(n, 'protocol')
				if(proto){
					res[proto] = n } })
			return res }],
	// XXX how do we call the dispatched actions and all the matching 
	// 		pattern actions???
	// 			One way to go would be:
	// 				.dispatch('location:*:save', ..)
	// 					-> 'location:?'					- get the default for '*'
	// 					-> 'location:*:save' (pre)
	// 					-> 'location:file:save'			- forms the return value
	// 					-> 'location:*:save' (post)
	//
	// 			...this should the same as calling (???):
	// 				.loadLocation(..)
	// XXX sanity check: how is this different for what Action(..) does???
	// 		...the only thing this adds is a way not to call some of the 
	// 		overloading actions via a simple pattern matching mechanism...
	// 			Example:
	// 				.dispatch('location:file:save', ..)
	// 					-> calls only the "save" actions that match the 
	// 						location:file protocol ignoring all other 
	// 						implementations...
	// 		...for pure actions this is also possible by manually checking
	// 		some condition and doing nothing if not matched...
	dispatch: ['- File/',
		core.doc`

			Execute command in specific protocol...
			.dispatch('protocol:command', ..)
			.dispatch('family:protocol:command', ..)
				-> result

			XXX defaults...

			XXX introspection...
		`,
		function(spec){
			var args = [...arguments].slice(1)
			spec = spec instanceof Array ? spec : spec.split(':')

			var cache = this.protocols
			var protocols = Object.keys(cache)

			// get all matching paths...
			var matches = protocols.slice()
				.map(function(p){ return p.split(':') })
			spec.forEach(function(e, i){
				matches = matches
					.filter(function(p){ return e == '*' || p[i] == e }) })
			matches = matches
				// remove matches ending with '*'... (XXX ???)
				.filter(function(p){ return p.slice(-1)[0] != '*' })
				.map(function(p){ return p.join(':') })

			// fill in the gaps...
			var i = spec.indexOf('*')
			while(spec.indexOf('*') >= 0){
				var handler = cache[spec.slice(0, i).concat('?').join(':')]
				if(handler){
					spec[i] = this[handler].apply(this, args)
					i = spec.indexOf('*')

				// error...
				// XXX how do we break out of this???
				} else {
					throw ('No default defined for: '+ spec.slice(0, i+1).join(':'))
				}
			}

			// introspection...
			// XXX this supports only one '??'
			var i = spec.indexOf('??')
			if(i >= 0){
				var head = spec.slice(0, i).join(':')
				var tail = spec.slice(i+1).join(':')
				console.log(head, tail)
				return protocols
					.filter(function(p){
						return p.startsWith(head) 
							&& (tail == '' 
								|| (p.endsWith(tail)
									&& p.length > (head.length + tail.length + 2))) })

			// call method...
			} else {
				var m = spec.join(':')
				console.log('>>>', m)

				// XXX take all the matches and chain call them...
				return this[cache[m]].apply(this, args)
			}
		}],


	// sync API...
	//
	get location_sync_methods(){
		var that = this
		return (this.__location_sync_methods_cache = 
			this.__location_sync_methods_cache
				|| this.actions
					.filter(function(n){
						return that.getActionAttr(n, 'locationSync') })
					.reduce(function(res, n){
						res[n] = 
							(that.getActionAttr(n, 'doc') || '')
								.split(/[\\\/]/)
								.pop()
						res[n] = res[n] == '' ? 
							n 
							: res[n] 
						return res
					}, {})) },

	sync: ['- System/Synchronize index',
		core.doc`Synchronize index...

			.sync()
				-> promise


		NOTE: it is up to the client to detect and implement the actual 
			sync mechanics.
		NOTE: this expects the return value of the sync handler to be 
			a promise...
		`,
		function(){
			var method = this.location.sync
			return method in this ?
				// NOTE: this should return a promise...
				this[method](...arguments)
				: Promise.resolve() }],

	toggleSyncMethod: ['File/Index synchronization method', 
		core.doc`Toggle index synchronization method
		
		NOTE: this will not show disabled methods.`,
		{mode: 'advancedBrowseModeAction'},
		toggler.Toggler(null, 
			function(_, state){
				var dict = this.location_sync_methods

				// get...
				if(state == null){
					return dict[this.location.sync] 
						|| this.location.sync 
						|| 'none' }	

				// clear... 
				if(state == 'none'){
					delete this.location.sync 

				// set...
				} else {
					// reverse dict...
					var rdict = new Map(
						Object.entries(dict)
							.map(function([k, v]){ 
								return [v, k] }))
					// normalize state to action name...
					state = state in dict ? 
						state
						: (rdict.get(state) || state)
					this.location.sync = state 
				}

				this.markChanged
					&& this.markChanged('config')
			},
			function(){ 
				var that = this
				return ['none', 
					...Object.entries(this.location_sync_methods)
						.filter(function([n, d]){
							// do not list disabled methods...
							return that.getActionMode(n) != 'disabled' })
						.map(function([n, d]){ return d }) ] })],


	// 1) store .location
	// 2) cleanup .images[..].base_path
	//
	// XXX might be good to make the .base_path relative to location 
	// 		if possible...
	// XXX not sure if this is the right place for .images[..].base_path 
	// 		handling...
	json: [function(){ 
		return function(res){
			if(this.location){
				var l = res.location = JSON.parse(JSON.stringify(this.location))
				
				// cleanup base_path...
				Object.keys(res.images || {}).forEach(function(gid){
					var img = res.images[gid]

					if(l.path == img.base_path){
						delete img.base_path
					}
				}) } }}],
	load: [function(){
		return function(_, data){
			var that = this

			// NOTE: we are setting this after the load because the 
			// 		loader may .clear() the viewer, thus clearing the
			// 		.location too...
			var l = this.__location = data.location

			// set default image .base_path
			// XXX not sure we need this...
			data.location
				&& Object.keys(this.images || {}).forEach(function(gid){
					var img = that.images[gid]

					if(img.base_path == null){
						img.base_path = l.path
					}
				}) }}],
	clone: [function(){
		return function(res){
			if(this.location){
				res.__location = JSON.parse(JSON.stringify(this.__location))
			} }}],
	clear: [function(){ 
		this.clearLoaction() }],
})

module.Location = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'location',
	depends: [
		'base',
	],

	actions: LocationActions,

	handlers: [
		// handle:
		// 	- local configuration...
		// 		.location <-> .config
		// XXX should this handle image .base_path ???
		['prepareIndexForWrite', 
			function(res){
				if(res.changes === true || res.changes.config){
					var data = {}
					;(this.config['location-stored-attrs'] || [])
						.forEach(function(attr){
							attr in (res.raw.location || {})
								&& (data[attr] = res.raw.location[attr]) })
					Object.keys(data).length > 0
						&& (res.index.config = 
							Object.assign(
								res.index.config || {},
								data)) } }],
		['prepareIndexForLoad',
			function(res, json, base_path){
				if(json.config){
					var data = {}
					;(this.config['location-stored-attrs'] || [])
						.forEach(function(attr){
							attr in json.config
								&& (data[attr] = json.config[attr]) })
					Object.keys(data).length > 0
						&& (res.location = 
							Object.assign(
								res.location || {},
								data)) } }],
	],
})



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
