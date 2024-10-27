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
var types = require('lib/types')



/*********************************************************************/
// helpers...

// XXX would be nice to list the protocols supported by the action in 
// 		an action attr...
var makeProtocolHandler =
module.makeProtocolHandler =
function(protocol, func){
	return function(id){
		return id.startsWith(protocol + ':')
			&& function(res){ 
				res.set(func.apply(this, [...arguments].slice(1))) }}} 



/*********************************************************************/

// XXX this is a generic API, add ability to define protocols...
// 		Protocols:
// 			- child_process
// 			- PeerJS
// 			- https
// 			- rpc (???)
// 			- mq (???)
// 			- ...
// XXX there seem to be two ways to go with peers:
//		- proxy a set of actions...
//			+ simple
//			- non-transparent in most cases...
//				...considering that all peer calls are async, making this
//				transparent for actions that do not return a promise
//				will be problematic...
//		- custom actions that communicate with a peer...
//			+ no need to be compatible with existing actions
//			- manual...
//		Need to play around with use-cases and see what fits best...
// XXX should/can this do "sync"???
// XXX should the couch api be implemented over this of independently???
var PeerActions = actions.Actions({

	// Format:
	// 	{
	// 		<id>: <spec>,
	// 	}
	//
	// XXX <spec> format???
	// XXX id/url aliases...
	// XXX Q: should peer adapter be a feature that defines/extnds a set 
	// 		of actions???
	// 		...e.g. base peerCreate(..) defines the protocol but does 
	// 		nothing, while each implementation checks if the url is 
	// 		compatible and handles it accordingly...
	__peers: null,

	// XXX need more control...
	// 		- get proxies to specific peer...
	get peeractions(){
		this.cache('peeractions', function(d){
			return d instanceof Array ? d.slice() : this.getPeerActions() }) },

	getPeerActions: ['- System/Peer/',
		function(id){
			var that = this
			return this.actions.filter(id ? 
				function(action){
					return that.getActionAttr(action, '__peer__') == id }
				// get all peer actions...
				: function(action){
					return that.getActionAttr(action, '__peer__') }) }],
	// XXX should this also check props???
	isPeerAction: ['- System/Peer/',
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
	peerConnect: ['- System/Peer/',
		function(id, options){ 
			return new Promise.cooperative() }],
	peerDisconnect: ['- System/Peer/',
		function(id){ 
			return new Promise.cooperative() }],

	// events...
	// XXX do proper docs...
	// XXX do we need these???
	peerConnected: ['- System/Peer/',
		core.Event(function(id){
			// XXX
		})],
	peerDisconnected: ['- System/Peer/',
		core.Event(function(id){
			// XXX
		})],

	// NOTE: .peerCall(..) is just a front-end to .peerApply(..) so there
	// 		is no need to reload it...
	peerCall: ['- System/Peer/',
		function(id, action){
			var args = [...arguments].slice(2)
			return this.peerApply(id, action, args) }],
	peerApply: ['- System/Peer/',
		function(id, action, args){ 
			return new Promise.cooperative() }],

	peerList: ['- System/Peer/',
		function(){ 
			return Object.keys(this.__peers || {}) }],

	// XXX do we need these???
	// XXX format spec!!!
	peerSpec: ['- System/Peer/',
		function(id){
			// XXX
		}],
	peerProxy: ['- System/Peer/',
		function(id, action, target){
			target = target || action

			this[action] = actions.Action.apply(actions.Action, [
				action,
				`- System/Peer/Proxy to action ${target} of peer "${id}"`,
				{ __peer__: true },
				function(){ 
					return this.peerApply(id, target, arguments) },
			]) 
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
	peerConnect: ['- System/Peer/',
		makeProtocolHandler('child', function(id, options){
			return new Promise((function(resolve, reject){
				// already connected...
				// XXX check if child is alive...
				if(this.__peers 
						&& id in this.__peers 
						&& this.__peers[id].peer.connected){
					return resolve(id) }

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
							&& callback(msg.value, msg.error) } }).bind(this))

				resolve(id) }).bind(this)) })],
	// XXX should this call .stop() on the child???
	// 		...does the child handle kill gracefully???
	peerDisconnect: ['- System/Peer/',
		makeProtocolHandler('child', function(id){
			return new Promise((function(resolve, reject){
				var that = this
				// already disconnected...
				if(this.__peers == null || this.__peers[id] == null){
					return resolve(id) 
				}

				// terminate child...
				that.__peers[id].peer.kill()
				delete that.__peers[id]

			}).bind(this)) })],

	// XXX can we do sync???
	// 		...this would be useful to 100% match the action api and 
	// 		make the thing transparent...
	// XXX prop access???
	peerApply: ['- System/Peer/',
		makeProtocolHandler('child', function(id, action, args){
			return new Promise((function(resolve, reject){
				// XXX is this the right way to go???
				var call_id = id +'-'+ Date.now()

				if(this.__peers == null || this.__peers[id] == null){
					return reject(`Peer "${id}" is not connected.`)
				}

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

			}).bind(this)) })],
})


var ChildProcessPeer = 
module.ChildProcessPeer = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'child-process-peer',
	depends: [
		'peer',
	],

	isApplicable: function(){ return this.runtime.node },

	actions: ChildProcessPeerActions, 

	handlers: [
		// XXX check if we are a child and setup communications with the
		// 		parent...
		// 		...checking if child is simple:
		// 			process.send != null // -> child
		['start', 
			function(){
				var that = this

				// XXX do we need to handle stdout/stderr here???
				// XXX need to handle both the child and parent processes...
				// 		...make this reusable...
			
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
								var cur = that
								var prev = that
								msg.action
									.split(/\./g)
									.forEach(function(a){ 
										prev = cur
										cur = cur[a] 
									})

								// do the call...
								//var res = that[msg.action].apply(that, msg.args || [])
								var res = cur.apply(prev, msg.args || [])

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

								// notify parent that we are done...
								// XXX do we actually need this???
								} else {
									process
										.send({
											type: 'action-call-result',
											id: msg.id,
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
