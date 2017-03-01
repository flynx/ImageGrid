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

if(typeof(process) != 'undefined'){
	var child_process = requirejs('child_process')
}

var actions = require('lib/actions')
var features = require('lib/features')

var core = require('features/core')

var object = require('lib/object')



/*********************************************************************/
// helpers...

// Cooperative promise object...
// 
// This is like a promise but is not resolved internally, rather this 
// resolves (is set) via a different promise of value passed to it via 
// the .set(..) method...
// 
// Example:
// 	// create a promise...
// 	var p = (new CooperativePromise())
// 		// bind normally...
// 		.then(function(){ .. })
// 		
// 	// this will resolve p and trigger all the .then(..) callbacks...
// 	p.set(new Promise(function(resolve, reject){ resolve() }))
// 	
// Note that .set(..) can be passed any value, passing a non-promise has
// the same effect as passing the same value to resolve(..) of a Promise
// object...
// 
// XXX should this be a separate package???
// XXX can we make this an instance of Promise for passing the
// 		x instanceof Promise test???
var CooperativePromisePrototype = {
	__base: null,
	__promise: null,

	// XXX error if already set...
	set: function(promise){
		if(this.__promise == null){
			// setting a non-promise...
			if(promise.catch == null && promise.then == null){
				Object.defineProperty(this, '__promise', {
					value: false,
					enumerable: false,
				})
				this.__resolve(promise)
				
			// setting a promise...
			} else {
				Object.defineProperty(this, '__promise', {
					value: promise,
					enumerable: false,
				})

				// connect the base and the set promises...
				promise.catch(this.__reject.bind(this))
				promise.then(this.__resolve.bind(this))

				// cleanup...
				delete this.__base
			}

			// cleanup...
			delete this.__resolve
			delete this.__reject

		} else {
			// XXX throw err???
			console.error('Setting a cooperative promise twice', this)
		}
	},

	// Promise API...
	catch: function(func){
		return (this.__promise || this.__base).catch(func) },
	then: function(func){
		return (this.__promise || this.__base).then(func) },

	__init__: function(){
		var that = this
		var base = new Promise(function(resolve, reject){
			Object.defineProperties(that, {
				__resolve: {
					value: resolve,
					enumerable: false,
					configurable: true,
				},
				__reject: {
					value: reject,
					enumerable: false,
					configurable: true,
				},
			})
		})

		Object.defineProperty(this, '__base', {
			value: base,
			enumerable: false,
			configurable: true,
		})
	},
}

var CooperativePromise =
module.CooperativePromise =
object.makeConstructor('CooperativePromise', 
	Promise,
	CooperativePromisePrototype)


//---------------------------------------------------------------------
	
// XXX would be nice to list the protocols supported by the action in 
// 		an action attr...
var makeProtocolHandler =
module.makeProtocolHandler =
function(protocol, func){
	return function(id){
		return id.startsWith(protocol + ':')
			&& function(res){ 
				res.set(func.apply(this, [].slice.call(arguments, 1))) }}} 



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
		function(id, options){ return new CooperativePromise() }],
	peerDisconnect: ['- Peer/',
		function(id){ return new CooperativePromise() }],

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

	peerCall: ['- Peer/',
		function(id, action){ return new CooperativePromise() }],
	peerApply: ['- Peer/',
		function(id, action, args){ return new CooperativePromise() }],

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
	suggested: [
		'child-process-peer',
	],

	actions: PeerActions, 
})




//---------------------------------------------------------------------

// XXX all the return values here will be ignored -- need a way to figure
// 		out a cooperative mechanic to return promises...
var ChildProcessPeerActions = actions.Actions({
	// XXX do better message handling...
	peerConnect: ['- Peer/',
		makeProtocolHandler('child', function(id, options){
			return new Promise((function(resolve, reject){
				// already connected...
				// XXX check if child is alive...
				if(this.__peers 
						&& id in this.__peers 
						&& this.__peers[id].peer.connected){
					return resolve(id) 
				}

				this.__peers = this.__peers || {}

				var p = this.__peers[id] = {
					id: id,
					peer: child_process.fork('ig.js'),
				}
				var peer = p.peer

				// XXX setup message handlers...
				// 		...should be about the same as in setup below...
				// XXX use a standard handler....
				peer.on('message', (function(msg){
					if(msg.type == 'action-call-result'){
						var callback = (this.__peer_result_callbacks || {})[msg.id]

						callback 
							&& (delete this.__peer_result_callbacks[msg.id])
							&& callback(msg.value, msg.error)
					}
				}).bind(this))

				resolve(id)
			}).bind(this))
		})],
	peerDisconnect: ['- Peer/',
		makeProtocolHandler('child', function(id){
			return new Promise((function(resolve, reject){
				var that = this
				// already disconnected...
				if(this.__peers[id] == null){
					return resolve(id) 
				}

				// terminate child...
				that.__peers[id].peer.kill()
				delete that.__peers[id]

			}).bind(this))
		})],

	peerCall: ['- Peer/',
		makeProtocolHandler('child', function(id, action){
			return new Promise((function(resolve, reject){
				// XXX
			}).bind(this))
		})],
	peerApply: ['- Peer/',
		makeProtocolHandler('child', function(id, action, args){
			return new Promise((function(resolve, reject){
				// XXX is this the right way to go???
				var call_id = id +'-'+ Date.now()

				// do the call...
				this.__peers[id].peer.send({
					id: call_id, 
					type: 'action-call',
					action: action,
					args: args,
				})

				// handle return value...
				var handlers = this.__peer_result_callbacks = this.__peer_result_callbacks || {}
				handlers[call_id] = function(res, err){ err ? reject(err) : resolve(res) }

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

	handlers: [
		// XXX check if we are a child and setup communications with the
		// 		parent...
		['start', 
			function(){
				var that = this

				// XXX do we need to handle stdout/stderr here???

				// XXX need to handle both the child and parent processes...
				process.on('message', function(msg){
					// Handle action call...
					//
					// Format:
					// 	{
					// 		type: 'action-call',
					//
					// 		id: <id>,
					//
					// 		action: <action-name>,
					//
					// 		args: [<arg>, .. ] | null,
					//
					// 		ignore_return: <bool>,
					// 	}
					if(msg.type == 'action-call' && msg.action in that){
						if(msg.action in that){
							try{
								// do the call...
								var res = that[msg.action].apply(that, msg.args || [])

								// XXX check if res is a promise/promise-like...

								// return the value...
								if(!msg.ignore_return){
									res.then ?
										// promise result...
										res
											.then(function(res){
												process.send({
													type: 'action-call-result',
													id: msg.id,
													value: res,
												})
											})
											.catch(function(err){
												process.send({
													type: 'action-call-result',
													id: msg.id,
													error: err,
												})
											})
										// normal result...
										: process
											.send({
												type: 'action-call-result',
												id: msg.id,
												value: res === that ? null : res,
											})
								}

							// error...
							} catch(err){
								process.send({
									type: 'action-call-result',
									id: msg.id,
									// XXX is this serializable???
									error: err,
								})
							}

						// error: action does not exist...
						} else {
							process.send({
								type: 'action-call-result',
								id: msg.id,
								error: `Action "${msg.action}" does not exist.`,
							})
						}
						
					// Handle action call result...
					// 
					// Format:
					// {
					// 		type: 'action-call-result',
					// 		id: <id>,
					// 		value: <object> | null,
					// }
					} else if(msg.type == 'action-call-result'){
						var callback = (this.__peer_result_callbacks || {})[msg.id]

						callback 
							&& (delete this.__peer_result_callbacks[msg.id])
							&& callback(msg.value, msg.error)

					// Handle logger calls...
					// 
					// Format:
					// 	{
					// 		type: 'logger-emit',
					// 		value: [ .. ],
					// 	}
					} else if(msg.type == 'logger-emit' && this.logger){
						this.logger.emit.apply(this.logger, msg.value)
					}
				})
			}],
	],
})




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
