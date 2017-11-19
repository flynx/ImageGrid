/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

var toggler = require('lib/toggler')
var actions = require('lib/actions')
var features = require('lib/features')

var core = require('features/core')



/*********************************************************************/

var ExampleActions = actions.Actions({
	config: {
		// XXX stuff for togglers...
	},

	// NOTE: the path / short doc is optional but it is not recommended 
	// 		to to omit it unless defining a non-root action...
	// XXX should an action be able to overload the doc???
	// 		...the intuitive thing to do here is make the doc "write-once"
	// 		i.e. once defined it can't be overwritten...
	exampleAction: ['- Test/',
		function(){
			// XXX
		}],
	exampleActionFull: ['- Test/',
		core.doc`Example full action long documentation string
		`,
		// action attributes...
		{},
		function(){
			// XXX
		}],

	// a normal method...
	exampleMethod: function(){
		console.log('example method:', [].slice.call(arguments))
		return 'example result'
	},

	// XXX does not work -- see actions.Actions(..) for details...
	exampleAlias: ['Test/Action alias',
		'focusImage: "prev"'],

	// action constructor for testing...
	makeExampleAction: ['- Test/',
		function(name){
			this[name] = actions.Action.apply(actions.Action, arguments) }],

	// promise handling...
	//
	// also see corresponding Example.handlers
	exampleSyncAction: ['- Test/',
		//{await: true},
		function(t){
			return new Promise(function(resolve){
				setTimeout(function(){ resolve() }, t || 1000) })
		}],
	exampleAsyncAction: ['- Test/',
		{await: false},
		function(t){
			return new Promise(function(resolve){
				setTimeout(function(){ resolve() }, t || 1000) })
		}],

	// Togglers...
	//
	// XXX add example argument handling...
	exampleToggler: ['- Test/',
		toggler.Toggler(null, 
			// state accessor...
			function(_, state){ 
				// get the state...
				if(state == null){
					return this.__example_toggler_state || 'none'

				// handle state changing...
				} else if(state == 'none'){
					delete this.__example_toggler_state

				} else {
					this.__example_toggler_state = state
				}
			},
			// List of states...
			// NOTE: this can be a string for bool states and a list for
			// 		togglers with multiple states...
			'A')],
	exampleTogglerFull: ['- Test/',
		toggler.Toggler(null, 
			// state accessor...
			function(_, state){ 
				// get the state...
				if(state == null){
					return this.__example_toggler_state || 'A'

				} else if(state == 'A'){
					delete this.__example_toggler_state

				} else {
					this.__example_toggler_state = state
				}
			},
			// List of states...
			['A', 'B', 'C'],
			// pre-callback (optional)
			function(){
				console.log('Changing state from:', this.exampleTogglerFull('?'))
			},
			// post-callback...
			function(){
				console.log('Changing state to:', this.exampleTogglerFull('?'))
			})],

	// XXX docs...
	// XXX BUG? false is not shown in the dialog button...
	exampleConfigTogglerMin: ['- Test/',
		core.doc`Minimal config toggler...

			This will toggle between true and false.
			`,
		core.makeConfigToggler('example-option-min')],
	// XXX docs...
	exampleConfigToggler: ['- Test/',
		core.makeConfigToggler(
			// option name...
			'example-option',
			// option states...
			//
			// NOTE: 'none' represents an undefined value, but when 
			// 		setting 'none' state, 'none' is explicitly written as
			// 		option value.
			// 		This is done intentionally as deleting the attribute
			// 		can expose the shadowed option value.
			['A', 'B', 'C', 'none'],
			// post-callback (optional)...
			function(state){
				console.log('exampleConfigToggler: callback: shifting state to:', state)
			})],
	// XXX docs...
	exampleConfigTogglerFull: ['- Test/',
		core.makeConfigToggler(
			// option name...
			'example-option-full',
			// option states...
			function(){
				return ['A', 'B', 'C', 'none']
			},
			// pre-callback...
			function(state){
				if(state == 'C'){
					console.log('exampleConfigToggler: pre-callback: preventing shift to:', state)
					// we can prevent a state change by returning false...
					// XXX should we be able to return a different state here???
					return false
				}

				console.log('exampleConfigToggler: pre-callback: shifting state to:', state)
			},
			// post-callback...
			function(state){
				console.log('exampleConfigToggler: post-callback: shifting state to:', state)
			})],

	// XXX move this to a ui-dependant feature...
	exampleCSSClassToggler: ['- Test/',
		function(){
		}],

	// XXX event and event use...
	
	// XXX inner/outer action...

})

var Example = 
module.Example = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'action-examples',
	depends: [
	],

	actions: ExampleActions, 

	// XXX make this not applicable in production...

	handlers: [
		['exampleAsyncAction.pre exampleSyncAction.pre',
			function(){
				console.log('PRE')
				return function(){
					console.log('POST') } 
			}],
	],
})




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
