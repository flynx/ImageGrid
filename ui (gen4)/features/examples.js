/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

var actions = require('lib/actions')
var features = require('lib/features')

var core = require('features/core')



/*********************************************************************/

var ExampleActions = actions.Actions({
	config: {
		// XXX stuff for togglers...
	},

	exampleAction: ['- Test/',
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
	// also see corresponding WidgetTest.handlers
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
	exampleToggler: ['- Test/',
		function(){
		}],

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

	// XXX
	tag: 'action-examples',
	depends: [
		// XXX
	],

	actions: ExampleActions, 

	handlers: [],
})




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
