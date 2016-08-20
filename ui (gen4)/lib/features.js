/**********************************************************************
* 
*
*
**********************************************************************/
(typeof(define)[0]=='u'?function(f){module.exports=f(require)}:define)(
function(require){ var module={} // makes module AMD/node compatible...
/*********************************************************************/

var args2array = require('lib/util').args2array

var actions = require('lib/actions')
var object = require('lib/object')



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
// 					  NOTE: the final .config is an empty object with
// 					  		.__proto__ set to the merged configuration
// 					  		data...
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
// 	If feature.isApplicable(..) returns false then the feature will not be
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
		// NOTE: this will merge the actual config in .config.__proto__
		// 		keeping the .config clean for the user to lay with...
		if(this.config != null 
				|| (this.actions != null 
					&& this.actions.config != null)){
			var config = this.config = this.config || this.actions.config

			if(actions.config == null){
				actions.config = Object.create({})
			}
			Object.keys(config).forEach(function(n){
				// NOTE: this will overwrite existing values...
				actions.config.__proto__[n] = config[n]
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


var FeatureSetProto = {
	__feature__: Feature,
	__actions__: actions.Actions,

	// if true, .setup(..) will report things it's doing... 
	__verbose__: null,

	// List of registered features...
	get features(){
		var that = this
		return Object.keys(this)
			.filter(function(e){ 
				return e != 'features' 
					&& that[e] instanceof Feature }) 
	},

	// Build list of features...
	//
	//	Build list of all features for an empty object...
	//	.buildFeatureList()
	//	.buildFeatureList({})
	//	.buildFeatureList({}, '*')
	//		-> data
	//
	//	Build a list of features for a specific root feature and object...
	//	.buildFeatureList(object, feature)
	//		-> data
	//
	//	Build a list of features for a specific set of root features and object...
	//	.buildFeatureList(object, [feature, ..])
	//		-> data
	//		NOTE: to disable a feature and all of it's dependants prefix
	//			it's tag with '-' in the list.
	//			e.g. including 'some-feature' will include the feature
	//			and its dependants while '-some-feature' will remove
	//			it and it's dependants.
	//
	//
	// This will build from user input a loadable list of features taking 
	// into account feature dependencies, priorities and suggestions.
	//
	// Roughly this is done in this order starting with the given features:
	// 	- include all dependencies (recursively)
	// 	- include all suggested features (recursively)
	// 	- sort features by priority
	// 	- sort features by dependency
	// 	- check for feature applicability
	// 	- remove non-applicable features and all dependants (recursively)
	// 	- remove disabled features and all dependants (recursively)
	// 	- check and resolve exclusivity conflicts (XXX needs revision)
	// 	- check for missing features and dependencies
	//
	//
	// Return format:
	// 	{
	// 		// list of input features...
	// 		input: [ .. ],
	//
	//		// features in correct load order...
	//		features: [ .. ],
	//
	//		// features disabled explicitly and their dependants...
	//		disabled: [ .. ],
	//		// unapplicable features and their dependants...
	//		unapplicable: [ .. ],
	//
	//		// features removed due to exclusivity conflict...
	//		excluded: [ .. ],
	//
	//		missing: {
	//			// features explicitly given by user but missing...
	//			USER: [ .. ],
	//			// missing <feature> dependencies...
	//			<feature>: [ .. ],
	//			...
	//		},
	//		conflicts: {
	//			XXX
	//		},
	// 	}
	//
	//
	// NOTE: obj (action set) here is used only for applicability testing...
	// NOTE: some feature applicability checks (.isApplicable(..)) may 
	// 		require a real action set, thus for correct operation one 
	// 		should be provided.
	// NOTE: all feature sorting is done maintaining relative feature order
	// 		when possible...
	// NOTE: meta-features are not included in the list as they do not 
	// 		need to be setup.
	// 		...this is because they are not Feature objects.
	//
	// XXX should meta-features be MetaFeature objects???
	// XXX not sure about handling excluded features (see inside)...
	// XXX add dependency loops to .conflicts...
	// XXX might be a good idea to check dependency loops on feature 
	// 		construction, too... (???)
	buildFeatureList: function(obj, lst){
		var that = this
		obj = obj || {}

		lst = (lst == null || lst == '*') ? this.features : lst
		lst = lst.constructor !== Array ? [lst] : lst

		var input = lst.slice()
		var disabled = [] 
		var excluded = []
		var unapplicable = []
		var missing = {}
		var conflicts = {}


		// reverse dependency cache... 
		var dependants = {}

		// build dependency list...
		var _buildDepList = function(n, seen){
			seen = seen || []
			return seen.indexOf(n) >= 0 ? []
				: seen.push(n) && dependants[n] ? []
					.concat.apply(
						dependants[n], 
						dependants[n]
							.map(function(n){ return _buildDepList(n, seen) }))
				: []
		}


		// missing stage 1: check if all user included features exist...
		// NOTE: we'll ignore missing disabled features too...
		lst.forEach(function(n){
			if(!that[n] && n[0] != '-'){
				var m = missing['USER'] = missing['USER'] || []
				m.push(n)
			}
		})

		// include all dependencies...
		//
		// NOTE: this should never fall into an infinite loop as we do 
		// 		not include feature already seen...
		// 		...unless there is an infinite number of features, but 
		// 		I'll try to avoid that big a feature creep.
		// XXX should we check for dependency loops here???
		// 		...this would have been simple if this was a recursion
		// 		(just check if cur is in path), but here it is not 
		// 		trivial...
		for(var i=0; i < lst.length; i++){
			var k = lst[i]

			// skip disabled or missing features....
			if(k[0] == '-' || !that[k]){
				continue
			}

			var deps = that[k].depends || []
			var refs = that[k].suggested || []

			deps.forEach(function(n){
				// expand lst with dependencies....
				lst.indexOf(n) < 0 && lst.push(n)

				// build reverse dependency index...
				var d = dependants[n] = dependants[n] || []
				d.indexOf(k) < 0 && d.push(k)
			})

			// expand lst with suggenstions....
			refs.forEach(function(n){
				lst.indexOf(n) < 0 && lst.push(n)
			})
		}

		// sort features by priority or position...
		lst = lst
			// remove undefined and non-features...
			.filter(function(n){ 
				// feature disabled -> record and skip...
				if(n[0] == '-'){
					disabled.push(n.slice(1))
					return false
				}
				var f = that[n]
				// feature not defined or is not a feature...
				if(f == null || !(f instanceof Feature)){
					return false
				}
				// check applicability...
				if(f.isApplicable && !f.isApplicable.call(that, obj)){
					unapplicable.push(n)
					return false
				}
				return true
			})
			// remove disabled...
			.filter(function(e){ return disabled.indexOf(e) < 0 })
			// build the sort table: [ <priority>, <index>, <elem> ]
			.map(function(e, i){ return [ that[e].getPriority(), i, e ] })
			// do the sort...
			// NOTE: JS compares lists as strings so we have to compare 
			// 		the list manually...
			.sort(function(a, b){ return a[0] - b[0] || a[1] - b[1] })
			// cleanup -- drop the sort table...
			.map(function(e){ return e[2] })

		// remove dependants on not applicable and on disabled...
		var _unapplicable = unapplicable.slice()
		var _disabled = disabled.slice()
		// build the full lists of features to remove...
		_unapplicable
			.forEach(function(n){ _unapplicable = _unapplicable.concat(_buildDepList(n)) })
		_disabled
			.forEach(function(n){ _disabled = _disabled.concat(_buildDepList(n)) })
		// clear...
		// NOTE: in case of intersection disabled has priority...
		lst = lst
			.filter(function(n){
				return _disabled.indexOf(n) >= 0 ?
						disabled.push(n) && false
					: _unapplicable.indexOf(n) >= 0 ?
						unapplicable.push(n) && false
					: true })

		// missing stage 2: dependencies...
		lst.forEach(function(k){
			(that[k].depends || []).forEach(function(d){
				// NOTE: we do not need to check disabled or unapplicable
				// 		here as if the feature depended on dropped feature
				// 		it would have been already dropped too...
				if(!that[k]){
					var m = missing[k] = missing[k] || []
					m.push(d)
				}
			})
		})

		// check exclusive -> excluded...
		//
		// NOTE: this is the right spot for this, just after priority 
		// 		sorting and clearing but before dependency sorting.
		//
		// XXX do we need to clear dependencies pulled by excluded features???
		// 		ways to go:
		// 			- drop excluded and continue (current state)
		// 			- disable excluded, add to original input and rebuild
		// 			- err and let the user decide
		var _exclusive = []
		lst = lst.filter(function(n){
			var e = that[n]

			// keep non-exclusive stuff...
			if(!e || e.exclusive == null){
				return true
			}

			// count the number of exclusive features already present...
			var res = e.exclusive
				.filter(function(n){
					if(_exclusive.indexOf(n) < 0){
						_exclusive.push(n)
						return false
					}
					return true
				})
				.length == 0

			!res 
				&& excluded.push(n)
				// warn the user...
				// XXX not sure if this is the right place for this...
				&& console.warn(
					'Excluding unaplicable:', n, '(reccomended to exclude manually)')

			return res
		})

		// sort by dependency...
		var l = lst.length
		// get maximum possible length...
		// ...the worst case length appears to be (for full reversal):
		// 		S(2*(n-1) + 1)
		// 			S = n => n > 0 ? 2*(n-1)+1 + S(n-1) : 0
		// 			S = n => n > 0 ? 2*n-1 + S(n-1) : 0
		//
		// 		2 * S(n) - n
		// 			S = n => n > 0 ? n + S(n-1) : 0
		// 			f = n => 2 * S(n) - n
		//
		//		N^2 + C
		//			S = n => n * n
		//
		// NOTE: this is the brute force way to check if we have a 
		// 		dependency loop, need something faster...
		//
		// XXX is O(n^2) good enough worst case here?
		// 		...at this point I think it is acceptable as we'll not 
		// 		expect dependency graphs too saturated, and the average 
		// 		complexity is far better...
		var max = l * l

		for(var i=0; i < lst.length; i++){
			var k = lst[i]
			var depends = that[k].depends || []

			// list of dependencies to move...
			var move = []

			lst
				.slice(0, i)
				.forEach(function(n, j){
					// if n is a dependency of k, prepare to move...
					if(depends.indexOf(n) >= 0){
						delete lst[j] 
						move.push(n)
					}
				})

			// move the dependencies after k...
			// NOTE: this will keep the order within the dependencies...
			move.length > 0
				&& lst.splice.apply(lst, [i+1, 0].concat(move))

			// check for cyclic dependencies...
			// XXX loop signs:
			// 		- the tail length stops changing -- we stop progressing to list end
			// 		- the loop is packed
			// 			- each element includes a set of dependencies
			// 			- this set is of the same length when at a specific element
			// 		- we only shift the same set of N elements over N iterations
			// 		- ...
			if(lst.length >= max){
				// XXX get the actual cycle...
				console.error('Feature cyclic dependency...')
				break
			}
		}

		// cleanup after sort...
		lst = lst
			// remove undefined and non-features...
			.filter(function(e){ 
				return that[e] != null && that[e] instanceof Feature })
			.reverse()


		return {
			input: input,

			features: lst,

			disabled: disabled,
			unapplicable: unapplicable,
			excluded: excluded,

			missing: missing,
			conflicts: conflicts,
		}
	},


	//
	//	.setup(<actions>, [<feature>, ...])
	//		-> <actions>
	//
	//	.setup([<feature>, ...])
	//		-> <actions>
	//
	setup: function(obj, lst){
		// if no explicit object is given, just the list...
		if(lst == null){
			lst = obj
			obj = null
		}

		obj = obj || (this.__actions__ || actions.Actions)()

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
		if(this.__verbose__ && features.excluded.length > 0){
			console.warn('Excluded features due to exclusivity conflict:', 
					features.excluded.join(', '))
		}

		// report unapplicable features...
		if(this.__verbose__ && features.unapplicable.length > 0){
			console.log('Features not applicable in current context:', 
					features.unapplicable.join(', '))
		}

		// do the setup...
		var that = this
		var setup = FeatureProto.setup
		lst.forEach(function(n){
			// setup...
			if(that[n] != null){
				this.__verbose__ && console.log('Setting up feature:', n)
				setup.call(that[n], obj)
			}
		})

		// XXX should we extend this if it already was in the object???
		obj.features = features

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


var FeatureSet =
module.FeatureSet = object.makeConstructor('FeatureSet', FeatureSetProto)


//---------------------------------------------------------------------

var Features =
module.Features = new FeatureSet()




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
