/**********************************************************************
* 
*
*
**********************************************************************/

define(function(require){ var module = {}
console.log('>>> objects')

//var DEBUG = DEBUG != null ? DEBUG : true



/*********************************************************************/


// XXX BUG: if the constructor is called from it's instance this will 
// 		return the instance and not a new object...
var makeConstructor =
module.makeConstructor =
function makeConstructor(name, a, b){
	var proto = b == null ? a : b
	var cls_proto = b == null ? b : a

	var _constructor = function Constructor(){
		/*
		// in case this is called as a function (without new)...
		if(this.constructor !== _constructor){
			// NOTE: the following does the job of the 'new' operator but
			// 		with one advantage, we can now pass arbitrary args 
			// 		in...
			// 		This is equivalent to:
			//			return new _constructor(json)
			var obj = {}
			obj.__proto__ = _constructor.prototype
			// XXX for some reason this does not resolve from .__proto__
			obj.constructor = _constructor
			//obj.__proto__.constructor = _constructor

		} else {
			var obj = this
		}
		*/

		// NOTE: the following does the job of the 'new' operator but
		// 		with one advantage, we can now pass arbitrary args 
		// 		in...
		// 		This is equivalent to:
		//			return new _constructor(json)
		var obj = {}
		obj.__proto__ = _constructor.prototype
		// XXX for some reason this does not resolve from .__proto__
		obj.constructor = _constructor
		//obj.__proto__.constructor = _constructor


		// load initial state...
		if(obj.__init__ != null){
			obj.__init__.apply(obj, arguments)
		}

		return obj
	}

	// this is here to make Chrome output more user friendly...
	// skip for IE...
	if(_constructor.name == 'Constructor'){
			// skip for chrome app...
			//&& !(window.chrome && chrome.runtime && chrome.runtime.id)){
		eval('_constructor = '+ _constructor
				.toString()
				.replace(/Constructor/g, name))
	}

	_constructor.__proto__ = cls_proto
	_constructor.prototype = proto
	_constructor.prototype.constructor = _constructor

	return _constructor
}


// super equivalent...
//
// Example:
// 	superMethod(<class>, <method-name>).call(this, ...)
// 		-> <result>
//
// This will return a next method in inheritance chain after <class> by
// its name (<method-name>).
// In the normal use-case <class> is the current class and <method-name>
// is the name of the current method.
var superMethod =
module.superMethod =
function superMethod(cls, meth){
	return cls.prototype.__proto__[meth]
}


/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
