/**********************************************************************
* 
*
*
**********************************************************************/

define(function(require){ var module = {}
console.log('>>> viewer')

//var DEBUG = DEBUG != null ? DEBUG : true

var actions = require('lib/actions')

var data = require('data')
var ribbons = require('ribbons')


/*********************************************************************/
//
// XXX Tasks to accomplish here:
// 	- life-cycle actions/events
// 		- setup
// 		- reset
// 	- "features" and the mechanism to turn them on or off (action-sets)
//
//

var Client = 
module.Client = 
actions.Actions({
	// basic life-cycle actions...
	load: [
		function(d){
			this.data = data.Data(d.data)
		}],
	clear: [
		function(){
			delete this.data
		}],


	focusImage: ['Focus image',
		function(img){
			this.data.focusImage(img)
		}],
	focusRibbon: ['Focus Ribbon',
		function(target){
			var data = this.data
			var r = data.getRibbon(target)
			var t = data.getImage('current', r)
			// XXX is there a 'last' special case???
			t = t == null ? data.getImage('first', r) : t

			this.focusImage(t, r)
		}],

	// shorthands for .focusImage(..) and .focusRibbon(..)...
	firstImage: ['Focus first image in current ribbon',
		function(){ this.focusImage('first') }],
	lastImage: ['Focus last image in current ribbon',
		function(){ this.focusImage('last') }],

	prevImage: ['Focus previous image',
		function(){ this.focusImage('prev') }],
	nextImage: ['Focus next image',
		function(){ this.focusImage('next') }],

	firstRibbon: ['Focus previous ribbon',
		function(){ this.focusRibbon('fisrt') }],
	lastRibbon: ['Focus next ribbon',
		function(){ this.focusRibbon('last') }],

	prevRibbon: ['Focus previous ribbon',
		function(){ this.focusRibbon('before') }],
	nextRibbon: ['Focus next ribbon',
		function(){ this.focusRibbon('after') }],

})


// XXX do partial loading...
var Viewer = 
module.Viewer = 
actions.Actions(Client, {
	load: [
		function(data){
			// recycle the viewer...
			var viewer = data.viewer
			viewer = viewer == null && this.ribbons != null 
				? this.ribbons.viewer 
				: viewer

			this.ribbons = ribbons.Ribbons(viewer, data.images)

			return function(){
				// XXX do a partial load...
				this.ribbons.updateData(this.data)
				this.focusImage()
			}
		}],
	clear: [
		// XXX do we need to delete the ribbons???
		function(){
			this.ribbons.clear()
			delete this.ribbons
		}],


	focusImage: [
		// XXX skip invisible ribbons (???)
		// XXX load data chunks...
		function(target){
			var ribbons = this.ribbons
			var data = this.data

			if(data != null){
				var gid = data.getImage(target)
				gid = gid == null ? data.getImage('current') : gid

				// XXX see if we need to load a new data set...
				// XXX
		
				target = ribbons.focusImage(gid)

			} else {
				target = ribbons.focusImage(target)
				var gid = ribbons.getElemGID(target)
			}

			// align current ribbon...
			ribbons
				.centerRibbon(target)
				.centerImage(target)

			// align other ribbons...
			if(data != null){
				var ribbon = data.getRibbon(gid)
				for(var r in data.ribbons){
					// skip the current ribbon...
					if(r == ribbon){
						continue
					}

					// XXX skip off-screen ribbons...
					// XXX

					// center...
					// XXX is there a 'last' special case here???
					var t = data.getImage(gid, r)
					if(t == null){
						ribbons.centerImage(data.getImage('first', r), 'before')
					} else {
						ribbons.centerImage(t, 'after')
					}
				}
			}
		}],

	// XXX
	prevScreen: ['Focus previous image one screen width away',
		function(){
		}],
	// XXX
	nextScreen: ['Focus next image one screen width away',
		function(){
		}],
})



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
