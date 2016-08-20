/**********************************************************************
* 
*
*
**********************************************************************/
(typeof(define)[0]=='u'?function(f){module.exports=f(require)}:define)(
function(require){ var module={} // makes module AMD/node compatible...
/*********************************************************************/



/*********************************************************************/


// Make a JavaScrip object constructor...	
//
//
// 	Make a constructor with an object prototype...
// 		makeConstructor(<name>, <proto>)
// 			-> constructor
//
// 	Make a constructor with an init function prototype...
// 		makeConstructor(<name>, <init-func>)
// 			-> constructor
//
// 	Make a constructor with a prototype (object/function) and a class
// 	prototype...
// 		makeConstructor(<name>, <proto>, <class-proto>)
// 		makeConstructor(<name>, <init-func>, <class-proto>)
// 			-> constructor
// 			NOTE: the <class-proto> defines a set of class methods and 
// 					attributes.
//
//
//
// The resulting constructor can produce objects in one of these ways:
//
// 	Basic constructor use...
// 		constructor()
// 		new constructor
// 		new constructor()
// 			-> instance
//
// 	Pass arguments to the constructor...
// 		constructor(<arg>[, ...])
// 		new constructor(<arg>[, ...])
// 			-> instance
//
//
// All produced objects are instances of the constructor
// 		instance instanceof constructor
// 			-> true
//
//
//
// Init protocol:
// 	1) the base instance object is prepared (.__proto__ is set)
// 	2) if <init-func> is present, then it is called with instance as 
// 		context and passed the constructor arguments
// 	3) if <proto>.__init__(..) is present, it is called with the instance
// 		as context and passed the constructor arguments.
//
//
//
// Inheritance:
// 	A simple way to build C -> B -> A chain would be:
//
// 		var A = makeConstructor('A', {})
//
// 		// NOTE: the prototype is an instance and not a constructor,
// 		//		this is obvious if one considers that in JS there are
// 		//		no classes and inheritance is done via object prototypes
// 		//		but this might be a gotcha to people coming from the 
// 		//		class-object world.
// 		var B = makeConstructor('B', A())
//
// 		var C = makeConstructor('C', B())
//
// 		var c = C()
//
// 		c instanceof C		// -> true
// 		c instanceof B		// -> true
// 		c instanceof A		// -> true
//
// 		A.prototype.x = 123
//
// 		c.x 				// -> 123
//
//
//
// Motivation:
// 	The general motivation here is to standardise the constructor protocol
// 	and make a single simple way to go with minimal variation. This is due
// 	to the JavaScript base protocol though quite simple, being too flexible
// 	making it very involved to produce objects in a consistent manner by 
// 	hand, especially in long running projects, in turn spreading all the 
// 	refactoring over multiple sites and styles.
//
// 	This removes part of the flexibility and in return gives us:
// 		- single, well defined protocol
// 		- one single spot where all the "magic" happens
// 		- full support for existing JavaScript ways of doing things
// 		- easy refactoring without touching the client code
//
//
// NOTE: this sets the proto's .constructor attribute, this rendering it
// 		not reusable, to use the same prototype for multiple objects clone
// 		it via. Object.create(..) or copy it...
//
// XXX might be a good idea to be able to make an instance without 
// 		initializing it...
// 		...mainly for inheritance.
// 		...would also be helpful in this case to call all the 
// 		constructors in the chain
var makeConstructor =
module.makeConstructor =
function makeConstructor(name, a, b){
	var proto = b == null ? a : b
	var cls_proto = b == null ? b : a

	var _constructor = function Constructor(){
		/*
		// XXX BUG: if the constructor is called from it's instance this will 
		// 		return the instance and not a new object...
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
		// XXX this also is a regular attr and not a prop...
		//obj.constructor = _constructor
		Object.defineProperty(obj, 'constructor', {
			value: _constructor,
			enumerable: false,
		})
		//obj.__proto__.constructor = _constructor

		// explicit init...
		if(proto instanceof Function){
			proto.apply(obj, arguments)
		}

		// load initial state...
		if(obj.__init__ != null){
			obj.__init__.apply(obj, arguments)
		}

		return obj
	}

	/* XXX for some reason this works for the _constructor but all 
	 * 		instances get the wrong name resolved...
	Object.defineProperty(_constructor, 'name', {
		value: name,
	})
	*/

	// just in case the browser refuses to change the name, we'll make it
	// a different offer ;)
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
* vim:set ts=4 sw=4 :                               */ return module })
