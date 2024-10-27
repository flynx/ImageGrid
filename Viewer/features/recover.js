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

var RecoverActions = actions.Actions({
	config: {
		'recover-load-errors-to-previous-location': true,
	},

	// Load index with recovery...
	//
	// This will:
	// 	- save recovery data (.__recover)
	// 	- load
	// 	- clear recovery data (if load successful)
	//
	// NOTE: for more info on the load protocol see: base.BaseActions.load 
	load: [
		function(data){
			// prepare to recover, just in case...
			this.__recover = (this.__recover !== false 
					&& this.config['recover-load-errors-to-previous-location']) ? 
				this.location
				: false
			return function(){

				// all went well clear the recovery data...
				delete this.__recover } }],

	// Load data and recover on error... 
	//
	// This is the same as .load(..) but will monitor for load errors 
	// and attempt to recover if it fails...
	//
	// This will return a promise that will resolve if load is successful 
	// and fail if load fails, passing the 'recovered' if recovery was
	// successful and the error if not...
	//
	// NOTE: this avoids load loops by attempting to recover only once...
	// NOTE: this is done as a wrapper because we can't catch errors in
	// 		parent actions at this point...
	loadOrRecover: ['- Location/',
		function(data){
			var that = this
			return new Promise(function(resolve, reject){
				// this is the critical section, after this point we
				// are doing the actual loading....
				try {

					that.load(data)

					resolve(data)

				// something bad happened, clear and handle it...
				} catch(err){
					that.clear()

					console.error(err)

					// recover to last location...
					if(that.__recover){
						that.recover()

						reject('recovered')

					// fail...
					} else {
						// clear the recovery data...
						delete that.__recover

						// fail...
						//throw err
						reject(err) } } }) }],

	// Recover from load error...
	//
	// This will:
	//	- get recovery data if present
	//	- load recovery data
	//	- clear recovery data
	//
	// NOTE: if no recovery data present (.__recover) this will do nothing.
	recover: ['- File/Recover from load error',
		function(){
			var l = this.__recover

			// nothing to recover...
			if(!l){
				delete this.__recover
				return }

			// NOTE: this will prevent us from entering
			// 		a recover attempt loop...
			// 		...if the recovery fails we will just
			// 		clear and stop.
			this.__recover = false

			// do the loading...
			this.location = l }],
})

module.Recovery = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'recover',

	depends: [
		'location',
	],

	actions: RecoverActions,
})



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
