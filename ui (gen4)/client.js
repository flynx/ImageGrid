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

// attr can be:
// 	"name"		- attribute name
// 	"name, name, ..."
// 				- string containign coma separated attribute names
// 	list 		- list of attribute names
//
// XXX add a callback here...
function proxy(attr, name){
	// we can proxy multiple attrs...
	attr = typeof(attr) == typeof('str') 
		? attr.split(',').map(function(e){ return e.trim() })
		: attr
	return function(){
		var that = this
		var args = arguments
		attr.forEach(function(a){
			a = that[a]
			a[name].apply(a, args)
		})
		return this
	}
}

function proxyMethods(obj, map){
	var txt = ''
	map = map == null ? obj : map

	for(var attr in map){
		var methods = map[attr]
		methods = typeof(methods) == typeof('str') ? {attr: methods} : methods
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

	// direct proxy methods...
	focusImage: 'Focus image',
	focusRibbon: 'Focus ribbon',

	firstImage: 'Focus first image in current ribbon',
	lastImage: 'Focus last image in current ribbon',

	// XXX client-specific API...
	// XXX
}
// XXX this is temporary...
// 		...this will messup actual methods...
proxyMethods(ClientPrototype)



// XXX auto apply this...
function chainSelfAttrMethods(cls, attr, meth){
		return function(){
			// NOTE: this is super, python-style but without multiple 
			// 		inheritance...
			// 		...that last part makes this more of a code reuse 
			// 		than a programming tool...
			cls.__proto__[meth].apply(this, arguments)
			// call the encapsulated method...
			this[attr][meth].apply(this[attr], arguments)
			return this
		}),
}


var ViewerPrototype = {
	// this expects the folowing attrs:
	//
	// 	.ribbons
	//

	focusImage: doc('Focus image', 
		chainSelfAttrMethods(ViewerPrototype, 'ribbons', 'focusImage')),
	focusRibbon: doc('Focus ribbon',
		chainSelfAttrMethods(ViewerPrototype, 'ribbons', 'focusRibbon')),

}
ViewerPrototype.__proto__ = ClientPrototype



var Client =
module.Client = Object.create(ClientPrototype)

var Viewer =
module.Viewer = Object.create(ViewerPrototype)



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
