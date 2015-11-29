/**********************************************************************
* 
*
*
**********************************************************************/

define(function(require){ var module = {}
console.log('>>> features')

//var DEBUG = DEBUG != null ? DEBUG : true

actions = require('lib/actions')



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
// 	.suggested		- list of optional suggested features, these are not 
// 					  required but setup if available.
// 					  This is useful for defining meta features but without
// 					  making each sub-feature a strict dependency.
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
//
// Feature applicability:
// 	If feature.isApplicable(..) returns true then the feature will not be
// 	considered on setup...
//
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
			var config = this.config = this.config || this.actions.config

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
//
// 	Feature(obj)
// 		-> feature
//
// 	Feature(feature-set, obj)
// 		-> feature
//
// 	Feature(tag, obj)
// 		-> feature
//
//
// 	Feature(tag, actions)
// 		-> feature
//
// 	Feature(feature-set, tag, actions)
// 		-> feature
//
var Feature =
module.Feature =
function Feature(feature_set, tag, obj){
	if(arguments.length == 2){
		// Feature(<tag>, <obj>)
		if(typeof(feature_set) == typeof('str')){
			obj = tag
			tag = feature_set
			feature_set = Features

		// Feature(<feature-set>, <obj>)
		} else {
			obj = tag
			tag = null
		}

	// Feature(<obj>)
	} else if(arguments.length == 1){
		obj = feature_set
		feature_set = Features
	}

	if(tag != null && obj.tag != null && obj.tag != tag){
		throw 'Error: tag and obj.tag mismatch, either use one or both must match.'
	}

	// action...
	if(obj instanceof actions.Action){
		if(tag == null){
			throw 'Error: need a tag to make a feature out of an action'
		}
		var f = {
			tag: tag,
			actions: obj,
		}
		obj = f

	// meta-feature...
	} else if(obj.constructor === Array){
		if(tag == null){
			throw 'Error: need a tag to make a meta-feature'
		}
		var f = {
			tag: tag,
			suggested: obj,
		}
		obj = f

	// feature...
	} else {
		obj.__proto__ = FeatureProto
	}

	if(feature_set){
		feature_set[obj.tag] = obj
	}

	return obj
}
Feature.prototype = FeatureProto
Feature.prototype.constructor = Feature


var FeatureSet =
module.FeatureSet = {
	__feature__: Feature,

	// Build feature list...
	//
	// 	Build a list of all registered features
	// 	.buildFeatureList()
	// 	.buildFeatureList(actions)
	// 		-> list
	//
	// 	Build a list of given features
	// 	.buildFeatureList(null, list)
	// 	.buildFeatureList(actions, list)
	// 		-> list
	//
	//
	// NOTE: some feature .isApplicable(..) may expect the action set thus
	// 		making it required for building a feature list.
	// NOTE: this will try and keep the order as close as possible to the
	// 		original as possible, this if the list is correctly ordered 
	// 		it will not be affected...
	// NOTE: this will fix most dependency ordering errors except for two:
	// 		- cyclic dependencies
	// 			e.g. a -> b and b -> a, here there is no way to reorder
	// 				a and b to resolve this.
	// 		- dependency / priority conflict
	// 			e.g. a -> b but a has a higher priority that b thus 
	// 				making it impossible to order the two without 
	// 				breaking either the dependency or priority ordering.
	//
	//
	// Dependency sorting:
	//
	// These are order dependencies, i.e. for a dependency to be 
	// resolved it must satisfy ALL of the folowing:
	// 	- all dependencies must exist in the list.
	// 	- all dependencies must be positiond/setup before the dependant.
	//
	// The general algorithm is as folows:
	// 	1) place the dependencies befeore the dependant for each element
	// 	2) remove the duplicate features except fot the first occurance
	// 	3) repeat 1 and 2 for 2 to depth times or until the feature list
	// 		stabelizes, i.e. no new features are added on the last run.
	//
	// NOTE: if auto_include is true (default) this will add dependencies
	// 		as they are needed...
	// 		This is useful for "meta-features" that do nothing other than
	// 		depend/include sets of other features, for exmale: 'ui', 
	// 		'core', 'browser', ...etc.
	// NOTE: dependency chains larger than depth will be dropped, this 
	// 		can be fixed by setting a greater depth (default: 8)...
	// NOTE: conflicts that can occur and can not be recovered from:
	// 		- cyclic dependency
	// 			X will be before one of its dependencies...
	// 		- dependency / priority conflict
	// 			X will have higher priority than one of its dependencies...
	// NOTE: feature that depend in unapplicable features are considered
	// 		unapplicable.
	// 		XXX not sure if this is 100% correct...
	// NOTE: child high priority features will push their dependencies up
	// 		to precede them.
	// 		...this will not resolve all the possible conflicts so be 
	// 		careful.
	//
	// XXX make suggested feature expansion recursive...
	buildFeatureList: function(obj, lst, auto_include, depth){
		lst = lst == null ? Object.keys(this) : lst
		lst = lst.constructor !== Array ? [lst] : lst
		auto_include = auto_include == null ? true : false
		depth = depth || 8

		var that = this

		var missing = {}

		// helpers...
		// NOTE: _skipMissing(..) will add missing dependencies to missing...
		var _skipMissing = function(feature, deps, missing){
			return deps.filter(function(d){ 
				if(lst.indexOf(d) < 0){
					missing[d] = missing[d] != null ? missing[d] : []
					if(missing[d].indexOf(feature) < 0){
						missing[d].push(feature)
					}
				}
				return missing[d] == null
			})
		}
		var _sortDep = function(lst, missing, depth){

			do {
				var res = []
				var l = lst.length

				lst.forEach(function(n){
					var e = that[n]

					// no dependencies...
					if(e.depends == null || e.depends.length == 0){
						res.push(n)

					} else {
						// auto-include dependencies...
						if(auto_include){
							var deps = e.depends

						// skip dependencies that are not in list...
						} else {
							var deps = _skipMissing(n, e.depends, missing)
						}

						// place dependencies before the depended...
						res = res.concat(deps)
						res.push(n)
					}

				})
				lst = res
				depth -= 1
			} while(lst.length != l && depth > 0)

			return lst
		}
		var _getSuggested = function(featureset, feature, suggested, missing){
			suggested = suggested || []
			
			var s = (feature.suggested || [])

			s
				// remove the already visited suggenstions...
				.filter(function(e){ return suggested.indexOf(e) < 0 }) 
				// add unloaded features to missing...
				.filter(function(e){ 
					if(featureset[e] == null){
						missing[e] = missing[e] != null ? missing[e] : []
						if(missing[e].indexOf(feature.tag) < 0){
							missing[e].push(feature.tag)
						}
						return false
					}
					return true
				}) 
				// load new suggenstions...
				.forEach(function(n){
					var e = featureset[n]
					if(e != null && e.suggested != null){
						suggested = suggested
							.concat(_getSuggested(featureset, e, suggested, missing))
							.unique()
					}
					suggested.push(n)
				})

			return suggested
		}

		// expand optional "suggested" features...
		// XXX make this recursive...
		var res = []
		lst.forEach(function(n){
			var e = that[n]
			if(e != null && e.suggested != null){
				//res = res.concat(e.suggested)
				res = res.concat(_getSuggested(that, e, res, missing))
			}
			res.push(n)
		})
		lst = res

		// expand and sort dependencies...
		// 	2+ times untill depth is 0 or length stabelizes...
		lst = _sortDep(lst, missing, depth).unique()

		// sort features via priority keeping the order as close to 
		// manual as possible...
		var l = lst.length
		lst = lst
			// remove undefined and non-features...
			.filter(function(e){ return that[e] != null 
				&& that[e] instanceof Feature })
			// build the sort table: [ <priority>, <rev-index>, <elem> ]
			// NOTE: <rev-index> is element number from the tail...
			.map(function(e, i){ return [ -that[e].getPriority(), i, e ] })
			// do the sort...
			// NOTE: for some reason JS compares lists as strings so we
			// 		have to comare the list manually...
			.sort(function(a, b){ return a[0] - b[0] || a[1] - b[1] })
			// cleanup -- drop the table...
			.map(function(e){ return e[2] })

		// sort dependencies again...
		// NOTE: this bubles the "priority" up the dependency tree...
		// NOTE: this will not resolve all the conflicts...
		lst = _sortDep(lst, missing, depth).unique()

		// clasify features...
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
			if(e.depends == null || e.depends.length == 0){
				return true
			}

			// mark feature unapplicable if it depends on an unapplicable...
			// NOTE: we need to do this once as features at this point
			// 		are sorted by dependencies...
			if(e.depends.filter(function(dep){
						return unapplicable.indexOf(dep) > -1 
					}).length > 0){
				unapplicable.push(n)
				return false
			}

			// keep only conflicting...
			var deps = e.depends.filter(function(dep){
				dep = lst.indexOf(dep)
				return dep == -1 || dep > i
			})

			// skip missing dependencies...
			// NOTE: we need to check for missing again as a feature 
			// 		could have been removed due to inapplicability or
			// 		being undefined...
			deps = _skipMissing(n, deps, missing)

			// no conflicts...
			if(deps.length == 0){
				return true
			}

			// dependency exists but in wrong order -- can't fix...
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
			missing: missing,
			conflicts: conflicts,
			unapplicable: unapplicable,
		}
	},

	setup: function(obj, lst){
		lst = lst.constructor !== Array ? [lst] : lst
		var features = this.buildFeatureList(obj, lst)
		lst = features.features

		// check for conflicts...
		if(Object.keys(features.conflicts).length != 0
				|| Object.keys(features.missing).length != 0){
			var m = features.missing
			var c = features.conflicts

			// build a report...
			var report = []

			// missing deps...
			Object.keys(m).forEach(function(k){
				report.push(k + ': missing but required by:\n          ' + m[k].join(', '))
			})
			report.push('\n')

			// conflicts...
			Object.keys(c).forEach(function(k){
				report.push(k + ': must setup after:\n          ' + c[k].join(', '))
			})

			// break...
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

		return obj
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

	// shorthand for: Feature(<feature-set>, ...)
	// XXX should this return this?
	Feature: function(){
		return this.__feature__.apply(null, [this].concat(args2array(arguments)))
	},
}


//---------------------------------------------------------------------

var Features =
module.Features = Object.create(FeatureSet)



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
