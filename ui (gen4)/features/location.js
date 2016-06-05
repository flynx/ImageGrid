/**********************************************************************
* 
*
*
**********************************************************************/

define(function(require){ var module = {}

//var DEBUG = DEBUG != null ? DEBUG : true

var util = require('lib/util')

var actions = require('lib/actions')
var features = require('lib/features')

var core = require('features/core')



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
	},

	// Format:
	// 	{
	// 		path: <base-path>,
	// 		method: <load-method>,
	// 		current: <current-gid>,
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
	},
	// NOTE: this is a shorthand for .loadLocation(..)
	// NOTE: the method is needed to enable us to get the action return
	// 		value...
	set location(value){
		this.loadLocation(value)
	},


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
	loadLocation: ['File/Load location',
		function(location){
			location = location || this.location

			// got a path -> load using current location data...
			if(typeof(location) == typeof('str')){
				location = {
					path: path,
					method: (this.__location && this.__location.method) 
						|| this.config['default-load-method'],
					current: this.current,
				}

			// got an object...
			} else {
				// clone the location...
				location = JSON.parse(JSON.stringify(location))
			}

			var method = location.method 
				|| this.location.method 
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
			var res = method && this[method](path)


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
})

module.Location = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'location',

	actions: LocationActions,

	handlers: [
		['clone',
			function(res){
				if(this.location){
					res.__location = JSON.parse(JSON.stringify(this.__location))
				}
			}],
		['clear',
			function(){
				delete this.__location
			}],

		// 1) store .location
		// 2) cleanup .images[..].base_path
		//
		// XXX might be good to make the .base_path relative to location 
		// 		if possible...
		// XXX not sure if this is the right place for .images[..].base_path 
		// 		handling...
		['json',
			function(res){
				if(this.location){
					var l = res.location = JSON.parse(JSON.stringify(this.location))
					
					// cleanup base_path...
					Object.keys(res.images).forEach(function(gid){
						var img = res.images[gid]

						if(l.path == img.base_path){
							delete img.base_path
						}
					})
				}
			}],
		['load',
			function(_, data){
				// NOTE: we are setting this after the load because the 
				// 		loader may .clear() the viewer, thus clearing the
				// 		.location too...
				this.__location = data.location
			}],
	],
})



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
