/**********************************************************************
* 
*
*
**********************************************************************/

define(function(require){ var module = {}
console.log('>>> objects')

//var DEBUG = DEBUG != null ? DEBUG : true



/*********************************************************************/


var makeConstructor =
module.makeConstructor =
function makeConstructor(name, a, b){
	var proto = b == null ? a : b
	var cls_proto = b == null ? b : a

	var _constructor = function Constructor(){
		// in case this is called as a function (without new)...
		if(this.constructor !== _constructor){
			// NOTE: the folowing does the job of the 'new' operator but
			// 		with one advantage, we can now pass arbitrarry args 
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

		// load initial state...
		if(obj.__init__ != null){
			obj.__init__.apply(obj, arguments)
		}

		return obj
	}

	// this is here to make Chrome output more user friendly...
	// skip for IE...
	if(_constructor.name == 'Constructor' 
			// skip for chrome app...
			&& !(window.chrome && chrome.runtime && chrome.runtime.id)){
		eval('_constructor = '+ _constructor
				.toString()
				.replace(/Constructor/g, name))
	}

	_constructor.__proto__ = cls_proto
	_constructor.prototype = proto
	_constructor.prototype.constructor = _constructor

	return _constructor
}



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
