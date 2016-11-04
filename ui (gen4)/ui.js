/**********************************************************************
* 
*
*
**********************************************************************/
// Pre-setup...

// Add node_modules path outside of the packed nwjs code...
//
// This keeps the large node module set outside the zip thus speeding
// up the loading process significantly...
if((typeof(process) != 'undefined' ? process : {}).__nwjs){
	var path = require('path')
	require('app-module-path')
		.addPath(path.dirname(process.execPath) + '/node_modules/')
}

//*
// Setup modules loaded from npm...
//
// XXX for some reason this breaks in browser if run after the if below...
// XXX not sure if this strategy is correct...
// 		...most likely this is not actually a good idea, need to think of
// 		a way of organizing things without so much manual hoop jumping...
var requirejs_cfg = {
	paths: {
		// XXX one approach to avoid at least this section is to copy the
		// 		modules to lib/*, this way we'll need the map section below
		// 		only...	(without automation this also sounds bad)
		'lib/object': './node_modules/ig-object/object',
		'lib/actions': './node_modules/ig-actions/actions',
		'lib/features': './node_modules/ig-features/features',

		//'lib/keyboard': './node_modules/ig-keyboard/keyboard',
	},	
	map: {
		'*': {
			// back-refs
			// ...these enable the npm modules reference each other in 
			// a cross-platform manner....
			'ig-object': 'lib/object',
			'ig-actions': 'lib/actions',
			'ig-features': 'lib/features',

			//'ig-keyboard': 'lib/keyboard',
		},
	},
}
// config the browser version of requirejs...
requirejs.config(requirejs_cfg)
//*/

// Setup requirejs if we are in node/nw...
//
// NOTE: no need to do this in browser...
//
// XXX this will create a second requirejs instance with node 
// 		compatibility...
// 		...would be nice if we could avoid this...
// XXX setting nodeRequire on existing requirejs will change how 
// 		everything is loaded...
if(typeof(process) != 'undefined'){
	requirejs = 
	global.requirejs = 
	window.requirejs = 
		// XXX for some reason we can't just use the browser requirejs 
		// 		even if we pass it nodeRequire, it still can't pass the
		// 		node stuff to node...
		require('requirejs')

	// config the node version of requirejs...
	requirejs.config(requirejs_cfg)

	nodeRequire =
	global.nodeRequire = 
	window.nodeRequire =
		require
}





/*********************************************************************/
(typeof(define)[0]=='u'?function(f){module.exports=f(require)}:define)(
function(require){ var module={} // makes module AMD/node compatible...
/*********************************************************************/

var viewer = require('imagegrid/viewer')



/*********************************************************************/

$(function(){

	// list all loaded modules...
	var m = requirejs.s.contexts._.defined
	m = Object.keys(m).filter(function(e){ return m[e] != null })
	console.log('Modules (%d):', m.length, m)


	// setup actions...
	window.ig = 
	window.ImageGrid = 
		viewer.ImageGridFeatures
			.setup([
				'viewer-testing',

				'demo',

				// XXX this is not for production...
				'experiments',

				//'-commandline',

				// XXX BUG: disabling features on this level does not 
				// 		work, yet works deeper down...
				// 			Example:
				// 				'-ui' // will throw an error:
				// 					  //	Feature "-ui" not loaded...
			])


	// used to switch experimental actions on (set to true) or off (unset or false)...
	//ig.experimental = true


	// report stuff...
	// XXX we also have .conflicts and .missing
	ig.features.excluded.length > 0 
		&& console.warn('Features excluded (%d):',
			ig.features.excluded.length, 
			ig.features.excluded)
	ig.features.disabled.length > 0 
		&& console.log('Features disabled (%d):',
			ig.features.disabled.length, 
			ig.features.disabled)
	console.log('Features not applicable (%d):', 
		ig.features.unapplicable.length, 
		ig.features.unapplicable)
	console.log('Features loaded (%d):',
		ig.features.features.length, 
		ig.features.features)

	// XXX STUB...
	ig.logger = ig.logger || {
		root: true,
		message: null,

		emit: function(e, v){ 
			var msg = this.message

			// console...
			console.log('    '+ ((msg && msg.concat('')) || []).join(': '), e, v) 
			
			// progress...
			// XXX HACK -- need meaningful status...
			if(e == 'queued' 
					|| e == 'found'){
				ig.showProgress(msg || ['Progress', e], '+0', '+1')

			} else if(e == 'loaded' || e == 'done' || e == 'written' 
					|| e == 'skipping' || e == 'index'){
				ig.showProgress(msg || ['Progress', e], '+1')
			}
		},

		push: function(msg){
			if(msg == null){
				return this
			}

			var logger = Object.create(this)
			logger.root = false
			logger.message = logger.message == null ? [msg] : logger.message.concat([msg])

			return logger
		},
		pop: function(){
			return !this.__proto__.root ? this.__proto__ : this	
		},
	}


	// setup the viewer...
	ig
		.load({ viewer: $('.viewer') })
		.start()


	// load some testing data if nothing else loaded...
	if(!ig.url_history || Object.keys(ig.url_history).length == 0){
		// NOTE: we can (and do) load this in parts...
		ig.loadDemoIndex()

			// this is needed when loading legacy sources that do not have tags
			// synced...
			// do not do for actual data...
			//.syncTags()
	}
})



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
//})
