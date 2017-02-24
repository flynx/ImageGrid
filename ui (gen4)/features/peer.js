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
// helpers...

// XXX should this parse out the protocol???
// 		...technically we no longer need it....
var makeProtocolHandiler = function(protocol, func){
	return function(id){
		return id.startsWith(protocol + ':')
			&& func.apply(this, arguments) } } 



/*********************************************************************/

// XXX this is a generic API, add ability to define protocols...
// 		Protocols:
// 			- child_process
// 			- PeerJS
// 			- https
// 			- rpc (???)
// 			- mq (???)
// 			- ...
// XXX should this do "sync"???
// XXX should the couch api be implemented over this of independently???
var PeerActions = actions.Actions({

	// Format:
	// 	{
	// 		<id>: <spec>,
	// 	}
	//
	// XXX <spec> format???
	//		...should flow from the protocol definition and architecture...
	// XXX should url and id be the same thing???
	// 		...this might simplify things, and to make things pretty 
	// 		implementing aliases will do the trick...
	// XXX Q: should peer adapter be a feature that defines/extnds a set 
	// 		of actions???
	// 		...e.g. base peerCreate(..) defines the protocol but does 
	// 		nothing, while each implementation checks if the url is 
	// 		compatible and handles it accordingly...
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

	//
	// NOTE: it is the responsibility of the overloading action to trigger
	// 		the appropriate events...
	//
	// XXX should this be sync or async???
	// XXX this should create or connect to a peer depending on protocol...
	// XXX the events should get called on the peer too -- who is 
	// 		responsible for this???
	peerConnect: ['- Peer/',
		function(id, options){ return id }],
	peerDisconnect: ['- Peer/',
		function(id){ }],

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
		function(){ return Object.keys(this.__peers || {}) }],
	// XXX format spec!!!
	peerSpec: ['- Peer/',
		function(id){
			// XXX
		}],
	peerProxy: ['- Peer/',
		function(id){
			// XXX
		}],

	// XXX how should we handler the return value?
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
			var that = this
			var spec = this.peerSpec(id)
			// XXX
			actions = actions || Object.keys(spec.actions)
			actions.forEach(function(action){
				if(that[action]){
					return
				}

				// XXX
				var action_spec = []

				that[action] = actions.Action(action, action_spec)
			})
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

	tag: 'peer',

	actions: PeerActions, 
})




//---------------------------------------------------------------------

// XXX all the return values here will be ignored -- need a way to figure
// 		out a cooperative mechanic to return promises...
var ChildProcessPeerActions = actions.Actions({
	peerConnect: ['- Peer/',
		makeProtocolHandiler('child', function(id, options){
			// XXX need a cooperative way to pass this to the root method return...
			return new Promise((function(resolve, reject){
				// already connected...
				if(id in this.__peers){
					return resolve(id) 
				}

				// XXX run ig.js in child_process + add peer feature to setup...
				// XXX
			}).bind(this))
		})],
	peerDisconnect: ['- Peer/',
		makeProtocolHandiler('child', function(id){
			// XXX need a cooperative way to pass this to the root method return...
			return new Promise((function(resolve, reject){
				// already disconnected...
				if(this.__peers[id] == null){
					return resolve(id) 
				}

				// trigger stop...
				this.peerCall(id, 'stop')
					.then(function(){
						// XXX terminate child...
						// XXX
					})
			}).bind(this))
		})],

	peerCall: ['- Peer/',
		makeProtocolHandiler('child', function(id, action){
			// XXX need a cooperative way to pass this to the root method return...
			return new Promise((function(resolve, reject){
				// XXX
			}).bind(this))
		})],
	peerApply: ['- Peer/',
		makeProtocolHandiler('child', function(id, action, args){
			// XXX need a cooperative way to pass this to the root method return...
			return new Promise((function(resolve, reject){
				// XXX
			}).bind(this))
		})],
})


var ChildProcessPeer = 
module.ChildProcessPeer = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'child-process-peer',
	depends: [
		'peer',
	],

	isApplicable: function(){ 
		return this.runtime == 'nw' || this.runtime == 'node' },

	actions: ChildProcessPeerActions, 
})




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
