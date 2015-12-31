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
			var path = value.path
			var method = value.method
			var cur = value.current
		}

		// normalize path if it's not root...
		if(path != '/' && path != '\\'){
			path = util.normalizePath(path)
		}

		this.__location = {
			path: path,
			method: method,
			current: cur,
		}

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
})

module.Location = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'location',

	actions: LocationActions,
})



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
