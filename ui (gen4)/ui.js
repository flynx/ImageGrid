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

//require('./cfg/requirejs')


//*
// Setup modules loaded from npm...
//
// XXX for some reason this breaks in browser if run after the if below...
// XXX not sure if this strategy is correct...
// 		...most likely this is not actually a good idea, need to think of
// 		a way of organizing things without so much manual hoop jumping...
var requirejs_cfg = {
	paths: {
		//text: 'node_modules/requirejs-plugins/lib/text',
		//json: 'node_modules/requirejs-plugins/src/json',

		// XXX one approach to avoid at least this section is to copy the
		// 		modules to lib/*, this way we'll need the map section below
		// 		only...	(without automation this also sounds bad)
		'lib/object': './node_modules/ig-object/object',
		'lib/actions': './node_modules/ig-actions/actions',
		'lib/features': './node_modules/ig-features/features',

	},	
	map: {
		'*': {
			// back-refs
			// ...these enable the npm modules reference each other in 
			// a cross-platform manner....
			'ig-object': 'lib/object',
			'ig-actions': 'lib/actions',
			'ig-features': 'lib/features',
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


/*********************************************************************/

$(function(){

	try {
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
					//'-ui-partial-ribbons',
				])

		window.ImageGridFeatures = viewer.ImageGridFeatures

	} catch(err){
		console.error(err)
		return
	}


	// used to switch experimental actions on (set to true) or off (unset or false)...
	//ig.experimental = true


	// report stuff...
	console.log('Loaded features:',
		ig.features.features)
	console.log('Disabled features:', 
		ig.features.disabled)
	console.log('Not applicable features:', 
		ig.features.unapplicable)

	ig.features.excluded.length > 0 
		&& console.warn('Excluded features:',
			ig.features.excluded)

	// NOTE: fatal errors will get reported by setup...
	if(ig.features.error){
		var err = ig.features.error
		err.missing_suggested.length > 0
			&& console.warn('Missing suggested features:', 
				err.missing_suggested)
		err.missing.length > 0
			&& console.warn('Missing dependencies:', 
				err.missing)
	}


	// setup logger...
	// XXX STUB...
	ig.logger = ig.logger || {
		root: true,
		message: null,
		log: null,

		emit: function(e, v){ 
			var msg = this.message
			var log = this.log = this.log || []

			// report progress...
			// XXX HACK -- need meaningful status...
			if(e == 'queued' 
					|| e == 'found'){
				ig.showProgress(msg || ['Progress', e], '+0', '+1')

			} else if(e == 'loaded' || e == 'done' || e == 'written' 
					|| e == 'index'){
				ig.showProgress(msg || ['Progress', e], '+1')

			} else if(e == 'skipping' || e == 'skipped'){
				// XXX if everything is skipped the indicator does not 
				// 		get hidden...
				//ig.showProgress(msg || ['Progress', e], '+0', '-1')
				ig.showProgress(msg || ['Progress', e], '+1')

			// XXX STUB...
			} else if(e == 'error' ){
				ig.showProgress(['Error'].concat(msg), '+0', '+1')
				console.log('    '+ (msg || []).join(': ') + ':', e, v) 

			} else {
				// console...
				console.log('    '+ (msg || []).join(': ') + ':', e, v) 
			}

			// XXX
			//log.push([msg, e, v])
		},

		push: function(msg){
			if(msg == null){
				return this
			}

			var logger = Object.create(this)
			logger.root = false
			logger.message = logger.message == null ? [msg] : logger.message.concat([msg])
			logger.log = this.log = this.log || []

			return logger
		},
		pop: function(){
			return !this.__proto__.root ? this.__proto__ : this	
		},
	}


	// setup the viewer...
	ig
		.load({ viewer: $('.viewer') })
		.on('ready', function(){
			// load some testing data if nothing else loaded...
			if(!this.url_history || Object.keys(this.url_history).length == 0){
				// NOTE: we can (and do) load this in parts...
				this
					.loadDemoIndex()
					// this is needed when loading legacy sources that do not have tags
					// synced...
					// do not do for actual data...
					.syncTags('both')
			}
		})
		.start()
})



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
//})
