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
// 			- rpc/mq
var PeerActions = actions.Actions({

	// XXX need more control...
	// 		- get proxies to specific peer...
	get peeractions(){
		return this.getPeerActions() },

	getPeerActions: ['- Peer/',
		function(id){
			// XXX
		}],

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
		core.notUserCallable(function(){
			// XXX
		}],
	// event...
	peerDisconnected: ['- Peer/',
		core.notUserCallable(function(){
			// XXX
		}],

	peerList: ['- Peer/',
		function(){
			// XXX
		}],
	peerSpec: ['- Peer/',
		function(){
			// XXX
		}],
	peerProxy: ['- Peer/',
		function(){
			// XXX
		}],

	peerCall: ['- Peer/',
		function(){
			// XXX
		}],
	peerApply: ['- Peer/',
		function(){
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
