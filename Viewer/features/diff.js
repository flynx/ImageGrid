/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

// XXX get actual diff path...
var diff = require('lib/diff')

var actions = require('lib/actions')
var features = require('lib/features')

var core = require('features/core')



/*********************************************************************/

// XXX get diff and save new reference state...
var save = function(){
	var res = this.diff()
	this.__reference_state = this.josn()
	return res
}

var load = function(diff){
	// XXX
}



/*********************************************************************/
// XXX we need a separate feature for fs stuff...
// XXX format:
// 		- we should separate:
// 			.data
// 			.images
// 			.collections
// 			...
// 			should we use the same mechanics as the original save/load???

var DiffActions = actions.Actions({
	// XXX this must be read-only...
	__reference_state: null,
	__changes_stack: null,

	diff: [`- System/`,
		// XXX should this get separated diffs or one big diff???
		// 		...i.e. get and arg to filter sections???
		function(){
			return diff.Diff(this.__reference_state, this.json()) }],

	// XXX EXPERIMENTAL -- this can be another way to implement undo or 
	// 		a way to do "pre-save manual undo points"...
	// 		...the problem with undo is that .popChange(..) does not 
	// 		care about what changed and how and will simply reload the 
	// 		whole state...
	// XXX do we need these???
	pushChange: ['- System/',
		core.doc`Create a save point
		`,
		function(){
			var stack = this.__changes_stack = this.__changes_stack || []
			stack.push(save.call(this))
		}],
	popChange: ['- System/',
		core.doc`Restore to a save point
		`,
		function(n){
			var stack = this.__changes_stack || []
			n = n == null ? 
					0
				: (n == 'all' || n == '*') ? 
					stack.length
				: n
			var state = this.josn()
			stack
				&& stack
					.splice(-n-1)
					.forEach(function(d){
						state = d.unpatch(state) })
			// XXX is this the correct way to go???
			this.load(state)
		}],

	// XXX hook into save/load workflows...
	// XXX
})

var Diff = 
module.Diff = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	// XXX
	tag: 'diff',
	depends: [
		// XXX
	],

	actions: FeatureActions, 

	handlers: [],
})




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
