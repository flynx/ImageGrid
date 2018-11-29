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


// Setup requirejs if we are in node/nw...
//
// NOTE: no need to do this in browser...
if(typeof(process) != 'undefined'){
	//require('v8-compile-cache')

	requirejs = 
	global.requirejs = 
	window.requirejs = 
		// XXX for some reason we can't just use the browser requirejs 
		// 		even if we pass it nodeRequire, it still can't pass the
		// 		node stuff to node...
		require('requirejs')

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

	try {
		// setup actions...
		window.ig = 
		window.ImageGrid = 
			viewer.ImageGridFeatures
				.setup([
					'imagegrid-testing',

					'demo',

					// XXX this is not for production...
					'experiments',

					//'-commandline',
					//'-ui-partial-ribbons',
				])

		window.ImageGridFeatures = viewer.ImageGridFeatures

	} catch(err){
		console.error(err)
		//throw err
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
				console.log(msg ? 
					'    '+ msg.join(': ') + ':' 
					: '', ...arguments) 

			} else {
				// console...
				console.log(msg ? 
					'    '+ msg.join(': ') + ':' 
					: '', ...arguments) 
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
		/* XXX load the intro index...
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
		//*/
		.start()
})



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
//})
