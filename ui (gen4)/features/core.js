/**********************************************************************
* 
* Core features that setup the life-cycle and the base interfaces for 
* features to use...
*
*
**********************************************************************/

define(function(require){ var module = {}

//var DEBUG = DEBUG != null ? DEBUG : true

var actions = require('lib/actions')
var features = require('lib/features')



/*********************************************************************/

var ImageGridFeatures =
module.ImageGridFeatures = Object.create(features.FeatureSet)


// setup exit...
if(typeof(process) != 'undefined'){

	// NOTE: if this passes it is async while when fails it's sync, this
	// 		is why we set .runtime to 'nw' optimistically in advance so 
	// 		as not to wait if all goes well and set it to 'node' in the 
	// 		callback that if fails will fail right away...
	ImageGridFeatures.runtime = 'nw'
	requirejs(['nw.gui'], 
		// OK: nw.js
		function(){}, 
		// ERR: pure node.js...
		function(){ ImageGridFeatures.runtime = 'node' })

// browser...
} else if(typeof(window) != 'undefined'){
	ImageGridFeatures.runtime = 'browser'

// unknown...
} else {
	ImageGridFeatures.runtime = 'unknown'
}



/*********************************************************************/

// XXX should this be a generic library thing???
// XXX should his have state???
// 		...if so, should this be a toggler???
var LifeCycleActions = actions.Actions({
	start: ['- System/', 
		function(){
			var that = this
			this.logger && this.logger.emit('start')

			// NOTE: jQuery currently provides no way to check if an event
			// 		is bound so we'll need to keep track manually...
			if(this.__stop_handler == null){
				var stop = this.__stop_handler = function(){ that.stop() }

			} else {
				return
			}

			// set the runtime...
			var runtime = this.runtime = ImageGridFeatures.runtime

			// nw.js...
			if(runtime == 'nw'){
				var gui = requirejs('nw.gui')

				// this handles both reload and close...
				$(window).on('beforeunload', stop)

				// NOTE: we are using both events as some of them do not
				// 		get triggered in specific conditions and some do,
				// 		for example, this gets triggered when the window's
				// 		'X' is clicked while does not on reload...
				this.__nw_stop_handler = function(){
					var w = this
					try{
						that
							// wait till ALL the handlers finish before 
							// exiting...
							.on('stop.post', function(){
								w.close(true)
							})
							.stop()

					// in case something breaks exit...
					// XXX not sure if this is correct...
					} catch(e){
						this.close(true)
					}
				}
				gui.Window.get().on('close', this.__nw_stop_handler)


			// node.js...
			} else if(runtime == 'node'){
				process.on('exit', stop)

			// browser...
			} else if(runtime == 'browser'){
				$(window).on('beforeunload', stop)

			// other...
			} else {
				// XXX
			}
		}],
	// unbind events...
	stop: ['- System/', 
		function(){
			// browser & nw...
			if(this.__stop_handler 
					&& (this.runtime == 'browser' || this.runtime == 'nw')){
				$(window).off('beforeunload', this.__stop_handler)
			}

			// nw...
			if(this.__nw_stop_handler && this.runtime == 'nw'){
				var gui = requirejs('nw.gui')
				gui.Window.get().off('close', this.__nw_stop_handler)
				delete this.__nw_stop_handler
			}

			// node...
			/* XXX there's no process.off(...)
			if(this.__stop_handler && this.runtime == 'node'){
				process.off('exit', this.__stop_handler)
			}
			*/

			delete this.__stop_handler

			this.logger && this.logger.emit('stop')
		}],

	/*
	// XXX need a clear protocol for this...
	// 		something like:
	// 			- clear state
	// 			- load state
	reset: ['System/',
		function(){
		}],
	*/
})

var LifeCycle = 
module.LifeCycle = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'lifecycle',

	actions: LifeCycleActions,
})




/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
