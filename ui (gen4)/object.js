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

	var _constructor = function Constructor(json){
		// in case this is called as a function (without new)...
		if(this.constructor !== _constructor){
			return new _constructor(json)
		}

		// load initial state...
		if(json != null){
			this.loadJSON(json)
		} else {
			this._reset()
		}

		return this
	}

	eval('_constructor = '+ _constructor.toString().replace(/Constructor/g, name))

	_constructor.__proto__ = cls_proto
	_constructor.prototype = proto
	_constructor.prototype.constructor = _constructor

	return _constructor
}



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
