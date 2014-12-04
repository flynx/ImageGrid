/**********************************************************************
* 
*
*
**********************************************************************/

define(function(require){ var module = {}
console.log('>>> features')

//var DEBUG = DEBUG != null ? DEBUG : true


/*********************************************************************/
//
// Feature attributes:
// 	.tag			- feature tag (string)
// 					  this is used to identify the feature, its event handlers
// 					  and DOM elements.
//
// 	.title			- feature name (string | null)
// 	.doc			- feature description (string | null)
//
// 	.priority		- feature priority
// 					  can be:
// 					  	- 'high' (99) | 'medium' (0) | 'low' (-99)
// 					  	- number
// 					  	- null (0, default)
// 					  features with higher priority will be setup first,
// 					  features with the same priority will be run in order of
// 					  occurrence.
// 	.depends		- feature dependencies -- tags of features that must setup
// 					  before the feature (list | null)
// 	.exclusive		- feature exclusivity tags (list | null)
// 					  an exclusivity group enforces that only one feature in
// 					  it will be run, i.e. the first / highest priority.
//
// 	.actions		- action object containing feature actions (ActionSet | null)
// 					  this will be mixed into the base object on .setup()
// 					  and mixed out on .remove()
// 	.config			- feature configuration, will be merged with base 
// 					  object's .config
// 	.handlers		- feature event handlers (list | null)
// 
//
//
// .handlers format:
// 	[
// 		[ <event-spec>, <handler-function> ],
// 		...
// 	]
//
// NOTE: both <event-spec> and <handler-function> must be compatible with
// 		Action.on(..)
//
// XXX this could install the handlers in two locations:
// 		- mixin if available...
// 		- base object (currently implemented)
// 		should the first be done?
var FeatureProto =
module.FeatureProto = {
	tag: null,

	isApplicable: function(actions){
		return true
	},

	getPriority: function(){
		var res = this.priority || 0
		return res == 'high' ? 99
			: res == 'low' ? -99
			: res == 'medium' ? 0
			: res
	},

	setup: function(actions){
		var that = this

		// mixin actions...
		if(this.actions != null){
			actions.mixin(this.actions)
		}

		// install handlers...
		if(this.handlers != null){
			this.handlers.forEach(function(h){
				actions.on(h[0], that.tag, h[1])
			})
		}

		// merge config...
		// XXX should this use inheritance???
		if(this.config != null 
				|| (this.actions != null 
					&& this.actions.config != null)){
			var config = this.config || this.actions.config

			if(actions.config == null){
				actions.config = {}
			}
			Object.keys(config).forEach(function(n){
				// keep existing keys...
				if(actions.config[n] === undefined){
					actions.config[n] = config[n]
				}
			})
		}

		// custom setup...
		// XXX is this the correct way???
		if(this.hasOwnProperty('setup') && this.setup !== FeatureProto.setup){
			this.setup(actions)
		}

		return this
	},
	remove: function(actions){
		if(this.actions != null){
			actions.mixout(this.actions)
		}

		if(this.handlers != null){
			actions.off('*', this.tag)
		}

		if(this.hasOwnProperty('remove') && this.setup !== FeatureProto.remove){
			this.remove(actions)
		}

		// remove feature DOM elements...
		actions.ribbons.viewer.find('.' + this.tag).remove()

		return this
	},
}


// XXX is hard-coded default feature-set a good way to go???
var Feature =
module.Feature =
function Feature(feature_set, obj){
	if(obj == null){
		obj = feature_set
		// XXX is this a good default???
		feature_set = Features
	}

	obj.__proto__ = FeatureProto

	if(feature_set){
		feature_set[obj.tag] = obj
	}

	return obj
}
Feature.prototype = FeatureProto
Feature.prototype.constructor = Feature


// XXX experimental...
// 		...not sure if the global feature set is a good idea...
// XXX if this works out might be a good idea to organize everything as
// 		a feature... including the Client and Viewer
// 		...needs more thought...
var FeatureSet =
module.FeatureSet = {
	buildFeatureList: function(obj, lst){
		lst = lst.constructor !== Array ? [lst] : lst

		var that = this

		// sort features via priority...
		lst = lst.sort(function(a, b){
			a = that[a] == null ? 0 : that[a].getPriority()
			b = that[b] == null ? 0 : that[b].getPriority()
			return b - a
		})

		// sort features via dependencies...
		var unapplicable = []
		var conflicts = {}
		lst = lst.filter(function(n, i){
			var e = that[n]
			if(e == null){
				return true
			}

			// check applicability...
			if(!e.isApplicable(obj)){
				unapplicable.push(n)
				return false
			}

			// no dependencies...
			if(e.depends == null ){
				return true
			}

			// keep only conflicting...
			var deps = e.depends.filter(function(dep){
				dep = lst.indexOf(dep)
				return dep == -1 || dep > i
			})

			// no conflicts...
			if(deps.length == 0){
				return true
			}

			// can't fix...
			conflicts[n] = deps

			return false
		})

		// skip duplicate exclusive features...
		var exclusive = []
		var excluded = []
		lst = lst.filter(function(n){
			var e = that[n]
			if(e == null || e.exclusive == null ){
				return true
			}
			// count the number of exclusive features already present...
			var res = e.exclusive
				.filter(function(n){
					if(exclusive.indexOf(n) < 0){
						exclusive.push(n)
						return false
					}
					return true
				})
				.length == 0

			if(!res){
				excluded.push(n)
			}

			return res
		})

		return {
			features: lst,
			excluded: excluded,
			conflicts: conflicts,
			unapplicable: unapplicable,
		}
	},

	setup: function(obj, lst){
		lst = lst.constructor !== Array ? [lst] : lst
		var features = this.buildFeatureList(obj, lst)
		lst = features.features

		// check for conflicts...
		if(Object.keys(features.conflicts).length != 0){
			var c = features.conflicts

			// build a report...
			var report = []
			Object.keys(c).forEach(function(k){
				report.push(k + ': must setup after:\n          ' + c[k].join(', '))
			})
			throw 'Feature dependency error:\n    ' + report.join('\n    ')
		}

		// report excluded features...
		if(features.excluded.length > 0){
			console.warn('Excluded features due to exclusivity conflict:', 
					features.excluded.join(', '))
		}

		// report unapplicable features...
		if(features.unapplicable.length > 0){
			console.log('Features not applicable in current context:', 
					features.unapplicable.join(', '))
		}

		// do the setup...
		var that = this
		var setup = FeatureProto.setup
		lst.forEach(function(n){
			// setup...
			if(that[n] != null){
				console.log('Setting up feature:', n)
				setup.call(that[n], obj)
			}
		})
	},
	remove: function(obj, lst){
		lst = lst.constructor !== Array ? [lst] : lst
		var that = this
		lst.forEach(function(n){
			if(that[n] != null){
				console.log('Removing feature:', n)
				that[n].remove(obj)
			}
		})
	},
}


//---------------------------------------------------------------------

var Features =
module.Features = Object.create(FeatureSet)



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
