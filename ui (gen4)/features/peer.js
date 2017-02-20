/**********************************************************************
* 
* Setup a node.js child_process communications channel and listen and 
* exec commands...
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

// XXX this is a generic API, add ability to define protocols...
// 		Protocols:
// 			- child_process
// 			- http
// 			- rpc
// 			- mq
// 			- ...
var PeerActions = actions.Actions({

	// Format:
	// 	{
	// 		<id>: <spec>,
	// 	}
	//
	// XXX <spec> format???
	//		...should flow from the protocol definition and architecture...
	__peers: null,

	// XXX need more control...
	// 		- get proxies to specific peer...
	get peeractions(){
		return this.getPeerActions() },

	getPeerActions: ['- Peer/',
		function(id){
			var that = this
			return this.actions.filter(id ? 
				function(action){
					return that.getActionAttr(action, '__peer__') == id }
				// get all peer actions...
				: function(action){
					return that.getActionAttr(action, '__peer__') })
		}],
	// XXX should this also check props???
	isPeerAction: ['- Peer/',
		function(name){
			return !!this.getActionAttr(name, '__peer__') }],

	peerCreate: ['- Peer/',
		function(){
			// XXX
		}],
	peerConnect: ['- Peer/',
		function(){
			// XXX
		}],

	// event...
	peerConnected: ['- Peer/',
		core.notUserCallable(function(id){
			// XXX
		})],
	// event...
	peerDisconnected: ['- Peer/',
		core.notUserCallable(function(id){
			// XXX
		})],

	peerList: ['- Peer/',
		function(){
			// XXX
		}],
	peerSpec: ['- Peer/',
		function(id){
			// XXX
		}],
	peerProxy: ['- Peer/',
		function(id){
			// XXX
		}],

	peerCall: ['- Peer/',
		function(id, action){
			// XXX
		}],
	peerApply: ['- Peer/',
		function(id, action, args){
			// XXX
		}],

	// XXX if no actions are given, proxy all...
	// XXX also proxy descriptors???
	peerMixin: ['- Peer/',
		function(id, actions){
			// XXX
		}],
	// XXX should this be .peerMixout(..)
	peerMixout: ['- Peer/',
		function(id, actions){
			// XXX
		}],
})

var Peer = 
module.Peer = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'child',

	actions: PeerActions, 
})



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
