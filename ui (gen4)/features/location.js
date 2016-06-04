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

// XXX add .hash support for in-location .current setting when no index
// 		available... 
// XXX should this or LocationLocalStorage save/load location (now it's 
// 		done by history)
// XXX this should provide mechaincs to define location handlers, i.e.
// 		a set for loader/saver per location type (.method)
// XXX revise the wording...
// 		.method?
// 		.path or .url

var LocationActions = actions.Actions({
	config: {
		'recover-load-errors-to-previous-location': true,
	},

	// Format:
	// 	{
	// 		path: <base-path>,
	// 		method: <load-method>,
	// 		current: <current-gid>,
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
	// XXX is 'loadIndex' a good default???
	set location(value){
		// got a path...
		if(typeof(value) == typeof('str')){
			var path = value
			// XXX get a better reasonable default...
			var method = this.__location 
				&& this.__location.method 
					|| undefined 
			var cur = this.current

		// got an object...
		} else {
			value = JSON.parse(JSON.stringify(value))

			var path = value.path = value.path

			value.method = value.method
			value.current = value.current
		}

		// normalize path if it's not root...
		if(path != '/' && path != '\\'){
			value.path = util.normalizePath(path)
		}

		this.__location = value 

		// XXX is 'loadIndex' a good default???
		var res = this[value.method || 'loadIndex'](path)

		// XXX load current...
		if(res.then != null){
			res.then(function(){
				this.current = cur
			})

		} else {
			this.current = cur
		}
	},

	// Wrap the loader and recover if it fails...
	//
	// 	.recoverableLoad(loader, new-location)
	// 		-> actions
	//
	// NOTE: this avoids load loops by attempting to recover only once...
	//
	// XXX should this be used in .location setter? 
	recoverableLoad: ['- Location/',
		function(loader, location){
			// this is the critical section, after this point we
			// are doing the actual loading....
			try {
				// prepare to recover, just in case...
				this.__recover = (this.__recover !== false 
						&& this.config['recover-load-errors-to-previous-location']) ? 
					this.location
					: false

				loader()
				// NOTE: we are setting this after the load because the 
				// 		loader may .clear() the viewer, thus clearing the
				// 		.location too...
				this.__location = location 

				// all went well clear the recovery data...
				delete this.__recover

			// something bad happened, clear and handle it...
			} catch(err){
				this.clear()

				console.error(err)

				// recover to last location...
				if(this.__recover){
					var l = this.__recover

					// NOTE: this will prevent us from entering
					// 		a recover attempt loop...
					// 		...if the recovery fails we will just
					// 		clear and stop.
					this.__recover = false

					// do the loading...
					this.location = l

				// fail...
				} else {
					// clear the recovery data...
					delete this.__recover

					// fail...
					throw err
				}
			}
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
				if(data.location){
					this.__location = data.location
				}
			}],
	],
})



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
