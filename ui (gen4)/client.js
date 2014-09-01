/**********************************************************************
* 
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true

define(function(require){ var module = {}
console.log('>>> client')

doc = require('lib/keyboard').doc

data = require('data')



/*********************************************************************/

// XXX add a callback here...
function proxy(attr, name){
	return function(){
		attr = this[attr]
		attr[name].apply(attr, arguments)
		return this
	}
}

function proxyMethods(obj, map){
	var txt = ''

	for(var attr in map){
		var methods = map[attr]
		for(var name in methods){
			var txt = methods[name]
			if(txt == null){
				obj[name] = proxy(attr, name)
			} else {
				obj[name] = doc(txt, proxy(attr, name))
			}
		}
	}
	return obj
}



/*********************************************************************/

// This will:
// 	- provide an abstraction layer to data (proxy)
// 	- provide API docs usable for doc generation...
// 	- provide callbacks (???)
//
var ClientClassPrototype = {
}



var ClientPrototype = {
	// this expects the folowing attrs:
	//
	// 	.data
	//

	// XXX client-specific API...
	// XXX
}

// setup the proxy methods...
var ClientPrototype = proxyMethods(
	ClientPrototype,
	{
		data: {
			focusImage: 'Focus image',
			focusRibbon: 'Focus ribbon',

			firstImage: 'Focus first image in current ribbon',
			lastImage: 'Focus last image in current ribbon',
		},
	})



/*********************************************************************/


var Client = 
module.Client =
function Client(){
	// in case this is called as a function (without new)...
	if(this.constructor.name != 'Client'){
		return new Client()
	}

	// XXX setup initial state...

	return this
}
Client.__proto__ = ClientClassPrototype
Client.prototype = ClientPrototype
Client.prototype.constructor = Client




/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
